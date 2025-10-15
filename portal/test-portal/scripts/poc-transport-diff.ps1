Param(
  [ValidateSet('mcp-only','server-only','both')]
  [string]$Mode = 'server-only',
  [int]$TimeoutSec = 15
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here '..')
Set-Location $root

function Start-NodeProcess {
  param(
    [Parameter(Mandatory=$true)][string]$Entry,
    [Parameter(Mandatory=$true)][string]$Name
  )
  Write-Host "Starting $Name ($Entry)" -ForegroundColor Cyan
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = 'node'
  $psi.Arguments = $Entry
  $psi.WorkingDirectory = $root
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  [void]$p.Start()
  # Pump a little output asynchronously
  $outHandler = { param($sender,$args) if ($args.Data) { Write-Host "[$Name] $($args.Data)" } }
  $errHandler = { param($sender,$args) if ($args.Data) { Write-Warning "[$Name] $($args.Data)" } }
  $p.BeginOutputReadLine()
  $p.BeginErrorReadLine()
  $p.add_OutputDataReceived($outHandler)
  $p.add_ErrorDataReceived($errHandler)
  return $p
}

function Wait-RestApiReady {
  param([int]$Seconds = 15)
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $resp = Invoke-RestMethod -UseBasicParsing -Uri 'http://localhost:4001/api/test-cases' -Method GET -TimeoutSec 3
      if ($resp) { return $true }
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Stop-IfRunning {
  param([System.Diagnostics.Process]$Proc, [string]$Name)
  if ($null -ne $Proc -and -not $Proc.HasExited) {
    Write-Host "Stopping $Name (PID $($Proc.Id))" -ForegroundColor Yellow
    try { $Proc.Kill(); $Proc.WaitForExit(5000) } catch {}
  }
}

$serverProc = $null
$mcpProc = $null

try {
  switch ($Mode) {
    'mcp-only' {
      $mcpProc = Start-NodeProcess -Entry 'server/mcpServer.js' -Name 'mcp'
      Start-Sleep -Seconds 2
      $apiReady = Wait-RestApiReady -Seconds $TimeoutSec
      if ($apiReady) {
        Write-Host 'REST API unexpectedly reachable in mcp-only mode.' -ForegroundColor Red
      } else {
        Write-Host 'As expected, REST API is NOT reachable when only MCP server is running.' -ForegroundColor Green
      }
    }
    'server-only' {
      $serverProc = Start-NodeProcess -Entry 'server/index.js' -Name 'api'
      if (Wait-RestApiReady -Seconds $TimeoutSec) {
        $cases = Invoke-RestMethod -UseBasicParsing -Uri 'http://localhost:4001/api/test-cases' -Method GET
        Write-Host "REST API OK. Found $($cases.value.Count) test cases." -ForegroundColor Green
      } else {
        Write-Host 'REST API did not become ready in time.' -ForegroundColor Red
      }
    }
    'both' {
      $serverProc = Start-NodeProcess -Entry 'server/index.js' -Name 'api'
      $mcpProc = Start-NodeProcess -Entry 'server/mcpServer.js' -Name 'mcp'
      if (Wait-RestApiReady -Seconds $TimeoutSec) {
        $cases = Invoke-RestMethod -UseBasicParsing -Uri 'http://localhost:4001/api/test-cases' -Method GET
        Write-Host "REST API OK (with MCP also running). Found $($cases.value.Count) test cases." -ForegroundColor Green
        Write-Host 'Note: Runs triggered via MCP will appear here because both share the same DB/artifacts.' -ForegroundColor DarkGray
      } else {
        Write-Host 'REST API did not become ready in time.' -ForegroundColor Red
      }
    }
  }
}
finally {
  Stop-IfRunning -Proc $mcpProc -Name 'mcp'
  Stop-IfRunning -Proc $serverProc -Name 'api'
}
