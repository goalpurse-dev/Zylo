-- Zyvo Studio Kit: THE PREVIEW (ModuleScript game.ServerStorage.ZyvoPreview, edit-time only; never runs in Play).
-- preview(K, F) puts the scene in the state of shot K at fraction F of it (who is shown or hidden then) and sets the
-- lens; restore() puts every part back and gives the user their editor camera. Used for the contact sheet
-- (reference/recording.md): preview, then screen_capture from the spot, one shot at a time, then restore.
-- Install: multi_edit, file_path game.ServerStorage.ZyvoPreview, className ModuleScript, the full text of this file.
local story = workspace.ZyvoStory
local P = {}
function P.restore()
	for _, p in ipairs(story:GetDescendants()) do
		if p:IsA("BasePart") and p:GetAttribute("ZyEditT") ~= nil then p.Transparency = p:GetAttribute("ZyEditT"); p:SetAttribute("ZyEditT", nil) end
		if (p:IsA("SurfaceGui") or p:IsA("BillboardGui")) and p:GetAttribute("ZyvoFollowPart") then p.Enabled = true end
	end
	local cam = workspace.CurrentCamera
	cam.CameraType = Enum.CameraType.Fixed; cam.CameraSubject = nil; cam.FieldOfView = 70
end
local function setVis(inst, shown)
	if not inst then return end
	local list = inst:IsA("BasePart") and { inst } or inst:GetDescendants()
	for _, p in ipairs(list) do
		if p:IsA("BasePart") then
			if p:GetAttribute("ZyEditT") == nil then p:SetAttribute("ZyEditT", p.Transparency) end
			p.Transparency = shown and p:GetAttribute("ZyEditT") or 1
		end
	end
	for _, g in ipairs(inst:GetDescendants()) do if (g:IsA("SurfaceGui") or g:IsA("BillboardGui")) and g:GetAttribute("ZyvoFollowPart") then g.Enabled = shown end end
end
local function find(n) return story.Cast:FindFirstChild(n) or story:FindFirstChild(n, true) end
function P.preview(K, F)
	P.restore()
	local m = game.ReplicatedStorage.ZyvoShots:Clone(); m.Parent = game.ServerStorage
	local data = require(m); m:Destroy()
	for _, n in ipairs(data.startHidden) do setVis(find(n), false) end
	local shot = data.shots[K]
	local tNow = shot.t0 + (shot.t1 - shot.t0) * (F or 0.5)
	for _, s in ipairs(data.shots) do
		for _, a in ipairs(s.actions) do if s.t0 + a.at <= tNow then setVis(find(a.what), a["do"] == "show") end end
	end
	local sp = story.Spots[shot.spot]
	workspace.CurrentCamera.FieldOfView = math.deg(2 * math.atan(12 / sp:GetAttribute("Lens")))
	local t = sp:GetAttribute("Target")
	return string.format("shot %d %s: [%.2f, %.2f, %.2f] -> [%.2f, %.2f, %.2f]", K, shot.spot, sp.Position.X, sp.Position.Y, sp.Position.Z, t.X, t.Y, t.Z)
end
return P
