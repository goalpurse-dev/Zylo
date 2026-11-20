-- Zyvo Studio Kit: THE ACTIONS (a Script in ServerScriptService, only in this unsaved place). In Play: hides the
-- player's own avatar (never in a shot), sets the shared start clock (workspace.ZyvoStart), plays idle / walk on the
-- cast and runs each shot's actions (walk, face, jump, show, hide) on time.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local data = require(ReplicatedStorage:WaitForChild("ZyvoShots"))
local story = workspace:WaitForChild("ZyvoStory")
local cast = story:WaitForChild("Cast")
local marks = story:FindFirstChild("Marks")
local LEAD = data.leadIn or 3

local anims = {}

local function hideAvatar(character)
	for _, d in ipairs(character:GetDescendants()) do
		if d:IsA("BasePart") or d:IsA("Decal") then d.Transparency = 1 end
		if d:IsA("Sound") then d.Volume = 0 end
	end
	local hum = character:FindFirstChildOfClass("Humanoid")
	if hum then hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None end
	local hrp = character:FindFirstChild("HumanoidRootPart")
	if hrp then
		hrp.Anchored = true
		character:PivotTo(CFrame.new(0, -300, 0)) -- under the world, above the kill height
	end
end

local function readDefaultAnims(character)
	-- the player's own Animate script holds Roblox's default walk / idle ids: borrow them for the cast
	local animate = character:WaitForChild("Animate", 5)
	if not animate then return end
	local function id(group, child)
		local g = animate:FindFirstChild(group)
		local a = g and (g:FindFirstChild(child) or g:FindFirstChildOfClass("Animation"))
		return a and a.AnimationId or nil
	end
	anims.walk = id("walk", "WalkAnim")
	anims.idle = id("idle", "Animation1")
end

local tracks = {}
local function track(model, kind)
	tracks[model] = tracks[model] or {}
	if tracks[model][kind] == nil and anims[kind] then
		local hum = model:FindFirstChildOfClass("Humanoid")
		local animator = hum and (hum:FindFirstChildOfClass("Animator") or Instance.new("Animator", hum))
		if animator then
			local a = Instance.new("Animation")
			a.AnimationId = anims[kind]
			local ok, t = pcall(function() return animator:LoadAnimation(a) end)
			tracks[model][kind] = ok and t or false
		end
	end
	return tracks[model][kind] or nil
end

local function find(name)
	return cast:FindFirstChild(name) or story:FindFirstChild(name, true)
end
local function pointOf(name)
	local m = marks and marks:FindFirstChild(name)
	if m then return m.Position end
	local who = find(name)
	if who and who:IsA("Model") then return who:GetPivot().Position end
	if who and who:IsA("BasePart") then return who.Position end
	return nil
end
local function setShown(inst, shown)
	local parts = inst:IsA("BasePart") and { inst } or inst:GetDescendants()
	for _, p in ipairs(parts) do
		if p:IsA("BasePart") or p:IsA("Decal") then
			if p:GetAttribute("ZyvoT") == nil then p:SetAttribute("ZyvoT", p.Transparency) end
			p.Transparency = shown and p:GetAttribute("ZyvoT") or 1
		end
	end
end

local function act(a)
	local who = a.who and find(a.who)
	local hum = who and who:FindFirstChildOfClass("Humanoid")
	local hrp = who and who:FindFirstChild("HumanoidRootPart")
	if a["do"] == "walk" and hum and hrp then
		local to = pointOf(a.to)
		if not to then warn("ZyvoActions: no mark " .. tostring(a.to)); return end
		hrp.Anchored = false
		local walk, idle = track(who, "walk"), track(who, "idle")
		if idle then idle:Stop(0.2) end
		if walk then walk:Play(0.2) end
		hum.WalkSpeed = a.speed or 12
		hum:MoveTo(to)
		hum.MoveToFinished:Once(function()
			if walk then walk:Stop(0.2) end
			if idle then idle:Play(0.2) end
			hrp.Anchored = true
		end)
	elseif a["do"] == "face" and hrp then
		local to = pointOf(a.to)
		if to then hrp.CFrame = CFrame.lookAt(hrp.Position, Vector3.new(to.X, hrp.Position.Y, to.Z)) end
	elseif a["do"] == "jump" and hum and hrp then
		hrp.Anchored = false
		hum.Jump = true
		task.delay(1.2, function() hrp.Anchored = true end)
	elseif (a["do"] == "show" or a["do"] == "hide") and a.what then
		local inst = find(a.what)
		if inst then setShown(inst, a["do"] == "show") else warn("ZyvoActions: nothing named " .. tostring(a.what)) end
	end
end

local started = false
local function begin(player)
	if started then return end
	started = true
	local character = player.Character or player.CharacterAdded:Wait()
	readDefaultAnims(character)
	hideAvatar(character)
	-- the hidden items start hidden (a rule object that only appears later)
	for _, name in ipairs(data.startHidden or {}) do
		local inst = find(name)
		if inst then setShown(inst, false) end
	end
	for _, m in ipairs(cast:GetChildren()) do
		local idle = track(m, "idle")
		if idle then idle.Looped = true; idle:Play() end
	end
	task.wait(1) -- let the client load the scene
	local now = workspace:GetServerTimeNow()
	workspace:SetAttribute("ZyvoStart", now + LEAD)
	for _, s in ipairs(data.shots) do
		for _, a in ipairs(s.actions or {}) do
			task.delay(LEAD + s.t0 + (a.at or 0), act, a)
		end
	end
end

Players.PlayerAdded:Connect(begin)
for _, p in ipairs(Players:GetPlayers()) do task.spawn(begin, p) end
Players.PlayerAdded:Connect(function(p)
	p.CharacterAdded:Connect(function(c) task.wait(); hideAvatar(c) end)
end)
