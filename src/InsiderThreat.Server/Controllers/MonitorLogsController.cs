using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using MongoDB.Driver;
using InsiderThreat.Server.Models;
using InsiderThreat.Server.Hubs;
using System.IO.Compression;
using System.Text.Json;
using System.Text;

namespace InsiderThreat.Server.Controllers
{
    /// <summary>
    /// API controller for receiving and querying monitoring logs from MonitorAgents.
    /// Supports:
    /// - Health check endpoint (for agent connectivity testing)
    /// - Batch log ingestion from agents
    /// - Query endpoints for the admin dashboard
    /// </summary>
    [ApiController]
    [Route("api/threat-monitor")]
    public class InsiderThreatMonitoringController : ControllerBase
    {
        private readonly IMongoCollection<MonitorLog> _monitorLogs;
        private readonly ILogger<InsiderThreatMonitoringController> _logger;
        private readonly IHubContext<NotificationHub> _notificationHub;

        public InsiderThreatMonitoringController(
            IMongoDatabase database, 
            ILogger<InsiderThreatMonitoringController> logger,
            IHubContext<NotificationHub> notificationHub)
        {
            _monitorLogs = database.GetCollection<MonitorLog>("MonitorLogs");
            _logger = logger;
            _notificationHub = notificationHub;
        }

        /// <summary>
        /// Health check endpoint for agents to verify server connectivity.
        /// No authentication required so agents can check before authenticating.
        /// </summary>
        [HttpGet("health")]
        public IActionResult Health()
        {
            return Ok(new { status = "ok", timestamp = DateTime.UtcNow });
        }

