import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import RowEditModal from '../../../src/features/herd-entry/components/RowEditModal'
import type { EntryCow } from '../../../src/features/herd-entry/types'

const base: EntryCow = { tag: '', name: '', breed: 'Sind', sex: 'Cái', dob: '2025-04-17', dobAccuracy: 'EXACT', stage: 'Bò tơ', purpose: 'Sinh sản', weight: 450, weightBasis: 'ESTIMATED', estimated: true, barn: 'A1', unitPrice: 85000, hist: { vaccine: 'Không rõ', disease: 'Không rõ', repro: 'Không rõ' } }
const pickMonth = (value: string) => { fireEvent.change(screen.getByLabelText('Năm sinh'), { target: { value: value.slice(0, 4) } }); fireEvent.change(screen.getByLabelText('Tháng sinh'), { target: { value: value.slice(5, 7) } }) }
function setup(patch: Partial<EntryCow> = {}, pricing: 'kg' | 'con' = 'kg') {
 const save = vi.fn()
 render(<RowEditModal cow={{...base,...patch}} index={0} recordId="PN1" dateIso="2026-11-23" pricing={pricing} others={[]} pens={[{code:'A1',name:'A1',count:0,capacity:20,status:'ACTIVE',cows:[]}]} onSave={save} onRemove={vi.fn()} onClose={vi.fn()}/>);
 return save
}
it('optional tag saves and untouched EXACT day / ESTIMATED weight survive', () => {
 const save=setup(); fireEvent.click(screen.getByRole('button',{name:'Lưu con #1'}));
 expect(save).toHaveBeenCalledWith(expect.objectContaining({tag:'',dob:'2025-04-17',dobAccuracy:'EXACT',weightBasis:'ESTIMATED'}))
})
it('edited month and weight infer backend precision', () => {
 const save=setup(); pickMonth('2025-05');
 fireEvent.change(document.querySelector('#entry-cow-weight')!,{target:{value:'451'}});
 fireEvent.click(screen.getByRole('button',{name:'Lưu con #1'}));
 expect(save).toHaveBeenCalledWith(expect.objectContaining({dob:'2025-05-01',dobAccuracy:'ESTIMATED',weight:451,weightBasis:'MEASURED'}))
})
it('per-head has one price and allows empty weight / birth month', () => {
 const save=setup({dob:'',dobAccuracy:'UNKNOWN',weight:0,weightBasis:null},'con');
 expect(screen.getByLabelText('Thành tiền')).toBeEnabled();
 expect(screen.queryByText('Cơ sở cân')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Lưu con #1'}));
 expect(save).toHaveBeenCalledWith(expect.objectContaining({dob:'',dobAccuracy:'UNKNOWN',weightBasis:null}))
})
it('quarantine validates the entry date and shortcuts use that date',()=>{
 const save=setup({quarantineUntil:'2026-11-22'});fireEvent.click(screen.getByRole('button',{name:'Lưu con #1'}));expect(save).not.toHaveBeenCalled();
 expect(screen.getByLabelText('Cách ly nhập đàn đến')).toHaveFocus();
 fireEvent.click(screen.getByRole('button',{name:'+14 ngày'}));expect(screen.getByLabelText('Cách ly nhập đàn đến')).toHaveValue('2026-12-07');
 fireEvent.click(screen.getByRole('button',{name:'+21 ngày'}));fireEvent.click(screen.getByRole('button',{name:'Lưu con #1'}));expect(save).toHaveBeenCalledWith(expect.objectContaining({quarantineUntil:'2026-12-14'}))
})
it('stage proposal follows month edits until the user overrides it',()=>{
 setup({stage:'Bò cái',dob:'2023-03-17'});
 pickMonth('2026-09');expect(document.querySelector('#entry-cow-stage')).toHaveValue('Bê theo mẹ');
 pickMonth('2025-05');expect(document.querySelector('#entry-cow-stage')).toHaveValue('Bò tơ');
 fireEvent.change(document.querySelector('#entry-cow-stage')!,{target:{value:'Bò cái'}});
 pickMonth('2026-09');expect(document.querySelector('#entry-cow-stage')).toHaveValue('Bò cái')
})
it('catalogue purpose uses its ID and biological type rather than guessing its name',()=>{
 const save=vi.fn();render(<RowEditModal cow={{...base,purpose:'Cũ',purposeId:11}} index={0} recordId="PN1" dateIso="2026-11-23" others={[]} pens={[{code:'A1',name:'A1',count:0,capacity:20,status:'ACTIVE',cows:[]}]} purposes={[
  {id:11,name:'Mục đích tùy chỉnh',purposeType:'BREEDING',available:true},
  {id:12,name:'Tên không thể đoán',purposeType:'SIRE',available:true},
  {id:13,name:'Đã ngừng',purposeType:'FATTENING',available:false},
 ]} onSave={save} onRemove={vi.fn()} onClose={vi.fn()}/>);
 expect(document.querySelector('#entry-cow-purpose')).toHaveValue('11');expect(screen.queryByRole('option',{name:/Tên không thể đoán/})).not.toBeInTheDocument();expect(screen.queryByRole('option',{name:/Đã ngừng/})).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Lưu con #1'}));expect(save).toHaveBeenCalledWith(expect.objectContaining({purposeId:11}));
 fireEvent.click(screen.getByRole('radio',{name:'Đực'}));expect(document.querySelector('#entry-cow-purpose')).toHaveValue('');expect(screen.getByRole('option',{name:/Tên không thể đoán/})).toBeInTheDocument()
})
