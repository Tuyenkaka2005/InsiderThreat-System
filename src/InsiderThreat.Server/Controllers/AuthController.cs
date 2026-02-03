using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using InsiderThreat.Shared;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;

namespace InsiderThreat.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IMongoDatabase _database;
    private readonly IMongoCollection<LogEntry> _logsCollection;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IMongoDatabase database, IConfiguration configuration, ILogger<AuthController> logger)
    {
        _database = database;
        _logsCollection = database.GetCollection<LogEntry>("Logs");
        _configuration = configuration;
        _logger = logger;
    }

    // =============================================
    // DTO cho Request/Response
    // =============================================
    public class LoginRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class LoginResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? Token { get; set; }
        public UserInfo? User { get; set; }
    }

    public class UserInfo
    {
        public string Id { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
    }

    // =============================================
    // POST /api/auth/login
    // =============================================
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        try
        {
            // 1. Tìm user trong database
            var usersCollection = _database.GetCollection<User>("Users");
            var user = await usersCollection
                .Find(u => u.Username == request.Username)
                .FirstOrDefaultAsync();

            if (user == null)
            {
                return Unauthorized(new LoginResponse
                {
                    Success = false,
                    Message = "Tên đăng nhập không tồn tại"
                });
            }

            // 2. Kiểm tra mật khẩu với BCrypt
            if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            {
                return Unauthorized(new LoginResponse
                {
                    Success = false,
                    Message = "Mật khẩu không đúng"
                });
            }

            // 3. Tạo JWT Token
            string token = GenerateJwtToken(user);

            _logger.LogInformation($"User '{user.Username}' đăng nhập thành công");

            return Ok(new LoginResponse
            {
                Success = true,
                Message = "Đăng nhập thành công",
                Token = token,
                User = new UserInfo
                {
                    Id = user.Id ?? "",
                    Username = user.Username,
                    FullName = user.FullName,
                    Role = user.Role,
                    AvatarUrl = user.AvatarUrl
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi đăng nhập");
            return StatusCode(500, new LoginResponse
            {
                Success = false,
                Message = "Lỗi hệ thống: " + ex.Message
            });
        }
    }

    [HttpPost("face-login")]
    public async Task<ActionResult<LoginResponse>> FaceLogin([FromBody] double[] descriptor)
    {
        try
        {
            var usersCollection = _database.GetCollection<User>("Users");
            var users = await usersCollection
                .Find(u => u.FaceEmbeddings != null)
                .ToListAsync();

            User? matchedUser = null;
            double minDistance = double.MaxValue;
            double threshold = 0.5; // Stricter threshold for security

            foreach (var user in users)
            {
                var distance = EuclideanDistance(descriptor, user.FaceEmbeddings!);
                if (distance < threshold && distance < minDistance)
                {
                    minDistance = distance;
                    matchedUser = user;
                }
            }

            if (matchedUser == null)
            {
                // Log failure
                var log = new LogEntry
                {
                    LogType = "Auth",
                    Severity = "Warning",
                    Message = "Face Login failed: No matching face found",
                    ComputerName = "WebClient",
                    IPAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown",
                    ActionTaken = "Access Denied",
                    Timestamp = DateTime.Now
                };
                await _logsCollection.InsertOneAsync(log);

                return Unauthorized(new LoginResponse
                {
                    Success = false,
                    Message = "Không nhận diện được khuôn mặt hoặc chưa đăng ký Face ID"
                });
            }

            // Log Attendance
            var attendanceLog = new AttendanceLog
            {
                UserId = matchedUser.Id!,
                UserName = matchedUser.FullName, // Use FullName for display
                CheckInTime = DateTime.Now,
                Method = "FaceID"
            };
            await _database.GetCollection<AttendanceLog>("AttendanceLogs").InsertOneAsync(attendanceLog);

            // Generate Token
            string token = GenerateJwtToken(matchedUser);

            return Ok(new LoginResponse
            {
                Success = true,
                Message = "Đăng nhập Face ID thành công",
                Token = token,
                User = new UserInfo
                {
                    Id = matchedUser.Id ?? "",
                    Username = matchedUser.Username,
                    FullName = matchedUser.FullName,
                    Role = matchedUser.Role,
                    AvatarUrl = matchedUser.AvatarUrl
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi Face Login");
            return StatusCode(500, new LoginResponse { Success = false, Message = ex.Message });
        }
    }

    private static double EuclideanDistance(double[] a, double[] b)
    {
        if (a.Length != b.Length) return double.MaxValue;
        double sum = 0;
        for (int i = 0; i < a.Length; i++)
        {
            sum += Math.Pow(a[i] - b[i], 2);
        }
        return Math.Sqrt(sum);
    }

    // =============================================
    // POST /api/auth/register (Tạm thời để tạo user test)
    // =============================================
    public class RegisterRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = "User";
    }

    // =============================================
    // POST /api/auth/change-password
    // =============================================
    public class ChangePasswordRequest
    {
        public string OldPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var usersCollection = _database.GetCollection<User>("Users");
        var user = await usersCollection.Find(u => u.Id == userId).FirstOrDefaultAsync();
        if (user == null) return NotFound();

        // Check old password
        if (!BCrypt.Net.BCrypt.Verify(request.OldPassword, user.PasswordHash))
        {
            return BadRequest(new { Success = false, Message = "Mật khẩu cũ không đúng" });
        }

        // Hash new password
        var newHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        
        var update = Builders<User>.Update.Set(u => u.PasswordHash, newHash);
        await usersCollection.UpdateOneAsync(u => u.Id == userId, update);

        return Ok(new { Success = true, Message = "Đổi mật khẩu thành công" });
    }

    // =============================================
    // Chat Access Code Endpoints
    // =============================================
    public class SetChatCodeRequest
    {
        public string Code { get; set; } = string.Empty;
        public string? PrivateKey { get; set; }
    }

    [HttpPost("set-chat-code")]
    [Authorize]
    public async Task<IActionResult> SetChatCode([FromBody] SetChatCodeRequest request)
    {
        try
        {
            if (string.IsNullOrEmpty(request.Code) || request.Code.Length != 6 || !request.Code.All(char.IsDigit))
            {
                return BadRequest(new { Success = false, Message = "Code must be 6 digits" });
            }

            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var usersCollection = _database.GetCollection<User>("Users");
            var user = await usersCollection.Find(u => u.Id == userId).FirstOrDefaultAsync();
            if (user == null) return NotFound();

            var hash = BCrypt.Net.BCrypt.HashPassword(request.Code);

            var updateDef = Builders<User>.Update.Set(u => u.ChatAccessCodeHash, hash);
            if (!string.IsNullOrEmpty(request.PrivateKey))
            {
                updateDef = updateDef.Set(u => u.PrivateKey, request.PrivateKey);
            }

            await usersCollection.UpdateOneAsync(u => u.Id == userId, updateDef);

            return Ok(new { Success = true, Message = "Chat access code set successfully" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Success = false, Message = ex.Message });
        }
    }

    public class VerifyCodeRequest { public string Code { get; set; } = string.Empty; }

    [HttpPost("verify-chat-code")]
    [Authorize]
    public async Task<IActionResult> VerifyChatCode([FromBody] VerifyCodeRequest request)
    {
        try
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var usersCollection = _database.GetCollection<User>("Users");
            var user = await usersCollection.Find(u => u.Id == userId).FirstOrDefaultAsync();
            if (user == null) return NotFound();

            if (string.IsNullOrEmpty(user.ChatAccessCodeHash))
            {
                return Ok(new { Success = false, Message = "Code not set", CodeNotSet = true });
            }

            if (BCrypt.Net.BCrypt.Verify(request.Code, user.ChatAccessCodeHash))
            {
                // Return the private key if available so the client can decrypt messages
                return Ok(new { Success = true, Message = "Verified", PrivateKey = user.PrivateKey });
            }

            return Ok(new { Success = false, Message = "Invalid code" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Success = false, Message = ex.Message });
        }
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        try
        {
            var usersCollection = _database.GetCollection<User>("Users");

            // Kiểm tra user đã tồn tại chưa
            var existingUser = await usersCollection
                .Find(u => u.Username == request.Username)
                .FirstOrDefaultAsync();

            if (existingUser != null)
            {
                return BadRequest(new { Success = false, Message = "Username đã tồn tại" });
            }

            // Tạo user mới
            var newUser = new User
            {
                Username = request.Username,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                FullName = request.FullName,
                Role = request.Role,
                CreatedAt = DateTime.Now
            };

            await usersCollection.InsertOneAsync(newUser);

            return Ok(new { Success = true, Message = "Tạo tài khoản thành công" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { Success = false, Message = ex.Message });
        }
    }

    // =============================================
    // Helper Methods
    // =============================================
    private string GenerateJwtToken(User user)
    {
        var jwtSettings = _configuration.GetSection("Jwt");
        var key = Encoding.UTF8.GetBytes(jwtSettings["Key"]!);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id ?? ""),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("FullName", user.FullName)
        };

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddMinutes(double.Parse(jwtSettings["ExpireMinutes"]!)),
            Issuer = jwtSettings["Issuer"],
            Audience = jwtSettings["Audience"],
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature
            )
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }
}
