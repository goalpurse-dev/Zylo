-- Zyvo Studio Kit: THE FRAMER (ModuleScript game.ServerStorage.ZyvoFramer, edit-time only; never runs in Play).
-- The 9:16 framing checker + solver. Replays each shot's camera move exactly like runtime/ZyvoCamera, rebuilds who is
-- visible at that moment, and checks: camera never inside/touching a visible part, a clear line to the subjects'
-- faces, faces in frame (not cut), faces not bigger than head-and-shoulders, the main face in the upper third, the
-- subjects facing the camera, nothing big right in front of the lens, the lower frame not one flat surface.
-- solve()/solveWide() re-place a spot around its subjects. Run it with luau/frame_check.luau.
-- Character attributes it reads (set by luau/cast_lib.luau): Extra = true (a crowd extra: may be cut by the frame
-- edge), Life = "sleep" (eyes closed: may face away). Parts in a Model named ZyvoOnHead (a thing riding on a head)
-- never block that head's face.
-- The rule object over a head (a floating number, a number plate, the ZyvoOnHead thing) is kept inside the frame:
-- put it INSIDE the character's model (or give it RuleFor = "<character name>"), mark its parts Rule = true.
-- Hollow = true on a model / folder (a bus, a room, a shop interior) tests its meshes on their real shape, not their
-- bounding box, so a camera can stand inside; a mesh with a character's head inside its box counts as hollow by itself.
-- 1.3.0 adds (all run by luau/frame_check.luau "check"): signs() (sign text whole or out, never cut), glow() (a
-- glowing rule object never over a face) + capGlow(), scan() (real raycasts: no world edge / void in view, no empty
-- ground in a wide, no prop-only close-up unless the shot's `object` says the line is about it), and monsters() (every
-- named monster / villain is seen at its reveal, hinted before it, and in the last shot when the ending calls back).
-- It reads parts at their EDIT look (ZyEditT, set by the preview), so a preview left on never fakes a failure.
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

-- visibility at time t (startHidden + every show/hide up to t). The same rule as runtime/ZyvoActions: a part shows
-- only while NOTHING it belongs to is hidden. Each named thing keeps its own latest state, so showing a whole statue
-- never un-hides the number plate inside it that starts hidden (that plate needs its own show).
local events = {}
local function find(n) return story.Cast:FindFirstChild(n) or story:FindFirstChild(n, true) end
F.find = find
function F.buildEvents()
	events = {}
	for _, n in ipairs(data.startHidden or {}) do local i = find(n); if i then events[i] = { { -1, false } } end end
	for _, s in ipairs(data.shots) do
		for _, a in ipairs(s.actions or {}) do
			-- only show / hide change who is visible; walk, face and jump have no `what`
			local d = a["do"]
			local i = (d == "show" or d == "hide") and a.what and find(a.what)
			if i then events[i] = events[i] or {}; table.insert(events[i], { s.t0 + (a.at or 0), d == "show" }) end
		end
	end
end
-- is an instance (a part, a gui) hidden at t by itself or by anything it sits in?
local function hiddenAt(inst, t)
	while inst and inst ~= story do
		local ev = events[inst]
		if ev then
			local bestT, shown = -math.huge, true
			for _, e in ipairs(ev) do if e[1] <= t and e[1] >= bestT then bestT, shown = e[1], e[2] end end
			if not shown then return true end
		end
		inst = inst.Parent
	end
	return false
end
-- a part's own look: the preview (luau/preview.luau) parks the edit value in ZyEditT while it shows a shot's state
local function editT(p) local v = p:GetAttribute("ZyEditT"); return type(v) == "number" and v or p.Transparency end
F.editT = editT
local function visibleAt(part, t)
	if editT(part) >= 0.99 then return false end
	return not hiddenAt(part, t)
end
F.visibleAt = visibleAt
F.hiddenAt = hiddenAt

-- HOLLOW sets: a bus, a room, a shop bought as ONE mesh has a bounding box that covers its empty inside, so the box
-- test would say every camera inside it is "inside a part". Such parts are tested on their real shape (raycasts)
-- instead of their box. A part is hollow when it or a model / folder it sits in has the attribute Hollow = true (set
-- it on interior sets and vehicles you film from inside), or automatically when a character's head is inside its box
-- (nobody stands inside solid stone). Plain box Parts stay box-tested (a box is solid).
local hollowList = {}
local function isHollowSet(p)
	local a = p
	while a and a ~= story do
		if a:GetAttribute("Hollow") == true then return true end
		a = a.Parent
	end
	return false
