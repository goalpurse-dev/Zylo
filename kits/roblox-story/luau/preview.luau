-- Zyvo Studio Kit: THE PREVIEW (ModuleScript game.ServerStorage.ZyvoPreview, edit-time only; never runs in Play).
-- preview(K, F) puts the scene in the state of shot K at fraction F of it (who is shown or hidden then) and sets the
-- lens; restore() puts every part back and gives the user their editor camera. Used for the contact sheet
-- (reference/recording.md): preview, then screen_capture from the spot, one shot at a time, then restore.
-- Visibility is the same rule as runtime/ZyvoActions: a part shows only while NOTHING it belongs to is hidden (each
-- named thing keeps its own latest show/hide), so showing a whole statue never un-hides a plate that starts hidden.
-- Floating labels (BillboardGuis) are drawn upright here, as the final video shows them (the Play run turns them
-- with the camera roll: runtime/ZyvoCamera).
-- Install: multi_edit, file_path game.ServerStorage.ZyvoPreview, className ModuleScript, the full text of this file.
local story = workspace.ZyvoStory
local P = {}
function P.restore()
	for _, p in ipairs(story:GetDescendants()) do
		if (p:IsA("BasePart") or p:IsA("Decal")) and p:GetAttribute("ZyEditT") ~= nil then p.Transparency = p:GetAttribute("ZyEditT"); p:SetAttribute("ZyEditT", nil) end
		if p:IsA("LayerCollector") and p:GetAttribute("ZyEditE") ~= nil then p.Enabled = p:GetAttribute("ZyEditE"); p:SetAttribute("ZyEditE", nil) end
	end
	local cam = workspace.CurrentCamera
	cam.CameraType = Enum.CameraType.Fixed; cam.CameraSubject = nil; cam.FieldOfView = 70
end
local function find(n) return n and (story.Cast:FindFirstChild(n) or story:FindFirstChild(n, true)) end
local function hiddenBy(inst, hidden)
	while inst and inst ~= story do
		if hidden[inst] then return true end
		inst = inst.Parent
	end
	return false
end
-- one part / decal / gui: its own edit look, unless something it belongs to is hidden
local function apply(d, hidden)
	if d:IsA("BasePart") or d:IsA("Decal") then
		if d:GetAttribute("ZyEditT") == nil then d:SetAttribute("ZyEditT", d.Transparency) end
		d.Transparency = hiddenBy(d, hidden) and 1 or d:GetAttribute("ZyEditT")
	elseif d:IsA("SurfaceGui") or d:IsA("BillboardGui") then
		-- a gui on a hidden part (or itself hidden) draws nothing
		if d:GetAttribute("ZyEditE") == nil then d:SetAttribute("ZyEditE", d.Enabled) end
		local base = d.Adornee or d.Parent
		d.Enabled = d:GetAttribute("ZyEditE") and not hiddenBy(d, hidden) and not (base and base:IsA("BasePart") and hiddenBy(base, hidden))
	end
end
function P.preview(K, F)
	P.restore()
	local m = game.ReplicatedStorage.ZyvoShots:Clone(); m.Parent = game.ServerStorage
	local data = require(m); m:Destroy()
	local shot = data.shots[K]
	local tNow = shot.t0 + (shot.t1 - shot.t0) * (F or 0.5)
	-- each named thing's state at tNow: startHidden, then every show / hide up to tNow in time order (walk, face and
	-- jump have no `what` and change nobody's visibility)
	local hidden, touched = {}, {}
	for _, n in ipairs(data.startHidden or {}) do local i = find(n); if i then hidden[i] = true; touched[i] = true end end
	local evs = {}
	for _, s in ipairs(data.shots) do
		for _, a in ipairs(s.actions or {}) do
			local d = a["do"]
			if (d == "show" or d == "hide") and a.what and s.t0 + (a.at or 0) <= tNow then table.insert(evs, { s.t0 + (a.at or 0), a.what, d == "show" }) end
		end
	end
	table.sort(evs, function(x, y) return x[1] < y[1] end)
	for _, e in ipairs(evs) do local i = find(e[2]); if i then hidden[i] = (not e[3]) or nil; touched[i] = true end end
	for i in pairs(touched) do
		apply(i, hidden)
		for _, d in ipairs(i:GetDescendants()) do apply(d, hidden) end
	end
	local sp = story.Spots[shot.spot]
	workspace.CurrentCamera.FieldOfView = math.deg(2 * math.atan(12 / sp:GetAttribute("Lens")))
	local t = sp:GetAttribute("Target")
	return string.format("shot %d %s: [%.2f, %.2f, %.2f] -> [%.2f, %.2f, %.2f]", K, shot.spot, sp.Position.X, sp.Position.Y, sp.Position.Z, t.X, t.Y, t.Z)
end
return P
