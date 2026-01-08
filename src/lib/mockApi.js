export async function generateThumbnail({ prompt, maskDataURL, bgDataURL, styleId, focus, strength, variations }) {
  await new Promise((res) =>
    setTimeout(res, 1200 + Math.random() * 800)
  );
  // Return array of mock candidates
  return Array.from({ length: variations || 2 }).map((_, i) => ({
    id: `mock-${i + 1}`,
    src: `https://images.unsplash.com/photo-15${Math.floor(
      1000000000000 + Math.random() * 10000000000
    )}?auto=format&fit=crop&w=640&q=80`,
    meta: { upscaled: false },
  }));
}

export async function upscale(id) {
  await new Promise((res) => setTimeout(res, 900));
  return { id, upscaled: true };
}

export async function savePreset(preset) {
  localStorage.setItem("thumb_preset", JSON.stringify(preset));
  return true;
}