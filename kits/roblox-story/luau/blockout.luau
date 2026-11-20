-- Zyvo Studio Kit: the GREY BLOCKOUT (run with execute_luau in Edit). Plain grey boxes per location, each location far
-- from the others (no location ever shows in another's background), plus the rule sign. Re-running replaces a location.
-- Fill LOCATIONS: positions are relative to the location's origin; 1 stud ~ 0.28 m, a character is ~5 studs tall.
local LOCATIONS = {
	-- { name = "street", origin = Vector3.new(0, 0, 0), ground = Vector3.new(120, 1, 120),
	--   boxes = { { name = "shop_left", size = Vector3.new(24, 18, 16), pos = Vector3.new(-30, 9, 20) } },
	--   sign = { text = "IN THIS TOWN, YOUR NOSE SHOWS YOUR MOOD", pos = Vector3.new(0, 22, 30), size = Vector3.new(40, 8, 1) } },
}

local story = workspace:FindFirstChild("ZyvoStory") or Instance.new("Folder")
story.Name = "ZyvoStory"
story.Parent = workspace
local root = story:FindFirstChild("Blockout") or Instance.new("Folder")
root.Name = "Blockout"
root.Parent = story

local GREY = Color3.fromRGB(163, 162, 165)
local function box(parent, name, size, cf, color)
	local p = Instance.new("Part")
	p.Name, p.Size, p.CFrame = name, size, cf
	p.Anchored, p.TopSurface, p.BottomSurface = true, Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	p.Color = color or GREY
	p.Material = Enum.Material.SmoothPlastic
	p.Parent = parent
	return p
end

local made = {}
for _, loc in ipairs(LOCATIONS) do
	local old = root:FindFirstChild(loc.name)
	if old then old:Destroy() end
	local f = Instance.new("Folder")
	f.Name = loc.name
	f:SetAttribute("Origin", loc.origin)
	f.Parent = root
	local g = loc.ground or Vector3.new(120, 1, 120)
	box(f, "ground", g, CFrame.new(loc.origin + Vector3.new(0, -g.Y / 2, 0)), Color3.fromRGB(120, 150, 110))
	for _, b in ipairs(loc.boxes or {}) do
		box(f, b.name, b.size, CFrame.new(loc.origin + b.pos) * CFrame.Angles(0, math.rad(b.yaw or 0), 0), b.color)
	end
	if loc.sign then
		-- the rule sign: big, plain, readable at phone size (white board, dark bold text, faces -Z: put a spot in front)
		local s = box(f, "rule_sign", loc.sign.size, CFrame.new(loc.origin + loc.sign.pos) * CFrame.Angles(0, math.rad(loc.sign.yaw or 0), 0), Color3.fromRGB(250, 248, 240))
		local gui = Instance.new("SurfaceGui")
		gui.Face = Enum.NormalId.Front
		gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
		gui.PixelsPerStud = 40
		gui.Parent = s
		local t = Instance.new("TextLabel")
		t.Size = UDim2.fromScale(1, 1)
		t.BackgroundTransparency = 1
		t.Font = Enum.Font.FredokaOne
		t.TextScaled = true
		t.TextColor3 = Color3.fromRGB(30, 30, 40)
		t.Text = loc.sign.text
		t.Parent = gui
	end
	table.insert(made, loc.name)
end
return { ok = true, locations = made }
