"""Refresh the embedded, offline API reference; review state lives separately in the HTML.
Run from any directory: python docs/tools/generate_api_catalog.py
Mappings are candidates, never acceptance evidence. No network or backend execution.
"""
from pathlib import Path
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]
SPEC = json.loads((ROOT / 'docs/api/openapi.json').read_text(encoding='utf-8'))
LINES = (ROOT / 'docs/requirements/SRS_2026-10-28.txt').read_text(encoding='utf-8').splitlines()
JAVA = ROOT / 'backend/src/main/java/vn/edu/fpt/beefcare'
METHODS = {'get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'}

NAMES = ['','Tài khoản & đăng nhập','Trại & dịch vụ','Thành viên & phân quyền','Chuồng & chuyển chuồng','Hồ sơ bò & QR','Nhập đàn','Thông báo trại','Tăng trưởng & BCS','Tiêm phòng','Sức khỏe & điều trị','Động dục & phối','Thai kỳ, đẻ & bê','Xuất đàn','Nhắc việc & inbox','Dashboard & báo cáo trại','Timeline bò','Audit nền tảng','Danh mục & tham số','Gói dịch vụ & thanh toán','Hỗ trợ khách hàng','Thu chi nền tảng','Trang công khai','Thức ăn & kho']
TAG_FEATURE = {
 'platform-finance-resource':21,'notification-resource':14,'farm-workspace-resource':2,
 'care-catalogue-command-resource':18,'vaccination-command-resource':9,'trading-partner-resource':6,
 'pen-resource':4,'farm-membership-resource':3,'feed-management-resource':23,'herd-exit-voucher-resource':13,
 'herd-entry-voucher-resource':6,'cattle-profile-resource':5,'herd-catalogue-resource':18,
 'farm-announcements-resource':7,'se-pay-webhook-resource':19,'owner-support-resource':20,
 'account-resource':1,'cs-support-resource':20,'platform-plan-price-resource':19,'platform-payment-resource':19,
 'assigned-internal-support-resource':20,'platform-farm-resource':2,'platform-account-administration-resource':3,
 'voucher-payment-resource':6,'vaccination-record-command-resource':9,'health-record-command-resource':10,
 'subscription-payment-resource':19,'reproduction-command-resource':11,'herd-entry-resource':6,'pen-move-resource':4,
 'farm-parameter-command-resource':18,'health-care-command-resource':10,'feed-attachment-resource':23,
 'attachment-resource':5,'farm-dashboard-resource':15,'growth-assessment-resource':8,
 'authenticate-controller':1,'public-landing-resource':22,'platform-subscription-resource':19,
 'platform-audit-resource':17,'farm-reminder-resource':14,'growth-overview-resource':8,
}

ucs = {}
rules = {}
screens = {}
for i, line in enumerate(LINES):
    cells = [c.strip() for c in line.split(' | ')]
    if re.fullmatch(r'UC-FE\d{2}-\d{2}', cells[0]) and len(cells) >= 4:
        ucs.setdefault(cells[0], {'id':cells[0], 'name':cells[1], 'description':cells[3], 'line':i+1, 'fields':{}})
    if re.fullmatch(r'(?:GBR-\d+|BR-D\d+)', cells[0]) and len(cells)>2:
        rules[cells[0]] = {'id':cells[0],'text':cells[1] if cells[0].startswith('GBR') else cells[1]+': '+cells[2], 'applies':cells[2] if cells[0].startswith('GBR') else cells[-1], 'line':i+1}
    if line.startswith('UC ID and Name | '):
        match = re.search(r'UC-FE\d{2}-\d{2}', line)
        if match:
            u = ucs.setdefault(match[0], {'id':match[0], 'name':line.split('—')[-1].strip(),'description':'','line':i+1,'fields':{}})
            for row in LINES[i+1:]:
                if row == '[/TABLE]': break
                key, sep, value = row.partition(' | ')
                if sep: u['fields'][key] = value
    if re.match(r'^\[P\d+ [345]\].*SCR-\d+', line):
        sid = re.search(r'SCR-\d+', line)[0]
        block=[]
        for row in LINES[i+1:]:
            if re.match(r'^\[P\d+ [345]\]', row): break
            if not re.match(r'^\[', row): block.append(row)
            elif row.startswith('[P'):
                block.append(re.sub(r'^\[P\d+[^]]*\]\s*','',row))
        text='\n'.join(block).strip()
        if len(text) > len(screens.get(sid,{}).get('text','')):
            screens[sid]={'id':sid,'title':re.sub(r'^\[P\d+ [345]\]\s*','',line),'text':text,'line':i+1}

