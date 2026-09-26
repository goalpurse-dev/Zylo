// Image Generator price quotes: the job shape (tool_key + width×height) for
// every model / size / resolution the UI can pick, so the button shows the
// server's price (compute_tool_price) for exactly the job it will create.
import { MODELS } from "./modelsConfig";
import { UI_MODEL_TO_TOOLKEY, type UiModelKey } from "./modelMapper";
import { IMAGE_SIZES } from "./sizes";
import { NANO_RESOLUTIONS } from "./nanoResolutions";

type PriceItem = { id: string; tool_key: string; input: { width: number; height: number } };

/** Width/height the job is created with — mirrors Generate.jsx + generateImageFromUI. */
export function imageJobSize(modelKey: UiModelKey, size: string, resolution?: string) {
  const model: any = MODELS[modelKey];
  const nano = model?.supportsResolutions
    ? (NANO_RESOLUTIONS as any)[size]?.[resolution ?? ""]
    : null;
  if (nano) return { width: nano.width, height: nano.height };
  const fallback = IMAGE_SIZES[size] ?? IMAGE_SIZES["1:1"];
  return { width: fallback.width, height: fallback.height };
}

export function imagePriceItem(modelKey: UiModelKey, size: string, resolution?: string, id?: string): PriceItem {
  const model: any = MODELS[modelKey];
  const res = model?.supportsResolutions ? resolution : undefined;
  return {
    id: id ?? `${modelKey}|${size}|${res ?? "-"}`,
    tool_key: UI_MODEL_TO_TOOLKEY[modelKey],
    input: imageJobSize(modelKey, size, res),
  };
}

/** Every model × size (× resolution) option, so switching options is instant. */
export const IMAGE_PRICE_GRID: PriceItem[] = (Object.keys(MODELS) as UiModelKey[]).flatMap((modelKey) => {
  const model: any = MODELS[modelKey];
  const resolutions: (string | undefined)[] = model.supportsResolutions
    ? model.resolutions.map((r: { key: string }) => r.key)
    : [undefined];
  return (model.supportedSizes as string[]).flatMap((size) =>
    resolutions.map((res) => imagePriceItem(modelKey, size, res)),
  );
});
