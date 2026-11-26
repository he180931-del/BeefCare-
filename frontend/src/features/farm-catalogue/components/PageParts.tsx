import type { ReactNode } from 'react'
import { Button, Icon, Note } from '../../../shared/ui'
import { HeaderActions } from './CatalogueShell'

/**
 * Danh sách + vùng biên tập (docs/BeefCare-Bento-Grid.md §1, Figma Tab 19 ①b): chia 7+5 khi vùng nội dung từ 1.024 px,
 * hẹp hơn thì xếp dọc (bảng vắc-xin 7 cột cần ~600 px). Đo theo vùng nội dung sau sidebar, không theo màn hình.
 */
export const SplitLayout = ({ children }: { children: ReactNode }) => (
  <div className="@container">
    <div className="grid items-start gap-4 @min-[1024px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] @min-[1024px]:gap-6">{children}</div>
  </div>
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
