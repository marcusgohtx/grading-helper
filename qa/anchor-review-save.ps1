$ErrorActionPreference='Stop'
$directory=Join-Path $PSScriptRoot 'anchor-review-output'
$excel=$null
$book=$null
try {
 $excel=New-Object -ComObject Excel.Application
 $excel.Visible=$false
 $excel.DisplayAlerts=$false
 $excel.AutomationSecurity=3
 $book=$excel.Workbooks.Open((Join-Path $directory 'standard.xlsx'),0,$false)
 $book.Worksheets.Item('Students').Range('B8').Value2='Saved QA'
 $sheet=$book.Worksheets.Item('Grading')
 foreach($r in @(11,16)){$sheet.Cells.Item($r,4).Value2=[double]40}
 foreach($r in @(23,26)){$sheet.Cells.Item($r,4).Value2=[double]20}
 $excel.CalculateFullRebuild()
 $savePath=Join-Path $directory 'native-saved.xlsx'
 $before=@{fullName=$book.FullName;saved=$book.Saved;readOnly=$book.ReadOnly;total=$sheet.Range('D33').Value2}
 $book.SaveCopyAs($savePath)
 $after=@{fullName=$book.FullName;saved=$book.Saved;exists=(Test-Path -LiteralPath $savePath)}
 $sheet.Range('A30:G33').ExportAsFixedFormat(0,(Join-Path $directory 'native-totals.pdf'))
 @{before=$before;after=$after;pdfExists=(Test-Path -LiteralPath (Join-Path $directory 'native-totals.pdf'))} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $directory 'save-results.json')
 Get-Content (Join-Path $directory 'save-results.json')
} finally {
 if($null -ne $book){$book.Close($false)}
 if($null -ne $excel){$excel.Quit();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($excel)}
}
