# Start all services for development
Write-Host "Starting DIT VDI Development Server" -ForegroundColor Green

# Start Django with Daphne (WebSocket)
Write-Host "Starting Daphne..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .\venv\Scripts\daphne -p 8000 config.asgi:application"

# Start Celery Worker
Write-Host "Starting Celery Worker..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .\venv\Scripts\celery -A config worker --loglevel=info --pool=solo"

# Note: --pool=solo is required on Windows
# Linux/Mac use --pool=prefork

# Start React Frontend  
Write-Host "Starting Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "All services starting..." -ForegroundColor Green
Write-Host "Django: http://localhost:8000"
Write-Host "React:  http://localhost:5173"
