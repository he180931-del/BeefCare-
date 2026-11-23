# Hướng dẫn đọc frontend BeefCare cho người mới với React

## 1. Mục đích của tài liệu

Tài liệu này dành cho người đã biết lập trình cơ bản nhưng chưa học React hoặc chưa từng làm việc với frontend BeefCare.

Sau khi đọc xong, bạn có thể:

- hiểu React dùng để làm gì;
- hiểu các khái niệm React đang có trong project;
- biết vai trò của từng package chính;
- biết ứng dụng bắt đầu chạy từ đâu;
- hiểu luồng chung từ URL đến màn hình và backend;
- biết cách lần theo code khi cần sửa một chức năng;
- dùng use case **xem danh sách phiếu nhập đàn** làm mẫu để đọc các feature khác.

Tài liệu không giải thích chi tiết tất cả nghiệp vụ của từng feature. Các feature đều đi theo một cách tổ chức chung, vì vậy chỉ cần hiểu một feature mẫu trước.

## 2. Frontend BeefCare đang dùng công nghệ gì?

| Công nghệ | Vai trò |
|---|---|
| React 18 | Tạo giao diện từ các component và cập nhật giao diện khi dữ liệu thay đổi. |
| TypeScript | Thêm kiểu dữ liệu cho JavaScript để phát hiện lỗi sớm hơn. |
| Vite | Chạy frontend ở môi trường phát triển và tạo bản build. |
| React Router | Chọn màn hình cần hiển thị dựa trên URL. |
| Tailwind CSS | Viết style bằng các class ngắn ngay trong component. |
| Vitest | Chạy unit test và integration test cho frontend. |

Các file thường gặp:

- `.ts`: file TypeScript không chứa giao diện JSX;
- `.tsx`: file TypeScript có chứa JSX;
- `.css`: file style;
- `package.json`: danh sách thư viện và lệnh npm của frontend.

## 3. React là gì?

React là thư viện dùng để tạo giao diện web. Thay vì viết cả trang trong một file lớn, React chia giao diện thành các phần nhỏ gọi là **component**.

```text
Page
├── PageHeader
├── FilterBar
├── SummaryCards
├── DataTable
└── ErrorMessage
```

Mỗi component nhận dữ liệu, tạo ra giao diện và có thể được dùng lại.

```tsx
type GreetingProps = {
  name: string
}

function Greeting({ name }: GreetingProps) {
  return <p>Xin chào {name}</p>
}
```

Trong ví dụ trên:

- `Greeting` là component;
- `name` là dữ liệu được truyền từ component cha;
- phần giống HTML trong `return` được gọi là JSX;
- `{name}` cho phép đưa giá trị TypeScript vào JSX.

React không tự biết dữ liệu từ backend, URL hay farm hiện tại. Project phải kết hợp React với router, session, hooks và API để hoàn thành các việc đó.

## 4. Các thành phần chính của React đang dùng trong BeefCare

React trong project không chỉ có hooks. Các phần chính đang phối hợp với nhau như sau:

| Thành phần React | Vai trò trong project |
|---|---|
| Component | Chia giao diện thành page, layout, form, table, modal và các phần nhỏ có thể dùng lại. |
| JSX và Fragment | Mô tả giao diện bằng cú pháp gần giống HTML và nhóm nhiều phần tử mà không tạo thẻ HTML thừa. |
| Props | Truyền dữ liệu và callback từ component cha xuống component con. |
| State | Giữ dữ liệu thay đổi trên màn hình như bộ lọc, form và trạng thái modal. |
| Event handling | Xử lý click, nhập dữ liệu, submit form và các hành động của người dùng. |
| Conditional rendering | Hiển thị giao diện khác nhau cho loading, error, empty, role hoặc trạng thái nghiệp vụ. |
| List và key | Tạo table, option và danh sách component từ một mảng dữ liệu. |
| Controlled form | Giữ giá trị input trong state để kiểm tra và gửi dữ liệu. |
| Context và Provider | Chia sẻ auth và session cho toàn bộ cây component. |
| One-way data flow | Dữ liệu đi từ cha xuống con; hành động đi ngược lên bằng callback. |
| Render và re-render | Tạo lại mô tả giao diện khi props, state hoặc context thay đổi. |
| Lifecycle | Mô tả lúc component xuất hiện, cập nhật và bị gỡ khỏi màn hình. |
| Hooks | Cho function component dùng state, effect, context, ref và giá trị ghi nhớ. |
| Lazy và Suspense | Chỉ tải code của page khi route cần đến page đó. |
| Portal | Render một phần giao diện vào vị trí DOM khác khi layout yêu cầu. |