end
local function insideBox(p, point, margin)
	local lp = p.CFrame:PointToObjectSpace(point)
	local h = p.Size / 2
	return math.abs(lp.X) <= h.X + margin and math.abs(lp.Y) <= h.Y + margin and math.abs(lp.Z) <= h.Z + margin
end
-- the first VISIBLE hollow part along a segment (its real collision shape), skipping parts `ignore` says yes to
local function hollowRay(from, to, t, ignore)
	if #hollowList == 0 then return nil end
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Include
	params.FilterDescendantsInstances = hollowList
	local o, dir = from, to - from
	for _ = 1, 6 do
		if dir.Magnitude < 0.05 then return nil end
		local r = workspace:Raycast(o, dir, params)
		if not r then return nil end
		local p = r.Instance
		if visibleAt(p, t) and not (ignore and ignore(p)) then return (p:GetFullName():gsub("Workspace%.ZyvoStory%.", "")) end
		-- an invisible / ignored one: carry on just past it
		local step = dir.Unit * 0.05
		o = r.Position + step
		dir = to - o
	end
	return nil
end
F.hollowRay = hollowRay

-- obstacles: every solid-looking part, in a 12-stud grid
local CELL = 12
local grid = {}
local function key(x, y, z) return x .. "," .. y .. "," .. z end
function F.buildGrid()
	grid = {}
	hollowList = {}
	-- the heads, for finding hollow meshes by themselves
	local heads = {}
	for _, m in ipairs(story.Cast:GetDescendants()) do
		if m:IsA("Model") and m:FindFirstChildOfClass("Humanoid") and m:FindFirstChild("Head") then table.insert(heads, m.Head.Position) end
	end
	local roots = {}
	for _, n in ipairs({ "World", "Blockout", "Cast", "Assets" }) do local r = story:FindFirstChild(n); if r then table.insert(roots, r) end end
	local n = 0
	for _, r in ipairs(roots) do
		for _, p in ipairs(r:GetDescendants()) do
			local hollow = false
			if p:IsA("BasePart") and p.Name ~= "HumanoidRootPart" and editT(p) < 0.99 and not p:IsA("Part") then
				-- a mesh / union: hollow when marked, or when a head is inside its box (and the head isn't its own)
				hollow = isHollowSet(p)
				if not hollow and p.Size.Magnitude > 8 then
					local owner = p:FindFirstAncestorWhichIsA("Model")
					if not (owner and owner:FindFirstChildOfClass("Humanoid")) then
						for _, h in ipairs(heads) do if insideBox(p, h, 0) then hollow = true; break end end
					end
				end
			end
			if hollow then
				table.insert(hollowList, p)
				n += 1
			elseif p:IsA("BasePart") and p.Name ~= "HumanoidRootPart" and editT(p) < 0.99 then
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
	return n, #hollowList
end
local inside = insideBox
local AXES = { Vector3.xAxis, -Vector3.xAxis, Vector3.yAxis, -Vector3.yAxis, Vector3.zAxis, -Vector3.zAxis }
-- the first visible part at a point (the camera must also stay above the ground). Box parts by their box; hollow
-- ones (above) only when their real surface is within `margin` of the point.
local function hit(point, t, margin, ignore)
	if point.Y < 0.6 then return "the ground" end
	local cell = grid[key(math.floor(point.X / CELL), math.floor(point.Y / CELL), math.floor(point.Z / CELL))]
	if cell then
		for _, p in ipairs(cell) do
			if not (ignore and ignore(p)) and inside(p, point, margin) and visibleAt(p, t) then
				return (p:GetFullName():gsub("Workspace%.ZyvoStory%.", ""))
			end
		end
	end
	if margin > 0 and #hollowList > 0 then
		for _, ax in ipairs(AXES) do
			local h = hollowRay(point, point + ax * margin, t, ignore)
			if h then return h end
		end
	end
	return nil
end
F.hit = hit

-- the characters (models with a Humanoid)
local chars = {}
local ruleFor = {} -- character name -> the things anywhere in the story with RuleFor = that name
function F.buildChars()
	chars = {}
	ruleFor = {}
	for _, m in ipairs(story.Cast:GetDescendants()) do
		if m:IsA("Model") and m:FindFirstChildOfClass("Humanoid") and m:FindFirstChild("Head") then table.insert(chars, m) end
	end
	for _, d in ipairs(story:GetDescendants()) do
		local who = d:GetAttribute("RuleFor")
		if type(who) == "string" then ruleFor[who] = ruleFor[who] or {}; table.insert(ruleFor[who], d) end
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

-- THE RULE OBJECT over a head (the floating number, a number plate, the thing on the head): everything inside the
-- character's model that is in a ZyvoOnHead model, has Rule = true (itself or a parent), or is a BillboardGui; plus
-- anything in the story with RuleFor = the character's name. -> the top of the highest one, in studs above the
-- head's centre, or nil. With t: only what is visible at t; without t: all of it (a number that appears later must
-- fit too).
local function yExtent(p)
	local cf, s = p.CFrame, p.Size
	return (math.abs(cf.RightVector.Y) * s.X + math.abs(cf.UpVector.Y) * s.Y + math.abs(cf.LookVector.Y) * s.Z) / 2
