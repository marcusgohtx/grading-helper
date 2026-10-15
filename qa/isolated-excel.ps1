param([Parameter(Mandatory=$true)][string]$OutputDirectory, [switch]$Probe)
$ErrorActionPreference='Stop'
Add-Type -Path (Join-Path $PSScriptRoot 'DesktopIsolation.cs')
$OutputDirectory=(Resolve-Path -LiteralPath $OutputDirectory).Path
$desktopName='grading-helper-'+[Guid]::NewGuid().ToString('N')
$desktop=[IntPtr]::Zero; $worker=$null; $exitCode=1
try {
    $desktop=[DesktopIsolation]::NewDesktop($desktopName)
    $workerScript=Join-Path $PSScriptRoot 'isolated-excel-worker.ps1'
    $probeArgument=if ($Probe) {' -Probe'} else {''}
    $arguments='-NoProfile -NonInteractive -STA -ExecutionPolicy Bypass -File "'+$workerScript+'" -OutputDirectory "'+$OutputDirectory+'" -DesktopName "'+$desktopName+'"'+$probeArgument
    $worker=[DesktopIsolation]::Start((Join-Path $PSHOME 'powershell.exe'),$arguments,$desktopName,$PSScriptRoot)
    Write-Host 'Native tests are isolated on an off-screen Windows desktop.'
    $exitCode=$worker.Wait($(if ($Probe) {30000} else {600000}))
    $reportPath=Join-Path $OutputDirectory 'isolation-results.json'
    if (!(Test-Path -LiteralPath $reportPath)) { throw 'Isolated worker returned no isolation report.' }
    $report=Get-Content -LiteralPath $reportPath -Raw | ConvertFrom-Json
    $report | Add-Member -NotePropertyName workerExited -NotePropertyValue $true -Force
    $report | ConvertTo-Json | Set-Content -LiteralPath $reportPath -Encoding UTF8
    if (!$report.passed) {
        if ($report.error) { throw $report.error }
        throw 'Native assertions failed; see native-excel-results.json in the output directory.'
    }
    if (!$Probe -and $exitCode -eq 0) {
        $native=Get-Content -LiteralPath (Join-Path $OutputDirectory 'native-excel-results.json') -Raw | ConvertFrom-Json
        Write-Host "Native Excel: $($native.checks) checks, exit $($native.exitCode)."
    }
} catch { Write-Host "Isolated Excel failed: $($_.Exception.Message)"; $exitCode=1 }
finally {
    if ($null -ne $worker) { $worker.Dispose() }
    if ($desktop -ne [IntPtr]::Zero) { [void][DesktopIsolation]::CloseDesktop($desktop) }
}
exit $exitCode
