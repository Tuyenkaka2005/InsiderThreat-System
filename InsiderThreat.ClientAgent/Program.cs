using InsiderThreat.ClientAgent;

var builder = Host.CreateApplicationBuilder(args);

// Đăng ký HttpClient
builder.Services.AddHttpClient();

// Đăng ký Service giám sát USB
builder.Services.AddHostedService<UsbMonitorService>();

var host = builder.Build();
host.Run();