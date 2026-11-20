-- Zyvo Studio Kit: THE CAST LIBRARY (ModuleScript game.ServerStorage.ZyvoCastLib, edit-time only; never runs in Play).
-- Builds posed avatar statues from one blank R15 rig (made once in ServerStorage.ZyvoRig): body colours, part-built
-- hair / hats / props in our blocky style, FaceControls expressions, an optional thing riding on the head (the rule
-- object), and the tags runtime/ZyvoLife reads (Life style, Bone per part, Feet). Every part is anchored, so the pose
-- is exact in Edit and in Play; ZyvoLife moves them a little (breathing, yawns, waves) while they are on screen.
-- A character that must WALK (a walk action) is made with walker = true: unanchored, standing, no Life.
-- Install: multi_edit, file_path game.ServerStorage.ZyvoCastLib, className ModuleScript, the full text of this file.
-- Use: luau/cast.luau.
local L = {}
local V, C = Vector3.new, Color3.fromRGB
local SS = game:GetService("ServerStorage")

-- the blank rig every character is cloned from (a plain R15 body, no catalog items)
function L.rig()
	local r = SS:FindFirstChild("ZyvoRig")
	if r then return r end
	local Players = game:GetService("Players")
	local ok, m = pcall(function()
		return Players:CreateHumanoidModelFromDescription(Instance.new("HumanoidDescription"), Enum.HumanoidRigType.R15)
	end)
	if not ok then error("can't make the blank rig here (" .. tostring(m) .. "): add one with Avatar > Rig Builder (R15, Block), name it ZyvoRig and move it to ServerStorage") end
	m.Name = "ZyvoRig"; m.Parent = SS
	return m
end

-- the life styles runtime/ZyvoLife knows (anything else plays idle)
L.LIFE = { idle = true, sleep = true, yawn = true, baby = true, groove = true, shout = true, tired = true, wired = true,
	laugh = true, wave = true, work = true }

L.EXPR = {
	neutral = {},
	smile = { LeftLipCornerPuller = 0.7, RightLipCornerPuller = 0.7 },
	proud = { LeftLipCornerPuller = 1, RightLipCornerPuller = 1, LeftCheekRaiser = 0.6, RightCheekRaiser = 0.6 },
	yawn = { JawDrop = 1, LeftEyeClosed = 0.9, RightEyeClosed = 0.9, LeftInnerBrowRaiser = 0.7, RightInnerBrowRaiser = 0.7 },
	asleep = { LeftEyeClosed = 1, RightEyeClosed = 1, JawDrop = 0.25 },
	scream = { JawDrop = 1, LeftEyeClosed = 1, RightEyeClosed = 1, LeftBrowLowerer = 1, RightBrowLowerer = 1, LeftLipStretcher = 1, RightLipStretcher = 1 },
	tired = { LeftEyeClosed = 0.55, RightEyeClosed = 0.55, LeftLipCornerDown = 0.5, RightLipCornerDown = 0.5, LeftInnerBrowRaiser = 0.5, RightInnerBrowRaiser = 0.5 },
	sad = { LeftInnerBrowRaiser = 1, RightInnerBrowRaiser = 1, LeftLipCornerDown = 0.9, RightLipCornerDown = 0.9 },
	wired = { LeftUpperLidRaiser = 1, RightUpperLidRaiser = 1, LeftLipCornerPuller = 0.9, RightLipCornerPuller = 0.9, LeftOuterBrowRaiser = 0.8, RightOuterBrowRaiser = 0.8 },
	laugh = { JawDrop = 0.6, LeftLipCornerPuller = 1, RightLipCornerPuller = 1, LeftEyeClosed = 0.6, RightEyeClosed = 0.6, LeftCheekRaiser = 1, RightCheekRaiser = 1 },
	shocked = { JawDrop = 0.8, LeftUpperLidRaiser = 1, RightUpperLidRaiser = 1, LeftInnerBrowRaiser = 1, RightInnerBrowRaiser = 1, LeftOuterBrowRaiser = 1, RightOuterBrowRaiser = 1 },
	grimace = { LeftEyeClosed = 0.8, RightEyeClosed = 0.8, LeftLipStretcher = 1, RightLipStretcher = 1, LeftBrowLowerer = 0.7, RightBrowLowerer = 0.7 },
	determined = { LeftBrowLowerer = 0.6, RightBrowLowerer = 0.6, LeftLipCornerPuller = 0.3, RightLipCornerPuller = 0.3 },
}

