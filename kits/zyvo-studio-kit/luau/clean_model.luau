-- Zyvo Studio Kit: clean an inserted model RIGHT AFTER insert_asset (run with execute_luau in Edit).
-- Deletes every Script, LocalScript and ModuleScript (free models can hide backdoors), every Sound (no audio in the
-- footage), anchors its parts and moves it into workspace.ZyvoStory.Assets. Fill MODEL_NAME (the inserted model's
-- name in Workspace, as insert_asset reported it) and optional NEW_NAME.
local MODEL_NAME = "Model"
local NEW_NAME = nil

local story = workspace:FindFirstChild("ZyvoStory") or Instance.new("Folder")
story.Name = "ZyvoStory"
story.Parent = workspace
local assets = story:FindFirstChild("Assets") or Instance.new("Folder")
assets.Name = "Assets"
assets.Parent = story

local model = workspace:FindFirstChild(MODEL_NAME)
if not model then
	return { ok = false, why = "no '" .. MODEL_NAME .. "' directly in Workspace" }
end

local removed = { scripts = 0, sounds = 0, other = 0 }
local doomed = {}
for _, d in ipairs(model:GetDescendants()) do
	if d:IsA("LuaSourceContainer") then -- Script, LocalScript, ModuleScript
		removed.scripts += 1
		table.insert(doomed, d)
	elseif d:IsA("Sound") or d:IsA("SoundGroup") or d:IsA("SoundEffect") then
		removed.sounds += 1
		table.insert(doomed, d)
	elseif d:IsA("ClickDetector") or d:IsA("ProximityPrompt") or d:IsA("BillboardGui") or d:IsA("RemoteEvent") or d:IsA("RemoteFunction") then
		removed.other += 1 -- interaction and network bits a scenery model never needs
		table.insert(doomed, d)
	end
end
for _, d in ipairs(doomed) do
	d:Destroy()
end
for _, d in ipairs(model:GetDescendants()) do
	if d:IsA("BasePart") then
		d.Anchored = true
	end
end
if NEW_NAME then
	model.Name = NEW_NAME
end
model.Parent = assets
return { ok = true, name = model.Name, removed = removed }
