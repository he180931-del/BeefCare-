import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { ReviewState } from "../../../app/fixtureSession";
import {
  expandLocalTable,
  isStressGenerated,
  stripStressRows,
  type StressGeneratedRow,
} from "../../../app/localStressData";
import type { ScreenDefinition, ScreenRole } from "../../../app/screenManifest";
import {
  Badge,
  Button,
  Field,
  Info,
  inputCls,
  PageHeader,
  Table,
  Td,
  Th,
} from "../../../components/ui";
import {
  EmptyState,
  FilterBar,
  FixtureNotice,
  InlineMessage,
  LoadingState,
  SummaryStrip,
  WorkSection,
} from "../../../components/workspace";
import { initialCows, type CowSeed } from "../../../data/cowsData";

type ExitType = "SALE" | "CULL" | "OTHER" | "DEATH" | "MISSING";
type ExitStatus = "DRAFT" | "PENDING" | "CONFIRMED" | "VOIDED" | "DISMISSED";
type HerdStatus = "ACTIVE" | "EXIT_PENDING" | "EXITED" | "VOIDED";
type ExitLine = {
  cattleCode: string;
  tag: string;
  breed: string;
  sex: string;
  exitWeightKg: number;
  weightBasis: "MEASURED" | "ESTIMATED";
  lastPen: string;
  unitPrice: number;
  amount: number;
  herdStatus: HerdStatus;
};
type Collection = {
  id: string;
  date: string;
  amount: number;
  method: "CASH" | "BANK";
  reference: string;
  recordedBy?: string;
  status: "ACTIVE" | "VOIDED";
  voidReason?: string;
};
type ExitVoucher = {
  id: string;
  code: string;
  type: ExitType;
  date: string;
  status: ExitStatus;
  buyer?: string;
  buyerPhone?: string;
  destination?: string;
  reason?: string;
  source?: string;
  sourceVoucherId?: string;
  lossKind?: "DIED" | "MISSING";
  reporter?: string;
  cause?: string;
  disposal?: string;
  certificate?: string;
  vehicle?: string;
  note?: string;
  deductions: number;
  dueDate?: string;
  pricingBasis?: "PER_KG" | "PER_HEAD";
  attachments: Array<{ name: string; type?: string; size?: number }>;
  evidence?: Array<{ name: string; type?: string; size?: number }>;
  lines: ExitLine[];
  collections: Collection[];
  history: string[];
  version: number;
  createdBy?: string;
  createdAt?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  dismissedBy?: string;
  dismissedAt?: string;
  restoreToPen?: string;
  updatedAt: string;
};

const KEY = "beefcare-ui-demo";
const today = () => new Date().toISOString().slice(0, 10);
const money = (value: number) =>
  `${Math.max(0, Number(value) || 0).toLocaleString("vi-VN")} đ`;
const dateLabel = (value: string) =>
  value
    ? new Intl.DateTimeFormat("vi-VN").format(new Date(`${value}T00:00:00`))
    : "—";
const typeLabel: Record<ExitType, string> = {
  SALE: "Bán",
  CULL: "Loại thải",
  OTHER: "Khác",
  DEATH: "Chết",
  MISSING: "Mất tích",
};
const statusLabel: Record<ExitStatus, string> = {
  DRAFT: "Nháp",
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xuất",
  VOIDED: "Đã hủy",
  DISMISSED: "Đã bác",
};
const statusTone = (status: ExitStatus): "ok" | "warn" | "err" | undefined =>
  status === "CONFIRMED"
    ? "ok"
    : status === "VOIDED" || status === "DISMISSED"
      ? "err"
      : status === "PENDING" || status === "DRAFT"
        ? "warn"
        : undefined;
type DemoRoot = { account?: Record<string, unknown> };
const rootRead = (): DemoRoot => {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "{}") as DemoRoot;
  } catch {
    return {};
  }
};
const accountRead = <T,>(key: string, fallback: T): T =>
  (rootRead().account?.[key] as T) ?? fallback;
const accountWrite = (key: string, value: unknown) => {
  const root = rootRead();
  window.localStorage.setItem(
    KEY,
    JSON.stringify({
      ...root,
      account: { ...(root.account || {}), [key]: value },
    }),
  );
};
const appendAudit = (action: string, voucher: ExitVoucher, reason?: string) => {
  const audit = accountRead<Array<Record<string, unknown>>>(
    "herd-exit-audit",
    [],
  );
  accountWrite("herd-exit-audit", [
    ...audit,
    {
      id: `${voucher.id}-${Date.now()}`,
      action,
      voucherId: voucher.id,
      code: voucher.code,
      reason,
      at: new Date().toISOString(),
      actor: "Nguyễn Văn Hùng",
    },
  ]);
};

const seedVouchers = (): ExitVoucher[] => [
  {
    id: "exit-demo-001",
    code: "PX-2026-0007",
    type: "SALE",
    date: "2026-10-15",
    status: "CONFIRMED",
    buyer: "Lò mổ Hà Đông",
    buyerPhone: "0243 555 018",
    certificate: "KD-HN-2026-004402",
    vehicle: "29C-778.21",
    note: "Cân tại trại trước khi lên xe",
    deductions: 0,
    pricingBasis: "PER_KG",
    attachments: [
      { name: "hop-dong-lo-mo-HD-1510.pdf", type: "PDF" },
      { name: "phieu-can-xuat-1510.pdf", type: "PDF" },
    ],
    lines: [
      {
        cattleCode: "BC-000203",
        tag: "VN-0412",
        breed: "Zebu đỏ",
        sex: "Đực",
        exitWeightKg: 352,
        weightBasis: "MEASURED",
        lastPen: "B1",
        unitPrice: 90000,
        amount: 31680000,
        herdStatus: "EXITED",
      },
    ],
    collections: [
      {
        id: "collect-demo-1",
        date: "2026-10-15",
        amount: 20000000,
        method: "BANK",
        reference: "FT-PX-0007",
        recordedBy: "Nguyễn Văn Hùng",
        status: "ACTIVE",
      },
    ],
    history: [
      "15/10/2026 · Tạo và xác nhận phiếu",
      "15/10/2026 · Đóng phân chuồng B1 cho bò BC-000203",
      "15/10/2026 · Ghi nhận thu một phần",
    ],
    version: 2,
    createdBy: "Nguyễn Văn Hùng",
    createdAt: "2026-10-15T07:00:00+07:00",
    confirmedBy: "Nguyễn Văn Hùng",
    confirmedAt: "2026-10-15T07:10:00+07:00",
    updatedAt: "2026-10-15T07:10:00+07:00",
    dueDate: "2026-10-22",
  },
  {
    id: "exit-demo-pending",
    code: "PX-2026-0008",
    type: "DEATH",
    date: "2026-10-21",
    status: "PENDING",
    source: "Ca sức khỏe HC-0418",
    sourceVoucherId: "HC-0418",
    lossKind: "DIED",
    reporter: "Trần Quốc Long",
    cause: "Tiêu chảy cấp, điều trị 3 ngày không đáp ứng",
    disposal: "Tiêu hủy / chôn lấp tại trại",
    deductions: 0,
    attachments: [{ name: "anh-bo-chet-BC000156.jpg", type: "JPG" }],
    evidence: [{ name: "anh-bo-chet-BC000156.jpg", type: "JPG" }],
    lines: [
      {
        cattleCode: "BC-000156",
        tag: "VN-0377",
        breed: "Lai Sind",
        sex: "Cái",
        exitWeightKg: 180,
        weightBasis: "ESTIMATED",
        lastPen: "A2",
        unitPrice: 0,
        amount: 0,
        herdStatus: "EXIT_PENDING",
      },
    ],
    collections: [],
    history: [
      "21/10/2026 · Ca HC-0418 đóng với kết quả Chết",
      "21/10/2026 · Hệ thống tạo đề xuất chờ Chủ trại xác nhận",
    ],
    version: 1,
    createdBy: "Hệ thống",
    createdAt: "2026-10-21T17:20:00+07:00",
    updatedAt: "2026-10-21T17:20:00+07:00",
  },
  {
    id: "exit-demo-draft",
    code: "PX-2026-0009",
    type: "SALE",
    date: today(),
    status: "DRAFT",
    buyer: "",
    deductions: 0,
    pricingBasis: "PER_KG",
    attachments: [],
    lines: [
      {
        cattleCode: "BC-000211",
        tag: "VN-0431",
        breed: "Lai Sind",
        sex: "Đực",
        exitWeightKg: 332,
        weightBasis: "ESTIMATED",
        lastPen: "B1",
        unitPrice: 0,
        amount: 0,
        herdStatus: "ACTIVE",
      },
    ],
    collections: [],
    history: [`${today()} · Tạo phiếu nháp`],
    version: 1,
    createdBy: "Nguyễn Văn Hùng",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "exit-demo-voided",
    code: "PX-2026-0006",
    type: "CULL",
    date: "2026-09-28",
    status: "VOIDED",
    buyer: "Thương lái Ba Vì",
    reason: "Ghi nhầm con",
    deductions: 0,
    attachments: [],
    lines: [
      {
        cattleCode: "BC-000061",
        tag: "VN-BV-0206",
        breed: "Lai Sind",
        sex: "Cái",
        exitWeightKg: 338,
        weightBasis: "MEASURED",
        lastPen: "B1",
        unitPrice: 80000,
        amount: 27040000,
        herdStatus: "VOIDED",
      },
    ],
    collections: [],
    history: [
      "28/09/2026 · Tạo và xác nhận phiếu",
      "28/09/2026 · Hủy phiếu: Ghi nhầm con",
    ],
    version: 2,
    createdBy: "Nguyễn Văn Hùng",
    confirmedBy: "Nguyễn Văn Hùng",
    confirmedAt: "2026-09-28T08:00:00+07:00",
    voidedBy: "Nguyễn Văn Hùng",
    voidedAt: "2026-09-28T08:20:00+07:00",
    voidReason: "Ghi nhầm con",
    updatedAt: "2026-09-28T08:20:00+07:00",
  },
];

