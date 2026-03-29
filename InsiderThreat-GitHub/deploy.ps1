# ============================================
# InsiderThreat System - Deploy Script
# Usage: .\deploy.ps1
#        .\deploy.ps1 -frontend   (chỉ deploy frontend)
#        .\deploy.ps1 -backend    (chỉ deploy backend)
# ============================================

param(
    [switch]$frontend,
    [switch]$backend
)

$SERVER = "root@150.95.104.244"
$ROOT = $PSScriptRoot

$deployAll = -not $frontend -and -not $backend
$deployFrontend = $deployAll -or $frontend
$deployBackend = $deployAll -or $backend

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "   InsiderThreat Deploy Script       " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# ---- FRONTEND ----
if ($deployFrontend) {
    Write-Host "[1/4] Building frontend..." -ForegroundColor Yellow
    Set-Location "$ROOT\src\InsiderThreat.Web"
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Frontend build FAILED!" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Frontend built successfully" -ForegroundColor Green

    Write-Host "[2/4] Uploading frontend to server..." -ForegroundColor Yellow
    scp -r dist\* "${SERVER}:/var/www/insiderthreat-web"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Frontend upload FAILED!" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Frontend uploaded" -ForegroundColor Green
}

# ---- BACKEND ----
if ($deployBackend) {
    Write-Host "[3/4] Publishing backend..." -ForegroundColor Yellow
    Set-Location "$ROOT\src\InsiderThreat.Server"
    dotnet publish -c Release -r linux-x64 --self-contained false -o ./publish /p:TreatWarningsAsErrors=false
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Backend publish FAILED!" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Backend published" -ForegroundColor Green

    Write-Host "[4/4] Uploading backend to server..." -ForegroundColor Yellow
    scp -r publish\* "${SERVER}:/root/insiderthreat-server"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Backend upload FAILED!" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Backend uploaded" -ForegroundColor Green
}

# ---- SERVER TASKS ----
Write-Host ""
Write-Host "Applying changes on server..." -ForegroundColor Yellow

$serverCmd = ""
if ($deployFrontend) {
    $serverCmd += "chown -R www-data:www-data /var/www/insiderthreat-web; chmod -R 755 /var/www/insiderthreat-web; "
}
if ($deployBackend) {
    $serverCmd += "systemctl restart insiderthreat; sleep 2; systemctl is-active insiderthreat; "
}

if ($serverCmd) {
    ssh $SERVER $serverCmd
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Green
Write-Host "   ✅ Deploy hoàn tất!               " -ForegroundColor Green
Write-Host "   🌐 http://150.95.104.244          " -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

Set-Location $ROOT
