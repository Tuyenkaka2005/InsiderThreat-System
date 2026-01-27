using System.Management; // Cần thư viện này để bắt USB
using System.Net.Http.Json;
using InsiderThreat.Shared;

namespace InsiderThreat.ClientAgent
{
    public class UsbMonitorService : BackgroundService
    {
        private readonly ILogger<UsbMonitorService> _logger;
        private readonly HttpClient _httpClient;
        private ManagementEventWatcher? _insertWatcher;

        // Cấu hình địa chỉ Server (Sửa lại IP của máy Laptop 2/Server nếu cần)
        private const string SERVER_API_URL = "http://192.168.1.234:5038/api/logs";

        public UsbMonitorService(ILogger<UsbMonitorService> logger, IHttpClientFactory httpClientFactory)
        {
            _logger = logger;
            _httpClient = httpClientFactory.CreateClient();
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("🕵️ AGENT ĐANG CHẠY NGẦM: Bắt đầu giám sát USB...");

            // 1. Cấu hình lắng nghe sự kiện cắm USB (EventType = 2 là Insert)
            var query = new WqlEventQuery("SELECT * FROM Win32_VolumeChangeEvent WHERE EventType = 2");
            _insertWatcher = new ManagementEventWatcher(query);

            // 2. Khi có sự kiện, gọi hàm OnUsbInserted
            _insertWatcher.EventArrived += async (sender, args) => await OnUsbInserted(args);

            _insertWatcher.Start();

            // Giữ cho Service chạy mãi mãi
            while (!stoppingToken.IsCancellationRequested)
            {
                await Task.Delay(1000, stoppingToken);
            }
        }

        private async Task OnUsbInserted(EventArrivedEventArgs e)
        {
            try
            {
                // Lấy tên ổ đĩa (Ví dụ: E:, F:)
                string driveName = e.NewEvent.Properties["DriveName"].Value?.ToString() ?? "Unknown";

                _logger.LogWarning($"⚠️ PHÁT HIỆN USB: Ổ {driveName} vừa được cắm vào!");

                // 3. Tạo Log chuẩn bị gửi đi
                var log = new LogEntry
                {
                    LogType = "USB_INSERT",
                    Severity = "Warning",
                    Message = $"Phát hiện thiết bị lưu trữ ngoại vi tại ổ {driveName}",
                    ComputerName = Environment.MachineName, // Tên máy tính hiện tại
                    IPAddress = "192.168.1.X", // (Tạm thời hardcode hoặc lấy IP thật sau)
                    ActionTaken = "Monitoring",
                    Timestamp = DateTime.Now
                };

                // 4. Gửi lên Server API
                var response = await _httpClient.PostAsJsonAsync(SERVER_API_URL, log);

                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("✅ Đã báo cáo về trụ sở thành công!");
                }
                else
                {
                    _logger.LogError($"❌ Lỗi gửi báo cáo: {response.StatusCode}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Lỗi xử lý USB: {ex.Message}");
            }
        }

        public override void Dispose()
        {
            _insertWatcher?.Stop();
            _insertWatcher?.Dispose();
            base.Dispose();
        }
    }
}