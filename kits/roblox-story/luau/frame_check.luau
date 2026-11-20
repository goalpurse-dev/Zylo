-- Zyvo Studio Kit: THE FRAMING CHECK (run with execute_luau in Edit, after installing luau/framer.luau as
-- game.ServerStorage.ZyvoFramer and the shot list as ReplicatedStorage.ZyvoShots).
-- MODE "check": checks shots FROM..TO (every problem of reference/recording.md step 4) and lists the failures.
-- MODE "solve": re-places the camera spots FROM..TO of PLAN (sorted by name) around their subjects; it MOVES those
--   spot parts (Edit only, nothing is saved). Close and medium spots only; wide spots are placed by hand and checked.
-- Run it in batches (about 20 shots or 8 spots a call): a long call times out ("Target is not reachable").
-- PLAN: one entry per camera spot that frames characters (from shots.json: the shot's subject(s) and size).
--   subjects: the characters (statue names) the shot is about; foreground: characters allowed in front of them
--   (an over-the-shoulder); optional lens (mm), pitch (degrees down), dir (Vector3: the camera looks along it),
--   minDist (studs); glide = true for a spot used with spotEnd (solved as a still shot).
local MODE, FROM, TO = "check", 1, 20
local V = Vector3.new
local PLAN = {
	-- street_mo_close = { size = "close", subjects = { "Mo_street" } },
	-- class_two_shot = { size = "medium", subjects = { "Mo_class", "Pell_class" }, pitch = 12 },
}

local function req(name) local m = game.ServerStorage[name]:Clone(); m.Parent = game.ServerStorage; local r = require(m); m:Destroy(); return r end
local F = req("ZyvoFramer")
local data = F.load(); F.buildEvents(); F.buildGrid(); F.buildChars()
local out, failed = {}, 0

if MODE == "check" then
	for k = FROM, math.min(TO, #data.shots) do
		local shot = data.shots[k]
		local cfg = PLAN[shot.spot] or { subjects = {} }
		local probs = F.check(shot, { subjects = cfg.subjects, foreground = cfg.foreground, upperThird = #(cfg.subjects or {}) > 0 })
		if #probs == 0 then
			local cv = F.cover(shot, { subjects = cfg.subjects, foreground = cfg.foreground })
			if cv then table.insert(probs, cv) end
			if #probs == 0 then local lf = F.lowerFill(shot); if lf then table.insert(probs, lf) end end
		end
		if #probs > 0 then failed += 1; table.insert(out, string.format("#%d %s: %s", shot.id or k, shot.spot, probs[1])) end
		task.wait()
	end
	return string.format("shots %d-%d of %d: %d fail%s", FROM, math.min(TO, #data.shots), #data.shots, failed,
		#out > 0 and ("\n" .. table.concat(out, "\n")) or "")
end

-- MODE "solve"
local bySpot = {}
for _, s in ipairs(data.shots) do bySpot[s.spot] = bySpot[s.spot] or {}; table.insert(bySpot[s.spot], s) end
local TIGHT = { push_slow = 0.85, push_fast = 0.7, crash = 0.625 }
local names = {}
for k, c in pairs(PLAN) do if bySpot[k] and (c.size == "close" or c.size == "medium") then table.insert(names, k) end end
table.sort(names)
for i = FROM, math.min(TO, #names) do
	local spot = names[i]
	local cfg, shots = PLAN[spot], bySpot[spot]
	-- solve for the tightest move that uses this spot: if that one frames well, the others do too
	table.sort(shots, function(a, b) return (TIGHT[a.move] or 1) < (TIGHT[b.move] or 1) end)
	local s1 = shots[1]
	if cfg.glide then s1 = table.clone(s1); s1.spotEnd = nil; s1.move = "static"; s1.t1 = s1.t0 + 0.3 end
	local sol, probs = F.solveWide(s1, cfg)
	if not sol then failed += 1 end
	table.insert(out, string.format("%d %s: %s", i, spot, sol and string.format("ok d%.1f L%d yaw %d pitch %d", sol.dist, sol.lens, sol.yaw, sol.pitch)
		or ("FAILED " .. tostring(probs and probs[1]) .. " (move the spot by hand, change the lens/size, or the subjects)")))
	task.wait()
end
return string.format("%d spots to solve; %d-%d done, %d failed\n%s", #names, FROM, math.min(TO, #names), failed, table.concat(out, "\n"))
