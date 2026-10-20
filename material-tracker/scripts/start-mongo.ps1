# Starts the portable local MongoDB server (no admin rights required).
$ErrorActionPreference = 'Stop'
$mongod = Get-ChildItem -Recurse "$env:LOCALAPPDATA\mongodb-portable" -Filter mongod.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $mongod) { throw "mongod.exe not found under $env:LOCALAPPDATA\mongodb-portable" }

$dbPath = "$env:LOCALAPPDATA\mongodb-data\db"
$logPath = "$env:LOCALAPPDATA\mongodb-data\mongod.log"
New-Item -ItemType Directory -Force -Path $dbPath | Out-Null

$listening = Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue
if ($listening) { Write-Host "MongoDB already running on port 27017"; return }

Start-Process -FilePath $mongod.FullName -ArgumentList "--dbpath `"$dbPath`" --bind_ip 127.0.0.1 --port 27017 --logpath `"$logPath`" --logappend" -WindowStyle Hidden
Start-Sleep -Seconds 3
Write-Host "MongoDB started (data: $dbPath)"
