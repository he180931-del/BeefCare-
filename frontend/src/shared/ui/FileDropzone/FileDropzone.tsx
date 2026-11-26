import { useRef, type ReactNode } from 'react'

export function FileDropzone({ label = '⇪ Kéo thả tệp hoặc Chọn tệp', hint, accept, multiple = true, onFiles }: { label?: string; hint?: ReactNode; accept?: string; multiple?: boolean; onFiles: (files: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const send = (files: FileList | null) => onFiles(files ? Array.from(files) : [])
  return <div className="cursor-pointer rounded-md border border-field bg-page p-4 text-center text-xs font-semibold text-brand" role="button" tabIndex={0} onClick={() => input.current?.click()} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') input.current?.click() }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); send(event.dataTransfer.files) }}><input ref={input} type="file" className="sr-only" aria-label={label} accept={accept} multiple={multiple} onChange={(event) => { send(event.target.files); event.target.value = '' }} />{label}<small className="mt-1 block text-[11px] font-normal text-muted">{hint}</small></div>
}
