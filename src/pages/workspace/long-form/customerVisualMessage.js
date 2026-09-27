// Diagnostic payloads remain internal even when an upstream error contains a model ID.
export function customerVisualMessage(value) {
  const text = String(value ?? "");
  return /kling|qwen|flux|seedream|runware|openai|gpt[- _]?\d|(?:image|runware|klingai|bytedance):/i.test(text)
    ? "This visual needs another try. Please retry or review its plan."
    : text;
}