local function part(parent, name, size, cf, color, mat, shape)
	local p = Instance.new("Part")
	p.Name, p.Size, p.CFrame, p.Color = name, size, cf, color
	p.Material = mat or Enum.Material.SmoothPlastic
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch = true, false, false, false
	p.CastShadow = true
	if shape then p.Shape = shape end
	p.Parent = parent
	return p
end
L.part = part

local function rot(parts, pivot, axis, ang)
	local T = CFrame.new(pivot) * CFrame.fromAxisAngle(axis, ang) * CFrame.new(-pivot)
	for _, p in ipairs(parts) do if p then p.CFrame = T * p.CFrame end end
end
local function top(p) return p.CFrame:PointToWorldSpace(V(0, p.Size.Y / 2, 0)) end
local function bottom(p) return p.CFrame:PointToWorldSpace(V(0, -p.Size.Y / 2, 0)) end
local function minY(parts)
	local y = math.huge
	for _, p in ipairs(parts) do
		local s = p.Size / 2
		for _, sx in ipairs({ -1, 1 }) do for _, sy in ipairs({ -1, 1 }) do for _, sz in ipairs({ -1, 1 }) do
			y = math.min(y, p.CFrame:PointToWorldSpace(V(s.X * sx, s.Y * sy, s.Z * sz)).Y)
		end end end
	end
	return y
end

local function bodyParts(m)
	local t = {}
	for _, p in ipairs(m:GetDescendants()) do if p:IsA("BasePart") then table.insert(t, p) end end
	return t
end

