using MongoDB.Driver;
using MongoDB.Bson; // Thêm cái này để làm việc với dữ liệu linh động
using InsiderThreat.Shared;

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

app.MapControllers();
app.Run();