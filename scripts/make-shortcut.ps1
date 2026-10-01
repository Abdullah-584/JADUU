# Creates a JADUU desktop shortcut (Windows).
# Target: node.exe -> scripts/launch.mjs (spawns Electron detached and exits).
$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node.exe).Source
$launcher = Join-Path $projectRoot "scripts\launch.mjs"
$icon = Join-Path $projectRoot "assets\icon.ico"
if (-not (Test-Path $icon)) { $icon = $null }

$desktop = [Environment]::GetFolderPath("Desktop")
$lnkPath = Join-Path $desktop "JADUU.lnk"

$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($lnkPath)
$lnk.TargetPath = $node
$lnk.Arguments = "`"$launcher`""
$lnk.WorkingDirectory = $projectRoot
$lnk.Description = "JADUU - Apki soch ka digital saathi"
if ($icon) { $lnk.IconLocation = "$icon,0" }
$lnk.WindowStyle = 7  # minimized flash only; the launcher exits immediately
$lnk.Save()

Write-Host "Created: $lnkPath"
