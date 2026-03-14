export async function convertToWebP(blob, quality = 0.82) {
  const bitmap = await createImageBitmap(blob);

  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);

  return await new Promise((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });
}