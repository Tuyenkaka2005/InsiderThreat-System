using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using MongoDB.Driver.GridFS;
using InsiderThreat.Server.Models;
using InsiderThreat.Shared;
using Microsoft.AspNetCore.Authorization;
using MongoDB.Bson;

namespace InsiderThreat.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DocumentLibraryController : ControllerBase
    {
        private readonly IMongoCollection<SharedDocument> _documents;
        private readonly IMongoCollection<User> _users;
        private readonly IGridFSBucket _gridFS;
        private readonly ILogger<DocumentLibraryController> _logger;

        public DocumentLibraryController(IMongoDatabase database, IGridFSBucket gridFS, ILogger<DocumentLibraryController> logger)
        {
            _documents = database.GetCollection<SharedDocument>("SharedDocuments");
            _users = database.GetCollection<User>("Users");
            _gridFS = gridFS;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<SharedDocument>>> GetDocuments()
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var userRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "Nhân viên";
            var userRoleLevel = GetRoleLevel(userRole);

            _logger.LogInformation($"Fetching documents for user {userId} with role {userRole} (Level {userRoleLevel})");

            var allDocs = await _documents.Find(_ => true)
                .SortByDescending(d => d.UploadDate)
                .ToListAsync();

            var filteredDocs = allDocs.Where(d => 
            {
                // 1. Admins see everything
                if (userRole == "Admin") return true;

                // 2. Uploader sees their own doc
                if (d.UploaderId == userId) return true;

                // 3. Specifically allowed users see it
                if (d.AllowedUserIds != null && d.AllowedUserIds.Contains(userId)) return true;

                // 4. Role-based hierarchy: Document's minimum role level must be <= User's role level
                var docMinRoleLevel = GetRoleLevel(d.MinimumRole);
                return docMinRoleLevel <= userRoleLevel;
            }).ToList();

            _logger.LogInformation($"Filtered {allDocs.Count} down to {filteredDocs.Count} for user {userId}");
            return Ok(filteredDocs);
        }

        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult<SharedDocument>> UploadDocument(
            [FromForm] IFormFile file, 
            [FromForm] string? description, 
            [FromForm] string? minimumRole,
            [FromForm] string? allowedUserIdsJson)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded");

            var allowedExtensions = new[] { ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".zip", ".rar" };
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(extension))
                return BadRequest("Invalid file type. Supported: PDF, Word, Excel, TXT, ZIP/RAR.");

            try
            {
                var allowedUserIds = new List<string>();
                if (!string.IsNullOrEmpty(allowedUserIdsJson))
                {
                    try {
                        allowedUserIds = System.Text.Json.JsonSerializer.Deserialize<List<string>>(allowedUserIdsJson) ?? new List<string>();
                    } catch (Exception ex) {
                        _logger.LogWarning(ex, "Failed to deserialize allowedUserIdsJson");
                    }
                }

                _logger.LogInformation($"Uploading document: {file.FileName} ({file.Length} bytes) with MinRole: {minimumRole}, AllowedUsers: {allowedUserIds.Count}");
                
                // 1. Upload to GridFS
                using var stream = file.OpenReadStream();
                var fileId = await _gridFS.UploadFromStreamAsync(file.FileName, stream);

                _logger.LogInformation($"Uploaded to GridFS with ID: {fileId}");

                // 2. Save metadata
                var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "unknown";
                
                // Fetch full user details to get the most accurate FullName
                var currentUser = await _users.Find(u => u.Id == userId).FirstOrDefaultAsync();
                var userName = currentUser?.FullName ?? User.FindFirst("FullName")?.Value ?? User.Identity?.Name ?? "Unknown User";

                var sharedDoc = new SharedDocument
                {
                    FileId = fileId.ToString(),
                    FileName = file.FileName,
                    ContentType = file.ContentType,
                    UploaderId = userId,
                    UploaderName = userName,
                    Size = file.Length,
                    Description = description,
                    MinimumRole = minimumRole ?? "Nhân viên",
                    AllowedUserIds = allowedUserIds
                };

                await _documents.InsertOneAsync(sharedDoc);
                _logger.LogInformation($"Metadata saved for document: {sharedDoc.Id}");
                return Ok(sharedDoc);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error uploading document: {file.FileName}");
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteDocument(string id)
        {
            _logger.LogInformation($"Attempting to delete document with ID: {id}");
            var doc = await _documents.Find(d => d.Id == id).FirstOrDefaultAsync();
            if (doc == null)
            {
                _logger.LogWarning($"Document not found with ID: {id}");
                return NotFound();
            }

            // Check permission: Only owner or admin/Giám đốc
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var userRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
            
            _logger.LogInformation($"User {userId} (Role: {userRole}) attempting to delete doc {id} (Owner: {doc.UploaderId})");

            if (doc.UploaderId != userId && userRole != "Admin" && userRole != "Giám đốc") 
            {
                _logger.LogWarning($"User {userId} unauthorized to delete document {id}");
                return Forbid();
            }

            try
            {
                // 1. Delete from GridFS
                _logger.LogInformation($"Deleting file from GridFS with FileId: {doc.FileId}");
                if (ObjectId.TryParse(doc.FileId, out var fileId))
                {
                    await _gridFS.DeleteAsync(fileId);
                    _logger.LogInformation($"Successfully deleted file from GridFS: {fileId}");
                }
                else
                {
                    _logger.LogWarning($"Could not parse FileId to ObjectId: {doc.FileId}");
                }

                // 2. Delete metadata
                var result = await _documents.DeleteOneAsync(d => d.Id == id);
                _logger.LogInformation($"Delete metadata result: {result.DeletedCount} documents deleted");

                return Ok(new { message = "Document deleted successfully", deletedCount = result.DeletedCount });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting document: {id}");
                return StatusCode(500, $"Error deleting document: {ex.Message}");
            }
        }

        [HttpPut("{id}/permissions")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> UpdatePermissions(string id, [FromBody] UpdatePermissionsRequest request)
        {
            var doc = await _documents.Find(d => d.Id == id).FirstOrDefaultAsync();
            if (doc == null)
                return NotFound();

            // Check permission: Only owner or admin/Giám đốc
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var userRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;

            if (doc.UploaderId != userId && userRole != "Admin" && userRole != "Giám đốc")
                return Forbid();

            var update = Builders<SharedDocument>.Update
                .Set(d => d.MinimumRole, request.MinimumRole ?? "Nhân viên")
                .Set(d => d.AllowedUserIds, request.AllowedUserIds ?? new List<string>());

            var result = await _documents.UpdateOneAsync(d => d.Id == id, update);

            if (result.ModifiedCount == 0 && result.MatchedCount == 0)
                return NotFound();

            return Ok(new { message = "Bộ lọc và quyền xem đã được cập nhật" });
        }

        private int GetRoleLevel(string role)
        {
            return role switch
            {
                "Giám đốc" => 3,
                "Admin" => 3,
                "Quản lý" => 2,
                "Nhân viên" => 1,
                _ => 1
            };
        }
    }

    public class UpdatePermissionsRequest
    {
        public string? MinimumRole { get; set; }
        public List<string>? AllowedUserIds { get; set; }
    }
}