Các phần dưới đây giải thích lần lượt từng thành phần.

### 4.1 Component

Component là một hàm trả về JSX. Tên component bắt đầu bằng chữ hoa.

Trong BeefCare:

- file trong `pages/` thường là component của cả màn hình;
- file trong `components/` thường là phần nhỏ hơn của màn hình;
- component trong `shared/ui/` có thể dùng ở nhiều feature.

### 4.2 JSX

JSX có hình dạng gần giống HTML nhưng nằm trong TypeScript.

```tsx
return (
  <Button variant="primary" onClick={save}>
    Lưu
  </Button>
)
```

Một số điểm cần nhớ:

- dùng `className` thay cho `class`;
- sự kiện dùng dạng `onClick`, `onChange`, `onSubmit`;
- biểu thức TypeScript được đặt trong `{}`;
- một component chỉ trả về một cây JSX;
- JSX có thể hiển thị theo điều kiện.

```tsx
{error && <p role="alert">Không tải được dữ liệu</p>}
```

### 4.3 Fragment

Fragment dùng để nhóm nhiều phần tử nhưng không tạo thêm một thẻ `div` trong HTML.

```tsx
return (
  <>
    <PageHeader />
    <DataTable />
  </>
)
```

Project dùng cả cú pháp ngắn `<>...</>` và `Fragment`.

### 4.4 Props

Props là dữ liệu component cha truyền cho component con. Component con nên đọc props nhưng không tự thay đổi props.

```tsx
<Button variant="primary" onClick={openForm}>
  Tạo phiếu nhập
</Button>
```

Ở đây `variant` và `onClick` là props của `Button`.

### 4.5 State

State là dữ liệu có thể thay đổi trong lúc người dùng đang dùng màn hình. Khi state thay đổi, React chạy lại component và cập nhật phần giao diện cần thiết.

```tsx
const [tab, setTab] = useState('Tất cả')
```

- `tab` là giá trị hiện tại;
- `setTab` dùng để đổi giá trị;
- `'Tất cả'` là giá trị ban đầu.

Không sửa state trực tiếp. Hãy dùng hàm cập nhật như `setTab`.

### 4.6 Luồng dữ liệu một chiều

React dùng luồng dữ liệu một chiều:

```text
Component cha
    │ props
    ▼
Component con
    │ callback khi người dùng thao tác
    ▼
Component cha cập nhật state
```

Component cha giữ dữ liệu. Component con nhận dữ liệu qua props. Khi người dùng thao tác, component con gọi callback do cha truyền xuống. Component cha cập nhật state và truyền props mới xuống.

Nếu hai component con cùng cần một dữ liệu, state thường được đưa lên component cha chung gần nhất. Cách này thường được gọi là “lifting state up”.

### 4.7 Render và re-render

Render là lúc React chạy component để tạo giao diện. Re-render là lúc React chạy lại component sau khi props, state hoặc context thay đổi.

Re-render không có nghĩa là tải lại toàn bộ trang web. React chỉ cập nhật phần cần thay đổi.

### 4.8 Event handling

Event là hành động của người dùng như nhấn nút, nhập chữ hoặc chọn option.

```tsx
<input
  value={search}
  onChange={(event) => setSearch(event.target.value)}
/>
```

Giá trị trong input lấy từ state. Khi người dùng nhập, `onChange` cập nhật state.

Không gọi hàm ngay trong JSX nếu chỉ muốn chạy khi click.

```tsx
// Đúng: truyền một hàm
<Button onClick={save}>Lưu</Button>

// Sai: save chạy ngay trong lúc render
<Button onClick={save()}>Lưu</Button>
```

### 4.9 Conditional rendering

Conditional rendering là hiển thị giao diện theo điều kiện.

Project thường dùng ba cách:

```tsx
// Hiển thị khi điều kiện đúng
{error && <ErrorBlock />}

// Chọn một trong hai giao diện
{loading ? <LoadingBlock /> : <DataTable />}

// Trả về sớm
if (!data) return <LoadingBlock />
```

Các màn hình BeefCare dùng cách này cho loading, error, danh sách rỗng, quyền thao tác và trạng thái của bản ghi.

### 4.10 List và key

React dùng `map` để tạo giao diện từ một mảng.

