using System.Net;
using System.Net.Mail;

namespace InsiderThreat.Server.Services;

public interface IEmailService
{
    Task SendOtpEmailAsync(string toEmail, string otpCode);
}

public class EmailService : IEmailService
{
    private readonly string _smtpHost;
    private readonly int _smtpPort;
    private readonly string _fromEmail;
    private readonly string _fromPassword;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration config, ILogger<EmailService> logger)
    {
        _smtpHost = config["Email:SmtpHost"] ?? "smtp.gmail.com";
        _smtpPort = int.Parse(config["Email:SmtpPort"] ?? "587");
        _fromEmail = config["Email:FromEmail"] ?? "";
        _fromPassword = config["Email:Password"] ?? "";
        _logger = logger;
    }

    public async Task SendOtpEmailAsync(string toEmail, string otpCode)
    {
        try
        {
            var subject = "🔐 InsiderThreat System - OTP Verification";
            var body = $@"
                <html>
                <body style='font-family: Arial, sans-serif;'>
                    <div style='max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;'>
                        <div style='background-color: white; padding: 30px; border-radius: 8px;'>
                            <h2 style='color: #1890ff; margin-bottom: 20px;'>🔐 Mã OTP Xác Thực</h2>
                            <p style='font-size: 16px; color: #333;'>Bạn đã yêu cầu reset mật khẩu. Sử dụng mã OTP sau:</p>
                            <div style='background-color: #f0f2f5; padding: 20px; border-radius: 4px; text-align: center; margin: 20px 0;'>
                                <h1 style='color: #1890ff; font-size: 36px; letter-spacing: 8px; margin: 0;'>{otpCode}</h1>
                            </div>
                            <p style='font-size: 14px; color: #666;'>Mã có hiệu lực trong <strong>5 phút</strong>.</p>
                            <hr style='border: none; border-top: 1px solid #e8e8e8; margin: 20px 0;' />
                            <p style='font-size: 12px; color: #999;'>Nếu bạn không yêu cầu reset mật khẩu, vui lòng bỏ qua email này.</p>
                        </div>
                    </div>
                </body>
                </html>
            ";

            using var message = new MailMessage(_fromEmail, toEmail, subject, body)
            {
                IsBodyHtml = true
            };

            using var smtpClient = new SmtpClient(_smtpHost, _smtpPort)
            {
                Credentials = new NetworkCredential(_fromEmail, _fromPassword),
                EnableSsl = true
            };

            await smtpClient.SendMailAsync(message);
            _logger.LogInformation($"OTP email sent successfully to {toEmail}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to send OTP email to {toEmail}");
            throw;
        }
    }
}
