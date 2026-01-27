// ==========================================
// KỊCH BẢN KHỞI TẠO DATABASE: InsiderThreatDB
// Chạy trên Laptop 2 (Admin & DB Host)
// ==========================================

// 1. Chọn Database (Tự động tạo nếu chưa có)
use InsiderThreatDB;

// 2. Dọn dẹp dữ liệu cũ (Cẩn thận: Dòng này sẽ xóa DB cũ nếu chạy lại)
db.dropDatabase();
print("--- Đã xóa dữ liệu cũ ---");

// 3. Tạo Collection: Users (Danh sách nhân viên & Admin)
db.createCollection("Users");
db.Users.insertMany([
    {
        "Username": "admin_main",
        "FullName": "Nguyễn Quản Trị",
        "Role": "Admin",
        "Department": "IT Security",
        "PasswordHash": "hash_password_mac_dinh", // Thực tế sẽ hash bằng SHA256
        "FaceEmbeddings": [], // Chứa vector khuôn mặt (float array)
        "CreatedAt": new Date()
    },
    {
        "Username": "user_ketoan",
        "FullName": "Trần Thu Ngân",
        "Role": "User",
        "Department": "Accounting", // Kế toán
        "FaceEmbeddings": [], 
        "CreatedAt": new Date()
    },
    {
        "Username": "user_sales",
        "FullName": "Lê Doanh Số",
        "Role": "User",
        "Department": "Sales",
        "FaceEmbeddings": [],
        "CreatedAt": new Date()
    }
]);
print("--- Đã tạo 3 Users mẫu ---");

// 4. Tạo Collection: Devices (Quản lý Whitelist USB)
db.createCollection("Devices");
db.Devices.insertMany([
    {
        "DeviceName": "Kingston DataTraveler",
        "SerialNumber": "USB-1234-5678-ABCD", // Serial mẫu
        "Type": "USB",
        "Status": "Allowed", // Được phép dùng
        "AssignedTo": "user_ketoan",
        "RegisteredAt": new Date()
    },
    {
        "DeviceName": "SanDisk Cruzer",
        "SerialNumber": "USB-9999-8888-BAD",
        "Type": "USB",
        "Status": "Blocked", // USB đen
        "AssignedTo": null,
        "RegisteredAt": new Date()
    }
]);
print("--- Đã tạo danh sách thiết bị ---");

// 5. Tạo Collection: Logs (Dữ liệu nhật ký đe dọa)
db.createCollection("Logs");
db.Logs.insertMany([
    {
        "LogType": "USB_INSERT",
        "Severity": "Critical", // Mức độ nghiêm trọng
        "Message": "Phát hiện USB lạ (Serial: USB-UNKNOWN-001) cắm vào máy Kế toán",
        "ComputerName": "LAPTOP-USER-A",
        "IPAddress": "192.168.1.20",
        "ActionTaken": "Blocked",
        "Timestamp": new Date()
    },
    {
        "LogType": "VPN_DETECT",
        "Severity": "Warning",
        "Message": "Phát hiện kết nối VPN trái phép ra ngoài",
        "ComputerName": "LAPTOP-USER-B",
        "IPAddress": "192.168.1.30",
        "ActionTaken": "Connection Dropped",
        "Timestamp": new Date() // Lấy giờ hiện tại
    }
]);
print("--- Đã tạo Log mẫu để Demo Dashboard ---");

// 6. Tạo User cho App C# kết nối (Bảo mật)
// User này chỉ có quyền thao tác trên InsiderThreatDB, không phải Admin root
db.createUser({
    user: "app_connect",
    pwd: "Password@123", // Mật khẩu cho Connection String
    roles: [
        { role: "readWrite", db: "InsiderThreatDB" }
    ]
});
print("--- Đã tạo tài khoản kết nối cho App (User: app_connect) ---");

print("=== KHỞI TẠO HOÀN TẤT THÀNH CÔNG ===");