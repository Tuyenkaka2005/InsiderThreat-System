using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace InsiderThreat.Shared
{
    public class User
    {
        [BsonId] // Định nghĩa đây là khóa chính
        [BsonRepresentation(BsonType.ObjectId)] // Tự động chuyển ObjectId sang string
        public string? Id { get; set; }

        public string Username { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = "User"; // Admin, Manager, User

        // Email for security features
        public string Email { get; set; } = string.Empty;
        public bool EmailVerified { get; set; } = false;

        public string Department { get; set; } = string.Empty;

        // Mảng chứa vector khuôn mặt (512 chiều hoặc 128 chiều tùy thuật toán)
        public double[]? FaceEmbeddings { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}