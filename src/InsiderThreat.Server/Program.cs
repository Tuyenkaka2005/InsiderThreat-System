using MongoDB.Driver;
using MongoDB.Bson; // Thêm cái này để làm việc với dữ liệu linh động
using InsiderThreat.Shared;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

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
// ==========================================

// ==========================================
// 3. CẤU HÌNH CORS (Cho Web Frontend)
// ==========================================
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowWebApp", policy =>
    {
        policy.WithOrigins(
            "http://localhost:5173", "http://localhost:3000",
            "http://127.0.0.1:5173", "http://127.0.0.1:3000",
            "http://localhost:5174", "http://127.0.0.1:5174",
            "http://localhost:5175", "http://127.0.0.1:5175",
            "http://localhost:5176", "http://127.0.0.1:5176",
            "http://localhost:5177", "http://127.0.0.1:5177")
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
var key = Encoding.UTF8.GetBytes(jwtSettings["Key"]!);

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
});

builder.Services.AddAuthorization();
// ==========================================

// ==========================================
// 6. CẤU HÌNH EMAIL SERVICE
// ==========================================
builder.Services.AddScoped<InsiderThreat.Server.Services.IEmailService, InsiderThreat.Server.Services.EmailService>();
// ==========================================

// ==========================================
// 7. CẤU HÌNH SIGNALR
// ==========================================
builder.Services.AddSignalR();
// ==========================================

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

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

app.MapControllers();
app.Run();