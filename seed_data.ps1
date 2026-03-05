
# 1. Register Admin User
$registerBody = @{
    Username = "admin"
    Password = "admin123"
    FullName = "System Administrator"
    Role = "Admin"
} | ConvertTo-Json

Write-Host "Registering admin user..." -ForegroundColor Cyan
$registerResponse = Invoke-RestMethod -Uri "http://localhost:5038/api/auth/register" -Method Post -Body $registerBody -ContentType "application/json"
Write-Host ($registerResponse | ConvertTo-Json)

# 2. Seed Social Data
Write-Host "`nSeeding social data..." -ForegroundColor Cyan
try {
    $seedResponse = Invoke-RestMethod -Uri "http://localhost:5038/api/Seed/social-from-users" -Method Post
    Write-Host ($seedResponse | ConvertTo-Json)
} catch {
    Write-Host "Error seeding social data: $_" -ForegroundColor Red
}

Write-Host "`nDatabase seeding complete!" -ForegroundColor Green
