$ErrorActionPreference = 'Stop'
$outputDirectory = Join-Path $PSScriptRoot 'independent-output'
$excelApplication = $null
$nativeBook = $null
$results = [System.Collections.Generic.List[object]]::new()
try {
    $excelApplication = New-Object -ComObject Excel.Application
    $excelApplication.Visible = $false
    $excelApplication.DisplayAlerts = $false
    $excelApplication.AutomationSecurity = 3
    $nativeBook = $excelApplication.Workbooks.Open((Join-Path $outputDirectory 'standard.xlsx'), 0, $false)
    $studentsSheet = $nativeBook.Worksheets.Item('Students')
    $gradingSheet = $nativeBook.Worksheets.Item('Grading')
    $cases = @(
        @{ Name='Weighted'; Scores=@(80,60,90); Expected=83.33333333333333 },
        @{ Name='Zero'; Scores=@(0,0,0); Expected=0 },
        @{ Name='Partial'; Scores=@(80,$null,90); Expected=$null },
        @{ Name='Numeric text'; Scores=@('80',60,90); Expected=$null },
        @{ Name='Negative'; Scores=@(-1,60,90); Expected=$null },
        @{ Name='Too high'; Scores=@(101,60,90); Expected=$null },
        @{ Name='Decimal'; Scores=@(82.5,60.25,90.5); Expected=84.33333333333333 },
        @{ Name='Text'; Scores=@('absent',60,90); Expected=$null },
        @{ Name=$null; Scores=@(100,100,100); Expected=$null },
        @{ Name='Boolean'; Scores=@($true,60,90); Expected=$null },
        @{ Name='Error'; Scores=@('=1/0',60,90); Expected=$null }
    )
    for ($caseIndex=0; $caseIndex -lt $cases.Count; $caseIndex++) {
        $case = $cases[$caseIndex]
        $columnIndex = $caseIndex + 4
        if ($null -ne $case.Name) { $studentsSheet.Cells.Item($caseIndex+8,2).Value2 = $case.Name }
        for ($scoreIndex=0; $scoreIndex -lt 3; $scoreIndex++) {
            $score = $case.Scores[$scoreIndex]
            $scoreRow = @(11,12,15)[$scoreIndex]
            if ($null -eq $score) { continue }
            $cell = $gradingSheet.Cells.Item($scoreRow,$columnIndex)
            if ($score -is [string]) {
                if ($score.StartsWith('=')) { $cell.Formula = $score }
                else { $cell.Formula = "'" + $score }
            } elseif ($score -is [bool]) { $cell.Formula = '=TRUE()' }
            else { $cell.Value2 = [double]$score }
        }
    }
    foreach ($studentIndex in @(49,99)) {
        $studentsSheet.Cells.Item($studentIndex+8,2).Value2 = "Student $($studentIndex+1)"
        $studentsSheet.Cells.Item($studentIndex+8,3).Value2 = "00$($studentIndex+1)"
        foreach ($scoreRow in @(11,12,15)) { $gradingSheet.Cells.Item($scoreRow,$studentIndex+4).Value2 = [double]100 }
    }
    $excelApplication.CalculateFullRebuild()
    for ($caseIndex=0; $caseIndex -lt $cases.Count; $caseIndex++) {
        $case = $cases[$caseIndex]
        $actual = $gradingSheet.Cells.Item(20,$caseIndex+4).Value2
        $passed = if ($null -eq $case.Expected) { $null -eq $actual -or $actual -eq '' } else { $actual -is [double] -and [Math]::Abs($actual-$case.Expected) -lt 0.000000001 }
        $results.Add(@{ name=$case.Name; actual=$actual; expected=$case.Expected; passed=$passed })
    }
    foreach ($studentIndex in @(49,99)) {
        $results.Add(@{ name="Student $($studentIndex+1) mapping"; actual=$gradingSheet.Cells.Item(7,$studentIndex+4).Value2; id=$gradingSheet.Cells.Item(8,$studentIndex+4).Value2; total=$gradingSheet.Cells.Item(20,$studentIndex+4).Value2; passed=($gradingSheet.Cells.Item(20,$studentIndex+4).Value2 -eq 100 -and $gradingSheet.Cells.Item(7,$studentIndex+4).Value2 -eq "Student $($studentIndex+1)") })
    }
    $nativeBook.SaveAs((Join-Path $outputDirectory 'native-evaluated.xlsx'),51)
    $nativeBook.Close($false)
    $nativeBook = $null
    foreach ($edgeName in @('large-weight','tiny-weight','large-marks','tiny-marks')) {
        $edgePath = Join-Path $outputDirectory "$edgeName.xlsx"
        if (!(Test-Path -LiteralPath $edgePath)) { continue }
        try {
            $nativeBook = $excelApplication.Workbooks.Open($edgePath,0,$false)
            $nativeBook.Worksheets.Item('Students').Cells.Item(8,2).Value2 = 'Boundary'
            $edgeSheet = $nativeBook.Worksheets.Item('Grading')
            $edgeSheet.Cells.Item(11,4).Value2 = [double]100
            if ($edgeName -eq 'large-weight') { $edgeSheet.Cells.Item(12,4).Value2 = [double]100 }
            $excelApplication.CalculateFullRebuild()
            $lastRow = $edgeSheet.UsedRange.Rows.Count
            $results.Add(@{ name=$edgeName; row=$lastRow; marks=$edgeSheet.Cells.Item(10,3).Value2; weight=$edgeSheet.Cells.Item(11,2).Value2; total=$edgeSheet.Cells.Item($lastRow,4).Value2; totalText=$edgeSheet.Cells.Item($lastRow,4).Text })
        } catch { $results.Add(@{name=$edgeName;error=$_.Exception.Message}) }
        finally { if ($null -ne $nativeBook) { $nativeBook.Close($false); $nativeBook=$null } }
    }
} finally {
    if ($null -ne $nativeBook) { $nativeBook.Close($false) }
    if ($null -ne $excelApplication) { $excelApplication.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excelApplication) }
}
$results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputDirectory 'native-results.json')
$results | ConvertTo-Json -Depth 5
if (@($results | Where-Object { $_.ContainsKey('passed') -and !$_.passed }).Count -gt 0) { throw 'Native Excel scenario failed.' }
