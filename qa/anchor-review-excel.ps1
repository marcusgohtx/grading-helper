$ErrorActionPreference = 'Stop'
$outputDirectory = Join-Path $PSScriptRoot 'anchor-review-output'
$results = [System.Collections.Generic.List[object]]::new()
$excelApplication=$null
$nativeBook=$null
function Assert-Result($name,$actual,$expected) {
 $passed=if($null -eq $expected){$null -eq $actual -or $actual -eq ''}else{$actual -is [double] -and [Math]::Abs($actual-$expected) -lt 0.000000001}
 $results.Add(@{name=$name;actual=$actual;expected=$expected;passed=$passed})
}
try {
 $excelApplication=New-Object -ComObject Excel.Application
 $excelApplication.Visible=$false
 $excelApplication.DisplayAlerts=$false
 $excelApplication.AutomationSecurity=3
 $nativeBook=$excelApplication.Workbooks.Open((Join-Path $outputDirectory 'standard.xlsx'),0,$false)
 $roster=$nativeBook.Worksheets.Item('Students')
 $grading=$nativeBook.Worksheets.Item('Grading')
 $cases=@(
  @{Name='Weighted';Scores=@(32,36,10,20);Expected=52.16666666666667},
  @{Name='Full';Scores=@(40,40,20,20);Expected=60},
  @{Name='Zero';Scores=@(0,0,0,0);Expected=0},
  @{Name='Partial';Scores=@(32,$null,10,20);Expected=$null},
  @{Name='Numeric text';Scores=@('32',36,10,20);Expected=$null},
  @{Name='Text';Scores=@('absent',36,10,20);Expected=$null},
  @{Name='Error';Scores=@('=1/0',36,10,20);Expected=$null},
  @{Name='Boolean';Scores=@($true,36,10,20);Expected=$null},
  @{Name='Too high';Scores=@(41,36,10,20);Expected=$null},
  @{Name='Negative';Scores=@(-1,36,10,20);Expected=$null},
  @{Name='Fraction';Scores=@(32.5,36,10,20);Expected=$null},
  @{Name=$null;Scores=@(40,40,20,20);Expected=$null}
 )
 for($i=0;$i -lt $cases.Count;$i++) {
  $case=$cases[$i]
  if($null -ne $case.Name){$roster.Cells.Item($i+8,2).Value2=$case.Name}
  foreach($j in 0..3){
   $value=$case.Scores[$j];if($null -eq $value){continue}
   $cell=$grading.Cells.Item(@(11,16,23,26)[$j],$i+4)
   if($value -is [string]){if($value.StartsWith('=')){$cell.Formula=$value}else{$cell.Formula="'"+$value}}
   elseif($value -is [bool]){$cell.Formula='=TRUE()'}else{$cell.Value2=[double]$value}
  }
 }
 foreach($i in @(49,99)){
  $roster.Cells.Item($i+8,2).Value2="Student $($i+1)"
  $roster.Cells.Item($i+8,3).Value2="00$($i+1)"
  foreach($r in @(11,16)){$grading.Cells.Item($r,$i+4).Value2=[double]40}
  foreach($r in @(23,26)){$grading.Cells.Item($r,$i+4).Value2=[double]20}
 }
 $excelApplication.CalculateFullRebuild()
 $roster.Cells.Item(8,3).Value2='0001'
 $excelApplication.CalculateFullRebuild()
 $results.Add(@{name='First student link and ID';actual=$grading.Range('D7').Value2;id=$grading.Range('D8').Value2;passed=($grading.Range('D7').Value2 -eq 'Weighted' -and $grading.Range('D8').Value2 -ceq '0001')})
 foreach($i in 0..($cases.Count-1)){Assert-Result $cases[$i].Name $grading.Cells.Item(33,$i+4).Value2 $cases[$i].Expected}
 Assert-Result 'Research 32 and 36, weights 1 and 2' $grading.Cells.Item(31,4).Value2 (104/3)
 foreach($i in @(49,99)){
  Assert-Result "Student $($i+1) total" $grading.Cells.Item(33,$i+4).Value2 60
  $results.Add(@{name="Student $($i+1) link and ID";actual=$grading.Cells.Item(7,$i+4).Value2;id=$grading.Cells.Item(8,$i+4).Value2;passed=($grading.Cells.Item(7,$i+4).Value2 -eq "Student $($i+1)" -and $grading.Cells.Item(8,$i+4).Value2 -ceq "00$($i+1)")})
 }
 $results.Add(@{name='Whole-number validation';passed=($grading.Range('D11').Validation.Type -eq 1 -and $grading.Range('D11').Validation.Formula2 -eq '40')})
 $results.Add(@{name='Protected cells and editable score';passed=($grading.Range('D11').Locked -eq $false -and $grading.Range('D31').Locked -eq $true -and $grading.Range('A12').Locked -eq $true)})
 $nativeBook.SaveAs((Join-Path $outputDirectory 'native-evaluated.xlsx'),51)
 $nativeBook.Close($false);$nativeBook=$null
 $nativeBook=$excelApplication.Workbooks.Open((Join-Path $outputDirectory 'decimal.xlsx'),0,$false)
 $nativeBook.Worksheets.Item('Students').Range('B8').Value2='Decimals'
 $grading=$nativeBook.Worksheets.Item('Grading')
 $grading.Range('D11').Value2=[double]10.25
 $grading.Range('D12').Value2=[double]20.5
 $excelApplication.CalculateFullRebuild()
 Assert-Result 'Unanchored fractional scores and parent max' $grading.Cells.Item($grading.UsedRange.Rows.Count,4).Value2 17.9375
 $results.Add(@{name='Decimal validation';passed=($grading.Range('D11').Validation.Type -eq 2 -and $grading.Range('D11').Validation.Formula2 -eq '20.5')})
 $nativeBook.Close($false);$nativeBook=$null
 $nativeBook=$excelApplication.Workbooks.Open((Join-Path $outputDirectory 'limit200.xlsx'),0,$false)
 $nativeBook.Worksheets.Item('Students').Range('B8').Value2='Boundary 200'
 $grading=$nativeBook.Worksheets.Item('Grading')
 foreach($i in 0..199){$grading.Cells.Item(11+$i*13,4).Value2=[double]11}
 $excelApplication.CalculateFullRebuild()
 Assert-Result '200 items, 12 bands native full score' $grading.Cells.Item(2614,4).Value2 11
 foreach($i in 0..199){$grading.Cells.Item(11+$i*13,4).Value2=[double](10+($i%2))}
 $excelApplication.CalculateFullRebuild()
 Assert-Result '200 items mixed weights and scores' $grading.Cells.Item(2614,4).Value2 10.75
 $grading.Cells.Item(11+199*13,4).Value2=[double]10.5
 $excelApplication.CalculateFullRebuild()
 Assert-Result '200 items native fractional rejection' $grading.Cells.Item(2614,4).Value2 $null
 $grading.Cells.Item(11+199*13,4).Formula='=TRUE()'
 $excelApplication.CalculateFullRebuild()
 Assert-Result '200 items native boolean rejection' $grading.Cells.Item(2614,4).Value2 $null
 $nativeBook.Close($false);$nativeBook=$null
}finally{
 if($null -ne $nativeBook){$nativeBook.Close($false)}
 if($null -ne $excelApplication){$excelApplication.Quit();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excelApplication)}
}
$results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outputDirectory 'native-results.json')
$results | ConvertTo-Json -Depth 5
if(@($results | Where-Object {!$_.passed}).Count -gt 0){throw 'Native Excel checks failed.'}
