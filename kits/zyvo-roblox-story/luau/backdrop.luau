-- Zyvo Studio Kit: THE PACKED WORLD (run with execute_luau in Edit, in the world step, after the location's own
-- models are in). So no shot shows an empty town or the edge of the world, every location gets, in EVERY direction a
-- camera can see:
--   * ground to the horizon (a 2048-stud plate under the set) and its roads carried on past the set's edge,
--   * 3 rings of background buildings: near (houses / shops with roofs, doors, windows, or copies of the cleaned free
--     models in ServerStorage.ZyvoLibrary), middle (plain houses), far (tall plain blocks: a skyline),
--   * distant hills all round (big soft shapes the haze fades),
--   * street dressing round the set and along the roads: lamps, trees, fences, benches, parked cars, mailboxes,
--   * background people on the pavements (crowd extras from ZyvoCastLib; never the story's cast).
-- Light for integrated GPUs: the rings, hills and far ground cast no shadow and have no collision or touch; every
-- repeated building is a copy of a few models. Re-running replaces that location's backdrop.
-- The street dressing goes in ZyvoStory.World.<loc>.Dressing (the framer checks it like any set piece: a lamp can't
-- block a face); the rings, hills, ground and people go in ZyvoStory.Backdrop.<loc> (the framer's world scan sees them).
-- Locations must be at least 3000 studs apart (luau/blockout.luau), so one location's hills never stand in another.
-- Fill LOCATIONS:
--   name, origin (the blockout's origin), set = Vector3 half-size of the set (the rings start outside it),
--   roads = { { dir = degrees (0 = +Z, 90 = +X), width = studs } }: kept clear of buildings, a road to the horizon,
--   night = true (the far windows light up: dusk / spooky), people = 0-16, style = "town" | "suburb" | "city",
--   models = { "ZyHouse1", ... } (optional: cleaned free models in ServerStorage.ZyvoLibrary for the near ring),
--   rings = { near = true, mid = true, far = true, hills = true, dressing = true } (an interior set may keep only
--   what its windows show), seed = a number (the same seed builds the same town).
local LOCATIONS = {
	-- { name = "main_street", origin = Vector3.new(3000, 0, 0), set = Vector3.new(60, 0, 60),
	--   roads = { { dir = 0, width = 24 }, { dir = 180, width = 24 } }, people = 10, style = "town", seed = 1 },
}

local V, C = Vector3.new, Color3.fromRGB
local story = workspace:FindFirstChild("ZyvoStory") or Instance.new("Folder")
story.Name = "ZyvoStory"; story.Parent = workspace
local function folder(parent, name)
	local f = parent:FindFirstChild(name) or Instance.new("Folder")
	f.Name = name; f.Parent = parent
	return f
end
local backdropRoot, worldRoot = folder(story, "Backdrop"), folder(story, "World")
local lib = game.ServerStorage:FindFirstChild("ZyvoLibrary")

local WALLS = { C(236, 214, 180), C(205, 128, 104), C(150, 182, 205), C(242, 232, 212), C(172, 202, 152), C(222, 172, 120), C(192, 192, 204), C(240, 196, 150) }
local ROOFS = { C(150, 70, 60), C(84, 84, 96), C(112, 82, 62), C(62, 92, 122), C(120, 60, 70) }
local GLASS_DAY, GLASS_NIGHT = C(70, 96, 130), C(255, 206, 130)

local function P(parent, name, size, cf, color, mat, shadow)
	local p = Instance.new("Part")
	p.Name, p.Size, p.CFrame, p.Color = name, size, cf, color
	p.Material = mat or Enum.Material.SmoothPlastic
	p.Anchored, p.CanCollide, p.CanTouch = true, false, false
	p.CastShadow = shadow == true
	p.TopSurface, p.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	p.Parent = parent
	return p
end

-- a building at the origin, its front facing -Z, standing on y = 0
local function building(kind, w, h, d, wall, roof, night)
	local m = Instance.new("Model"); m.Name = kind
	P(m, "body", V(w, h, d), CFrame.new(0, h / 2, 0), wall)
	local glass = night and GLASS_NIGHT or GLASS_DAY
	local gmat = night and Enum.Material.Neon or Enum.Material.SmoothPlastic
	if kind == "house" or kind == "shop" then
		-- a gable roof: a square bar turned 45 degrees on the top edge (its lower half sits inside the body)
		local a = (d + 1.6) / math.sqrt(2)
		P(m, "roof", V(w + 1.2, a, a), CFrame.new(0, h, 0) * CFrame.Angles(math.rad(45), 0, 0), roof)
		P(m, "door", V(2.6, 5, 0.3), CFrame.new(w * 0.22, 2.5, -d / 2 - 0.1), C(90, 60, 45))
		local rows = math.max(1, math.floor((h - 3) / 6))
		for r = 1, rows do
			for _, sx in ipairs({ -0.28, 0.0 }) do
				if not (r == 1 and sx == 0.0 and kind == "shop") then
					P(m, "window", V(2.6, 2.8, 0.25), CFrame.new(w * sx, 3.2 + (r - 1) * 6 + 1.4, -d / 2 - 0.1), glass, gmat)
				end
			end
		end
		if kind == "shop" then
			P(m, "shopfront", V(w * 0.55, 3.4, 0.25), CFrame.new(-w * 0.08, 2.6, -d / 2 - 0.1), glass, gmat)
			P(m, "awning", V(w * 0.62, 0.3, 2.4), CFrame.new(-w * 0.08, 4.9, -d / 2 - 1.2) * CFrame.Angles(math.rad(-12), 0, 0), roof)
		end
	elseif kind == "block" then
		-- a far block: plain, with a few window bands (lit at night)
		P(m, "top", V(w + 0.6, 0.8, d + 0.6), CFrame.new(0, h + 0.4, 0), roof)
		for y = 6, h - 4, 9 do P(m, "band", V(w * 0.86, 1.6, 0.3), CFrame.new(0, y, -d / 2 - 0.1), glass, gmat) end
	else -- "plain": a middle-ring house, body + roof only
		local a = (d + 1) / math.sqrt(2)
		P(m, "roof", V(w + 0.8, a, a), CFrame.new(0, h, 0) * CFrame.Angles(math.rad(45), 0, 0), roof)
		if night then P(m, "window", V(2.4, 2.4, 0.25), CFrame.new(-w * 0.2, h * 0.55, -d / 2 - 0.1), glass, gmat) end
	end
	m.PrimaryPart = m.body
	return m
end

local function lamp(parent, cf, night)
	local m = Instance.new("Model"); m.Name = "lamp"; m.Parent = parent
	P(m, "pole", V(0.5, 12, 0.5), cf * CFrame.new(0, 6, 0), C(40, 42, 48), nil, true)
	P(m, "arm", V(0.3, 0.3, 2.2), cf * CFrame.new(0, 11.8, -0.9), C(40, 42, 48), nil, true)
	P(m, "light", V(1.0, 0.6, 1.0), cf * CFrame.new(0, 11.4, -1.9), night and C(255, 214, 150) or C(235, 235, 220), night and Enum.Material.Neon or nil)
end
local function tree(parent, cf, rng)
	local m = Instance.new("Model"); m.Name = "tree"; m.Parent = parent
	local h = rng:NextNumber(5, 8)
	P(m, "trunk", V(1, h, 1), cf * CFrame.new(0, h / 2, 0), C(110, 78, 50), nil, true)
	local g = C(rng:NextInteger(70, 100), rng:NextInteger(130, 165), rng:NextInteger(70, 95))
	local b = P(m, "leaves", V(7, 6, 7), cf * CFrame.new(0, h + 2, 0), g, nil, true); b.Shape = Enum.PartType.Ball
	local b2 = P(m, "leaves", V(5, 4.5, 5), cf * CFrame.new(0.8, h + 4.6, 0.4), g, nil, true); b2.Shape = Enum.PartType.Ball
end
local function fence(parent, cf, len)
	local m = Instance.new("Model"); m.Name = "fence"; m.Parent = parent
	for x = -len / 2, len / 2, 3 do P(m, "post", V(0.35, 3, 0.35), cf * CFrame.new(x, 1.5, 0), C(245, 245, 240)) end
	for _, y in ipairs({ 1.1, 2.3 }) do P(m, "rail", V(len, 0.3, 0.2), cf * CFrame.new(0, y, 0), C(245, 245, 240)) end
end
local function bench(parent, cf)
	local m = Instance.new("Model"); m.Name = "bench"; m.Parent = parent
	P(m, "seat", V(5, 0.3, 1.6), cf * CFrame.new(0, 1.5, 0), C(150, 100, 60), nil, true)
	P(m, "back", V(5, 1.4, 0.25), cf * CFrame.new(0, 2.5, 0.75), C(150, 100, 60), nil, true)
	for _, sx in ipairs({ -2, 2 }) do P(m, "leg", V(0.3, 1.5, 1.4), cf * CFrame.new(sx, 0.75, 0), C(50, 50, 55)) end
end
local function mailbox(parent, cf)
	local m = Instance.new("Model"); m.Name = "mailbox"; m.Parent = parent
	P(m, "post", V(0.35, 3, 0.35), cf * CFrame.new(0, 1.5, 0), C(90, 70, 50))
	P(m, "box", V(1.0, 0.9, 1.6), cf * CFrame.new(0, 3.3, 0), C(60, 90, 160), nil, true)
end
local function car(parent, cf, rng)
	local m = Instance.new("Model"); m.Name = "car"; m.Parent = parent
	local col = ({ C(200, 60, 60), C(60, 110, 190), C(235, 235, 230), C(240, 190, 60), C(70, 150, 110), C(60, 60, 66) })[rng:NextInteger(1, 6)]
	P(m, "body", V(4.6, 1.6, 9), cf * CFrame.new(0, 1.5, 0), col, nil, true)
	P(m, "cabin", V(4.2, 1.5, 4.6), cf * CFrame.new(0, 3.0, 0.4), C(80, 110, 140), nil, true)
	for _, sx in ipairs({ -2.2, 2.2 }) do for _, sz in ipairs({ -2.9, 2.9 }) do
		local w = P(m, "wheel", V(0.8, 1.5, 1.5), cf * CFrame.new(sx, 0.75, sz), C(25, 25, 28)); w.Shape = Enum.PartType.Cylinder
	end end
end

local function inRoad(loc, ang, r, halfW)
	for _, rd in ipairs(loc.roads or {}) do
		local da = math.abs(((ang - math.rad(rd.dir)) + math.pi) % (2 * math.pi) - math.pi)
		local half = math.asin(math.clamp(((rd.width or 20) / 2 + halfW + 4) / r, 0, 1))
		if da < half then return true end
	end
	return false
end
local function ringPoint(o, ang, r) return o + V(math.sin(ang) * r, 0, math.cos(ang) * r) end
local function facing(o, at) return CFrame.lookAt(at, V(o.X, at.Y, o.Z)) end -- the front (-Z) looks at the centre

local made = {}
for _, loc in ipairs(LOCATIONS) do
	local rng = Random.new(loc.seed or 1)
	local o = loc.origin
	local rings = loc.rings or {}
	local function on(k) return rings[k] ~= false end
	local edge = math.max((loc.set or V(60, 0, 60)).X, (loc.set or V(60, 0, 60)).Z)
	local night = loc.night == true
	local style = loc.style or "town"
	local bd = backdropRoot:FindFirstChild(loc.name); if bd then bd:Destroy() end
	bd = Instance.new("Folder"); bd.Name = loc.name; bd.Parent = backdropRoot
	local wf = folder(worldRoot, loc.name)
	local dress = wf:FindFirstChild("Dressing"); if dress then dress:Destroy() end
	dress = Instance.new("Folder"); dress.Name = "Dressing"; dress.Parent = wf
	local n0 = 0

	-- ground to the horizon + the roads past the set
	P(bd, "far_ground", V(2048, 1, 2048), CFrame.new(o + V(0, -0.58, 0)), night and C(60, 78, 66) or C(120, 150, 110))
	for _, rd in ipairs(loc.roads or {}) do
		local a = math.rad(rd.dir)
		local dir = V(math.sin(a), 0, math.cos(a))
		local len = 1000 - edge
		local cf = CFrame.lookAt(o + dir * (edge + len / 2) + V(0, -0.02, 0), o + dir * 2000 + V(0, -0.02, 0))
		P(bd, "road", V(rd.width or 20, 0.12, len), cf, C(62, 62, 68))
		for _, sx in ipairs({ -1, 1 }) do P(bd, "pavement", V(5, 0.3, len), cf * CFrame.new(sx * ((rd.width or 20) / 2 + 2.5), 0.05, 0), C(176, 172, 166)) end
		P(bd, "line", V(0.5, 0.14, len), cf * CFrame.new(0, 0.01, 0), C(240, 236, 220))
	end

	-- the 3 rings of buildings (a few models each, copied round the ring)
	local function ring(kind, r0, r1, wMin, wMax, hMin, hMax, nModels)
		local protos = {}
		for i = 1, nModels do
			local w, h = rng:NextNumber(wMin, wMax), rng:NextNumber(hMin, hMax)
			local proto
			if kind == "near" and loc.models and lib and #loc.models > 0 then
				local src = lib:FindFirstChild(loc.models[(i - 1) % #loc.models + 1])
				if src then proto = src:Clone() end
			end
			if not proto then
				local k = kind == "near" and (i % 3 == 0 and "shop" or "house") or (kind == "mid" and "plain" or "block")
				proto = building(k, w, h, w * rng:NextNumber(0.7, 0.95), WALLS[rng:NextInteger(1, #WALLS)], ROOFS[rng:NextInteger(1, #ROOFS)], night)
			end
			table.insert(protos, proto)
		end
		local r = (r0 + r1) / 2
		local step = (wMax + 6) / r
		local ang = rng:NextNumber(0, step)
		local k = 0
		while ang < 2 * math.pi do
			local proto = protos[k % #protos + 1]
			local _, size = proto:GetBoundingBox()
			if not inRoad(loc, ang, r, size.X / 2) then
				local c = proto:Clone()
				local at = ringPoint(o, ang, rng:NextNumber(r0, r1))
				c:PivotTo(facing(o, at))
				local cf, sz = c:GetBoundingBox()
				c:PivotTo(c:GetPivot() + V(0, o.Y - (cf.Position.Y - sz.Y / 2), 0))
				for _, p in ipairs(c:GetDescendants()) do
					if p:IsA("BasePart") then p.Anchored = true; p.CanCollide = false; p.CanTouch = false; p.CastShadow = false end
					if p:IsA("LuaSourceContainer") or p:IsA("Sound") then p:Destroy() end
				end
				c.Parent = bd
				n0 += 1
			end
			ang += math.max(step, (size.X + 4) / r)
			k += 1
		end
		for _, p in ipairs(protos) do p:Destroy() end
	end
	local tall = style == "city" and 2 or (style == "suburb" and 0.7 or 1)
	if on("near") then ring("near", edge + 18, edge + 30, 14, 22, 12, 20 * tall, 6) end
	if on("mid") then ring("mid", edge + 70, edge + 150, 16, 26, 14, 26 * tall, 5) end
	if on("far") then ring("far", 260, 480, 20, 40, 26 * tall, 70 * tall, 5) end
	if on("hills") then
		local hc = night and C(38, 46, 66) or C(112, 142, 124)
		for i = 1, 14 do
			local a = i / 14 * 2 * math.pi + rng:NextNumber(-0.15, 0.15)
			local s = V(rng:NextNumber(320, 520), rng:NextNumber(90, 170), rng:NextNumber(320, 520))
			local b = P(bd, "hill", s, CFrame.new(ringPoint(o, a, rng:NextNumber(720, 900)) + V(0, -s.Y * 0.2, 0)), hc)
			local mesh = Instance.new("SpecialMesh"); mesh.MeshType = Enum.MeshType.Sphere; mesh.Parent = b -- a soft dome
			n0 += 1
		end
	end

	-- street dressing round the set (inside the near ring) and along the roads
	if on("dressing") then
		local r = edge + 10
		local ang, i = rng:NextNumber(0, 0.2), 0
		while ang < 2 * math.pi do
			if not inRoad(loc, ang, r, 3) then
				local at = ringPoint(o, ang, r)
				local cf = facing(o, at)
				local pick = i % 6
				if pick == 0 then lamp(dress, cf, night)
				elseif pick == 1 or pick == 4 then tree(dress, cf, rng)
				elseif pick == 2 then bench(dress, cf * CFrame.Angles(0, math.pi, 0))
				elseif pick == 3 then fence(dress, cf * CFrame.new(0, 0, 3), 12)
				else mailbox(dress, cf) end
				n0 += 1
			end
			ang += 22 / r
			i += 1
		end
		for _, rd in ipairs(loc.roads or {}) do
			local a = math.rad(rd.dir)
			local dir = V(math.sin(a), 0, math.cos(a))
			local side = dir:Cross(Vector3.yAxis)
			for d = edge + 14, edge + 150, 26 do
				local sx = (math.floor(d / 26) % 2 == 0) and 1 or -1
				local at = o + dir * (d + rng:NextNumber(-4, 4)) + side * sx * ((rd.width or 20) / 2 - 3)
				car(bd, CFrame.lookAt(at, at + dir), rng)
				lamp(bd, CFrame.lookAt(o + dir * d + side * -sx * ((rd.width or 20) / 2 + 3), o + dir * d), night)
				n0 += 2
			end
		end
	end

	-- background people on the pavements (crowd extras, small in frame; never the cast)
	local people = math.clamp(loc.people or 0, 0, 16)
	if people > 0 then
		local ok, L = pcall(function()
			local m = game.ServerStorage.ZyvoCastLib:Clone(); m.Parent = game.ServerStorage; local r = require(m); m:Destroy(); return r
		end)
		if ok then
			local pf = Instance.new("Model"); pf.Name = "People"; pf.Parent = bd
			local HAIR = { "short", "sides", "spiky", "bun", "long", "tuft" }
			local SKIN = { C(255, 214, 170), C(234, 184, 146), C(198, 140, 100), C(150, 100, 70), C(110, 72, 50) }
			local placed, tries = 0, 0
			while placed < people and tries < people * 6 do
				tries += 1
				local ang = rng:NextNumber(0, 2 * math.pi)
				local r = edge + rng:NextNumber(12, 16)
				if not inRoad(loc, ang, r, 2) then
					local at = ringPoint(o, ang, r)
					local look = at + V(math.cos(ang), 0, -math.sin(ang)) * (rng:NextNumber() < 0.5 and 10 or -10)
					local okm = pcall(L.make, { name = "bg_" .. loc.name .. "_" .. placed, at = at, look = look,
						skin = SKIN[rng:NextInteger(1, #SKIN)], shirt = WALLS[rng:NextInteger(1, #WALLS)],
						trousers = ROOFS[rng:NextInteger(1, #ROOFS)], hair = { style = HAIR[rng:NextInteger(1, #HAIR)] },
						pose = "stand", life = "idle", extra = true }, pf)
					if okm then placed += 1 end
				end
			end
			for _, p in ipairs(pf:GetDescendants()) do if p:IsA("BasePart") then p.CastShadow = false end end
			n0 += placed
		end
	end
	table.insert(made, string.format("%s: %d pieces", loc.name, n0))
end
return { ok = true, made = made }
