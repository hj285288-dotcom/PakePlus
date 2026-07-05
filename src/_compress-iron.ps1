# Compress GLB files in iron-core (有铁芯直线电机模型) folder
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$root = 'C:\Users\65464\Documents\neonmotion\cyberpunk'
$folder = Join-Path $root 'motor-models\iron-core'
$backup = Join-Path $folder '_backup'

if (-not (Test-Path $backup)) { New-Item -ItemType Directory -Path $backup | Out-Null }

$files = Get-ChildItem -Path $folder -Filter '*.glb' -File
Write-Host "Found $($files.Count) GLB files"

foreach ($f in $files) {
    $name = $f.Name
    $bakPath = Join-Path $backup $name
    if (-not (Test-Path $bakPath)) {
        Copy-Item -Path $f.FullName -Destination $bakPath -Force
    }
    $sizeBefore = (Get-Item $f.FullName).Length
    Write-Host "=== $name ($([math]::Round($sizeBefore/1024,1)) KB) ==="
    & npx gltf-transform meshopt $f.FullName $f.FullName --level medium 2>&1 | ForEach-Object {
        if ($_ -match 'info:|error:') { Write-Host $_ }
    }
    $sizeAfter = (Get-Item $f.FullName).Length
    $pct = [math]::Round((1 - $sizeAfter/$sizeBefore) * 100, 1)
    Write-Host "  $([math]::Round($sizeBefore/1024,1)) KB -> $([math]::Round($sizeAfter/1024,1)) KB (-$pct%)"
}

Write-Host "Done."
