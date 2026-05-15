export const FONT_SCALE_VAR = '--font-scale';
export const DEFAULT_FONT_SCALE = 1;
export const MIN_FONT_SCALE = 0.7;
export const MAX_FONT_SCALE = 1.5;

export function normalizeFontScale(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return DEFAULT_FONT_SCALE;
  return Math.min(MAX_FONT_SCALE, Math.max(MIN_FONT_SCALE, parsed));
}

export function parseFontSizeValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  const match = normalized.match(/^(-?\d*\.?\d+)(px)?$/i);
  if (!match) return null;

  const parsed = Number.parseFloat(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function scalePixelValue(sizePx, scale = DEFAULT_FONT_SCALE) {
  const parsed = Number.parseFloat(sizePx);
  if (!Number.isFinite(parsed)) return null;
  return parsed * normalizeFontScale(scale);
}

export function formatScaledFontSize(basePx) {
  const parsed = Number.parseFloat(basePx);
  if (!Number.isFinite(parsed)) return '';

  const normalized = Number.isInteger(parsed)
    ? String(parsed)
    : parsed.toFixed(2).replace(/\.?0+$/, '');

  return `calc(${normalized}px * var(${FONT_SCALE_VAR}, 1))`;
}

export function buildCanvasFont(sizePx, { family = 'sans-serif', style = 'normal', weight = 'normal', scale = DEFAULT_FONT_SCALE } = {}) {
  const scaledSize = scalePixelValue(sizePx, scale);
  if (!Number.isFinite(scaledSize)) {
    return `${weight} ${sizePx}px ${family}`.trim();
  }

  const sizeToken = `${scaledSize.toFixed(2).replace(/\.?0+$/, '')}px`;
  return [style !== 'normal' ? style : null, weight !== 'normal' ? weight : null, sizeToken, family]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
