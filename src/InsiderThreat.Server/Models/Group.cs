using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System.Text.Json.Serialization;
using System;
using System.Collections.Generic;

namespace InsiderThreat.Server.Models
{
    public class Group
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        [JsonPropertyName("id")]
        public string? Id { get; set; }

        [BsonElement("name")]
        public string Name { get; set; } = string.Empty;

        [BsonElement("description")]
        public string Description { get; set; } = string.Empty;

        [BsonElement("type")]
        public string Type { get; set; } = "Department"; // Department, Team, Interest

        [BsonElement("avatarUrl")]
        public string? AvatarUrl { get; set; }

        [BsonElement("coverUrl")]
        public string? CoverUrl { get; set; }

        [BsonElement("adminIds")]
        public List<string> AdminIds { get; set; } = new List<string>();

        [BsonElement("memberIds")]
        public List<string> MemberIds { get; set; } = new List<string>();

        [BsonElement("privacy")]
        public string Privacy { get; set; } = "Public"; // Public, Private, Secret

        [BsonElement("isProject")]
        public bool IsProject { get; set; } = false;

        [BsonElement("projectStartDate")]
        public DateTime? ProjectStartDate { get; set; }

        [BsonElement("projectEndDate")]
        public DateTime? ProjectEndDate { get; set; }

        [BsonElement("sharedDocumentIds")]
        public List<string> SharedDocumentIds { get; set; } = new List<string>();

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("updatedAt")]
        public DateTime? UpdatedAt { get; set; }
    }
}
