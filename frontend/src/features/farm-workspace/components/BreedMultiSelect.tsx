import { useState } from 'react'
import { Icon } from '../../../components/Icon'
import { inputCls } from '../../../components/ui'
import { STARTER_BREEDS } from '../data/starterBreeds'

/** Chọn nhiều giống chủ lực từ danh mục giống có sẵn (SCR-10); giống được chọn bật sẵn cho trại. */
export function BreedMultiSelect({ id, value, onChange }: { id: string; value: string[]; onChange: (codes: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const label = STARTER_BREEDS.filter((breed) => value.includes(breed.code)).map((breed) => breed.name).join(', ') || 'Chọn giống'
  return (
    <div className="relative">
      <button type="button" id={id} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`${inputCls} flex cursor-pointer items-center justify-between gap-2 text-left`}>
        <span className="truncate">{label}</span><Icon name="chevron-down" className="shrink-0 text-muted" />
      </button>
      {open && (
        <div role="group" aria-label="Giống chủ lực" className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-field bg-white p-2 shadow-lg">
          {STARTER_BREEDS.map((breed) => (
            <label key={breed.code} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-page">
              <input type="checkbox" className="accent-brand" checked={value.includes(breed.code)} onChange={(event) => onChange(event.target.checked ? [...value, breed.code] : value.filter((code) => code !== breed.code))} />{breed.name}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
