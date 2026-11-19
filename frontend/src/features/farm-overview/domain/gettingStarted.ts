import type { GettingStarted, OnboardingState, ViewerRole } from '../types'

interface StepDef { step: string; label: string; screen: string; markable: boolean; ownerOnly?: boolean }

// D10: bước dữ liệu suy ra từ dữ liệu; ba bước xem lại xong khi người dùng đánh dấu.
export const STEP_DEFS: StepDef[] = [
  { step: 'PENS', label: 'Tạo chuồng nuôi (Chuồng trại)', screen: '/pens', markable: false },
  { step: 'BREEDS_PURPOSES', label: 'Xem lại giống và mục đích nuôi đã tạo sẵn', screen: '/danh-muc', markable: true },
  { step: 'VACCINE_DOSES', label: 'Bổ sung liều vắc-xin theo nhãn (3 vắc-xin)', screen: '/danh-muc', markable: true },
  { step: 'REFERENCE_MEDICINES', label: 'Thêm thuốc tham chiếu', screen: '/danh-muc', markable: false },
  { step: 'FARM_PARAMETERS', label: 'Kiểm tra tham số trại', screen: '/danh-muc', markable: true },
  { step: 'INVITE_MEMBERS', label: 'Mời Quản lý, Kỹ thuật viên', screen: '/thanh-vien', markable: false, ownerOnly: true },
  { step: 'FIRST_HERD_ENTRY', label: 'Nhập phiếu nhập đàn đầu tiên', screen: '/herd-entry/new', markable: false },
]

export const isMarkable = (step: string) => STEP_DEFS.some((d) => d.step === step && d.markable)

export function buildGettingStarted(onb: OnboardingState, role: ViewerRole): GettingStarted {
  const steps = STEP_DEFS.filter((d) => !d.ownerOnly || role === 'OWNER').map((d) => ({
    step: d.step,
    label: d.label,
    screen: d.screen,
    markable: d.markable,
    done: d.markable ? onb.marked.includes(d.step) : Boolean(onb.data[d.step]),
  }))
  const allDone = steps.every((s) => s.done)
  return { visible: !onb.dismissed && !allDone && role !== 'TECHNICIAN', dismissed: onb.dismissed, allDone, steps }
}
