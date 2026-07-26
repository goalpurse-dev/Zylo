function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  return new Uint8Array([value & 255, (value >>> 8) & 255]);
}

function u32(value) {
  return new Uint8Array([value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]);
}

function concat(parts) {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  parts.forEach((part) => { out.set(part, offset); offset += part.length; });
  return out;
}

export function displayImageUrl(url, width = 720) {
  if (typeof url !== "string" || !url.includes("/storage/v1/object/public/")) return url;
  try {
    const transformed = new URL(url);
    transformed.pathname = transformed.pathname.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/",
    );
    transformed.searchParams.set("width", String(width));
    transformed.searchParams.set("quality", "82");
    transformed.searchParams.set("resize", "contain");
    return transformed.toString();
  } catch {
    return url;
  }
}

export async function downloadFile(url, filename) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Download failed");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

// Tiny standards-compliant ZIP writer using the uncompressed STORE method.
// It avoids another runtime dependency and works with JPEG, PNG, and WebP.
export async function downloadImagesAsZip(scenes, label = "2am-slideshow") {
  const encoder = new TextEncoder();
  const files = await Promise.all(scenes.filter((scene) => scene.imageUrl).map(async (scene, index) => {
    const response = await fetch(scene.imageUrl);
    if (!response.ok) throw new Error(`Could not download scene ${index + 1}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    return { name: encoder.encode(`scene-${String(index + 1).padStart(2, "0")}.${ext}`), bytes, crc: crc32(bytes) };
  }));
  if (!files.length) throw new Error("No completed images to download");

  const localParts = [];
  const centralParts = [];
  let offset = 0;
  files.forEach((file) => {
    const local = concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(file.crc), u32(file.bytes.length), u32(file.bytes.length), u16(file.name.length), u16(0), file.name, file.bytes]);
    const central = concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(file.crc), u32(file.bytes.length), u32(file.bytes.length), u16(file.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), file.name]);
    localParts.push(local);
    centralParts.push(central);
    offset += local.length;
  });
  const central = concat(centralParts);
  const end = concat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(offset), u16(0)]);
  const zip = new Blob([concat([...localParts, central, end])], { type: "application/zip" });
  const url = URL.createObjectURL(zip);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${label.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "2am-slideshow"}.zip`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