```tsx
{rows.map((row) => (
  <Row key={row.id} row={row} />
))}
```

`key` phải ổn định và duy nhất trong danh sách. Nó giúp React biết item nào được thêm, xóa hoặc thay đổi. Ưu tiên ID của dữ liệu; không dùng vị trí mảng nếu danh sách có thể thay đổi.

### 4.11 Controlled form

Phần lớn input trong project là controlled input: giá trị của input được giữ trong state.

```tsx
const [name, setName] = useState('')

return (
  <input
    value={name}
    onChange={(event) => setName(event.target.value)}
  />
)
```

Lợi ích:

- giao diện và state luôn cùng giá trị;
- dễ validation;
- dễ bật hoặc tắt nút lưu;
- dễ tạo request body;
- dễ đặt lại form.

### 4.12 Context và Provider

Context dùng để chia sẻ dữ liệu cho nhiều component mà không phải truyền props qua mọi cấp.

BeefCare dùng Context cho trạng thái đăng nhập, thông tin session, người dùng hiện tại và role trong farm hiện tại.

Provider đặt dữ liệu ở phía trên cây component. Component phía dưới dùng hook như `useSession()` hoặc `useAuth()` để đọc dữ liệu đó.

Không nên đưa mọi state vào Context. State chỉ dùng trong một page hoặc modal nên giữ gần component sử dụng nó.

### 4.13 Component lifecycle

Một component có ba giai đoạn dễ hiểu:

1. **Mount:** component xuất hiện trên màn hình lần đầu.
2. **Update:** props, state hoặc context thay đổi và component re-render.
3. **Unmount:** component bị gỡ khỏi màn hình vì đổi route hoặc điều kiện hiển thị.

`useEffect` có thể chạy khi mount, khi dependency thay đổi và có thể trả về cleanup khi unmount.

```tsx
useEffect(() => {
  window.addEventListener('event-name', handleEvent)

  return () => {
    window.removeEventListener('event-name', handleEvent)
  }
}, [handleEvent])
```

Cleanup tránh listener hoặc request cũ tiếp tục hoạt động sau khi component đã đóng.

### 4.14 Lazy loading và Suspense

Project dùng `lazy` và `Suspense` ở router.

```tsx
const ImportList = lazy(loadImportListPage)

return (
  <Suspense fallback={null}>
    <Routes>...</Routes>
  </Suspense>
)
```

`lazy` chia code theo page. Trình duyệt chỉ tải code của page khi người dùng mở route đó. `Suspense` cung cấp giao diện tạm trong lúc chờ code được tải.

### 4.15 Portal

Portal cho phép một component render vào một vị trí DOM khác nhưng vẫn thuộc cùng cây React.

Project có dùng `createPortal` cho một số vùng giao diện cần xuất hiện ở một slot riêng. Portal phù hợp với overlay, action area hoặc phần giao diện cần thoát khỏi giới hạn layout. Đây không phải công cụ để truyền dữ liệu giữa các feature.

### 4.16 Promise và async/await

Gọi backend không trả dữ liệu ngay. Kết quả thường là một `Promise`.

```ts
async function loadData() {
  const rows = await api.list()
  return rows
}
```

Trong lúc chờ, giao diện cần có trạng thái `loading`. Nếu request lỗi, giao diện cần có trạng thái `error`.

## 5. Hooks: cách component dùng các khả năng của React

Hook là hàm React có tên bắt đầu bằng `use`. Hook cho phép component dùng state, effect, context và các chức năng khác của React.

Hai quy tắc quan trọng:

1. Chỉ gọi hook ở đầu component hoặc trong một custom hook.
2. Không gọi hook bên trong `if`, `for`, `while` hoặc một hàm con tùy ý.

Frontend BeefCare đang dùng các hook React sau.

### 5.1 `useState`

Dùng để giữ state của component. Project dùng hook này cho tab đang chọn, ô tìm kiếm, bộ lọc, modal và dữ liệu form.

```tsx
const [dateOpen, setDateOpen] = useState(false)
```

### 5.2 `useEffect`

Dùng để chạy một việc sau khi component render hoặc khi dependency thay đổi.

Project dùng hook này để tải dữ liệu, đăng ký event listener, đồng bộ session và dọn request cũ.

```tsx
useEffect(() => {
  void loadProfile()
}, [loadProfile])
```

Mảng cuối cùng là dependency list. Effect chạy lại khi một giá trị trong danh sách thay đổi.

