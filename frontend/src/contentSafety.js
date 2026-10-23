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

const riskyTopLevelDomains = new Set([
  'click',
  'country',
  'gq',
  'link',
  'loan',
  'ml',
  'mom',
  'mov',
  'online',
  'rest',
  'ru',
  'shop',
  'support',
  'top',
  'work',
  'zip'
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

const loginLurePattern = /\b(?:account|billing|delivery|invoice|locked|password|payment|refund|security|suspended|urgent|verify|verification|wallet)\b/i;
const urgentActionPattern = /\b(?:act now|expires today|immediately|locked|suspended|urgent|verify now|within \d+ hours?)\b/i;
const redirectParameterPattern = /^(?:continue|dest|destination|next|redirect|redirect_uri|return|returnto|return_url|target|url)$/i;
const linkPattern = /(?:https?:\/\/|www\.)[^\s<>"']+|(?:[\p{L}\d](?:[\p{L}\d-]*[\p{L}\d])?\.)+[\p{L}]{2,}(?::\d{1,5})?(?:\/[^\s<>"']*)?/giu;

let adultImageModelPromise;
const imageModelInputSize = 224;

export function inspectTextSafety(text) {
  for (const rule of restrictedTextPatterns) {
    if (rule.patterns.some((pattern) => pattern.test(text))) return rule.category;
  }
  return null;
}

function findLinkMatches(text) {
  if (typeof text !== 'string' || !text) return [];
  return Array.from(text.matchAll(new RegExp(linkPattern.source, linkPattern.flags)));
}

export function containsLinks(text) {
  return findLinkMatches(text).length > 0;
}

export function inspectLinks(text) {
  if (typeof text !== 'string' || !text) return [];

  const flagged = [];
  const seen = new Set();

  for (const result of findLinkMatches(text)) {
    const match = result[0];
    const offset = result.index ?? 0;
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
    const context = text.slice(Math.max(0, offset - 100), Math.min(text.length, offset + match.length + 100));
    const hostLabels = hostname.split('.');

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
    if (riskyTopLevelDomains.has(hostLabels.at(-1))) {
      reasons.push('The link uses a top-level domain frequently abused in deceptive links.');
    }

    const isRecognizedBrandHost = Object.values(trustedBrandHosts).flat().some((host) =>
      hostname === host || hostname.endsWith(`.${host}`)
    );
    const isAccountPath = /(?:^|\/)(?:login|log-in|signin|sign-in|verify|verification|account|password|auth|dashboard|portal)(?:\/|$|[?#.-])/i.test(url.pathname);
    const isAccountHost = /(?:^|[-.])(?:login|log-in|signin|sign-in|verify|verification|account|auth)(?:[-.]|$)/i.test(hostname);
    const hasAccountLure = loginLurePattern.test(context) || isAccountPath;
    if (!isRecognizedBrandHost && (isAccountPath || isAccountHost)) {
      reasons.push('The link opens a sign-in or account-verification page on an unrecognized domain.');
    }
    if (!isRecognizedBrandHost && loginLurePattern.test(context) && url.protocol !== 'https:') {
      reasons.push('The message uses account or payment language with a link that is not HTTPS.');
    }
    if (!isRecognizedBrandHost && url.protocol === 'https:' &&
        loginLurePattern.test(context) && urgentActionPattern.test(context)) {
      reasons.push('The message combines an unrecognized domain with urgent account-verification language.');
    }
    if (!isRecognizedBrandHost && hasAccountLure &&
        url.searchParams && [...url.searchParams.keys()].some((name) => redirectParameterPattern.test(name))) {
      reasons.push('The account-related link contains a redirect parameter that may hide its final destination.');
    }

    for (const [brand, trustedHosts] of Object.entries(trustedBrandHosts)) {
      const isTrustedHost = trustedHosts.some((host) =>
        hostname === host || hostname.endsWith(`.${host}`)
      );
      const brandDomainInUrl = candidate.toLowerCase().includes(`${brand}.`);
      if (!isTrustedHost && (hostname.includes(brand) || brandDomainInUrl)) {
        reasons.push(`The link mentions ${brand} but does not use one of its recognized domains.`);
      }
      const normalizedBrand = brand.replace(/[^a-z\d]/g, '');
      const lookalikeLabel = hostLabels.some((rawLabel) => {
        const label = rawLabel.replace(/[^a-z\d]/g, '');
        const normalizedLabel = label
          .replace(/0/g, 'o')
          .replace(/1/g, 'l')
          .replace(/3/g, 'e')
          .replace(/5/g, 's');
        return label !== normalizedBrand &&
          label.length >= 4 &&
          Math.abs(label.length - normalizedBrand.length) <= 1 &&
          levenshteinDistance(normalizedLabel, normalizedBrand) <= 1;
      });
      if (!isTrustedHost && lookalikeLabel) {
        reasons.push(`The domain closely resembles the ${brand} name but is not its recognized domain.`);
      }
    }

    if (reasons.length > 0 && !seen.has(candidate)) {
      seen.add(candidate);
      flagged.push({ url: candidate, reasons });
    }
  }
  return flagged;
}

function levenshteinDistance(first, second) {
  let previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let row = 1; row <= first.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= second.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (first[row - 1] === second[column - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return previous[second.length];
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
      await configureImageModelBackend(tensorflow);
      return nsfwjs.load('MobileNetV2', { modelDefinitions: [modelDefinition.MobileNetV2Model] });
    })().catch((error) => {
      adultImageModelPromise = null;
      throw error;
    });
  }
  return adultImageModelPromise;
}

export async function configureImageModelBackend(tensorflow) {
  let lastError;
  for (const backend of ['webgl', 'cpu']) {
    try {
      if (await tensorflow.setBackend(backend)) {
        await tensorflow.ready();
        return backend;
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error('This browser does not have a compatible image-analysis backend.', { cause: lastError });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The browser could not decode this image.'));
    image.src = source;
  });
}

async function prepareImageForClassification(source) {
  let image;
  let bitmapError;
  if (source instanceof Blob && typeof createImageBitmap === 'function') {
    try {
      image = await createImageBitmap(source, {
        resizeWidth: imageModelInputSize,
        resizeHeight: imageModelInputSize,
        resizeQuality: 'low'
      });
    } catch (error) {
      bitmapError = error;
    }
  }

  let objectUrl;
  if (!image) {
    const imageSource = source instanceof Blob
      ? (objectUrl = URL.createObjectURL(source))
      : source;
    try {
      image = await loadImage(imageSource);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown image decoding error.';
      throw new Error(
        `${reason}${bitmapError instanceof Error ? ` (image bitmap error: ${bitmapError.message})` : ''}`
      );
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  let canvas;
  try {
    canvas = document.createElement('canvas');
    canvas.width = imageModelInputSize;
    canvas.height = imageModelInputSize;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('This browser could not create a canvas for image analysis.');
    context.drawImage(image, 0, 0, imageModelInputSize, imageModelInputSize);
    return canvas;
  } finally {
    if (typeof image.close === 'function') image.close();
  }
}

function findRiskyAdultPrediction(predictions) {
  return predictions.find(({ className, probability }) =>
    ((className === 'Porn' || className === 'Hentai') && probability >= 0.4) ||
    (className === 'Sexy' && probability >= 0.7)
  );
}

export async function inspectImageSafety(fileOrDataUrl, dependencies = {}) {
  const loadModel = dependencies.loadModel || loadAdultImageModel;
  const prepareImage = dependencies.prepareImage || prepareImageForClassification;
  let canvas;
  try {
    const [modelResult, imageResult] = await Promise.allSettled([
      loadModel(),
      prepareImage(fileOrDataUrl)
    ]);
    if (imageResult.status === 'fulfilled') canvas = imageResult.value;
    if (modelResult.status === 'rejected') throw modelResult.reason;
    if (imageResult.status === 'rejected') throw imageResult.reason;
    const predictions = await modelResult.value.classify(imageResult.value);
    const riskyAdultPrediction = findRiskyAdultPrediction(predictions);
    return riskyAdultPrediction ? {
      restricted: true,
      category: 'adult or sexually explicit image',
      confidence: riskyAdultPrediction.probability
    } : { restricted: false, category: null, confidence: 0 };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown image-analysis error.';
    throw new Error(
      `The on-device image safety check failed: ${reason} The image was not sent or displayed. ` +
      'Check your connection for the first model download and try an up-to-date browser.',
      { cause: error }
    );
  } finally {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