-- pose: all parts anchored, so the pose is exact in Edit and Play
local function pose(m, kind, R, F)
	local g = function(n) return m:FindFirstChild(n) end
	local function arm(s) return { g(s .. "UpperArm"), g(s .. "LowerArm"), g(s .. "Hand") } end
	local function leg(s) return { g(s .. "UpperLeg"), g(s .. "LowerLeg"), g(s .. "Foot") } end
	local function sit()
		for _, s in ipairs({ "Left", "Right" }) do
			rot(leg(s), top(g(s .. "UpperLeg")), R, math.rad(90))
			rot({ g(s .. "LowerLeg"), g(s .. "Foot") }, top(g(s .. "LowerLeg")), R, math.rad(-90))
		end
	end
	local function upper() local t = { g("UpperTorso"), g("Head") }; for _, p in ipairs(arm("Left")) do table.insert(t, p) end; for _, p in ipairs(arm("Right")) do table.insert(t, p) end; return t end
	if kind == "sit_stretch" then
		sit()
		for i, s in ipairs({ "Left", "Right" }) do
			rot(arm(s), top(g(s .. "UpperArm")), R, math.rad(170))
			rot(arm(s), top(g(s .. "UpperArm")), F, math.rad(i == 1 and -40 or 40))
		end
		rot({ g("Head") }, bottom(g("Head")), R, math.rad(14))
	elseif kind == "sit" or kind == "slump" or kind == "sit_tired" then
		sit()
		if kind == "slump" then
			rot(upper(), bottom(g("UpperTorso")), R, math.rad(-50))
			rot({ g("Head") }, bottom(g("Head")), R, math.rad(-25))
			for _, s in ipairs({ "Left", "Right" }) do rot(arm(s), top(g(s .. "UpperArm")), R, math.rad(45)) end
		elseif kind == "sit_tired" then
			rot({ g("Head") }, bottom(g("Head")), R, math.rad(-12))
		end
	elseif kind == "stretch" then
		for i, s in ipairs({ "Left", "Right" }) do
			rot(arm(s), top(g(s .. "UpperArm")), R, math.rad(170))
			rot(arm(s), top(g(s .. "UpperArm")), F, math.rad(i == 1 and -40 or 40))
		end
		rot({ g("Head") }, bottom(g("Head")), R, math.rad(14))
	elseif kind == "ears" then -- hands over the ears, arms raised from the sides (the face stays open)
		for i, s in ipairs({ "Left", "Right" }) do
			rot(arm(s), top(g(s .. "UpperArm")), F, math.rad((i == 1 and 1 or -1) * (L.EARS_UP or 125)))
			rot({ g(s .. "LowerArm"), g(s .. "Hand") }, top(g(s .. "LowerArm")), F, math.rad((i == 1 and 1 or -1) * (L.EARS_ELBOW or 120)))
		end
	elseif kind == "arms_fwd" then
		for _, s in ipairs({ "Left", "Right" }) do rot(arm(s), top(g(s .. "UpperArm")), R, math.rad(75)) end
	elseif kind == "arms_up" then
		for i, s in ipairs({ "Left", "Right" }) do
			rot(arm(s), top(g(s .. "UpperArm")), R, math.rad(150))
			rot(arm(s), top(g(s .. "UpperArm")), F, math.rad(i == 1 and -45 or 45))
		end
	elseif kind == "point" then
		rot(arm("Right"), top(g("RightUpperArm")), R, math.rad(95))
	elseif kind == "hold" then
		rot(arm("Right"), top(g("RightUpperArm")), R, math.rad(35))
		rot({ g("RightLowerArm"), g("RightHand") }, top(g("RightLowerArm")), R, math.rad(65))
	end
end

-- a thing riding on a head (the rule object: a cloud, a tag, a number, a crown...). build(f, at, cam) adds parts to
-- the Model f around the point `at` (just above the head), facing the camera point `cam`. Parts, so show/hide works;
-- ZyvoLife pops it up on the character's entrance and bobs it; the framer never counts it as blocking the face.
function L.onHead(m, build, cam)
	local head = m.Head
	local f = Instance.new("Model"); f.Name = "ZyvoOnHead"; f.Parent = m
	build(f, head.Position + V(0, head.Size.Y * 0.5 + 1.1, 0), cam or (head.Position + head.CFrame.LookVector * 10))
	return f
end

-- an example rule object for L.onHead: a puffy cloud in one colour, with an optional glowing letter pair (like "Z z")
function L.cloud(f, at, cam, color, letters)
	local col = color or C(176, 120, 255)
	for _, b in ipairs({ { -0.55, 0, 0, 1.1 }, { 0.5, 0.08, 0, 1.0 }, { 0, 0.38, 0.05, 1.25 }, { 0.05, -0.1, 0.1, 1.0 } }) do
		part(f, "puff", V(b[4], b[4] * 0.85, b[4]), CFrame.new(at + V(b[1], b[2], b[3])), col, Enum.Material.SmoothPlastic, Enum.PartType.Ball)
	end
	if letters then
		local function Z(pos, h)
			local cf = CFrame.lookAt(pos, V(cam.X, pos.Y, cam.Z))
			local w, th = h * 0.9, h * 0.2
			part(f, "z", V(w, th, 0.1), cf * CFrame.new(0, h / 2, 0), C(255, 255, 255), Enum.Material.Neon)
			part(f, "z", V(w, th, 0.1), cf * CFrame.new(0, -h / 2, 0), C(255, 255, 255), Enum.Material.Neon)
			local len = math.sqrt(w * w + h * h)
			part(f, "z", V(len, th, 0.1), cf * CFrame.Angles(0, 0, -math.atan2(h, w)), C(255, 255, 255), Enum.Material.Neon)
		end
		Z(at + V(0.6, 1.3, 0), 0.6)
		Z(at + V(1.0, 2.15, 0), 0.42)
	end
	return f
