import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { mapBackendCattle } from '../../../src/features/cattle/api/cattleMapper'
import { initialCows } from '../../../src/demo/data/cowsData'
const state=vi.hoisted(()=>({backend:true,check:vi.fn()}))
vi.mock('../../../src/app/layouts/FarmPlatformLayout',()=>({default:({children}:{children:ReactNode})=><div>{children}</div>}))
vi.mock('../../../src/app/session/sessionContext',async original=>({...await original<typeof import('../../../src/app/session/sessionContext')>(),useSession:()=>({role:'OWNER'})}))
vi.mock('../../../src/features/cattle/api/cattleApi',async original=>({...await original<typeof import('../../../src/features/cattle/api/cattleApi')>(),get localCattleList(){return state.backend?null:{}}}))
vi.mock('../../../src/features/herd-entry/api/index',async original=>({...await original<typeof import('../../../src/features/herd-entry/api/index')>(),entryLineCorrectionEnabled:true,
 herdEntryApi:{get:async()=>({id:'PN / 1',status:'Đã nhập',version:0,entryType:'PURCHASE',detail:{cows:[{entryId:91,lineVersion:0,lineStatus:'VALID',code:'BC-1',weight:250}],payments:[]}})},
 entryVoidCheck:state.check,listEntryBreeds:async()=>[],listEntrySellers:async()=>[]}))
import OverviewTab from '../../../src/features/cattle/components/OverviewTab'
import { businessDate } from '../../../src/shared/lib/date/farmTime'
import ImportDetail from '../../../src/features/herd-entry/pages/ImportDetail'
const cow=()=>mapBackendCattle({displayCode:'BC-1',herdStatus:'ACTIVE',canUpdate:true,entry:{id:91,voucherId:41,voucherCode:'PN / 1'}})
it.each(['EXTERNAL','FARM_BORN'])('quarantine today is shown only for a purchase (%s)',source=>{
 const value=mapBackendCattle({displayCode:'BC-1',herdStatus:'ACTIVE',entry:{source},quarantineUntil:businessDate()});
 render(<MemoryRouter><OverviewTab cow={value} canWrite={false} onOpenModal={vi.fn()}/></MemoryRouter>);
 expect(Boolean(screen.queryByText('Cách ly nhập đàn đến'))).toBe(source==='EXTERNAL')
})
it('expired purchase quarantine is hidden',()=>{
 const value=mapBackendCattle({displayCode:'BC-1',herdStatus:'ACTIVE',entry:{source:'EXTERNAL'},quarantineUntil:'2000-01-01'});
 render(<MemoryRouter><OverviewTab cow={value} canWrite={false} onOpenModal={vi.fn()}/></MemoryRouter>);
 expect(screen.queryByText('Cách ly nhập đàn đến')).not.toBeInTheDocument()
})
beforeEach(()=>{state.backend=true;state.check.mockReset().mockResolvedValue({canVoid:true,eventsAfterEntry:[]})})
function Address(){const l=useLocation();return <output>{l.pathname+l.search}</output>}
it('opens the actual entry popup for the mapped source entry, encoding the voucher code',async()=>{
 const user=userEvent.setup();render(<MemoryRouter initialEntries={['/cattle/BC-1']}><Address/><Routes><Route path="/cattle/:code" element={<OverviewTab cow={cow()} canWrite onOpenModal={vi.fn()}/>}/><Route path="/herd-entry/:id" element={<ImportDetail/>}/></Routes></MemoryRouter>)
 await user.click(screen.getByRole('button',{name:'Sửa / hủy bản ghi nhập đàn'}))
 await waitFor(()=>expect(state.check).toHaveBeenCalledWith(91));expect(screen.getByRole('dialog')).toBeInTheDocument()
 expect(screen.getByText('/herd-entry/PN%20%2F%201?m=line&entry=91')).toBeInTheDocument()
})
it.each([{canWrite:false},{status:'EXITED'},{exitPending:true},{entryId:undefined},{entryVoucherCode:undefined}])('hides source editing when it is unavailable: %j',patch=>{
 const {canWrite=true,...fields}=patch
 render(<MemoryRouter><OverviewTab cow={{...cow(),...fields} as ReturnType<typeof cow>} canWrite={canWrite} onOpenModal={vi.fn()}/></MemoryRouter>)
 expect(screen.queryByRole('button',{name:'Sửa / hủy bản ghi nhập đàn'})).not.toBeInTheDocument()
})
it('retains the demo record editor callback in local mode',async()=>{
 state.backend=false;const open=vi.fn();const user=userEvent.setup()
 render(<MemoryRouter><OverviewTab cow={initialCows.find(cow=>cow.importRecord)!} canWrite onOpenModal={open}/></MemoryRouter>)
 await user.click(screen.getByRole('button',{name:'Sửa / hủy bản ghi nhập đàn'}));expect(open).toHaveBeenCalledWith('record-edit')
})
