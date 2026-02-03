using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using InsiderThreat.Server.Models;
using System.Security.Claims;

namespace InsiderThreat.Server.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class SocialFeedController : ControllerBase
    {
        private readonly IMongoCollection<Post> _posts;
        private readonly IMongoCollection<Comment> _comments;
        private readonly IMongoCollection<InsiderThreat.Shared.User> _users;
        private readonly IMongoDatabase _database;

        public SocialFeedController(IMongoDatabase database)
        {
            _database = database;
            _posts = database.GetCollection<Post>("Posts");
            _comments = database.GetCollection<Comment>("Comments");
            _users = database.GetCollection<InsiderThreat.Shared.User>("Users");
        }

        // GET: api/SocialFeed/posts?page=1&limit=10
        [HttpGet("posts")]
        public async Task<IActionResult> GetPosts([FromQuery] int page = 1, [FromQuery] int limit = 10)
        {
            try
            {
                var skip = (page - 1) * limit;

                var posts = await _posts
                    .Find(_ => true)
                    .SortByDescending(p => p.CreatedAt)
                    .Skip(skip)
                    .Limit(limit)
                    .ToListAsync();

                var totalCount = await _posts.CountDocumentsAsync(_ => true);

                return Ok(new
                {
                    posts,
                    pagination = new
                    {
                        page,
                        limit,
                        totalCount,
                        totalPages = (int)Math.Ceiling((double)totalCount / limit)
                    }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error fetching posts", error = ex.Message });
            }
        }

        // GET: api/SocialFeed/users/{userId}/posts
        [HttpGet("users/{userId}/posts")]
        public async Task<IActionResult> GetUserPosts(string userId)
        {
            try
            {
                var posts = await _posts
                    .Find(p => p.AuthorId == userId)
                    .SortByDescending(p => p.CreatedAt)
                    .ToListAsync();

                return Ok(posts);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error fetching user posts", error = ex.Message });
            }
        }

        // POST: api/SocialFeed/posts
        [HttpPost("posts")]
        public async Task<IActionResult> CreatePost([FromBody] CreatePostRequest request)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var userName = User.FindFirst(ClaimTypes.Name)?.Value ?? "Unknown User";
                var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "User";

                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }

                // Fetch full user details to get AvatarUrl
                var currentUser = await _users.Find(u => u.Id == userId).FirstOrDefaultAsync();
                var userAvatar = currentUser?.AvatarUrl;

                var post = new Post
                {
                    AuthorId = userId,
                    AuthorName = userName,
                    AuthorRole = userRole,
                    AuthorAvatarUrl = userAvatar,
                    Content = request.Content,
                    Privacy = request.Privacy ?? "Public",
                    MediaFiles = request.MediaFiles ?? new List<MediaFile>(),
                    CreatedAt = DateTime.UtcNow
                };

                await _posts.InsertOneAsync(post);

                return CreatedAtAction(nameof(GetPostById), new { id = post.Id }, post);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error creating post", error = ex.Message });
            }
        }

        // GET: api/SocialFeed/posts/{id}
        [HttpGet("posts/{id}")]
        public async Task<IActionResult> GetPostById(string id)
        {
            try
            {
                var post = await _posts.Find(p => p.Id == id).FirstOrDefaultAsync();

                if (post == null)
                {
                    return NotFound(new { message = "Post not found" });
                }

                return Ok(post);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error fetching post", error = ex.Message });
            }
        }

        // PUT: api/SocialFeed/posts/{id}
        [HttpPut("posts/{id}")]
        public async Task<IActionResult> UpdatePost(string id, [FromBody] UpdatePostRequest request)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var post = await _posts.Find(p => p.Id == id).FirstOrDefaultAsync();

                if (post == null)
                {
                    return NotFound(new { message = "Post not found" });
                }

                if (post.AuthorId != userId)
                {
                    return Forbid("You can only edit your own posts");
                }

                var update = Builders<Post>.Update
                    .Set(p => p.Content, request.Content)
                    .Set(p => p.UpdatedAt, DateTime.UtcNow);

                await _posts.UpdateOneAsync(p => p.Id == id, update);

                return Ok(new { message = "Post updated successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error updating post", error = ex.Message });
            }
        }

        // DELETE: api/SocialFeed/posts/{id}
        [HttpDelete("posts/{id}")]
        public async Task<IActionResult> DeletePost(string id)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
                var post = await _posts.Find(p => p.Id == id).FirstOrDefaultAsync();

                if (post == null)
                {
                    return NotFound(new { message = "Post not found" });
                }

                // Only author or admin can delete
                if (post.AuthorId != userId && userRole != "Admin")
                {
                    return Forbid("You don't have permission to delete this post");
                }

                await _posts.DeleteOneAsync(p => p.Id == id);
                // Also delete all comments on this post
                await _comments.DeleteManyAsync(c => c.PostId == id);

                return Ok(new { message = "Post deleted successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error deleting post", error = ex.Message });
            }
        }

        // POST: api/SocialFeed/posts/{id}/like
        [HttpPost("posts/{id}/like")]
        public async Task<IActionResult> LikePost(string id)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var post = await _posts.Find(p => p.Id == id).FirstOrDefaultAsync();

                if (post == null)
                {
                    return NotFound(new { message = "Post not found" });
                }

                // Toggle like
                if (post.LikedBy.Contains(userId!))
                {
                    post.LikedBy.Remove(userId!);
                }
                else
                {
                    post.LikedBy.Add(userId!);
                }

                var update = Builders<Post>.Update.Set(p => p.LikedBy, post.LikedBy);
                await _posts.UpdateOneAsync(p => p.Id == id, update);

                return Ok(new { liked = post.LikedBy.Contains(userId!), likeCount = post.LikedBy.Count });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error liking post", error = ex.Message });
            }
        }

        // POST: api/SocialFeed/posts/{id}/save
        [HttpPost("posts/{id}/save")]
        public async Task<IActionResult> SavePost(string id)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var post = await _posts.Find(p => p.Id == id).FirstOrDefaultAsync();

                if (post == null)
                {
                    return NotFound(new { message = "Post not found" });
                }

                // Initialize if null (schema evolution)
                if (post.SavedBy == null) post.SavedBy = new List<string>();

                // Toggle save
                if (post.SavedBy.Contains(userId!))
                {
                    post.SavedBy.Remove(userId!);
                }
                else
                {
                    post.SavedBy.Add(userId!);
                }

                var update = Builders<Post>.Update.Set(p => p.SavedBy, post.SavedBy);
                await _posts.UpdateOneAsync(p => p.Id == id, update);

                return Ok(new { saved = post.SavedBy.Contains(userId!) });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error saving post", error = ex.Message });
            }
        }

        // GET: api/SocialFeed/posts/{id}/comments
        [HttpGet("posts/{id}/comments")]
        public async Task<IActionResult> GetComments(string id)
        {
            try
            {
                var comments = await _comments
                    .Find(c => c.PostId == id)
                    .SortBy(c => c.CreatedAt)
                    .ToListAsync();

                return Ok(comments);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error fetching comments", error = ex.Message });
            }
        }

        // POST: api/SocialFeed/posts/{id}/comments
        [HttpPost("posts/{id}/comments")]
        public async Task<IActionResult> AddComment(string id, [FromBody] CreateCommentRequest request)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var userName = User.FindFirst(ClaimTypes.Name)?.Value ?? "Unknown User";

                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }

                // Fetch full user details to get AvatarUrl
                var currentUser = await _users.Find(u => u.Id == userId).FirstOrDefaultAsync();
                var userAvatar = currentUser?.AvatarUrl;

                var comment = new Comment
                {
                    PostId = id,
                    AuthorId = userId,
                    AuthorName = userName,
                    AuthorAvatarUrl = userAvatar,
                    Content = request.Content,
                    ParentCommentId = request.ParentCommentId,
                    CreatedAt = DateTime.UtcNow
                };

                await _comments.InsertOneAsync(comment);

                // Update comment count on post
                var update = Builders<Post>.Update.Inc(p => p.CommentCount, 1);
                await _posts.UpdateOneAsync(p => p.Id == id, update);

                return CreatedAtAction(nameof(GetComments), new { id }, comment);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error adding comment", error = ex.Message });
            }
        }

        // GET: api/SocialFeed/users
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers()
        {
            try
            {
                var usersCollection = _database.GetCollection<InsiderThreat.Shared.User>("Users");
                var users = await usersCollection.Find(_ => true).ToListAsync();

                // Hide password hashes
                users.ForEach(u => u.PasswordHash = "");

                return Ok(users);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error fetching users", error = ex.Message });
            }
        }
    }

    // Request DTOs
    public class CreatePostRequest
    {
        public string Content { get; set; } = string.Empty;
        public string? Privacy { get; set; }
        public List<MediaFile>? MediaFiles { get; set; }
    }

    public class UpdatePostRequest
    {
        public string Content { get; set; } = string.Empty;
    }

    public class CreateCommentRequest
    {
        public string Content { get; set; } = string.Empty;
        public string? ParentCommentId { get; set; }
    }
}
