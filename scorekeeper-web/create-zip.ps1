param([switch]$Prod)

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$dist = Join-Path $root 'dist'
$tmp = Join-Path $root 'dist-zip-temp'

if(Test-Path $tmp){ Remove-Item $tmp -Recurse -Force }
Copy-Item $dist $tmp -Recurse

if($Prod){
  # Inject a small script to force production DB selection at runtime
  $index = Join-Path $tmp 'index.html'
  (Get-Content $index) -replace '<script src="app-v4.js"></script>', '<script>window.FORCE_PROD=true;</script>`n<script src="app-v4.js"></script>' | Set-Content $index
  $zipName = 'scorekeeper-dist-v1.2.6.zip'
} else {
  $zipName = 'scorekeeper-dist-v1.2.6-test.zip'
}

$zip = Join-Path $root $zipName
if(Test-Path $zip){ Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $tmp '*') -DestinationPath $zip
Remove-Item $tmp -Recurse -Force
Write-Host "Created $zip"