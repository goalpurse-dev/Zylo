-- Zyvo Studio Kit: install the director (run with execute_luau in Edit). Paste the full text of
-- runtime/ZyvoCamera.client.luau into CLIENT, runtime/ZyvoActions.server.luau into SERVER and
-- runtime/ZyvoLife.client.luau into LIFE (between the [==[ ]==]).
-- It also turns off instance streaming (far-apart locations must all be loaded in Play) and the player's name tags.
-- If setting Source is refused here, create the scripts with multi_edit instead (same paths, same text):
-- StarterPlayer.StarterPlayerScripts.ZyvoCamera and .ZyvoLife (LocalScript), ServerScriptService.ZyvoActions (Script).
local CLIENT = [==[
-- paste runtime/ZyvoCamera.client.luau here
]==]
local SERVER = [==[
-- paste runtime/ZyvoActions.server.luau here
]==]
local LIFE = [==[
-- paste runtime/ZyvoLife.client.luau here
]==]

local notes = {}
local okStream = pcall(function() workspace.StreamingEnabled = false end)
if not okStream then table.insert(notes, "turn off Workspace > StreamingEnabled by hand (Properties)") end

local function put(class, parent, name, source)
	local s = parent:FindFirstChild(name)
	if s and not s:IsA(class) then s:Destroy(); s = nil end
	s = s or Instance.new(class)
	s.Name = name
	local ok, err = pcall(function() s.Source = source end)
	if not ok then return false, tostring(err) end
	s.Parent = parent
	return true
end
local sps = game:GetService("StarterPlayer"):WaitForChild("StarterPlayerScripts")
local ok1, e1 = put("LocalScript", sps, "ZyvoCamera", CLIENT)
local ok2, e2 = put("Script", game:GetService("ServerScriptService"), "ZyvoActions", SERVER)
local ok3, e3 = put("LocalScript", sps, "ZyvoLife", LIFE)
if not ok1 then table.insert(notes, "ZyvoCamera: " .. e1 .. " (use multi_edit)") end
if not ok2 then table.insert(notes, "ZyvoActions: " .. e2 .. " (use multi_edit)") end
if not ok3 then table.insert(notes, "ZyvoLife: " .. e3 .. " (use multi_edit)") end
local full = #CLIENT >= 500 and #SERVER >= 500 and #LIFE >= 500
if not full then table.insert(notes, "the pasted scripts look empty: paste the runtime files") end
return { ok = ok1 and ok2 and ok3 and full, notes = notes }
