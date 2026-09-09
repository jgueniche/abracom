/**
 * Client-side photo compression before upload (brief §7.3: "compression client"). Runs in the
 * browser only; the server still normalises every image (ADR-0019), this only saves bandwidth.
 */
export const CLIENT_MAX_EDGE = 1600;
export const CLIENT_QUALITY = 0.82;

export async function compressImage(
  file: File,
  options: { maxEdge?: number; quality?: number } = {},
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;
  const maxEdge = options.maxEdge ?? CLIENT_MAX_EDGE;
  const quality = options.quality ?? CLIENT_QUALITY;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 600_000) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** Replaces the files of an `<input type="file">` with their compressed versions. */
export async function compressFileInput(input: HTMLInputElement): Promise<number> {
  if (!input.files || input.files.length === 0 || typeof DataTransfer === "undefined") return 0;
  const originals = Array.from(input.files);
  const compressed = await Promise.all(originals.map((file) => compressImage(file)));
  const transfer = new DataTransfer();
  for (const file of compressed) transfer.items.add(file);
  input.files = transfer.files;
  return (
    originals.reduce((sum, f) => sum + f.size, 0) - compressed.reduce((sum, f) => sum + f.size, 0)
  );
}
