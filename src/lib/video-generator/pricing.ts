// Video Generator price quotes: the priced job shape (videoJobShape) for every
// option the UI can pick, so the button shows the server's price
// (compute_tool_price) for exactly the job it will create.
import { MODELS } from "./modelsConfig";
import { videoJobShape, type VideoJobParams } from "./generator";

type PriceItem = {
  id: string;
  tool_key: string;
  input: { durationSec: number; withSound: boolean; width?: number; height?: number; resolution?: string };
};

export function videoPriceItem(params: VideoJobParams, id?: string): PriceItem {
  const { toolKey, ...input } = videoJobShape(params);
  return {
    id: id ?? `${params.modelKey}|${params.size}|${params.duration}|${params.resolution}|${params.withSound ? "sound" : "silent"}`,
    tool_key: toolKey,
    input,
  };
}

/** Every size × duration × resolution × sound option of the given models. */
export function videoPriceGrid(modelKeys: (keyof typeof MODELS)[]): PriceItem[] {
  return modelKeys.flatMap((modelKey) => {
    const model: any = MODELS[modelKey];
    if (!model) return [];
    const durations: string[] = model.durationSlider
      ? Array.from({ length: model.maxDuration - model.minDuration + 1 }, (_, i) => String(model.minDuration + i))
      : model.supportedDurations;
    const sounds = model.hasSound ? [false, true] : [false];
    return (model.supportedSizes as string[]).flatMap((size) =>
      durations.flatMap((duration) =>
        (model.supportedResolutions as string[]).flatMap((resolution) =>
          sounds.map((withSound) => videoPriceItem({ modelKey, size, duration, resolution, withSound })),
        ),
      ),
    );
  });
}