def candidates(tag, path, method, op):
    f=TAG_FEATURE[tag]
    nums=[]
    name=re.sub(r'_\d+$','',op)
    by_tag={
      'account-resource':{'registerAccount':[1],'activateAccount':[1],'resendEmailVerification':[1],'completeOwnerRegistration':[1],'saveAccount':[4],'getAccount':[4],'getProfile':[4],'updateProfile':[4],'requestPasswordReset':[5],'finishPasswordReset':[5],'validateResetLink':[5],'changePassword':[6],'startGoogleReauthentication':[6]},
      'authenticate-controller':{'isAuthenticated':[2],'authorize':[2],'csrf':[2]},
      'farm-workspace-resource':{'register':[1],'list':[2],'get':[2],'context':[2],'catalogues':[1],'update':[3]},
      'farm-membership-resource':{'invite':[1],'invitations':[2],'resend':[3],'cancel':[3],'accept':[4],'preview':[4],'members':[5],'changeMember':[6]},
      'platform-account-administration-resource':{'search':[7],'get':[7],'history':[7],'suspend':[8],'restore':[8],'changeAccess':[9]},
      'platform-farm-resource':{'overview':[4],'suspend':[5],'restore':[5]},
      'pen-resource':{'list':[1],'get':[1],'create':[2],'update':[3],'changeAvailability':[4]},
      'pen-move-resource':{'move':[5],'check':[5]},
      'cattle-profile-resource':{'list':[1],'get':[2],'update':[3],'issue':[4],'tags':[4],'resolve':[5]},
      'herd-entry-voucher-resource':{'create':[1],'update':[1],'discard':[1],'post':[1],'importLines':[1],'checks':[1],'lifeStageProposal':[1],'importTemplate':[1],'list':[2],'get':[2],'voidVoucher':[5],'voidCheck':[5]},
      'herd-entry-resource':{'correct':[3],'voidEntry':[3],'voidCheck':[3],'pendingCalves':[2]},
      'herd-exit-voucher-resource':{'create':[1],'update':[1],'delete':[1],'addCattle':[1],'confirm':[1],'checks':[1],'selectableCattle':[1],'list':[2],'get':[2],'dismiss':[1],'voidVoucher':[3],'voidCheck':[3]},
      'farm-announcements-resource':{'createDraft':[1],'updateDraft':[1],'publish':[2],'correct':[3],'list':[4],'markRead':[4]},
      'growth-assessment-resource':{'record':[1],'history':[2],'correct':[3]},
      'growth-overview-resource':{'list':[2]},
      'vaccination-command-resource':{'schedules':[1],'createSchedule':[2],'editSchedule':[3],'stopSchedule':[4],'record':[5],'deferDose':[6],'history':[7]},
      'vaccination-record-command-resource':{'correct':[8],'voidRecord':[8]},
      'health-care-command-resource':{'open':[1],'followUp':[2],'status':[3],'treatment':[4],'correctClosure':[5]},
      'health-record-command-resource':{'voidTreatment':[5],'correctTreatment':[5],'voidObservation':[5],'correctObservation':[5]},
      'owner-support-resource':{'create':[1],'mine':[2],'get':[2],'reply':[3],'acknowledge':[4],'reopen':[5]},
      'cs-support-resource':{'queue':[6],'get':[6],'process':[7],'reply':[8],'note':[9],'resolve':[10],'close':[11],'createInternal':[12],'manageInternal':[12],'recipients':[12]},
      'assigned-internal-support-resource':{'complete':[13],'mine':[13],'get':[13],'results':[13]},
      'farm-dashboard-resource':{'getDashboard':[1],'gettingStarted':[1],'markStepDone':[1],'dismissGettingStarted':[1],'report':[2]},
      'platform-finance-resource':{'records':[3],'detail':[3],'create':[2],'update':[4],'discard':[5],'post':[6],'voidPosted':[7],'replacement':[2,7],'runReport':[8],'report':[8],'export':[9],'categories':[2],'bankTransactions':[2]},
      'subscription-payment-resource':{'overview':[1],'request':[2],'history':[3],'detail':[3]},
      'platform-plan-price-resource':{'history':[7],'publish':[7]},
      'platform-subscription-resource':{'subscriptions':[4],'subscription':[4]},
      'platform-payment-resource':{'list':[5],'get':[5],'summary':[5],'evidence':[5],'candidates':[6],'lookup':[6],'review':[6],'recordReturn':[6],'lockForReturn':[6],'unlockReturn':[6]},
      'se-pay-webhook-resource':{'receive':[8]},
      'public-landing-resource':{'landing':[1],'prices':[1]},
      'platform-audit-resource':{'search':[1],'get':[1]},
    }
    nums=by_tag.get(tag,{}).get(name,[])
    if tag=='cattle-profile-resource' and name=='timeline': f=16;nums=[1]
    if tag=='pen-move-resource' and name=='history': f=5;nums=[2]
    if tag=='herd-entry-resource' and name=='diedBeforeRegistration':f=12;nums=[4]
    if tag=='platform-subscription-resource' and name in ('receipt','receipts'): f=21;nums=[1]
    if tag=='voucher-payment-resource':
        if '/feed/' in path:f=23;nums=[2]
        else: return [f'UC-FE06-04',f'UC-FE13-04',f'UC-FE23-02'],6
    if tag=='reproduction-command-resource':
        if any(x in path for x in ('pregnancy-updates','pregnancy-episodes','calving','calf-outcomes')):f=12
    if tag=='care-catalogue-command-resource':nums=([5] if method=='get' else [6] if method=='post' else [8] if method=='delete' else [7,8]) if 'vaccine' in path else ([9] if method=='get' else [10] if method=='post' else [11,12])
    if tag=='herd-catalogue-resource':nums=([1] if method=='get' else [2] if method=='post' else [3,4]) if 'breed' in path else ([13] if method=='get' else [14] if method=='post' else [15,16])
    if tag=='farm-parameter-command-resource':nums=[17]
    if not nums:return [k for k in ucs if k.startswith(f'UC-FE{f:02}-')],f
    return [f'UC-FE{f:02}-{n:02}' for n in nums if f'UC-FE{f:02}-{n:02}' in ucs],f

