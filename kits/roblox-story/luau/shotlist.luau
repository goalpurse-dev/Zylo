-- Zyvo Studio Kit: put the shot list in the place (run with execute_luau in Edit). Fill SHOTS from shots.json (same
-- fields, as a Luau table). It becomes ReplicatedStorage.ZyvoShots (a ModuleScript the camera and the actions read).
-- Write an action's key as ["do"] (a reserved word): { who = "Mo", at = 0.2, ["do"] = "walk", to = "street_mark_2" }.
-- The end card (Free / Starter plans, reference/shots.md): the LAST shot is { kind = "endcard", spot = "endcard", ... }
-- lasting 2.0 s, right after the story's last shot.
local SHOTS = {
	leadIn = 3,
	roll = 90, -- the camera roll of the Play run (reference/recording.md); 0 = no roll
	startHidden = {}, -- names under workspace.ZyvoStory that start hidden (a rule object that appears later)
	shots = {
		-- { id = 1, t0 = 0, t1 = 1.6, spot = "street_sign", lens = 24, move = "push_slow", actions = {} },
	},
}

-- Luau's reserved words can't be bare table keys: an action's `do = "show"` would stop the module from loading, so
-- those keys are written as ["do"] = ... (the camera, actions and framer read a["do"])
local RESERVED = {}
for w in ("and break do else elseif end false for function if in local nil not or repeat return then true until while"):gmatch("%a+") do RESERVED[w] = true end

local function lit(v, indent)
	local t = type(v)
	if t == "number" then return string.format("%.7g", v) end -- seconds keep their hundredths (123.45)
	if t == "boolean" then return tostring(v) end
	if t == "string" then return string.format("%q", v) end
	if typeof(v) == "Vector3" then return string.format("Vector3.new(%.7g, %.7g, %.7g)", v.X, v.Y, v.Z) end
	if t ~= "table" then error("can't write a " .. typeof(v)) end
	local pad, out = string.rep("\t", indent + 1), {}
	if #v > 0 then
		for _, x in ipairs(v) do table.insert(out, pad .. lit(x, indent + 1)) end
	else
		local keys = {}
		for k in pairs(v) do table.insert(keys, k) end
		table.sort(keys)
		for _, k in ipairs(keys) do
			local key = (type(k) == "string" and k:match("^[%a_][%w_]*$") and not RESERVED[k]) and k or ("[" .. lit(k, 0) .. "]")
			table.insert(out, pad .. key .. " = " .. lit(v[k], indent + 1))
		end
	end
	if #out == 0 then return "{}" end
	return "{\n" .. table.concat(out, ",\n") .. "\n" .. string.rep("\t", indent) .. "}"
end

-- the checks the camera relies on: times touch and grow, every spot exists
local spots = workspace:FindFirstChild("ZyvoStory") and workspace.ZyvoStory:FindFirstChild("Spots")
local problems = {}
for i, s in ipairs(SHOTS.shots) do
	if s.t1 <= s.t0 then table.insert(problems, "shot " .. s.id .. ": t1 <= t0") end
	local prev = SHOTS.shots[i - 1]
	if prev and math.abs(prev.t1 - s.t0) > 0.01 then table.insert(problems, "shot " .. s.id .. ": starts at " .. s.t0 .. ", the last one ends at " .. prev.t1) end
	if not (spots and spots:FindFirstChild(s.spot or "")) then table.insert(problems, "shot " .. s.id .. ": no spot " .. tostring(s.spot)) end
	if s.spotEnd and not (spots and spots:FindFirstChild(s.spotEnd)) then table.insert(problems, "shot " .. s.id .. ": no spot " .. s.spotEnd) end
end

local m = game.ReplicatedStorage:FindFirstChild("ZyvoShots") or Instance.new("ModuleScript")
m.Name = "ZyvoShots"
local ok, err = pcall(function() m.Source = "-- written by the Zyvo Studio Kit\nreturn " .. lit(SHOTS, 0) .. "\n" end)
if not ok then return { ok = false, why = "can't set the module's Source here: " .. tostring(err) .. " (use multi_edit with the same text)" } end
m.Parent = game.ReplicatedStorage
local last = SHOTS.shots[#SHOTS.shots]
return { ok = #problems == 0, shots = #SHOTS.shots, runtime = last and last.t1 or 0, problems = problems }
