import type { ReactNode } from 'react'

/** Lỗi theo trường hiện ngay dưới ô nhập. */
export const FieldError = ({ id, children }: { id?: string; children?: ReactNode }) =>
  children ? (
    <p id={id} role="alert" className="m-0 text-xs font-medium text-err-fg">
      {children}
    </p>
  ) : null
