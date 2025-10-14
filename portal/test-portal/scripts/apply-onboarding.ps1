# Applies the onboarding config for Goals/Needs to the portal API reliably from PowerShell
Param(
    [string]$ApiUrl = "http://localhost:4001/api/onboarding",
    [string]$ConfigPath = "onboarding.goals-needs.json"
)

Write-Host "Applying onboarding from '$ConfigPath' to $ApiUrl" -ForegroundColor Cyan

$BodyObject = @{ path = $ConfigPath }
$Json = $BodyObject | ConvertTo-Json -Depth 5

try {
    $Response = Invoke-RestMethod -UseBasicParsing -Uri $ApiUrl -Method POST -Body $Json -ContentType 'application/json'
    $Response | ConvertTo-Json -Depth 10
} catch {
    Write-Error $_
    exit 1
}
