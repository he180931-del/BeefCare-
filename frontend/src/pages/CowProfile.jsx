import { useParams, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { Button } from '../components/ui'
import { useModalParam } from '../components/Modal'
import { getCow, useCowStore } from '../data/cowsData'
import CowHeader, { COW_TABS } from './cows/CowHeader'
import OverviewTab from './cows/OverviewTab'
import TimelineTab from './cows/TimelineTab'
import BarnsTab from './cows/BarnsTab'
import QrTab from './cows/QrTab'
import ComingSoon from './cows/ComingSoon'
import UpdateModal from './cows/UpdateModal'
import QrReissueModal from './cows/QrReissueModal'
import MoveModal from './cows/MoveModal'
import RecordEditModal from './cows/RecordEditModal'
import { Panel } from './cows/parts'

export default function CowProfile() {
  const { code } = useParams()
  const [params, setParams] = useSearchParams()
  const [modal, openModal, closeModal] = useModalParam()
  const { cows, barns } = useCowStore()
  const cow = getCow(cows, code)

  const rawTab = params.get('tab') || ''
  const tab = COW_TABS.some(([value]) => value === rawTab) ? rawTab : ''
  const tabLabel = COW_TABS.find(([value]) => value === tab)[1]
  const onTab = (value) => setParams(value ? { tab: value } : {})

  let content = null
  if (cow) {
    const tabViews = {
      '': <OverviewTab cow={cow} onOpenModal={openModal} />,
      timeline: <TimelineTab cow={cow} />,
      barns: <BarnsTab cow={cow} barns={barns} onOpenModal={openModal} />,
      qr: <QrTab cow={cow} onOpenModal={openModal} />,
    }
    content = (
      <>
        <CowHeader cow={cow} tab={tab} onTab={onTab} onOpenModal={openModal} />
        {tabViews[tab] ?? <ComingSoon label={tabLabel} />}
        {modal === 'update' && <UpdateModal key={cow.code} cow={cow} onClose={closeModal} />}
        {modal === 'qr-reissue' && <QrReissueModal cow={cow} onClose={closeModal} />}
        {modal === 'move' && <MoveModal cow={cow} onClose={closeModal} />}
        {modal === 'record-edit' && cow.importRecord && <RecordEditModal cow={cow} onClose={closeModal} />}
      </>
    )
  }

  return (
    <Layout title={`Hồ sơ bò › ${tabLabel}`} user="manager">
      <div className="flex flex-col gap-5 leading-[normal]">
        {cow ? (
          content
        ) : (
          <Panel gap="gap-3" className="items-start">
            <p className="m-0 text-sm text-[#212121]">Không tìm thấy hồ sơ bò {code}</p>
            <Button className="leading-[normal]" onClick={() => window.history.back()}>← Về danh sách</Button>
          </Panel>
        )}
      </div>
    </Layout>
  )
}
