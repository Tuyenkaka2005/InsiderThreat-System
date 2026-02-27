using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using MongoDB.Driver;
using InsiderThreat.Server.Models;
using InsiderThreat.Server.Hubs;
using InsiderThreat.Shared;

namespace InsiderThreat.Server.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class MessagesController : ControllerBase
{
    private readonly IMongoCollection<Message> _messagesCollection;
    private readonly IMongoCollection<InsiderThreat.Shared.User> _users;
    private readonly ILogger<MessagesController> _logger;
    private readonly NotificationsController _notificationsController;
    private readonly IHubContext<NotificationHub> _hubContext;

    public MessagesController(IMongoDatabase database, ILogger<MessagesController> logger, IHubContext<NotificationHub> hubContext)
    {
        _messagesCollection = database.GetCollection<Message>("Messages");
        _users = database.GetCollection<InsiderThreat.Shared.User>("Users");
        _logger = logger;
        _hubContext = hubContext;
        _notificationsController = new NotificationsController(database, hubContext);
    }

    // POST: api/messages
    [HttpPost]
    public async Task<ActionResult<Message>> SendMessage(Message message)
    {
        try
        {
            // Enforce SenderId matches authenticated user (if needed, but trust client for prototype)
            // message.SenderId = User.FindFirst("id")?.Value; 

            message.Timestamp = DateTime.UtcNow;
            message.IsRead = false;

            await _messagesCollection.InsertOneAsync(message);

            // Fetch sender name
            var sender = await _users.Find(u => u.Id == message.SenderId).FirstOrDefaultAsync();
            var senderName = sender?.FullName ?? sender?.Username ?? "Someone";

            // Push Notification (Content is encrypted, so we just show a generic message)
            var previewText = !string.IsNullOrEmpty(message.AttachmentType)
                ? (message.AttachmentType == "image" ? "[Hình ảnh]" : "[Tệp đính kèm]")
                : "Đã gửi một tin nhắn mới";

            await _notificationsController.CreateSocialNotification(
                type: "Message",
                targetUserId: message.ReceiverId,
                message: $"{senderName}: {previewText}",
                actorUserId: message.SenderId,
                actorName: senderName,
                link: $"/chat?userId={message.SenderId}", // Navigate straight to the chat with this user
                relatedId: message.Id
            );

            // Return Ok to avoid "No route matches" errors with CreatedAtAction
            return Ok(message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending message");
            return StatusCode(500, new { Message = "Internal Server Error", Error = ex.Message });
        }
    }

    // GET: api/messages/{otherUserId}
    // Get conversation with a specific user
    [HttpGet("{otherUserId}")]
    public async Task<ActionResult<List<Message>>> GetMessages(string otherUserId, [FromQuery] string currentUserId)
    {
        // Fetch messages where (Sender=Me AND Receiver=Other) OR (Sender=Other AND Receiver=Me)
        var filter = Builders<Message>.Filter.Or(
            Builders<Message>.Filter.And(
                Builders<Message>.Filter.Eq(m => m.SenderId, currentUserId),
                Builders<Message>.Filter.Eq(m => m.ReceiverId, otherUserId)
            ),
            Builders<Message>.Filter.And(
                Builders<Message>.Filter.Eq(m => m.SenderId, otherUserId),
                Builders<Message>.Filter.Eq(m => m.ReceiverId, currentUserId)
            )
        );

        var sort = Builders<Message>.Sort.Ascending(m => m.Timestamp);

        var messages = await _messagesCollection
            .Find(filter)
            .Sort(sort)
            .ToListAsync();

        return Ok(messages);
    }

    // GET: api/messages/conversations
    // Get list of conversations with unread counts and last message details
    [HttpGet("conversations")]
    public async Task<ActionResult<IEnumerable<object>>> GetConversations([FromQuery] string userId)
    {
        if (string.IsNullOrEmpty(userId)) return BadRequest("User ID is required");

        // 1. Fetch all messages involving this user
        var filter = Builders<Message>.Filter.Or(
            Builders<Message>.Filter.Eq(m => m.SenderId, userId),
            Builders<Message>.Filter.Eq(m => m.ReceiverId, userId)
        );

        var messages = await _messagesCollection
            .Find(filter)
            .SortByDescending(m => m.Timestamp)
            .ToListAsync();

        // 2. Group by the "Other User"
        var conversations = new Dictionary<string, object>();
        var userIdsToFetch = new HashSet<string>();

        foreach (var m in messages)
        {
            var otherUserId = m.SenderId == userId ? m.ReceiverId : m.SenderId;
            userIdsToFetch.Add(otherUserId);

            if (!conversations.ContainsKey(otherUserId))
            {
                conversations[otherUserId] = new
                {
                    ContactId = otherUserId,
                    LastMessage = string.IsNullOrEmpty(m.AttachmentType) ? "Đã gửi tin nhắn" : (m.AttachmentType == "image" ? "[Hình ảnh]" : "[Tệp đính kèm]"),
                    LastMessageTime = m.Timestamp,
                    // Unread count: Messages where I am the receiver and it's not read
                    UnreadCount = messages.Count(msg => msg.SenderId == otherUserId && msg.ReceiverId == userId && !msg.IsRead)
                };
            }
        }

        // 3. Fetch user details to get avatars/names
        var users = await _users.Find(u => userIdsToFetch.Contains(u.Id)).ToListAsync();

        var result = conversations.Values.Select(c =>
        {
            dynamic conv = c;
            var user = users.FirstOrDefault(u => u.Id == conv.ContactId);
            return new
            {
                id = conv.ContactId,
                username = user?.Username ?? "Unknown",
                fullName = user?.FullName,
                avatar = user?.AvatarUrl,
                publicKey = user?.PublicKey,
                lastMessage = conv.LastMessage,
                lastMessageTime = conv.LastMessageTime,
                unreadCount = conv.UnreadCount
            };
        }).OrderByDescending(c => c.lastMessageTime).ToList();

        return Ok(result);
    }

    // PUT: api/messages/read/{senderId}
    [HttpPut("read/{senderId}")]
    public async Task<IActionResult> MarkMessagesAsRead(string senderId)
    {
        var receiverId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(receiverId)) return Unauthorized();

        if (string.IsNullOrEmpty(senderId)) return BadRequest("Sender ID is required");

        var filter = Builders<Message>.Filter.And(
            Builders<Message>.Filter.Eq(m => m.SenderId, senderId),
            Builders<Message>.Filter.Eq(m => m.ReceiverId, receiverId),
            Builders<Message>.Filter.Eq(m => m.IsRead, false)
        );

        var update = Builders<Message>.Update.Set(m => m.IsRead, true);

        var result = await _messagesCollection.UpdateManyAsync(filter, update);

        if (result.ModifiedCount > 0)
        {
            // Notify the sender that their messages have been read
            await _hubContext.Clients.Group($"user_{senderId}")
                   .SendAsync("MessagesRead", receiverId);
        }

        return NoContent();
    }
}
