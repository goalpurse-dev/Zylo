-- Zyvo Studio Kit: SHOW THE USER WHAT WAS JUST BUILT (run with execute_luau in Edit, after every build step: each
-- blockout location, the world dressing, each cast group, the lighting, the end card). The kit builds far from the
-- Baseplate, so without this the user looks at an empty Studio. It moves the user's EDITOR camera to look at the
-- thing over a three-quarter angle from above, then hands the camera straight back: the user can fly around at once
-- (right-click + WASD), nothing is locked, nothing is saved.
-- WHAT: a name under workspace.ZyvoStory (a location folder like "street", a cast group like "st_hero", a statue, a
-- model), or nil with AT / SIZE (a point and the size to fit).
local WHAT = "street"
local AT, SIZE = nil, nil -- e.g. Vector3.new(0, 0, 0), Vector3.new(120, 30, 120)

local story = workspace:FindFirstChild("ZyvoStory")
local center, size
if WHAT and story then
	local inst = story:FindFirstChild(WHAT, true)
	if not inst then return { ok = false, why = "nothing named " .. WHAT .. " under workspace.ZyvoStory" } end
	if inst:IsA("BasePart") then
		center, size = inst.Position, inst.Size
	else
		-- the box around every visible part in it (a folder has no pivot of its own)
		local lo, hi = Vector3.new(math.huge, math.huge, math.huge), Vector3.new(-math.huge, -math.huge, -math.huge)
		local any = false
		for _, p in ipairs(inst:GetDescendants()) do
			if p:IsA("BasePart") and p.Transparency < 0.99 and p.Size.Magnitude < 400 then
				any = true
				local h = p.Size / 2
				lo = Vector3.new(math.min(lo.X, p.Position.X - h.X), math.min(lo.Y, p.Position.Y - h.Y), math.min(lo.Z, p.Position.Z - h.Z))
				hi = Vector3.new(math.max(hi.X, p.Position.X + h.X), math.max(hi.Y, p.Position.Y + h.Y), math.max(hi.Z, p.Position.Z + h.Z))
			end
		end
		if not any then return { ok = false, why = WHAT .. " has no visible parts yet" } end
		center, size = (lo + hi) / 2, hi - lo
	end
else
	center, size = AT, SIZE or Vector3.new(60, 20, 60)
end
if not center then return { ok = false, why = "give WHAT or AT" } end

-- far enough back that the whole thing fits a 70 degree view, from the front-right and above
local radius = math.max(8, math.max(size.X, size.Z) * 0.6, size.Y * 0.9)
local dist = radius / math.tan(math.rad(35)) * 1.1
local dir = Vector3.new(0.55, 0.45, 0.7).Unit
local cam = workspace.CurrentCamera
cam.CameraType = Enum.CameraType.Fixed
cam.CameraSubject = nil
cam.FieldOfView = 70
cam.CFrame = CFrame.lookAt(center + dir * dist, center)
cam.Focus = CFrame.new(center) -- the editor orbits around the built thing (Alt + drag)
return { ok = true, showing = WHAT or tostring(AT), at = string.format("%.0f, %.0f, %.0f", center.X, center.Y, center.Z) }
