// Manual pixel manipulation filters for Safari compatibility
// (CanvasRenderingContext2D.filter is NOT supported in Safari)

export function applyFiltersToCanvas(canvas, filterString) {
  if (!filterString || filterString === 'none') return canvas;

  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Parse filter string into operations
  const ops = parseFilterString(filterString);

  for (const op of ops) {
    switch (op.name) {
      case 'invert':
        applyInvert(data, op.value / 100);
        break;
      case 'hue-rotate':
        applyHueRotate(data, op.value);
        break;
      case 'brightness':
        applyBrightness(data, op.value / 100);
        break;
      case 'contrast':
        applyContrast(data, op.value / 100);
        break;
      case 'saturate':
        applySaturate(data, op.value / 100);
        break;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function parseFilterString(filterStr) {
  const regex = /(invert|hue-rotate|brightness|contrast|saturate)\(([^)]+)\)/g;
  const ops = [];
  let match;
  while ((match = regex.exec(filterStr)) !== null) {
    let value = match[2].trim();
    if (value.endsWith('deg')) {
      value = parseFloat(value);
    } else if (value.endsWith('%')) {
      value = parseFloat(value);
    } else {
      value = parseFloat(value) * 100; // treat raw number as percentage
    }
    ops.push({ name: match[1], value });
  }
  return ops;
}

function applyInvert(data, amount) {
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = Math.round(data[i]     + (255 - 2 * data[i])     * amount); // R
    data[i + 1] = Math.round(data[i + 1] + (255 - 2 * data[i + 1]) * amount); // G
    data[i + 2] = Math.round(data[i + 2] + (255 - 2 * data[i + 2]) * amount); // B
  }
}

function applyBrightness(data, factor) {
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = clamp(data[i]     * factor);
    data[i + 1] = clamp(data[i + 1] * factor);
    data[i + 2] = clamp(data[i + 2] * factor);
  }
}

function applyContrast(data, factor) {
  const intercept = 128 * (1 - factor);
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = clamp(data[i]     * factor + intercept);
    data[i + 1] = clamp(data[i + 1] * factor + intercept);
    data[i + 2] = clamp(data[i + 2] * factor + intercept);
  }
}

function applySaturate(data, factor) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    // Luminance-preserving desaturation weights
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    data[i]     = clamp(gray + factor * (r - gray));
    data[i + 1] = clamp(gray + factor * (g - gray));
    data[i + 2] = clamp(gray + factor * (b - gray));
  }
}

function applyHueRotate(data, degrees) {
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  // Hue rotation matrix (luminance-preserving)
  const m00 = 0.213 + cos * 0.787 - sin * 0.213;
  const m01 = 0.715 - cos * 0.715 - sin * 0.715;
  const m02 = 0.072 - cos * 0.072 + sin * 0.928;
  const m10 = 0.213 - cos * 0.213 + sin * 0.143;
  const m11 = 0.715 + cos * 0.285 + sin * 0.140;
  const m12 = 0.072 - cos * 0.072 - sin * 0.283;
  const m20 = 0.213 - cos * 0.213 - sin * 0.787;
  const m21 = 0.715 - cos * 0.715 + sin * 0.715;
  const m22 = 0.072 + cos * 0.928 + sin * 0.072;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    data[i]     = clamp(r * m00 + g * m01 + b * m02);
    data[i + 1] = clamp(r * m10 + g * m11 + b * m12);
    data[i + 2] = clamp(r * m20 + g * m21 + b * m22);
  }
}

function clamp(val) {
  return Math.max(0, Math.min(255, Math.round(val)));
}