end
local function isRule(d, m)
	local a = d
	while a and a ~= m do
		if a:GetAttribute("Rule") == true or a.Name == "ZyvoOnHead" then return true end
		a = a.Parent
	end
	return false
end
local function guiTop(g)
	local base = g.Adornee or g.Parent
	local pos = base and ((base:IsA("BasePart") and base.Position) or (base:IsA("Attachment") and base.WorldPosition))
	if not pos then return nil end
	-- a billboard's Size in Scale is in studs; in the final upright video its height is its own Size.Y (the Play run
	-- turns it with the roll: runtime/ZyvoCamera)
	local h = g.Size.Y.Scale > 0 and g.Size.Y.Scale or 1
	return pos.Y + g.StudsOffset.Y + g.StudsOffsetWorldSpace.Y + h / 2
end
local function ruleTop(m, t)
	local hy = m.Head.Position.Y
	local top
	local function consider(d)
		if t and hiddenAt(d, t) then return end
		local y
		if d:IsA("BasePart") then
			if t and d.Transparency >= 0.99 then return end
			y = d.Position.Y + yExtent(d)
		elseif d:IsA("BillboardGui") then
			if not d.Enabled then return end
			y = guiTop(d)
		end
		if y and y > hy then top = math.max(top or -math.huge, y - hy) end
	end
	for _, d in ipairs(m:GetDescendants()) do
		if d:IsA("BillboardGui") or (d:IsA("BasePart") and isRule(d, m)) then consider(d) end
	end
	for _, r in ipairs(ruleFor[m.Name] or {}) do
		consider(r)
		for _, d in ipairs(r:GetDescendants()) do if d:IsA("BasePart") or d:IsA("BillboardGui") then consider(d) end end
	end
	return top
end
F.ruleTop = ruleTop

-- check one shot: returns a list of problems (empty = good), the biggest subject face, the main face's height
function F.check(shot, opts)
	opts = opts or {}
	local problems, worstHead, mainY = {}, 0, nil
	local hasRule = false
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
						-- the rule object over the head stays in the frame (a margin under the top edge)
						local rt = ruleTop(m, t)
						if rt then
							hasRule = true
							if y + (rt / z) / tanV > 0.95 then table.insert(problems, string.format("a=%.1f the thing over %s's head is cut by the frame top", a, m.Name)) end
						end
						local facing = head.CFrame.LookVector:Dot((pos - head.Position).Unit)
						if facing < 0.3 and m:GetAttribute("Life") ~= "sleep" then table.insert(problems, string.format("a=%.1f %s's face turned away from the camera (%.2f)", a, m.Name, facing)) end
						if i == 5 then mainY = y end
						if not onScreen or math.abs(x) + hw > 1 or math.abs(y) + hh > 1 then table.insert(problems, string.format("a=%.1f subject %s out of frame", a, m.Name)) end
						local d = head.Position - pos
						local steps = math.floor(d.Magnitude / 0.4)
						-- only the subjects' own heads (hair, hat, the thing on the head) may sit on the line to a face: a
						-- foreground character (an over-the-shoulder) frames the face, it never hides it
						local own = function(p) return ownedBy(p, subj) and (p.Name == "Head" or p:GetAttribute("Bone") == "Head" or p:FindFirstAncestor("ZyvoOnHead") ~= nil) end
						local blocked = false
						for k = 2, steps - 1 do
							local pt = pos + d * (k / steps)
							if (pt - head.Position).Magnitude < head.Size.X * 0.55 then break end
							local b = hit(pt, t, 0, own)
							if b then table.insert(problems, string.format("a=%.1f %s's face blocked by %s", a, m.Name, b)); blocked = true; break end
						end
						-- hollow sets (a bus wall, a shop front) on their real shape
						if not blocked then
							local b = hollowRay(pos, head.Position - d.Unit * (head.Size.X * 0.55), t, own)
							if b then table.insert(problems, string.format("a=%.1f %s's face blocked by %s", a, m.Name, b)) end
						end
					end
				elseif x == nil and subj[m] then
					table.insert(problems, string.format("a=%.1f subject %s behind the camera", a, m.Name))
				end
			end
		end
		if #problems > 0 then break end
	end
	-- the upper third: a face with a number floating over it may sit lower (down to the middle), so the number fits
	if opts.upperThird and mainY and (mainY < (hasRule and -0.2 or 0.15) or mainY > 0.75) then
		table.insert(problems, string.format("main face at %d%% from the top (want the upper third)", (1 - (mainY + 1) / 2) * 100))
	end
	return problems, worstHead, mainY
