const GENERATOR_MARKERS = [
  'stable diffusion',
  'midjourney',
  'dall-e',
  'dall·e',
  'adobe firefly',
  'comfyui',
  'novelai',
  'leonardo.ai',
  'openai'
];

export async function inspectGeneratorMetadata(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file to run the on-device check.');
  const metadataBytes = await file.slice(0, 1024 * 1024).arrayBuffer();
  const metadata = new TextDecoder('latin1').decode(metadataBytes).toLowerCase();
  const markers = GENERATOR_MARKERS.filter((marker) => metadata.includes(marker));

  return {
    verdict: markers.length ? 'AI generator metadata found' : 'No known AI generator metadata found',
    markers
  };
}
