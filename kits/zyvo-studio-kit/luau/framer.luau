-- Zyvo Studio Kit: THE FRAMER (ModuleScript game.ServerStorage.ZyvoFramer, edit-time only; never runs in Play).
-- The 9:16 framing checker + solver. Replays each shot's camera move exactly like runtime/ZyvoCamera, rebuilds who is
-- visible at that moment, and checks: camera never inside/touching a visible part, a clear line to the subjects'
-- faces, faces in frame (not cut), faces not bigger than head-and-shoulders, the main face in the upper third, the
-- subjects facing the camera, nothing big right in front of the lens, the lower frame not one flat surface.
-- solve()/solveWide() re-place a spot around its subjects. Run it with luau/frame_check.luau.
-- Character attributes it reads (set by luau/cast_lib.luau): Extra = true (a crowd extra: may be cut by the frame
-- edge), Life = "sleep" (eyes closed: may face away). Parts in a Model named ZyvoOnHead (a thing riding on a head)
-- never block that head's face.
-- Install: multi_edit, file_path game.ServerStorage.ZyvoFramer, className ModuleScript, the full text of this file.
local F = {}
local V3 = Vector3.new
local story = workspace.ZyvoStory
local ASPECT = 9 / 16

local function fovOf(lens) return math.deg(2 * math.atan(12 / math.max(8, lens))) end
local function ease(a) a = math.clamp(a, 0, 1); return a * a * (3 - 2 * a) end
F.fovOf = fovOf

local data
function F.load()
	local m = game.ReplicatedStorage.ZyvoShots:Clone(); m.Parent = game.ServerStorage
	data = require(m); m:Destroy()
	return data
end

-- the exact camera maths of ZyvoCamera.view (no roll)
local function spotOf(name)
	local p = story.Spots:FindFirstChild(name or "")
	if not p then return nil end
	return p.Position, p:GetAttribute("Target") or (p.Position + p.CFrame.LookVector * 10), p:GetAttribute("Lens") or 35
end
function F.view(shot, a)
	local pos, target, lens = spotOf(shot.spot)
	if not pos then return nil end
	local fov = fovOf(lens)
	if shot.spotEnd then
		local p2, t2, l2 = spotOf(shot.spotEnd)
		if p2 then local e = ease(a); pos, target = pos:Lerp(p2, e), target:Lerp(t2, e); fov += (fovOf(l2) - fov) * e end
	end
	local look = target - pos
	local d = math.max(0.5, look.Magnitude)
	local dir = look.Unit
	local m = shot.move or "static"
	if m == "push_slow" then pos += dir * (d * 0.15 * ease(a))
	elseif m == "push_fast" then pos += dir * (d * 0.3 * ease(a / 0.35))
	elseif m == "pull_slow" then pos -= dir * (d * 0.22 * ease(a))
	elseif m == "orbit" then pos = target + CFrame.Angles(0, math.rad(20) * (a - 0.5), 0):VectorToWorldSpace(pos - target)
	elseif m == "track" then
		local right = dir:Cross(Vector3.yAxis)
		if right.Magnitude > 0.01 then right = right.Unit; pos += right * (4 * (a - 0.5)); target += right * (4 * (a - 0.5)) end
	elseif m == "crash" then fov = fovOf(lens * (1 + 0.6 * ease(a / 0.25)))
	elseif m == "dolly_zoom" then
		local nd = d * (1 - 0.35 * ease(a)); pos = target - dir * nd
		fov = math.deg(2 * math.atan(math.tan(math.rad(fov / 2)) * d / nd))
	end
	return pos, target, math.clamp(fov, 5, 110)
end

-- visibility at time t (startHidden + every show/hide up to t; the latest event on any ancestor wins)
local events = {}
local function find(n) return story.Cast:FindFirstChild(n) or story:FindFirstChild(n, true) end
function F.buildEvents()
	events = {}
	for _, n in ipairs(data.startHidden) do local i = find(n); if i then events[i] = { { -1, false } } end end
	for _, s in ipairs(data.shots) do
		for _, a in ipairs(s.actions) do
			local i = find(a.what)
			if i then events[i] = events[i] or {}; table.insert(events[i], { s.t0 + a.at, a["do"] == "show" }) end
		end
	end
