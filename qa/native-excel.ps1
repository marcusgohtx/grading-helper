param([Parameter(Mandatory=$true)][string]$OutputDirectory,
      [Parameter(Mandatory=$true)][object]$ExcelApplication,
      [Parameter(Mandatory=$true)][string]$IsolatedDesktop)
$ErrorActionPreference = 'Stop'
if ([DesktopIsolation]::CurrentDesktop() -ne $IsolatedDesktop -or $IsolatedDesktop -eq [DesktopIsolation]::InputDesktop()) {
    throw 'Native Excel tests require an isolated desktop. Use isolated-excel.ps1.'
}
$results = New-Object 'System.Collections.Generic.List[object]'
$excel = $ExcelApplication
$book = $null
$exitCode = 0
$timer = [Diagnostics.Stopwatch]::StartNew()
function Check($name, $passed, $actual = $null, $expected = $null) {
    $results.Add([pscustomobject]@{ name=$name; passed=[bool]$passed; actual=$actual; expected=$expected })
}
function Verify($name, $actual, $expected) {
    $passed = if ($null -eq $expected) { $null -eq $actual -or $actual -ceq '' } else { $actual -is [double] -and [Math]::Abs($actual - $expected) -lt 0.00000001 }
    Check $name $passed $actual $expected
}
function FindRows($label) {
    $found = @()
    $lastRow = $sheet.UsedRange.Rows.Count
    $names = $sheet.Range("A1:A$lastRow").Value2
    for ($r=1; $r -le $lastRow; $r++) { if ($names[$r,1] -ceq $label) { $found += $r } }
    return $found
}
function Row($label) { $found = @(FindRows $label); if ($found.Count -ne 1) { throw "Expected one row labelled '$label', found $($found.Count)." }; return $found[0] }
function Summary($label) { $found = @(FindRows $label); if ($found.Count -ne 2) { throw "Expected heading and summary for '$label'." }; return $found[1] }
function Recalculate { $excel.Calculate() }
function SetInput($cell, $value) {
    $cell.ClearContents() | Out-Null
    if ($null -ne $value) {
        if ($value -is [string] -and ($value.StartsWith('=') -or $value.StartsWith("'"))) { $cell.Formula = $value }
        elseif ($value -is [string]) { $cell.Value2 = $value }
        else { $cell.Value2 = [double]$value }
    }
}
try {
    $OutputDirectory = (Resolve-Path -LiteralPath $OutputDirectory).Path
    if ($null -ne $excel) {
        $excel.Visible=$false; $excel.DisplayAlerts=$false; $excel.AutomationSecurity=3; $excel.EnableEvents=$false
        foreach ($fixture in @((0..12 | ForEach-Object { "bands-$_.xlsx" })) + @('decimal.xlsx','capacity.xlsx')) {
            Write-Host "Native Excel: $fixture"
            $book=$excel.Workbooks.Open((Join-Path $OutputDirectory $fixture),0,$false)
            if ([DesktopIsolation]::WindowDesktop([IntPtr]$excel.Hwnd) -ne $IsolatedDesktop) { throw 'Excel left its isolated desktop.' }
            $students=$book.Worksheets.Item('Students'); $sheet=$book.Worksheets.Item('Grading')
            foreach ($position in @(1,50,100)) { $students.Cells.Item($position+8,2).Value2="QA student $position" }
            Recalculate
            $excel.CalculateFullRebuild()
            $headerWidth=$sheet.UsedRange.Columns.Count
            $headerValues=$sheet.Range($sheet.Cells.Item(7,1),$sheet.Cells.Item(7,$headerWidth)).Value2
            $columns=@()
            foreach ($position in @(1,50,100)) {
                $matches=@(); for ($c=1; $c -le $headerWidth; $c++) { if ($headerValues[1,$c] -ceq "QA student $position") { $matches += $c } }
                if ($matches.Count -ne 1) { throw "$fixture roster header $position was not linked correctly." }; $columns += $matches[0]
            }
            $sheet.Activate() | Out-Null
            Check "$fixture freeze panes" ($excel.ActiveWindow.FreezePanes -and $excel.ActiveWindow.SplitRow -eq 8 -and $excel.ActiveWindow.SplitColumn -eq 3)
            Check "$fixture worksheet protection" $sheet.ProtectContents
            $decimal=$fixture -eq 'decimal.xlsx'; $capacity=$fixture -eq 'capacity.xlsx'
            $exampleColumn=$columns[0]-1
            Check "$fixture Example roster" ($students.Cells.Item(8,2).Value2 -ceq 'Example' -and $sheet.Cells.Item(7,$exampleColumn).Value2 -ceq 'Example')
            $sampleTotal=if ($capacity) {7.5625} elseif ($decimal) {14.09375} else {40.4166666666667}
            Verify "$fixture Example calculated total" $sheet.Cells.Item((Row 'Final total'),$exampleColumn).Value2 $sampleTotal
            Verify "$fixture untouched real student has no total" $sheet.Cells.Item((Row 'Final total'),($columns[0]+1)).Value2 $null
            if ($capacity) { $labels=1..200 | ForEach-Object { "Item$_" }; $component='Capacity'; $before=10.75; $after=2150.0/203; $insertWeight=3; $insertScore=0 }
            elseif ($decimal) { $labels=@('First','Second'); $component='Decimal'; $before=17.9375; $after=41.875/5; $insertWeight=3; $insertScore=2 }
            else { $labels=@('Evidence','Analysis'); $component='Research'; $before=20; $after=14; $insertWeight=3; $insertScore=8 }
            foreach ($label in $labels) {
                $r=Row $label
                if ($capacity) { $score=if ([int]$label.Substring(4)%2 -eq 1) {10} else {11} }
                elseif ($decimal) { $score=if ($label -eq 'First') {10.25} else {20.5} }
                else { $score=if ($label -eq 'Evidence') {10} else {25} }
                foreach ($c in $columns) { $sheet.Cells.Item($r,$c).Value2=[double]$score }
            }
            if (!$decimal -and !$capacity) { foreach ($label in @('Insight','Plan')) { $r=Row $label; $score=if ($label -eq 'Insight') {8} else {16}; foreach ($c in $columns) { $sheet.Cells.Item($r,$c).Value2=[double]$score } } }
            Recalculate
            foreach ($c in $columns) { Verify "$fixture initial component column $c" $sheet.Cells.Item((Summary $component),$c).Value2 $before; if (!$decimal -and !$capacity) { Verify "$fixture initial total column $c" $sheet.Cells.Item((Row 'Final total'),$c).Value2 34 } }
            $first=Row $labels[0]
            # Existing scores must recalculate when a valid weight changes midway through marking.
            if (!$decimal -and !$capacity) {
                $sheet.Cells.Item((Row 'Analysis'),$columns[2]).ClearContents() | Out-Null
                $sheet.Cells.Item($first,2).Value2=[double]3
                Recalculate
                foreach ($c in $columns[0..1]) {
                    Verify "$fixture reweighted component column $c" $sheet.Cells.Item((Summary 'Research'),$c).Value2 16
                    Verify "$fixture reweighted final column $c" $sheet.Cells.Item((Row 'Final total'),$c).Value2 30
                    Verify "$fixture reweighted other category column $c" $sheet.Cells.Item((Summary 'Reflection'),$c).Value2 14
                    Verify "$fixture reweight preserves Evidence column $c" $sheet.Cells.Item($first,$c).Value2 10
                    Verify "$fixture reweight preserves Analysis column $c" $sheet.Cells.Item((Row 'Analysis'),$c).Value2 25
                }
                Verify "$fixture reweight incomplete component" $sheet.Cells.Item((Summary 'Research'),$columns[2]).Value2 $null
                Verify "$fixture reweight incomplete final" $sheet.Cells.Item((Row 'Final total'),$columns[2]).Value2 $null
                $sheet.Cells.Item((Row 'Analysis'),$columns[2]).Value2=[double]25
                Recalculate
                Verify "$fixture completed after reweight" $sheet.Cells.Item((Row 'Final total'),$columns[2]).Value2 30
                $sheet.Cells.Item($first,2).Value2=[double]0.5
                Recalculate
                foreach ($c in $columns) { Verify "$fixture fractional weight final column $c" $sheet.Cells.Item((Row 'Final total'),$c).Value2 36 }
                $sheet.Cells.Item($first,2).Value2=[double]1
                Recalculate
                foreach ($c in $columns) { Verify "$fixture restored weight final column $c" $sheet.Cells.Item((Row 'Final total'),$c).Value2 34 }
            }
            Check "$fixture criterion editable" (!$sheet.Cells.Item($first,1).Locked -and !$sheet.Cells.Item($first,2).Locked -and !$sheet.Cells.Item($first,$columns[0]).Locked)
            Check "$fixture total locked" $sheet.Cells.Item((Row 'Final total'),$columns[0]).Locked
            $bandCount=if ($fixture -like 'bands-*') { [int]($fixture -replace 'bands-|\.xlsx','') } elseif ($capacity) {12} else {0}
            if ($bandCount -gt 0) { Check "$fixture anchor wraps and native height" ($sheet.Cells.Item($first,4).WrapText -and !$sheet.Cells.Item($first,4).Locked -and ($capacity -or $sheet.Rows.Item($first).RowHeight -gt $sheet.StandardHeight)) }
            $marker=@(FindRows 'Insert new criteria above this row')[0]
            $sheet.Rows.Item($marker).Insert(-4121,0) | Out-Null
            Recalculate
            Verify "$fixture blank inserted row blocks total" $sheet.Cells.Item((Row 'Final total'),$columns[0]).Value2 $null
            $sheet.Cells.Item($marker,1).Value2='Added criterion'; $sheet.Cells.Item($marker,2).Value2=[double]$insertWeight
            foreach ($c in $columns) { $sheet.Cells.Item($marker,$c).Value2=[double]$insertScore }
            Recalculate
            foreach ($c in $columns) { Verify "$fixture appended component column $c" $sheet.Cells.Item((Summary $component),$c).Value2 $after; if (!$decimal -and !$capacity) { Verify "$fixture appended final column $c" $sheet.Cells.Item((Row 'Final total'),$c).Value2 28 } }
            Check "$fixture inherited editable cells" (!$sheet.Cells.Item($marker,1).Locked -and !$sheet.Cells.Item($marker,2).Locked -and !$sheet.Cells.Item($marker,$columns[0]).Locked -and $sheet.Cells.Item($marker+1,1).Locked)
            $validation=$sheet.Cells.Item($marker,$columns[0]).Validation
            $expectedType=2
            $marks=if ($capacity) {11} elseif ($decimal) {20.5} else {40}
            Check "$fixture inherited score validation" ($validation.Type -eq $expectedType -and $validation.Operator -eq 1 -and [double]$validation.Formula1 -eq 0 -and [double]$validation.Formula2 -eq $marks)
            # COM writes simulate pasted values, bypassing the entry dialog. Validate both
            # the actual Excel rule and the visible conditional flag, then restore scores.
            foreach ($targetRow in @($first,$marker)) {
                foreach ($c in $columns) {
                    $target=$sheet.Cells.Item($targetRow,$c); $original=$target.Value2
                    Check "$fixture stop alert row $targetRow column $c" ($target.Validation.ShowError -and $target.Validation.AlertStyle -eq 1)
                    foreach ($case in @(@{value=0;valid=$true},@{value=0.5;valid=$true},@{value=0.25;valid=$true},@{value=$marks;valid=$true},@{value=-0.01;valid=$false},@{value=($marks+0.01);valid=$false},@{value='oops';valid=$false},@{value="'2";valid=$false},@{value='=TRUE()';valid=$false},@{value='=1/0';valid=$false},@{value=$null;valid=$true})) {
                        SetInput $target $case.value; Recalculate
                        Check "$fixture entry rule $($case.value) row $targetRow column $c" ($target.Validation.Value -eq $case.valid)
                        $red=$target.DisplayFormat.Interior.Color -eq 13551615
                        Check "$fixture visible flag $($case.value) row $targetRow column $c" ($red -eq !$case.valid) $target.DisplayFormat.Interior.Color $(if ($case.valid) {'not red'} else {13551615})
                        if (!$case.valid -or $null -eq $case.value) { Verify "$fixture invalid or missing score blocks total row $targetRow column $c" $sheet.Cells.Item((Row 'Final total'),$c).Value2 $null }
                    }
                    SetInput $target $original
                }
            }
            Recalculate
            $validation=$sheet.Cells.Item($marker,2).Validation
            Check "$fixture inherited weight validation" ($validation.Type -eq 2 -and $validation.Operator -eq 5 -and [double]$validation.Formula1 -eq 0)
            foreach ($case in @(@{name='missing name';column=1;value=$null},@{name='whitespace name';column=1;value='   '},@{name='missing weight';column=2;value=$null},@{name='zero weight';column=2;value=0},@{name='negative weight';column=2;value=-1},@{name='numeric text weight';column=2;value="'2"},@{name='boolean weight';column=2;value='=TRUE()'},@{name='error weight';column=2;value='=1/0'},@{name='missing score';column=$columns[0];value=$null},@{name='numeric text score';column=$columns[0];value="'2"},@{name='boolean score';column=$columns[0];value='=TRUE()'},@{name='error score';column=$columns[0];value='=1/0'},@{name='negative score';column=$columns[0];value=-1},@{name='excess score';column=$columns[0];value=($marks+1)})) {
                $sheet.Cells.Item($marker,1).Value2='Added criterion'; $sheet.Cells.Item($marker,2).Value2=[double]$insertWeight; $sheet.Cells.Item($marker,$columns[0]).Value2=[double]$insertScore
                SetInput ($sheet.Cells.Item($marker,$case.column)) $case.value
                Recalculate
                Verify "$fixture $($case.name) blocks final" $sheet.Cells.Item((Row 'Final total'),$columns[0]).Value2 $null
            }
            $sheet.Cells.Item($marker,$columns[0]).Value2=[double]0; Recalculate
            $zeroExpected=if ($capacity) {2150.0/203} elseif ($decimal) {35.875/5} else {10}
            Verify "$fixture zero accepted" $sheet.Cells.Item((Summary $component),$columns[0]).Value2 $zeroExpected
            $sheet.Cells.Item($marker,$columns[0]).Value2=[double]0.5; Recalculate
            $fractionExpected=if ($capacity) {2151.5/203} elseif ($decimal) {37.375/5} else {10.25}
            Verify "$fixture fractional policy" $sheet.Cells.Item((Summary $component),$columns[0]).Value2 $fractionExpected
            $sheet.Cells.Item($marker,$columns[0]).Value2=[double]$insertScore
            $middle=(Row $labels[0])+1
            $sheet.Rows.Item($middle).Insert(-4121,0) | Out-Null
            $sheet.Cells.Item($middle,1).Value2='Middle criterion'; $sheet.Cells.Item($middle,2).Value2=[double]1
            foreach ($c in $columns) { $sheet.Cells.Item($middle,$c).Value2=[double]$marks }
            Recalculate
            $middleExpected=if ($capacity) {2161.0/204} elseif ($decimal) {62.375/6} else {124.0/7}
            foreach ($c in $columns) { Verify "$fixture interior insertion column $c" $sheet.Cells.Item((Summary $component),$c).Value2 $middleExpected }
            $sheet.Cells.Item($middle,$columns[0]).Value2=[double]($marks+0.01); Recalculate
            Check "$fixture interior insertion invalid flag" ($sheet.Cells.Item($middle,$columns[0]).DisplayFormat.Interior.Color -eq 13551615)
            $sheet.Cells.Item($middle,$columns[0]).Value2=[double]$marks
            if (!$decimal -and !$capacity) {
                $plan=$sheet.Cells.Item((Row 'Plan'),$columns[0])
                $plan.Value2=[double]20.01; Recalculate
                Check "$fixture later category flag after row shifts" ($plan.DisplayFormat.Interior.Color -eq 13551615)
                Verify "$fixture later category invalid score blocks final" $sheet.Cells.Item((Row 'Final total'),$columns[0]).Value2 $null
                $plan.Value2=[double]16; Recalculate
                Check "$fixture corrected score clears flag" ($plan.DisplayFormat.Interior.Color -ne 13551615)
                Verify "$fixture corrected score restores final" $sheet.Cells.Item((Row 'Final total'),$columns[0]).Value2 (222.0/7)
            }
            $students.Cells.Item(9,2).ClearContents() | Out-Null
            Recalculate
            Verify "$fixture unnamed student blocks final" $sheet.Cells.Item((Row 'Final total'),$columns[0]).Value2 $null
            $students.Cells.Item(9,2).Value2='QA student 1'
            # Test legitimate zeros across every criterion and every component.
            foreach ($headingName in $(if ($decimal -or $capacity) { @($component) } else { @('Research','Reflection') })) {
                $heading=@(FindRows $headingName)[0]
                $end=@(FindRows 'Insert new criteria above this row' | Where-Object { $_ -gt $heading })[0]
                for ($r=$heading+1; $r -lt $end; $r++) { $sheet.Cells.Item($r,$columns[0]).Value2=[double]0 }
            }
            Recalculate
            Verify "$fixture all zero scores produce zero total" $sheet.Cells.Item((Row 'Final total'),$columns[0]).Value2 0
            $book.Close($false); $book=$null
        }
    }
} catch { $exitCode=1; Check 'Native Excel runtime' $false $_.Exception.Message } finally {
    if ($null -ne $book) { try { $book.Close($false) } catch { $exitCode=1; Check 'Close owned workbook' $false $_.Exception.Message } }
    if ($null -ne $excel) { try { $excel.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel) } catch { $exitCode=1; Check 'Close owned Excel instance' $false $_.Exception.Message } }
}
if (@($results | Where-Object { !$_.passed }).Count -gt 0) { $exitCode=1 }
$report=[pscustomobject]@{checks=$results.Count;exitCode=$exitCode;durationSeconds=[Math]::Round($timer.Elapsed.TotalSeconds,2);results=@($results.ToArray())}
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutputDirectory 'native-excel-results.json') -Encoding UTF8
[pscustomobject]@{checks=$report.checks;failed=@($results | Where-Object { !$_.passed }).Count;exitCode=$exitCode;durationSeconds=$report.durationSeconds;report=(Join-Path $OutputDirectory 'native-excel-results.json')} | ConvertTo-Json
exit $exitCode