const normalizeLine = (
  line: Record<string, unknown>,
  status: ExitStatus,
): ExitLine => ({
  cattleCode: String(line.cattleCode || line.code || ""),
  tag: String(line.tag || ""),
  breed: String(line.breed || ""),
  sex: String(line.sex || ""),
  exitWeightKg: Number(line.exitWeightKg || line.weight || 0),
  weightBasis: String(line.weightBasis || line.basis || "")
    .toUpperCase()
    .includes("EST")
    ? "ESTIMATED"
    : "MEASURED",
  lastPen: String(line.lastPen || line.pen || ""),
  unitPrice: Number(line.unitPrice || line.price || 0),
  amount: Number(
    line.amount ||
      Number(line.exitWeightKg || line.weight || 0) *
        Number(line.unitPrice || line.price || 0),
  ),
  herdStatus: String(
    line.herdStatus ||
      (status === "CONFIRMED"
        ? "EXITED"
        : status === "PENDING"
          ? "EXIT_PENDING"
          : status === "VOIDED"
            ? "VOIDED"
            : "ACTIVE"),
  ) as HerdStatus,
});
const normalizeVoucher = (row: Record<string, unknown>): ExitVoucher => {
  const rawStatus = String(row.status || "DRAFT").toUpperCase();
  const status = (
    ["DRAFT", "PENDING", "CONFIRMED", "VOIDED", "DISMISSED"].includes(rawStatus)
      ? rawStatus
      : "DRAFT"
  ) as ExitStatus;
  const rawType = String(row.type || "SALE").toUpperCase();
  const type = (
    ["SALE", "CULL", "OTHER", "DEATH", "MISSING"].includes(rawType)
      ? rawType
      : "SALE"
  ) as ExitType;
  const rawLines = Array.isArray(row.lines)
    ? (row.lines as Array<Record<string, unknown>>)
    : [];
  const rawCollections = Array.isArray(row.collections)
    ? (row.collections as Array<Record<string, unknown>>)
    : [];
  const detail =
    row.detail && typeof row.detail === "object"
      ? (row.detail as Record<string, unknown>)
      : {};
  const attachments = (
    Array.isArray(row.attachments)
      ? row.attachments
      : Array.isArray(detail.docs)
        ? detail.docs
        : []
  ).map((file) =>
    typeof file === "string"
      ? { name: file }
      : (file as { name: string; type?: string; size?: number }),
  );
  return {
    id: String(row.id || row.code || `exit-${Date.now()}`),
    code: String(row.code || row.id || ""),
    type,
    date: String(row.date || today()),
    status,
    buyer: String(row.buyer || row.who || "") || undefined,
    buyerPhone: String(row.buyerPhone || row.trader || "") || undefined,
    destination: String(row.destination || "") || undefined,
    reason: String(row.reason || detail.reason || "") || undefined,
    source: String(row.source || detail.source || "") || undefined,
    sourceVoucherId:
      String(row.sourceVoucherId || detail.sourceVoucherId || "") || undefined,
    lossKind:
      String(
        row.lossKind ||
          (type === "MISSING" ? "MISSING" : type === "DEATH" ? "DIED" : ""),
      ).toUpperCase() === "MISSING"
        ? "MISSING"
        : type === "DEATH"
          ? "DIED"
          : undefined,
    reporter: String(row.reporter || detail.reporter || "") || undefined,
    cause: String(row.cause || detail.cause || "") || undefined,
    disposal: String(row.disposal || detail.disposal || "") || undefined,
    certificate: String(row.certificate || "") || undefined,
    vehicle: String(row.vehicle || "") || undefined,
    note: String(row.note || "") || undefined,
    deductions: Number(
      row.deductions || row.deduction || detail.deduction || 0,
    ),
    dueDate: String(row.dueDate || "") || undefined,
    pricingBasis: String(row.pricingBasis || "")
      .toUpperCase()
      .includes("HEAD")
      ? "PER_HEAD"
      : "PER_KG",
    attachments,
    evidence: Array.isArray(row.evidence) ? row.evidence : attachments,
    lines: rawLines.length
      ? rawLines.map((line) => normalizeLine(line, status))
      : Array.isArray(detail.cows)
        ? (detail.cows as Array<Record<string, unknown>>).map((line) =>
            normalizeLine(line, status),
          )
        : [],
    collections: rawCollections.map((item, index) => ({
      id: String(item.id || `${String(row.id)}-collection-${index}`),
      date: String(item.date || ""),
      amount: Number(item.amount || 0),
      method:
        String(item.method || "")
          .toUpperCase()
          .includes("CASH") || String(item.method || "").includes("tiền")
          ? "CASH"
          : "BANK",
      reference: String(item.reference || item.ref || ""),
      recordedBy: String(item.recordedBy || item.by || ""),
      status:
        String(item.status || "").toUpperCase() === "VOIDED"
          ? "VOIDED"
          : "ACTIVE",
      voidReason: item.voidReason ? String(item.voidReason) : undefined,
    })),
    history: (Array.isArray(row.history)
      ? row.history
      : Array.isArray(detail.history)
        ? detail.history
        : []
    ).map(String),
    version: Number(row.version || 1),
    createdBy: String(row.createdBy || row.by || "") || undefined,
    createdAt: String(row.createdAt || "") || undefined,
    confirmedBy: String(row.confirmedBy || "") || undefined,
    confirmedAt: String(row.confirmedAt || "") || undefined,
    voidReason: String(row.voidReason || "") || undefined,
    voidedBy: String(row.voidedBy || "") || undefined,
    voidedAt: String(row.voidedAt || "") || undefined,
    dismissedBy: String(row.dismissedBy || "") || undefined,
    dismissedAt: String(row.dismissedAt || "") || undefined,
    restoreToPen: String(row.restoreToPen || "") || undefined,
    updatedAt: String(row.updatedAt || new Date().toISOString()),
  };
};
const CANONICAL_KEY = "herd-exit-vouchers-v2";
const storedVouchers = (): ExitVoucher[] => {
  const canonical = accountRead<unknown[]>(CANONICAL_KEY, []);
  if (canonical.length)
    return canonical
      .filter((row): row is Record<string, unknown> =>
        Boolean(row && typeof row === "object"),
      )
      .map(normalizeVoucher);
  const legacy = accountRead<unknown[]>("herd-exit-vouchers", []);
  if (legacy.length) {
    const normalized = legacy
      .filter((row): row is Record<string, unknown> =>
        Boolean(row && typeof row === "object"),
      )
      .map(normalizeVoucher);
    accountWrite(CANONICAL_KEY, normalized);
    return normalized;
  }
  const seeded = seedVouchers();
  accountWrite(CANONICAL_KEY, seeded);
  return seeded;
};
const stressVoucher = (
  row: ExitVoucher & StressGeneratedRow,
): ExitVoucher & StressGeneratedRow => {
  if (!isStressGenerated(row)) return row;
  const sequence = (row.__stressIndex ?? 0) + 1;
  const lineCount = 1 + (sequence % 4);
  const unitPrice = 88_000 + (sequence % 6) * 1_000;
  const lines: ExitLine[] = Array.from({ length: lineCount }, (_, index) => {
    const exitWeightKg = 315 + ((sequence * 17 + index * 11) % 58);
    return {
      cattleCode: `BC-X${String(sequence).padStart(4, "0")}-${index + 1}`,
      tag: `VN-X${String(sequence * 10 + index).padStart(5, "0")}`,
      breed: ["Zebu đỏ", "Lai Sind", "Brahman lai"][(sequence + index) % 3],
      sex: "Đực",
      exitWeightKg,
      weightBasis: (sequence + index) % 5 === 0 ? "ESTIMATED" : "MEASURED",
      lastPen: (sequence + index) % 2 ? "B1" : "C1",
      unitPrice,
      amount: exitWeightKg * unitPrice,
      herdStatus: "EXITED",
    };
  });
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  const day = String(1 + (sequence % 28)).padStart(2, "0");
  const buyer = [
    "Lò mổ Hà Đông",
    "HTX chăn nuôi Ba Vì",
    "Thương lái Nguyễn Văn Phúc – Sơn Tây",
  ][sequence % 3];
  return {
    ...row,
    type: "SALE",
    date: `2026-10-${day}`,
    status: "CONFIRMED",
    buyer,
    buyerPhone: sequence % 2 ? "0243 555 018" : "0987 654 321",
    certificate: `KD-HN-2026-${String(4400 + sequence).padStart(6, "0")}`,
    vehicle: `29C-${String(700 + sequence).padStart(3, "0")}.${String(sequence % 100).padStart(2, "0")}`,
    note: "Dữ liệu mô phỏng tải lớn · đã cân tại trại",
    deductions: 0,
    pricingBasis: "PER_KG",
    attachments: [],
    evidence: [],
    lines,
    collections: [
      {
        id: `collect-stress-${sequence}`,
        date: `2026-10-${day}`,
        amount: total,
        method: sequence % 2 ? "BANK" : "CASH",
        reference: `PX-STRESS-${sequence}`,
        recordedBy: "Nguyễn Văn Hùng",
        status: "ACTIVE",
      },
    ],
    history: [
      `${day}/10/2026 · Xác nhận xuất ${lineCount} con`,
      `${day}/10/2026 · Hoàn tất cập nhật đàn và chuồng`,
    ],
    version: 1,
    createdBy: "Nguyễn Văn Hùng",
    createdAt: `2026-10-${day}T07:15:00+07:00`,
    confirmedBy: "Nguyễn Văn Hùng",
    confirmedAt: `2026-10-${day}T07:30:00+07:00`,
    updatedAt: `2026-10-${day}T07:30:00+07:00`,
  };
};
const loadVouchers = (): ExitVoucher[] =>
  expandLocalTable("herd-exit-preview", storedVouchers()).map(stressVoucher);