end

-- the tags ZyvoLife reads: Life (style), Feet (the pivot for topples), Bone (which joint chain each part follows)
local BONES = { Head = "Head", UpperTorso = "Upper", LeftUpperArm = "LArm", LeftLowerArm = "LArm", LeftHand = "LArm",
	RightUpperArm = "RArm", RightLowerArm = "RArm", RightHand = "RArm" }
function L.tag(m, life)
	m:SetAttribute("Life", L.LIFE[life or "idle"] and (life or "idle") or "idle")
	m:SetAttribute("Feet", (m.LeftFoot.Position + m.RightFoot.Position) / 2)
	local anchors = { Head = m.Head, Upper = m.UpperTorso, LArm = m.LeftHand, RArm = m.RightHand }
	for _, p in ipairs(m:GetDescendants()) do
		if p:IsA("BasePart") then
			local bone = BONES[p.Name]
			if not bone then
				if p:FindFirstAncestor("ZyvoOnHead") then bone = "OnHead"
				elseif p.Name:match("^Zyvo") then -- hair, hats, props: the nearest joint chain
					local best, bd = "Upper", math.huge
					for b, a in pairs(anchors) do local d = (a.Position - p.Position).Magnitude; if d < bd then best, bd = b, d end end
					bone = best
				else bone = "Body" end
			end
			p:SetAttribute("Bone", bone)
		end
	end
end

