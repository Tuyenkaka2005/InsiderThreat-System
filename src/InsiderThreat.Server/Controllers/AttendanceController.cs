using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using InsiderThreat.Shared;
using System.Security.Claims;

namespace InsiderThreat.Server.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class AttendanceController : ControllerBase
{
    private readonly IMongoCollection<AttendanceLog> _attendanceCollection;
    private readonly IMongoCollection<AttendanceConfig> _configCollection;

    public AttendanceController(IMongoDatabase database)
    {
        _attendanceCollection = database.GetCollection<AttendanceLog>("AttendanceLogs");
        _configCollection = database.GetCollection<AttendanceConfig>("AttendanceConfig");
    }

    // POST: api/attendance/checkin
    [HttpPost("checkin")]
    public async Task<IActionResult> CheckIn([FromBody] AttendanceLog log)
    {
        log.Id = null; // Ensure new ID
        log.CheckInTime = DateTime.Now;

        // If UserId is not provided, try to get from claims (logged in user)
        if (string.IsNullOrEmpty(log.UserId))
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var userName = User.FindFirst(ClaimTypes.Name)?.Value;

            if (userId != null)
            {
                log.UserId = userId;
                log.UserName = userName ?? "Unknown";
            }
        }

        await _attendanceCollection.InsertOneAsync(log);

        return Ok(new { Message = "Check-in successful", Time = log.CheckInTime });
    }

    // GET: api/attendance/history
    [HttpGet("history")]
    public async Task<ActionResult<List<AttendanceLog>>> GetHistory()
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (role == "Admin")
        {
            // Admin sees all, sorted by new
            var logs = await _attendanceCollection.Find(_ => true)
                .SortByDescending(x => x.CheckInTime)
                .ToListAsync();
            return Ok(logs);
        }
        else
        {
            // User sees own
            if (userId == null) return Unauthorized();

            var logs = await _attendanceCollection.Find(x => x.UserId == userId)
                .SortByDescending(x => x.CheckInTime)
                .ToListAsync();
            return Ok(logs);
        }
    }

    // GET: api/attendance/config
    [HttpGet("config")]
    public async Task<IActionResult> GetConfig()
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        if (role != "Admin") return Forbid();

        var config = await _configCollection.Find(c => c.ConfigType == "NetworkSettings").FirstOrDefaultAsync();
        if (config == null)
        {
            config = new AttendanceConfig { AllowedIPs = "" };
        }
        return Ok(config);
    }

    // POST: api/attendance/config
    [HttpPost("config")]
    public async Task<IActionResult> UpdateConfig([FromBody] AttendanceConfig newConfig)
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        var userName = User.FindFirst(ClaimTypes.Name)?.Value ?? "Unknown";
        if (role != "Admin") return Forbid();

        var filter = Builders<AttendanceConfig>.Filter.Eq(c => c.ConfigType, "NetworkSettings");
        var existing = await _configCollection.Find(filter).FirstOrDefaultAsync();

        if (existing == null)
        {
            newConfig.ConfigType = "NetworkSettings";
            newConfig.UpdatedAt = DateTime.Now;
            newConfig.UpdatedBy = userName;
            await _configCollection.InsertOneAsync(newConfig);
        }
        else
        {
            var update = Builders<AttendanceConfig>.Update
                .Set(c => c.AllowedIPs, newConfig.AllowedIPs)
                .Set(c => c.UpdatedAt, DateTime.Now)
                .Set(c => c.UpdatedBy, userName);
            await _configCollection.UpdateOneAsync(filter, update);
        }

        return Ok(new { Message = "Configuration updated successfully" });
    }

    // GET: api/attendance/can-checkin
    [HttpGet("can-checkin")]
    public async Task<IActionResult> CanCheckIn()
    {
        var currentIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "Unknown";

        // localhost checking (IPv6 ::1 mapped to 127.0.0.1 for local testing ease if needed, though RemoteIpAddress will show ::1 or 127.0.0.1)
        if (currentIp == "::1") currentIp = "127.0.0.1";

        var config = await _configCollection.Find(c => c.ConfigType == "NetworkSettings").FirstOrDefaultAsync();
        
        bool canCheckIn = true; // default true if no config restriction is set
        
        if (config != null && !string.IsNullOrWhiteSpace(config.AllowedIPs))
        {
            var allowedIps = config.AllowedIPs.Split(new[] { ',', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
                                                .Select(ip => ip.Trim())
                                                .ToList();

            // Support prefix matching (e.g., "192.168.1." will match "192.168.1.25")
            if (!allowedIps.Any(ip => currentIp.StartsWith(ip)))
            {
                canCheckIn = false;
            }
        }

        return Ok(new { canCheckIn, currentIp, restrictionEnabled = config != null && !string.IsNullOrWhiteSpace(config.AllowedIPs) });
    }

    // GET: api/attendance/active-networks
    [HttpGet("active-networks")]
    public IActionResult GetActiveNetworks()
    {
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        if (role != "Admin") return Forbid();

        var networks = new List<object>();
        var currentIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        if (currentIp == "::1") currentIp = "127.0.0.1";

        string GetPrefix(string ip) => ip.Contains('.') ? ip.Substring(0, ip.LastIndexOf('.') + 1) : ip;

        networks.Add(new {
            Id = "client-ip",
            Name = "Mạng thiết bị của bạn",
            IpAddress = currentIp,
            Prefix = GetPrefix(currentIp)
        });

        try
        {
            var interfaces = System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces()
                .Where(n => n.OperationalStatus == System.Net.NetworkInformation.OperationalStatus.Up &&
                            n.NetworkInterfaceType != System.Net.NetworkInformation.NetworkInterfaceType.Loopback);

            foreach (var adapter in interfaces)
            {
                var ipProps = adapter.GetIPProperties();
                var ipv4 = ipProps.UnicastAddresses.FirstOrDefault(a => a.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork);
                if (ipv4 != null)
                {
                    networks.Add(new {
                        Id = adapter.Id,
                        Name = $"Mạng máy chủ ({adapter.Name})",
                        IpAddress = ipv4.Address.ToString(),
                        Prefix = GetPrefix(ipv4.Address.ToString())
                    });
                }
            }
        }
        catch (Exception) { }

        // Deduplicate by IP to avoid showing client IP and server IP twice if they are the same
        var uniqueNetworks = networks.GroupBy(n => ((dynamic)n).IpAddress).Select(g => g.First()).ToList();

        return Ok(uniqueNetworks);
    }
}
