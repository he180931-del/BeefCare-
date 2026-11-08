# Hướng dẫn chạy frontend BeefCare

Tài liệu này mô tả cách cài dependency, chạy frontend React ở môi trường phát triển, chạy dữ liệu mock, kiểm tra mã nguồn và tạo bản build production.

## 1. Công cụ yêu cầu

- Node.js `22.22.2`.
- npm đi kèm Node.js (hiện máy chuẩn đang dùng npm `10.9.7`).
- Git.
- Backend BeefCare nếu muốn gọi API thật.

Các lệnh `npm` bên dưới chạy giống nhau trên macOS, Windows PowerShell và Windows Command Prompt. Khác biệt chủ yếu nằm ở cách cài/chọn Node.js và lệnh xóa thư mục dependency.

### macOS

Có thể cài Node bằng Homebrew:

```bash
brew install node@22
```

Homebrew thường cài bản patch mới nhất của dòng 22, không đảm bảo đúng `22.22.2`. Nếu cần đúng tuyệt đối phiên bản dự án, dùng `nvm install 22.22.2`.

Hoặc dùng `nvm`:

```bash
nvm install 22.22.2
nvm use 22.22.2
```

### Windows

Khuyến nghị dùng **nvm-windows**. Sau khi cài nvm-windows, mở PowerShell hoặc Command Prompt:

```powershell
nvm install 22.22.2
nvm use 22.22.2
```

Nếu không dùng nvm-windows, cài Node.js `22.22.2` bằng bộ cài chính thức rồi mở terminal mới.

> Kiểm tra phiên bản:

```bash
node --version
npm --version
```

Nếu dùng `nvm`, chạy tại thư mục gốc repository trên macOS/Linux:

```bash
nvm install
nvm use
```

Trên Windows với nvm-windows:

```powershell
nvm use 22.22.2
```

Phiên bản Node được khai báo trong [`.nvmrc`](../.nvmrc) và `frontend/package.json`.

## 2. Cài dependency

```bash
cd frontend
npm ci
```

`npm ci` cài đúng các phiên bản đã khóa trong [`package-lock.json`](../frontend/package-lock.json). Dùng lệnh này cho môi trường sạch hoặc CI; không dùng `npm install` nếu chỉ muốn tái tạo chính xác dependency hiện tại.

## 3. Chạy môi trường phát triển

### Dùng API/backend thật

```bash
cd frontend
npm run dev
```

Vite mặc định mở ở `http://localhost:5173`.

Frontend proxy các request bắt đầu bằng `/api` tới backend:

```text
http://127.0.0.1:8080
```

Cấu hình proxy nằm trong [`frontend/vite.config.js`](../frontend/vite.config.js).

### Dùng dữ liệu mock

```bash
cd frontend
npm run dev:mock
```

Lệnh này mở ở `http://127.0.0.1:5174` và bật mock data/auth, không yêu cầu backend đang chạy.

## 4. Kiểm tra mã nguồn

```bash
cd frontend

# Kiểm tra TypeScript và type của test
npm run typecheck

# Chạy toàn bộ test
npm test

# Chạy riêng từng nhóm
npm run test:api
npm run test:unit:run
npm run test:integration
npm run test:integration:ui
```

## 5. Tạo bản build production

```bash
cd frontend
npm run build
```

Lệnh này chạy `vite build` và tạo các file tĩnh tại:

```text
frontend/dist/
├── index.html
└── assets/
```

Build **chỉ tạo file ở local**. Nó chưa tự động:

- đẩy file lên server;
- tạo Docker image;
- cấu hình Nginx;
- copy file vào backend;
- deploy lên hosting.

Sau khi build có thể preview bản production local:

```bash
npx vite preview
```

Vite sẽ phục vụ thư mục `frontend/dist`. Đây là preview local, không phải lệnh deploy production.

## 6. Quy trình kiểm tra trước khi bàn giao

```bash
cd frontend
npm ci
npm run typecheck
npm test
npm run build
```

Nếu các lệnh trên thành công, frontend đã cài dependency, typecheck, test và build được. Việc chạy production thật vẫn cần cấu hình máy chủ/Docker/Nginx riêng.

## 7. Một số lỗi thường gặp

### Sai phiên bản Node

```bash
nvm use
node --version
```

Kết quả cần là `v22.22.2`.

### Không gọi được API

- Kiểm tra backend có chạy ở `127.0.0.1:8080` không.
- Kiểm tra request có bắt đầu bằng `/api` không.
- Kiểm tra proxy trong [`frontend/vite.config.js`](../frontend/vite.config.js).

### Build lỗi do dependency

macOS/Linux:

```bash
cd frontend
rm -rf node_modules
npm ci
npm run build
```

Windows PowerShell:

```powershell
cd frontend
Remove-Item -Recurse -Force node_modules
npm ci
npm run build
```

Windows Command Prompt:

```bat
cd frontend
rmdir /s /q node_modules
npm ci
npm run build
```

## 8. Các lệnh hiện chưa có

Frontend hiện chưa khai báo các script sau:

```bash
npm run start
npm run preview
npm run lint
```

Preview hiện dùng trực tiếp `npx vite preview`. Docker/Nginx và deploy production sẽ được bổ sung sau khi frontend/API được chốt ổn định.
