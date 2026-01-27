using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using InsiderThreat.Shared;

namespace InsiderThreat.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DevicesController : ControllerBase
    {
        private readonly IMongoCollection<Device> _devices;

        public DevicesController(IMongoDatabase database)
        {
            _devices = database.GetCollection<Device>("Devices");
        }

        [HttpGet("check")]
        public async Task<IActionResult> CheckDevice(string deviceId)
        {
            if (string.IsNullOrEmpty(deviceId))
                return BadRequest("DeviceId is required");

            Console.WriteLine($"[CheckDevice] Received DeviceId: {deviceId}");

            // Extract VID and PID từ deviceId (format: USB\VID_XXXX&PID_YYYY\...)
            var vidPid = ExtractVidPid(deviceId);
            Console.WriteLine($"[CheckDevice] Extracted VID/PID: {vidPid}");

            if (vidPid == null)
                return StatusCode(403, new { Allowed = false, Message = "Invalid DeviceId format" });

            // Tìm device trong whitelist có cùng VID/PID
            var devices = await _devices.Find(_ => true).ToListAsync();
            Console.WriteLine($"[CheckDevice] Total devices in whitelist: {devices.Count}");

            var matchedDevice = devices.FirstOrDefault(d =>
            {
                var dbVidPid = ExtractVidPid(d.DeviceId);
                Console.WriteLine($"[CheckDevice] Comparing with DB DeviceId: {d.DeviceId} => Extracted: {dbVidPid}");
                return dbVidPid != null && dbVidPid.Equals(vidPid, StringComparison.OrdinalIgnoreCase);
            });

            if (matchedDevice != null && matchedDevice.IsAllowed)
            {
                Console.WriteLine($"[CheckDevice] ✅ MATCH FOUND! Device ALLOWED.");
                return Ok(new { Allowed = true, Message = "Device is allowed" });
            }

            Console.WriteLine($"[CheckDevice] ❌ NO MATCH. Device BLOCKED.");
            return StatusCode(403, new { Allowed = false, Message = "Device is BLOCKED" }); // 403 Forbidden
        }

        // Helper method to extract VID and PID from DeviceId
        private string? ExtractVidPid(string deviceId)
        {
            // Format: USB\VID_8087&PID_0026\Serial => Extract "VID_8087&PID_0026"
            var match = System.Text.RegularExpressions.Regex.Match(deviceId, @"VID_[0-9A-F]{4}&PID_[0-9A-F]{4}", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            return match.Success ? match.Value : null;
        }

        [HttpPost]
        public async Task<IActionResult> AddDevice([FromBody] Device device)
        {
            await _devices.InsertOneAsync(device);
            return CreatedAtAction(nameof(GetAllDevices), new { id = device.Id }, device);
        }

        [HttpGet]
        public async Task<IActionResult> GetAllDevices()
        {
            var devices = await _devices.Find(_ => true).ToListAsync();
            return Ok(devices);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDevice(string id)
        {
            var result = await _devices.DeleteOneAsync(d => d.Id == id);
            if (result.DeletedCount > 0)
                return Ok(new { Message = "Device removed from whitelist" });
            return NotFound(new { Message = "Device not found" });
        }
    }
}
