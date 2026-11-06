import type { ReactNode } from 'react'
import { Icon } from '../../../components/Icon'
import { Button, Note } from '../../../components/ui'
import { HeaderActions } from './CatalogueShell'

export const SplitLayout = ({ children }: { children: ReactNode }) => (
  <div className="grid items-start gap-4 min-[1360px]:grid-cols-[minmax(675px,1fr)_minmax(340px,410px)]">{children}</div>
)

export const SavedNotice = ({ text }: { text: string | null }) =>
  text ? <Note tone="ok"><span role="status">{text}</span></Note> : null

export const AddButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <HeaderActions>
    <Button variant="primary" className="inline-flex items-center gap-1.5" onClick={onClick}>
      <Icon name="circle-plus" size={16} />
      {label}
    </Button>
  </HeaderActions>
)

/** Phần phụ chú nhỏ của dòng trong bảng (mô tả, tên khoa học…). */
export const SubLine = ({ children }: { children: ReactNode }) => <div className="line-clamp-1 text-[11px] font-normal text-muted">{children}</div>