end
local function visibleAt(part, t)
	if part.Transparency >= 0.99 then return false end
	local bestT, shown = -math.huge, true
	local inst = part
	while inst and inst ~= story do
		local ev = events[inst]
		if ev then for _, e in ipairs(ev) do if e[1] <= t and e[1] >= bestT then bestT, shown = e[1], e[2] end end end
		inst = inst.Parent
	end
	return shown
end
F.visibleAt = visibleAt

-- obstacles: every solid-looking part, in a 12-stud grid
local CELL = 12
local grid = {}
local function key(x, y, z) return x .. "," .. y .. "," .. z end
function F.buildGrid()
	grid = {}
	local roots = { story.World, story.Blockout, story.Cast, story.Assets }
	local n = 0
	for _, r in ipairs(roots) do
		for _, p in ipairs(r:GetDescendants()) do
			if p:IsA("BasePart") and p.Name ~= "HumanoidRootPart" and p.Transparency < 0.99 then
				local rad = p.Size.Magnitude / 2
				if rad < 120 then
					local c = p.Position
					for gx = math.floor((c.X - rad) / CELL), math.floor((c.X + rad) / CELL) do
						for gy = math.floor((c.Y - rad) / CELL), math.floor((c.Y + rad) / CELL) do
							for gz = math.floor((c.Z - rad) / CELL), math.floor((c.Z + rad) / CELL) do
								local k = key(gx, gy, gz); grid[k] = grid[k] or {}; table.insert(grid[k], p)
							end
						end
					end
					n += 1
				end
			end
		end
	end
	return n
end
local function inside(p, point, margin)
	local lp = p.CFrame:PointToObjectSpace(point)
	local h = p.Size / 2
	return math.abs(lp.X) <= h.X + margin and math.abs(lp.Y) <= h.Y + margin and math.abs(lp.Z) <= h.Z + margin
end
-- the first visible part at a point (the camera must also stay above the ground)
local function hit(point, t, margin, ignore)
	if point.Y < 0.6 then return "the ground" end
	local cell = grid[key(math.floor(point.X / CELL), math.floor(point.Y / CELL), math.floor(point.Z / CELL))]
	if not cell then return nil end
	for _, p in ipairs(cell) do
		if not (ignore and ignore(p)) and inside(p, point, margin) and visibleAt(p, t) then
			return (p:GetFullName():gsub("Workspace%.ZyvoStory%.", ""))
		end
	end
	return nil
end
F.hit = hit

-- the characters (models with a Humanoid)
local chars = {}
function F.buildChars()
	chars = {}
	for _, m in ipairs(story.Cast:GetDescendants()) do
		if m:IsA("Model") and m:FindFirstChildOfClass("Humanoid") and m:FindFirstChild("Head") then table.insert(chars, m) end
	end
	return #chars
end
function F.char(name) return story.Cast:FindFirstChild(name, true) end

-- project a point into the 9:16 frame: x, y in -1..1 (y up), depth
local function project(cf, tanV, point)
	local lp = cf:PointToObjectSpace(point)
	local z = -lp.Z
	if z <= 0.05 then return nil, nil, z end
	return (lp.X / z) / (tanV * ASPECT), (lp.Y / z) / tanV, z
end
F.project = project

local topCache = {}
local function headTopOffset(m)
	if topCache[m] then return topCache[m] end
	local h = m.Head
	local top = h.Position.Y + h.Size.Y / 2
	for _, p in ipairs(m:GetDescendants()) do
		if p:IsA("BasePart") and p:GetAttribute("Bone") == "Head" and p ~= h and not p:FindFirstAncestor("ZyvoOnHead") then
			top = math.max(top, p.Position.Y + p.Size.Y / 2)
		end
	end
	topCache[m] = top - h.Position.Y
	return topCache[m]
end
F.headTopOffset = headTopOffset
local function ownedBy(p, set) local a = p; while a and a ~= story do if set[a] then return true end; a = a.Parent end; return false end

