using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using InsiderThreat.Server.Models;
using InsiderThreat.Shared;

namespace InsiderThreat.Server.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class MessagesController : ControllerBase
{
    private readonly IMongoCollection<Message> _messagesCollection;
    private readonly ILogger<MessagesController> _logger;

    public MessagesController(IMongoDatabase database, ILogger<MessagesController> logger)
    {
        _messagesCollection = database.GetCollection<Message>("Messages");
        _logger = logger;
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
}
