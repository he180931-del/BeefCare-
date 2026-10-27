// Dữ liệu mẫu (seed) của chuồng trại; màn hình đọc qua src/api/penApi.js
// code, name, count (đang có), capacity, accept (cột "Tiếp nhận"), status
export const seedPens = [
 { code:'A1', name:'Bò cái sinh sản', count:58, capacity:64, accept:'Sinh sản',       status:'ACTIVE',   purpose:'Sinh sản',         stage:'Bò cái sinh sản', minAge:13,   minWeight:230,  sex:'Cái',    version:'v2 từ 01/09/2026', desc:'Chuồng nền xi măng, khu cho ăn riêng',
   cows:[['BC-000125','Mang thai 5 tháng'],['BC-000154','Đã phối 12 ngày'],['BC-000131','Nhắc tiêm']] },
 { code:'A2', name:'Bò chửa',         count:22, capacity:30, accept:'Bò chửa',        status:'ACTIVE',   purpose:'Sinh sản',         stage:'Bò chửa',         minAge:null, minWeight:null, sex:'Cái',    version:'v1 từ 01/06/2026', desc:'Khu bò chửa, ít người qua lại',
   cows:[['BC-000087','Mang thai 7 tháng'],['BC-000142','Mang thai 4 tháng'],['BC-000219','Mang thai 6 tháng']] },
 { code:'A3', name:'Bê theo mẹ',      count:28, capacity:40, accept:'Bê theo mẹ',     status:'ACTIVE',   purpose:'Mọi mục đích',     stage:'Bê theo mẹ',      minAge:null, minWeight:null, sex:'Cả hai', version:'v1 từ 01/06/2026', desc:'Chuồng bê có sân chơi',
   cows:[['BC-000301','Bê theo mẹ BC-000093'],['BC-000302','Bê theo mẹ BC-000108'],['BC-000303','Bê theo mẹ BC-000118']] },
 { code:'B1', name:'Vỗ béo',          count:46, capacity:50, accept:'Vỗ béo',         status:'ACTIVE',   purpose:'Nuôi thương phẩm', stage:'Vỗ béo',          minAge:18,   minWeight:280,  sex:'Đực',    version:'v1 từ 01/06/2026', desc:'Chuồng vỗ béo máng ăn dọc',
   cows:[['BC-000203','Vỗ béo ngày 62'],['BC-000205','Ngưng GM → 25/10'],['BC-000211','Vỗ béo ngày 48']] },
 { code:'B2', name:'Đực giống',       count:10, capacity:12, accept:'Đực giống',      status:'ACTIVE',   purpose:'Giữ giống',        stage:'Đực giống',       minAge:24,   minWeight:null, sex:'Đực',    version:'v1 từ 01/06/2026', desc:'Chuồng riêng cho đực giống',
   cows:[['BC-000310','Đực giống, khoẻ'],['BC-000311','Theo dõi chân'],['BC-000312','Nhắc tiêm']] },
 { code:'C1', name:'Bò tơ',           count:37, capacity:40, accept:'Bò tơ',          status:'ACTIVE',   purpose:'Sinh sản',         stage:'Bò tơ',           minAge:9,    minWeight:null, sex:'Cái',    version:'v1 từ 01/06/2026', desc:'Chuồng mái tôn, máng ăn dọc, gần khu cân',
   cows:[['BC-000061','Bò tơ phát triển tốt'],['BC-000240','Nhắc cân'],['BC-000248','Mới nhập đàn']] },
 { code:'C2', name:'Bê sau cai sữa',  count:41, capacity:45, accept:'Bê cai sữa',     status:'ACTIVE',   purpose:'Mọi mục đích',     stage:'Bê cai sữa',      minAge:6,    minWeight:null, sex:'Cả hai', version:'v1 từ 01/06/2026', desc:'Chuồng bê sau cai sữa',
   cows:[['BC-000320','Bê cai sữa 2 tháng'],['BC-000321','Nhắc tiêm'],['BC-000322','Bê cai sữa 1 tháng']] },
 { code:'D',  name:'Chuồng đẻ',       count:3,  capacity:8,  accept:'Bò chửa cận đẻ', status:'ACTIVE',   purpose:'Sinh sản',         stage:'Bò chửa cận đẻ', minAge:null, minWeight:null, sex:'Cái',    version:'v1 từ 01/06/2026', desc:'Chuồng đẻ có camera',
   cows:[['BC-000330','Dự sinh sau 5 ngày'],['BC-000331','Dự sinh sau 12 ngày'],['BC-000332','Dự sinh sau 20 ngày']] },
 { code:'Q',  name:'Cách ly nhập đàn',count:3,  capacity:12, accept:'Mọi mục đích',   status:'ACTIVE',   purpose:'Mọi mục đích',     stage:'Mọi giai đoạn',   minAge:null, minWeight:null, sex:'Cả hai', version:'v1 từ 01/06/2026', desc:'Cách ly 21 ngày trước khi vào đàn',
   cows:[['BC-000248','Cách ly ngày 6'],['BC-000340','Cách ly ngày 3'],['BC-000341','Cách ly ngày 1']] },
 { code:'E',  name:'Đang sửa chữa',   count:0,  capacity:38, accept:'—',              status:'INACTIVE', purpose:'—',                stage:'—',               minAge:null, minWeight:null, sex:'—',      version:'v1 từ 01/06/2026', desc:'Đang sửa chữa mái',
   cows:[] },
]
// ngưỡng tiếp nhận hiển thị (ghép từ minAge/minWeight và toán tử); không có → "—"
export const thresholdText = (b) => [b.minAge != null && `${b.minAgeOp || '≥'} ${b.minAge} tháng`, b.minWeight != null && `${b.minWeightOp || '≥'} ${b.minWeight} kg`].filter(Boolean).join(' và ') || '—'
export const PURPOSES = ['Sinh sản', 'Nuôi thương phẩm', 'Giữ giống', 'Mọi mục đích']
export const STAGES = ['Bò cái sinh sản', 'Bò chửa', 'Bê theo mẹ', 'Vỗ béo', 'Đực giống', 'Bò tơ', 'Bê cai sữa', 'Bò chửa cận đẻ', 'Mọi giai đoạn']