end

-- solve a spot around its subjects (size close | medium). Writes the spot; returns the solution or nil + last problems.
local TIGHT = { push_slow = 0.85, push_fast = 0.7, crash = 0.625, dolly_zoom = 1, pull_slow = 1, orbit = 1, track = 1, handheld = 1, static = 1 }
function F.solve(shot, cfg)
	local ms = {}
	for _, n in ipairs(cfg.subjects) do table.insert(ms, F.char(n)) end
	local close = cfg.size == "close"
	local heads, top, bottom, headH, headW, above = V3(), -math.huge, math.huge, 0, 0, 0
	for _, m in ipairs(ms) do
		heads += m.Head.Position
		-- the rule object over the head (a number that appears later counts too) must fit above the face
		local rt = ruleTop(m) or 0
		above = math.max(above, rt)
		top = math.max(top, m.Head.Position.Y + math.max(headTopOffset(m), rt))
		headH = math.max(headH, m.Head.Size.Y)
		headW = math.max(headW, m.Head.Size.X)
		bottom = math.min(bottom, m.LowerTorso.Position.Y - 0.3)
	end
	local focus = heads / #ms
	local lens = cfg.lens or (close and 45 or 32)
	local tanV = math.tan(math.rad(fovOf(lens)) / 2)
	-- CLOSE = head and shoulders on a 9:16 frame: the head ~30% of the frame height (the check allows up to 34%). A
	-- blocky avatar is only ~4 heads tall, so a frame sized by the body's width (the old way) showed the whole body.
	local span = close and headH / 0.30 or (top - bottom) / 0.68
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
			-- the width the heads need (close: the faces only, the shoulders may run past the 9:16 edges; medium: the bodies)
			local w = 0
			for _, m in ipairs(ms) do
				local spread = math.abs((m.Head.Position - focus):Dot(right)) * 2
				w = math.max(w, close and (spread + headW * 1.7) or (spread + 2.4))
			end
			if shot.move == "track" then w += 4.5 end
			local dH = (w / 2 / (close and 0.9 or 0.78)) / (tanV * ASPECT)
			local base = math.max(dV, dH, cfg.minDist or 0) -- the distance at the move's tightest moment
			-- the face aims for the upper third (y = 0.34 of the half frame above the centre); with a number over the head
			-- it sits lower so the number's top stays under 0.88, and never below the middle (pull back instead)
			if above > 0 then base = math.max(base, above / (0.88 * tanV)) end
			local yFace = math.min(0.34, 0.88 - above / (base * tanV))
			local d = base / tight
			local pos = focus - D * d
			local alpha = math.atan(yFace * tight * tanV) -- aim below the face: it lands at yFace at the tightest moment
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
				local found = false
				for d = 0.8, near, 0.35 do
					local h = F.hit(pos + dir * d, t, 0, own)
					if h then covered += 1; what = what or h; found = true; break end
				end
				if not found then
					local h = hollowRay(pos + dir * 0.8, pos + dir * near, t, own)
					if h then covered += 1; what = what or h end
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
				-- (hollow sets are left out here: inside a bus or a room its own floor belongs in the lower frame)
				local h
				for s = 0.8, d * 0.6, 0.5 do
					h = F.hit(pos + dir * s, t, 0)
					if h then break end
				end
				if h and not h:find("Cast%.") and not h:find("%.ground$") then hits += 1; what[h] = (what[h] or 0) + 1 end
			end
		end
		local top, topN = nil, 0
		for k, v in pairs(what) do if v > topN then top, topN = k, v end end
		if topN / total > 0.55 then return string.format("a=%.1f lower frame filled by %s (%d of %d rays)", a, top, topN, total) end
	end
	return nil
