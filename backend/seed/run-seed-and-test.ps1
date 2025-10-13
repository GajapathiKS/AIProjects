param(
    [string]$SqlFile = "$PSScriptRoot\..\src\SpecialPrograms.Api\seed\seed_specialprograms.sql",
    [string]$SqlInstance = "(localdb)\\MSSQLLocalDB",
    [string]$Database = "SpecialProgramsDb",
    [string]$ApiUrl = "https://localhost:7140"
)

Write-Host "Running seed SQL: $SqlFile against instance $SqlInstance"

# Use the provided SqlInstance directly. This script no longer attempts to manage LocalDB instances or named pipes.
$sqlServerArg = $SqlInstance

Write-Host "Using sqlcmd server argument: $sqlServerArg"

# Try running sqlcmd with a few retries (helps transient connection issues)
$maxAttempts = 3
$attempt = 1
$success = $false
while (-not $success -and $attempt -le $maxAttempts) {
    try {
        Write-Host "Running sqlcmd attempt $attempt/$maxAttempts..."
        sqlcmd -S $sqlServerArg -i $SqlFile -b
        $success = $true
    } catch {
        Write-Warning "sqlcmd attempt $attempt failed: $_"
        $attempt++
        Start-Sleep -Seconds 1
    }
}
if (-not $success) {
    Write-Error "Failed to run seed SQL after $maxAttempts attempts. Aborting."
    return
}

Write-Host "Waiting 1s for DB to settle..."
Start-Sleep -Seconds 1

# Test login
$login = @{ username = 'admin'; password = 'ChangeMe123!' } | ConvertTo-Json
Write-Host "POST $ApiUrl/api/auth/login"

# Trust dev certificate for this session
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }

try {
    $resp = Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/auth/login" -ContentType 'application/json' -Body $login -TimeoutSec 10
    Write-Host "Login successful. Token:" $resp.token
} catch {
    Write-Host "Login test failed:"
    if ($_.Exception.Response) {
        $r = $_.Exception.Response
        $sr = New-Object System.IO.StreamReader($r.GetResponseStream())
        Write-Host $sr.ReadToEnd()
    } else { Write-Host $_ }
}