### 5.3 `useMemo`

Dùng để giữ lại kết quả của một phép tính cho đến khi dependency thay đổi.

```tsx
const visibleRows = useMemo(
  () => rows.filter((row) => row.status === status),
  [rows, status],
)
```

Chỉ nên dùng khi kết quả cần giữ ổn định hoặc phép tính có chi phí đáng kể.

### 5.4 `useCallback`

Dùng để giữ lại cùng một hàm cho đến khi dependency thay đổi.

```tsx
const reload = useCallback(() => api.list(), [api])
```

Project dùng hook này trong custom hooks, callback truyền xuống component con và hàm nằm trong dependency list.

### 5.5 `useRef`

Dùng để giữ một giá trị qua nhiều lần render mà không làm component re-render khi giá trị thay đổi.

Project dùng `useRef` để giữ request ID, bỏ qua response cũ, giữ tham chiếu đến DOM và giữ giá trị mới nhất cho callback.

Trong `shared/hooks/useQuery.ts`, request ID giúp response cũ không ghi đè response mới.

### 5.6 `useContext`

Dùng để đọc dữ liệu từ Context.

```tsx
export const useSession = () => useContext(SessionContext)
```

Page không cần tự gọi lại API hồ sơ người dùng. Page đọc session từ context.

### 5.7 `useId`

Dùng để tạo ID ổn định cho phần tử giao diện, thường để nối `label` với `input` và hỗ trợ accessibility.

### 5.8 `useLayoutEffect`

Gần giống `useEffect`, nhưng chạy trước khi trình duyệt vẽ giao diện. Project chỉ dùng khi cần đo hoặc điều chỉnh giao diện trước khi người dùng nhìn thấy. Với phần lớn code mới, hãy dùng `useEffect` trước.

## 6. Hooks của React Router

Các hook này đến từ `react-router-dom`.

| Hook | Dùng để làm gì? |
|---|---|
| `useNavigate` | Chuyển sang URL khác bằng code. |
| `useLocation` | Đọc URL và state của vị trí hiện tại. |
| `useParams` | Đọc tham số trong URL, ví dụ `:id` hoặc `:code`. |
| `useSearchParams` | Đọc và cập nhật query string sau dấu `?`. |

```tsx
<Route path="/herd-entry/:id" element={<ImportDetail />} />
```

Khi URL là `/herd-entry/EV-001`, `useParams()` có thể đọc được `id = 'EV-001'`.

## 7. Custom hooks của BeefCare

Custom hook là hook do project tự tạo. Nó giúp page không chứa quá nhiều code tải dữ liệu hoặc gửi lệnh.

Ví dụ:

- `useQuery`: tải dữ liệu và trả về `data`, `loading`, `error`, `refetch`;
- `useMutation`: chạy một lệnh và trả về `mutate`, `loading`, `error`;
- `useEntryList`: tải dữ liệu cho trang danh sách phiếu nhập;
- các hook có tên `use...Commands`: thường chứa thao tác tạo, sửa, hủy hoặc đổi trạng thái.

```text
Page gọi custom hook
    ↓
Custom hook gọi feature API
    ↓
Feature API gọi shared transport
    ↓
Hook trả data/loading/error về Page
```

## 8. Cấu trúc package của frontend

Đây là mô tả tổng quan. Không cần học thuộc tất cả tên feature.

