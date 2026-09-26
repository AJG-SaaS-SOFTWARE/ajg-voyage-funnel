type ImageFocus = {
  x: number;
  y: number;
  source: "face" | "saliency" | "fallback";
};

type FaceDetectorInstance = {
  detect: (input: ImageBitmap) => Promise<Array<{ boundingBox?: { x: number; y: number; width: number; height: number } }>>;
};

type FaceDetectorConstructor = new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorInstance;

const acceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

function validateImage(file: File) {
  if (!(acceptedTypes as readonly string[]).includes(file.type)) {
    throw new Error("Utilisez une image JPEG, PNG, WebP ou AVIF.");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("La photo ne doit pas dépasser 12 Mo.");
  }
}

function clampPosition(value: number, min = 12, max = 88) {
  return Math.round(Math.max(min, Math.min(max, value)));
}

async function detectFaceFocus(bitmap: ImageBitmap): Promise<ImageFocus | null> {
  const Detector = (globalThis as typeof globalThis & { FaceDetector?: FaceDetectorConstructor }).FaceDetector;
  if (!Detector) return null;

  try {
    const detector = new Detector({ fastMode: true, maxDetectedFaces: 6 });
    const faces = await detector.detect(bitmap);
    const face = faces
      .filter((item) => item.boundingBox)
      .sort((a, b) => {
        const first = a.boundingBox!;
        const second = b.boundingBox!;
        return (second.width * second.height) - (first.width * first.height);
      })[0];

    if (!face?.boundingBox) return null;

    const box = face.boundingBox;
    return {
      x: clampPosition(((box.x + box.width / 2) / bitmap.width) * 100),
      y: clampPosition(((box.y + box.height / 2) / bitmap.height) * 100, 12, 74),
      source: "face"
    };
  } catch {
    return null;
  }
}

function detectSaliencyFocus(bitmap: ImageBitmap): ImageFocus {
  const maxSide = 180;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(24, Math.round(bitmap.width * scale));
  const height = Math.max(24, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return {
      x: 50,
      y: bitmap.height > bitmap.width * 1.15 ? 38 : 48,
      source: "fallback"
    };
  }

  context.drawImage(bitmap, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  let scoreSum = 0;
  let weightedX = 0;
  let weightedY = 0;

  const luminanceAt = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    return pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
  };

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const index = (y * width + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max - min;
      const lum = luminanceAt(x, y);
      const edge = Math.abs(lum - luminanceAt(x + 1, y)) + Math.abs(lum - luminanceAt(x, y + 1));
      const nx = (x / width) - 0.5;
      const ny = (y / height) - 0.45;
      const distance = Math.min(1, Math.sqrt(nx * nx + ny * ny) * 1.55);
      const centerPrior = 1 - distance * 0.28;
      const score = (edge * 1.25 + saturation * 0.18) * centerPrior;

      if (score > 7) {
        scoreSum += score;
        weightedX += x * score;
        weightedY += y * score;
      }
    }
  }

  if (scoreSum < 1) {
    return {
      x: 50,
      y: bitmap.height > bitmap.width * 1.15 ? 38 : 48,
      source: "fallback"
    };
  }

  return {
    x: clampPosition((weightedX / scoreSum / width) * 100, 18, 82),
    y: clampPosition((weightedY / scoreSum / height) * 100, 16, 76),
    source: "saliency"
  };
}

async function getImageFocus(bitmap: ImageBitmap): Promise<ImageFocus> {
  return await detectFaceFocus(bitmap) || detectSaliencyFocus(bitmap);
}

function renderOptimizedImage(bitmap: ImageBitmap): Promise<Blob> {
  const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Impossible de préparer cette image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Impossible de compresser cette image."));
    }, "image/webp", 0.8);
  });
}

export async function optimizeImage(file: File): Promise<Blob> {
  validateImage(file);
  const bitmap = await createImageBitmap(file);
  try {
    return await renderOptimizedImage(bitmap);
  } finally {
    bitmap.close();
  }
}

export async function optimizeBackgroundImage(file: File): Promise<{ blob: Blob; focus: ImageFocus }> {
  validateImage(file);
  const bitmap = await createImageBitmap(file);
  try {
    const [blob, focus] = await Promise.all([
      renderOptimizedImage(bitmap),
      getImageFocus(bitmap)
    ]);
    return { blob, focus };
  } finally {
    bitmap.close();
  }
}
