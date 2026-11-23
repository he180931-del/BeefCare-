import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { mapBackendCattle } from '../../../src/features/cattle/api/cattleMapper'
const state = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('../../../src/app/layouts/TechnicianLayout', () => ({ default: ({ children, sub }: { children: ReactNode; sub?: string }) => <div><h1>{sub}</h1>{children}</div> }))
vi.mock('../../../src/features/cattle/api/cattleApi', async original => ({ ...(await original<typeof import('../../../src/features/cattle/api/cattleApi')>()), listCowsPage: state.list }))
import TechnicianHerd from '../../../src/features/cattle/components/TechnicianHerd'
const cows = Array.from({ length: 130 }, (_, i) => mapBackendCattle({ displayCode: `BC-${String(i + 1).padStart(3, '0')}`, herdStatus: 'ACTIVE', lifeStage: 'ADULT', sex: 'FEMALE' }))
const result = (items = cows.slice(0, 25), total = 130, page = 0) => ({ items, total, page, size: 25, counts: { ACTIVE: 130 } })
beforeEach(() => { state.list.mockReset().mockImplementation(async ({ page = 0 }) => result(cows.slice(page * 25, (page + 1) * 25), 130, page)) })
function page() { return render(<MemoryRouter><TechnicianHerd /></MemoryRouter>) }
it.each([['Vỗ béo', { herdGroup: 'FATTENING' }], ['Bê', { herdGroup: 'CALVES' }], ['Bò cái', { sex: 'FEMALE' }]])('requests %s from the server without filtering by display stage', async (label, filter) => {
 const user=userEvent.setup(); page(); await screen.findByText('BC-001'); await user.click(screen.getByRole('button',{name:label as string}))
 await waitFor(()=>expect(state.list).toHaveBeenLastCalledWith({herdStatus:'ACTIVE',size:25,page:0,...filter as object}))
 expect(await screen.findByText('BC-001')).toBeInTheDocument();expect(screen.getByText('Tìm thấy 130 con')).toBeInTheDocument()
})
it('loads all 130 cattle in server pages while keeping the global count', async()=>{
 const user=userEvent.setup();page();await screen.findByText('BC-001');expect(screen.getByText('130 con đang nuôi')).toBeInTheDocument()
 for(let p=1;p<6;p++){await user.click(screen.getByRole('button',{name:'Tải thêm'}));await screen.findByText(`BC-${String(Math.min((p+1)*25,130)).padStart(3,'0')}`)}
 expect(screen.getAllByRole('link')).toHaveLength(130);expect(screen.queryByRole('button',{name:'Tải thêm'})).not.toBeInTheDocument()
})
it('debounces and trims a search for cattle beyond the first 100, resets the page and ignores stale results', async()=>{
 const user=userEvent.setup();page();await screen.findByText('BC-001');await user.click(screen.getByRole('button',{name:'Tải thêm'}));await screen.findByText('BC-050')
 let finish!: (value: ReturnType<typeof result>)=>void
 state.list.mockImplementation(({q})=>q==='old'?new Promise(resolve=>{finish=resolve}):Promise.resolve(result([cows[119]],1)))
 fireEvent.change(screen.getByRole('searchbox',{name:'Tìm bò'}),{target:{value:'old'}})
 await waitFor(()=>expect(finish).toBeTypeOf('function'))
 const calls=state.list.mock.calls.length
 fireEvent.change(screen.getByRole('searchbox',{name:'Tìm bò'}),{target:{value:'  BC-120  '}})
 expect(state.list).toHaveBeenCalledTimes(calls)
 await screen.findByText('BC-120');expect(state.list).toHaveBeenLastCalledWith({herdStatus:'ACTIVE',size:25,page:0,q:'BC-120'})
 await act(async()=>finish(result([cows[0]],1)))
 expect(screen.queryByText('BC-001')).not.toBeInTheDocument();expect(screen.getByText('Tìm thấy 1 con')).toBeInTheDocument()
})
it('keeps loaded cattle after load-more failure, retries the same page and deduplicates overlapping codes',async()=>{
 const user=userEvent.setup();page();await screen.findByText('BC-001')
 state.list.mockRejectedValueOnce(new Error('Offline'))
 await user.click(screen.getByRole('button',{name:'Tải thêm'}));await screen.findByRole('button',{name:'Thử lại'})
 expect(screen.getAllByRole('link')).toHaveLength(25)
 state.list.mockResolvedValueOnce(result([cows[24],...cows.slice(25,49)],130,1))
 await user.click(screen.getByRole('button',{name:'Thử lại'}));await screen.findByText('BC-049')
 expect(state.list).toHaveBeenLastCalledWith({herdStatus:'ACTIVE',size:25,page:1});expect(screen.getAllByRole('link')).toHaveLength(49)
})
it('clears the old list when switching filters and restarts at page zero',async()=>{
 const user=userEvent.setup();page();await screen.findByText('BC-001');await user.click(screen.getByRole('button',{name:'Tải thêm'}));await screen.findByText('BC-050')
 state.list.mockResolvedValueOnce(result([cows[129]],1));await user.click(screen.getByRole('button',{name:'Bê'}))
 await screen.findByText('BC-130');expect(screen.queryByText('BC-001')).not.toBeInTheDocument();expect(state.list).toHaveBeenLastCalledWith({herdStatus:'ACTIVE',herdGroup:'CALVES',page:0,size:25})
})
it('distinguishes initial load errors, retry, and an empty result',async()=>{
 state.list.mockRejectedValueOnce(new Error('Offline'));page();await screen.findByRole('button',{name:'Thử lại'})
 state.list.mockResolvedValueOnce(result([],0));fireEvent.click(screen.getByRole('button',{name:'Thử lại'}));await screen.findByText('Không có bò nào khớp')
 expect(screen.queryByRole('button',{name:'Tải thêm'})).not.toBeInTheDocument()
})
