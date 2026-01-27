using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using InsiderThreat.Shared;

namespace InsiderThreat.Server.Controllers
{
    [Route("api/[controller]")] // Đường dẫn sẽ là: api/logs
    [ApiController]
    public class LogsController : ControllerBase
    {
        private readonly IMongoCollection<LogEntry> _logsCollection;

        // Inject Database vào Controller
        public LogsController(IMongoDatabase database)
        {
            _logsCollection = database.GetCollection<LogEntry>("Logs");
        }

        // 1. API Gửi Log từ Client lên (POST api/logs)
        [HttpPost]
        public async Task<IActionResult> CreateLog([FromBody] LogEntry newLog)
        {
            // Gán lại giờ server để đảm bảo chính xác
            newLog.Timestamp = DateTime.Now;
            newLog.Id = null; // Để MongoDB tự sinh ID

            await _logsCollection.InsertOneAsync(newLog);

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