end

local function at(shot, a) return shot.t0 + (shot.t1 - shot.t0) * a end
local function anyRule(d)
	local a = d
	while a and a ~= story do
		if a:GetAttribute("Rule") == true or a:GetAttribute("Glow") == true or a.Name == "ZyvoOnHead" or type(a:GetAttribute("RuleFor")) == "string" then return true end
		a = a.Parent
	end
	return false
end
-- the 9:16 screen box of a part (x, y in -1..1), nil when any corner is behind the camera
local function screenBox(cf, tanV, p)
	local h = p.Size / 2
	local x0, x1, y0, y1 = math.huge, -math.huge, math.huge, -math.huge
	for _, sx in ipairs({ -1, 1 }) do for _, sy in ipairs({ -1, 1 }) do for _, sz in ipairs({ -1, 1 }) do
		local x, y = project(cf, tanV, p.CFrame:PointToWorldSpace(V3(h.X * sx, h.Y * sy, h.Z * sz)))
		if not x then return nil end
		x0, x1, y0, y1 = math.min(x0, x), math.max(x1, x), math.min(y0, y), math.max(y1, y)
	end end end
	return x0, x1, y0, y1
end

-- SIGNS: text on a part (a SurfaceGui with a TextLabel) is either whole inside the 9:16 frame or wholly outside it,
-- never cut by an edge. Sampled 7 x 5 over the text face (a sign wider than the frame has its corners out, its middle
-- in). A sign seen from behind, a tiny far one, or one marked CutOK = true is skipped.
local signList
function F.findSigns()
	signList = {}
	for _, g in ipairs(story:GetDescendants()) do
		if g:IsA("SurfaceGui") and g:FindFirstChildWhichIsA("TextLabel", true) then
			local p = g.Adornee or g.Parent
			if p and p:IsA("BasePart") and not p:GetAttribute("CutOK") then table.insert(signList, { part = p, gui = g, n = Vector3.FromNormalId(g.Face) }) end
		end
	end
	return #signList
end
local SX, SY = { -1, -0.66, -0.33, 0, 0.33, 0.66, 1 }, { -1, -0.5, 0, 0.5, 1 }
function F.signs(shot)
	if not signList then F.findSigns() end
	for _, a in ipairs({ 0, 0.5, 0.97 }) do
		local t = at(shot, a)
		local pos, target, fov = F.view(shot, a)
		if not pos then return nil end
		local cf = CFrame.lookAt(pos, target)
		local tanV = math.tan(math.rad(fov / 2))
		for _, s in ipairs(signList) do
			local p, n = s.part, s.n
			if s.gui.Enabled and (p.Position - pos).Magnitude < 150 and visibleAt(p, t) and not hiddenAt(s.gui, t) then
				local h = p.Size / 2
				local c = V3(n.X * h.X, n.Y * h.Y, n.Z * h.Z)
				local u = math.abs(n.X) > 0.5 and Vector3.zAxis or Vector3.xAxis
				local v = math.abs(n.Y) > 0.5 and Vector3.zAxis or Vector3.yAxis
				local hu, hv = math.abs(u:Dot(h)), math.abs(v:Dot(h))
				local front = p.CFrame:PointToWorldSpace(c)
				if (pos - front):Dot(p.CFrame:VectorToWorldSpace(n)) > 0 then
					local inN, outN, ys = 0, 0, {}
					for _, sx in ipairs(SX) do for _, sy in ipairs(SY) do
						local x, y = project(cf, tanV, p.CFrame:PointToWorldSpace(c + u * (sx * hu) + v * (sy * hv)))
						if x and math.abs(x) <= 1 and math.abs(y) <= 1 then inN += 1 else outN += 1 end
						if y then table.insert(ys, y) end
					end end
					local tall = #ys > 1 and (math.max(table.unpack(ys)) - math.min(table.unpack(ys))) or 0
					if inN > 0 and outN > 0 and tall > 0.06 then
						return string.format("a=%.1f the sign %s is cut by the frame edge", a, (p:GetFullName():gsub("Workspace%.ZyvoStory%.", "")))
					end
				end
			end
		end
	end
	return nil
