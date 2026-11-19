-- Zyvo Studio Kit: THE CAMERA (a LocalScript in StarterPlayer.StarterPlayerScripts, only in this unsaved place).
-- In Play: hides every bit of Roblox UI, mutes all sound, shows a black lead-in, then films the shot list
-- (ReplicatedStorage.ZyvoShots) from the camera spots, in time with the server's clock, then ends on black.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local StarterGui = game:GetService("StarterGui")
local UserInputService = game:GetService("UserInputService")
local Lighting = game:GetService("Lighting")
local SoundService = game:GetService("SoundService")

local player = Players.LocalPlayer
local data = require(ReplicatedStorage:WaitForChild("ZyvoShots"))
local story = workspace:WaitForChild("ZyvoStory")
local spots = story:WaitForChild("Spots")
local shots = data.shots
local TAIL = 1.5

-- 1. no Roblox UI in any frame
for _ = 1, 30 do
	if pcall(function() StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.All, false) end) then break end
	task.wait(0.1)
end
pcall(function() StarterGui:SetCore("ResetButtonCallback", false) end)
UserInputService.MouseIconEnabled = false
task.spawn(function()
	pcall(function()
		local module = require(player:WaitForChild("PlayerScripts"):WaitForChild("PlayerModule"))
		module:GetControls():Disable() -- no touch thumbstick / jump button on the phone view
	end)
end)

-- 2. silence (the footage has no audio; sound is added later)
local function mute(d)
	if d:IsA("Sound") then d.Volume = 0 end
end
for _, root in ipairs({ workspace, SoundService, player }) do
	for _, d in ipairs(root:GetDescendants()) do pcall(mute, d) end
	root.DescendantAdded:Connect(function(d) pcall(mute, d) end)
end
task.spawn(function()
	local ps = player:WaitForChild("PlayerScripts")
	local s = ps:WaitForChild("RbxCharacterSounds", 5)
	if s then s:Destroy() end
end)

-- 3. the black card (lead-in and tail)
local gui = Instance.new("ScreenGui")
gui.Name = "ZyvoBlack"
gui.IgnoreGuiInset = true
gui.DisplayOrder = 1000
gui.ResetOnSpawn = false
local black = Instance.new("Frame")
black.Size = UDim2.fromScale(1, 1)
black.BackgroundColor3 = Color3.new(0, 0, 0)
black.BorderSizePixel = 0
black.Parent = gui
gui.Parent = player:WaitForChild("PlayerGui")

-- 4. the camera maths
local cam = workspace.CurrentCamera
local focus = Lighting:FindFirstChild("ZyvoFocus")
local function fovOf(lens) return math.deg(2 * math.atan(12 / math.max(8, lens))) end -- 24 mm sensor height
local function ease(a) a = math.clamp(a, 0, 1); return a * a * (3 - 2 * a) end
local function spot(name)
	local p = spots:FindFirstChild(name or "")
	if not p then return nil end
	return p.Position, p:GetAttribute("Target") or (p.Position + p.CFrame.LookVector * 10), p:GetAttribute("Lens") or 35
end
local warned = {}
local function view(shot, a)
	local pos, target, lens = spot(shot.spot)
	if not pos then
		if not warned[shot.id] then warned[shot.id] = true; warn("ZyvoCamera: shot " .. tostring(shot.id) .. " has no spot " .. tostring(shot.spot)) end
		return nil
	end
	lens = shot.lens or lens
	local fov = fovOf(lens)
	if shot.spotEnd then
		local p2, t2, l2 = spot(shot.spotEnd)
		if p2 then
			local e = ease(a)
			pos, target = pos:Lerp(p2, e), target:Lerp(t2, e)
			fov += (fovOf(shot.lensEnd or l2) - fov) * e
		end
	end
	local look = target - pos
	local d = math.max(0.5, look.Magnitude)
	local dir = look.Unit
	local m = shot.move or "static"
	local dof = false
	if m == "push_slow" then
		pos += dir * (d * 0.15 * ease(a))
	elseif m == "push_fast" then
		pos += dir * (d * 0.3 * ease(a / 0.35))
	elseif m == "pull_slow" then
		pos -= dir * (d * 0.22 * ease(a))
	elseif m == "orbit" then
		pos = target + CFrame.Angles(0, math.rad(20) * (a - 0.5), 0):VectorToWorldSpace(pos - target)
	elseif m == "track" then
		local right = dir:Cross(Vector3.yAxis)
		if right.Magnitude > 0.01 then right = right.Unit; pos += right * (4 * (a - 0.5)); target += right * (4 * (a - 0.5)) end
	elseif m == "whip" then
		local k = ease(a / 0.2)
		target = pos + CFrame.Angles(0, math.rad(30) * (1 - k), 0):VectorToWorldSpace(target - pos)
	elseif m == "crash" then
		fov = fovOf(lens * (1 + 0.6 * ease(a / 0.25)))
	elseif m == "dolly_zoom" then
		-- in while the lens widens: the subject keeps its size, the world behind it stretches
		local nd = d * (1 - 0.35 * ease(a))
		pos = target - dir * nd
		fov = math.deg(2 * math.atan(math.tan(math.rad(fov / 2)) * d / nd))
	elseif m == "rack_focus" then
		dof = true
		if focus then
			focus.FocusDistance = d * (0.35 + 0.65 * ease(a))
			focus.InFocusRadius = math.max(2, d * 0.15)
			focus.NearIntensity, focus.FarIntensity = 0.7, 0.6
		end
	elseif m == "handheld" then
		local t = os.clock()
		pos += Vector3.new(math.noise(t * 1.3, 0.1, 0), math.noise(0.2, t * 1.1, 0), 0) * 0.25
	end
	if focus then focus.Enabled = dof end
	return CFrame.lookAt(pos, target), math.clamp(fov, 5, 110)
end

-- 5. the timeline (the server sets workspace.ZyvoStart = when the voice's second 0 is)
while workspace:GetAttribute("ZyvoStart") == nil do task.wait() end
local start = workspace:GetAttribute("ZyvoStart")
local last = shots[#shots]
local endT = last and last.t1 or 0
local i = 1
RunService:BindToRenderStep("ZyvoCamera", Enum.RenderPriority.Camera.Value + 1, function()
	cam.CameraType = Enum.CameraType.Scriptable
	local t = workspace:GetServerTimeNow() - start
	if t < 0 or t >= endT then
		black.BackgroundTransparency = 0
		if t >= endT + TAIL then RunService:UnbindFromRenderStep("ZyvoCamera") end
		return
	end
	while shots[i + 1] and t >= shots[i].t1 do i += 1 end
	local s = shots[i]
	local a = (t - s.t0) / math.max(0.05, s.t1 - s.t0)
	local cf, fov = view(s, a)
	if cf then
		black.BackgroundTransparency = 1
		cam.CFrame, cam.FieldOfView = cf, fov
	else
		black.BackgroundTransparency = 0
	end
end)
