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

    public AttendanceController(IMongoDatabase database)
    {
        _attendanceCollection = database.GetCollection<AttendanceLog>("AttendanceLogs");
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
}
