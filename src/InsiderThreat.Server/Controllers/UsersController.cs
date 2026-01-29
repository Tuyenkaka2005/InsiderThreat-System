using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;
using InsiderThreat.Shared;
using System.Security.Cryptography;
using System.Text;

namespace InsiderThreat.Server.Controllers;

[Authorize(Roles = "Admin")] // Chỉ Admin mới được quản lý User
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly IMongoCollection<User> _usersCollection;
    private readonly ILogger<UsersController> _logger;

    public UsersController(IMongoDatabase database, ILogger<UsersController> logger)
    {
        _usersCollection = database.GetCollection<User>("Users");
        _logger = logger;
    }

    // GET: api/users
    [HttpGet]
    public async Task<ActionResult<List<User>>> GetUsers()
    {
        var users = await _usersCollection.Find(_ => true).ToListAsync();
        // Ẩn hash password trước khi trả về
        users.ForEach(u => u.PasswordHash = "");
        return Ok(users);
    }

    // GET: api/users/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<User>> GetUser(string id)
    {
        var user = await _usersCollection.Find(u => u.Id == id).FirstOrDefaultAsync();
        if (user == null) return NotFound();
        user.PasswordHash = "";
        return Ok(user);
    }

    // POST: api/users
    [HttpPost]
    public async Task<ActionResult<User>> CreateUser(User newUser)
    {
        // Check username exists
        var existingUser = await _usersCollection.Find(u => u.Username == newUser.Username).FirstOrDefaultAsync();
        if (existingUser != null)
        {
            return BadRequest(new { Message = "Username đã tồn tại" });
        }

        // Hash password (giả sử client gửi plain text password trong PasswordHash tạm thời, hoặc thêm DTO)
        // Để đơn giản, ta sẽ quy ước: Khi tạo mới, field PasswordHash chứa password chưa hash
        if (!string.IsNullOrEmpty(newUser.PasswordHash))
        {
            newUser.PasswordHash = BCrypt.Net.BCrypt.HashPassword(newUser.PasswordHash);
        }

        newUser.Id = null; // Auto gen ID
        newUser.CreatedAt = DateTime.Now;

        await _usersCollection.InsertOneAsync(newUser);

        newUser.PasswordHash = ""; // Hide for response
        return CreatedAtAction(nameof(GetUser), new { id = newUser.Id }, newUser);
    }

    // PUT: api/users/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateUser(string id, User updatedUser)
    {
        var user = await _usersCollection.Find(u => u.Id == id).FirstOrDefaultAsync();
        if (user == null) return NotFound();

        // Update basic info
        user.FullName = updatedUser.FullName;
        user.Role = updatedUser.Role;
        user.Department = updatedUser.Department;
        user.Email = updatedUser.Email; // Update email
        // user.Username thường không cho đổi để tránh conflict ID hệ thống khác

        // Nếu có gửi password mới thì hash và update
        if (!string.IsNullOrEmpty(updatedUser.PasswordHash))
        {
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(updatedUser.PasswordHash);
        }

        await _usersCollection.ReplaceOneAsync(u => u.Id == id, user);
        return NoContent();
    }

    // DELETE: api/users/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteUser(string id)
    {
        var result = await _usersCollection.DeleteOneAsync(u => u.Id == id);
        if (result.DeletedCount == 0) return NotFound();
        return NoContent();
    }

    // PUT: api/users/{id}/face-embeddings
    [HttpPut("{id}/face-embeddings")]
    public async Task<IActionResult> UpdateFaceEmbeddings(string id, [FromBody] double[] embeddings)
    {
        _logger.LogInformation($"UpdateFaceEmbeddings called for User ID: {id}");
        _logger.LogInformation($"Embeddings length: {embeddings?.Length}");

        var filter = Builders<User>.Filter.Eq(u => u.Id, id);
        var update = Builders<User>.Update.Set(u => u.FaceEmbeddings, embeddings);

        var result = await _usersCollection.UpdateOneAsync(filter, update);

        if (result.MatchedCount == 0)
        {
            _logger.LogWarning($"User not found with ID: {id}");
            return NotFound(new { Message = $"User not found with ID: {id}" });
        }

        return Ok(new { Message = "Face embeddings updated successfully" });
    }
}
