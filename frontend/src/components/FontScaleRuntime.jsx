import { useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { formatScaledFontSize, normalizeFontScale, parseFontSizeValue } from '../utils/fontScale';

const INLINE_BASE_ATTR = 'data-font-scale-base';
const SVG_BASE_ATTR = 'data-font-scale-svg-base';

function syncInlineFontSize(element) {
  if (!(element instanceof HTMLElement || element instanceof SVGElement)) return;

  const current = element.style ? element.style.fontSize : '';
  if (!current || current.includes('var(--font-scale)') || current.includes('rem') || current.includes('em')) {
    return;
  }

  const parsed = parseFontSizeValue(current);
  if (parsed == null) return;

  const stored = element.getAttribute(INLINE_BASE_ATTR);
  if (stored !== String(parsed)) {
    element.setAttribute(INLINE_BASE_ATTR, String(parsed));
  }

  const next = formatScaledFontSize(parsed);
  if (element.style.fontSize !== next) {
    element.style.fontSize = next;
  }
}

function syncSvgFontSize(element) {
  if (!(element instanceof SVGElement)) return;

  const current = element.getAttribute('font-size');
  if (!current || current.includes('var(--font-scale)') || current.includes('rem') || current.includes('em')) {
    return;
  }

  const parsed = parseFontSizeValue(current);
  if (parsed == null) return;

  const stored = element.getAttribute(SVG_BASE_ATTR);
  if (stored !== String(parsed)) {
    element.setAttribute(SVG_BASE_ATTR, String(parsed));
  }

  const next = formatScaledFontSize(parsed);
  if (element.getAttribute('font-size') !== next) {
    element.setAttribute('font-size', next);
  }
}

function applyFontScale(root) {
  if (!(root instanceof Element)) return;

  const visit = (element) => {
    syncInlineFontSize(element);
    syncSvgFontSize(element);
  };

  visit(root);
  root.querySelectorAll('*').forEach(visit);
}

export default function FontScaleRuntime() {
  const { settings } = useSettings();

  useEffect(() => {
    if (!document.body) return undefined;

    applyFontScale(document.body);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          if (mutation.target instanceof Element) {
            applyFontScale(mutation.target);
          }
          return;
        }

        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            applyFontScale(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['style', 'font-size'],
    });

    return () => observer.disconnect();
  }, [settings.appearance?.uiScale]);

  return null;
}