const saveVouchers = (rows: ExitVoucher[]) =>
  accountWrite(CANONICAL_KEY, stripStressRows(rows));
const readCattle = (): CowSeed[] => {
  const rows = accountRead<unknown[]>("cattle-preview", []);
  const base = (rows.length ? rows : initialCows) as CowSeed[];
  const pending = new Set(
    loadVouchers()
      .filter((row) => row.status === "PENDING")
      .flatMap((row) => row.lines.map((line) => line.cattleCode)),
  );
  return base.map((cow) =>
    pending.has(cow.code) && cow.status === "ACTIVE"
      ? { ...cow, status: "EXIT_PENDING" as const, exitPending: true }
      : cow,
  );
};
const writeCattle = (rows: CowSeed[]) => accountWrite("cattle-preview", rows);
const cattleByCode = () => new Map(readCattle().map((cow) => [cow.code, cow]));
const warningsFor = (cow: CowSeed, exitDate = today()) => {
  const warnings: string[] = [];
  if (cow.withdrawalUntil && cow.withdrawalUntil >= exitDate)
    warnings.push(
      `⚠ Ngưng khai thác đến ${dateLabel(cow.withdrawalUntil)} (cảnh báo, không tự chặn)`,
    );
  const future = (cow.events || []).find(
    (event) => String(event.at || "").slice(0, 10) > exitDate,
  );
  if (future)
    warnings.push(
      `⚠ Có sự kiện sau ngày xuất: ${dateLabel(String(future.at).slice(0, 10))} (cảnh báo)`,
    );
  if (cow.care?.healthCase && cow.care.healthCase !== "Không có ca mở")
    warnings.push(`⚠ ${cow.care.healthCase}`);
  if (cow.repro?.label === "Mang thai") warnings.push("⚠ Đang theo dõi thai");
  return warnings;
};
const eligibleCattle = (voucherId?: string) => {
  const rows = loadVouchers();
  const reserved = new Set(
    rows
      .filter(
        (row) =>
          row.id !== voucherId &&
          ["DRAFT", "PENDING", "CONFIRMED"].includes(row.status),
      )
      .flatMap((row) => row.lines.map((line) => line.cattleCode)),
  );
  return readCattle().filter(
    (cow) =>
      cow.status === "ACTIVE" && !cow.exitVoucherId && !reserved.has(cow.code),
  );
};
const dateConflict = (cow: CowSeed, exitDate: string) => {
  const entry = String(cow.date || "");
  if (entry && exitDate < entry)
    return `${cow.code}: ngày xuất không được trước ngày nhập ${dateLabel(entry)}`;
  return "";
};
const updateCattleEffects = (
  voucher: ExitVoucher,
  mode: "draft" | "pending" | "confirm" | "restore" | "dismiss",
) => {
  const target = new Map(voucher.lines.map((line) => [line.cattleCode, line]));
  const at = new Date().toISOString();
  const cattle = readCattle().map((cow): CowSeed => {
    const line = target.get(cow.code);
    if (!line) return cow;
    if (mode === "draft")
      return { ...cow, status: "ACTIVE", exitPending: true };
    if (mode === "pending")
      return { ...cow, status: "EXIT_PENDING", exitPending: true };
    if (mode === "dismiss")
      return {
        ...cow,
        status: "ACTIVE",
        exitPending: false,
        exitVoucherId: null,
      };
    if (mode === "confirm")
      return {
        ...cow,
        status: "EXITED",
        exitVoucherId: voucher.id,
        lastExitVoucherId: voucher.id,
        exitPending: false,
        events: [
          ...(cow.events || []),
          {
            id: `${voucher.id}-${cow.code}`,
            at,
            cat: "entry-exit",
            title: `Xuất đàn ${voucher.code}`,
            badge: { label: "Đã xuất", tone: "warn" as const },
            detail: `${typeLabel[voucher.type]} · ${line.exitWeightKg} kg`,
            meta: `Ghi ${dateLabel(voucher.date)} · Nguyễn Văn Hùng`,
          },
        ],
      };
    return {
      ...cow,
      status: "ACTIVE",
      exitVoucherId: null,
      lastExitVoucherId: voucher.id,
      exitPending: false,
      barn: voucher.restoreToPen || line.lastPen || cow.barn,
    };
  });
  writeCattle(cattle);
  const assignments = accountRead<Array<Record<string, unknown>>>(
    "pen-assignments",
    [],
  );
  const affected = (assignment: Record<string, unknown>) =>
    target.has(String(assignment.cattleCode || assignment.code || ""));
  const latestByStatus = (wanted: string) => {
    const found = new Map<string, Record<string, unknown>>();
    assignments
      .filter(
        (assignment) =>
          affected(assignment) &&
          String(assignment.status || "").toUpperCase() === wanted,
      )
      .forEach((assignment) => {
        const code = String(assignment.cattleCode || assignment.code || "");
        const previous = found.get(code);
        if (
          !previous ||
          Date.parse(
            String(
              assignment.updatedAt ||
                assignment.openedAt ||
                assignment.closedAt ||
                "",
            ),
          ) >=
            Date.parse(
              String(
                previous.updatedAt ||
                  previous.openedAt ||
                  previous.closedAt ||
                  "",
              ),
            )
        )
          found.set(code, assignment);
      });
    return found;
  };
  const latestOpen = latestByStatus("OPEN");
  const latestClosed = latestByStatus("CLOSED");
  if (assignments.length)
    accountWrite(
      "pen-assignments",
      assignments.map((assignment) => {
        if (!affected(assignment)) return assignment;
        const code = String(assignment.cattleCode || assignment.code || "");
        if (mode === "confirm" && latestOpen.get(code) === assignment)
          return {
            ...assignment,
            status: "CLOSED",
            closedAt: at,
            closedBy: "Nguyễn Văn Hùng",
            closeReason: `Xuất đàn ${voucher.code}`,
          };
        if (mode === "restore" && latestClosed.get(code) === assignment)
          return {
            ...assignment,
            status: "OPEN",
            reopenedAt: at,
            reopenedBy: "Nguyễn Văn Hùng",
            reopenReason: `Hủy phiếu ${voucher.code}`,
          };
        return assignment;
      }),
    );
  const penByCattle = new Map(
    [...latestClosed.entries()].map(([code, assignment]) => [
      code,
      String(assignment.pen || ""),
    ]),
  );
  const pens = accountRead<Array<Record<string, unknown>>>("pens-preview", []);
  if (pens.length && (mode === "confirm" || mode === "restore"))
    accountWrite(
      "pens-preview",
      pens.map((pen) => {
        const code = String(pen.code || pen.id || "");
        const lines = voucher.lines.filter((line) =>
          mode === "restore"
            ? penByCattle.has(line.cattleCode) &&
              (penByCattle.get(line.cattleCode) || line.lastPen) === code
            : line.lastPen === code,
        );
        if (!lines.length) return pen;
        const count = Number(pen.count ?? pen.headCount ?? 0);
        return {
          ...pen,
          count: Math.max(
            0,
            count + (mode === "restore" ? lines.length : -lines.length),
          ),
          headCount: Math.max(
            0,
            Number(pen.headCount ?? pen.count ?? 0) +
              (mode === "restore" ? lines.length : -lines.length),
          ),
        };
      }),
    );
  const sideEffectKeys = [
    "reminders",
    "vaccination-records",
    "vaccine-records",
    "health-cases",
    "pregnancy-episodes",
    "draft-calves",
  ];
  if (mode === "confirm")
    sideEffectKeys.forEach((key) => {
      const rows = accountRead<Array<Record<string, unknown>>>(key, []);
      if (rows.length)
        accountWrite(
          key,
          rows.map((row) => {
            const rowDate = String(
              row.dueDate || row.date || row.at || "",
            ).slice(0, 10);
            const code = String(
              row.cattleCode || row.code || row.cowCode || "",
            );
            if (!target.has(code) || (rowDate && rowDate < voucher.date))
              return row;
            if (key === "health-cases")
              return {
                ...row,
                status: "CLOSED_BY_EXIT",
                closedAt: at,
                closedByExitVoucherId: voucher.id,
              };
            if (key === "pregnancy-episodes")
              return {
                ...row,
                status: "LOST",
                outcome: "DAM_EXITED",
                closedAt: at,
                closedByExitVoucherId: voucher.id,
              };
            if (key === "draft-calves")
              return {
                ...row,
                status: "REVIEW_PENDING",
                reviewReason: "DAM_EXITED",
                reviewAt: at,
                sourceExitVoucherId: voucher.id,
              };
            return {
              ...row,
              status: "CANCELLED_BY_EXIT",
              cancelledAt: at,
              cancelledByExitVoucherId: voucher.id,
            };
          }),
        );
    });
};
const appendHistory = (voucher: ExitVoucher, text: string): ExitVoucher => ({
  ...voucher,
  history: [
    ...voucher.history,
    `${new Date().toLocaleString("vi-VN")} · ${text}`,
  ],
  updatedAt: new Date().toISOString(),
  version: voucher.version + 1,
});
const roleCanWrite = (role?: ScreenRole, state?: ReviewState) =>
  role === "owner" && state !== "read-only";