local function dress(m, c)
	local head, ut = m:FindFirstChild("Head"), m:FindFirstChild("UpperTorso")
	local hc, hs = head.CFrame, head.Size
	local uc, us = ut.CFrame, ut.Size
	local function H(name, size, off, color, mat, shape) return part(m, "Zyvo" .. name, size, hc * off, color, mat, shape) end
	local function T(name, size, off, color, mat, shape) return part(m, "Zyvo" .. name, size, uc * off, color, mat, shape) end
	local hair = c.hair
	if hair and hair.style ~= "none" then
		local col = hair.color or C(60, 40, 30)
		if hair.style == "sides" then
			for _, sx in ipairs({ -1, 1 }) do H("Hair", V(0.2, hs.Y * 0.45, hs.Z * 0.8), CFrame.new(sx * hs.X * 0.52, hs.Y * 0.08, 0.05), col) end
			H("Hair", V(hs.X * 0.9, hs.Y * 0.4, 0.2), CFrame.new(0, hs.Y * 0.08, hs.Z * 0.52), col)
		else
			H("Hair", V(hs.X + 0.12, hs.Y * 0.35, hs.Z + 0.12), CFrame.new(0, hs.Y * 0.38, 0.02), col)
			H("Hair", V(hs.X + 0.12, hs.Y * 0.5, 0.25), CFrame.new(0, hs.Y * 0.1, hs.Z * 0.5), col)
			if hair.style == "spiky" or hair.style == "messy" then
				for i = -1, 1 do H("Spike", V(0.32, 0.42, 0.32), CFrame.new(i * 0.36, hs.Y * 0.62, i * 0.1) * CFrame.Angles(0, 0, math.rad(i * -18)), col) end
				if hair.style == "messy" then H("Spike", V(0.5, 0.25, 0.3), CFrame.new(0.2, hs.Y * 0.45, -hs.Z * 0.5) * CFrame.Angles(0, 0, math.rad(20)), col) end
			elseif hair.style == "bun" then
				H("Bun", V(0.6, 0.6, 0.6), CFrame.new(0, hs.Y * 0.62, 0.35), col, nil, Enum.PartType.Ball)
			elseif hair.style == "long" then
				H("Hair", V(hs.X + 0.16, hs.Y * 0.9, 0.3), CFrame.new(0, -hs.Y * 0.15, hs.Z * 0.5), col)
			elseif hair.style == "tuft" then
				H("Spike", V(0.22, 0.35, 0.22), CFrame.new(0, hs.Y * 0.62, 0) * CFrame.Angles(0, 0, math.rad(15)), col)
			end
		end
	end
	local hat = c.hat
	if hat then
		local col = hat.color or C(200, 40, 40)
		if hat.style == "tophat" then
			H("HatBrim", V(hs.X + 0.7, 0.12, hs.Z + 0.7), CFrame.new(0, hs.Y * 0.52, 0), col)
			H("HatCrown", V(hs.X * 0.85, 1.3, hs.Z * 0.85), CFrame.new(0, hs.Y * 0.52 + 0.7, 0), col)
			H("HatBand", V(hs.X * 0.87, 0.22, hs.Z * 0.87), CFrame.new(0, hs.Y * 0.52 + 0.2, 0), hat.band or C(250, 196, 40))
		elseif hat.style == "nightcap" then
			H("Cap", V(hs.X + 0.14, hs.Y * 0.32, hs.Z + 0.14), CFrame.new(0, hs.Y * 0.45, 0), col)
			H("CapTip", V(hs.X * 0.55, 0.5, hs.Z * 0.55), CFrame.new(0, hs.Y * 0.68, 0.25) * CFrame.Angles(math.rad(35), 0, 0), col)
			H("Pom", V(0.42, 0.42, 0.42), CFrame.new(0, hs.Y * 0.8, 0.62), C(255, 255, 255), nil, Enum.PartType.Ball)
		elseif hat.style == "helmet" then
			H("Helmet", V(hs.X + 0.22, hs.Y * 0.42, hs.Z + 0.22), CFrame.new(0, hs.Y * 0.45, 0), col)
			H("HelmetBrim", V(hs.X + 0.3, 0.12, 0.6), CFrame.new(0, hs.Y * 0.25, hs.Z * 0.6), col)
			H("Badge", V(0.4, 0.35, 0.05), CFrame.new(0, hs.Y * 0.45, -hs.Z * 0.62), C(250, 220, 120))
		else -- beanie / cap (the kit's shapes)
			H("Hat", V(hs.X + 0.2, hs.Y * 0.3, hs.Z + 0.2), CFrame.new(0, hs.Y * 0.6, 0), col)
			if hat.style == "cap" then H("Brim", V(hs.X, 0.08, 0.6), CFrame.new(0, hs.Y * 0.48, -hs.Z * 0.75), col) end
		end
	end
	for _, x in ipairs(c.extras or {}) do
		if x == "mask_on" or x == "white_mask" then
			local col = x == "mask_on" and C(150, 90, 220) or C(140, 205, 240)
			H("Mask", V(hs.X * 0.78, hs.Y * 0.36, 0.16), CFrame.new(0, -hs.Y * 0.2, -hs.Z * 0.5), col)
			for _, sx in ipairs({ -1, 1 }) do H("MaskStrap", V(0.06, 0.08, hs.Z * 0.9), CFrame.new(sx * hs.X * 0.5, -hs.Y * 0.12, 0), col) end
		elseif x == "mask_down" then
			H("Mask", V(hs.X * 0.8, hs.Y * 0.26, hs.Z * 0.86), CFrame.new(0, -hs.Y * 0.52, 0), C(150, 90, 220))
		elseif x == "beard" then
			H("Beard", V(hs.X * 0.86, hs.Y * 0.38, hs.Z * 0.42), CFrame.new(0, -hs.Y * 0.5, -hs.Z * 0.32), C(245, 245, 245))
			H("Mustache", V(hs.X * 0.55, 0.14, 0.12), CFrame.new(0, -hs.Y * 0.14, -hs.Z * 0.52), C(245, 245, 245))
		elseif x == "mustache" or x == "mustache_grey" then
			H("Mustache", V(hs.X * 0.55, 0.15, 0.12), CFrame.new(0, -hs.Y * 0.14, -hs.Z * 0.52), x == "mustache" and C(30, 24, 20) or C(150, 150, 155))
		elseif x == "glasses" then
			for _, sx in ipairs({ -1, 1 }) do H("Lens", V(0.36, 0.28, 0.05), CFrame.new(sx * 0.24, hs.Y * 0.1, -hs.Z * 0.53), C(30, 30, 40)) end
			H("Bridge", V(0.15, 0.05, 0.05), CFrame.new(0, hs.Y * 0.12, -hs.Z * 0.53), C(30, 30, 40))
		elseif x == "moon" then
			T("Moon", V(0.06, 1.05, 1.05), CFrame.new(0, 0.12, -us.Z / 2 - 0.03) * CFrame.Angles(0, math.rad(90), 0), C(150, 90, 220), nil, Enum.PartType.Cylinder)
			T("MoonCut", V(0.06, 0.9, 0.9), CFrame.new(-0.3, 0.26, -us.Z / 2 - 0.06) * CFrame.Angles(0, math.rad(90), 0), c.shirt, nil, Enum.PartType.Cylinder)
		elseif x == "hood" then
			T("Hood", V(us.X * 0.72, 0.55, 0.55), CFrame.new(0, us.Y / 2 + 0.05, us.Z * 0.42), c.shirt)
		elseif x == "sash" then
			T("Sash", V(0.38, us.Y * 1.25, 0.06), CFrame.new(0, 0, -us.Z / 2 - 0.03) * CFrame.Angles(0, 0, math.rad(35)), C(250, 196, 40), Enum.Material.SmoothPlastic)
			T("Medal", V(0.4, 0.4, 0.08), CFrame.new(0.35, 0.3, -us.Z / 2 - 0.07), C(255, 215, 70), Enum.Material.Metal)
		elseif x == "shirtfront" then
			T("ShirtFront", V(us.X * 0.32, us.Y * 0.95, 0.05), CFrame.new(0, 0, -us.Z / 2 - 0.02), C(250, 240, 215))
		elseif x == "stripes" then
			T("Stripe", V(us.X + 0.04, 0.22, us.Z + 0.04), CFrame.new(0, -us.Y * 0.2, 0), C(250, 220, 60), Enum.Material.Neon)
		elseif x == "tie" then
			T("Tie", V(0.3, us.Y * 0.7, 0.05), CFrame.new(0, us.Y * 0.08, -us.Z / 2 - 0.03), C(250, 196, 40))
		elseif x == "pj_stripes" then
			for i = -1, 1 do T("PJ", V(us.X + 0.02, 0.14, us.Z + 0.02), CFrame.new(0, i * us.Y * 0.28, 0), C(255, 255, 255)) end
		elseif x == "cup" then
			local hand = m:FindFirstChild("RightHand")
			local cup = part(m, "ZyvoCup", V(0.75, 0.5, 0.5), CFrame.new(hand.Position + V(0, 0.45, 0)) * CFrame.Angles(0, 0, math.rad(90)), C(255, 255, 255), nil, Enum.PartType.Cylinder)
			part(m, "ZyvoCoffee", V(0.05, 0.42, 0.42), CFrame.new(hand.Position + V(0, 0.83, 0)) * CFrame.Angles(0, 0, math.rad(90)), C(110, 70, 40), nil, Enum.PartType.Cylinder)
		end
	end
end

-- c: { name, at (ground point, or the seat point for sitters), look (point to face), scale, skin, shirt, trousers,
--      shoes, pose, face, hair, hat, extras, life, extra (true = a crowd extra), walker (true = can walk),
--      onHead = function(f, at, cam) ... end (the rule object), cam (the camera point it faces) }
-- pose: stand | sit | slump | sit_tired | sit_stretch | stretch | ears | arms_fwd | arms_up | point | hold | lie
-- face (FaceControls): a key of L.EXPR. hair.style: short | sides | spiky | messy | bun | long | tuft | none.
-- hat.style: beanie | cap | tophat | nightcap | helmet. extras: see dress() below.
function L.make(c, parent)
	local m = L.rig():Clone()
	m.Name = c.name
	for _, d in ipairs(m:GetDescendants()) do
		if d:IsA("LuaSourceContainer") or d:IsA("Sound") then d:Destroy() end
	end
	local bc = m:FindFirstChildOfClass("BodyColors"); if bc then bc:Destroy() end
	local hum = m:FindFirstChildOfClass("Humanoid")
	hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	hum.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
	if c.scale and c.scale ~= 1 then m:ScaleTo(c.scale) end
	local skin, shirt = c.skin or C(255, 204, 153), c.shirt or C(70, 130, 230)
	local legs, shoes = c.trousers or C(50, 50, 60), c.shoes or C(40, 40, 45)
	for _, p in ipairs(bodyParts(m)) do
		local n = p.Name
		if n == "Head" or n:match("Hand$") then p.Color = skin
		elseif n:match("Torso") or n:match("Arm$") then p.Color = shirt
		elseif n:match("Foot$") then p.Color = shoes
		elseif n:match("Leg$") then p.Color = legs end
		p.Anchored = not c.walker
		p.CanCollide = c.walker and p.Name == "HumanoidRootPart" or false
	end
	local look = c.look or (c.at + V(0, 0, -10))
	m:PivotTo(CFrame.lookAt(c.at + V(0, 3, 0), V(look.X, c.at.Y + 3, look.Z)))
	local parts = bodyParts(m)
	local function shift(d) for _, p in ipairs(parts) do p.CFrame = p.CFrame + d end end
	shift(V(0, c.at.Y - minY(parts), 0))
	local hrp = m:FindFirstChild("HumanoidRootPart")
	local R, F = hrp.CFrame.RightVector, hrp.CFrame.LookVector
	local kind = c.walker and "stand" or (c.pose or "stand")
	if kind == "lie" then
		rot(parts, c.at, R, math.rad(90))
		shift(V(0, c.at.Y + 0.05 - minY(parts), 0))
	else
		pose(m, kind, R, F)
		if kind == "sit" or kind == "slump" or kind == "sit_tired" or kind == "sit_stretch" then
			local lt = m:FindFirstChild("LowerTorso")
			shift(c.at - bottom(lt))
		end
	end
	local fc = m.Head:FindFirstChildOfClass("FaceControls")
	if fc then for k, v in pairs(L.EXPR[c.face or "neutral"] or {}) do pcall(function() fc[k] = v end) end end
	dress(m, c)
	if c.onHead then L.onHead(m, c.onHead, c.cam) end
	if c.extra then m:SetAttribute("Extra", true) end
	if c.walker then
		-- dressing parts follow the body: weld them to the nearest body part
		for _, p in ipairs(m:GetDescendants()) do
			if p:IsA("BasePart") and p.Name:match("^Zyvo") then
				local best, bd = m.Head, math.huge
				for _, n in ipairs({ "Head", "UpperTorso", "LeftHand", "RightHand" }) do
					local a = m:FindFirstChild(n); local d = a and (a.Position - p.Position).Magnitude or math.huge
					if d < bd then best, bd = a, d end
				end
				p.Anchored = false; p.Massless = true
				local w = Instance.new("WeldConstraint"); w.Part0, w.Part1 = best, p; w.Parent = p
			end
		end
	else
		L.tag(m, c.life)
	end
	m.Parent = parent
	return m
end

function L.group(name, parent)
	local old = parent:FindFirstChild(name); if old then old:Destroy() end
	local f = Instance.new("Model"); f.Name = name; f.Parent = parent; return f
end

return L
