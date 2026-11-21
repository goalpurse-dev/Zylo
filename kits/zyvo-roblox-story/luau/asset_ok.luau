-- Zyvo Studio Kit: is this Creator Store asset OK to insert? (run with execute_luau in Edit; read-only)
-- Fill ASSET_ID. Returns a table: { ok = true/false, why = "...", name, creator, assetType }.
local ASSET_ID = 0 -- the asset id from search_asset

local MarketplaceService = game:GetService("MarketplaceService")
local okCall, info = pcall(function()
	return MarketplaceService:GetProductInfo(ASSET_ID, Enum.InfoType.Asset)
end)
if not okCall or type(info) ~= "table" then
	return { ok = false, why = "could not read the asset's info: " .. tostring(info) }
end
local out = {
	name = info.Name,
	creator = info.Creator and info.Creator.Name or "?",
	assetType = info.AssetTypeId,
}
-- AssetTypeId 10 = Model, 40 = MeshPart (both fine to insert as scenery)
if info.AssetTypeId ~= 10 and info.AssetTypeId ~= 40 then
	out.ok, out.why = false, "not a model or a mesh (type " .. tostring(info.AssetTypeId) .. ")"
	return out
end
local price = tonumber(info.PriceInRobux) or 0
if price > 0 then
	out.ok, out.why = false, "costs " .. price .. " Robux: free assets only"
	return out
end
if info.IsPublicDomain == false and info.IsForSale == false and price == 0 then
	-- not shared to the Creator Store (private / off sale): can't be used freely
	out.ok, out.why = false, "not a free Creator Store asset"
	return out
end
out.ok, out.why = true, "free"
return out
