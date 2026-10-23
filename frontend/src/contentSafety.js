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

const shortenedUrlHosts = new Set([
  'bit.ly',
  'buff.ly',
  'cutt.ly',
  'goo.gl',
  'is.gd',
  'ow.ly',
  'rb.gy',
  'shorturl.at',
  't.co',
  'tinyurl.com'
]);

const trustedBrandHosts = {
  amazon: ['amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de', 'amazon.in', 'amazon.co.jp'],
  apple: ['apple.com', 'icloud.com'],
  facebook: ['facebook.com', 'fb.com', 'meta.com'],
  google: ['google.com', 'google.co.uk', 'google.ca', 'google.com.au', 'google.co.in', 'google.de', 'google.fr', 'google.co.jp'],
  instagram: ['instagram.com'],
  microsoft: ['microsoft.com', 'microsoftonline.com', 'microsoft365.com', 'office.com', 'outlook.com', 'live.com'],
  netflix: ['netflix.com'],
  paypal: ['paypal.com'],
  skype: ['skype.com'],
  whatsapp: ['whatsapp.com']
};

let adultImageModelPromise;

export function inspectTextSafety(text) {
  for (const rule of restrictedTextPatterns) {
    if (rule.patterns.some((pattern) => pattern.test(text))) return rule.category;
  }
  return null;
}

export function inspectLinks(text) {
  if (typeof text !== 'string' || !text) return [];

  const matches = text.matchAll(/(?:https?:\/\/|www\.)[^\s<>"']+|(?:[\p{L}\d](?:[\p{L}\d-]*[\p{L}\d])?\.)+[\p{L}]{2,}(?:\/[^\s<>"']*)?/giu);
  const flagged = [];
  const seen = new Set();

  for (const [match] of matches) {
    const candidate = match.replace(/[),.!?;:]+$/g, '');
    const normalized = candidate.replace(/^www\./i, 'https://www.');
    let url;
    try {
      url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(normalized) ? normalized : `https://${normalized}`);
    } catch {
      continue;
    }
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const reasons = [];

    if (url.username || url.password) reasons.push('The link contains hidden login credentials.');
    if (hostname.startsWith('xn--') || hostname.split('.').some((label) => label.startsWith('xn--'))) {
      reasons.push('The domain uses encoded characters that can imitate other letters.');
    }
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(':')) {
      reasons.push('The link uses a raw IP address instead of a recognizable domain.');
    }
    if (shortenedUrlHosts.has(hostname)) {
      reasons.push('The shortened link hides its final destination.');
    }
    if (url.protocol === 'http:') {
      reasons.push('The link does not use an encrypted HTTPS connection.');
    }
    if (hostname.split('.').length > 4) {
      reasons.push('The domain has an unusually long chain of subdomains.');
    }

    const isRecognizedBrandHost = Object.values(trustedBrandHosts).flat().some((host) =>
      hostname === host || hostname.endsWith(`.${host}`)
    );
    if (!isRecognizedBrandHost && /(?:^|\/)(?:login|log-in|signin|sign-in|verify|verification|account|password|auth)(?:\/|$|[?#.-])/i.test(url.pathname)) {
      reasons.push('The link opens a sign-in or account-verification page on an unrecognized domain.');
    }

    for (const [brand, trustedHosts] of Object.entries(trustedBrandHosts)) {
      const isTrustedHost = trustedHosts.some((host) =>
        hostname === host || hostname.endsWith(`.${host}`)
      );
      const brandDomainInUrl = candidate.toLowerCase().includes(`${brand}.`);
      if (!isTrustedHost && (hostname.includes(brand) || brandDomainInUrl)) {
        reasons.push(`The link mentions ${brand} but does not use one of its recognized domains.`);
      }
    }

    if (reasons.length > 0 && !seen.has(candidate)) {
      seen.add(candidate);
      flagged.push({ url: candidate, reasons });
    }
  }
  return flagged;
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
