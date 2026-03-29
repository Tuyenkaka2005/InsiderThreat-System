using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;
using MongoDB.Driver.GridFS;
using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace InsiderThreat.Server.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class UploadController : ControllerBase
    {
        private readonly IGridFSBucket _gridFsBucket;

        public UploadController(IGridFSBucket gridFsBucket)
        {
            _gridFsBucket = gridFsBucket;
        }

        // POST: api/upload
        // Upload file vào MongoDB GridFS
        [HttpPost]
        public async Task<IActionResult> Upload(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded" });

            // Kiểm tra loại file (chỉ chấp nhận ảnh và một số file thông dụng)
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".doc", ".docx", ".txt", ".zip" };
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(extension))
                return BadRequest(new { message = "Invalid file type." });

            try
            {
                var options = new GridFSUploadOptions
                {
                    Metadata = new BsonDocument
                    {
                        { "originalName", file.FileName },
                        { "contentType", file.ContentType },
                        { "uploadedAt", DateTime.UtcNow }
                    }
                };

                using var stream = file.OpenReadStream();
                var fileId = await _gridFsBucket.UploadFromStreamAsync(file.FileName, stream, options);

                var fileIdStr = fileId.ToString();
                var url = $"/api/upload/{fileIdStr}";

                return Ok(new
                {
                    url,
                    fileName = file.FileName,
                    originalName = file.FileName,
                    fileId = fileIdStr,
                    size = file.Length,
                    type = file.ContentType
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        // GET: api/upload/{fileId}
        // Trả về nội dung file để hiển thị (ảnh, v.v.)
        [HttpGet("{fileId}")]
        [AllowAnonymous] // Cho phép truy cập ảnh mà không cần auth (cần thiết cho <img> tag)
        public async Task<IActionResult> GetFile(string fileId)
        {
            try
            {
                if (!ObjectId.TryParse(fileId, out var objectId))
                    return BadRequest(new { message = "Invalid file ID" });

                // Lấy thông tin file (metadata)
                var filter = Builders<GridFSFileInfo>.Filter.Eq("_id", objectId);
                var cursor = await _gridFsBucket.FindAsync(filter);
                var fileInfo = await cursor.FirstOrDefaultAsync();

                if (fileInfo == null)
                    return NotFound(new { message = "File not found" });

                var contentType = fileInfo.Metadata?.GetValue("contentType", new BsonString("application/octet-stream")).AsString
                                  ?? "application/octet-stream";

                var downloadStream = await _gridFsBucket.OpenDownloadStreamAsync(objectId);
                return File(downloadStream, contentType, enableRangeProcessing: true);
            }
            catch (GridFSFileNotFoundException)
            {
                return NotFound(new { message = "File not found" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }

        // GET: api/upload/download/{fileId}?originalName=filename.ext
        // Trả về file để download (với content-disposition attachment)
        [HttpGet("download/{fileId}")]
        [AllowAnonymous]
        public async Task<IActionResult> DownloadFile(string fileId, [FromQuery] string? originalName)
        {
            try
            {
                if (!ObjectId.TryParse(fileId, out var objectId))
                    return BadRequest(new { message = "Invalid file ID" });

                var filter = Builders<GridFSFileInfo>.Filter.Eq("_id", objectId);
                var cursor = await _gridFsBucket.FindAsync(filter);
                var fileInfo = await cursor.FirstOrDefaultAsync();

                if (fileInfo == null)
                    return NotFound(new { message = "File not found" });

                var contentType = fileInfo.Metadata?.GetValue("contentType", new BsonString("application/octet-stream")).AsString
                                  ?? "application/octet-stream";

                var downloadName = originalName
                                   ?? fileInfo.Metadata?.GetValue("originalName", new BsonString(fileInfo.Filename)).AsString
                                   ?? fileInfo.Filename;

                var downloadStream = await _gridFsBucket.OpenDownloadStreamAsync(objectId);
                return File(downloadStream, contentType, fileDownloadName: downloadName);
            }
            catch (GridFSFileNotFoundException)
            {
                return NotFound(new { message = "File not found" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Internal server error", error = ex.Message });
            }
        }
    }
}
