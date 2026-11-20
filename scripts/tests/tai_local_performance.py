#!/usr/bin/env python3
"""Safe, localhost-only exploratory API timings for the isolated Tai QA database.

The harness never creates or edits domain data. Login uses an explicitly
synthetic local identity and a password read from BEEFCARE_PERF_PASSWORD.
P03 uses the read-only report endpoint for both its successful and invalid
criteria paths. P07 propagation, full browser rendering, real network profiles,
and a formal SRS pass are intentionally not inferred from API timings.
"""

from __future__ import annotations

import argparse
import calendar
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
import json
import math
import os
from pathlib import Path
import re
import statistics
import threading
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import (  # no third-party HTTP dependency
    HTTPCookieProcessor,
    HTTPRedirectHandler,
    OpenerDirector,
    ProxyHandler,
    Request,
    build_opener,
)
from http.cookiejar import CookieJar


SCRIPT_VERSION = "1.0"
ALLOWED_ORIGINS = {"http://127.0.0.1:8080", "http://localhost:8080"}
LOAD_PREFIX = "qa-tai-load-"
LOAD_SUFFIX = "@beefcare.local"
SYNTHETIC_EMAIL = re.compile(r"^[a-z0-9._+-]+@(?:beefcare\.local|example\.test)$", re.IGNORECASE)
# The report API accepts these backend group keys (not the singular UI labels).
GROUPS = {"BREEDING_FEMALES", "YOUNG_STOCK", "FATTENING", "CALVES", "BREEDING_BULLS", "OTHER"}
LIFE_STAGES = {"UNWEANED_CALF", "WEANED_CALF", "YOUNG_STOCK", "ADULT"}
REPORT_FILTERS = {
    "RPT-01": {"pen", "breed", "group", "stage"},
    "RPT-02": {"pen", "breed", "group", "stage"},
    "RPT-03": {"pen", "group"},
    "RPT-04": {"pen", "breed", "group", "stage"},
    "RPT-05": {"pen", "breed", "group", "stage"},
    "RPT-06": {"pen", "breed", "group", "stage"},
    "RPT-07": {"pen"},
}


class HarnessError(RuntimeError):
    """Safe-to-display configuration or protocol error (never includes a body)."""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class HttpResult:
    def __init__(self, status: int, body: bytes, elapsed_ms: float):
        self.status = status
        self.elapsed_ms = elapsed_ms
        self.response_bytes = len(body)
        try:
            self.json = json.loads(body.decode("utf-8")) if body and 200 <= status < 300 else None
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.json = None


