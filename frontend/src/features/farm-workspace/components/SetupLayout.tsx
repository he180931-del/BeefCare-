import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import logo from "../../../shared/assets/logo.png";
import farm from "../../../shared/assets/farm.png";
import wave from "../../../shared/assets/wave.png";
import { useSession } from "../../../app/session/sessionContext";
import { AccountMenu } from "../../account";
import { demoSessionUser } from "../../../demo/demoModules";

const ONBOARDING_STEPS = [
  { title: "Hồ sơ chủ trại", sub: "Thông tin người chịu trách nhiệm" },
  { title: "Thông tin trại", sub: "Địa chỉ và đặc điểm đàn" },
  { title: "Dịch vụ", sub: "Chọn kỳ và xem giá" },
];

/**
 * Khung thiết lập ngoài trại (chọn trại, đăng ký chủ trại và trại, chấp nhận lời mời): cột xanh 264px
 * giải thích bước hiện tại, thanh trên chỉ có người dùng, nội dung rộng hoặc cột 720px.
 */
export default function SetupLayout({
  eyebrow,
  heading,
  lines = [],
  badge,
  step,
  narrow = false,
  children,
}: {
  eyebrow: string;
  heading: string;
  lines?: string[];
  badge?: string;
  step?: 1 | 2 | 3;
  narrow?: boolean;
  children: ReactNode;
}) {
  const session = useSession();
  // Outside a session (single-page tests) the demo owner stands in; production always has a session.
  const user = session ??
    demoSessionUser("OWNER") ?? { fullName: "", email: "" };
  return (
    <div className="min-h-screen bg-page text-ink lg:pl-[264px]">
      <aside className="fixed inset-y-0 left-0 hidden w-[264px] overflow-hidden bg-side text-white lg:block">
        <Link
          to="/"
          className="absolute left-[22px] top-5 flex items-center gap-2.5 text-[19px] font-bold text-white no-underline"
        >
          <img
            src={logo}
            alt=""
            className="size-[38px] rounded-[10px] object-cover"
          />
          BeefCare
        </Link>
        <div className="absolute inset-x-[22px] top-[84px] flex flex-col gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-side-label">
            {eyebrow}
          </span>
          <h2 className="m-0 text-xl font-bold leading-[1.25]">{heading}</h2>
          {badge && (
            <p className="m-0 mt-3 rounded-xl bg-white/10 px-3 py-2.5 text-[11px] font-semibold">
              {badge}
            </p>
          )}
          {step && (
            <ol className="m-0 mt-6 flex list-none flex-col gap-2 p-0">
              {ONBOARDING_STEPS.map((item, index) => (
                <li
                  key={item.title}
                  aria-current={index + 1 === step ? "step" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 ${index + 1 === step ? "bg-white/10" : ""}`}
                >
                  <span
                    className={`grid size-[22px] shrink-0 place-items-center rounded-full text-[11px] font-semibold ${index + 1 === step ? "bg-white text-brand" : "bg-white/10 text-white"}`}
                  >
                    {index + 1}
                  </span>
                  <span>
                    <span className="block text-[13px] font-semibold">
                      {item.title}
                    </span>
                    <span className="block text-[10px] text-side-label">
                      {item.sub}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <img src={farm} alt="" className="absolute inset-x-0 bottom-0 w-full" />
      </aside>
      <div className="@container/setup relative min-h-screen overflow-x-clip">
        <img src={wave} alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full object-cover opacity-80" />
        <header className="relative z-10 flex h-[72px] items-center justify-between gap-4 border-b border-rule bg-white px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2 text-base font-bold text-brand-dark no-underline lg:invisible"><img src={logo} alt="" className="size-8 rounded-lg object-cover" />BeefCare</Link>
          <AccountMenu fallbackName={user.fullName} fallbackInitials={user.fullName.trim().charAt(0).toUpperCase()} fallbackRole={session?.role} />
        </header>
        <main className={`@container relative mx-auto flex w-full min-w-0 flex-col gap-4 px-4 py-8 @min-[640px]/setup:px-6 @min-[1024px]/setup:gap-6 @min-[1024px]/setup:px-8 ${narrow ? 'max-w-[784px]' : ''}`}>{children}</main>
      </div>
    </div>
  );
}