| Package | Vai trò |
|---|---|
| `src/app` | Ghép các phần lớn của ứng dụng: provider, router, layout, session và style. |
| `src/app/routes` | Khai báo URL, page cần mở, farm cần có và role được phép truy cập. |
| `src/app/providers` | Đặt Router, AuthProvider, AuthGate và SessionProvider quanh ứng dụng. |
| `src/app/layouts` | Chứa khung trang cho các nhóm người dùng. |
| `src/app/session` | Giữ thông tin người dùng, farm hiện tại, role và vòng đời session. |
| `src/app/styles` | Chứa style toàn cục. |
| `src/shared` | Chứa code chung, không thuộc một nghiệp vụ riêng. |
| `src/shared/api` | Chứa HTTP client, transport, parser và cách đổi lỗi backend thành lỗi dễ hiểu. |
| `src/shared/ui` | Chứa component dùng chung như Button, Table, Modal, Form và Badge. |
| `src/shared/hooks` | Chứa custom hook chung như `useQuery` và `useMutation`. |
| `src/shared/lib` | Chứa hàm nhỏ dùng chung cho ngày, giờ và định dạng dữ liệu. |
| `src/shared/config` | Đọc cấu hình runtime và chọn backend mode hoặc mock mode. |
| `src/shared/assets` | Chứa icon, ảnh và logo dùng chung. |
| `src/features` | Chứa các nhóm nghiệp vụ. Mỗi feature sở hữu page, component, hook, API, rule và type của chính nó. |
| `src/features/*/pages` | Chứa component của cả màn hình. |
| `src/features/*/components` | Chứa các phần giao diện chỉ dùng trong feature đó. |
| `src/features/*/hooks` | Kết nối page với API và giữ logic dùng lại của feature. |
| `src/features/*/api` | Gọi endpoint, khai báo DTO và đổi dữ liệu backend thành dữ liệu giao diện. |
| `src/features/*/domain` | Chứa rule và phép tính thuần của nghiệp vụ. |
| `src/features/*/validation` | Kiểm tra dữ liệu form. |
| `src/features/*/types.ts` | Chứa type của feature. |
| `src/features/*/routes.ts` | Export hàm lazy import page cho router chính. |
| `src/features/*/index.ts` | Export phần công khai của feature. |
| `src/demo` | Cổng cho dữ liệu demo và mock. Production build không dùng dữ liệu demo. |
| `src/api`, `src/components`, `src/data`, `src/types.ts` | Phần cũ chưa chuyển hết sang cấu trúc feature. Không thêm code mới vào đây nếu chưa có lý do rõ ràng. |

Quy tắc đơn giản:

- code chỉ thuộc một nghiệp vụ đặt trong feature đó;
- code giao diện dùng chung đặt trong `shared/ui`;
- code kết nối toàn ứng dụng đặt trong `app`;
- không import file nội bộ của feature khác;
- code mới không được đưa vào package legacy chỉ vì dễ tìm.

## 9. Ứng dụng bắt đầu chạy từ đâu?

```text
index.html
    ↓
src/main.tsx
    ↓
src/app/bootstrap.tsx
    ↓
AppProviders
    ↓
AppRoutes
    ↓
Feature page
```

`src/main.tsx` import `app/bootstrap`.

`app/bootstrap.tsx` tìm phần tử HTML có ID `root`, sau đó render ứng dụng:

```tsx
ReactDOM.createRoot(root).render(
  <AppProviders>
    <AppRoutes />
  </AppProviders>,
)
```

`AppProviders` đặt các provider theo thứ tự:

```text
BrowserRouter
└── AuthProvider
    └── AuthGate
        └── SessionProvider
            └── AppRoutes
```

1. Router phải có trước để component đọc được URL.
2. AuthProvider kiểm tra trạng thái đăng nhập.
3. AuthGate chỉ cho phần bên trong chạy khi đã đăng nhập.
4. SessionProvider tải hồ sơ, role và farm.
5. AppRoutes chọn page đúng với URL.

## 10. Luồng logic chung của một màn hình

```text
Người dùng mở URL
    ↓
AppRoutes tìm route phù hợp
    ↓
RequireFarm kiểm tra tab đã chọn farm chưa
    ↓
RoleGate kiểm tra role có được mở màn hình không
    ↓
routes.ts lazy-load page
    ↓
Page gọi custom hook
    ↓
Custom hook gọi feature API
    ↓
Feature API chọn backend thật hoặc demo
    ↓
Backend adapter gọi shared BackendTransport
    ↓
HTTP request đến Spring Boot backend
    ↓
Response được parse và map
    ↓
Hook cập nhật data/loading/error
    ↓
React re-render Page
```

Khi người dùng lưu dữ liệu:

```text
onClick hoặc onSubmit
    ↓
Validation
    ↓
Command hook hoặc useMutation
    ↓
Feature API
    ↓
BackendTransport.command
    ↓
Backend xử lý và trả response
    ↓
Đóng modal, báo kết quả hoặc refetch dữ liệu
```

## 11. Router, farm và role

`app/routes/AppRoutes.tsx` là bản đồ URL của frontend.

```tsx
<Route path="/herd-entry" element={desk(<ImportList />)} />
```

`desk(...)` có nghĩa là màn hình cần farm hiện tại và chỉ `OWNER` hoặc `MANAGER` được mở.

`RequireFarm` không tự đoán farm. Nếu tab chưa chọn farm, người dùng được đưa đến `/chon-trai`.

`RoleGate` giúp điều hướng đúng trên frontend. Quyền thật vẫn do backend kiểm tra cho từng request.

