const restrictedTextPatterns = [
  {
    category: 'adult sexual content',
    patterns: [
      /\b(?:porn(?:ography)?|xxx|hentai)\b/i,
      /\b(?:nudes?|naked\s+(?:pics?|photos?|images?)|explicit\s+(?:pics?|photos?|images?|content))\b/i,
      /\b(?:send|share|show|want)\s+(?:me\s+)?(?:nudes?|naked\s+(?:pics?|photos?|images?)|explicit\s+(?:pics?|photos?|images?))\b/i,
      /\bsex\s+chat\b/i,
      /\b(?:rape|sexual\s+assault)\s+(?:fantasy|roleplay|instructions?)\b/i
    ]
  },
  {
    category: 'self-harm instructions or encouragement',
    patterns: [
      /\b(?:how\s+to|ways?\s+to|instructions?\s+(?:for|to))\s+(?:commit\s+)?suicide\b/i,
      /\b(?:how\s+to|ways?\s+to)\s+(?:cut|hurt|harm)\s+(?:myself|yourself|themselves)\b/i,
      /\b(?:kill|end)\s+yourself\b/i,
      /\b(?:you\s+should|go)\s+(?:kill|hurt|harm)\s+yourself\b/i
    ]
  },
  {
    category: 'violent threats or instructions',
    patterns: [
      /\b(?:i(?:'m| am) going to|i will|gonna)\s+(?:kill|shoot|stab|bomb|poison)\s+(?:you|him|her|them)\b/i,
      /\b(?:how\s+to|instructions?\s+(?:for|to)|steps?\s+to)\s+(?:make|build)\s+(?:a\s+)?(?:bomb|weapon|poison)\b/i,
      /\b(?:kill|murder|shoot|stab)\s+(?:all|every)\s+(?:people|members)\s+of\b/i,
      /\b(?:graphic|violent)\s+(?:gore|execution)\s+(?:videos?|images?)\b/i
    ]
  },
  {
    category: 'harassment or coercion',
    patterns: [
      /\b(?:i will|i'm going to)\s+(?:dox|blackmail|swat|stalk)\s+(?:you|them|him|her)\b/i,
      /\b(?:send|post|publish)\s+(?:your|their)\s+(?:home\s+)?address\s+without\s+(?:their\s+)?permission\b/i,
      /\b(?:threaten|blackmail)\s+(?:them|him|her|you)\b/i
    ]
  },
  {
    category: 'hateful or dehumanizing abuse',
    patterns: [
      /\b(?:all|every)\s+(?:[a-z]+\s+){0,2}(?:people|members)\s+(?:are|should\s+be)\s+(?:subhuman|exterminated|killed)\b/i,
      /\b(?:kill|wipe\s+out|exterminate)\s+(?:all\s+)?(?:[a-z]+\s+){0,2}(?:people|members)\s+because\s+of\s+their\s+(?:race|religion|ethnicity|gender)\b/i
    ]
  }
];

let adultImageModelPromise;

export function inspectTextSafety(text) {
  for (const rule of restrictedTextPatterns) {
    if (rule.patterns.some((pattern) => pattern.test(text))) return rule.category;
  }
  return null;
}

async function loadAdultImageModel() {
  if (!adultImageModelPromise) {
    adultImageModelPromise = (async () => {
      const [tensorflow, nsfwjs, modelDefinition] = await Promise.all([
        import('@tensorflow/tfjs'),
        import('nsfwjs/core'),
        import('nsfwjs/models/mobilenet_v2')
      ]);
      tensorflow.enableProdMode();
      await tensorflow.ready();
      return nsfwjs.load('MobileNetV2', { modelDefinitions: [modelDefinition.MobileNetV2Model] });
    })().catch((error) => {
      adultImageModelPromise = null;
      throw error;
    });
  }
  return adultImageModelPromise;
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The image could not be decoded for a safety check.'));
    image.src = source;
  });
}

export async function inspectImageSafety(fileOrDataUrl) {
  let imageSource = fileOrDataUrl;
  let objectUrl;
  if (fileOrDataUrl instanceof Blob) {
    objectUrl = URL.createObjectURL(fileOrDataUrl);
    imageSource = objectUrl;
  }

  try {
    const [model, image] = await Promise.all([
      loadAdultImageModel(),
      loadImage(imageSource)
    ]);
    const predictions = await model.classify(image);
    const riskyAdultPrediction = predictions.find(({ className, probability }) =>
      ((className === 'Porn' || className === 'Hentai') && probability >= 0.4) ||
      (className === 'Sexy' && probability >= 0.7)
    );
    return riskyAdultPrediction ? {
      restricted: true,
      category: 'adult or sexually explicit image',
      confidence: riskyAdultPrediction.probability
    } : { restricted: false, category: null, confidence: 0 };
  } catch {
    throw new Error('The image safety check could not run, so the image was not sent or displayed. Try again in a supported browser.');
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
