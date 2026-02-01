using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;

namespace InsiderThreat.Server.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class UploadController : ControllerBase
{
    private readonly ILogger<UploadController> _logger;
    private readonly IWebHostEnvironment _environment;

    public UploadController(ILogger<UploadController> logger, IWebHostEnvironment environment)
    {
        _logger = logger;
        _environment = environment;
    }

    [HttpPost]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("No file uploaded.");

        try
        {
            // Ensure WebRootPath is set (fallback to ContentRootPath/wwwroot if null)
            var webRootPath = _environment.WebRootPath;
            if (string.IsNullOrEmpty(webRootPath))
            {
                webRootPath = Path.Combine(_environment.ContentRootPath, "wwwroot");
            }

            // Create uploads directory if not exists
            var uploadsPath = Path.Combine(webRootPath, "uploads");
            if (!Directory.Exists(uploadsPath))
            {
                Directory.CreateDirectory(uploadsPath);
            }

            // Generate unique filename
            var fileName = $"{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
            var filePath = Path.Combine(uploadsPath, fileName);

            // Save file
            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Return URL
            var url = $"/uploads/{fileName}";
            return Ok(new { Url = url, OriginalName = file.FileName });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading file: {Message}", ex.Message);
            // Return specific error for debugging
            return StatusCode(500, new { Message = "Internal Server Error", Detail = ex.Message, Path = _environment.WebRootPath });
        }
    }

    [AllowAnonymous]
    [HttpGet("download/{fileName}")]
    public IActionResult Download(string fileName, [FromQuery] string originalName)
    {
        try
        {
            var webRootPath = _environment.WebRootPath;
            if (string.IsNullOrEmpty(webRootPath))
            {
                webRootPath = Path.Combine(_environment.ContentRootPath, "wwwroot");
            }

            var filePath = Path.Combine(webRootPath, "uploads", fileName);

            if (!System.IO.File.Exists(filePath))
            {
                _logger.LogWarning("File not found: {FilePath}", filePath);
                return NotFound("File not found on server.");
            }

            // Determine content type
            var provider = new Microsoft.AspNetCore.StaticFiles.FileExtensionContentTypeProvider();
            if (!provider.TryGetContentType(fileName, out var contentType))
            {
                contentType = "application/octet-stream";
            }

            // If originalName is provided, verify it has an extension, if not, grab from fileName
            if (string.IsNullOrEmpty(originalName))
            {
                originalName = fileName;
            }
            else if (!Path.HasExtension(originalName))
            {
                originalName += Path.GetExtension(fileName);
            }

            _logger.LogInformation("Downloading file: {FilePath} as {OriginalName}", filePath, originalName);

            // Serve the file directly from disk
            return PhysicalFile(filePath, contentType, originalName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error downloading file: {FileName}", fileName);
            return StatusCode(500, $"Internal server error: {ex.Message}");
        }
    }
}