const Shell = ({
  screen,
  children,
  actions,
}: {
  screen: ScreenDefinition;
  children: ReactNode;
  actions?: ReactNode;
}) => (
  <div className="herd-exit-ui flex min-w-0 max-w-full flex-col gap-5 overflow-x-clip">
    <PageHeader
      title={screen.viTitle}
      sub="Theo dõi, kiểm tra và xác nhận thông tin xuất đàn."
      badge={<FixtureNotice />}
    >
      {actions}
    </PageHeader>
    {children}
  </div>
);
const StateFrame = ({
  state,
  children,
}: {
  state: ReviewState;
  children: ReactNode;
}) =>
  state === "loading" ? (
    <LoadingState label="Đang tải phiếu xuất đàn…" />
  ) : state === "error" ? (
    <InlineMessage tone="err">
      Không thể tải dữ liệu phiếu xuất đàn.
    </InlineMessage>
  ) : (
    <>{children}</>
  );
const Guard = ({
  role,
  state,
  children,
}: {
  role?: ScreenRole;
  state: ReviewState;
  children: ReactNode;
}) => {
  const canWrite = roleCanWrite(role, state);
  return (
    <>
      {!canWrite && (
        <InlineMessage
          tone="warn"
          title={
            role === "manager" ? "Quản lý chỉ được đọc." : "Chế độ chỉ đọc."
          }
        >
          Biểu mẫu được mở ở chế độ chỉ đọc; các thao tác ghi nhận đã vô hiệu
          hóa.
        </InlineMessage>
      )}
      <fieldset disabled={!canWrite} className={!canWrite ? "opacity-80" : ""}>
        {children}
      </fieldset>
    </>
  );
};

