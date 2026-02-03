using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace InsiderThreat.Shared;

public class Notification
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    
    // "Global", "Personal"
    public string Type { get; set; } = "Global"; 
    
    // If Personal, who is it for?
    public string? TargetUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.Now;
    
    // For tracking reads on Global notifications, we might need a separate collection or array of UserIds who read it.
    // For Personal, simple bool.
    // Let's keep it simple: "Global" notifications show to everyone.
    // "Personal" notifications are for specific actions.
}
