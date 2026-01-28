import { IMAGE_STYLES } from "./styles";

export function buildFinalImagePrompt({
  userPrompt,
  style,
}: {
  userPrompt: string;
  style?: keyof typeof IMAGE_STYLES;
}) {
  const styleHint = style ? IMAGE_STYLES[style]?.promptHint : null;

  return [
    userPrompt,
    styleHint,
    "clean composition, sharp focus, high detail",
  ]
    .filter(Boolean)
    .join(", ");
}

