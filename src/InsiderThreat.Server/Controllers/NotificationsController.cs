using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using InsiderThreat.Shared;
using System.Security.Claims;

namespace InsiderThreat.Server.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class NotificationsController : ControllerBase
{
    private readonly IMongoCollection<Notification> _notifications;
    private readonly IMongoCollection<User> _users;

    public NotificationsController(IMongoDatabase database)
    {
        _notifications = database.GetCollection<Notification>("Notifications");
        _users = database.GetCollection<User>("Users");
    }

    // GET: api/notifications
    // Get notifications relevant to the current user (Global + Personal)
    [HttpGet]
    public async Task<ActionResult<List<Notification>>> GetNotifications()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        
        // Filter: Type == "Global" OR TargetUserId == userId
        var filter = Builders<Notification>.Filter.Or(
            Builders<Notification>.Filter.Eq(n => n.Type, "Global"),
            Builders<Notification>.Filter.Eq(n => n.TargetUserId, userId)
        );

        var notifications = await _notifications.Find(filter)
            .SortByDescending(n => n.CreatedAt)
            .Limit(20)
            .ToListAsync();

        return Ok(notifications);
    }

    // POST: api/notifications (Admin only)
    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<ActionResult<Notification>> CreateNotification([FromBody] Notification notification)
    {
        notification.Id = null;
        notification.CreatedAt = DateTime.Now;
        
        await _notifications.InsertOneAsync(notification);
        return CreatedAtAction(nameof(GetNotifications), new { id = notification.Id }, notification);
    }
}
