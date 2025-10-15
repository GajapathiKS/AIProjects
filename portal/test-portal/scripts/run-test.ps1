Param(
    [Parameter(Mandatory=$true)][int]$Id,
    [string]$ApiUrl = "http://localhost:4001/api/test-cases",
    [string]$TriggeredBy = "portal",
    [string]$AuthToken = ""
)

$Body = @{ triggeredBy = $TriggeredBy }
if ($AuthToken -ne "") { $Body.authToken = $AuthToken }
$Json = $Body | ConvertTo-Json -Depth 5

$RunUrl = "$ApiUrl/$Id/run"
Write-Host "Starting run: $RunUrl" -ForegroundColor Cyan

try {
    $Response = Invoke-RestMethod -UseBasicParsing -Uri $RunUrl -Method POST -Body $Json -ContentType 'application/json'
    $Response | ConvertTo-Json -Depth 10
} catch {
    Write-Error $_
    exit 1
}