end

-- GLOW: a glowing rule object (Neon, a light, sparkles; or anything marked Glow = true) sits beside or above a head,
-- never over a face: its screen box may cover at most 15% of any face that is on screen.
local glowList
function F.findGlow()
	glowList = {}
	for _, p in ipairs(story:GetDescendants()) do
		if p:IsA("BasePart") and anyRule(p) and (p.Material == Enum.Material.Neon or p:GetAttribute("Glow") == true
			or p:FindFirstChildWhichIsA("Light") or p:FindFirstChildWhichIsA("ParticleEmitter")) then
			table.insert(glowList, p)
		end
	end
	return #glowList
end
function F.glow(shot)
	if not glowList then F.findGlow() end
	if #glowList == 0 then return nil end
	for _, a in ipairs({ 0, 0.5, 0.97 }) do
		local t = at(shot, a)
		local pos, target, fov = F.view(shot, a)
		if not pos then return nil end
		local cf = CFrame.lookAt(pos, target)
		local tanV = math.tan(math.rad(fov / 2))
		local boxes = {}
		for _, g in ipairs(glowList) do
			if visibleAt(g, t) then
				local x0, x1, y0, y1 = screenBox(cf, tanV, g)
				if x0 and x1 > -1 and x0 < 1 and y1 > -1 and y0 < 1 then table.insert(boxes, { g, x0, x1, y0, y1, (g.Position - pos).Magnitude }) end
			end
		end
		if #boxes > 0 then
			for _, m in ipairs(chars) do
				local head = m.Head
				if visibleAt(head, t) then
					local x, y, z = project(cf, tanV, head.Position)
					if x and math.abs(x) < 1 and math.abs(y) < 1 then
						local hh = head.Size.Y / z / tanV / 2
						local hw = head.Size.X / z / (tanV * ASPECT) / 2
						if hh > 0.03 then
							for _, b in ipairs(boxes) do
								if b[6] < z + head.Size.Z then -- the glow is in front of the face (or level with it)
									local ox = math.max(0, math.min(x + hw, b[3]) - math.max(x - hw, b[2]))
									local oy = math.max(0, math.min(y + hh, b[5]) - math.max(y - hh, b[4]))
									if ox * oy > 0.15 * (4 * hw * hh) then
										return string.format("a=%.1f the glowing %s covers %s's face (keep it beside or above the head)", a, b[1].Name, m.Name)
									end
								end
							end
						end
					end
				end
			end
		end
	end
	return nil
end
-- cap the glow so it never blows out a face: lights in the cast / rule objects at most `brightness` and `range`, neon
-- rule parts no brighter than 85% value, sparkles soft, the bloom gentle. Returns what changed, and the glowing parts
-- bigger than their owner's head (make those smaller by hand or move them above the head).
function F.capGlow(opts)
	opts = opts or {}
	local maxB, maxR = opts.brightness or 1.2, opts.range or 8
	local changed, big = {}, {}
	local cast = story:FindFirstChild("Cast")
	for _, d in ipairs(story:GetDescendants()) do
		local inCast = cast and d:IsDescendantOf(cast)
		if (d:IsA("PointLight") or d:IsA("SpotLight") or d:IsA("SurfaceLight")) and (inCast or anyRule(d)) then
			if d.Brightness > maxB then d.Brightness = maxB; table.insert(changed, d:GetFullName() .. " brightness") end
			if d.Range > maxR then d.Range = maxR; table.insert(changed, d:GetFullName() .. " range") end
		elseif d:IsA("ParticleEmitter") and (inCast or anyRule(d)) then
			if d.LightEmission > 0.4 then d.LightEmission = 0.4; table.insert(changed, d:GetFullName() .. " light emission") end
			if d.Brightness > 1 then d.Brightness = 1; table.insert(changed, d:GetFullName() .. " brightness") end
		elseif d:IsA("BasePart") and d.Material == Enum.Material.Neon and anyRule(d) then
			local hue, s, v = d.Color:ToHSV()
			if v > 0.85 then d.Color = Color3.fromHSV(hue, s, 0.85); table.insert(changed, d:GetFullName() .. " neon dimmed") end
			local m = d:FindFirstAncestorWhichIsA("Model")
			while m and not m:FindFirstChild("Head") do m = m.Parent and m.Parent:FindFirstAncestorWhichIsA("Model") end
			if m and d.Size.Magnitude > m.Head.Size.Magnitude * 1.1 then table.insert(big, d:GetFullName()) end
		end
	end
	local bloom = game:GetService("Lighting"):FindFirstChildWhichIsA("BloomEffect")
	if bloom then
		if bloom.Intensity > 0.3 then bloom.Intensity = 0.3; table.insert(changed, "bloom intensity") end
		if bloom.Size > 24 then bloom.Size = 24; table.insert(changed, "bloom size") end
		if bloom.Threshold < 1.4 then bloom.Threshold = 1.4; table.insert(changed, "bloom threshold") end
	end
	return changed, big
