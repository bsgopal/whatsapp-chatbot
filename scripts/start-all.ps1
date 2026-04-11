$repoRoot = Split-Path -Parent $PSScriptRoot

$services = @(
  @{
    Name = "Backend API"
    Path = Join-Path $repoRoot "backend"
    Command = "npm run dev"
  },
  @{
    Name = "Python Bot"
    Path = Join-Path $repoRoot "python-chatbot"
    Command = "py -3 -m uvicorn app:app --host 127.0.0.1 --port 8001 --reload"
  },
  @{
    Name = "WhatsApp Bridge"
    Path = Join-Path $repoRoot "python-chatbot"
    Command = "npm start"
  },
  @{
    Name = "Frontend"
    Path = Join-Path $repoRoot "frontend"
    Command = "npm run dev"
  }
)

Write-Host "Starting WA Appt OS services..." -ForegroundColor Green

foreach ($service in $services) {
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$($service.Path)'; $($service.Command)"
}

Write-Host ""
Write-Host "All services launched in separate PowerShell windows." -ForegroundColor Cyan
Write-Host "Frontend:        http://localhost:3000" -ForegroundColor Yellow
Write-Host "Backend API:     http://localhost:5000" -ForegroundColor Yellow
Write-Host "Python bot:      http://localhost:8001" -ForegroundColor Yellow
Write-Host "WhatsApp bridge: http://localhost:3001" -ForegroundColor Yellow