function ExitList({
  screen,
  role,
  state,
}: {
  screen: ScreenDefinition;
  role?: ScreenRole;
  state: ReviewState;
}) {
  const nav = useNavigate();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [range, setRange] = useState("ALL");
  const rows = loadVouchers();
  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!query ||
            `${row.code} ${row.lines.map((line) => line.cattleCode).join(" ")} ${row.buyer || ""}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (type === "ALL" || row.type === type) &&
          (status === "ALL" || row.status === status) &&
          (range === "ALL" || row.date >= range),
      ),
    [rows, query, type, status, range],
  );
  const confirmed = rows.filter((row) => row.status === "CONFIRMED");
  const outstanding = confirmed.reduce(
    (sum, row) =>
      sum +
      Math.max(
        row.lines.reduce((value, line) => value + line.amount, 0) -
          row.deductions -
          row.collections
            .filter((item) => item.status === "ACTIVE")
            .reduce((value, item) => value + item.amount, 0),
        0,
      ),
    0,
  );
  if (state === "empty")
    return (
      <Shell screen={screen}>
        <EmptyState
          title="Chưa có phiếu xuất đàn"
          description="Chủ trại có thể tạo phiếu bán, loại thải hoặc hoàn tất đề xuất chết, mất tích."
          actionLabel="Về tổng quan"
          onAction={() => nav("/ui/scr-77")}
        />
      </Shell>
    );
  return (
    <Shell
      screen={screen}
      actions={
        roleCanWrite(role, state) && (
          <Button variant="primary" onClick={() => nav("/ui/scr-70")}>
            Tạo phiếu xuất
          </Button>
        )
      }
    >
      <StateFrame state={state}>
        <FilterBar
          actions={
            <span className="text-xs text-subtle">
              {role === "manager"
                ? "Quản lý · chỉ xem"
                : "Chủ trại · được ghi nhận"}
            </span>
          }
        >
          <input
            className={`${inputCls} min-w-[220px] flex-1`}
            aria-label="Tìm phiếu xuất"
            placeholder="Tìm số phiếu, mã bò, bên nhận"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className={`${inputCls} w-[150px]`}
            aria-label="Lọc loại xuất"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="ALL">Mọi loại</option>
            {Object.entries(typeLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className={`${inputCls} w-[160px]`}
            aria-label="Lọc trạng thái"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ALL">Mọi trạng thái</option>
            {Object.entries(statusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            className={`${inputCls} w-[170px]`}
            aria-label="Lọc từ ngày"
            value={range}
            onChange={(event) => setRange(event.target.value)}
          >
            <option value="ALL">Toàn bộ thời gian</option>
            <option value="2026-10-01">Từ 01/10/2026</option>
            <option value="2026-11-01">Từ 01/11/2026</option>
          </select>
        </FilterBar>
        <SummaryStrip
          items={[
            { label: "Đang hiển thị", value: visible.length },
            {
              label: "Chờ xác nhận",
              value: rows.filter((row) => row.status === "PENDING").length,
            },
            {
              label: "Đã xuất",
              value: confirmed.reduce((sum, row) => sum + row.lines.length, 0),
            },
            { label: "Còn phải thu", value: money(outstanding) },
          ]}
        />
        <Table wide scroll>
          <thead>
            <tr>
              <Th>Số phiếu</Th>
              <Th>Ngày</Th>
              <Th>Loại</Th>
              <Th>Bò / bên nhận</Th>
              <Th>Số con</Th>
              <Th>Giá trị</Th>
              <Th>Trạng thái</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const value = row.lines.reduce(
                (sum, line) => sum + line.amount,
                0,
              );
              const target =
                row.status === "PENDING" &&
                (row.type === "DEATH" || row.type === "MISSING")
                  ? `/ui/scr-71?id=${encodeURIComponent(row.id)}`
                  : row.status === "DRAFT"
                    ? `/ui/scr-70?id=${encodeURIComponent(row.id)}`
                    : `/ui/scr-110?id=${encodeURIComponent(row.id)}`;
              return (
                <tr key={row.id}>
                  <Td>
                    <button
                      className="font-semibold text-brand"
                      onClick={() => {
                        accountWrite("selected-herd-exit", {
                          id: row.id,
                          code: row.code,
                        });
                        nav(target);
                      }}
                    >
                      {row.code}
                    </button>
                  </Td>
                  <Td>{dateLabel(row.date)}</Td>
                  <Td>{typeLabel[row.type]}</Td>
                  <Td>
                    {row.lines.map((line) => line.cattleCode).join(", ")}
                    <br />
                    <span className="text-subtle">
                      {row.buyer || row.source || row.reason || "—"}
                    </span>
                  </Td>
                  <Td>{row.lines.length}</Td>
                  <Td>{value ? money(value - row.deductions) : "—"}</Td>
                  <Td>
                    <Badge tone={statusTone(row.status)}>
                      {statusLabel[row.status]}
                    </Badge>
                  </Td>
                  <Td>
                    <Button small onClick={() => nav(target)}>
                      {row.status === "DRAFT"
                        ? "Tiếp tục"
                        : row.status === "PENDING"
                          ? "Xem & xác nhận"
                          : "Xem"}
                    </Button>
                  </Td>
                </tr>
              );
            })}
            {!visible.length && (
              <tr>
                <Td colSpan={8}>
                  <EmptyState
                    title="Không có phiếu phù hợp"
                    description="Thử bỏ bớt bộ lọc hoặc tạo phiếu mới."
                    compact
                  />
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
        <InlineMessage tone="info">
          Phiếu nháp hoặc chờ xác nhận giữ bò trong đàn và đánh dấu “Chờ xuất”.
          Khi xác nhận, bò được rời chuồng; phiếu đã hủy vẫn giữ lịch sử và khôi
          phục chuồng trước đó.
        </InlineMessage>
      </StateFrame>
    </Shell>
  );
}

function CattlePicker({
  voucherId,
  selected,
  onChange,
  disabled,
}: {
  voucherId?: string;
  selected: string[];
  onChange: (codes: string[]) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [pen, setPen] = useState("ALL");
  const all = eligibleCattle(voucherId);
  const candidates = all.filter(
    (cow) =>
      (!query ||
        `${cow.code} ${cow.tag || ""} ${cow.breed || ""}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (pen === "ALL" || cow.barn === pen),
  );
  const pens = [...new Set(all.map((cow) => cow.barn).filter(Boolean))];
  const toggle = (code: string) =>
    onChange(
      selected.includes(code)
        ? selected.filter((value) => value !== code)
        : [...selected, code],
    );
  return (
    <WorkSection
      title="Bò đủ điều kiện"
      description="Chỉ hiện bò đang nuôi và chưa nằm trong phiếu xuất khác. Cảnh báo không chặn lựa chọn; Chủ trại rà soát trước khi xác nhận."
    >
      <div className="mb-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_170px]">
        <input
          className={inputCls}
          aria-label="Tìm bò đủ điều kiện"
          placeholder="Mã bò, thẻ tai, giống"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          disabled={disabled}
        />
        <select
          className={inputCls}
          aria-label="Lọc chuồng đủ điều kiện"
          value={pen}
          onChange={(event) => setPen(event.target.value)}
          disabled={disabled}
        >
          <option value="ALL">Mọi chuồng</option>
          {pens.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>
      <Table wide scroll>
        <thead>
          <tr>
            <Th />
            <Th>Mã / thẻ tai</Th>
            <Th>Nhóm · giai đoạn</Th>
            <Th>Chuồng</Th>
            <Th>Cân gần nhất</Th>
            <Th>Cảnh báo</Th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((cow) => {
            const warnings = warningsFor(cow);
            return (
              <tr key={cow.code}>
                <Td>
                  <input
                    type="checkbox"
                    checked={selected.includes(cow.code)}
                    onChange={() => toggle(cow.code)}
                    disabled={disabled}
                    aria-label={`Chọn ${cow.code}`}
                  />
                </Td>
                <Td>
                  {cow.code}
                  <br />
                  <span className="text-subtle">
                    {cow.tag || "Chưa cấp thẻ"}
                  </span>
                </Td>
                <Td>
                  {cow.purpose || "—"} · {cow.stage || "—"}
                </Td>
                <Td>{cow.barn || "—"}</Td>
                <Td>
                  {cow.weight == null
                    ? "—"
                    : `${cow.weight} kg · ${cow.weightEst ? "Ước tính" : "Đo thực tế"}`}
                </Td>
                <Td>
                  {warnings.length ? (
                    <Badge tone="warn">{warnings.join(" · ")}</Badge>
                  ) : (
                    <Badge tone="ok">Không cảnh báo</Badge>
                  )}
                </Td>
              </tr>
            );
          })}
          {!candidates.length && (
            <tr>
              <Td colSpan={6}>
                <EmptyState
                  title="Không còn bò đủ điều kiện"
                  description="Bò đã xuất, đã hủy hoặc đang được giữ bởi phiếu khác sẽ không xuất hiện."
                  compact
                />
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
      <p className="m-0 text-xs font-semibold text-brand">
        Đã chọn {selected.length} con ·{" "}
        {candidates
          .filter((cow) => selected.includes(cow.code))
          .reduce((sum, cow) => sum + (cow.weight || 0), 0)}{" "}
        kg theo cân gần nhất
      </p>
    </WorkSection>
  );
}

function NormalExit({
  screen,
  role,
  state,
}: {
  screen: ScreenDefinition;
  role?: ScreenRole;
  state: ReviewState;
}) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const existing = loadVouchers().find(
    (row) => row.id === params.get("id") || row.code === params.get("code"),
  );
  const [type, setType] = useState<Exclude<ExitType, "DEATH" | "MISSING">>(
    existing?.type === "CULL" || existing?.type === "OTHER"
      ? existing.type
      : "SALE",
  );
  const [date, setDate] = useState(existing?.date || today());
  const [buyer, setBuyer] = useState(existing?.buyer || "");
  const [reason, setReason] = useState(existing?.reason || "");
  const [certificate, setCertificate] = useState(existing?.certificate || "");
  const [vehicle, setVehicle] = useState(existing?.vehicle || "");
  const [note, setNote] = useState(existing?.note || "");
  const [basis, setBasis] = useState<"PER_KG" | "PER_HEAD">(
    existing?.pricingBasis || "PER_KG",
  );
  const [deductions, setDeductions] = useState(existing?.deductions || 0);
  const [collected, setCollected] = useState(
    existing?.collections
      .filter((item) => item.status === "ACTIVE")
      .reduce((sum, item) => sum + item.amount, 0) || 0,
  );
  const [method, setMethod] = useState<"CASH" | "BANK">(
    existing?.collections[0]?.method || "BANK",
  );
  const [dueDate, setDueDate] = useState(existing?.dueDate || today());
  const [selectedCodes, setSelectedCodes] = useState<string[]>(
    existing?.lines.map((line) => line.cattleCode) || [],
  );
  const [lines, setLines] = useState<ExitLine[]>(existing?.lines || []);
  const [documents, setDocuments] = useState(existing?.attachments || []);
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const cattle = cattleByCode();
  const selectedRows = selectedCodes
    .map((code) => cattle.get(code))
    .filter((row): row is CowSeed => Boolean(row));
  const syncLines = (codes: string[]) => {
    setSelectedCodes(codes);
    setLines(
      codes.map((code) => {
        const current = lines.find((line) => line.cattleCode === code);
        const cow = cattle.get(code);
        return (
          current || {
            cattleCode: code,
            tag: cow?.tag || "",
            breed: cow?.breed || "",
            sex: cow?.sex || "",
            exitWeightKg: cow?.weight || 0,
            weightBasis: cow?.weightEst ? "ESTIMATED" : "MEASURED",
            lastPen: cow?.barn || "",
            unitPrice: 0,
            amount: 0,
            herdStatus: "ACTIVE",
          }
        );
      }),
    );
  };
  const updateLine = (code: string, patch: Partial<ExitLine>) =>
    setLines((rows) =>
      rows.map((line) =>
        line.cattleCode === code
          ? {
              ...line,
              ...patch,
              amount:
                basis === "PER_HEAD"
                  ? Number(patch.unitPrice ?? line.unitPrice)
                  : Number(patch.exitWeightKg ?? line.exitWeightKg) *
                    Number(patch.unitPrice ?? line.unitPrice),
            }
          : line,
      ),
    );
  const total = lines.reduce(
    (sum, line) =>
      sum +
      (basis === "PER_HEAD"
        ? line.unitPrice
        : line.exitWeightKg * line.unitPrice),
    0,
  );
  const receivable = Math.max(total - deductions, 0);
  const outstanding = Math.max(receivable - collected, 0);
  const warnings = selectedRows.flatMap((cow) =>
    warningsFor(cow, date).map((warning) => `${cow.code}: ${warning}`),
  );
  const persist = (event: FormEvent, confirm = false) => {
    event.preventDefault();
    setError("");
    if (!date || !selectedCodes.length)
      return setError("Ngày xuất và ít nhất một bò là bắt buộc.");
    if (new Set(selectedCodes).size !== selectedCodes.length)
      return setError("Không được chọn trùng mã bò.");
    if (type === "SALE" && !buyer.trim())
      return setError("Bên mua / nhận là bắt buộc cho phiếu bán.");
    if (type !== "SALE" && !reason.trim())
      return setError("Lý do xuất là bắt buộc cho phiếu loại thải hoặc khác.");
    if (deductions < 0 || deductions > total)
      return setError("Khấu trừ phải nằm trong khoảng từ 0 đến tổng tiền bò.");
    if (basis === "PER_HEAD" && lines.some((line) => line.unitPrice <= 0))
      return setError("Đơn giá theo con phải lớn hơn 0 cho từng bò.");
    if (
      basis === "PER_KG" &&
      lines.some((line) => line.exitWeightKg <= 0 || line.unitPrice <= 0)
    )
      return setError("Cân và đơn giá theo kg phải lớn hơn 0 cho từng bò.");
    if (confirm && !review)
      return setError(
        "Cần rà soát và nhập cân/đơn giá hợp lệ cho từng bò trước khi xác nhận.",
      );
    if (collected > receivable)
      return setError("Tiền đã thu không được vượt quá tổng phải thu.");
    const currentRows = loadVouchers();
    const current = existing
      ? currentRows.find((row) => row.id === existing.id)
      : undefined;
    if (existing && (!current || current.version !== existing.version))
      return setError(
        "Phiếu đã thay đổi ở nơi khác; hãy mở lại để tránh ghi đè.",
      );
    if (current && current.status !== "DRAFT")
      return setError("Chỉ phiếu nháp mới được chỉnh sửa hoặc xác nhận lại.");
    const reservedByOther = new Set(
      currentRows
        .filter(
          (row) =>
            row.id !== current?.id &&
            ["DRAFT", "PENDING", "CONFIRMED"].includes(row.status),
        )
        .flatMap((row) => row.lines.map((line) => line.cattleCode)),
    );
    const freshCattle = readCattle();
    const freshByCode = new Map(freshCattle.map((cow) => [cow.code, cow]));
    const invalid = selectedCodes
      .map((code) => freshByCode.get(code))
      .some(
        (cow) =>
          !cow ||
          cow.status !== "ACTIVE" ||
          reservedByOther.has(String(cow?.code || "")) ||
          (cow.exitVoucherId && cow.exitVoucherId !== current?.id),
      );
    if (invalid)
      return setError(
        "Danh sách bò đã thay đổi: chỉ bò đang nuôi, chưa nằm trong phiếu khác mới được xuất.",
      );
    if (confirm) {
      const conflict = selectedRows
        .map((cow) => dateConflict(cow, date))
        .find(Boolean);
      if (conflict) return setError(conflict);
    }
    const now = new Date().toISOString();
    const base = current || existing;
    const existingCollections = base?.collections || [];
    const alreadyCollected = existingCollections
      .filter((item) => item.status === "ACTIVE")
      .reduce((sum, item) => sum + item.amount, 0);
    if (collected < alreadyCollected)
      return setError(
        "Số tiền đã thu không được giảm trực tiếp; hãy lập phiếu điều chỉnh hoặc hủy khoản thu.",
      );
    const delta = collected - alreadyCollected;
    const collectionId = `${base?.id || "new"}-collection-${date}-${method}-${delta}`;
    const collections =
      delta > 0 && !existingCollections.some((item) => item.id === collectionId)
        ? [
            ...existingCollections,
            {
              id: collectionId,
              date,
              amount: delta,
              method,
              reference: "",
              recordedBy: "Nguyễn Văn Hùng",
              status: "ACTIVE" as const,
            },
          ]
        : existingCollections;
    const voucher: ExitVoucher = {
      ...(base || {
        id: `exit-${Date.now()}`,
        code: `PX-2026-${String(currentRows.length + 1).padStart(4, "0")}`,
        collections: [],
        history: [],
        version: 0,
        attachments: [],
      }),
      type,
      date,
      status: confirm ? "CONFIRMED" : "DRAFT",
      buyer: buyer || undefined,
      reason: reason || undefined,
      certificate: certificate || undefined,
      vehicle: vehicle || undefined,
      note: note || undefined,
      pricingBasis: basis,
      deductions,
      dueDate,
      attachments: documents,
      lines: lines.map((line) => ({
        ...line,
        amount:
          basis === "PER_HEAD"
            ? line.unitPrice
            : line.exitWeightKg * line.unitPrice,
        herdStatus: confirm ? "EXITED" : "ACTIVE",
      })),
      collections,
      history: [
        ...(base?.history || []),
        `${new Date().toLocaleString("vi-VN")} · ${confirm ? `Xác nhận xuất ${selectedCodes.length} con` : "Lưu phiếu nháp"}`,
      ],
      version: Number(base?.version || 0) + 1,
      createdBy: base?.createdBy || "Nguyễn Văn Hùng",
      createdAt: base?.createdAt || now,
      confirmedBy: confirm ? "Nguyễn Văn Hùng" : undefined,
      confirmedAt: confirm ? now : undefined,
      updatedAt: now,
    };
    saveVouchers([
      voucher,
      ...currentRows.filter((row) => row.id !== voucher.id),
    ]);
    accountWrite("selected-herd-exit", { id: voucher.id, code: voucher.code });
    updateCattleEffects(voucher, confirm ? "confirm" : "draft");
    appendAudit(confirm ? "CONFIRM" : "SAVE_DRAFT", voucher);
    nav(`/ui/scr-110?id=${encodeURIComponent(voucher.id)}`);
  };
  if (existing && existing.status !== "DRAFT")
    return (
      <Shell screen={screen}>
        <StateFrame state={state}>
          <InlineMessage tone="warn" title="Phiếu chỉ đọc">
            Phiếu nháp mới cho phép chỉnh sửa. Phiếu {existing.code} đang ở
            trạng thái {statusLabel[existing.status]} và phải được xem tại màn
            hình chi tiết.
          </InlineMessage>
          <Button
            type="button"
            onClick={() =>
              nav(`/ui/scr-110?id=${encodeURIComponent(existing.id)}`)
            }
          >
            Mở chi tiết phiếu
          </Button>
        </StateFrame>
      </Shell>
    );
  if (state === "empty")
    return (
      <Shell screen={screen}>
        <EmptyState title="Chưa có dữ liệu để lập phiếu" />
      </Shell>
    );
  return (
    <Shell screen={screen}>
      <StateFrame state={state}>
        <Guard role={role} state={state}>
          <form
            onSubmit={(event) => persist(event)}
            className="flex flex-col gap-5"
          >
            <div className="grid gap-4 border-b border-rule pb-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <WorkSection
                title="Thông tin phiếu"
                description="Loại xuất khóa sau khi phiếu được lưu lần đầu."
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Loại xuất">
                    <select
                      className={inputCls}
                      value={type}
                      disabled={Boolean(existing)}
                      onChange={(event) =>
                        setType(event.target.value as typeof type)
                      }
                    >
                      <option value="SALE">Bán</option>
                      <option value="CULL">Loại thải</option>
                      <option value="OTHER">Khác</option>
                    </select>
                  </Field>
                  <Field label="Ngày xuất *">
                    <input
                      className={inputCls}
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </Field>
                  <Field label="Cách tính giá">
                    <select
                      className={inputCls}
                      value={basis}
                      onChange={(event) =>
                        setBasis(event.target.value as typeof basis)
                      }
                    >
                      <option value="PER_KG">Theo kg</option>
                      <option value="PER_HEAD">Theo con</option>
                    </select>
                  </Field>
                  {type === "SALE" ? (
                    <Field label="Bên mua / nhận *">
                      <input
                        className={inputCls}
                        value={buyer}
                        onChange={(event) => setBuyer(event.target.value)}
                        placeholder="Tên bên mua hoặc thương lái"
                      />
                    </Field>
                  ) : (
                    <Field label="Lý do xuất *">
                      <input
                        className={inputCls}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Lý do loại thải / khác"
                      />
                    </Field>
                  )}
                  <Field label="Số giấy kiểm dịch">
                    <input
                      className={inputCls}
                      value={certificate}
                      onChange={(event) => setCertificate(event.target.value)}
                    />
                  </Field>
                  <Field label="Biển số xe">
                    <input
                      className={inputCls}
                      value={vehicle}
                      onChange={(event) => setVehicle(event.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Ghi chú">
                  <textarea
                    className={`${inputCls} min-h-[72px]`}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </Field>
              </WorkSection>
              <SummaryStrip
                items={[
                  { label: "Số con", value: lines.length },
                  {
                    label: "Tổng cân",
                    value: `${lines.reduce((sum, line) => sum + line.exitWeightKg, 0)} kg`,
                  },
                  { label: "Tổng phải thu", value: money(receivable) },
                  { label: "Còn phải thu", value: money(outstanding) },
                ]}
              />
            </div>
            <CattlePicker
              voucherId={existing?.id}
              selected={selectedCodes}
              onChange={syncLines}
            />
            <WorkSection
              title="Cân và đơn giá từng con"
              description="Mặc định dùng cân gần nhất; ghi rõ khi là ước tính."
            >
              <Table wide scroll>
                <thead>
                  <tr>
                    <Th>Bò</Th>
                    <Th>Chuồng cuối</Th>
                    <Th>Cân xuất (kg)</Th>
                    <Th>Cơ sở</Th>
                    <Th>Đơn giá</Th>
                    <Th>Thành tiền</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.cattleCode}>
                      <Td>
                        {line.cattleCode}
                        <br />
                        <span className="text-subtle">
                          {line.breed} · {line.sex}
                        </span>
                      </Td>
                      <Td>{line.lastPen}</Td>
                      <Td>
                        <input
                          className="w-[90px] rounded border border-field px-2 py-1.5 text-xs"
                          type="number"
                          min="1"
                          value={line.exitWeightKg}
                          onChange={(event) =>
                            updateLine(line.cattleCode, {
                              exitWeightKg: Number(event.target.value),
                            })
                          }
                        />
                      </Td>
                      <Td>
                        <select
                          className="rounded border border-field px-2 py-1.5 text-xs"
                          value={line.weightBasis}
                          onChange={(event) =>
                            updateLine(line.cattleCode, {
                              weightBasis: event.target
                                .value as ExitLine["weightBasis"],
                            })
                          }
                        >
                          <option value="MEASURED">Đo thực tế</option>
                          <option value="ESTIMATED">Ước tính</option>
                        </select>
                      </Td>
                      <Td>
                        <input
                          className="w-[110px] rounded border border-field px-2 py-1.5 text-xs"
                          type="number"
                          min="0"
                          value={line.unitPrice}
                          onChange={(event) =>
                            updateLine(line.cattleCode, {
                              unitPrice: Number(event.target.value),
                            })
                          }
                        />
                      </Td>
                      <Td>
                        {money(
                          basis === "PER_HEAD"
                            ? line.unitPrice
                            : line.exitWeightKg * line.unitPrice,
                        )}
                      </Td>
                      <Td>
                        <Button
                          small
                          type="button"
                          onClick={() =>
                            syncLines(
                              selectedCodes.filter(
                                (code) => code !== line.cattleCode,
                              ),
                            )
                          }
                        >
                          Bỏ
                        </Button>
                      </Td>
                    </tr>
                  ))}
                  {!lines.length && (
                    <tr>
                      <Td colSpan={7}>
                        <EmptyState
                          title="Chưa chọn bò"
                          description="Chọn ít nhất một bò đang nuôi ở bảng đủ điều kiện."
                          compact
                        />
                      </Td>
                    </tr>
                  )}
                </tbody>
              </Table>
              {warnings.map((warning) => (
                <InlineMessage key={warning} tone="warn">
                  {warning}
                </InlineMessage>
              ))}
            </WorkSection>
            <div className="grid gap-5 lg:grid-cols-2">
              <WorkSection
                title="Thanh toán"
                description="Ghi nhận tiền cọc và phần còn phải thu."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Khấu trừ">
                    <input
                      className={inputCls}
                      type="number"
                      min="0"
                      value={deductions}
                      onChange={(event) =>
                        setDeductions(Number(event.target.value) || 0)
                      }
                    />
                  </Field>
                  <Field label="Đã thu / đặt cọc">
                    <input
                      className={inputCls}
                      type="number"
                      min="0"
                      value={collected}
                      onChange={(event) =>
                        setCollected(Number(event.target.value) || 0)
                      }
                    />
                  </Field>
                  <Field label="Phương thức">
                    <select
                      className={inputCls}
                      value={method}
                      onChange={(event) =>
                        setMethod(event.target.value as typeof method)
                      }
                    >
                      <option value="BANK">Chuyển khoản</option>
                      <option value="CASH">Tiền mặt</option>
                    </select>
                  </Field>
                  <Field label="Hạn thu còn lại">
                    <input
                      className={inputCls}
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                    />
                  </Field>
                </div>
                <Info
                  cols={2}
                  items={[
                    ["Tiền bò", money(total)],
                    ["Tổng phải thu", money(receivable)],
                    ["Đã thu", money(collected)],
                    ["Còn phải thu", money(outstanding), outstanding > 0],
                  ]}
                />
              </WorkSection>
              <WorkSection
                title="Chứng từ"
                description="Đính kèm ảnh hoặc PDF để đối chiếu khi cần."
              >
                <input
                  aria-label="Chọn chứng từ xuất đàn"
                  className="block w-full text-xs"
                  type="file"
                  accept="application/pdf,image/jpeg"
                  multiple
                  onChange={(event) =>
                    setDocuments([
                      ...documents,
                      ...Array.from(event.target.files || []).map((file) => ({
                        name: file.name,
                        type: file.type === "application/pdf" ? "PDF" : "JPG",
                        size: file.size,
                      })),
                    ])
                  }
                />
                {documents.map((document) => (
                  <div
                    key={document.name}
                    className="flex items-center gap-2 border-b border-rule py-2 text-xs"
                  >
                    <Badge>{document.type || "Tệp"}</Badge>
                    <span>{document.name}</span>
                    <span className="flex-1" />
                    <Button
                      small
                      type="button"
                      onClick={() =>
                        setDocuments(
                          documents.filter(
                            (file) => file.name !== document.name,
                          ),
                        )
                      }
                    >
                      Xóa
                    </Button>
                  </div>
                ))}
              </WorkSection>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-rule pt-4">
              <label className="mr-auto flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={review}
                  onChange={(event) => setReview(event.target.checked)}
                />{" "}
                Tôi đã rà soát cảnh báo và dữ liệu phiếu
              </label>
              <Button type="button" onClick={() => nav("/ui/scr-69")}>
                Hủy
              </Button>
              <Button type="button" onClick={(event) => persist(event)}>
                Lưu nháp
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={(event) => persist(event, true)}
              >
                Xác nhận xuất đàn
              </Button>
            </div>
            {error && <InlineMessage tone="err">{error}</InlineMessage>}
          </form>
        </Guard>
      </StateFrame>
    </Shell>
  );
}

