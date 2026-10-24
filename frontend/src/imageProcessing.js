const maxTransferBytes = 6 * 1024 * 1024;
const maxSourceBytes = 20 * 1024 * 1024;
const maxImageDimension = 1920;
const heifTypes = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);
const supportedImageTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/bmp',
  'image/tiff',
  ...heifTypes
]);

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('This browser could not read the photo. On iPhone, switch Camera format to Most Compatible (JPEG) and try again.'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not prepare this image for sending.'));
    }, type, quality);
  });
}

export async function prepareImageForSending(file) {
  const type = file.type.toLowerCase();
  if (!supportedImageTypes.has(type)) {
    throw new Error('Choose a JPEG, PNG, WebP, GIF, AVIF, BMP, TIFF, HEIC, or HEIF image.');
  }
  if (file.size > maxSourceBytes) {
    throw new Error('This image is too large to prepare safely on this device (maximum 20 MB). Choose a smaller image.');
  }
  if (file.size <= maxTransferBytes && type === 'image/gif') return file;
  if (type === 'image/gif') {
    throw new Error('This GIF is larger than 6 MB. Choose a smaller GIF to preserve its animation.');
  }

  let image;
  try {
    if (typeof createImageBitmap === 'function') {
      try {
        image = await createImageBitmap(file);
      } catch {
        image = await loadImage(file);
      }
    } else {
      image = await loadImage(file);
    }
    const width = image.width || image.naturalWidth;
    const height = image.height || image.naturalHeight;
    if (!width || !height) throw new Error('The selected image has no readable dimensions.');

    const scale = Math.min(1, maxImageDimension / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const outputType = type === 'image/png' ? 'image/png' : 'image/jpeg';
    const context = canvas.getContext('2d', { alpha: outputType !== 'image/jpeg' });
    if (!context) throw new Error('This browser could not prepare the image canvas.');
    if (outputType === 'image/jpeg') {
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const quality = outputType === 'image/jpeg' || outputType === 'image/webp' ? 0.84 : undefined;
    let prepared = await canvasToBlob(canvas, outputType, quality);
    if (type === 'image/png' && prepared.size > maxTransferBytes) {
      const webp = await canvasToBlob(canvas, 'image/webp', 0.82);
      if (webp.type === 'image/webp' && webp.size < prepared.size) prepared = webp;
    }
    if (prepared.size > maxTransferBytes) {
      throw new Error('The prepared image is still larger than 6 MB. Choose a smaller image or lower its resolution.');
    }

    const extension = prepared.type === 'image/jpeg' ? 'jpg' : prepared.type.split('/')[1];
    const name = (file.name || 'image').replace(/\.[^.]*$/, '');
    return new File([prepared], `${name}.${extension}`, {
      type: prepared.type,
      lastModified: Date.now()
    });
  } finally {
    if (image && typeof image.close === 'function') image.close();
  }
}
