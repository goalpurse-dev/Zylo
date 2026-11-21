-- Zyvo Studio Kit: LIFE for the anchored cast statues (LocalScript in StarterPlayerScripts, client only, Play only).
-- Only characters that are visible AND on screen get moved (max 40), with one BulkMoveTo per frame. Styles come
-- from each character's "Life" attribute; each part's "Bone" attribute says which joint chain it follows (both set
-- by luau/cast_lib.luau). A character that just appeared (a show/hide cut) plays its entrance: sleepers slump or
-- topple, yawners stretch, wavers raise their arm, and the thing on their head (ZyvoOnHead) pops up.
-- Styles: idle, sleep, yawn, baby, groove, shout, tired, wired, laugh, wave, work.
local RunService = game:GetService("RunService")
local cam = workspace.CurrentCamera
local cast = workspace:WaitForChild("ZyvoStory"):WaitForChild("Cast")
task.wait(0.5)

-- 0. sign text follows its board: the kit's hide only sets Transparency, and a SurfaceGui still draws on an invisible
--    part, so a SurfaceGui tagged ZyvoFollowPart switches off while its part is hidden (the actions script also
--    switches guis; this keeps a tagged one in step on the client), and never shows while something it sits in is
--    hidden (ZyvoHidden, set by runtime/ZyvoActions)
local storyRoot = workspace.ZyvoStory
local function hiddenUp(inst)
	while inst and inst ~= storyRoot do
		if inst:GetAttribute("ZyvoHidden") then return true end
		inst = inst.Parent
	end
	return false
end
for _, g in ipairs(storyRoot:GetDescendants()) do
	if (g:IsA("SurfaceGui") or g:IsA("BillboardGui")) and g:GetAttribute("ZyvoFollowPart") and g.Parent:IsA("BasePart") then
		local p = g.Parent
		local function follow() g.Enabled = p.Transparency < 0.99 and not hiddenUp(g) end
		follow()
		p:GetPropertyChangedSignal("Transparency"):Connect(follow)
	end
end

local MAX_ACTIVE, RANGE = 40, 110
local rad, sin, abs = math.rad, math.sin, math.abs
local function ease(a) a = math.clamp(a, 0, 1); return a * a * (3 - 2 * a) end
local function about(p, axis, ang) return CFrame.new(p) * CFrame.fromAxisAngle(axis, ang) * CFrame.new(-p) end

-- 1. read every character once (rest pose = the Edit pose)
local chars = {}
for _, m in ipairs(cast:GetDescendants()) do
	if m:IsA("Model") and m:GetAttribute("Life") and m:FindFirstChild("Head") then
		local hrp = m:FindFirstChild("HumanoidRootPart")
		local c = { m = m, style = m:GetAttribute("Life"), head = m.Head, parts = {}, rest = {}, bone = {},
			R = hrp.CFrame.RightVector, F = hrp.CFrame.LookVector, U = hrp.CFrame.UpVector,
			center = m.UpperTorso.Position, phase = math.random() * 6.28, shown = false, since = 0 }
		local ut, hd = m.UpperTorso, m.Head
		c.waist = ut.CFrame:PointToWorldSpace(Vector3.new(0, -ut.Size.Y / 2, 0))
		c.neck = hd.CFrame:PointToWorldSpace(Vector3.new(0, -hd.Size.Y / 2, 0))
		c.lsh = m.LeftUpperArm.CFrame:PointToWorldSpace(Vector3.new(0, m.LeftUpperArm.Size.Y / 2, 0))
		c.rsh = m.RightUpperArm.CFrame:PointToWorldSpace(Vector3.new(0, m.RightUpperArm.Size.Y / 2, 0))
		c.feet = m:GetAttribute("Feet") or hrp.Position
		c.lying = abs(c.U.Y) < 0.5 -- a lying statue (its up vector is horizontal)
		c.slumped = (hd.Position - c.waist).Unit.Y < 0.75 and not c.lying
		for _, p in ipairs(m:GetDescendants()) do
			if p:IsA("BasePart") and p.Name ~= "HumanoidRootPart" then
				table.insert(c.parts, p); table.insert(c.rest, p.CFrame); table.insert(c.bone, p:GetAttribute("Bone") or "Body")
			end
		end
		table.insert(chars, c)
	end
end

