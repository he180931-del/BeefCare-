import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { AuthClient } from "../types";
import { normalizeEmail, validateSignIn } from "../validation/authValidation";
import {
  Alert,
  AuthShell,
  Form,
  FormField,
  primaryButtonClass,
} from "../components/AuthShell";
import {
  Divider,
  GoogleButton,
  PasswordField,
} from "../components/AuthControls";
import { ActionLink } from "../../../shared/ui";
import { AUTH_PATH, AUTH_PATHS } from "../domain/authPaths";
import {
  CREDENTIAL_MESSAGE,
  emailFromState,
  friendlyLoginError,
  isCredentialError,
  readError,
} from "../domain/authErrors";

type Props = {
  client: AuthClient;
  onAuthenticated: () => void;
  initialError: string | null;
  startFailed?: boolean;
};

export function SignInPage({
  client,
  onAuthenticated,
  initialError,
  startFailed = false,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(emailFromState(location.state));
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof validateSignIn>>({});
  const googleSignInRejected =
    new URLSearchParams(location.search).get("error") === "google-sign-in";
  const [error, setError] = useState<string | null>(
    startFailed
      ? CREDENTIAL_MESSAGE
      : googleSignInRejected
        ? "Không thể đăng nhập với Google. Vui lòng thử lại hoặc dùng email."
        : initialError,
  );
  const [credentialFailed, setCredentialFailed] = useState(startFailed);
  const [unverified, setUnverified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const resetSuccess =
    new URLSearchParams(location.search).get("reset") === "success";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setCredentialFailed(false);
    setUnverified(false);
    const nextErrors = validateSignIn({ email, password });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      await client.login(normalizeEmail(email), password, remember);
      onAuthenticated();
      if (AUTH_PATHS.has(location.pathname)) navigate("/", { replace: true });
    } catch (reason) {
      const { code } = readError(reason);
      setError(friendlyLoginError(reason));
      setCredentialFailed(isCredentialError(reason));
      setUnverified(code === "MSG-FE01-11");
      if (code === "MSG-FE01-03")
        navigate(AUTH_PATH.suspended, {
          state: { email: normalizeEmail(email) },
        });
    } finally {
      setSubmitting(false);
    }
  };

  const failed = credentialFailed && Boolean(error);
  const alert = resetSuccess ? (
    <Alert tone="success">
      Mật khẩu đã được cập nhật. Bạn có thể đăng nhập bằng mật khẩu mới.
    </Alert>
  ) : error && !failed ? (
    <Alert>
      {error}
      {unverified && (
        <span className="mt-2 block">
          <Link
            to={AUTH_PATH.verification}
            state={{ email: normalizeEmail(email) }}
            className="font-bold text-brand underline-offset-4 hover:underline"
          >
            Gửi lại email xác minh
          </Link>
        </span>
      )}
    </Alert>
  ) : null;

  return (
    <AuthShell
      title={failed ? "Đăng nhập chưa thành công" : "Đăng nhập"}
      description={
        failed
          ? "Kiểm tra thông tin và thử lại. Mật khẩu phân biệt chữ hoa, chữ thường."
          : "Đăng nhập để tiếp tục"
      }
      eyebrow={failed ? "Thông tin chưa đúng" : "Chào mừng trở lại"}
      alert={alert}
      footer={
        <>
          Chưa có tài khoản?{" "}
          <ActionLink to={AUTH_PATH.register}>Đăng ký ngay</ActionLink>
        </>
      }
    >
      <div className="space-y-4">
        <GoogleButton client={client} label="Tiếp tục với Google" />
        {!failed && <Divider>hoặc đăng nhập bằng email</Divider>}
        <Form onSubmit={submit}>
          <FormField
            id="signin-email"
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email}
            placeholder="name@example.com"
            autoComplete="username"
            maxLength={254}
            required
          />
          <PasswordField
            id="signin-password"
            label="Mật khẩu"
            value={password}
            onChange={setPassword}
            error={errors.password}
            invalid={failed}
            placeholder="••••••••••"
            autoComplete="current-password"
          />
          {failed && (
            <div role="alert" className="rounded-xl bg-[#fff0ee] px-4 py-3">
              <p className="m-0 text-[13px] font-bold text-[#b54843]">
                {error}
              </p>
              <p className="m-0 mt-1 text-[11px] text-subtle">
                Sau 5 lần sai liên tiếp, đăng nhập bị khóa 15 phút.
              </p>
            </div>
          )}
          <div className="flex items-center justify-between gap-4 text-xs">
            <label className="flex cursor-pointer items-center gap-2 text-subtle">
              <input
                className="size-4 accent-brand"
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />{" "}
              Ghi nhớ đăng nhập
            </label>
            <ActionLink
              to={AUTH_PATH.forgot}
              state={email ? { email: normalizeEmail(email) } : undefined}
            >
              Quên mật khẩu?
            </ActionLink>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className={primaryButtonClass}
          >
            {submitting
              ? "Đang đăng nhập…"
              : failed
                ? "Thử đăng nhập lại"
                : "Đăng nhập"}
          </button>
        </Form>
        {/* <Footer>
          <ActionLink to={AUTH_PATH.register}>Chưa có tài khoản? Đăng kí ngay. </ActionLink>
        </Footer> */}
      </div>
    </AuthShell>
  );
}
