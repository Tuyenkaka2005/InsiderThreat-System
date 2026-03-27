using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using InsiderThreat.Server.Models;
using System.IO.Compression;
using System.Text.Json;

namespace InsiderThreat.Server.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/threat-monitor")]
    public class MonitorLogsController : ControllerBase
    {
        private readonly IMongoCollection<MonitorLog> _logs;
        private readonly IMongoCollection<SharedDocument> _documents;
        private readonly ILogger<MonitorLogsController> _logger;

        public MonitorLogsController(IMongoDatabase database, ILogger<MonitorLogsController> logger)
        {
            _logs = database.GetCollection<MonitorLog>("MonitorLogs");
            _documents = database.GetCollection<SharedDocument>("SharedDocuments");
            _logger = logger;
        }

        [HttpGet("health")]
        [AllowAnonymous]
        public IActionResult Health() => Ok(new { status = "online", time = DateTime.UtcNow });

        [HttpGet]
        public async Task<ActionResult<object>> GetLogs(
            [FromQuery] string? computerName, 
            [FromQuery] string? computerUser,
            [FromQuery] string? logType,
            [FromQuery] int? minSeverity,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 100)
        {
            var filterBuilder = Builders<MonitorLog>.Filter;
            var filter = filterBuilder.Empty;

            if (!string.IsNullOrEmpty(computerName))
                filter &= filterBuilder.Regex(l => l.ComputerName, new MongoDB.Bson.BsonRegularExpression(computerName, "i"));
            
            if (!string.IsNullOrEmpty(computerUser) && computerUser != "Unknown")
                filter &= filterBuilder.Regex(l => l.ComputerUser, new MongoDB.Bson.BsonRegularExpression(computerUser, "i"));

            if (!string.IsNullOrEmpty(logType))
                filter &= filterBuilder.Eq(l => l.LogType, logType);

            if (minSeverity.HasValue)
                filter &= filterBuilder.Gte(l => l.SeverityScore, minSeverity.Value);

            var totalCount = await _logs.CountDocumentsAsync(filter);
            var logs = await _logs.Find(filter)
                .SortByDescending(l => l.Timestamp)
                .Skip((page - 1) * pageSize)
                .Limit(pageSize)
                .ToListAsync();

            return Ok(new 
            { 
                data = logs, 
                totalCount, 
                page, 
                pageSize,
                totalPages = (int)Math.Ceiling((double)totalCount / pageSize)
            });
        }

        [HttpGet("summary")]
        public async Task<ActionResult<MonitorSummary>> GetSummary()
        {
            var today = DateTime.UtcNow.Date;
            var filterToday = Builders<MonitorLog>.Filter.Gte(l => l.Timestamp, today);

            var logsToday = await _logs.Find(filterToday).ToListAsync();

            var summary = new MonitorSummary
            {
                TotalToday = logsToday.Count,
                CriticalToday = logsToday.Count(l => l.SeverityScore >= 7),
                ScreenshotsToday = logsToday.Count(l => l.LogType == "Screenshot"),
                KeywordsToday = logsToday.Count(l => l.LogType == "KeywordDetected"),
                DisconnectsToday = logsToday.Count(l => l.LogType == "NetworkDisconnect")
            };

            return Ok(summary);
        }

        [HttpGet("export-archive")]
        public async Task<IActionResult> ExportArchive([FromQuery] bool clearLogs = false)
        {
            try
            {
                var allLogs = await _logs.Find(_ => true).SortByDescending(l => l.Timestamp).ToListAsync();
                var json = JsonSerializer.Serialize(allLogs, new JsonSerializerOptions { WriteIndented = true });

                using var ms = new MemoryStream();
                using (var archive = new ZipArchive(ms, ZipArchiveMode.Create, true))
                {
                    var entry = archive.CreateEntry($"monitor_logs_backup_{DateTime.Now:yyyyMMdd_HHmm}.json");
                    using var entryStream = entry.Open();
                    using var writer = new StreamWriter(entryStream);
                    await writer.WriteAsync(json);
                }

                ms.Position = 0;
                var fileName = $"InsiderThreat_Logs_{DateTime.Now:yyyyMMdd_HHmm}.zip";

                if (clearLogs && allLogs.Count > 0)
                {
                    await _logs.DeleteManyAsync(_ => true);
                    _logger.LogInformation($"Cleared {allLogs.Count} logs after successful export.");
                }

                return File(ms.ToArray(), "application/zip", fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting logs archive");
                return StatusCode(500, "Error exporting archive: " + ex.Message);
            }
        }

        [HttpPost("monitor-batch")]
        [AllowAnonymous]
        public async Task<IActionResult> PostBatch([FromBody] List<MonitorLog> logs)
        {
            if (logs == null || logs.Count == 0) return BadRequest("Empty batch");

            try
            {
                // Escalate severity for Restricted documents
                foreach (var log in logs)
                {
                    if (!string.IsNullOrEmpty(log.DetectedKeyword))
                    {
                        var doc = await _documents.Find(d => d.Id == log.DetectedKeyword).FirstOrDefaultAsync();
                        if (doc?.SecurityLevel == "Restricted")
                        {
                            log.SeverityScore = 10;
                            log.MessageContext = "[TUYỆT MẬT] " + log.MessageContext;
                        }
                    }
                }

                await _logs.InsertManyAsync(logs);
                _logger.LogInformation($"Successfully received batch of {logs.Count} logs from Agent.");
                return Ok(new { count = logs.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error inserting batch logs");
                return StatusCode(500, "Error inserting batch: " + ex.Message);
            }
        }
    }
}
