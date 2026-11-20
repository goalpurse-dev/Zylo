-- Zyvo Studio Kit: THE PREVIEW (ModuleScript game.ServerStorage.ZyvoPreview, edit-time only; never runs in Play).
-- preview(K, F) puts the scene in the state of shot K at fraction F of it (who is shown or hidden then) and sets the
-- lens; restore() puts every part back and gives the user their editor camera. Used for the contact sheet
-- (reference/recording.md): preview, then screen_capture from the spot, one shot at a time, then restore.
-- Visibility is the same rule as runtime/ZyvoActions: a part shows only while NOTHING it belongs to is hidden (each
-- named thing keeps its own latest show/hide), so showing a whole statue never un-hides a plate that starts hidden.
-- Floating labels (BillboardGuis) are drawn upright here, as the final video shows them (the Play run turns them
-- with the camera roll: runtime/ZyvoCamera).
-- 1.3.0: P.plan() lists the stills to take for the contact sheet, fastest order first (shots that share a camera spot,
-- lens and scene state reuse one still; a new preview() is needed only when the state or the lens changes), and
-- P.clean() clears Studio's selection (no move / rotate arrows in a still or in the recording). preview() and
-- restore() clean too.
-- Install: multi_edit, file_path game.ServerStorage.ZyvoPreview, className ModuleScript, the full text of this file.
local story = workspace.ZyvoStory
local P = {}
function P.clean()
	pcall(function() game:GetService("Selection"):Set({}) end)
end
function P.restore()
	P.clean()
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
local function load()
	local m = game.ReplicatedStorage.ZyvoShots:Clone(); m.Parent = game.ServerStorage
	local data = require(m); m:Destroy()
	return data
end
-- each named thing's state at tNow: startHidden, then every show / hide up to tNow in time order (walk, face and
-- jump have no `what` and change nobody's visibility)
local function stateAt(data, tNow)
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
	return hidden, touched
end
local function fovOf(lens) return math.deg(2 * math.atan(12 / math.max(8, lens or 35))) end
function P.preview(K, F)
	P.restore()
	local data = load()
	local shot = data.shots[K]
	local tNow = shot.t0 + (shot.t1 - shot.t0) * (F or 0.5)
	local hidden, touched = stateAt(data, tNow)
	for i in pairs(touched) do
		apply(i, hidden)
		for _, d in ipairs(i:GetDescendants()) do apply(d, hidden) end
	end
	local sp = story.Spots[shot.spot]
	workspace.CurrentCamera.FieldOfView = fovOf(sp:GetAttribute("Lens"))
	local t = sp:GetAttribute("Target")
	return string.format("shot %d %s: [%.2f, %.2f, %.2f] -> [%.2f, %.2f, %.2f]", K, shot.spot, sp.Position.X, sp.Position.Y, sp.Position.Z, t.X, t.Y, t.Z)
end

-- the contact sheet's capture list. ONLY (optional): a list of shot numbers (a re-take of the changed shots only).
-- Returns text, one line per still to take, in the fastest order:
--   "PREP 12" = run preview(12, 0.5) first (the scene state or the lens changed), then
--   "CAP 12 [x, y, z] -> [x, y, z]" = screen_capture from that position looking at that point,
-- and a last line "REUSE 14=12 21=12 ..." (those shots use the still of the shot after "=").
function P.plan(ONLY)
	local data = load()
	local want
	if ONLY then want = {}; for _, k in ipairs(ONLY) do want[k] = true end end
	local setups, order, reuse = {}, {}, {}
	for k, shot in ipairs(data.shots) do
		if not want or want[k] then
			local sp = story.Spots:FindFirstChild(shot.spot or "")
			if sp then
				local hidden = stateAt(data, shot.t0 + (shot.t1 - shot.t0) * 0.5)
				local names = {}
				for i in pairs(hidden) do table.insert(names, i:GetFullName()) end
				table.sort(names)
				local sig = table.concat(names, ",")
				local lens = sp:GetAttribute("Lens") or 35
				local key = shot.spot .. "|" .. lens .. "|" .. sig
				if setups[key] then table.insert(reuse, k .. "=" .. setups[key])
				else setups[key] = k; table.insert(order, { k = k, sig = sig, lens = lens, sp = sp }) end
			end
		end
	end
	table.sort(order, function(a, b)
		if a.sig ~= b.sig then return a.sig < b.sig end
		if a.lens ~= b.lens then return a.lens < b.lens end
		return a.k < b.k
	end)
	local out, lastSig, lastLens = {}, nil, nil
	for _, o in ipairs(order) do
		if o.sig ~= lastSig or o.lens ~= lastLens then table.insert(out, "PREP " .. o.k); lastSig, lastLens = o.sig, o.lens end
		local p, t = o.sp.Position, o.sp:GetAttribute("Target") or (o.sp.Position + o.sp.CFrame.LookVector * 10)
		table.insert(out, string.format("CAP %d [%.2f, %.2f, %.2f] -> [%.2f, %.2f, %.2f]", o.k, p.X, p.Y, p.Z, t.X, t.Y, t.Z))
	end
	table.insert(out, "REUSE " .. (#reuse > 0 and table.concat(reuse, " ") or "none"))
	return string.format("%d stills for %d shots\n", #order, #order + #reuse) .. table.concat(out, "\n")
end
return P
