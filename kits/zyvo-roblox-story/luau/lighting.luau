-- Zyvo Studio Kit: THE LOOK (run with execute_luau in Edit). A warm, low afternoon sun with long hard shadows, a
-- saturated sky, readable faces. Every setting is in a pcall: a property Studio won't let code set is skipped and named.
local Lighting = game:GetService("Lighting")
local skipped = {}
local function set(obj, prop, value)
	local ok = pcall(function() obj[prop] = value end)
	if not ok then table.insert(skipped, obj.Name .. "." .. prop) end
end

set(Lighting, "Technology", Enum.Technology.Future) -- sharp shadows (may need setting by hand in Properties)
set(Lighting, "ClockTime", 16.9)                     -- low sun: long shadows
set(Lighting, "GeographicLatitude", 35)
set(Lighting, "Brightness", 3.2)
set(Lighting, "ShadowSoftness", 0.08)                -- hard shadows
set(Lighting, "Ambient", Color3.fromRGB(70, 62, 58))
set(Lighting, "OutdoorAmbient", Color3.fromRGB(128, 118, 112)) -- lifts faces in shadow
set(Lighting, "EnvironmentDiffuseScale", 0.5)
set(Lighting, "EnvironmentSpecularScale", 0.4)
set(Lighting, "ColorShift_Top", Color3.fromRGB(255, 214, 160)) -- warm sun light
set(Lighting, "ExposureCompensation", 0.15)

local function effect(class, name)
	local e = Lighting:FindFirstChild(name) or Instance.new(class)
	e.Name = name
	e.Parent = Lighting
	return e
end
local atm = effect("Atmosphere", "ZyvoAtmosphere")
set(atm, "Density", 0.22)
set(atm, "Haze", 0.6)
set(atm, "Color", Color3.fromRGB(205, 225, 255))
set(atm, "Decay", Color3.fromRGB(255, 200, 150))
local cc = effect("ColorCorrectionEffect", "ZyvoColor")
set(cc, "Saturation", 0.18)
set(cc, "Contrast", 0.08)
set(cc, "TintColor", Color3.fromRGB(255, 246, 236))
local bloom = effect("BloomEffect", "ZyvoBloom")
set(bloom, "Intensity", 0.25)
set(bloom, "Size", 24)
set(bloom, "Threshold", 1.6)
local dof = effect("DepthOfFieldEffect", "ZyvoFocus") -- off until a rack-focus shot turns it on
set(dof, "Enabled", false)

return { ok = true, skipped = skipped }