-- check one shot: returns a list of problems (empty = good), the biggest subject face, the main face's height
function F.check(shot, opts)
	opts = opts or {}
	local problems, worstHead, mainY = {}, 0, nil
	local subj, fg = {}, {}
	for _, n in ipairs(opts.subjects or {}) do local m = F.char(n); if m then subj[m] = true end end
	for _, n in ipairs(opts.foreground or {}) do local m = F.char(n); if m then fg[m] = true end end
	for i = 0, 10 do
		local a = i / 10
		local t = shot.t0 + (shot.t1 - shot.t0) * math.min(a, 0.97)
		local pos, target, fov = F.view(shot, a)
		if not pos then table.insert(problems, "no spot"); break end
		local h = hit(pos, t, 0.7)
		if h then table.insert(problems, string.format("a=%.1f camera inside/touching %s", a, h)); break end
		local cf = CFrame.lookAt(pos, target)
		local tanV = math.tan(math.rad(fov / 2))
		for _, m in ipairs(chars) do
			local head = m.Head
			if visibleAt(head, t) then
				local x, y, z = project(cf, tanV, head.Position)
				if x and z < 60 then
					local hh = head.Size.Y / z / tanV / 2 -- head height as a fraction of the frame height
					local hw = head.Size.X / z / (tanV * ASPECT) / 2 -- half width, in half-frame units
					local onScreen = math.abs(x) < 1 + hw and math.abs(y) < 1 + hh * 2
					if onScreen and not fg[m] then
						if hh > 0.34 then table.insert(problems, string.format("a=%.1f %s face too big (%d%% of the frame)", a, m.Name, hh * 100)) end
						local cutX = math.abs(x) + hw > 1.0 and math.abs(x) - hw < 1.0
						local yTop = y + (headTopOffset(m) / z) / tanV
						local cutY = (math.abs(y) + hh > 1.0 and math.abs(y) - hh < 1.0) or (yTop > 0.97 and y < 1.0)
						local extra = m:GetAttribute("Extra") and not subj[m] and hh < 0.12 -- a crowd continues past the frame edge
						local turned = head.CFrame.LookVector:Dot((pos - head.Position).Unit)
						if (cutX or cutY) and (subj[m] or hh > 0.05) and not extra and (subj[m] or turned > -0.1) then table.insert(problems, string.format("a=%.1f %s face cut by the frame edge", a, m.Name)) end
						if z < 2.2 then table.insert(problems, string.format("a=%.1f camera %.1f studs from %s's face", a, z, m.Name)) end
					end
					if subj[m] then
						worstHead = math.max(worstHead, hh)
						local facing = head.CFrame.LookVector:Dot((pos - head.Position).Unit)
						if facing < 0.3 and m:GetAttribute("Life") ~= "sleep" then table.insert(problems, string.format("a=%.1f %s's face turned away from the camera (%.2f)", a, m.Name, facing)) end
						if i == 5 then mainY = y end
						if not onScreen or math.abs(x) + hw > 1 or math.abs(y) + hh > 1 then table.insert(problems, string.format("a=%.1f subject %s out of frame", a, m.Name)) end
						local d = head.Position - pos
						local steps = math.floor(d.Magnitude / 0.4)
						for k = 2, steps - 1 do
							local pt = pos + d * (k / steps)
							if (pt - head.Position).Magnitude < head.Size.X * 0.55 then break end
							local b = hit(pt, t, 0, function(p) return (ownedBy(p, subj) and (p.Name == "Head" or p:GetAttribute("Bone") == "Head" or p:FindFirstAncestor("ZyvoOnHead") ~= nil)) or ownedBy(p, fg) end)
							if b then table.insert(problems, string.format("a=%.1f %s's face blocked by %s", a, m.Name, b)); break end
						end
					end
				elseif x == nil and subj[m] then
					table.insert(problems, string.format("a=%.1f subject %s behind the camera", a, m.Name))
				end
			end
		end
		if #problems > 0 then break end
	end
	if opts.upperThird and mainY and (mainY < 0.15 or mainY > 0.75) then
		table.insert(problems, string.format("main face at %d%% from the top (want the upper third)", (1 - (mainY + 1) / 2) * 100))
	end
	return problems, worstHead, mainY
