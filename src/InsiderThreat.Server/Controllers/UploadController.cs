using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;
using MongoDB.Driver.GridFS;

namespace InsiderThreat.Server.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class UploadController : ControllerBase
    {
        private readonly IGridFSBucket _gridFS;
        private readonly ILogger<UploadController> _logger;

        public UploadController(IGridFSBucket gridFS, ILogger<UploadController> logger)
        {
            _gridFS = gridFS;
            _logger = logger;
        }

        // POST: api/upload
        [HttpPost]
        [DisableRequestSizeLimit] // Cho phép upload file cực lớn
        public async Task<IActionResult> UploadFile(IFormFile file)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest("No file uploaded");
            }

            try
            {
                _logger.LogInformation($"Uploading file: {file.FileName}, Size: {file.Length} bytes");

                // Đọc file và upload vào GridFS
                using var stream = file.OpenReadStream();
                var options = new GridFSUploadOptions
                {
                    Metadata = new BsonDocument
                    {
                        { "originalName", file.FileName },
                        { "contentType", file.ContentType },
                        { "uploadedAt", DateTime.UtcNow }
                    }
                };

                var fileId = await _gridFS.UploadFromStreamAsync(file.FileName, stream, options);
                
                // Trả về URL để truy cập file sau này
                // Ví dụ: /api/upload/{id}
                var fileUrl = $"/api/upload/{fileId}";

                return Ok(new
                {
                    fileId = fileId.ToString(),
                    url = fileUrl,
                    fileName = file.FileName,
                    contentType = file.ContentType,
                    size = file.Length
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading file");
                return StatusCode(500, new { message = "Upload failed", error = ex.Message });
            }
        }

        // GET: api/upload/{id}
        [HttpGet("{id}")]
        [AllowAnonymous] // Cho phép xem ảnh/video mà không cần token (hoặc có thể thêm Authorize nếu cần mật)
        public async Task<IActionResult> GetFile(string id)
        {
            try
            {
                if (!ObjectId.TryParse(id, out var objectId))
                {
                    return BadRequest("Invalid ID format");
                }

                var stream = await _gridFS.OpenDownloadStreamAsync(objectId);
                var contentType = stream.FileInfo.Metadata.Contains("contentType") 
                    ? stream.FileInfo.Metadata["contentType"].AsString 
                    : "application/octet-stream";

                return File(stream, contentType, stream.FileInfo.Filename);
            }
            catch (GridFSFileNotFoundException)
            {
                return NotFound();
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }
    }
}
