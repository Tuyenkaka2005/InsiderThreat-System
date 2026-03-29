using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using InsiderThreat.Shared;

namespace InsiderThreat.Server.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class DevicesController : ControllerBase
    {
        private readonly IMongoCollection<Device> _devices;

        public DevicesController(IMongoDatabase database)
        {
            _devices = database.GetCollection<Device>("Devices");
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Device>>> GetDevices()
        {
            var devices = await _devices.Find(_ => true).ToListAsync();
            return Ok(devices);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Device>> GetDevice(string id)
        {
            var device = await _devices.Find(d => d.Id == id).FirstOrDefaultAsync();
            if (device == null) return NotFound();
            return Ok(device);
        }

        [HttpPost]
        public async Task<ActionResult<Device>> RegisterDevice([FromBody] Device device)
        {
            device.CreatedAt = DateTime.Now;
            await _devices.InsertOneAsync(device);
            return CreatedAtAction(nameof(GetDevice), new { id = device.Id }, device);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDevice(string id)
        {
            var result = await _devices.DeleteOneAsync(d => d.Id == id);
            if (result.DeletedCount == 0) return NotFound();
            return Ok(new { message = "Device removed from whitelist" });
        }
    }
}
