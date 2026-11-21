-- Zyvo Studio Kit: THE END CARD SET (run with execute_luau in Edit, after the cast and the shot list are in the place).
-- Only when the end card is ON (Free / Starter plans, or Zyvo not connected: SKILL.md step 8). The video ends with a
-- 2 s card: the cast lined up on a clean dark stage + the words "Made with Zyvo AI · tryzyvo.com". The WORDS are
-- added later by ffmpeg (scripts/add_captions.sh, or Zyvo's finish); this builds only the picture: a dark floor and
-- backdrop with a lime strip (Zyvo's colours), one copy of each main character's statue (the hero in the middle, the
-- others in a V behind), the top third of the 9:16 frame left empty for the words, and the camera spot "endcard".
-- Fill STATUES (statue names under workspace.ZyvoStory.Cast, hero first, one per character, standing looks; up to 6).
-- Then add the LAST shot to shots.json / luau/shotlist.luau, right after the story's last shot:
--   { id = <n>, kind = "endcard", location = "endcard", spot = "endcard", size = "wide", lens = 32, move = "push_slow",
--     t0 = <the last shot's t1>, t1 = <that + 2.0>, actions = {} }
local STATUES = {
	-- "Mo_street", "Pell_class", "Gran_kitchen",
}
local ORIGIN = Vector3.new(0, 0, 6000) -- far from every location (never in another shot's background)

local V, C = Vector3.new, Color3.fromRGB
local DARK, FLOOR, LIME = C(11, 13, 15), C(24, 28, 26), C(190, 242, 100)
local story = workspace:FindFirstChild("ZyvoStory")
if not story or not story:FindFirstChild("Cast") then return { ok = false, why = "no workspace.ZyvoStory.Cast yet: build the cast first" } end
local cast = story.Cast
local function folder(parent, name)
	local f = parent:FindFirstChild(name) or Instance.new("Folder")
	f.Name = name; f.Parent = parent; return f
end
local blockout, spots = folder(story, "Blockout"), folder(story, "Spots")

-- 1. the stage (re-running replaces it)
local old = blockout:FindFirstChild("endcard"); if old then old:Destroy() end
local set = Instance.new("Folder"); set.Name = "endcard"; set:SetAttribute("Origin", ORIGIN); set.Parent = blockout
local function box(name, size, pos, color, material)
	local p = Instance.new("Part")
	p.Name, p.Size, p.CFrame = name, size, CFrame.new(ORIGIN + pos)
	p.Anchored, p.CanCollide = true, false
	p.TopSurface, p.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	p.Color, p.Material = color, material or Enum.Material.SmoothPlastic
	p.Parent = set
	return p
end
box("ground", V(90, 1, 60), V(0, -0.5, -10), FLOOR)
box("backdrop", V(90, 70, 1), V(0, 35, -16), DARK)
box("lime_strip", V(90, 0.5, 0.3), V(0, 0.25, -15.3), LIME, Enum.Material.Neon)
box("lime_floor_line", V(90, 0.06, 0.4), V(0, 0.03, 4), LIME, Enum.Material.Neon)
-- a soft key light from the front, so every face reads on the dark stage
local key = box("key_light", V(1, 1, 1), V(0, 14, 14), DARK)
key.Transparency, key.CanQuery = 1, false
local light = Instance.new("SpotLight"); light.Face = Enum.NormalId.Front; light.Angle = 80; light.Range = 40; light.Brightness = 3
light.Parent = key
key.CFrame = CFrame.lookAt(key.Position, ORIGIN + V(0, 2.5, 0))

-- 2. the line-up: copies of the statues in the state they have at the END of the story (what the shot list hides at
--    the end, e.g. an old number plate, is left out of the copy)
local hidden = {}
local shotsModule = game.ReplicatedStorage:FindFirstChild("ZyvoShots")
if shotsModule then
	local m = shotsModule:Clone(); m.Parent = game.ServerStorage
	local ok, data = pcall(require, m); m:Destroy()
	if ok and type(data) == "table" then
		local function find(n) return n and (cast:FindFirstChild(n) or story:FindFirstChild(n, true)) end
		for _, n in ipairs(data.startHidden or {}) do local i = find(n); if i then hidden[i] = true end end
		local evs = {}
		for _, s in ipairs(data.shots or {}) do
			for _, a in ipairs(s.actions or {}) do
				local d = a["do"]
				if (d == "show" or d == "hide") and a.what then table.insert(evs, { (s.t0 or 0) + (a.at or 0), a.what, d == "show" }) end
			end
		end
		table.sort(evs, function(x, y) return x[1] < y[1] end)
		for _, e in ipairs(evs) do local i = find(e[2]); if i then hidden[i] = (not e[3]) or nil end end
	end
end
local BODY = { Head = true, UpperTorso = true, LowerTorso = true, HumanoidRootPart = true, Humanoid = true, Animator = true }
local lineup = cast:FindFirstChild("endcard"); if lineup then lineup:Destroy() end
lineup = Instance.new("Model"); lineup.Name = "endcard"; lineup.Parent = cast

local made, problems = {}, {}
-- the V: the hero in front in the middle, then right / left, one rank further back each pair
local slots = { V(0, 0, 0), V(3.2, 0, -2.4), V(-3.2, 0, -2.4), V(6.4, 0, -4.8), V(-6.4, 0, -4.8), V(9.6, 0, -7.2) }
for i, name in ipairs(STATUES) do
	if i > #slots then table.insert(problems, "more than " .. #slots .. " statues: " .. name .. " left out"); break end
	local src = cast:FindFirstChild(name, true)
	if not (src and src:IsA("Model") and src:FindFirstChild("Head")) then table.insert(problems, "no statue " .. tostring(name)); continue end
	-- mark what is hidden at the end, copy, unmark
	local marked = {}
	for _, d in ipairs(src:GetDescendants()) do
		local a, h = d, false
		while a and a ~= src.Parent do if hidden[a] then h = true; break end; a = a.Parent end
		if h then d:SetAttribute("ZyEndHidden", true); table.insert(marked, d) end
	end
	local m = src:Clone()
	for _, d in ipairs(marked) do d:SetAttribute("ZyEndHidden", nil) end
	for _, d in ipairs(m:GetDescendants()) do
		if d.Parent and d:GetAttribute("ZyEndHidden") then d:Destroy() end
	end
	-- new names, so no show / hide / walk of the story ever finds the copy instead of the original
	m.Name = "End_" .. name
	for _, d in ipairs(m:GetDescendants()) do
		if not BODY[d.Name] and not d.Name:match("Arm$") and not d.Name:match("Leg$") and not d.Name:match("Hand$") and not d.Name:match("Foot$") and not d:IsA("JointInstance") and not d:IsA("Attachment") and d.Name ~= "ZyvoOnHead" then
			d.Name = "End_" .. d.Name
		end
	end
	m:SetAttribute("Extra", nil)
	m:SetAttribute("Life", m:GetAttribute("Life") == "sleep" and "idle" or (m:GetAttribute("Life") or "idle"))
	for _, p in ipairs(m:GetDescendants()) do if p:IsA("BasePart") then p.Anchored = true; p.CanCollide = false end end
	-- face the camera (+Z), stand on the stage
	local hrp = m:FindFirstChild("HumanoidRootPart")
	local look = hrp and hrp.CFrame.LookVector or V(0, 0, -1)
	local yawNow = math.atan2(-look.X, -look.Z)
	local pv = m:GetPivot()
	local slot = ORIGIN + slots[i]
	m:PivotTo(CFrame.new(slot + V(0, pv.Position.Y, 0)) * CFrame.Angles(0, math.pi - yawNow, 0) * (pv - pv.Position))
	local minY = math.huge
	for _, p in ipairs(m:GetDescendants()) do if p:IsA("BasePart") and p.Name ~= "HumanoidRootPart" then minY = math.min(minY, p.Position.Y - p.Size.Y / 2) end end
	if minY < math.huge then m:PivotTo(m:GetPivot() + V(0, ORIGIN.Y - minY, 0)) end
	m.Parent = lineup
	table.insert(made, m.Name)
end

-- 3. the camera spot: straight on, everybody in the frame with a margin, the top third empty for the words
local n = math.max(1, #made)
local halfW = 2.2 + (n >= 4 and 6.4 or n >= 2 and 3.2 or 0) + (n >= 6 and 3.2 or 0)
local lens = 32
local tanV = 12 / lens
local frameH = math.max((halfW * 2 * 1.12) * 16 / 9, 6.2 / 0.6) -- the width fits, and the tallest (~6 studs) sits in the lower 60%
local d = (frameH / 2) / tanV
local centerY = ORIGIN.Y - 0.4 + frameH / 2
local target = ORIGIN + V(0, centerY - ORIGIN.Y, -2.4)
local pos = target + V(0, 0, d)
local sp = spots:FindFirstChild("endcard"); if sp then sp:Destroy() end
sp = Instance.new("Part")
sp.Name, sp.Size, sp.CFrame = "endcard", V(1, 1, 1), CFrame.lookAt(pos, target)
sp.Anchored, sp.CanCollide, sp.CanQuery, sp.CanTouch, sp.Transparency = true, false, false, false, 1
sp:SetAttribute("Lens", lens); sp:SetAttribute("Dist", d); sp:SetAttribute("Target", target)
sp.Parent = spots

return { ok = #problems == 0 and #made > 0, lineup = made, spot = "endcard", problems = problems,
	next = "add the endcard shot (kind = \"endcard\", spot = \"endcard\", 2.0 s after the last shot), then check it with frame_check (subjects = the End_ statues, size wide) and take its contact-sheet still" }
