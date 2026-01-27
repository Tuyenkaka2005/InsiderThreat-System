using InsiderThreat.ClientAgent;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddHostedService<UsbService>();

var host = builder.Build();
host.Run();