end

-- THE WORLD IN THE FRAME (real raycasts, 7 x 12 through the 9:16 frame at the shot's middle moment):
--   edge:  a ray below the horizon that meets nothing = the world ends in view (fails at 2% of the frame)
--   empty: a WIDE shot that is more than 40% bare ground (a big flat floor farther than 12 studs)
--   prop:  one prop (not a character) fills over half the frame from close up while no character is in the shot,
--          unless the shot's `object` names it (the line is about that thing); an insert with no object fails too
local function ownerModel(p)
	-- the highest Model under a folder (a location / the Assets / the World): "the prop"
	local m, a = nil, p
	while a and a ~= story do
		if a:IsA("Model") then m = a end
		a = a.Parent
	end
	return m or p
end
local function firstVisible(origin, dir, t)
	local skip = {}
	for _, n in ipairs({ "Spots", "Marks" }) do local f = story:FindFirstChild(n); if f then table.insert(skip, f) end end
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = skip
	local o, left = origin, dir
	for _ = 1, 10 do
		local r = workspace:Raycast(o, left, params)
		if not r then return nil end
		local p = r.Instance
		if p:IsA("Terrain") or visibleAt(p, t) then return r end
		table.insert(skip, p); params.FilterDescendantsInstances = skip
		o = r.Position
		left = origin + dir - o
		if left.Magnitude < 0.05 then return nil end
	end
	return nil
end
F.firstVisible = firstVisible
function F.scan(shot, opts)
	opts = opts or {}
	local t = at(shot, 0.5)
	local pos, target, fov = F.view(shot, 0.5)
	if not pos then return nil end
	local cf = CFrame.lookAt(pos, target)
	local tanV = math.tan(math.rad(fov / 2))
	local cast = story:FindFirstChild("Cast")
	local down = firstVisible(pos, V3(0, -400, 0), t)
	local gy = down and down.Position.Y or (pos.Y - 6)
	local FAR, total, edge, bare, near, castHits = 2500, 0, 0, 0, {}, 0
	local reach = math.max(6, (target - pos).Magnitude * 0.7)
	for ix = 0, 6 do
		for iy = 0, 11 do
			total += 1
			local x, y = (ix / 3 - 1) * 0.95, (iy / 5.5 - 1) * 0.95
			local dir = cf:VectorToWorldSpace(V3(x * tanV * ASPECT, y * tanV, -1)).Unit
			local r = firstVisible(pos, dir * FAR, t)
			if not r then
				if pos.Y + dir.Y * FAR < gy - 0.5 then edge += 1 end
			else
				local p, d = r.Instance, (r.Position - pos).Magnitude
				if cast and p:IsDescendantOf(cast) then castHits += 1
				elseif r.Normal.Y > 0.9 and d > 12 and (p:IsA("Terrain") or (p.Size.X > 40 and p.Size.Z > 40)) then bare += 1
				elseif d < reach then local m = ownerModel(p); near[m] = (near[m] or 0) + 1 end
			end
		end
	end
	if edge / total > 0.02 then return string.format("the world ends in view: %d%% of the frame looks past the ground into the void (add far ground, hills or a skyline: luau/backdrop.luau)", edge / total * 100) end
	if shot.size == "wide" and bare / total > 0.4 then return string.format("empty ground: %d%% of this wide is bare floor (add buildings, street dressing, people: luau/backdrop.luau)", bare / total * 100) end
	local hasSubject = #(opts.subjects or {}) > 0 or castHits / total > 0.08
	if not hasSubject then
		if shot.size == "insert" and not shot.object then return "an insert with no `object`: name the thing the line is about, or show a character" end
		local top, topN = nil, 0
		for m, n in pairs(near) do if n > topN then top, topN = m, n end end
		if top and topN / total > 0.5 and not (shot.object and (top.Name:lower():find(tostring(shot.object):lower(), 1, true))) then
			return string.format("%s fills %d%% of the frame with no character in it: only when the line is about it (set the shot's object), else show a character", top.Name, topN / total * 100)
		end
	end
	return nil
end

-- MONSTERS AND VILLAINS (reference/story.md "The monster"): data.monsters = { { name, statues = {...}, revealLine,
-- callback = true when the last line calls back } }. Shots carry reveal = true / hint = true. Fails when a named
-- monster isn't SEEN at its reveal (3 shots: a push-in on it, a close-up / reaction, a wide with it among others),
-- has no fair hint before the reveal, or is missing from the last story shot of a chilling callback.
function F.seen(m, shot, a, clear)
	local t = at(shot, a)
	if not (m and m:FindFirstChild("Head")) then return false, "no statue" end
	if not visibleAt(m.Head, t) then return false, "hidden then" end
	local pos, target, fov = F.view(shot, a)
	if not pos then return false, "no spot" end
	local cf = CFrame.lookAt(pos, target)
	local tanV = math.tan(math.rad(fov / 2))
	local x, y = project(cf, tanV, m.Head.Position)
	if not x or math.abs(x) > 1 or math.abs(y) > 1 then return false, "out of the frame" end
	if clear then
		local r = firstVisible(pos, m.Head.Position - pos, t)
		if r and not r.Instance:IsDescendantOf(m) and (r.Position - m.Head.Position).Magnitude > m.Head.Size.Magnitude then
			return false, "hidden behind " .. r.Instance.Name
		end
	end
	return true
end
function F.monsters()
	local probs = {}
	local story_shots = {}
	for _, s in ipairs(data.shots) do if s.kind ~= "endcard" then table.insert(story_shots, s) end end
	for _, mon in ipairs(data.monsters or {}) do
		local ms = {}
		for _, n in ipairs(mon.statues or {}) do local m = F.char(n); if m then table.insert(ms, m) else table.insert(probs, mon.name .. ": no statue " .. n) end end
		local function seenAny(s, clear) for _, m in ipairs(ms) do if F.seen(m, s, 0.5, clear) then return m end end end
		local firstReveal, push, closeUp, wideAmong = nil, false, false, false
		for _, s in ipairs(story_shots) do
			if s.reveal or (mon.revealLine and s.line == mon.revealLine) then
				firstReveal = firstReveal or s
				local m = seenAny(s, true)
				if m and (s.move == "push_slow" or s.move == "push_fast" or s.move == "dolly_zoom" or s.move == "crash") then push = true end
				if s.size == "close" or s.size == "reaction" then closeUp = true end
				if m and s.size == "wide" then
					for _, c in ipairs(chars) do if c ~= m and not table.find(ms, c) and F.seen(c, s, 0.5) then wideAmong = true; break end end
				end
			end
		end
		if not firstReveal then table.insert(probs, mon.name .. ": no reveal shots (mark them reveal = true)")
		else
			if not push then table.insert(probs, mon.name .. ": no push-in on the monster at its reveal (seen clearly, push_slow / push_fast / dolly_zoom)") end
			if not closeUp then table.insert(probs, mon.name .. ": no close-up / reaction shot at the reveal") end
			if not wideAmong then table.insert(probs, mon.name .. ": no wide showing it among the others at the reveal") end
			local hint = false
			for _, s in ipairs(story_shots) do
				if s.t0 >= firstReveal.t0 then break end
				if s.hint and seenAny(s, false) then hint = true end
			end
			if not hint then table.insert(probs, mon.name .. ": no hint shot before the reveal (hint = true, the shape half-hidden or far)") end
		end
		if mon.callback then
			local last = story_shots[#story_shots]
			if not (last and (seenAny(last, false) or (last.shadow and F.find(last.shadow) and visibleAt(F.find(last.shadow), at(last, 0.5))))) then
				table.insert(probs, mon.name .. ": the last line calls back, but the last shot doesn't show it (or its shadow)")
			end
		end
	end
	return probs
end

return F
