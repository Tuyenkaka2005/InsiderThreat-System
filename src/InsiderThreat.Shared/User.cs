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
        public string Position { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string Bio { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }

        // Mảng chứa vector khuôn mặt (512 chiều hoặc 128 chiều tùy thuật toán)
        public double[]? FaceEmbeddings { get; set; }

        // E2EE Public Key (Base64 encoded JWK or PEM)
        public string? PublicKey { get; set; }
        public string? PrivateKey { get; set; } // Stored for multi-device sync (protected by PIN)

        public string? ChatAccessCodeHash { get; set; } // Hashed 6-digit code

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}