Farm hiện tại được giữ trong `sessionStorage`, nên mỗi tab trình duyệt có thể làm việc với một farm khác nhau.

## 12. API, DTO và mapper

Page không nên tự viết `fetch`. Page gọi API của feature.

```text
Page → Hook → Feature API → Shared transport → Backend
```

Feature API chọn backend thật khi `backendMode === 'backend'`, hoặc demo store khi chạy mock mode. Backend mode không được tự chuyển sang localStorage khi request lỗi.

DTO là hình dạng dữ liệu đi qua API. Mapper đổi DTO của backend thành dữ liệu dễ dùng trong giao diện.

```text
Backend DTO
    ↓ mapper
Frontend View Model
    ↓
Component
```

`shared/api/backendClient.ts` và `backendTransport.ts` xử lý các việc chung:

- chỉ nhận path bắt đầu bằng `/api/`;
- gửi cookie đăng nhập;
- lấy và gửi CSRF token cho request thay đổi dữ liệu;
- gửi `Idempotency-Key` cho command;
- phát hiện session hết hạn;
- đổi HTTP error thành `BackendError`;
- tạo URL có farm ID.

Feature không nên tự viết lại các bước này.

## 13. State, form và validation

Một form thường có ba nhóm dữ liệu:

1. giá trị người dùng đang nhập;
2. lỗi validation;
3. trạng thái gửi như loading, success hoặc error.

```text
Người dùng nhập dữ liệu
    ↓
onChange cập nhật state
    ↓
Người dùng nhấn Lưu
    ↓
validation kiểm tra state
    ↓
Nếu sai: hiển thị lỗi field
Nếu đúng: gọi command API
    ↓
Nhận response và cập nhật giao diện
```

Rule kiểm tra field nên nằm trong `validation/`. Rule và phép tính nghiệp vụ thuần nên nằm trong `domain/`. Page chỉ nên ghép các phần và hiển thị kết quả.

## 14. Component chung và component của feature

Đặt component trong `shared/ui` khi component không chứa rule của một nghiệp vụ cụ thể và có thể dùng ở nhiều feature.

Đặt component trong `features/<feature>/components` khi component chỉ dùng cho một nghiệp vụ hoặc biết type và trạng thái riêng của feature.

Ví dụ:

- `shared/ui/Button` là component chung;
- `herd-entry/components/PayModal` là component riêng của Herd Entry.

## 15. Use case mẫu: xem danh sách phiếu nhập đàn

Use case này minh họa luồng đọc dữ liệu hoàn chỉnh.

### Bước 1: Người dùng mở URL

```text
/herd-entry
```

Trong `app/routes/AppRoutes.tsx`:

```tsx
<Route path="/herd-entry" element={desk(<ImportList />)} />
```

Router xác định page là `ImportList`. Hàm `desk` yêu cầu farm hiện tại và role `OWNER` hoặc `MANAGER`.

### Bước 2: Router lazy-load page

`features/herd-entry/routes.ts`:

```ts
export const loadImportListPage = () => import('./pages/ImportList')
```

Page chỉ được tải khi người dùng mở route này.

### Bước 3: Page tạo state cho bộ lọc

`features/herd-entry/pages/ImportList.tsx` dùng `useState` cho tab, loại nhập, nguồn bán, khoảng ngày và trạng thái mở bộ chọn ngày.

```tsx
const [tab, setTab] = useState('Tất cả')
const [type, setType] = useState('')
const [from, setFrom] = useState(DEFAULT_FROM)
const [to, setTo] = useState(DEFAULT_TO)
```

Khi người dùng đổi bộ lọc, state thay đổi và page re-render.

### Bước 4: Page gọi custom hook

```tsx
const {
  rows,
  loading,
  error,
  summary,
  pendingCalves,
  sellers,
} = useEntryList({ tab, type, source, from, to })
```

Page không cần biết cách tạo URL API hoặc parse response.

### Bước 5: Custom hook tải dữ liệu

`features/herd-entry/hooks/useEntryList.ts` dùng `useQuery` để tải bê đang chờ xác nhận, danh sách người bán, danh sách phiếu nhập và số liệu tổng hợp.

```tsx
useQuery(
  () => herdEntryApi.listView({ type, from, to, sellerId, sellerName }),
  [type, from, to, sellerId, sellerName],
)
```

Khi một dependency thay đổi, `useQuery` tải lại dữ liệu.

