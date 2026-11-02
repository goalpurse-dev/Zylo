# Zyvo Studio: starts the laptop worker (the Studio tab's jobs wait until this runs). Keeps the laptop awake while it
# is open (sleep kills a render); close the window to stop it. Started by the desktop file "Zyvo Studio Worker.cmd".
$root = "C:/Users/Public/Zylo-contentmachine/content/studio-worker"
$env:PROTO_DIR = "$root/proto"
$env:PICS_DIR = "$root/pool"
$env:STUDIO_SCRATCH = "$root/scratch"
$env:SRC_WORK = "$root/src_work"
$env:ESRGAN_DIR = "$root/esrgan"
$env:KITS_DIR = "$root/kits"
$env:PATH = "C:\Program Files\Git\usr\bin;C:\Program Files\Git\bin;$env:PATH"   # buildShort.sh needs Git's bash, not WSL's

$sig = '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
$k = Add-Type -MemberDefinition $sig -Name KeepAwake -Namespace Studio -PassThru
$null = $k::SetThreadExecutionState(2147483649)   # ES_CONTINUOUS | ES_SYSTEM_REQUIRED: the screen may sleep, the laptop won't

# one worker at a time (two would fight over the same files)
$already = Get-CimInstance Win32_Process -Filter "name='node.exe'" | Where-Object { $_.CommandLine -match 'worker\.mjs' }
if ($already) { Write-Host "The Studio worker is already running in another window. Nothing to do here."; exit 0 }

$host.UI.RawUI.WindowTitle = "Zyvo Studio worker (close to stop)"
Set-Location "C:/Users/Public/Zylo-contentmachine/scripts/studio"
& node worker.mjs @args
