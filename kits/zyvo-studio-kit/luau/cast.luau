-- Zyvo Studio Kit: THE CAST (run with execute_luau in Edit, after installing luau/cast_lib.luau as
-- game.ServerStorage.ZyvoCastLib). Fill CAST from the script's style sheet: one entry per character AND per look /
-- place (a character seen in 3 places is 3 statues, e.g. "Mo_street", "Mo_class"; a look change is a new statue that
-- a show/hide action swaps in). Never the default classic look. No name tags, no health bars.
-- Field list: see L.make in luau/cast_lib.luau. Keep the group names the shot list's show/hide actions use.
local V, C = Vector3.new, Color3.fromRGB
local CAST = {
	-- group = { characters }
	-- st_hero = {
	--   { name = "Mo_street", at = V(0, 0, 5), look = V(0, 0, -10), skin = C(255, 204, 153), shirt = C(255, 210, 0),
	--     trousers = C(30, 30, 30), shoes = C(250, 250, 250), hair = { style = "spiky", color = C(60, 40, 30) },
	--     face = "smile", pose = "stand", life = "wave" },
	-- },
}
local CAMERA = nil -- a point the rule objects face (e.g. the main camera spot's position), or nil

local function req(name) local m = game.ServerStorage[name]:Clone(); m.Parent = game.ServerStorage; local r = require(m); m:Destroy(); return r end
local L = req("ZyvoCastLib")
local story = workspace:FindFirstChild("ZyvoStory") or Instance.new("Folder")
story.Name = "ZyvoStory"; story.Parent = workspace
local castFolder = story:FindFirstChild("Cast") or Instance.new("Folder")
castFolder.Name = "Cast"; castFolder.Parent = story

local made, problems = {}, {}
local groups = {}
for g in pairs(CAST) do table.insert(groups, g) end
table.sort(groups)
for _, g in ipairs(groups) do
	local folder = L.group(g, castFolder)
	for _, c in ipairs(CAST[g]) do
		c.cam = c.cam or CAMERA
		local ok, m = pcall(L.make, c, folder)
		if ok then table.insert(made, g .. "/" .. c.name) else table.insert(problems, c.name .. ": " .. tostring(m)) end
	end
end
return { ok = #problems == 0, made = made, problems = problems }