### Bước 6: Feature API chọn nguồn dữ liệu

Trong `features/herd-entry/api/herdEntryApi.ts`:

```ts
listView: (filters) =>
  usingBackend
    ? backendApi.listView(filters)
    : demo.entryLocal.localView(filters)
```

Backend mode gọi backend thật. Mock mode đọc demo data.

### Bước 7: Request đi qua shared transport

Backend adapter tạo path có farm ID và gọi `backendTransport`.

```text
GET /api/farms/{farmId}/entry-vouchers
```

Shared transport gửi cookie session, xử lý lỗi và trả dữ liệu về feature API.

### Bước 8: Hook chuẩn bị dữ liệu cho page

`useEntryList` lấy response, chọn row đúng với tab và khoảng ngày, sau đó trả về `rows`, `loading`, `error`, `refetch`, `pendingCalves`, `sellers` và `summary`.

### Bước 9: Page hiển thị giao diện

`ImportList` dùng dữ liệu để hiển thị thông báo lỗi, nút tạo phiếu, bộ lọc, thẻ số liệu, bảng và trạng thái đang tải.

```tsx
{Boolean(error) && <Note tone="err">...</Note>}
```

```tsx
{rows.map((row) => (
  <tr key={row.id}>
    <td>{row.id}</td>
    <td>{row.date}</td>
    <td>{row.status}</td>
  </tr>
))}
```

`key` giúp React nhận biết từng row khi danh sách thay đổi.

### Bước 10: Người dùng đổi bộ lọc

```text
Event
  → setState
  → Page re-render
  → dependency của useQuery thay đổi
  → gọi API lại
  → data mới được lưu vào hook
  → Page re-render với bảng mới
```

Đây là mẫu chung để đọc các màn hình danh sách khác trong project.

## 16. Cách đọc một feature khác

1. Tìm URL trong `app/routes/AppRoutes.tsx`.
2. Mở `features/<feature>/routes.ts` để biết page nào được tải.
3. Mở file trong `pages/` để xem màn hình ghép những phần nào.
4. Xem page gọi custom hook nào.
5. Mở hook trong `hooks/` để xem dữ liệu đến từ đâu.
6. Mở API trong `api/` để xem endpoint, DTO và mapper.
7. Mở `validation/` nếu có form.
8. Mở `domain/` nếu cần hiểu rule hoặc phép tính.
9. Mở `components/` khi cần hiểu một phần giao diện cụ thể.
10. Xem test tương ứng trong `frontend/tests/`.

Không nên bắt đầu bằng cách đọc toàn bộ feature. Hãy bắt đầu từ một URL hoặc hành động cụ thể.

## 17. Cách tìm nơi cần sửa

| Yêu cầu | Nơi nên kiểm tra đầu tiên |
|---|---|
| Thêm hoặc đổi URL | `app/routes/AppRoutes.tsx` và `features/*/routes.ts` |
| Đổi bố cục màn hình | `features/*/pages` và `features/*/components` |
| Đổi component dùng chung | `shared/ui` |
| Thêm bộ lọc hoặc state | Page và custom hook của feature |
| Đổi endpoint hoặc request body | `features/*/api` và OpenAPI/backend DTO |
| Đổi cách hiển thị response | Mapper, hook hoặc view model |
| Thêm validation | `features/*/validation` |
| Đổi rule hoặc phép tính | `features/*/domain` |
| Đổi quyền mở màn hình | `AppRoutes`, `RequireFarm`, `RoleGate` |
| Đổi cách xử lý HTTP chung | `shared/api` |
| Đổi dữ liệu demo | `demo` hoặc demo store của feature |

Khi field liên quan đến API hoặc database, cần kiểm tra cả frontend, backend, OpenAPI và đường lưu dữ liệu.

## 18. Cách chạy frontend

Từ thư mục `frontend/`:

```bash
npm install
npm run dev
```

```bash
# Chạy với backend thật
npm run dev:backend

# Chạy với dữ liệu mock ở cổng 5174
npm run dev:mock

# Kiểm tra TypeScript
npm run typecheck

# Tạo production build
npm run build
```

Node version của project là `22.22.2`.

Test một feature:

```bash
./node_modules/.bin/vitest run --passWithNoTests tests/unit/<feature>
```

Screenshot không chứng minh logic và API đã đúng. Với thay đổi có dữ liệu, cần kiểm tra request, response và test liên quan.

## 19. Các lỗi người mới thường gặp

