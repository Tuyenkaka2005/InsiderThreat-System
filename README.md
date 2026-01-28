# Insider Threat Detection System

Hệ thống phát hiện và ngăn chặn mối đe dọa nội bộ (USB, VPN, Web) sử dụng C# và AI.

## 👥 Thành viên nhóm
- **Nguyễn Đăng Tuyền: Leader / Infrastructure
- Bùi Gia Duy: Backend / Admin Dashboard
- Phạm Minh Hiếu: Client Agent / Security Logic
- Nguyễn Tuấn Anh: AI Integration / Tester

## 🚀 Cài đặt và Chạy thử (Local)

### Yêu cầu
- .NET 8 SDK
- MongoDB Community Server
- Visual Studio 2022

### Hướng dẫn
1. Clone repo: `git clone <link-repo>`
2. Cấu hình Database: Mở `src/InsiderThreat.Server/appsettings.json` và chỉnh ConnectionString.
3. Chạy Server:
   ```bash
   cd src/InsiderThreat.Server
   dotnet run

3. **Quy trình làm việc cho từng thành viên**
Mỗi khi bắt đầu code một tính năng mới, các thành viên cần thực hiện đúng các bước sau:

Bước 1: Cập nhật code mới nhất
Trước khi làm gì, hãy đảm bảo máy bạn có code mới nhất từ nhóm:

git checkout develop
git pull origin develop

Bước 2: Tạo nhánh riêng để làm việc

# Ví dụ thành viên C làm về USB
git checkout -b feature/usb-detection

Bước 3: Code và Lưu lại (Commit)
Sau khi viết xong một chức năng (ví dụ: xong phần quét Serial USB):

git add .
git commit -m "Add: USB Serial scanning logic"
git push origin feature/usb-detection

**⚠️Lưu ý:**
- Không bao giờ code thẳng trên main hoặc develop: Luôn tạo nhánh feature.

- Commit nhỏ và thường xuyên: Đừng đợi làm xong cả dự án mới commit. Hãy commit theo từng tính năng nhỏ (ví dụ: xong giao diện, xong kết nối DB).

- Lời nhắn commit rõ ràng: Thay vì ghi "update", hãy ghi "Fix: sửa lỗi nhận diện camera" hoặc "Add: cấu hình MongoDB".