class LocalApiSession:
    def __init__(self, origin: str, timeout_seconds: float):
        self.origin = origin
        self.timeout_seconds = timeout_seconds
        cookies = CookieJar()
        self.opener: OpenerDirector = build_opener(
            ProxyHandler({}), HTTPCookieProcessor(cookies), NoRedirect()
        )
        self.csrf_token: str | None = None

    def request(self, method: str, path: str, payload: Any = None) -> HttpResult:
        if not path.startswith("/api/") or "\\" in path or path.startswith("//"):
            raise HarnessError("Refusing a request outside the relative /api path allow-list.")
        data = None if payload is None else json.dumps(payload, separators=(",", ":")).encode("utf-8")
        headers = {"Accept": "application/json"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        if self.csrf_token is not None and method.upper() not in {"GET", "HEAD", "OPTIONS"}:
            headers["X-XSRF-TOKEN"] = self.csrf_token
        request = Request(self.origin + path, data=data, headers=headers, method=method.upper())
        started = time.perf_counter_ns()
        try:
            response = self.opener.open(request, timeout=self.timeout_seconds)
        except HTTPError as exc:
            # Capture status only; API error bodies can contain user-supplied data.
            response = exc
        except (URLError, TimeoutError, OSError) as exc:
            raise HarnessError(f"Local request failed ({type(exc).__name__}); response details were omitted.") from None
        try:
            body = response.read()
            status = int(response.status)
        finally:
            response.close()
        elapsed_ms = (time.perf_counter_ns() - started) / 1_000_000
        if 300 <= status < 400:
            raise HarnessError(f"Refusing HTTP redirect (status {status}); no redirected request was sent.")
        return HttpResult(status, body, elapsed_ms)

    def refresh_csrf(self) -> None:
        result = self.request("GET", "/api/csrf")
        if result.status != 200 or not isinstance(result.json, dict):
            raise HarnessError(f"CSRF preflight failed (HTTP {result.status}).")
        token = result.json.get("token")
        if not isinstance(token, str) or not token:
            raise HarnessError("CSRF preflight response did not contain a token.")
        self.csrf_token = token

    def login_and_verify(self, email: str, password: str, farm_id: int) -> dict[str, Any]:
        self.refresh_csrf()
        result = self.request("POST", "/api/authenticate", {"username": email, "password": password, "rememberMe": False})
        if result.status != 204:
            raise HarnessError(f"Synthetic account login failed (HTTP {result.status}); credentials were not recorded.")
        self.refresh_csrf()
        account = self.request("GET", "/api/account")
        if account.status != 200 or not isinstance(account.json, dict):
            raise HarnessError(f"Authenticated identity check failed (HTTP {account.status}).")
        expected = email.casefold()
        actual_email = account.json.get("email")
        actual_login = account.json.get("login")
        if not any(isinstance(value, str) and value.casefold() == expected for value in (actual_email, actual_login)):
            raise HarnessError("Authenticated identity did not match the requested synthetic test account.")
        permissions = self.request("GET", f"/api/farms/{farm_id}/my-permissions")
        if permissions.status != 200 or not isinstance(permissions.json, dict):
            raise HarnessError(f"Farm membership check failed (HTTP {permissions.status}).")
        role = str(permissions.json.get("role", "")).upper()
        if role not in {"OWNER", "MANAGER"}:
            raise HarnessError("The synthetic account must be an Owner or Manager in the selected QA farm.")
        return {"role": role}

    def logout(self) -> bool:
        if self.csrf_token is None:
            return False
        return self.request("POST", "/api/logout").status == 204


def _origin(value: str) -> str:
    parsed = urlsplit(value.rstrip("/"))
    origin = f"{parsed.scheme}://{parsed.netloc}"
    if (
        origin not in ALLOWED_ORIGINS
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
        or parsed.username
        or parsed.password
    ):
        raise HarnessError("Base URL must be exactly http://127.0.0.1:8080 or http://localhost:8080.")
    return origin


def _two_year_start(end: date) -> date:
    year = end.year - 2
    return date(year, end.month, min(end.day, calendar.monthrange(year, end.month)[1]))


def _plus_years_clamped(value: date, years: int) -> date:
    year = value.year + years
    return date(year, value.month, min(value.day, calendar.monthrange(year, value.month)[1]))


def _parse_date(value: str, field: str) -> date:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        raise HarnessError(f"{field} must use YYYY-MM-DD.")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HarnessError(f"{field} must use YYYY-MM-DD.") from exc


def _month_span(start: date, end: date) -> int:
    return (end.year - start.year) * 12 + end.month - start.month


def _percentile(values: list[float], quantile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    pos = (len(ordered) - 1) * quantile
    low = math.floor(pos)
    high = math.ceil(pos)
    if low == high:
        return round(ordered[low], 3)
    return round(ordered[low] + (ordered[high] - ordered[low]) * (pos - low), 3)


def _summary(samples: list[dict[str, Any]], threshold_ms: float | None, scope_note: str) -> dict[str, Any]:
    values = [row["elapsed_ms"] for row in samples if isinstance(row.get("elapsed_ms"), (float, int))]
    failures = sum(1 for row in samples if row.get("status") != "OK")
    return {
        "measurement_scope": scope_note,
        "sample_count": len(samples),
        "error_count": failures,
        "threshold_ms": threshold_ms,
        "numeric_threshold_comparisons": (
            {
                "min_within": min(values) <= threshold_ms,
                "median_within": statistics.median(values) <= threshold_ms,
                "max_within": max(values) <= threshold_ms,
                "warning": "Descriptive local API comparison only; this is not an SRS pass/fail result.",
            }
            if values and threshold_ms is not None
            else None
        ),
        "elapsed_ms": {
            "min": round(min(values), 3),
            "median": round(statistics.median(values), 3),
            "mean": round(statistics.fmean(values), 3),
            "p90_descriptive": _percentile(values, 0.90),
            "p95_descriptive": _percentile(values, 0.95),
            "max": round(max(values), 3),
        } if values else None,
        "samples": samples,
    }


def _has_request_errors(value: Any) -> bool:
    if isinstance(value, dict):
        if isinstance(value.get("error_count"), int) and value["error_count"] > 0:
            return True
        if isinstance(value.get("errors"), int) and value["errors"] > 0:
            return True
        if value.get("status") in {"HTTP_ERROR", "INVALID_RESPONSE", "REQUEST_ERROR"}:
            return True
        return any(_has_request_errors(item) for item in value.values())
    if isinstance(value, list):
        return any(_has_request_errors(item) for item in value)
    return False


def _timed_call(session: LocalApiSession, method: str, path: str, payload: Any = None,
                expected_status: set[int] | None = None, tag: str | None = None,
                validator: Any = None) -> dict[str, Any]:
    expected = expected_status or {200}
    try:
        result = session.request(method, path, payload)
        status = "OK" if result.status in expected else "HTTP_ERROR"
        observations = None
        if status == "OK" and validator is not None:
            try:
                observations = validator(result)
            except HarnessError:
                status = "INVALID_RESPONSE"
        row = {
            "status": status,
            "http_status": result.status,
            "elapsed_ms": round(result.elapsed_ms, 3),
            "response_bytes": result.response_bytes,
        }
        if tag:
            row["tag"] = tag
        if isinstance(observations, dict):
            row["safe_observations"] = observations
        return row
    except HarnessError as exc:
        return {"status": "REQUEST_ERROR", "error": str(exc), "elapsed_ms": None, **({"tag": tag} if tag else {})}


def _valid_report_body(args: argparse.Namespace, start: date, end: date, recent: bool = False) -> dict[str, Any]:
    if recent:
        end = date.today()
        start = end - timedelta(days=29)
    filters = REPORT_FILTERS[args.report_type]
    group = args.herd_group or ("FATTENING" if args.report_type == "RPT-02" else None)
    body: dict[str, Any] = {
        "reportType": args.report_type,
        "from": start.isoformat(),
        "to": end.isoformat(),
        "penIds": [args.pen_id] if args.pen_id and "pen" in filters else [],
        "breedIds": [args.breed_id] if args.breed_id and "breed" in filters else [],
        "herdGroups": [group] if group and "group" in filters else [],
        "lifeStages": [args.life_stage] if args.life_stage and "stage" in filters else [],
    }
    return body


def _request_sample(session: LocalApiSession, name: str, method: str, path: str,
                    payload: Any, expected_status: set[int] | None = None,
                    validator: Any = None) -> dict[str, Any]:
    row = _timed_call(session, method, path, payload, expected_status, name, validator)
    return row


def _single_user_probes(session: LocalApiSession, args: argparse.Namespace, start: date, end: date,
                        farm_id: int, cattle_id: int, samples: int, warmups: int) -> dict[str, Any]:
    farm_path = f"/api/farms/{farm_id}"
    report_body = _valid_report_body(args, start, end)
    quick_end = date.today()
    quick_start = quick_end - timedelta(days=29)
    success_body = _valid_report_body(args, quick_start, quick_end, recent=False)
    success_body["reportType"] = "RPT-01"
    success_body["herdGroups"] = []
    success_body["lifeStages"] = []
    success_body["breedIds"] = []
    success_body["penIds"] = []
    invalid_body = {
        "reportType": "RPT-01",
        "from": (end + timedelta(days=1)).isoformat(),
        "to": end.isoformat(),  # intentionally reversed; FarmReportService rejects before any source query
        "penIds": [], "breedIds": [], "herdGroups": [], "lifeStages": [],
    }
    dashboard_path = farm_path + "/dashboard"
    report_path = farm_path + "/dashboard/reports"
    cattle_path = farm_path + f"/cattle/{cattle_id}"

    # Confirm the caller-selected farm before collecting measurements.
    farm_check = session.request("GET", dashboard_path)
    if farm_check.status != 200 or not isinstance(farm_check.json, dict):
        raise HarnessError(f"Selected farm dashboard preflight failed (HTTP {farm_check.status}).")
    if str(farm_check.json.get("farmName", "")).strip() != args.farm_name:
        raise HarnessError("Farm name check failed; selected ID is not the explicitly named QA farm.")
    active_cattle = farm_check.json.get("activeCattle")

    def verify_dashboard(result: HttpResult) -> None:
        if not isinstance(result.json, dict) or result.json.get("farmName") != args.farm_name:
            raise HarnessError("Dashboard response farm name did not match the explicit QA farm.")

    def report_validator(expected_type: str):
        def validate(result: HttpResult) -> dict[str, Any]:
            if not isinstance(result.json, dict) or result.json.get("reportType") != expected_type:
                raise HarnessError("Report response did not match the requested read-only report type.")
            summary = result.json.get("summary")
            if not isinstance(summary, dict):
                return {}
            return {
                key: summary[key]
                for key in ("validWeighings", "recordsWithoutWeight")
                if isinstance(summary.get(key), (int, float))
            }
        return validate

    success_report_validator = report_validator("RPT-01")
    filtered_report_validator = report_validator(args.report_type)

    dashboard_rows = []
    for _ in range(warmups):
        warm = session.request("GET", dashboard_path)
        if warm.status != 200:
            raise HarnessError(f"Dashboard warm-up failed (HTTP {warm.status}).")
        verify_dashboard(warm)
    for i in range(samples):
        row = _request_sample(session, "P01_dashboard_api", "GET", dashboard_path, None, validator=verify_dashboard)
        row["iteration"] = i + 1
        dashboard_rows.append(row)
        if row["status"] != "OK":
            break

    # P03: success and validation-error paths use a report form whose service is
    # explicitly @Transactional(readOnly=true); no business command is sent.
    success_rows: list[dict[str, Any]] = []
    for _ in range(warmups):
        warm = session.request("POST", report_path, success_body)
        if warm.status != 200:
            raise HarnessError(f"P03 successful-form warm-up failed (HTTP {warm.status}).")
    for i in range(samples):
        row = _request_sample(session, "P03_report_form_success", "POST", report_path, success_body, validator=success_report_validator)
        row["iteration"] = i + 1
        success_rows.append(row)
        if row["status"] != "OK":
            break

    validation_rows: list[dict[str, Any]] = []
    for _ in range(warmups):
        warm = session.request("POST", report_path, invalid_body)
        if warm.status not in {400, 422}:
            raise HarnessError(f"P03 validation-error warm-up was not rejected as expected (HTTP {warm.status}).")
    for i in range(samples):
        row = _request_sample(session, "P03_report_form_validation_error", "POST", report_path, invalid_body, {400, 422})
        row["iteration"] = i + 1
        validation_rows.append(row)
        if row["status"] != "OK":
            break

    report_rows: list[dict[str, Any]] = []
    for _ in range(warmups):
        warm = session.request("POST", report_path, report_body)
        if warm.status != 200:
            raise HarnessError(f"P04 filtered-report warm-up failed (HTTP {warm.status}).")
    for i in range(samples):
        row = _request_sample(session, "P04_filtered_report_24_months", "POST", report_path, report_body, validator=filtered_report_validator)
        row["iteration"] = i + 1
        report_rows.append(row)
        if row["status"] != "OK":
            break

    cattle_rows: list[dict[str, Any]] = []
    def verify_cattle(result: HttpResult) -> None:
        if not isinstance(result.json, dict) or int(result.json.get("id", -1)) != cattle_id:
            raise HarnessError("Cattle detail response did not match the synthetic cattle ID.")
    for _ in range(warmups):
        warm = session.request("GET", cattle_path)
        if warm.status != 200:
            raise HarnessError(f"Cattle detail warm-up failed (HTTP {warm.status}).")
        verify_cattle(warm)
    for i in range(samples):
        row = _request_sample(session, "P02_cattle_profile_api", "GET", cattle_path, None, validator=verify_cattle)
        row["iteration"] = i + 1
        cattle_rows.append(row)
        if row["status"] != "OK":
            break

    report_dataset_match = active_cattle == 300 and _month_span(start, end) == 24
    return {
        "active_cattle_reported_by_dashboard": active_cattle,
        "dataset_size_matches_300_target": report_dataset_match,
        "date_range": {"from": start.isoformat(), "to": end.isoformat(), "month_span": _month_span(start, end)},
        "P01": {
            "status": "MEASURED_LOCAL_API_ONLY_NOT_SRS_EVALUATION",
            **_summary(dashboard_rows, 3000, "Dashboard API surrogate only; not time-to-usable browser page."),
        },
        "P02": {
            "status": "MEASURED_LOCAL_API_ONLY_NOT_SRS_EVALUATION",
            **_summary(cattle_rows, 2000, "Cattle detail API surrogate only; excludes QR/camera scan and browser rendering."),
        },
        "P03": {
            "status": "MEASURED_LOCAL_READ_ONLY_REPORT_FORM_NOT_SRS_EVALUATION",
            "valid_form_success": _summary(success_rows, 2000, "Successful report-form POST to read-only service; no domain write."),
            "validation_error": _summary(validation_rows, 2000, "Reversed report-period error from read-only service; validation occurs before source queries."),
            "mutating_form_success": "NOT_RUN: this harness never sends a successful business mutation.",
        },
        "P04": {
            "status": "LOCAL_API_TIMINGS_DATASET_SIZE_AND_RANGE_MATCH_HISTORY_COVERAGE_UNVERIFIED" if report_dataset_match else "DATASET_SIZE_OR_RANGE_TARGET_NOT_MET",
            "expected_active_cattle": 300,
            "expected_history_months": 24,
            "filtered_report": _summary(report_rows, 5000, "Filtered report API only; UI timing is not measured."),
            "dataset_note": "The target cattle count is checked from dashboard. Requested 24-month range and safe aggregate counts are recorded; date-by-date historical coverage is not proven by this client.",
        },
        "P07": {
            "status": "NOT_MEASURED_NO_CONTROLLED_SOURCE_EVENT",
            "read_only_probe": "No read-only endpoint exposes time since a source mutation; measuring propagation requires a controlled source event.",
            "required_manual_follow_up": "On a dedicated disposable synthetic record, time source save to event-driven reminder update and separately measure scheduled reconciliation; do not mutate this fixture as part of this harness.",
        },
    }


def _load_wave(sessions: list[LocalApiSession], args: argparse.Namespace, farm_id: int,
               cattle_id: int, start: date, end: date) -> dict[str, Any]:
    """Run three read-only endpoints from 100 separately authenticated sessions."""
    gate = threading.Event()
    report_body = _valid_report_body(args, start, end)
    farm_path = f"/api/farms/{farm_id}"
    tasks = [(index + 1, session) for index, session in enumerate(sessions)]

    def worker(user_number: int, session: LocalApiSession) -> list[dict[str, Any]]:
        gate.wait()
        outputs = []
        paths = [
            ("P06_dashboard", "GET", farm_path + "/dashboard", None),
            ("P06_filtered_report", "POST", farm_path + "/dashboard/reports", report_body),
            ("P06_cattle_detail", "GET", farm_path + f"/cattle/{cattle_id}", None),
        ]
        for name, method, path, payload in paths:
            row = _request_sample(session, name, method, path, payload)
            row["synthetic_user_index"] = user_number
            outputs.append(row)
        return outputs

    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=100, thread_name_prefix="tai-perf") as pool:
        futures = [pool.submit(worker, user_number, session) for user_number, session in tasks]
        gate.set()
        results = [row for future in as_completed(futures) for row in future.result()]
    wall_ms = (time.perf_counter() - started) * 1000
    by_case: dict[str, list[dict[str, Any]]] = {}
    for row in results:
        by_case.setdefault(row["tag"], []).append(row)
    return {
        "status": "MEASURED_LOCAL_API_LOAD_ONLY_NOT_SRS_EVALUATION",
        "distinct_authenticated_synthetic_sessions": len(sessions),
        "maximum_concurrent_workers": 100,
        "request_pattern": "Each authenticated session performs dashboard GET, filtered report POST (read-only service), and cattle detail GET in sequence; 100 sessions begin behind a start gate.",
        "wall_elapsed_ms": round(wall_ms, 3),
        "cases": {name: _summary(rows, {"P06_dashboard": 3000, "P06_filtered_report": 5000, "P06_cattle_detail": 2000}[name], "Local loopback API under concurrent distinct sessions; no browser or external network.") for name, rows in by_case.items()},
        "errors": sum(row["status"] != "OK" for row in results),
        "assessment": "No SRS pass is reported: this is loopback API load, not 4G/office-network UI measurement or deployment-capstone evidence.",
    }


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Measure read-only BeefCare API paths on an isolated local QA database.")
    parser.add_argument("--qa-local", action="store_true", required=True, help="Explicitly acknowledge the isolated local QA target.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8080", help="Only localhost:8080 is allowed; redirects are refused.")
    parser.add_argument("--farm-id", type=int, required=True)
    parser.add_argument("--farm-name", required=True, help="Must exactly match GET dashboard farmName before measurements start.")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--login-email", help="One synthetic @beefcare.local / @example.test account.")
    group.add_argument("--login-prefix", help=f"Only {LOAD_PREFIX}NNN{LOAD_SUFFIX} is accepted for 100-user mode.")
    parser.add_argument("--password-env", default="BEEFCARE_PERF_PASSWORD", help="Name of the env var holding the local seed password; never logged.")
    parser.add_argument("--cattle-id", type=int, default=int(os.environ["BEEFCARE_PERF_CATTLE_ID"]) if os.environ.get("BEEFCARE_PERF_CATTLE_ID", "").isdigit() else None)
    parser.add_argument("--users", type=int, default=1, help="1 for normal probes; --load-test requires exactly 100.")
    parser.add_argument("--load-test", action="store_true", help="Explicitly run the 100-session local API wave.")
    parser.add_argument("--login-concurrency", type=int, default=5, help="Concurrent logins to prepare sessions; not included in API load metrics.")
    parser.add_argument("--samples", type=int, default=5)
    parser.add_argument("--warmups", type=int, default=1)
    parser.add_argument("--timeout-seconds", type=float, default=15.0)
    parser.add_argument("--report-type", choices=sorted(REPORT_FILTERS), default="RPT-02")
    parser.add_argument("--from-date", help="Default: clamped date exactly 24 months before --to-date.")
    parser.add_argument("--to-date", help="Default: local machine date.")
    parser.add_argument("--pen-id", type=int)
    parser.add_argument("--breed-id", type=int)
    parser.add_argument("--herd-group", choices=sorted(GROUPS))
    parser.add_argument("--life-stage", choices=sorted(LIFE_STAGES))
    parser.add_argument("--output", required=True, help="Path for the sanitized JSON results; choose a QA artifact location.")
    args = parser.parse_args()
    if args.login_email is None and args.login_prefix is None:
        args.login_email = os.environ.get("BEEFCARE_PERF_LOGIN_EMAIL")
    return args


def _validate(args: argparse.Namespace) -> tuple[str, list[str], date, date, int, int, str]:
    origin = _origin(args.base_url)
    if not args.qa_local:
        raise HarnessError("The explicit --qa-local acknowledgement is required.")
    if not args.farm_name.strip() or args.farm_id <= 0:
        raise HarnessError("A positive QA farm ID and its exact name are required.")
    if not 1 <= args.samples <= 20 or not 0 <= args.warmups <= 5:
        raise HarnessError("Use 1–20 measured samples and 0–5 warm-ups.")
    if not 1 <= args.login_concurrency <= 10:
        raise HarnessError("Session preparation login concurrency is capped at 10.")
    if not 0.1 <= args.timeout_seconds <= 60:
        raise HarnessError("Request timeout must be between 0.1 and 60 seconds.")
    password = os.environ.get(args.password_env)
    if not password:
        raise HarnessError(f"Set the seed password in environment variable {args.password_env}; do not pass it on the command line.")
    if args.load_test:
        if args.users != 100 or args.login_prefix != LOAD_PREFIX:
            raise HarnessError("Load mode requires exactly 100 accounts using --login-prefix qa-tai-load-.")
        emails = [f"{LOAD_PREFIX}{number:03d}{LOAD_SUFFIX}" for number in range(1, 101)]
    else:
        if args.users != 1 or not args.login_email:
            raise HarnessError("Normal mode requires exactly one --login-email. Use explicit --load-test for the 100-user wave.")
        emails = [args.login_email]
    if any(not SYNTHETIC_EMAIL.fullmatch(email) for email in emails):
        raise HarnessError("Only clearly synthetic @beefcare.local or @example.test identities are allowed.")
    if args.load_test and args.login_email:
        raise HarnessError("Load mode does not accept a single login email.")
    if args.cattle_id is None or args.cattle_id <= 0:
        raise HarnessError("Set --cattle-id or BEEFCARE_PERF_CATTLE_ID to a synthetic QA cow ID.")
    if (args.pen_id is not None and args.pen_id <= 0) or (args.breed_id is not None and args.breed_id <= 0):
        raise HarnessError("Pen and breed IDs must be positive numeric synthetic fixture IDs.")
    filters = REPORT_FILTERS[args.report_type]
    effective_group = args.herd_group or ("FATTENING" if args.report_type == "RPT-02" else None)
    if ((args.pen_id and "pen" not in filters) or (args.breed_id and "breed" not in filters)
            or (effective_group and "group" not in filters) or (args.life_stage and "stage" not in filters)):
        raise HarnessError("The selected report type does not support one of the requested filters.")
    end = _parse_date(args.to_date, "--to-date") if args.to_date else date.today()
    start = _parse_date(args.from_date, "--from-date") if args.from_date else _two_year_start(end)
    if start > end or _month_span(start, end) > 24 or _plus_years_clamped(start, 2) < end:
        raise HarnessError("Report period must be ordered and no longer than 24 months.")
    output = str(Path(args.output).expanduser())
    if not output.strip():
        raise HarnessError("An output path is required.")
    return origin, emails, start, end, args.cattle_id, args.farm_id, output


def _write_json(path_text: str, report: dict[str, Any]) -> None:
    target = Path(path_text)
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_suffix(target.suffix + ".tmp")
    temp.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(target)


def main() -> int:
    args = _parse_args()
    output_path = Path(args.output).expanduser()
    if output_path.exists():
        print("Results path already exists; choose a new output path so the harness cannot overwrite an artifact.")
        return 4
    if output_path.is_dir():
        print("Results path must name a new JSON file, not a directory.")
        return 4
    run_started = datetime.now(timezone.utc)
    report: dict[str, Any] = {
        "schema_version": 1,
        "harness": "tai_local_performance.py",
        "harness_version": SCRIPT_VERSION,
        "started_at_utc": run_started.isoformat(),
        "target": {"base_url": None, "farm_id": args.farm_id, "farm_name": args.farm_name,
                   "explicit_qa_local_acknowledgement": args.qa_local, "database_guard": "QA identity is asserted by the operator; this client cannot inspect the selected database name."},
        "synthetic_identity": {"pattern": args.login_email if args.users == 1 else f"{LOAD_PREFIX}NNN{LOAD_SUFFIX}", "user_count": args.users,
                               "password_source_env": args.password_env, "password_or_session_tokens_recorded": False},
        "scope": {"business_data_mutations": False, "browser_ui": False, "network_profile": "localhost loopback only", "test_identity_data": "synthetic local identities only", "auth_session_activity": "Synthetic login/logout only; authentication bookkeeping may run."},
        "status": "RUNNING",
        "limits": [
            "Direct localhost API measurements do not measure time-to-usable browser content, QR scanning, camera, or network outside loopback.",
            "P95/P90 are descriptive summaries; the SRS does not define a required percentile.",
            "P07 source-event propagation is not measured without a controlled source mutation; this harness performs none.",
            "A numeric comparison with an SRS threshold is not a formal Pass result.",
        ],
    }
    password = os.environ.get(args.password_env, "")
    sessions: list[LocalApiSession] = []
    try:
        origin, emails, start, end, cattle_id, farm_id, output = _validate(args)
        report["target"]["base_url"] = origin
        report["date_range"] = {"from": start.isoformat(), "to": end.isoformat(), "months": _month_span(start, end)}
        def prepare(index: int, email: str) -> tuple[int, LocalApiSession, dict[str, Any]]:
            session = LocalApiSession(origin, args.timeout_seconds)
            identity = session.login_and_verify(email, password, farm_id)
            return index, session, identity
        prepared = []
        preparation_failures = 0
        with ThreadPoolExecutor(max_workers=min(args.login_concurrency, len(emails)), thread_name_prefix="tai-login") as pool:
            futures = [pool.submit(prepare, index, email) for index, email in enumerate(emails, start=1)]
            for future in as_completed(futures):
                try:
                    prepared.append(future.result())
                except Exception:
                    preparation_failures += 1
        prepared.sort(key=lambda row: row[0])
        sessions = [row[1] for row in prepared]
        if preparation_failures:
            raise HarnessError(f"{preparation_failures} synthetic session(s) failed identity or farm verification; successful sessions will be logged out.")
        roles = sorted({row[2]["role"] for row in prepared})
        report["synthetic_identity"]["verified_roles"] = roles
        report["session_preparation"] = {"distinct_authenticated_accounts": len(sessions), "login_concurrency_cap": min(args.login_concurrency, len(emails)), "all_identities_and_memberships_verified": True}
        primary = sessions[0]
        # The principal serial probes are lower-risk API timing evidence.
        serial_results = _single_user_probes(primary, args, start, end, farm_id, cattle_id, args.samples, args.warmups)
        report["observed_dataset"] = {"active_cattle": serial_results.pop("active_cattle_reported_by_dashboard"),
                                      "matches_exact_300_target": serial_results.pop("dataset_size_matches_300_target"),
                                      "report_range": serial_results.pop("date_range")}
        report["cases"] = serial_results
        if args.load_test:
            report["P06"] = _load_wave(sessions, args, farm_id, cattle_id, start, end)
        else:
            report["P06"] = {"status": "NOT_RUN_EXPLICIT_LOAD_MODE_REQUIRED", "required_command_flag": "--load-test --users 100 --login-prefix qa-tai-load-"}
        report["status"] = "MEASUREMENTS_WRITTEN_NOT_FORMALLY_EVALUATED"
        if _has_request_errors({key: value for key, value in report.items() if key in {"cases", "P06"}}):
            report["status"] = "MEASUREMENTS_WRITTEN_WITH_REQUEST_ERRORS_NOT_FORMALLY_EVALUATED"
            exit_code = 1
        else:
            exit_code = 0
    except HarnessError as exc:
        report["status"] = "ABORTED_SAFE_GUARD_OR_REQUEST_FAILURE"
        report["error"] = str(exc)
        exit_code = 2
    except Exception as exc:  # Sanitized report; do not serialize tracebacks or response bodies.
        report["status"] = "ABORTED_UNEXPECTED_ERROR"
        report["error"] = f"Unexpected {type(exc).__name__}; details were omitted from the artifact."
        exit_code = 3
    if sessions:
        logout_results = []
        with ThreadPoolExecutor(max_workers=min(args.login_concurrency, len(sessions)), thread_name_prefix="tai-logout") as pool:
            futures = [pool.submit(session.logout) for session in sessions]
            for future in as_completed(futures):
                try:
                    logout_results.append(bool(future.result()))
                except Exception:
                    logout_results.append(False)
        report["session_cleanup"] = {"attempted": len(logout_results), "logged_out": sum(logout_results), "failed": len(logout_results) - sum(logout_results)}
        if report["session_cleanup"]["failed"] and exit_code == 0:
            report["status"] = "MEASUREMENTS_WRITTEN_SESSION_CLEANUP_INCOMPLETE_NOT_FORMALLY_EVALUATED"
            exit_code = 1
    report["ended_at_utc"] = datetime.now(timezone.utc).isoformat()
    try:
        _write_json(str(Path(args.output).expanduser()), report)
    except OSError as exc:
        print(f"Could not write results JSON ({type(exc).__name__}); no credentials or response bodies were printed.")
        return 4
    print(f"Wrote sanitized local API timing JSON: {Path(args.output).expanduser()}")
    print(f"Run status: {report['status']}; formal SRS assessment: NOT_EVALUATED.")
    if "error" in report:
        print(report["error"])
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
