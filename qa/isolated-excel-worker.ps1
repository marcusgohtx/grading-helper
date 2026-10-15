param([Parameter(Mandatory=$true)][string]$OutputDirectory,[Parameter(Mandatory=$true)][string]$DesktopName,[switch]$Probe)
$ErrorActionPreference='Stop'
Add-Type -Path (Join-Path $PSScriptRoot 'DesktopIsolation.cs')
$report=@{passed=$false;desktop=[DesktopIsolation]::CurrentDesktop();inputDesktop=[DesktopIsolation]::InputDesktop()}
$ownedExcel=$null; $exitCode=1
try {
    if ($report.desktop -ne $DesktopName -or $report.desktop -eq $report.inputDesktop) { throw 'Worker desktop isolation failed.' }
    if ($Probe) {
        Add-Type -AssemblyName System.Windows.Forms
        $form=New-Object Windows.Forms.Form
        try {
            $form.Text='Disposable isolation test'; $form.Show()
            [void][DesktopIsolation]::ShowWindow($form.Handle,5)
            [Windows.Forms.Application]::DoEvents()
            $report.probeVisibleOnIsolatedDesktop=[DesktopIsolation]::IsWindowVisible($form.Handle)
            if ([DesktopIsolation]::WindowDesktop($form.Handle) -ne $DesktopName) { throw 'Probe escaped isolation.' }
            $report.passed=$report.probeVisibleOnIsolatedDesktop; $exitCode=0
        } finally { $form.Close(); $form.Dispose() }
    } else {
        $excelPath=(Get-ItemProperty 'Registry::HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\excel.exe' -ErrorAction SilentlyContinue).'(default)'
        if (!$excelPath -or !(Test-Path -LiteralPath $excelPath)) { throw 'Microsoft Excel is not installed or registered.' }
        # /x prevents reuse of user Excel. Attach by this process's EXCEL7 window,
        # rather than COM activation, which can start a server on the default desktop.
        $fixture=Join-Path $OutputDirectory 'bands-0.xlsx'
        $ownedExcel=[DesktopIsolation]::Start($excelPath,('/x /automation "'+$fixture+'"'),$DesktopName,$OutputDirectory)
        $deadline=[DateTime]::UtcNow.AddSeconds(45); $window=$null
        while ($null -eq $window -and [DateTime]::UtcNow -lt $deadline) {
            $window=[DesktopIsolation]::ExcelWindow($ownedExcel.Id)
            if ($null -eq $window) { Start-Sleep -Milliseconds 200 }
        }
        if ($null -eq $window) { throw 'Could not attach to the isolated Excel process.' }
        $application=$window.Application
        $handle=[IntPtr]$application.Hwnd
        if ([DesktopIsolation]::WindowProcess($handle) -ne $ownedExcel.Id -or [DesktopIsolation]::WindowDesktop($handle) -ne $DesktopName) { throw 'Excel ownership or desktop isolation failed.' }
        $application.Visible=$false; $application.DisplayAlerts=$false
        $application.Workbooks.Item(1).Close($false)
        $report.excelProcessId=$ownedExcel.Id; $report.excelDesktop=[DesktopIsolation]::WindowDesktop($handle)
        & (Join-Path $PSScriptRoot 'native-excel.ps1') -OutputDirectory $OutputDirectory -ExcelApplication $application -IsolatedDesktop $DesktopName
        $exitCode=$LASTEXITCODE
        $report.passed=$exitCode -eq 0
    }
} catch { $report.error=$_.Exception.ToString(); $exitCode=1 }
finally {
    if ($null -ne $ownedExcel) { $ownedExcel.Dispose() }
    $report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'isolation-results.json') -Encoding UTF8
}
exit $exitCode
