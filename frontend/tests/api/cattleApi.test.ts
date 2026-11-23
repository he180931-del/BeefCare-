import test from 'node:test'
import assert from 'node:assert/strict'
import { mapBackendCattle } from '../../src/features/cattle/api/cattleMapper'
import { createCattleBackendApi } from '../../src/features/cattle/api/cattleBackendApi'

test('profile maps BCS without inventing a historical scale and preserves entry identity',()=>{
 for(const [value,label] of [[7,'7'],[3.5,'3,5'],[3,'3'],[null,'—']] as const) assert.equal(mapBackendCattle({latestBcs:value}).care.bcs,label)
 const cow=mapBackendCattle({entry:{id:91,voucherId:41,voucherCode:'PN-1'}})
 assert.equal(cow.entryId,91);assert.equal(cow.entryVoucherCode,'PN-1')
 assert.equal(mapBackendCattle({}).entryId,undefined);assert.equal(mapBackendCattle({}).entryVoucherCode,undefined)
})
test('cattle list preserves server group/sex/search/paging query and global counts',async()=>{
 const paths:string[]=[]
 const api=createCattleBackendApi({farmId:9,transport:{farmPath:(id,path='')=>`/api/farms/${id}${path}`,command:async()=>null,get:async path=>{paths.push(path);return {items:[],total:1,counts:{ACTIVE:130}}}}})
 await api.listPage({herdStatus:'ACTIVE',herdGroup:'FATTENING',q:' BC-120 ',page:4,size:25})
 const params=new URL(paths[0],'http://localhost').searchParams
 assert.deepEqual(Object.fromEntries(params),{page:'4',size:'25',q:'BC-120',herdStatus:'ACTIVE',herdGroup:'FATTENING'})
 const result=await api.listPage({herdStatus:'ACTIVE',sex:'FEMALE',page:0,size:25})
 assert.ok(paths[1].includes('sex=FEMALE'));assert.ok(!paths[1].includes('herdGroup='));assert.equal(result.counts.ACTIVE,130)
})
test('local cattle page emulates search and paging at the API boundary',async()=>{
 const {listCowsPage}=await import('../../src/features/cattle/api/cattleApi')
 const first=await listCowsPage({herdStatus:'ACTIVE',page:0,size:2}), next=await listCowsPage({herdStatus:'ACTIVE',page:1,size:2})
 assert.equal(first.items.length,2);assert.ok(first.total>2);assert.equal(first.counts.ACTIVE,first.total)
 assert.ok(next.items.every(row=>!first.items.some(old=>old.code===row.code)))
 const search=await listCowsPage({herdStatus:'ACTIVE',q:` ${first.items[0].code} `,page:0,size:25})
 assert.equal(search.total,1);assert.equal(search.items[0].code,first.items[0].code)
})
import { MemoryStorage } from '../support/memoryStorage'

const store = new MemoryStorage({ 'beefcare:latency': '0' })
global.localStorage = store

test('every sample cow shown by a pen resolves to a cattle profile in that pen', async () => {
  const { listBarns, listCows } = await import('../../src/features/cattle/api/cattleApi')
  const [barns, cows] = await Promise.all([listBarns(), listCows()])
  const cowsByCode = Object.fromEntries(cows.map((cow) => [cow.code, cow]))

  for (const barn of barns) {
    for (const [code] of barn.cows ?? []) {
      assert.ok(cowsByCode[code], `${code} must have a cattle profile`)
      assert.equal(cowsByCode[code].barn, barn.code, `${code} must belong to ${barn.code}`)
    }
  }
  assert.equal(store.getItem('beefcare:barns'), null)
})

test('profile mutations reject cattle that are no longer ACTIVE', async () => {
  const [{ updateIdentity }, { cattle }] = await Promise.all([import('../../src/features/cattle/api/cattleApi'), import('../../src/demo/api/herdDomainApi')])
  await cattle.update('BC-000125', { status: 'EXITED' })

  await assert.rejects(updateIdentity('BC-000125', { name: 'Không được sửa' }), /not active/i)
})