        /// <summary>
        /// Receive a batch of monitoring logs from an agent.
        /// Called by the ServerSyncService in the MonitorAgent.
        /// </summary>
        [HttpPost("monitor-batch")]
        public async Task<IActionResult> ReceiveMonitorBatch([FromBody] List<MonitorLog> logs)
        {
            try
            {
                if (logs == null || logs.Count == 0)
                    return BadRequest(new { message = "No logs provided" });

                // Set server-side timestamps and IDs
                foreach (var log in logs)
                {
                    log.Id = null; // Let MongoDB generate IDs
                    if (log.Timestamp == default)
                        log.Timestamp = DateTime.UtcNow;
                }

                await _monitorLogs.InsertManyAsync(logs);

                _logger.LogInformation(
                    "📥 Received {Count} monitor logs from {Machine} ({User})",
                    logs.Count,
                    logs.FirstOrDefault()?.ComputerName ?? "Unknown",
                    logs.FirstOrDefault()?.ComputerUser ?? "Unknown");

                // Log and Broadcast critical alerts
                var criticalLogs = logs.Where(l => l.SeverityScore >= 7).ToList();
                foreach (var critical in criticalLogs)
                {
                    _logger.LogWarning(
                        "🚨 CRITICAL ALERT: [{Score}/10] {Type} on {Machine} - Keyword: {Keyword} | Context: {Context}",
                        critical.SeverityScore,
                        critical.LogType,
                        critical.ComputerName,
                        critical.DetectedKeyword ?? "N/A",
                        critical.MessageContext?.Length > 100
                            ? critical.MessageContext[..100] + "..."
                            : critical.MessageContext ?? "N/A");

                    // Broadcast via SignalR specifically for DocumentLeak
                    if (critical.LogType == "DocumentLeak")
                    {
                        var notif = new Notification
                        {
                            Id = Guid.NewGuid().ToString(),
                            Type = "DocumentLeakAlert", // Custom type for massive popup
                            Message = $"[CẢNH BÁO RÒ RỈ] Máy {critical.ComputerName} vừa chuyển tài liệu mật ra ngoài! Vị trí chép: {critical.ApplicationName}",
                            CreatedAt = DateTime.UtcNow,
                            ActorName = "Hệ thống An ninh",
                            IsRead = false
                        };
                        
                        await _notificationHub.Clients.All.SendAsync("ReceiveNotification", notif);
                    }
                }

                return Ok(new { message = "Logs received", count = logs.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error receiving monitor batch");
                return StatusCode(500, new { message = "Error processing logs", error = ex.Message });
            }
        }

        /// <summary>
        /// Get all monitoring logs with optional filtering.
        /// Used by the admin dashboard.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetMonitorLogs(
            [FromQuery] string? computerName = null,
            [FromQuery] string? computerUser = null,
            [FromQuery] string? logType = null,
            [FromQuery] int? minSeverity = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            try
            {
                var filterBuilder = Builders<MonitorLog>.Filter;
                var filters = new List<FilterDefinition<MonitorLog>>();

                if (!string.IsNullOrEmpty(computerName))
                    filters.Add(filterBuilder.Eq(l => l.ComputerName, computerName));

                if (!string.IsNullOrEmpty(computerUser))
                    filters.Add(filterBuilder.Eq(l => l.ComputerUser, computerUser));

                if (!string.IsNullOrEmpty(logType))
                    filters.Add(filterBuilder.Eq(l => l.LogType, logType));

                if (minSeverity.HasValue)
                    filters.Add(filterBuilder.Gte(l => l.SeverityScore, minSeverity.Value));

                var filter = filters.Count > 0
                    ? filterBuilder.And(filters)
                    : filterBuilder.Empty;

                var totalCount = await _monitorLogs.CountDocumentsAsync(filter);

                var logs = await _monitorLogs
                    .Find(filter)
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
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching monitor logs");
                return StatusCode(500, new { message = "Error fetching logs", error = ex.Message });
            }
        }

        /// <summary>
        /// Get summary statistics for the dashboard.
        /// </summary>
        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            try
            {
                var today = DateTime.UtcNow.Date;

                var totalToday = await _monitorLogs
                    .CountDocumentsAsync(l => l.Timestamp >= today);

                var criticalToday = await _monitorLogs
                    .CountDocumentsAsync(l => l.Timestamp >= today && l.SeverityScore >= 7);

                var screenshotsToday = await _monitorLogs
                    .CountDocumentsAsync(l => l.Timestamp >= today && l.LogType == "Screenshot");

                var keywordsToday = await _monitorLogs
                    .CountDocumentsAsync(l => l.Timestamp >= today && l.LogType == "KeywordDetected");

                var disconnectsToday = await _monitorLogs
                    .CountDocumentsAsync(l => l.Timestamp >= today && l.LogType == "NetworkDisconnect");

                return Ok(new
                {
                    totalToday,
                    criticalToday,
                    screenshotsToday,
                    keywordsToday,
                    disconnectsToday
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching summary");
                return StatusCode(500, new { message = "Error fetching summary", error = ex.Message });
            }
        }

        /// <summary>
        /// Export all logs to a ZIP file and optionally clear the database.
        /// </summary>
        [HttpGet("export-archive")]
        public async Task<IActionResult> ExportArchive([FromQuery] bool clearLogs = false)
        {
            try
            {
                var logs = await _monitorLogs.Find(Builders<MonitorLog>.Filter.Empty).ToListAsync();
                if (logs.Count == 0)
                    return BadRequest(new { message = "No logs to export" });

                var json = JsonSerializer.Serialize(logs, new JsonSerializerOptions { WriteIndented = true });
                byte[] zipData;

                using (var zipStream = new MemoryStream())
                {
                    // No leaveOpen: true here, we WANT the archive to close and finalize the footer
                    using (var archive = new ZipArchive(zipStream, ZipArchiveMode.Create, false))
                    {
                        var entry = archive.CreateEntry($"monitor_logs_backup_{DateTime.Now:yyyyMMdd_HHmmss}.json");
                        using (var entryStream = entry.Open())
                        {
                            byte[] jsonBytes = Encoding.UTF8.GetBytes(json);
                            await entryStream.WriteAsync(jsonBytes, 0, jsonBytes.Length);
                            await entryStream.FlushAsync();
                        }
                    } // ZipArchive DISPOSED here -> Footers written to zipStream

                    zipData = zipStream.ToArray();
                }

                _logger.LogInformation("📦 Exported ZIP Archive: {Count} logs, {Size} bytes", logs.Count, zipData.Length);

                if (clearLogs)
                {
                    await _monitorLogs.DeleteManyAsync(Builders<MonitorLog>.Filter.Empty);
                    _logger.LogWarning("🧹 Database cleared after log export by Admin.");
                }

                var fileName = $"InsiderThreat_Logs_{DateTime.Now:yyyyMMdd_HHmmss}.zip";
                return File(zipData, "application/zip", fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting log archive");
                return StatusCode(500, new { message = "Error exporting archive", error = ex.Message });
            }
        }
    }
}
