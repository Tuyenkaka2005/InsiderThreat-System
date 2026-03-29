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
    public class GroupsController : ControllerBase
    {
        private readonly IMongoCollection<Group> _groups;

        public GroupsController(IMongoDatabase database)
        {
            _groups = database.GetCollection<Group>("Groups");
        }

        // GET: api/Groups
        [HttpGet]
        public async Task<IActionResult> GetGroups()
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                // Get groups where user is a member
                var groups = await _groups
                    .Find(g => g.MemberIds.Contains(userId!) || g.Privacy == "Public")
                    .SortBy(g => g.Name)
                    .ToListAsync();

                return Ok(groups);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error fetching groups", error = ex.Message });
            }
        }

        // GET: api/Groups/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetGroupById(string id)
        {
            try
            {
                var group = await _groups.Find(g => g.Id == id).FirstOrDefaultAsync();

                if (group == null)
                {
                    return NotFound(new { message = "Group not found" });
                }

                return Ok(group);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error fetching group", error = ex.Message });
            }
        }

        // POST: api/Groups
        [HttpPost]
        public async Task<IActionResult> CreateGroup([FromBody] CreateGroupRequest request)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

                if (string.IsNullOrEmpty(userId))
                {
                    return Unauthorized(new { message = "User not authenticated" });
                }

                var group = new Group
                {
                    Name = request.Name,
                    Description = request.Description,
                    Type = request.Type ?? "Department",
                    Privacy = request.Privacy ?? "Public",
                    AdminIds = new List<string> { userId },
                    MemberIds = new List<string> { userId },
                    CreatedAt = DateTime.UtcNow
                };

                await _groups.InsertOneAsync(group);

                return CreatedAtAction(nameof(GetGroupById), new { id = group.Id }, group);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error creating group", error = ex.Message });
            }
        }

        // POST: api/Groups/{id}/join
        [HttpPost("{id}/join")]
        public async Task<IActionResult> JoinGroup(string id)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var group = await _groups.Find(g => g.Id == id).FirstOrDefaultAsync();

                if (group == null)
                {
                    return NotFound(new { message = "Group not found" });
                }

                if (group.MemberIds.Contains(userId!))
                {
                    return BadRequest(new { message = "Already a member" });
                }

                group.MemberIds.Add(userId!);
                var update = Builders<Group>.Update.Set(g => g.MemberIds, group.MemberIds);
                await _groups.UpdateOneAsync(g => g.Id == id, update);

                return Ok(new { message = "Joined group successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error joining group", error = ex.Message });
            }
        }

        // POST: api/Groups/{id}/leave
        [HttpPost("{id}/leave")]
        public async Task<IActionResult> LeaveGroup(string id)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var group = await _groups.Find(g => g.Id == id).FirstOrDefaultAsync();

                if (group == null)
                {
                    return NotFound(new { message = "Group not found" });
                }

                if (!group.MemberIds.Contains(userId!))
                {
                    return BadRequest(new { message = "Not a member" });
                }

                group.MemberIds.Remove(userId!);
                var update = Builders<Group>.Update.Set(g => g.MemberIds, group.MemberIds);
                await _groups.UpdateOneAsync(g => g.Id == id, update);

                return Ok(new { message = "Left group successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error leaving group", error = ex.Message });
            }
        }
    }

    public class CreateGroupRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? Type { get; set; }
        public string? Privacy { get; set; }
    }
}
