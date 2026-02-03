using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System;
using System.Collections.Generic;

namespace InsiderThreat.Server.Models
{
    public class Post
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }

        [BsonElement("authorId")]
        [BsonRepresentation(BsonType.ObjectId)]
        public string AuthorId { get; set; } = string.Empty;

        [BsonElement("authorName")]
        public string AuthorName { get; set; } = string.Empty;

        [BsonElement("authorRole")]
        public string AuthorRole { get; set; } = string.Empty;

        [BsonElement("authorAvatarUrl")]
        public string? AuthorAvatarUrl { get; set; }

        [BsonElement("content")]
        public string Content { get; set; } = string.Empty;

        [BsonElement("mediaFiles")]
        public List<MediaFile> MediaFiles { get; set; } = new List<MediaFile>();

        [BsonElement("privacy")]
        public string Privacy { get; set; } = "Public"; // Public, Friends, OnlyMe

        [BsonElement("likedBy")]
        public List<string> LikedBy { get; set; } = new List<string>();

        [BsonElement("savedBy")]
        public List<string> SavedBy { get; set; } = new List<string>();

        [BsonElement("reactions")]
        public Dictionary<string, List<string>> Reactions { get; set; } = new Dictionary<string, List<string>>();

        [BsonElement("commentCount")]
        public int CommentCount { get; set; } = 0;

        [BsonElement("shareCount")]
        public int ShareCount { get; set; } = 0;

        [BsonElement("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [BsonElement("updatedAt")]
        public DateTime? UpdatedAt { get; set; }
    }

    public class MediaFile
    {
        [BsonElement("type")]
        public string Type { get; set; } = string.Empty; // image, video, file

        [BsonElement("url")]
        public string Url { get; set; } = string.Empty;

        [BsonElement("thumbnailUrl")]
        public string? ThumbnailUrl { get; set; }

        [BsonElement("fileName")]
        public string? FileName { get; set; }

        [BsonElement("fileSize")]
        public long? FileSize { get; set; }
    }
}
