export default function ComingSoon({ label }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-edge bg-white p-10 text-center">
      <p className="m-0 text-sm font-semibold text-[#212121]">Đang được phát triển</p>
      <p className="m-0 text-xs text-muted">Tab {label} sẽ có trong phiên bản sau.</p>
    </div>
  )
}
