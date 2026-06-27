function percentile(sorted, ratio) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[index];
}

export function buildDistributionStats(sliceData) {
  const points = (sliceData?.points ?? []).filter(
    (point) => Number.isFinite(point?.val) && Number.isFinite(point?.lat),
  );
  if (!points.length) return null;

  const values = points.map((point) => point.val);
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const p10 = percentile(sorted, 0.1);
  const p90 = percentile(sorted, 0.9);

  const latMap = new Map();
  points.forEach((point) => {
    const key = point.lat.toFixed(1);
    if (!latMap.has(key)) latMap.set(key, []);
    latMap.get(key).push(point.val);
  });

  const latProfile = [...latMap.entries()]
    .map(([lat, arr]) => ({
      lat: Number(lat),
      mean: arr.reduce((sum, value) => sum + value, 0) / arr.length,
    }))
    .filter((item) => Number.isFinite(item.mean))
    .sort((a, b) => a.lat - b.lat);

  if (!latProfile.length) return null;

  return { values, mean, p10, p90, latProfile };
}
