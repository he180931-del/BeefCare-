import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { MoneyInput, NumberInput } from '../../../src/shared/ui'

it('decimal text removes leading zeros, accepts comma, retains 0.5 and clears to null without clamping', async () => {
 const change = vi.fn()
 function Form() { const [v,set]=useState<number|null>(0); return <NumberInput aria-label="Cân" value={v} min={1} max={1500} onChange={v=>{set(v);change(v)}}/> }
 render(<Form/>); const input=screen.getByRole('textbox',{name:'Cân'}); expect(input).toHaveValue('')
 await userEvent.type(input,'0450'); expect(input).toHaveValue('450'); expect(change).toHaveBeenLastCalledWith(450)
 fireEvent.change(input,{target:{value:'0,5'}}); expect(input).toHaveValue('0.5')
 fireEvent.change(input,{target:{value:'1600'}}); expect(input).toHaveValue('1600')
 fireEvent.change(input,{target:{value:''}}); expect(change).toHaveBeenLastCalledWith(null)
})
it('integer numbers reject decimal characters', () => {
 const change=vi.fn(); render(<NumberInput aria-label="Số lứa" value={null} decimals={0} onChange={change}/>);
 fireEvent.change(screen.getByRole('textbox'),{target:{value:'1.5'}}); expect(change).not.toHaveBeenCalled()
})
it('money starts empty, shows raw digits during editing and groups thousands on blur', async () => {
 function Form(){const [v,set]=useState(0);return <MoneyInput aria-label="Giá" value={v} onChange={set}/>}
 render(<Form/>);const input=screen.getByRole('textbox',{name:'Giá'});expect(input).toHaveValue('')
 await userEvent.type(input,'1500000');expect(input).toHaveValue('1500000');fireEvent.blur(input);expect(input).toHaveValue('1.500.000')
 fireEvent.focus(input);expect(input).toHaveValue('1500000')
 fireEvent.change(input,{target:{value:'1530000'}});expect(input).toHaveValue('1530000')
})
