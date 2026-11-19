# A1 test: connect Roblox Studio to Claude Code (about 10 minutes, free)

You need: Windows 10/11 or macOS 13+, Roblox Studio (create.roblox.com), Claude Code.

## 1. System check
Windows (PowerShell): `powershell -ExecutionPolicy Bypass -File kits\zyvo-studio-kit\scripts\system_check.ps1`
macOS (Terminal): `bash kits/zyvo-studio-kit/scripts/system_check.sh`
Expect the last line `RESULT: ready` or `ready-with-warnings`.

## 2. Turn on Studio's MCP server
1. Open Roblox Studio > New > **Baseplate** (an empty, never-published place).
2. **Assistant** (top right) > **...** > **Settings** > **MCP Servers** (or the **MCP** button bottom right).
3. Turn on **Enable Studio as MCP server**.
4. **Quick connect** > turn on **Claude Code**.

## 3. Connect Claude Code
1. In a terminal: `cd C:\Users\Public\Zylo` and start `claude`.
2. Type `/mcp`. Roblox Studio must show as **connected**.
   - Quick connect registers the server ONLY for Claude Code started in your home folder (seen 2026-11-19:
     `C:\Users\<you>` only). Started anywhere else (e.g. `C:\Users\Public\Zylo`), it is not listed.
   - Not listed? Close Claude Code and run once (`--scope user` = every folder):
     Windows `claude mcp add --scope user Roblox_Studio -- cmd.exe /c %LOCALAPPDATA%\Roblox\mcp.bat`
     macOS `claude mcp add --scope user Roblox_Studio -- /Applications/RobloxStudio.app/Contents/MacOS/StudioMCP`
     then start `claude` again and check `/mcp`.

## 4. The test (paste this into Claude Code)

> Read kits/zyvo-studio-kit/reference/setup.md and run "3. The connection test" against my open Studio. Do not save
> or publish anything. Then list every Roblox Studio MCP tool you have (exact names, one line each) and write them to
> zyvo-project/tools.txt. Report: connected yes/no, the place name, the PlaceId, which test steps passed, and which of
> these exist: execute_luau, insert_asset, search_asset, screen_capture, start_stop_play, multi_edit.

## 5. Send me back
The report plus `zyvo-project/tools.txt`. If anything failed, the exact message.
