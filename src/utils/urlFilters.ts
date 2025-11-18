import { canonicalizeUrl } from './url';

const BLOCKED_HOST_PATTERNS: RegExp[] = [
  /(^|\.)doubleclick\.net$/i,
  /(^|\.)google(adservices|analytics|syndication)\.com$/i,
  /(^|\.)googletagmanager\.com$/i,
  /(^|\.)googletagservices\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)tiktokcdn\.com$/i,
  /(^|\.)taboola\.com$/i,
  /(^|\.)outbrain\.com$/i,
  /(^|\.)scorecardresearch\.com$/i,
  /(^|\.)quantserve\.com$/i,
  /(^|\.)zedo\.com$/i,
  /(^|\.)advertising\.com$/i,
  /(^|\.)twitter\.com$/i,
  /(^|\.)pinterest\.com$/i,
  /(^|\.)snapchat\.com$/i,
  /(^|\.)bet365\./i,
  /(^|\.)1xbet\./i,
  /(^|\.)betano\./i,
  /(^|\.)pixbet\./i,
  /(^|\.)leonbet\./i,
  /(^|\.)whatsapp\.com$/i,
  /(^|\.)wa\.me$/i,
  /(^|\.)web\.whatsapp\.com$/i,
  /(^|\.)t\.me$/i,
  /(^|\.)telegram\.me$/i,
  /(^|\.)telegram\.org$/i,
  /(^|\.)discord\.com$/i,
  /(^|\.)discordapp\.com$/i,
  /(^|\.)suporte\./i,
  /(^|\.)support\./i,
  /(^|\.)help\./i
];

const BLOCKED_PATH_PATTERNS: RegExp[] = [
  /\/ads?\//i,
  /\/advertising\//i,
  /\/sponsored\//i,
  /\/promo\//i,
  /\/tracking\//i,
  /\/analytics\//i,
  /\/pixel\//i,
  /\/tag\/manager\//i,
  /\/consent\//i,
  /\/suporte\b/i,
  /\/support\b/i,
  /\/ajuda\b/i,
  /\/help\b/i,
  /\/faq\b/i,
  /\/contato\b/i,
  /\/contact\b/i,
  /\/sac\b/i,
  /\/atendimento\b/i,
  /\/minha[-_]conta\b/i,
  /\/my[-_]account\b/i,
  /\/account\b/i,
  /\/login\b/i,
  /\/signin\b/i,
  /\/chat\b/i,
  /\/whatsapp\b/i,
  /\/telegram\b/i
];

const BLOCKED_EXTENSIONS = [
  '.gif',
  '.jpg',
  '.jpeg',
  '.png',
  '.svg',
  '.ico',
  '.webp',
  '.mp4',
  '.mp3',
  '.avi',
  '.mov',
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.zip',
  '.rar',
  '.7z',
  '.gz',
  '.tar'
];

export function isBlockedUrl(candidateUrl: string): boolean {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(candidateUrl);
  } catch {
    return true;
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (!hostname) return true;

  if (BLOCKED_HOST_PATTERNS.some(pattern => pattern.test(hostname))) return true;

  const pathname = parsedUrl.pathname.toLowerCase();
  if (BLOCKED_PATH_PATTERNS.some(pattern => pattern.test(pathname))) return true;

  if (BLOCKED_EXTENSIONS.some(extension => pathname.endsWith(extension))) return true;

  const normalized = canonicalizeUrl(parsedUrl.toString());
  return BLOCKED_PATH_PATTERNS.some(pattern => pattern.test(normalized));
}
