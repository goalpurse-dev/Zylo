-- Zyvo Studio Kit: THE CAST (run with execute_luau in Edit). One custom R15 avatar per character from the script's
-- style sheet: their own body colours (shirt = torso + arms, trousers = legs), optional free catalog items, and simple
-- part-built hair / hats in our blocky style. Never the default classic look. No name tags, no health bars.
-- If CreateHumanoidModelFromDescription is refused here, the user adds blank rigs with Avatar > Rig Builder
-- (R15, Block Avatar), names them, and this script only colours and dresses them (USE_EXISTING = true).
local USE_EXISTING = false
local CAST = {
	-- { name = "Mo", at = Vector3.new(0, 0, 5), face = Vector3.new(0, 0, -10), skin = Color3.fromRGB(255, 204, 153),
	--   shirt = Color3.fromRGB(255, 210, 0), trousers = Color3.fromRGB(30, 30, 30),
	--   hair = { color = Color3.fromRGB(60, 40, 30), style = "cap" }, -- style: "cap" | "spiky" | "bun" | "none"
	--   hat = nil, -- { color = Color3, style = "beanie" | "cap" }
	--   items = {}, -- optional FREE catalog accessory ids (checked with asset_ok.luau first)
	--   scale = 1 },
}

local Players = game:GetService("Players")
local story = workspace:FindFirstChild("ZyvoStory") or Instance.new("Folder")
story.Name = "ZyvoStory"
story.Parent = workspace
local castFolder = story:FindFirstChild("Cast") or Instance.new("Folder")
castFolder.Name = "Cast"
castFolder.Parent = story

local function weldTo(part, to)
	local w = Instance.new("WeldConstraint")
	w.Part0, w.Part1 = to, part
	w.Parent = part
end
local function block(model, head, name, size, offset, color)
	local p = Instance.new("Part")
	p.Name, p.Size, p.Color = name, size, color
	p.Material = Enum.Material.SmoothPlastic
	p.CanCollide, p.Massless = false, true
	p.CFrame = head.CFrame * offset
	p.Parent = model
	weldTo(p, head)
	return p
end
local function dressHead(model, c)
	local head = model:FindFirstChild("Head")
	if not head then return end
	local hy = head.Size.Y
	if c.hair and c.hair.style ~= "none" then
		local col = c.hair.color or Color3.fromRGB(60, 40, 30)
		block(model, head, "ZyvoHair", Vector3.new(head.Size.X + 0.12, hy * 0.35, head.Size.Z + 0.12), CFrame.new(0, hy * 0.38, 0), col)
		if c.hair.style == "spiky" then
			for i = -1, 1 do block(model, head, "ZyvoSpike", Vector3.new(0.3, 0.4, 0.3), CFrame.new(i * 0.35, hy * 0.62, 0), col) end
		elseif c.hair.style == "bun" then
			block(model, head, "ZyvoBun", Vector3.new(0.55, 0.55, 0.55), CFrame.new(0, hy * 0.55, 0.45), col)
		end
	end
	if c.hat then
		local col = c.hat.color or Color3.fromRGB(200, 40, 40)
		block(model, head, "ZyvoHat", Vector3.new(head.Size.X + 0.2, hy * 0.3, head.Size.Z + 0.2), CFrame.new(0, hy * 0.6, 0), col)
		if c.hat.style == "cap" then
			block(model, head, "ZyvoBrim", Vector3.new(head.Size.X, 0.08, 0.6), CFrame.new(0, hy * 0.48, -head.Size.Z * 0.75), col)
		end
	end
end
local function colour(model, c)
	local hum = model:FindFirstChildOfClass("Humanoid")
	if hum then
		hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
		hum.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
		hum.NameDisplayDistance = 0
	end
	local skin = c.skin or Color3.fromRGB(255, 204, 153)
	local shirt = c.shirt or Color3.fromRGB(70, 130, 230)
	local legs = c.trousers or Color3.fromRGB(50, 50, 60)
	for _, p in ipairs(model:GetDescendants()) do
		if p:IsA("BasePart") and not p.Name:match("^Zyvo") then
			local n = p.Name
			if n == "Head" or n:match("Hand$") then p.Color = skin
			elseif n:match("Torso") or n:match("Arm$") then p.Color = shirt
			elseif n:match("Leg$") or n:match("Foot$") then p.Color = legs end
		end
	end
	local bc = model:FindFirstChildOfClass("BodyColors")
	if bc then bc:Destroy() end -- our part colours win
end
local function place(model, c)
	local target = c.face or (c.at + Vector3.new(0, 0, -10))
	model:PivotTo(CFrame.lookAt(c.at + Vector3.new(0, 5, 0), Vector3.new(target.X, c.at.Y + 5, target.Z)))
	local cf, size = model:GetBoundingBox()
	model:PivotTo(model:GetPivot() + Vector3.new(0, c.at.Y - (cf.Position.Y - size.Y / 2), 0))
	local hrp = model:FindFirstChild("HumanoidRootPart")
	if hrp then hrp.Anchored = true end -- stands still in Edit; the actions script frees it to walk
end

local made, problems = {}, {}
for _, c in ipairs(CAST) do
	local model
	if USE_EXISTING then
		model = castFolder:FindFirstChild(c.name) or workspace:FindFirstChild(c.name)
		if not model then table.insert(problems, c.name .. ": no rig named " .. c.name .. " (add one with Rig Builder)") end
	else
		local old = castFolder:FindFirstChild(c.name)
		if old then old:Destroy() end
		local desc = Instance.new("HumanoidDescription")
		local s = c.scale or 1
		desc.HeightScale, desc.WidthScale, desc.HeadScale, desc.DepthScale = s, s, s, s
		if c.items and #c.items > 0 then desc.HatAccessory = table.concat(c.items, ",") end
		local ok, m = pcall(function() return Players:CreateHumanoidModelFromDescription(desc, Enum.HumanoidRigType.R15) end)
		if ok and m then model = m else table.insert(problems, c.name .. ": " .. tostring(m) .. " (use Rig Builder + USE_EXISTING)") end
	end
	if model then
		model.Name = c.name
		for _, d in ipairs(model:GetDescendants()) do if d:IsA("LuaSourceContainer") then d:Destroy() end end
		model.Parent = castFolder
		colour(model, c)
		dressHead(model, c)
		place(model, c)
		table.insert(made, c.name)
	end
end
return { ok = #problems == 0, made = made, problems = problems }
