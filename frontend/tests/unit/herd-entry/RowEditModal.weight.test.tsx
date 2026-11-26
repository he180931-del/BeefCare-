import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import RowEditModal from '../../../src/features/herd-entry/components/RowEditModal'
import type { EntryCow } from '../../../src/features/herd-entry/types'
import type { Pen } from '../../../src/features/pen-management/types'

const cow: EntryCow = {
  tag: 'TEST-ENTRY-002',
  name: '',
  breed: 'Lai Sind',
  sex: 'Cái',
  dob: '2025-04',
  dobAccuracy: 'Ước tính',
  stage: 'Bò tơ',
  purpose: 'Bò sinh sản · loại Sinh sản',
  weight: 236,
  estimated: false,
  barn: 'A1',
  unitPrice: 85_000,
  hist: { vaccine: 'Không rõ', disease: 'Không rõ', repro: 'Không rõ' },
}

const pens: Pen[] = [
  { code: 'A1', name: 'A1 – Bò cái', count: 10, capacity: 30, status: 'ACTIVE', cows: [] },
]

function renderModal(onSave = vi.fn(), patch: Partial<EntryCow> = {}, pricing: 'kg' | 'con' = 'kg') {
  render(
    <RowEditModal
      cow={{ ...cow, ...patch }}
      index={0}
      recordId="PN-2026-0014"
      dateIso="2026-10-29"
      pricing={pricing}
      others={[]}
      pens={pens}
      onSave={onSave}
      onRemove={vi.fn()}
      onClose={vi.fn()}
    />,
  )
  const label = [...document.querySelectorAll('label')].find((node) => node.textContent?.includes('Cân nhập (kg)'))
  if (!label) throw new Error('Không tìm thấy nhãn Cân nhập')
  const input = label.parentElement?.querySelector('input')
  if (!input) throw new Error('Không tìm thấy ô Cân nhập')
  return { input: input as HTMLInputElement, onSave }
}

it('clear then type a weight without a leading zero and infer MEASURED', async () => {
 const {input,onSave}=renderModal(); await userEvent.clear(input);expect(input).toHaveValue('');await userEvent.type(input,'060');expect(input).toHaveValue('60');
 await userEvent.click(screen.getByRole('button',{name:'Lưu con #1'}));expect(onSave).toHaveBeenCalledWith(expect.objectContaining({weight:60,weightBasis:'MEASURED'}))
})
it('leaves an empty weight empty on blur', async () => {
 const {input}=renderModal();await userEvent.clear(input);await userEvent.tab();expect(input).toHaveValue('')
})
it('price is enabled before weight or basis and calculates from the entered weight', async () => {
 const {input,onSave}=renderModal(vi.fn(),{weight:0,weightBasis:null});const price=document.querySelector('#entry-cow-unit-price') as HTMLInputElement;
 expect(price).toBeEnabled();expect(screen.queryByRole('radio',{name:'Cân thực tế'})).not.toBeInTheDocument();
 await userEvent.click(screen.getByRole('button',{name:'Lưu con #1'}));expect(onSave).not.toHaveBeenCalled();
 await userEvent.type(input,'236');expect(screen.getByText('20.060.000 đ')).toBeInTheDocument();
 await userEvent.click(screen.getByRole('button',{name:'Lưu con #1'}));expect(onSave).toHaveBeenCalledWith(expect.objectContaining({weight:236,weightBasis:'MEASURED',unitPrice:85000}))
})
it('per-head uses one editable price and keeps weight optional', async () => {
 const {input,onSave}=renderModal(vi.fn(),{unitPrice:8500000},'con');expect(screen.getByText('Số tiền mua con này')).toBeInTheDocument();
 expect(document.querySelector('#entry-cow-total-amount')).not.toBeInTheDocument();expect(document.querySelector('#entry-cow-unit-price')).toBeEnabled();
 await userEvent.clear(input);await userEvent.type(input,'250');await userEvent.click(screen.getByRole('button',{name:'Lưu con #1'}));
 expect(onSave).toHaveBeenCalledWith(expect.objectContaining({pricing:'con',weight:250,weightBasis:'MEASURED',unitPrice:8500000}))
})
it('kg pricing still requires a weight even when the old row was per-head', async () => {
 const {onSave}=renderModal(vi.fn(),{pricing:'con',weight:0,weightBasis:null},'kg');await userEvent.click(screen.getByRole('button',{name:'Lưu con #1'}));
 expect(screen.getByText('Cân nhập phải từ 1 đến 1.500 kg.')).toBeInTheDocument();expect(onSave).not.toHaveBeenCalled()
})
it('per-head without weight discards a redundant weight basis', async () => {
 const {onSave}=renderModal(vi.fn(),{weight:0,weightBasis:'ESTIMATED',unitPrice:8500000},'con');await userEvent.click(screen.getByRole('button',{name:'Lưu con #1'}));
 expect(onSave).toHaveBeenCalledWith(expect.objectContaining({weight:0,weightBasis:null,unitPrice:8500000}))
})
it.each(['kg','con'] as const)('%s rejects weight over 1500',async pricing=>{
 const {onSave}=renderModal(vi.fn(),{weight:1501},pricing);await userEvent.click(screen.getByRole('button',{name:'Lưu con #1'}));expect(onSave).not.toHaveBeenCalled();expect(screen.getByText('Cân nhập phải từ 1 đến 1.500 kg.')).toBeInTheDocument()
})
it('per-head infers MEASURED for an entered weight',async()=>{
 const {onSave}=renderModal(vi.fn(),{weight:300,weightBasis:null},'con');await userEvent.click(screen.getByRole('button',{name:'Lưu con #1'}));expect(onSave).toHaveBeenCalledWith(expect.objectContaining({weight:300,weightBasis:'MEASURED'}))
})
