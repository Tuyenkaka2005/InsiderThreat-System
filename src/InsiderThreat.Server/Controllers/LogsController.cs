using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using InsiderThreat.Shared;
using Microsoft.AspNetCore.SignalR;
using InsiderThreat.Server.Hubs;

namespace InsiderThreat.Server.Controllers
{
    [Route("api/[controller]")] // Đường dẫn sẽ là: api/logs
    [ApiController]
    public class LogsController : ControllerBase
    {
        private readonly IMongoCollection<LogEntry> _logsCollection;
        private readonly IHubContext<SystemHub> _hubContext;
        private readonly ILogger<LogsController> _logger;

        // Inject Database và SignalR Hub vào Controller
        public LogsController(IMongoDatabase database, IHubContext<SystemHub> hubContext, ILogger<LogsController> logger)
        {
            _logsCollection = database.GetCollection<LogEntry>("Logs");
            _hubContext = hubContext;
            _logger = logger;
        }

        // 1. API Gửi Log từ Client lên (POST api/logs)
        [HttpPost]
        public async Task<IActionResult> CreateLog([FromBody] LogEntry newLog)
        {
            // Gán lại giờ server để đảm bảo chính xác
            newLog.Timestamp = DateTime.Now;
            newLog.Id = null; // Để MongoDB tự sinh ID

            await _logsCollection.InsertOneAsync(newLog);

            // Nếu là log USB và bị chặn -> Gửi thông báo real-time cho Admin
            if (newLog.LogType == "USB_INSERT" && newLog.ActionTaken == "Blocked")
            {
                _logger.LogInformation($"Broadcasting USB alert: {newLog.DeviceName}");
                
                await _hubContext.Clients.All.SendAsync("UsbAlert", new
                {
                    deviceId = newLog.DeviceId,
                    deviceName = newLog.DeviceName,
                    computerName = newLog.ComputerName,
                    ipAddress = newLog.IPAddress,
                    timestamp = newLog.Timestamp,
                    message = newLog.Message
                });
            }

            return Ok(new { Message = "Đã ghi nhận Log thành công!", LogId = newLog.Id });
        }

        // 2. API Lấy 10 log mới nhất để hiển thị Dashboard (GET api/logs)
        [HttpGet]
        public async Task<IActionResult> GetRecentLogs()
        {
            var logs = await _logsCollection.Find(_ => true)
                                            .SortByDescending(l => l.Timestamp)
                                            .Limit(10)
                                            .ToListAsync();
            return Ok(logs);
        }
    }
}