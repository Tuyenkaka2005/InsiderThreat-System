using MongoDB.Driver;
using MongoDB.Bson; // Thêm cái này để làm việc với dữ liệu linh động
using InsiderThreat.Shared;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.AspNetCore.Http.Features;

var builder = WebApplication.CreateBuilder(args);

// Cấu hình giới hạn upload file (200MB)
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 209715200; // 200MB
});

// ==========================================
// 1. CẤU HÌNH MONGODB (Đã sửa chuẩn)
// ==========================================
var mongoSettings = builder.Configuration.GetSection("InsiderThreatDatabase");

// Đăng ký MongoClient (Singleton)
builder.Services.AddSingleton<IMongoClient>(s =>
    new MongoClient(mongoSettings.GetValue<string>("ConnectionString")));

// Đăng ký IMongoDatabase (Scoped)
builder.Services.AddScoped<IMongoDatabase>(s =>
    s.GetRequiredService<IMongoClient>().GetDatabase(mongoSettings.GetValue<string>("DatabaseName")));

// Đăng ký GridFSBucket để lưu trữ file/ảnh trong MongoDB
builder.Services.AddScoped<MongoDB.Driver.GridFS.IGridFSBucket>(s =>
{
    var db = s.GetRequiredService<IMongoDatabase>();
    return new MongoDB.Driver.GridFS.GridFSBucket(db);
});
// ==========================================

// ==========================================
// 3. CẤU HÌNH CORS (Cho Web Frontend)
// ==========================================
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowWebApp", policy =>
    {
        policy.WithOrigins(
            // === Development ===
            "http://localhost:5173", "http://localhost:3000",
            "http://127.0.0.1:5173", "http://127.0.0.1:3000",
            "http://localhost:5174", "http://127.0.0.1:5174",
            "http://localhost:5175", "http://127.0.0.1:5175",
            "http://localhost:5176", "http://127.0.0.1:5176",
            "http://localhost:5177", "http://127.0.0.1:5177",
            // === Production Server ===
            "http://150.95.104.244",
            "https://150.95.104.244",
            "https://tuyen-thda.io.vn",
            "https://www.tuyen-thda.io.vn")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Cho phép gửi Cookie/JWT
    });
});
// ==========================================

// ==========================================
// 4. CẤU HÌNH JWT AUTHENTICATION
// ==========================================
var jwtSettings = builder.Configuration.GetSection("Jwt");
var rawKey = jwtSettings["Key"] ?? "InsiderThreatSystem_SuperSecretKey_2024_DoNotShare_ThisMustBe32CharsLong!";
var key = Encoding.UTF8.GetBytes(rawKey);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings["Issuer"],
        ValidAudience = jwtSettings["Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(key)
    };

    // SignalR WebSocket không gửi được header → token đến qua query string
    options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();
// ==========================================

// ==========================================
// 6. CẤU HÌNH EMAIL SERVICE
// ==========================================
builder.Services.AddScoped<InsiderThreat.Server.Services.IEmailService, InsiderThreat.Server.Services.EmailService>();
builder.Services.AddSingleton<InsiderThreat.Server.Services.IMessageEncryptionService, InsiderThreat.Server.Services.MessageEncryptionService>();
// ==========================================

// ==========================================
// 7. CẤU HÌNH SIGNALR
// ==========================================
builder.Services.AddSignalR();
// ==========================================

// ==========================================

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 209715200; // 200MB
    options.ValueLengthLimit = 209715200;
    options.MemoryBufferThreshold = 209715200;
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// ==========================================
// SEED ADMIN ACCOUNT
// ==========================================
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<IMongoDatabase>();
    var usersCollection = db.GetCollection<User>("Users");
    var existingAdmin = await usersCollection.Find(u => u.Username == "admin").FirstOrDefaultAsync();
    if (existingAdmin == null)
    {
        var admin = new User
        {
            Username = "admin",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
            FullName = "Administrator",
            Role = "Admin",
            Email = "admin@insiderthreat.local",
            CreatedAt = DateTime.Now
        };
        await usersCollection.InsertOneAsync(admin);
        Console.WriteLine(">>> Admin account created: admin / admin123");
    }
}
// ==========================================

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// app.UseHttpsRedirection(); // Tắt HTTPS để tránh lỗi kết nối LAN nếu chưa cấu hình SSL

// Bật CORS
app.UseCors("AllowWebApp");

// Bật Authentication & Authorization
app.UseStaticFiles(); // Cho phép serve file từ wwwroot
app.UseAuthentication();
app.UseAuthorization();

// ==========================================
// 2. API TEST KẾT NỐI DATABASE (QUAN TRỌNG)
// ==========================================
app.MapGet("/test-db", (IMongoDatabase db) =>
{
    // Lấy thử danh sách Users (dùng BsonDocument để không cần tạo Class User ngay bây giờ)
    var users = db.GetCollection<BsonDocument>("Users").Find(_ => true).ToList();

    // Chuyển kết quả sang dạng chuỗi JSON dễ đọc
    var result = users.ConvertAll(bson => BsonTypeMapper.MapToDotNetValue(bson));

    return Results.Ok(new
    {
        Message = "✅ KẾT NỐI MONGODB THÀNH CÔNG!",
        ServerTime = DateTime.Now,
        UserCount = users.Count,
        Data = result
    });
})
.WithName("TestDatabaseConnection")
.WithOpenApi();

// ==========================================

// Map SignalR Hub
app.MapHub<InsiderThreat.Server.Hubs.SystemHub>("/hubs/system");
app.MapHub<InsiderThreat.Server.Hubs.ChatHub>("/hubs/chat");
app.MapHub<InsiderThreat.Server.Hubs.NotificationHub>("/hubs/notifications");

app.MapControllers();
app.Run();