### Gọi hook trong `if`

Sai:

```tsx
if (open) {
  const [value, setValue] = useState('')
}
```

Hook phải được gọi ở đầu component.

### Sửa state trực tiếp

Sai:

```ts
form.name = 'New name'
```

Đúng:

```ts
setForm((current) => ({ ...current, name: 'New name' }))
```

### Quên dependency

Nếu callback đọc một giá trị nhưng dependency list không có giá trị đó, code có thể dùng dữ liệu cũ.

### Gọi API trực tiếp trong component

Không viết `fetch` rải rác trong page. Hãy đi qua hook, feature API và shared transport.

### Đưa logic nghiệp vụ vào JSX

Nếu JSX chứa nhiều phép tính hoặc điều kiện khó đọc, chuyển chúng sang hook hoặc `domain/`.

### Dùng index làm key

Ưu tiên ID ổn định:

```tsx
rows.map((row) => <Row key={row.id} row={row} />)
```

### Cho rằng frontend kiểm tra role là đủ

Frontend gate chỉ giúp điều hướng. Backend vẫn phải kiểm tra quyền cho mỗi request.

### Trộn demo data vào production code

Demo data chỉ đi qua `src/demo`. Backend mode không được fallback sang demo khi lỗi.

### Import file nội bộ của feature khác

Feature khác chỉ nên dùng phần được export qua `index.ts`, hoặc lấy dữ liệu từ backend.

## 20. Từ điển thuật ngữ ngắn

| Thuật ngữ | Nghĩa đơn giản |
|---|---|
| Component | Một phần giao diện React. |
| JSX | Cú pháp giống HTML nằm trong TypeScript. |
| Props | Dữ liệu cha truyền cho con. |
| State | Dữ liệu thay đổi trong lúc dùng màn hình. |
| Hook | Hàm React bắt đầu bằng `use`. |
| Context | Cách chia sẻ dữ liệu cho nhiều component. |
| Provider | Component cung cấp Context cho phần bên dưới. |
| Render | React chạy component để tạo giao diện. |
| Re-render | React chạy lại component vì dữ liệu thay đổi. |
| Route | Quy tắc nối URL với page. |
| Page | Component đại diện cho một màn hình. |
| API | Cách frontend trao đổi dữ liệu với backend. |
| DTO | Hình dạng dữ liệu request hoặc response. |
| Mapper | Hàm đổi DTO thành dữ liệu frontend dễ dùng. |
| View model | Dữ liệu đã được chuẩn bị để hiển thị. |
| Validation | Kiểm tra dữ liệu người dùng nhập. |
| Dependency | Giá trị làm hook chạy lại khi thay đổi. |
| Lazy loading | Chỉ tải page khi người dùng mở route đó. |
| Mock data | Dữ liệu giả dùng để phát triển hoặc test. |

## 21. Checklist đọc code nhanh

- URL của màn hình là gì?
- Route mở page nào?
- Route yêu cầu farm và role nào?
- Page dùng component nào?
- Page giữ state nào?
- Page gọi custom hook nào?
- Hook gọi API nào?
- API dùng backend thật hay demo?
- Endpoint là gì?
- Dữ liệu có đi qua mapper không?
- Loading, empty và error hiển thị ở đâu?
- Form được validation ở đâu?
- Sau command, dữ liệu được cập nhật hay refetch thế nào?
- Test nào bảo vệ hành vi này?

Nếu trả lời được các câu trên, bạn đã hiểu phần lớn luồng của màn hình mà chưa cần đọc toàn bộ project.

## 22. Các file nên đọc tiếp

1. `frontend/src/main.tsx`
2. `frontend/src/app/bootstrap.tsx`
3. `frontend/src/app/providers/AppProviders.tsx`
4. `frontend/src/app/routes/AppRoutes.tsx`
5. `frontend/src/shared/hooks/useQuery.ts`
6. `frontend/src/shared/hooks/useMutation.ts`
7. `frontend/src/shared/api/backendClient.ts`
8. `frontend/src/shared/api/backendTransport.ts`
9. `frontend/src/features/herd-entry/routes.ts`
10. `frontend/src/features/herd-entry/pages/ImportList.tsx`
11. `frontend/src/features/herd-entry/hooks/useEntryList.ts`
12. `frontend/src/features/herd-entry/api/herdEntryApi.ts`

Đọc theo thứ tự trên sẽ đi từ phần dễ nhìn thấy nhất đến phần kết nối backend.