end

-- solve a spot around its subjects (size close | medium). Writes the spot; returns the solution or nil + last problems.
local TIGHT = { push_slow = 0.85, push_fast = 0.7, crash = 0.625, dolly_zoom = 1, pull_slow = 1, orbit = 1, track = 1, handheld = 1, static = 1 }
function F.solve(shot, cfg)
	local ms = {}
	for _, n in ipairs(cfg.subjects) do table.insert(ms, F.char(n)) end
	local heads, top, bottom, headH = V3(), -math.huge, math.huge, 0
	for _, m in ipairs(ms) do
		heads += m.Head.Position
		top = math.max(top, m.Head.Position.Y + headTopOffset(m))
		headH = math.max(headH, m.Head.Size.Y)
		local low = (cfg.size == "close") and (m.Head.Position.Y - m.Head.Size.Y * 1.9) or (m.LowerTorso.Position.Y - 0.3)
		bottom = math.min(bottom, low)
	end
	local focus = heads / #ms
	local lens = cfg.lens or (cfg.size == "close" and 45 or 32)
	local tanV = math.tan(math.rad(fovOf(lens)) / 2)
	local span = cfg.size == "close" and headH / 0.24 or (top - bottom) / 0.68
	local dV = (span / 2) / tanV
	local tight = TIGHT[shot.move or "static"] or 1
	local sp = story.Spots[shot.spot]
	local baseDir = cfg.dir or ((focus - sp.Position) * V3(1, 0, 1)).Unit
	local basePitch = cfg.pitch or 6
	local saved = { sp.CFrame, sp:GetAttribute("Lens"), sp:GetAttribute("Target"), sp:GetAttribute("Dist") }
	local yaws = cfg.yaws or { 0, 15, -15, 30, -30, 45, -45, 60, -60, 80, -80 }
	local pitches = { basePitch, basePitch + 12, basePitch + 24, basePitch - 6, 40 }
	local lastProbs
	for _, pitch in ipairs(pitches) do
		for _, yaw in ipairs(yaws) do
			local horiz = CFrame.Angles(0, math.rad(yaw), 0):VectorToWorldSpace(baseDir)
			local pr = math.rad(pitch)
			local D = (horiz * math.cos(pr) - V3(0, math.sin(pr), 0)).Unit -- camera -> focus; positive pitch looks down
			local right = D:Cross(Vector3.yAxis).Unit
			local w = 0
			for _, m in ipairs(ms) do w = math.max(w, math.abs((m.Head.Position - focus):Dot(right)) * 2 + 2.4) end
			if shot.move == "track" then w += 4.5 end
			local dH = (w / 2 / 0.78) / (tanV * ASPECT)
			local d = math.max(dV, dH, cfg.minDist or 0) / tight
			local pos = focus - D * d
			local alpha = math.atan(0.34 * tight * tanV) -- aim below the face: it lands in the upper third
			local axis = CFrame.fromAxisAngle(right, -alpha):VectorToWorldSpace(D)
			local target = pos + axis * d
			sp.CFrame = CFrame.lookAt(pos, target); sp:SetAttribute("Lens", lens); sp:SetAttribute("Target", target); sp:SetAttribute("Dist", d)
			local probs = F.check(shot, { subjects = cfg.subjects, foreground = cfg.foreground, upperThird = true })
			if #probs == 0 then
				local cv = F.cover(shot, { subjects = cfg.subjects, foreground = cfg.foreground })
				if cv then table.insert(probs, cv) end
				if #probs == 0 then local lf = F.lowerFill(shot); if lf then table.insert(probs, lf) end end
			end
			if #probs == 0 then return { yaw = yaw, pitch = pitch, dist = d, lens = lens } end
			lastProbs = probs
		end
	end
	sp.CFrame = saved[1]; sp:SetAttribute("Lens", saved[2]); sp:SetAttribute("Target", saved[3]); sp:SetAttribute("Dist", saved[4])
	return nil, lastProbs
end

