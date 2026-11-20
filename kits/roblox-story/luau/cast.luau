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
-- MONSTERS / VILLAINS (reference/story.md "The monster"): the REVEALED look of every monster, creature or villain the
-- script names, as its own statue per place (L.monster: a dark silhouette, a blank face, small glowing eyes, mist).
-- The normal look (if it has one) is an ordinary CAST statue; a hide + show pair swaps them at the reveal line, and
-- the monster statues go in the shot list's startHidden. Hint statues (far or half-hidden, before the reveal): add
-- extra = true. SHADOWS: a flat ground shadow of it (a hint, or the last shot of a chilling callback).
local MONSTERS = {
	-- { name = "hush_sq", at = V(0, 0, 8), look = V(0, 0, -30), form = "mist", hat = { style = "tophat", color = C(8, 8, 12) } },
	-- { name = "hush_hint_far", at = V(10, 0, 23), look = V(4, 0, -40), extra = true },
}
local SHADOWS = {
	-- { name = "hush_shadow_end", at = V(4, 0, 2), dir = V(-1, 0, 0.3), height = 7 },
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
if #MONSTERS > 0 or #SHADOWS > 0 then
	local folder = L.group("monsters", castFolder)
	for _, c in ipairs(MONSTERS) do
		local ok, m = pcall(L.monster, c, folder)
		if ok then table.insert(made, "monsters/" .. c.name) else table.insert(problems, c.name .. ": " .. tostring(m)) end
	end
	for _, s in ipairs(SHADOWS) do
		local ok, m = pcall(L.shadow, s.name, s.at, s.dir, s.height, folder)
		if ok then table.insert(made, "monsters/" .. s.name) else table.insert(problems, s.name .. ": " .. tostring(m)) end
	end
end
return { ok = #problems == 0, made = made, problems = problems }
