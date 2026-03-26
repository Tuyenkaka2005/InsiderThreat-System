# Insider Threat Detection System

Hệ thống mạng xã hội, nhắn tin E2EE mã hóa đầu cuối và phát hiện/ ngăn chặn mối đe dọa nội bộ (USB, VPN, Web) sử dụng C# và Web App.

## 👥 Thành viên nhóm
- **Nguyễn Đăng Tuyền**: Leader / Infrastructure
- **Bùi Gia Duy**: Backend / Admin Dashboard / Desktop App Integration
- **Phạm Minh Hiếu**: Client Agent / Security Logic
- **Nguyễn Tuấn Anh**: AI Integration / Tester

---

## 🚀 Hướng Dẫn Cài Đặt và Khởi Chạy Ứng Dụng (Môi trường Phát triển)

### 1. Yêu cầu Hệ thống
Để chạy và chỉnh sửa mã nguồn, máy tính của bạn cần cài đặt sẵn các thành phần sau:
- **Node.js**: Phiên bản 20.x trở lên.
- **.NET 8 SDK**: Bắt buộc để chạy Backend C#.
- **MongoDB**: Máy chủ CSDL chạy cục bộ trên máy, hoặc kết nối thông qua URL Atlas.
- **Tauri / Rust Build Tools**: (Tùy chọn) Chỉ khi bạn muốn Compile (Build) ra file `.exe`.

### 2. Cài đặt Kho Lưu Trữ (Clone Repository)
Mở Terminal / PowerShell và tải bộ mã nguồn về:
```bash
git clone https://github.com/Tuyenkaka2005/InsiderThreat-System.git
cd InsiderThreat-System/src
```

### 3. Cấu hình và Chạy Máy Chủ Backend (API & WebSocket)
Máy chủ C# sẽ đảm nhận vai trò quản lý Database, xử lý Logic mã hóa và gửi tin nhắn thời gian thực.
```bash
cd InsiderThreat.Server

# Khôi phục các gói thư viện
dotnet restore

# Chạy máy chủ (Mặc định sẽ chạy tại http://127.0.0.1:5038)
dotnet run
```
*Lưu ý: Mở file `appsettings.json` để thay đổi chuỗi kết nối MongoDB nếu bạn không dùng Server mặc định.*

### 4. Cài đặt và Chạy Giao Diện Mạng Xã Hội (Frontend)
Mở một cửa sổ Terminal **MỚI**, trỏ vào thư mục Web và chạy giao diện Vite React:
```bash
cd InsiderThreat.Web

# Cài đặt các gói thư viện Node
npm install

# Chạy giao diện Web cục bộ
npm run dev
```

Truy cập `http://localhost:5173` để trải nghiệm phiên bản web. Đăng nhập bằng tài khoản Administrator mặc định: `admin / admin123`.

---

## 🛠 Hướng Dẫn Đóng Gói Ứng Dụng (.EXE Installer)

Dự án này sử dụng cấu trúc **Sidecar (Tauri)** để nhúng Backend API và USB Agent chạy ngầm cùng với giao diện Frontend nhằm tạo ra một app Desktop hoàn chỉnh.

### Bước 1: Build các Project C# thành file thực thi độc lập (Native)
Việc này nhằm chuẩn bị các file Binary siêu nhỏ để Tauri gói lại. Mở PowerShell tại Folder gốc:
```powershell
# Build Backend Server
cd src/InsiderThreat.Server
dotnet publish -c Release -p:PublishSingleFile=true -p:PublishReadyToRun=true --self-contained true -r win-x64 -o ../InsiderThreat.Web/src-tauri/bin/

# Build Client Agent (USB Blocker)
cd ../InsiderThreat.ClientAgent
dotnet publish -c Release -p:PublishSingleFile=true -p:PublishReadyToRun=true --self-contained true -r win-x64 -o ../InsiderThreat.Web/src-tauri/bin/
```
*Bạn cần đổi tên 2 file `.exe` sinh ra thành `InsiderThreat.Server-x86_64-pc-windows-msvc.exe` và `InsiderThreat.ClientAgent-x86_64-pc-windows-msvc.exe` bên trong thư mục `bin`.*

### Bước 2: Biên dịch và Đóng gói Tauri App
Mở cửa sổ Terminal tại `src/InsiderThreat.Web`:
```bash
# Phải đảm bảo đã cài C++ Build Tools và Rust trước khi chạy:
npm run tauri build
```
Đợi quá trình đóng gói hoàn tất. Bộ cài NSIS hoàn chỉnh sẽ xuất hiện tại đường dẫn: 
`src/InsiderThreat.Web/src-tauri/target/release/bundle/nsis/InsiderThreat_0.1.0_x64-setup.exe`

---

## 🛡 Tính Năng Gỡ Cài Đặt An Toàn
Ứng dụng được thiết kế đính kèm với một hệ thống kiểm soát quyền gỡ cài đặt (Custom NSIS Uninstaller). Khi người dùng thực hiện Uninstall:
1. Hệ thống yêu cầu cung cấp Admin Password.
2. Ứng dụng khôi phục quyền truy cập toàn bộ Thiết bị USB/Lưu trữ.
3. Kịch bản Tự sát sẽ ép tắt toàn bộ tiến trình chạy ngầm trước khi quét sạch File và Logs khỏi Windows.
