export default function FeedPrintFallback({ title, detail }: { title: string; detail?: string }) {
  return <div className="mx-auto max-w-[980px] px-4 pb-8 sm:px-6"><section className="rounded-2xl border border-field bg-white p-8"><h1 className="m-0 text-xl font-bold text-ink">{title}</h1>{detail && <p className="mt-2 text-sm text-muted">{detail}</p>}</section></div>
}
