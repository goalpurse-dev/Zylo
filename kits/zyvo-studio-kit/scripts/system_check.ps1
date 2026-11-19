# Zyvo Studio Kit: system check (Windows). Read-only: it changes nothing and sends nothing anywhere.
# powershell -ExecutionPolicy Bypass -File system_check.ps1
$fail = 0; $warn = 0
function Say($level, $what, $text) { Write-Output ("{0,-4} {1}: {2}" -f $level, $what, $text); if ($level -eq "FAIL") { $script:fail++ } elseif ($level -eq "WARN") { $script:warn++ } }

$os = [System.Environment]::OSVersion.Version
if ($os.Major -ge 10) { Say "OK" "OS" ("Windows " + $(if ($os.Build -ge 22000) { "11" } else { "10" }) + " (build $($os.Build))") } else { Say "FAIL" "OS" "Windows 10 or 11 is needed" }

$versions = Join-Path $env:LOCALAPPDATA "Roblox\Versions"
$studio = Get-ChildItem $versions -Recurse -Filter "RobloxStudioBeta.exe" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($studio) { Say "OK" "Roblox Studio" "found ($($studio.LastWriteTime.ToString('yyyy-MM-dd')))" } else { Say "FAIL" "Roblox Studio" "not found: install it from create.roblox.com, open it once, then run this again" }

$mcp = Join-Path $env:LOCALAPPDATA "Roblox\mcp.bat"
if (Test-Path $mcp) { Say "OK" "Studio MCP launcher" "found" } elseif ($studio) { Say "FAIL" "Studio MCP launcher" "missing: update Roblox Studio, open it, turn on 'Enable Studio as MCP server', then run this again" } else { Say "FAIL" "Studio MCP launcher" "missing (Studio not installed)" }

$ram = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB)
if ($ram -ge 16) { Say "OK" "RAM" "$ram GB" } elseif ($ram -ge 8) { Say "WARN" "RAM" "$ram GB: it works; close other apps while recording" } else { Say "FAIL" "RAM" "$ram GB: Studio needs at least 8 GB to record smoothly" }

$gpus = Get-CimInstance Win32_VideoController | Where-Object { $_.Name -and $_.Name -notmatch "Basic Display|Remote|Virtual" }
if (-not $gpus) { Say "FAIL" "GPU" "no graphics card found" }
elseif ($gpus | Where-Object { $_.Name -match "NVIDIA|Radeon RX|Radeon Pro|Arc" }) { Say "OK" "GPU" (($gpus | ForEach-Object { $_.Name }) -join ", ") }
else { Say "WARN" "GPU" ((($gpus | ForEach-Object { $_.Name }) -join ", ") + ": integrated graphics; keep the Studio window small while recording") }

$drive = (Get-Location).Drive
if ($drive) {
  $free = [math]::Round((Get-PSDrive $drive.Name).Free / 1GB)
  if ($free -ge 10) { Say "OK" "Free disk" "$free GB" } elseif ($free -ge 4) { Say "WARN" "Free disk" "$free GB: enough for a short recording" } else { Say "FAIL" "Free disk" "$free GB: free up at least 4 GB for the recording" }
}

$obs = Test-Path "$env:ProgramFiles\obs-studio"
$gamebar = Get-AppxPackage -Name "Microsoft.XboxGamingOverlay" -ErrorAction SilentlyContinue
if ($obs -or $gamebar) { Say "OK" "Screen recorder" ((@($(if ($gamebar) { "Xbox Game Bar (Win+Alt+R)" }), $(if ($obs) { "OBS" })) | Where-Object { $_ }) -join ", ") } else { Say "WARN" "Screen recorder" "none found: install OBS Studio (free) or turn on Xbox Game Bar" }

if ($fail -gt 0) { Write-Output "RESULT: not-ready" } elseif ($warn -gt 0) { Write-Output "RESULT: ready-with-warnings" } else { Write-Output "RESULT: ready" }
