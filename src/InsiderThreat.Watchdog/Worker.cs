using System.Diagnostics;
using System.Net.Http.Json;

namespace InsiderThreat.Watchdog;

public class Worker : BackgroundService
{
    private readonly ILogger<Worker> _logger;
    private const string ProcessName = "InsiderThreat.MonitorAgent";
    // Đường dẫn giả định tới file exe của Agent (Cần cấu hình đúng khi deploy)
    private const string AgentPath = @"C:\InsiderThreat-System\InsiderThreat-System\src\InsiderThreat.MonitorAgent\bin\Debug\net8.0\InsiderThreat.MonitorAgent.exe";
    private const string ServerUrl = "http://localhost:5038/api/alerts"; // API để báo cáo vi phạm

    public Worker(ILogger<Worker> logger)
    {
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Watchdog Service started at: {time}", DateTimeOffset.Now);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                CheckAndRestartAgent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in Watchdog loop");
            }

            await Task.Delay(5000, stoppingToken); // Kiểm tra mỗi 5 giây
        }
    }

    private void CheckAndRestartAgent()
    {
        var processes = Process.GetProcessesByName(ProcessName);

        if (processes.Length == 0)
        {
            _logger.LogWarning("⚠️ WARNING: {ProcessName} is NOT running! Restarting...", ProcessName);
            
            if (File.Exists(AgentPath))
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = AgentPath,
                    UseShellExecute = true,
                    CreateNoWindow = false
                });

                _logger.LogInformation("✅ {ProcessName} restarted successfully.", ProcessName);
                
                // Gửi báo cáo về Server (Fire and forget)
                ReportToSerer("Hệ thống giám sát bị tắt bất thường. Watchdog đã tự động khởi động lại.");
            }
            else
            {
                _logger.LogError("❌ ERROR: Agent executable not found at {AgentPath}", AgentPath);
            }
        }
    }

    private async void ReportToSerer(string message)
    {
        try
        {
            using var client = new HttpClient();
            var payload = new 
            { 
                Type = "System", 
                Severity = "Critical", 
                Message = message,
                Timestamp = DateTime.Now
            };
            await client.PostAsJsonAsync(ServerUrl, payload);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Could not report to server: {msg}", ex.Message);
        }
    }
}
