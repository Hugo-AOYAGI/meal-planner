import type { FileUIPart } from "ai";

const MAX_SIDE = 1568;

/** Downsizes an image (longest side 1568 px) and re-encodes it as a JPEG data URL file part. */
export async function toImagePart(file: File): Promise<FileUIPart> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // JPEG has no alpha
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return {
    type: "file",
    mediaType: "image/jpeg",
    filename: `${file.name.replace(/\.[^.]+$/, "") || "photo"}.jpg`,
    url: canvas.toDataURL("image/jpeg", 0.85),
  };
}
