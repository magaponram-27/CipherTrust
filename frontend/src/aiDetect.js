function clamp(value) {
  return Math.min(1, Math.max(0, value));
}

export async function detectDeepfake(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file to run the on-device check.');
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = imageUrl;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = 224;
    canvas.height = 224;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Image analysis is not available in this browser.');
    context.drawImage(image, 0, 0, 224, 224);
    const { data } = context.getImageData(0, 0, 224, 224);
    const luminance = new Float32Array(224 * 224);
    const bins = new Uint32Array(16);
    let sum = 0;
    let sumSquares = 0;
    for (let i = 0, pixel = 0; i < data.length; i += 4, pixel += 1) {
      const light = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      luminance[pixel] = light;
      sum += light;
      sumSquares += light * light;
      bins[Math.min(15, Math.floor(light / 16))] += 1;
    }
    const variance = Math.max(0, sumSquares / luminance.length - (sum / luminance.length) ** 2);
    let entropy = 0;
    for (const count of bins) {
      if (count) {
        const probability = count / luminance.length;
        entropy -= probability * Math.log2(probability);
      }
    }
    let edgeSum = 0;
    let edgeSquares = 0;
    let edgeCount = 0;
    for (let y = 1; y < 223; y += 1) {
      for (let x = 1; x < 223; x += 1) {
        const index = y * 224 + x;
        const edge = Math.abs(luminance[index + 1] - luminance[index - 1]) +
          Math.abs(luminance[index + 224] - luminance[index - 224]);
        edgeSum += edge;
        edgeSquares += edge * edge;
        edgeCount += 1;
      }
    }
    const edgeMean = edgeSum / edgeCount;
    const edgeVariance = Math.max(0, edgeSquares / edgeCount - edgeMean ** 2);
    const smoothness = 1 - clamp(Math.sqrt(variance) / 90);
    const colorUniformity = 1 - clamp(entropy / 4);
    const edgeInconsistency = 1 - clamp(Math.sqrt(edgeVariance) / 50);
    const fakeScore = clamp(0.4 * smoothness + 0.3 * colorUniformity + 0.3 * edgeInconsistency);
    const verdict = fakeScore > 0.65 ? 'AI-Generated' : fakeScore > 0.45 ? 'Suspicious' : 'Real';
    return {
      verdict,
      fakeScore,
      realScore: 1 - fakeScore,
      confidence: clamp(verdict === 'Suspicious'
        ? 1 - Math.abs(fakeScore - 0.55) / 0.1
        : Math.abs(fakeScore - 0.55) / 0.45)
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
