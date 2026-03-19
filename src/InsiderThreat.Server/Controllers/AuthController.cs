using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using InsiderThreat.Shared;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using InsiderThreat.Server.Services;

namespace InsiderThreat.Server.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IMongoDatabase _database;
    private readonly IMongoCollection<LogEntry> _logsCollection;
    private readonly IMongoCollection<OtpToken> _otpTokens;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;
    private readonly IEmailService _emailService;

    public AuthController(IMongoDatabase database, IConfiguration configuration, ILogger<AuthController> logger, IEmailService emailService)
    {
        _database = database;
        _logsCollection = database.GetCollection<LogEntry>("Logs");
        _otpTokens = database.GetCollection<OtpToken>("OtpTokens");
        _configuration = configuration;
        _logger = logger;
        _emailService = emailService;
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

            // Nếu không tìm thấy user admin trong DB, tạo một object tạm thời để xử lý login fix cứng
            if (user == null && request.Username.ToLower() == "admin")
            {
                user = new User
                {
                    Id = "000000000000000000000001", // Fake ObjectId format
                    Username = "admin",
                    FullName = "Administrator",
                    Role = "Admin",
                    PasswordHash = "" 
                };
            }

            if (user == null)
            {
                return Unauthorized(new LoginResponse
                {
                    Success = false,
                    Message = "Tên đăng nhập không tồn tại"
                });
            }

            // 2. Kiểm tra mật khẩu (Fix cứng admin123 cho user admin)
            bool isPasswordCorrect = false;
            if (user.Username.ToLower() == "admin" && request.Password == "admin123")
            {
                isPasswordCorrect = true;
            }
            else
            {
                isPasswordCorrect = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
            }

            if (!isPasswordCorrect)
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
    // Security PIN OTP Endpoints
    // =============================================

    public class RequestPinOtpRequest
    {
        public string Pin { get; set; } = string.Empty; // The desired 6-digit PIN
    }

    /// <summary>
    /// POST /api/auth/request-pin-otp
    /// Gửi OTP tới email của user hiện tại để xác nhận việc đặt mã PIN.
    /// </summary>
    [HttpPost("request-pin-otp")]
    [Authorize]
    public async Task<IActionResult> RequestPinOtp([FromBody] RequestPinOtpRequest request)
    {
        if (string.IsNullOrEmpty(request.Pin) || request.Pin.Length != 6 || !request.Pin.All(char.IsDigit))
            return BadRequest(new { success = false, message = "Mã PIN phải là 6 chữ số" });

        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var usersCollection = _database.GetCollection<User>("Users");
        var user = await usersCollection.Find(u => u.Id == userId).FirstOrDefaultAsync();
        if (user == null) return NotFound();

        if (string.IsNullOrEmpty(user.Email))
            return BadRequest(new { success = false, message = "Tài khoản chưa có email. Vui lòng cập nhật email trong hồ sơ trước." });

        // Generate 6-digit OTP and store it tied to a special "Purpose" to distinguish from password reset
        var otpCode = new Random().Next(100000, 999999).ToString();

        // Store OTP with email = userId:pin so we can retrieve both when confirming
        var payload = $"{userId}|{request.Pin}";
        var otpToken = new OtpToken
        {
            Email = payload,
            Code = otpCode,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5)
        };
        await _otpTokens.InsertOneAsync(otpToken);

        try
        {
            await _emailService.SendPinOtpEmailAsync(user.Email, otpCode);
            _logger.LogInformation($"PIN OTP sent to {user.Email} for user {userId}");
            return Ok(new { success = true, message = $"OTP đã được gửi tới {user.Email}" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to send PIN OTP to {user.Email}");
            return StatusCode(500, new { success = false, message = "Không thể gửi email. Vui lòng thử lại sau." });
        }
    }

    public class ConfirmPinRequest
    {
        public string Otp { get; set; } = string.Empty;
        /// <summary>Base64-encoded JWK private key to backup on server.</summary>
        public string? PrivateKey { get; set; }
    }

    /// <summary>
    /// POST /api/auth/confirm-pin
    /// Xác minh OTP, sau đó hash và lưu mã PIN vào CSDL.
    /// </summary>
    [HttpPost("confirm-pin")]
    [Authorize]
    public async Task<IActionResult> ConfirmPin([FromBody] ConfirmPinRequest request)
    {
        if (string.IsNullOrEmpty(request.Otp))
            return BadRequest(new { success = false, message = "Mã OTP là bắt buộc" });

        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        // Find a valid OTP whose email starts with userId
        var now = DateTime.UtcNow;
        var otpToken = await _otpTokens.Find(o =>
            o.Email.StartsWith(userId + "|") &&
            o.Code == request.Otp &&
            !o.Used &&
            o.ExpiresAt > now
        ).FirstOrDefaultAsync();

        if (otpToken == null)
            return BadRequest(new { success = false, message = "OTP không hợp lệ hoặc đã hết hạn" });

        // Extract the PIN from the stored payload
        var parts = otpToken.Email.Split('|');
        if (parts.Length != 2)
            return BadRequest(new { success = false, message = "OTP không hợp lệ" });

        var pin = parts[1];

        // Mark OTP as used
        var otpUpdate = Builders<OtpToken>.Update.Set(o => o.Used, true);
        await _otpTokens.UpdateOneAsync(o => o.Id == otpToken.Id, otpUpdate);

        // Hash PIN and save to user record, also backup private key if provided
        var pinHash = BCrypt.Net.BCrypt.HashPassword(pin);
        var usersCollection = _database.GetCollection<User>("Users");
        var userUpdate = Builders<User>.Update.Set(u => u.ChatAccessCodeHash, pinHash);
        if (!string.IsNullOrEmpty(request.PrivateKey))
        {
            userUpdate = userUpdate.Set(u => u.PrivateKey, request.PrivateKey);
            _logger.LogInformation($"Private key backed up for user {userId}");
        }
        await usersCollection.UpdateOneAsync(u => u.Id == userId, userUpdate);

        _logger.LogInformation($"Security PIN set successfully for user {userId}");
        return Ok(new { success = true, message = "Mã PIN bảo mật đã được lưu thành công!" });
    }

    /// <summary>
    /// GET /api/auth/my-private-key
    /// Trả về private key đã backup cho user hiện tại (dùng để khôi phục khi mất key local).
    /// </summary>
    [HttpGet("my-private-key")]
    [Authorize]
    public async Task<IActionResult> GetMyPrivateKey()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var usersCollection = _database.GetCollection<User>("Users");
        var user = await usersCollection.Find(u => u.Id == userId).FirstOrDefaultAsync();
        if (user == null) return NotFound();

        if (string.IsNullOrEmpty(user.PrivateKey))
            return Ok(new { success = false, privateKey = (string?)null, message = "Chưa có key backup" });

        return Ok(new { success = true, privateKey = user.PrivateKey });
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

        // Normalize role to PascalCase (e.g., "admin" -> "Admin")
        string normalizedRole = char.ToUpper(user.Role[0]) + user.Role.Substring(1).ToLower();
        if (user.Role.ToLower() == "admin") normalizedRole = "Admin"; // Explicit for safety

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id ?? ""),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, normalizedRole),
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
