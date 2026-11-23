import { expect, it } from 'vitest'
import { createHerdEntryBackendApi } from '../../../src/features/herd-entry/api/herdEntryBackendApi'
import { mapVoucher } from '../../../src/features/herd-entry/api/herdEntryMapper'
import type { BackendTransport } from '../../../src/shared/api/backendTransport'

it.each([true,false])('round trips markings, quarantine and override reason from line/data (top-level=%s)',async top => {
 const fields={quarantineUntil:'2026-12-14',colourMarkings:'Vàng, chân trắng',warningReason:'Theo dõi riêng'}
 const voucher={id:41,code:'PN41',status:'DRAFT',entryType:'PURCHASE',entryDate:'2026-11-23',version:3,seller:{id:7,name:'Seller'},lines:[{
   penCode:'A1',entryWeightKg:450,weightBasis:'ESTIMATED',unitPrice:85000,...(top?fields:{}),
   ...(top ? { birthDate: '2025-04-17', birthDateAccuracy: 'EXACT' } : {}),
   data:{...fields,earTagNumber:'TAG1',sex:'FEMALE',breedId:2,...(!top ? { birthDate:'2025-04-17',birthDateAccuracy:'EXACT' } : {}),lifeStage:'YOUNG_STOCK',purposeId:99,purposeName:'Trùng tên'},
 }]}
 voucher.lines=Array.from({length:3},(_,i)=>({...voucher.lines[0],data:{...voucher.lines[0].data,earTagNumber:`TAG${i+1}`}}))
 const mapped=mapVoucher(voucher,[],[{id:2,name:'Sind'}]);expect(mapped.draft?.cows?.[0]).toMatchObject({...fields,breed:'Sind'})
 mapped.draft!.cows!.splice(1,1)
 let sent:Record<string,unknown>|undefined
 const transport={farmPath:(_:unknown,path:string)=>`/api/farms/9${path}`,get:async(path:string)=>{
   if(path.endsWith('/pens'))return[{id:11,code:'A1'}]
   if(path.endsWith('/catalogues/breeds'))return[{id:2,name:'Sind'}]
   if(path.endsWith('/catalogues/production-purposes'))return[{id:31,name:'Trùng tên',purposeType:'BREEDING'}]
   if(path.includes('/trading-partners'))return[{id:7,name:'Seller'}]
   if(path.endsWith('/attachments'))return[]
   return voucher
 },command:async(_:string,body:Record<string,unknown>)=>{sent=body;return voucher}} as unknown as BackendTransport
 const api=createHerdEntryBackendApi({transport,farmId:9})
 await api.save({id:'PN41',expectedVersion:3,record:mapped})
 expect((sent?.lines as unknown[])[0]).toMatchObject({...fields,purposeId:99,weightBasis:'ESTIMATED',birthDate:'2025-04-17',birthDateAccuracy:'EXACT',lifeStage:'YOUNG_STOCK'})
 expect((sent?.lines as Array<{earTagNumber:string}>).map(c=>c.earTagNumber)).toEqual(['TAG1','TAG3'])
})
