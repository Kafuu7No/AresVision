const SOURCE_ORDER = ['mcd', 'openmars', 'nomad'];

const roundPercent = (value) => Math.round(value * 1000) / 1000;

const normalizeYearCoverage = (coverage, source, marsYear) => {
  const sourceCoverage = coverage?.[source] || {};
  return sourceCoverage?.[marsYear] || sourceCoverage?.[String(marsYear)] || [];
};

const intervalContainsLs = (interval, ls) => {
  const start = Number(interval?.start);
  const end = Number(interval?.end);
  const value = Number(ls);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(value)) return false;
  return value >= Math.min(start, end) && value <= Math.max(start, end);
};

export function buildCoverageSegments({ coverage, marsYear, source, min = 0, max = 360 }) {
  const timelineMin = Number.isFinite(Number(min)) ? Number(min) : 0;
  const timelineMax = Number.isFinite(Number(max)) && Number(max) > timelineMin ? Number(max) : 360;
  const span = timelineMax - timelineMin;

  return normalizeYearCoverage(coverage, source, marsYear)
    .map((interval) => {
      const rawStart = Number(interval?.start);
      const rawEnd = Number(interval?.end);
      if (!Number.isFinite(rawStart) || !Number.isFinite(rawEnd)) return null;

      const start = Math.max(timelineMin, Math.min(rawStart, rawEnd));
      const end = Math.min(timelineMax, Math.max(rawStart, rawEnd));
      if (end < timelineMin || start > timelineMax || end < start) return null;

      return {
        start,
        end,
        left: roundPercent(((start - timelineMin) / span) * 100),
        width: roundPercent(((end - start) / span) * 100),
      };
    })
    .filter(Boolean);
}

export function getActiveOzoneSources({ coverage, marsYear, ls }) {
  const active = ['mcd'];
  for (const source of SOURCE_ORDER) {
    if (source === 'mcd') continue;
    const intervals = normalizeYearCoverage(coverage, source, marsYear);
    if (intervals.some((interval) => intervalContainsLs(interval, ls))) {
      active.push(source);
    }
  }
  return active;
}

export function getOzoneAvailabilityLabel(activeSources, isZh = false) {
  const sources = new Set(activeSources || ['mcd']);
  const hasNomad = sources.has('nomad');
  const hasOpenMars = sources.has('openmars');

  if (hasNomad && hasOpenMars) {
    return isZh ? '多源臭氧' : 'Multi-source ozone';
  }
  if (hasNomad) return 'MCD + NOMAD';
  if (hasOpenMars) return 'MCD + OpenMARS';
  return isZh ? '仅 MCD' : 'MCD only';
}

export function hasCoverageForSource({ coverage, marsYear, source }) {
  return normalizeYearCoverage(coverage, source, marsYear).length > 0;
}
