using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using InsiderThreat.Shared;
using InsiderThreat.Server.Services;

namespace InsiderThreat.Server.Controllers;

public class ForgotPasswordRequest
{
    public string Email { get; set; } = string.Empty;
}

public class VerifyOtpRequest
{
    public string Email { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}

public class ResetPasswordRequest
{
    public string OtpTokenId { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

[Route("api/auth")]
[ApiController]
public class PasswordResetController : ControllerBase
{
    private readonly IMongoCollection<User> _users;
    private readonly IMongoCollection<OtpToken> _otpTokens;
    private readonly IEmailService _emailService;
    private readonly ILogger<PasswordResetController> _logger;

    public PasswordResetController(
        IMongoDatabase database,
        IEmailService emailService,
        ILogger<PasswordResetController> logger)
    {
        _users = database.GetCollection<User>("Users");
        _otpTokens = database.GetCollection<OtpToken>("OtpTokens");
        _emailService = emailService;
        _logger = logger;
    }

    // POST /api/auth/forgot-password
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        if (string.IsNullOrEmpty(request.Email))
            return BadRequest(new { message = "Email là bắt buộc" });

        var user = await _users.Find(u => u.Email == request.Email).FirstOrDefaultAsync();
        if (user == null)
        {
            _logger.LogWarning($"Forgot password attempt for non-existent email: {request.Email}");
            // Don't reveal if email exists or not (security best practice)
            return Ok(new { message = "Nếu email tồn tại, OTP đã được gửi đến hộp thư của bạn" });
        }

        // Generate 6-digit OTP
        var otpCode = new Random().Next(100000, 999999).ToString();

        var otpToken = new OtpToken
        {
            Email = request.Email,
            Code = otpCode,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5)
        };

        await _otpTokens.InsertOneAsync(otpToken);

        try
        {
            await _emailService.SendOtpEmailAsync(request.Email, otpCode);
            _logger.LogInformation($"OTP generated for {request.Email}");
            return Ok(new { message = "OTP đã được gửi đến email của bạn" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to send OTP email to {request.Email}");
            return StatusCode(500, new { message = "Không thể gửi email. Vui lòng thử lại sau." });
        }
    }

    // POST /api/auth/verify-otp
    [HttpPost("verify-otp")]
    public async Task<IActionResult> VerifyOtp([FromBody] VerifyOtpRequest request)
    {
        if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Code))
            return BadRequest(new { message = "Email và OTP là bắt buộc" });

        var otpToken = await _otpTokens.Find(o =>
            o.Email == request.Email &&
            o.Code == request.Code &&
            !o.Used &&
            o.ExpiresAt > DateTime.UtcNow
        ).FirstOrDefaultAsync();

        if (otpToken == null)
        {
            _logger.LogWarning($"Invalid OTP attempt for email: {request.Email}");
            return BadRequest(new { message = "OTP không hợp lệ hoặc đã hết hạn" });
        }

        // Mark as used
        var update = Builders<OtpToken>.Update.Set(o => o.Used, true);
        await _otpTokens.UpdateOneAsync(o => o.Id == otpToken.Id, update);

        _logger.LogInformation($"OTP verified successfully for {request.Email}");
        return Ok(new { message = "OTP hợp lệ", token = otpToken.Id });
    }

    // POST /api/auth/reset-password
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrEmpty(request.OtpTokenId) || string.IsNullOrEmpty(request.NewPassword))
            return BadRequest(new { message = "Token và mật khẩu mới là bắt buộc" });

        if (request.NewPassword.Length < 6)
            return BadRequest(new { message = "Mật khẩu phải có ít nhất 6 ký tự" });

        var otpToken = await _otpTokens.Find(o => o.Id == request.OtpTokenId && o.Used).FirstOrDefaultAsync();
        if (otpToken == null)
        {
            _logger.LogWarning($"Invalid token for password reset: {request.OtpTokenId}");
            return BadRequest(new { message = "Token không hợp lệ" });
        }

        // Check if token is still valid (within 10 minutes of creation)
        if (otpToken.CreatedAt.AddMinutes(10) < DateTime.UtcNow)
        {
            return BadRequest(new { message = "Token đã hết hạn. Vui lòng yêu cầu OTP mới." });
        }

        var user = await _users.Find(u => u.Email == otpToken.Email).FirstOrDefaultAsync();
        if (user == null)
            return NotFound(new { message = "Người dùng không tồn tại" });

        // Hash new password
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        var update = Builders<User>.Update.Set(u => u.PasswordHash, passwordHash);
        await _users.UpdateOneAsync(u => u.Id == user.Id, update);

        _logger.LogInformation($"Password reset successfully for user: {user.Username}");
        return Ok(new { message = "Mật khẩu đã được reset thành công" });
    }
}