-- the wide search: every 15 degrees around, 5 pitches, up to 3 lenses; the first pass closest to the planned angle wins
function F.solveWide(shot, cfg)
	local lenses = { cfg.lens or (cfg.size == "close" and 45 or 32), 28, 24 }
	local yaws = { 0 }
	for k = 15, 180, 15 do table.insert(yaws, k); table.insert(yaws, -k) end
	local seen, last = {}, nil
	for _, lens in ipairs(lenses) do
		if not seen[lens] then
			seen[lens] = true
			local c = table.clone(cfg); c.lens = lens; c.yaws = yaws
			local sol, probs = F.solve(shot, c)
			if sol then return sol end
			last = probs
			task.wait()
		end
	end
	return nil, last
end

-- the editor FieldOfView that makes the centered 9:16 crop of the current viewport show vertical fov V (degrees)
function F.cropFov(V)
	local vs = Vector2.new(394, 856) -- the screen_capture image size (it renders at its own size)
	local tanV = math.tan(math.rad(V / 2))
	if vs.X / vs.Y < 9 / 16 then
		local h = vs.X * 16 / 9 -- the crop is narrower-than-tall: it uses the full width
		return math.deg(2 * math.atan(vs.Y / h * tanV))
	end
	return V
end

-- near-camera cover: a 5x9 grid of rays through the 9:16 frame; a ray is "covered" when it meets a visible part
-- within NEAR studs (not a subject / foreground character). Fails when more than 12 percent of the frame is covered.
function F.cover(shot, opts)
	opts = opts or {}
	local skip = {}
	for _, n in ipairs(opts.subjects or {}) do local m = F.char(n); if m then skip[m] = true end end
	for _, n in ipairs(opts.foreground or {}) do local m = F.char(n); if m then skip[m] = true end end
	local function own(p) local a = p; while a and a ~= story do if skip[a] then return true end; a = a.Parent end; return false end
	for _, a in ipairs({ 0, 0.5, 0.97 }) do
		local t = shot.t0 + (shot.t1 - shot.t0) * a
		local pos, target, fov = F.view(shot, a)
		local cf = CFrame.lookAt(pos, target)
		local tanV = math.tan(math.rad(fov / 2))
		local near = math.clamp((target - pos).Magnitude * 0.3, 2.5, 5)
		local covered, total, what = 0, 0, nil
		for ix = -2, 2 do
			for iy = -4, 4 do
				total += 1
				local dir = cf:VectorToWorldSpace(Vector3.new((ix / 2.5) * tanV * ASPECT, (iy / 4.5) * tanV, -1)).Unit
				for d = 0.8, near, 0.35 do
					local h = F.hit(pos + dir * d, t, 0, own)
					if h then covered += 1; what = what or h; break end
				end
			end
		end
		if covered / total > 0.12 then
			return string.format("a=%.1f %d pct of the frame covered near the camera by %s", a, covered / total * 100, what)
		end
	end
	return nil
end

-- the lower half of the frame must not be one big flat surface within a few studs (a stage floor, a roof, a wall)
function F.lowerFill(shot)
	for _, a in ipairs({ 0, 0.5, 0.97 }) do
		local t = shot.t0 + (shot.t1 - shot.t0) * a
		local pos, target, fov = F.view(shot, a)
		local cf = CFrame.lookAt(pos, target)
		local tanV = math.tan(math.rad(fov / 2))
		local d = (target - pos).Magnitude
		local hits, total, what = 0, 0, {}
		for ix = -2, 2 do
			for iy = -4, -1 do
				total += 1
				local dir = cf:VectorToWorldSpace(Vector3.new((ix / 2.5) * tanV * (9 / 16), (iy / 4.5) * tanV, -1)).Unit
				for s = 0.8, d * 0.6, 0.5 do
					local h = F.hit(pos + dir * s, t, 0)
					if h then
						if not h:find("Cast%.") and not h:find("%.ground$") then hits += 1; what[h] = (what[h] or 0) + 1 end
						break
					end
				end
			end
		end
		local top, topN = nil, 0
		for k, v in pairs(what) do if v > topN then top, topN = k, v end end
		if topN / total > 0.55 then return string.format("a=%.1f lower frame filled by %s (%d of %d rays)", a, top, topN, total) end
	end
	return nil
end

return F
