-- Zyvo Studio Kit: CAMERA SPOTS and MARKS (run with execute_luau in Edit). A spot is an invisible part looking from
-- `pos` at `target`; its Lens and Dist attributes feed the director. A mark is a floor point where a character stands or
-- walks to. Re-running replaces spots / marks with the same name. Fill SPOTS and MARKS (world positions).
local SPOTS = {
	-- { name = "street_wide", pos = Vector3.new(0, 8, -40), target = Vector3.new(0, 6, 10), lens = 24 },
}
local MARKS = {
	-- { name = "street_mark_1", pos = Vector3.new(0, 0, 5) },
}

local story = workspace:FindFirstChild("ZyvoStory") or Instance.new("Folder")
story.Name = "ZyvoStory"
story.Parent = workspace
local function folder(name)
	local f = story:FindFirstChild(name) or Instance.new("Folder")
	f.Name = name
	f.Parent = story
	return f
end
local spots, marks = folder("Spots"), folder("Marks")

local function ghost(parent, name, cf, size)
	local old = parent:FindFirstChild(name)
	if old then old:Destroy() end
	local p = Instance.new("Part")
	p.Name, p.Size, p.CFrame = name, size, cf
	p.Anchored, p.CanCollide, p.CanQuery, p.CanTouch = true, false, false, false
	p.Transparency = 1
	p.Parent = parent
	return p
end

for _, s in ipairs(SPOTS) do
	local p = ghost(spots, s.name, CFrame.lookAt(s.pos, s.target), Vector3.new(1, 1, 1))
	p:SetAttribute("Lens", s.lens or 35)
	p:SetAttribute("Dist", (s.target - s.pos).Magnitude)
	p:SetAttribute("Target", s.target)
end
for _, m in ipairs(MARKS) do
	ghost(marks, m.name, CFrame.new(m.pos), Vector3.new(2, 0.2, 2))
end
return { ok = true, spots = #spots:GetChildren(), marks = #marks:GetChildren() }