def clean_balance(text):
    return re.sub(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|//[^\n]*|/\*[\s\S]*?\*/',lambda m:' '*len(m[0]),text)

def method_source(text,name):
    pat=r'\b(?:public|private|protected)\s+(?:static\s+)?[\w<>\[\], ?.]+\b'+re.escape(name)+r'\s*\('
    match=re.search(pat,text)
    if not match:return None
    clean=clean_balance(text)
    start=clean.find('{',match.end())
    if start<0:return None
    depth=1;i=start+1
    while i<len(text) and depth:
        depth+=(clean[i]=='{')-(clean[i]=='}');i+=1
    return {'line':text[:match.start()].count('\n')+1,'text':text[match.start():i]}

alljava={p.stem:(p,p.read_text(encoding='utf-8-sig')) for p in JAVA.rglob('*.java')}
def source_for(tag,op):
    classname=''.join(x.capitalize() for x in tag.split('-'))
    found=next(((k,v) for k,v in alljava.items() if re.sub(r'[^a-z]','',k.lower())==re.sub(r'[^a-z]','',classname.lower())),None)
    if not found:return [],[]
    _,(p,t)=found
    name=re.sub(r'_\d+$','',op)
    body=method_source(t,name)
    if not body:return [{'path':p.relative_to(ROOT).as_posix(),'line':1,'text':'Không trích được method; mở resource để kiểm.'}],[]
    result=[{'path':p.relative_to(ROOT).as_posix(),**body}]
    variables=dict((b,a) for a,b in re.findall(r'private\s+(?:final\s+)?(\w+)\s+(\w+)\s*;',t))
    for obj,call in dict.fromkeys(re.findall(r'\b(\w+)\.(\w+)\(',body['text'])):
        kind=variables.get(obj)
        if not kind or kind not in alljava or not kind.endswith('Service'):continue
        sp,st=alljava[kind];sb=method_source(st,call)
        if sb:result.append({'path':sp.relative_to(ROOT).as_posix(),**sb})
    guards=sorted(set(re.findall(r'FarmAction\.(\w+)', '\n'.join(x['text'] for x in result))))
    return result,guards

def resolve_refs(obj,seen=None):
    seen=seen or set()
    if isinstance(obj,list):return [resolve_refs(x,seen) for x in obj]
    if not isinstance(obj,dict):return obj
    if '$ref' in obj:
        ref=obj['$ref'];key=ref.rsplit('/',1)[-1]
        if ref in seen:return {'$recursive':key}
        return resolve_refs(SPEC.get('components',{}).get('schemas',{}).get(key,{}),seen|{ref})
    return {k:resolve_refs(v,seen) for k,v in obj.items()}

apis=[]
VERBS={'get':'Xem chi tiết','list':'Liệt kê','create':'Tạo mới','update':'Cập nhật','delete':'Xóa','discard':'Bỏ nháp','detail':'Xem chi tiết','overview':'Xem tổng quan','history':'Xem lịch sử','search':'Tìm kiếm','mine':'Xem danh sách trong phạm vi người dùng','register':'Đăng ký trại','context':'Lấy ngữ cảnh trại và quyền','catalogues':'Lấy danh mục khởi tạo','csrf':'Lấy CSRF token','authorize':'Đăng nhập bằng mật khẩu','isAuthenticated':'Kiểm tra phiên đăng nhập','registerAccount':'Đăng ký tài khoản Owner','activateAccount':'Xác minh email tài khoản','resendEmailVerification':'Gửi lại email xác minh','completeOwnerRegistration':'Hoàn tất hồ sơ Owner','getProfile':'Xem hồ sơ và quyền','updateProfile':'Cập nhật hồ sơ','getAccount':'Xem tài khoản đang đăng nhập','saveAccount':'Cập nhật tài khoản','requestPasswordReset':'Yêu cầu email đặt lại mật khẩu','finishPasswordReset':'Hoàn tất đặt lại mật khẩu','validateResetLink':'Kiểm tra link đặt lại mật khẩu','changePassword':'Đổi hoặc thêm mật khẩu','startGoogleReauthentication':'Bắt đầu xác thực lại Google','post':'Ghi sổ','postReceipt':'Ghi sổ phiếu nhập kho','postAdjustment':'Ghi sổ điều chỉnh kho','confirm':'Xác nhận xuất đàn','voidVoucher':'Hủy phiếu','voidPosted':'Hủy bản ghi đã ghi sổ','voidEntry':'Hủy lần nhập của bò','correct':'Sửa bản ghi có lưu lịch sử','voidCheck':'Kiểm tra điều kiện hủy','checks':'Kiểm tra điều kiện trước khi thực hiện','check':'Kiểm tra chuyển chuồng','importLines':'Nhập dòng phiếu từ Excel','importTemplate':'Tải mẫu Excel','selectableCattle':'Lấy bò đủ điều kiện chọn xuất','lifeStageProposal':'Gợi ý giai đoạn bò','move':'Chuyển chuồng','changeAvailability':'Đổi trạng thái sử dụng chuồng','resolve':'Giải quyết / tra cứu theo nguồn','timeline':'Xem dòng thời gian bò','issue':'Cấp hoặc thay thẻ QR','tags':'Xem lịch sử thẻ QR','publish':'Công bố phiên bản','publishVersion':'Công bố phiên bản','markRead':'Đánh dấu đã đọc','markAllAsRead':'Đánh dấu tất cả đã đọc','record':'Ghi nhận','request':'Tạo yêu cầu thanh toán gói','receive':'Nhận webhook SePay','suspend':'Đình chỉ','restore':'Khôi phục','changeAccess':'Thay đổi quyền nhân viên platform','changeMember':'Thay đổi vai trò/quyền thành viên','invite':'Gửi lời mời','resend':'Gửi lại lời mời','cancel':'Hủy lời mời','accept':'Chấp nhận lời mời','preview':'Xem lời mời trước khi nhận','invitations':'Xem lời mời','members':'Xem thành viên','reply':'Trả lời công khai','acknowledge':'Xác nhận phiên bản giải quyết','reopen':'Mở lại ticket','queue':'Xem hàng đợi hỗ trợ','process':'Xử lý và phân công ticket','note':'Thêm ghi chú nội bộ CS','close':'Đóng ticket','createInternal':'Tạo yêu cầu nội bộ','manageInternal':'Quản lý yêu cầu nội bộ','recipients':'Lấy người có thể nhận yêu cầu','complete':'Hoàn tất yêu cầu nội bộ','results':'Lấy kết quả nghiệp vụ liên quan','replacement':'Tạo bản ghi thay thế','runReport':'Tạo snapshot báo cáo','report':'Xem / chạy báo cáo','export':'Xuất snapshot XLSX','records':'Xem bản ghi thu chi','categories':'Lấy nhóm thu chi','bankTransactions':'Lấy nguồn giao dịch ngân hàng','subscription':'Xem gói dịch vụ một trại','subscriptions':'Xem gói dịch vụ các trại','receipt':'Xem biên nhận thanh toán','receipts':'Xem phiếu / biên nhận','lookup':'Tra giao dịch SePay','review':'Đối soát evidence','recordReturn':'Ghi nhận hoàn trả','lockForReturn':'Khóa để xử lý hoàn trả','unlockReturn':'Mở khóa hoàn trả','summary':'Xem chỉ số tổng hợp','evidence':'Xem bằng chứng chuyển khoản','candidates':'Lấy yêu cầu thanh toán có thể ghép','prices':'Xem giá gói đang hiệu lực','landing':'Xem nội dung trang công khai','gettingStarted':'Xem bước khởi tạo trại','markStepDone':'Đánh dấu bước khởi tạo xong','dismissGettingStarted':'Ẩn hướng dẫn khởi tạo','getDashboard':'Xem dashboard trại','consumptionReport':'Báo cáo tiêu thụ và chi phí thức ăn','stock':'Xem tồn và giá bình quân','movements':'Xem lịch sử biến động kho','feedReminders':'Xem nhắc việc thức ăn','catalogue':'Xem danh mục thức ăn','createReceipt':'Tạo phiếu nhập kho','updateDraftReceipt':'Sửa nháp nhập kho','voidReceipt':'Hủy phiếu nhập kho','createAdjustment':'Tạo phiếu điều chỉnh kho','adjustment':'Xem phiếu điều chỉnh kho','adjustments':'Xem danh sách điều chỉnh kho','updateAdjustmentDraft':'Sửa nháp điều chỉnh kho','saveRation':'Lưu phiên bản khẩu phần','rations':'Xem khẩu phần','feedingLog':'Xem nhật ký cho ăn','recordFeeding':'Ghi cho ăn và xuất kho','correctFeeding':'Sửa bản ghi cho ăn','voidFeeding':'Hủy bản ghi cho ăn','createFeedItem':'Tạo thức ăn','updateFeedItem':'Sửa thức ăn','createDraft':'Tạo nháp thông báo','updateDraft':'Sửa nháp thông báo','recordPayment':'Ghi thanh toán','voidPayment':'Hủy thanh toán','payFeedReceipt':'Ghi thanh toán phiếu thức ăn','listFeedReceiptPayments':'Xem thanh toán phiếu thức ăn','pendingCalves':'Lấy bê chờ nhập đàn','diedBeforeRegistration':'Ghi bê chết trước nhập đàn','open':'Mở ca bệnh','cases':'Liệt kê ca bệnh','cattleHealth':'Xem sức khỏe bò','followUp':'Ghi theo dõi ca bệnh','treatment':'Ghi điều trị','status':'Đổi trạng thái/đóng ca bệnh','correctClosure':'Sửa thông tin đóng ca','correctTreatment':'Sửa điều trị','voidTreatment':'Hủy điều trị','correctObservation':'Sửa theo dõi','voidObservation':'Hủy theo dõi','createSchedule':'Lập lịch tiêm','editSchedule':'Sửa lịch tiêm','stopSchedule':'Dừng lịch tiêm','deferDose':'Hoãn liều tiêm','schedules':'Xem lịch tiêm','voidRecord':'Hủy bản ghi tiêm','vaccines':'Xem vaccine','medicines':'Xem thuốc','createVaccine':'Tạo vaccine','updateVaccine':'Sửa vaccine','deleteVaccine':'Xóa vaccine chưa dùng','createMedicine':'Tạo thuốc','updateMedicine':'Sửa thuốc','breeds':'Xem giống','createBreed':'Tạo giống','updateBreed':'Sửa giống','purposes':'Xem mục đích nuôi','createPurpose':'Tạo mục đích nuôi','updatePurpose':'Sửa mục đích nuôi','effective':'Lấy tham số có hiệu lực','estrus':'Ghi động dục','breeding':'Ghi phối','pregnancyCheck':'Ghi kiểm tra thai','calving':'Ghi đẻ và bê','correctCalving':'Sửa lần đẻ','voidCalving':'Hủy lần đẻ','correctCalf':'Sửa kết quả bê','voidCalf':'Hủy kết quả bê','correctEvent':'Sửa sự kiện sinh sản','voidEvent':'Hủy sự kiện sinh sản','correctUpdate':'Sửa cập nhật thai kỳ','voidUpdate':'Hủy cập nhật thai kỳ','worklist':'Xem danh sách công việc sinh sản','addCattle':'Thêm bò vào phiếu xuất','dismiss':'Bỏ đề nghị xuất'}
for path,methods in SPEC['paths'].items():
    for method,operation in methods.items():
        if method not in METHODS:continue
        tag=operation['tags'][0]
        if tag not in TAG_FEATURE:raise ValueError('Unmapped resource: '+tag)
        ids,f=candidates(tag,path,method,operation['operationId'])
        direct=set()
        for uid in ids:
            direct.update(re.findall(r'(?:GBR-\d+|BR-D\d+)',ucs[uid]['fields'].get('Business Rules','')))
        contextual=set()
        for rid,r in rules.items():
            if re.search(rf'(?<![\w-])FE-{f:02}(?!\d)',r['applies']) or any(uid in r['applies'] for uid in ids):contextual.add(rid)
        common={'GBR-09','GBR-86','GBR-88','GBR-89','BR-D01','BR-D31'}
        if method=='get':common-={'GBR-86','GBR-88','GBR-89','BR-D31'}
        if '/farms/{farmId}' not in path:common.discard('BR-D01')
        sources,guards=source_for(tag,operation['operationId'])
        code_refs=set(re.findall(r'(?:GBR-\d+|BR-D\d+)', '\n'.join(x['text'] for x in sources)))
        rids=sorted((direct|contextual|common|code_refs)&set(rules),key=lambda x:(x.split('-')[0],int(re.search(r'\d+',x)[0])))
        opname=re.sub(r'_\d+$','',operation['operationId'])
        desc=operation.get('summary') or operation.get('description') or (VERBS.get(opname,opname)+' · '+NAMES[f])
        owner=3 if f in (8,9,10,11,12) or (f==18 and 'breed' not in path and 'purpose' not in path) else 2 if f in (4,5,6,13,16,18) else 4 if f in (7,14,15,20,23) else 1
        hashtext=json.dumps(resolve_refs(operation),ensure_ascii=False,sort_keys=True)
        hints={}
        if '/farms/{farmId}' in path:hints['path.farmId']='Mọi record/liên kết phải thuộc đúng trại và được kiểm quyền mỗi request — BR-D01, GBR-09. Đối chiếu thêm service status.'
        if any(p.get('name')=='Idempotency-Key' for p in operation.get('parameters',[])):hints['header.Idempotency-Key']='Một key cho một ý định; retry cùng key/body trả kết quả đầu; body khác bị từ chối — GBR-88.'
        if method in ('put','patch','delete') or any(x in path for x in ('correction','/void','/post','/confirm')):
            hints['expectedVersion']='Khi cập nhật/chuyển trạng thái phải dùng version người dùng đã đọc; từ chối nếu đã đổi — BR-D31, GBR-89. Kiểm tên trường version thực tế ở DTO.'
        if any(x in path for x in ('/correction','/correct','/void')):hints['reason']='Lý do correction/void và giữ trước/sau, actor, thời điểm — BR-D15. Kiểm field reason cụ thể và giới hạn trong DTO/SCR.'
        if '/entry-vouchers' in path:
            hints.update({'entryType':'PURCHASE hoặc FARM_BORN; DRAFT không tạo đàn. FARM_BORN chỉ bê live PENDING_CONFIRMATION và không có tiền — GBR-90, GBR-93.','sellerId':'Nguồn người bán cho PURCHASE: chọn đối tác cùng trại hoặc tạo inline; đối chiếu newSeller — GBR-97.','pricingBasis':'Áp dụng chung mọi dòng; PER_KG cần trọng lượng mỗi dòng — GBR-92.','lines':'Một dòng mỗi bò; ít nhất một dòng khi post; recheck toàn phiếu và ghi cùng transaction — GBR-90, BR-D34.','amountPaid':'Khoản dự định thanh toán ban đầu chỉ ghi khi post; không vượt tổng; FARM_BORN không có tiền — GBR-91, GBR-93.','lines[].weightBasis':'MEASURED hoặc ESTIMATED; nhãn ước tính UT; cân nhập trên dòng phiếu không phải growth assessment — GBR-92.'})
        if '/exit-vouchers' in path:
            hints.update({'lines':'Chỉ bò ACTIVE, không nằm trong exit line DRAFT/PENDING/CONFIRMED khác; confirm toàn phiếu hoặc không gì — GBR-94, BR-D35.','warningAcknowledged':'Cảnh báo bán/cull trước hết ngưng thuốc cần Owner xác nhận; warning không tự chặn — GBR-94. Kiểm tên field chính xác trong DTO.','amountCollected':'Collection chỉ Owner, VND nguyên dương, không vượt dư nợ; DEATH không có tiền — GBR-91, GBR-95.'})
        if '/vouchers/' in path or '/payments/' in path and 'voidPayment' in opname or opname=='payFeedReceipt':
            hints.update({'amount':'Số VND nguyên dương, không quá dư nợ — GBR-91, BR-D39.','paymentDate':'Không trước ngày phiếu, không tương lai — BR-D39.','voucherVersion':'Version phiếu đã đọc, stale bị từ chối — BR-D31, GBR-89.'})
        if f==21:
            hints.update({'fields.amount':'VND nguyên dương; category khớp INCOME/EXPENSE — GBR-83, BR-D27.','fields.scope':'FARM cần farm; GENERAL không có farm — BR-D27.','sourceEvidenceId':'Không dùng nguồn đã ghi nhận receipt hoặc manual INCOME khác; kiểm ở save/post/accept — GBR-84, BR-D28.'})
        if f==8:
            hints.update({'weightKg':'Dương; một assessment có cân, BCS hoặc cả hai — GBR-38, BR-D16.','bcs':'Theo thang BCS phiên bản trại; mặc định 1–5, bước 0.5 — GBR-38.','measuredAt':'Không tương lai và không trước ngày nhập đàn; xem field timestamp thực tế — GBR-38, BR-D14.'})
        if f==23:
            hints.update({'file':'Phiếu feed: PDF/JPEG tối đa 10 MiB, thay đổi chỉ DRAFT; SCR-79/80 và quyết định triển khai attachment. Kiểm magic bytes + MIME.','lotNumber':'Lô chỉ để cảnh báo hạn dùng; không phân bổ FEFO — quyết định D04.','expiryDate':'Đối chiếu ngày nhận theo service; lô/hạn nằm dòng phiếu, không phải nguồn tồn — D04.','feedingDate':'Không tương lai, một record VALID mỗi pen/date/session — BR-D37.','lines[].countedKg':'Điều chỉnh theo số kiểm đếm; chênh lệch khác 0 cần lý do; POSTED bất biến — GBR-100.'})
        if tag=='cattle-profile-resource' and opname=='resolve':desc='Tra mã nhận dạng / QR và phạm vi truy cập bò'
        if tag=='cs-support-resource' and opname=='resolve':desc='Ghi phiên bản giải quyết ticket'
        apis.append({'id':method.upper()+' '+path,'method':method.upper(),'path':path,'op':operation,'feature':f'FE-{f:02}','featureName':NAMES[f],'owner':str(owner),'ucs':ids,'rules':rids,'description':desc,'sources':sources,'guards':guards,'fieldHints':hints,'signature':hashlib.sha256(hashtext.encode()).hexdigest()[:20]})

apis.sort(key=lambda a:(int(a['feature'][3:]),a['path'],a['method']))
try: commit=subprocess.check_output(['git','rev-parse','--short','HEAD'],cwd=ROOT,text=True).strip()
except (FileNotFoundError,subprocess.CalledProcessError):commit='6ccc3a8'
data={'meta':{'commit':commit,'date':'2026-10-29','paths':len(SPEC['paths']),'operations':len(apis),'contractSha':hashlib.sha256(json.dumps(SPEC,sort_keys=True).encode()).hexdigest()[:16]},'apis':apis,'schemas':SPEC['components']['schemas'],'ucs':ucs,'rules':rules,'screens':screens,'names':NAMES,'decisions':(ROOT/'docs/REQUIREMENT_DECISIONS.md').read_text(encoding='utf-8')}
page=ROOT/'docs/api-handoff.html'
if not page.exists():raise SystemExit('Create api-handoff.html shell first.')
html=page.read_text(encoding='utf-8')
blob=json.dumps(data,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
html,count=re.subn(r'(?<=<script id="catalog-data" type="application/json">)[\s\S]*?(?=</script>)',lambda _:blob,html,count=1)
if count!=1:raise SystemExit('Missing catalog-data slot')
page.write_text(html,encoding='utf-8')
print(json.dumps({'paths':len(SPEC['paths']),'operations':len(apis),'ucs':len(ucs),'rules':len(rules),'screens':len(screens),'withSource':sum(bool(a['sources']) for a in apis),'htmlBytes':len(html.encode())},ensure_ascii=False))