-- 2. the styles: return the five joint transforms (world space, about the rest pivots)
local I = CFrame.identity
local function poseOf(c, t, ta)
	local R, F, U = c.R, c.F, Vector3.yAxis
	local ph = c.phase
	local W, Wa, N, LA, RA, CL = I, I, I, I, I, I
	local s = c.style
	CL = CFrame.new(0, -1.6 * (1 - ease((ta - 0.4) / 0.4)) + 0.18 * sin(t * 1.6 + ph), 0) -- the head object pops up, then bobs
	if s == "sleep" then
		local e = ease(ta / 0.7)
		if c.lying then W = about(c.feet, R, rad(-90) * (1 - e)) -- topples over
		elseif c.slumped then Wa = about(c.waist, R, rad(45) * (1 - e)) end -- slumps forward
		Wa = Wa * about(c.waist, c.lying and U or R, rad(2.5) * sin(t * 1.3 + ph)) -- slow deep breaths
	elseif s == "yawn" then
		local e = ease(ta / 0.9)
		LA = about(c.lsh, R, rad(-150) * (1 - e) + rad(6) * sin(t * 1.7))
		RA = about(c.rsh, R, rad(-150) * (1 - e) + rad(6) * sin(t * 1.7 + 0.5))
		N = about(c.neck, R, rad(5) * sin(t * 1.2))
		Wa = about(c.waist, R, rad(4) * e)
	elseif s == "baby" then
		W = about(c.feet, F, rad(7) * sin(t * 8 + ph))
		LA = about(c.lsh, R, rad(35) * sin(t * 11))
		RA = about(c.rsh, R, rad(35) * sin(t * 11 + 3.1))
	elseif s == "groove" then -- playing music, bobbing to the beat
		LA = about(c.lsh, R, rad(10) * sin(t * 4.5 + ph))
		RA = about(c.rsh, R, rad(10) * sin(t * 4.5 + ph + 1.6))
		N = about(c.neck, R, rad(7) * sin(t * 4.5 + ph))
		W = CFrame.new(0, 0.08 * abs(sin(t * 4.5 + ph)), 0)
	elseif s == "shout" then
		local e = ease(ta / 0.3)
		LA = about(c.lsh, R, rad(130) * e + rad(10) * sin(t * 10 + ph))
		RA = about(c.rsh, R, rad(130) * e + rad(10) * sin(t * 10 + ph + 1))
		W = CFrame.new(0, 0.15 * abs(sin(t * 8 + ph)), 0)
	elseif s == "tired" then
		N = about(c.neck, R, rad(-6) + rad(5) * sin(t * 0.9 + ph)) -- nodding off
		Wa = about(c.waist, R, rad(2) * sin(t * 1.1 + ph))
	elseif s == "wired" then
		W = about(c.feet, U, rad(3) * math.noise(t * 6, ph))
		RA = about(c.rsh, R, rad(8) * math.noise(t * 9, ph + 3))
		N = about(c.neck, U, rad(10) * math.noise(t * 5, ph + 7))
	elseif s == "laugh" then
		Wa = about(c.waist, R, rad(-4) * abs(sin(t * 9)))
		N = about(c.neck, R, rad(6) * sin(t * 9))
	elseif s == "wave" then
		local e = ease(ta / 0.4)
		RA = about(c.rsh, R, rad(155) * e) * about(c.rsh, F, rad(18) * sin(t * 7) * e)
		Wa = about(c.waist, R, rad(1.5) * sin(t * 2 + ph))
	elseif s == "work" then -- busy hands (a hose, a tool, a mixer)
		W = about(c.feet, U, rad(2) * sin(t * 3 + ph))
		LA = about(c.lsh, R, rad(3) * sin(t * 14))
		RA = about(c.rsh, R, rad(3) * sin(t * 14))
	else -- idle: breathing + a slow look around
		Wa = about(c.waist, R, rad(1.3) * sin(t * 2.2 + ph))
		N = about(c.neck, U, rad(5) * sin(t * 0.7 + ph))
	end
	return W, Wa, N, LA, RA, CL
end

-- 3. who is on screen (checked 4x a second)
local active, lastPick = {}, 0
local function visible(c) return c.head.Transparency < 0.99 end
local function pick(now)
	local list = {}
	local cp = cam.CFrame.Position
	for _, c in ipairs(chars) do
		local vis = visible(c)
		if vis and not c.shown then c.since = now end
		c.shown = vis
		if vis then
			local d = (c.center - cp).Magnitude
			if d < RANGE then
				local _, on = cam:WorldToViewportPoint(c.center)
				if on then table.insert(list, { c = c, d = d }) end
			end
		end
	end
	table.sort(list, function(a, b) return a.d < b.d end)
	local keep = {}
	for i = 1, math.min(MAX_ACTIVE, #list) do keep[list[i].c] = true end
	-- characters that leave the screen go back to their rest pose
	for c in pairs(active) do
		if not keep[c] then workspace:BulkMoveTo(c.parts, c.rest, Enum.BulkMoveMode.FireCFrameChanged) end
	end
	active = keep
end

local start = os.clock()
RunService:BindToRenderStep("ZyvoLife", Enum.RenderPriority.Camera.Value + 2, function()
	local now = os.clock()
	if now - lastPick > 0.25 then lastPick = now; pick(now) end
	local parts, cfs = {}, {}
	local t = now - start
	for c in pairs(active) do
		local W, Wa, N, LA, RA, CL = poseOf(c, t, now - c.since)
		local up = W * Wa
		for i, p in ipairs(c.parts) do
			local b = c.bone[i]
			local T
			if b == "Body" then T = W
			elseif b == "Upper" then T = up
			elseif b == "Head" then T = up * N
			elseif b == "LArm" then T = up * LA
			elseif b == "RArm" then T = up * RA
			else T = up * N * CL end -- the head object (ZyvoOnHead) rides on the head
			parts[#parts + 1] = p
			cfs[#cfs + 1] = T * c.rest[i]
		end
	end
	if #parts > 0 then workspace:BulkMoveTo(parts, cfs, Enum.BulkMoveMode.FireCFrameChanged) end
end)
