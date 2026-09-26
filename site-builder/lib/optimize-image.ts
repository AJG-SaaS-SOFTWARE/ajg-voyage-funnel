export async function optimizeImage(file: File): Promise<Blob> {
  if (!(["image/jpeg", "image/png", "image/webp", "image/avif"] as string[]).includes(file.type)) {
    throw new Error("Utilisez une image JPEG, PNG, WebP ou AVIF.");
  }
  if (file.size > 12 * 1024 * 1024) throw new Error("La photo ne doit pas dépasser 12 Mo.");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Impossible de préparer cette image.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.8));
    if (!blob) throw new Error("Impossible de compresser cette image.");
    return blob;
  } finally {
    bitmap.close();
  }
}
