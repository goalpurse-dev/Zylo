export const REFERENCE_FIELD_NAMES = new Set([
  "referenceimage", "referenceimages", "refimage", "refimages", "initimageurl", "initimageurls",
  "imageurl", "imageurls", "firstframe", "lastframe", "startimage", "endimage", "frameimages",
  "initimage", "productcutouturl", "avatarurl", "inputimage", "refs",
]);

export async function normalizeReferencePayloadWith<T, R extends { url: string }>(
  value: T,
  upload: (input: File | Blob | string, index: number) => Promise<R>,
): Promise<{ value: T; uploads: R[] }> {
  const uploads: R[] = [];
  let index = 0;

  async function visit(node: any, key = "", insideReference = false): Promise<any> {
    const normalizedKey = key.replace(/[-_]/g, "").toLowerCase();
    const isReference = insideReference || REFERENCE_FIELD_NAMES.has(normalizedKey);
    if ((typeof node === "string" || node instanceof Blob) && isReference) {
      const uploaded = await upload(node, index++);
      uploads.push(uploaded);
      return uploaded.url;
    }
    if (Array.isArray(node)) return Promise.all(node.map((item) => visit(item, key, isReference)));
    if (node && typeof node === "object" && !(node instanceof Blob)) {
      const result: Record<string, any> = {};
      for (const [childKey, child] of Object.entries(node)) result[childKey] = await visit(child, childKey, isReference);
      return result;
    }
    return node;
  }

  return { value: await visit(value), uploads };
}