function PendingIncident({
  screen,
  role,
  state,
}: {
  screen: ScreenDefinition;
  role?: ScreenRole;
  state: ReviewState;
}) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const rows = loadVouchers();
  const current = rows.find(
    (row) => row.id === params.get("id") || row.code === params.get("code"),
  );
  const [date, setDate] = useState(current?.date || today());
  const [kind] = useState<Extract<ExitType, "DEATH" | "MISSING">>(
    current?.lossKind === "MISSING" || current?.type === "MISSING"
      ? "MISSING"
      : "DEATH",
  );
  const [reporter, setReporter] = useState(current?.reporter || "");
  const [source] = useState(current?.source || "Ca sức khỏe");
  const [cause, setCause] = useState(current?.cause || "");
  const [disposal, setDisposal] = useState(current?.disposal || "");
  const [dismissReason, setDismissReason] = useState("");
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const save = (event: FormEvent, action: "CONFIRM" | "DISMISS") => {
    event.preventDefault();
    setError("");
    if (!current)
      return setError("Không tìm thấy đề xuất chết/mất theo liên kết này.");
    if (current.status !== "PENDING")
      return setError("Đề xuất này đã được xử lý và không thể sửa lại.");
    if (!reporter.trim()) return setError("Người báo là bắt buộc.");
    if (action === "CONFIRM" && !review)
      return setError("Cần xác nhận đã rà soát điều kiện và hiệu ứng phiếu.");
    if (
      action === "CONFIRM" &&
      (!cause.trim() || (kind === "DEATH" && !disposal.trim()))
    )
      return setError(
        kind === "DEATH"
          ? "Nguyên nhân và phương án xử lý xác là bắt buộc."
          : "Nguyên nhân mất tích là bắt buộc.",
      );
    if (action === "DISMISS" && !dismissReason.trim())
      return setError("Lý do bác đề xuất là bắt buộc.");
    const fresh = loadVouchers().find((row) => row.id === current.id);
    if (!fresh || fresh.version !== current.version)
      return setError("Đề xuất đã thay đổi ở nơi khác; hãy mở lại.");
    const now = new Date().toISOString();
    const next = appendHistory(
      {
        ...fresh,
        type: kind,
        lossKind: kind === "MISSING" ? "MISSING" : "DIED",
        date,
        reporter,
        source: fresh.source,
        cause: cause || undefined,
        disposal: disposal || undefined,
        status: action === "CONFIRM" ? "CONFIRMED" : "DISMISSED",
        lines: fresh.lines.map((line) => ({
          ...line,
          herdStatus: action === "CONFIRM" ? "EXITED" : "ACTIVE",
        })),
        confirmedBy: action === "CONFIRM" ? "Nguyễn Văn Hùng" : undefined,
        confirmedAt: action === "CONFIRM" ? now : undefined,
        dismissedBy: action === "DISMISS" ? "Nguyễn Văn Hùng" : undefined,
        dismissedAt: action === "DISMISS" ? now : undefined,
        reason: action === "DISMISS" ? dismissReason : fresh.reason,
      },
      action === "CONFIRM"
        ? `Xác nhận ${typeLabel[kind].toLowerCase()}`
        : `Bác đề xuất: ${dismissReason}`,
    );
    saveVouchers(rows.map((row) => (row.id === next.id ? next : row)));
    accountWrite("selected-herd-exit", { id: next.id, code: next.code });
    updateCattleEffects(next, action === "CONFIRM" ? "confirm" : "dismiss");
    appendAudit(action, next, action === "DISMISS" ? dismissReason : undefined);
    nav(`/ui/scr-110?id=${encodeURIComponent(next.id)}`);
  };
  if (state === "empty")
    return (
      <Shell screen={screen}>
        <EmptyState
          title="Không có đề xuất chết hoặc mất tích"
          description="Các đề xuất được tạo từ ca sức khỏe đã đóng với kết quả chết hoặc mất tích."
        />
      </Shell>
    );
  return (
    <Shell screen={screen}>
      <StateFrame state={state}>
        <Guard role={role} state={state}>
          <form
            onSubmit={(event) => save(event, "CONFIRM")}
            className="flex flex-col gap-5"
          >
            <WorkSection
              title={
                current
                  ? `${current.code} · đề xuất từ ca sức khỏe`
                  : "Đề xuất không tồn tại"
              }
              description="Bò vẫn ở trong đàn và giữ chuồng cho đến khi Chủ trại xác nhận."
            >
              {current ? (
                <>
                  <SummaryStrip
                    items={[
                      {
                        label: "Bò",
                        value: current.lines
                          .map((line) => line.cattleCode)
                          .join(", "),
                      },
                      {
                        label: "Nguồn",
                        value: `${source}${current.sourceVoucherId ? ` · ${current.sourceVoucherId}` : ""}`,
                      },
                      {
                        label: "Loại kết quả",
                        value: kind === "DEATH" ? "Chết" : "Mất tích",
                      },
                      {
                        label: "Trạng thái",
                        value: statusLabel[current.status],
                      },
                      {
                        label: "Hiệu ứng sau xác nhận",
                        value: "Đã xuất · rời chuồng",
                      },
                    ]}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Loại kết quả">
                      <input
                        className={inputCls}
                        value={kind === "DEATH" ? "Chết" : "Mất tích"}
                        readOnly
                      />
                    </Field>
                    <Field label="Ngày ghi nhận *">
                      <input
                        className={inputCls}
                        type="date"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                      />
                    </Field>
                    <Field label="Nguồn ca sức khỏe">
                      <input className={inputCls} value={source} readOnly />
                    </Field>
                    <Field label="Người báo *">
                      <input
                        className={inputCls}
                        value={reporter}
                        onChange={(event) => setReporter(event.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Nguyên nhân *">
                    <textarea
                      className={`${inputCls} min-h-[80px]`}
                      value={cause}
                      onChange={(event) => setCause(event.target.value)}
                      maxLength={1000}
                    />
                  </Field>
                  {kind === "DEATH" && (
                    <Field label="Phương án xử lý xác *">
                      <textarea
                        className={`${inputCls} min-h-[80px]`}
                        value={disposal}
                        onChange={(event) => setDisposal(event.target.value)}
                        maxLength={1000}
                      />
                    </Field>
                  )}
                  <InlineMessage tone="warn">
                    Kiểm tra trước khi xác nhận:{" "}
                    {current.lines
                      .map(
                        (line) => `${line.cattleCode} ở chuồng ${line.lastPen}`,
                      )
                      .join(" · ")}
                    . Sau xác nhận, các nhắc việc/mũi tiêm tương lai và phân
                    chuồng mở sẽ được đóng theo phiếu.
                  </InlineMessage>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={review}
                      onChange={(event) => setReview(event.target.checked)}
                    />{" "}
                    Tôi đã xem kiểm tra và xác nhận hiệu ứng xuất đàn
                  </label>
                  <Info
                    cols={2}
                    items={[
                      (current.evidence || current.attachments).length
                        ? [
                            "Bằng chứng",
                            (current.evidence || current.attachments)
                              .map((file) => file.name)
                              .join(", "),
                          ]
                        : ["Bằng chứng", "Chưa đính kèm"],
                    ]}
                  />
                </>
              ) : (
                <EmptyState
                  title="Không tìm thấy đề xuất"
                  actionLabel="Về danh sách"
                  onAction={() => nav("/ui/scr-69")}
                />
              )}
            </WorkSection>
            {current && (
              <>
                <div className="flex flex-wrap justify-end gap-2 border-t border-rule pt-4">
                  <Button type="button" onClick={() => nav("/ui/scr-69")}>
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    onClick={(event) => save(event, "DISMISS")}
                  >
                    Bác đề xuất
                  </Button>
                  <Button
                    variant="primary"
                    type="button"
                    onClick={(event) => save(event, "CONFIRM")}
                  >
                    Xác nhận xuất đàn
                  </Button>
                </div>
                <Field label="Lý do bác đề xuất (chỉ nhập khi chọn Bác đề xuất)">
                  <input
                    className={inputCls}
                    value={dismissReason}
                    onChange={(event) => setDismissReason(event.target.value)}
                    placeholder="Ví dụ: Đã tìm thấy bò"
                  />
                </Field>
              </>
            )}
            {error && <InlineMessage tone="err">{error}</InlineMessage>}
          </form>
        </Guard>
      </StateFrame>
    </Shell>
  );
}

function VoidExit({
  screen,
  role,
  state,
}: {
  screen: ScreenDefinition;
  role?: ScreenRole;
  state: ReviewState;
}) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const rows = loadVouchers();
  const current = rows.find(
    (row) => row.id === params.get("id") || row.code === params.get("code"),
  );
  const [reason, setReason] = useState("");
  const [review, setReview] = useState(false);
  const [restorePen, setRestorePen] = useState(
    current?.restoreToPen || current?.lines[0]?.lastPen || "",
  );
  const [error, setError] = useState("");
  const penOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...(current?.lines.map((line) => line.lastPen).filter(Boolean) || []),
          ...accountRead<Array<Record<string, unknown>>>("pen-assignments", [])
            .filter(
              (assignment) =>
                String(assignment.status || "").toUpperCase() === "OPEN",
            )
            .map((assignment) => String(assignment.pen || ""))
            .filter(Boolean),
        ]),
      ),
    [current],
  );
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!current || current.status !== "CONFIRMED")
      return setError("Chỉ được hủy phiếu đã xác nhận theo liên kết này.");
    if (!reason.trim()) return setError("Lý do hủy là bắt buộc.");
    if (!review)
      return setError("Cần xác nhận đã kiểm tra đúng phiếu trước khi hủy.");
    if (!restorePen && current.lines.some((line) => !line.lastPen))
      return setError(
        "Không có chuồng mở để hoàn tác; hãy chọn chuồng thay thế.",
      );
    const fresh = loadVouchers().find((row) => row.id === current.id);
    if (!fresh || fresh.version !== current.version)
      return setError("Phiếu đã thay đổi ở nơi khác; hãy mở lại.");
    const cattle = readCattle();
    const assignments = accountRead<Array<Record<string, unknown>>>(
      "pen-assignments",
      [],
    );
    const pens = accountRead<Array<Record<string, unknown>>>(
      "pens-preview",
      [],
    );
    for (const line of fresh.lines) {
      const cow = cattle.find((item) => item.code === line.cattleCode);
      if (!cow || cow.status !== "EXITED" || cow.exitVoucherId !== fresh.id)
        return setError(
          `${line.cattleCode}: chỉ bò đã xuất bởi đúng phiếu này mới được khôi phục.`,
        );
      const closed = assignments
        .filter(
          (assignment) =>
            String(assignment.cattleCode || assignment.code || "") ===
              line.cattleCode &&
            String(assignment.status || "").toUpperCase() === "CLOSED",
        )
        .sort(
          (a, b) =>
            Date.parse(String(b.closedAt || b.updatedAt || "")) -
            Date.parse(String(a.closedAt || a.updatedAt || "")),
        )[0];
      const targetPen = restorePen || String(closed?.pen || line.lastPen || "");
      const pen = pens.find(
        (item) => String(item.code || item.id || "") === targetPen,
      );
      if (pen) {
        const capacity = Number(pen.capacity ?? pen.maxCapacity ?? 0);
        const occupied = Number(pen.count ?? pen.headCount ?? 0);
        if (capacity > 0 && occupied >= capacity)
          return setError(
            `${line.cattleCode}: chuồng ${targetPen} đã đầy; chọn chuồng thay thế còn chỗ.`,
          );
      }
    }
    const next = appendHistory(
      {
        ...fresh,
        status: "VOIDED",
        restoreToPen: restorePen || undefined,
        voidReason: reason,
        voidedBy: "Nguyễn Văn Hùng",
        voidedAt: new Date().toISOString(),
        lines: fresh.lines.map((line) => ({ ...line, herdStatus: "VOIDED" })),
      },
      `Hủy phiếu: ${reason}`,
    );
    saveVouchers(rows.map((row) => (row.id === next.id ? next : row)));
    accountWrite("selected-herd-exit", { id: next.id, code: next.code });
    updateCattleEffects(next, "restore");
    appendAudit("VOID", next, reason);
    nav(`/ui/scr-110?id=${encodeURIComponent(next.id)}`);
  };
  if (state === "empty")
    return (
      <Shell screen={screen}>
        <EmptyState title="Chưa có phiếu để hủy" />
      </Shell>
    );
  return (
    <Shell screen={screen}>
      <StateFrame state={state}>
        <Guard role={role} state={state}>
          <form onSubmit={submit} className="max-w-3xl">
            <WorkSection
              title={current ? `Hủy ${current.code}` : "Không tìm thấy phiếu"}
              description="Hủy phiếu không xóa dữ liệu; thông tin từng con và lý do vẫn được giữ trong lịch sử."
            >
              {current ? (
                <>
                  <Info
                    cols={2}
                    items={[
                      ["Phiếu", current.code],
                      ["Ngày xuất", dateLabel(current.date)],
                      ["Loại", typeLabel[current.type]],
                      [
                        "Bò",
                        current.lines.map((line) => line.cattleCode).join(", "),
                      ],
                      ["Trạng thái hiện tại", statusLabel[current.status]],
                      [
                        "Sau khi hủy",
                        "Đã hủy · bò trở lại đàn · mở lại chuồng",
                      ],
                    ]}
                  />
                  <InlineMessage tone="warn">
                    Không thể sửa nội dung phiếu hoặc xóa lịch sử sau khi hủy.
                    Chỉ Chủ trại được thực hiện thao tác này.
                  </InlineMessage>
                  <Field label="Lý do hủy *">
                    <textarea
                      className={`${inputCls} min-h-[90px]`}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      maxLength={500}
                      placeholder="Nêu rõ phiếu ghi nhầm, sai bò hoặc lý do nghiệp vụ"
                    />
                  </Field>
                  <Field label="Chuồng hoàn tác / chuồng thay thế">
                    <select
                      className={inputCls}
                      value={restorePen}
                      onChange={(event) => setRestorePen(event.target.value)}
                    >
                      <option value="">Theo chuồng mở gần nhất</option>
                      {penOptions.map((pen) => (
                        <option key={pen} value={pen}>
                          {pen}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <InlineMessage tone={penOptions.length ? "info" : "warn"}>
                    Kiểm tra chuồng:{" "}
                    {penOptions.length
                      ? `${penOptions.join(", ")} · chỉ mở lại phân chuồng gần nhất còn hiệu lực.`
                      : "Chưa có phân chuồng còn hiệu lực; hãy chọn chuồng thay thế trước khi hủy."}
                  </InlineMessage>
                  <label className="mt-4 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={review}
                      onChange={(event) => setReview(event.target.checked)}
                    />{" "}
                    Tôi đã kiểm tra đúng phiếu và hiểu việc trả bò về đàn
                  </label>
                </>
              ) : (
                <EmptyState
                  title="Không tìm thấy phiếu đã xác nhận"
                  actionLabel="Về danh sách"
                  onAction={() => nav("/ui/scr-69")}
                />
              )}
            </WorkSection>
            {current && (
              <div className="mt-4 flex justify-end gap-2 border-t border-rule pt-4">
                <Button
                  type="button"
                  onClick={() =>
                    nav(`/ui/scr-110?id=${encodeURIComponent(current.id)}`)
                  }
                >
                  Không hủy
                </Button>
                <Button variant="danger" type="submit">
                  Hủy phiếu xuất
                </Button>
              </div>
            )}
            {error && (
              <InlineMessage tone="err" className="mt-4">
                {error}
              </InlineMessage>
            )}
          </form>
        </Guard>
      </StateFrame>
    </Shell>
  );
}

export function HerdExitPreviewScreen({
  screen,
  role,
  state = "success",
}: {
  screen: ScreenDefinition;
  role?: ScreenRole;
  state?: ReviewState;
}) {
  if (screen.id === "SCR-69")
    return <ExitList screen={screen} role={role} state={state} />;
  if (screen.id === "SCR-70")
    return <NormalExit screen={screen} role={role} state={state} />;
  if (screen.id === "SCR-71")
    return <PendingIncident screen={screen} role={role} state={state} />;
  return <VoidExit screen={screen} role={role} state={state} />;
}
