function flattenFields(fields = []) {
  const values = [];
  fields.forEach((item) => {
    const rows = Array.isArray(item?.field) ? item.field : [];
    rows.forEach((row) => {
      (Array.isArray(row) ? row : []).forEach((value) => {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) values.push(numeric);
      });
    });
  });
  return values;
}

function buildHistogram(values, bins) {
  if (!values.length) return { bin_edges: [0, 1], counts: [0] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(Math.abs(max), 1);
  const step = span / bins;
  const edges = Array.from({ length: bins + 1 }, (_, index) => min + step * index);
  const counts = Array.from({ length: bins }, () => 0);

  values.forEach((value) => {
    const rawIndex = Math.floor((value - min) / step);
    const index = Math.max(0, Math.min(bins - 1, rawIndex));
    counts[index] += 1;
  });

  return { bin_edges: edges, counts };
}

function samplePairs(trues, preds, maxPoints) {
  const total = Math.min(trues.length, preds.length);
  if (total <= maxPoints) {
    return Array.from({ length: total }, (_, index) => index);
  }
  const step = total / maxPoints;
  return Array.from({ length: maxPoints }, (_, index) => Math.floor(index * step));
}

export function buildErrorDistributionFromPrediction(predictionPayload, options = {}) {
  const bins = options.bins || 40;
  const maxPoints = options.maxPoints || 50000;
  const trues = flattenFields(predictionPayload?.ground_truth);
  const preds = flattenFields(predictionPayload?.prediction);
  const total = Math.min(trues.length, preds.length);
  const validPairs = [];

  for (let index = 0; index < total; index += 1) {
    if (Number.isFinite(trues[index]) && Number.isFinite(preds[index])) {
      validPairs.push([trues[index], preds[index]]);
    }
  }

  const trueValues = validPairs.map(([truth]) => truth);
  const predValues = validPairs.map(([, pred]) => pred);
  const errors = validPairs.map(([truth, pred]) => pred - truth);
  const indices = samplePairs(trueValues, predValues, maxPoints);
  const rmse = errors.length
    ? Math.sqrt(errors.reduce((sum, value) => sum + value * value, 0) / errors.length)
    : 0;
  const mae = errors.length
    ? errors.reduce((sum, value) => sum + Math.abs(value), 0) / errors.length
    : 0;

  return {
    scatter: {
      trues: indices.map((index) => trueValues[index]),
      preds: indices.map((index) => predValues[index]),
      density: indices.map(() => 1),
    },
    hist_trues: buildHistogram(trueValues, bins),
    hist_preds: buildHistogram(predValues, bins),
    hist_errors: buildHistogram(errors, bins),
    mae,
    rmse,
  };
}

export function buildPerformanceMetricsFromEval(metricsPayload) {
  const overall = metricsPayload?.overall || {};
  return {
    global_r2: Number(overall.r2) || 0,
    global_rmse: Number(overall.rmse) || 0,
    global_mae: Number(overall.mae) || 0,
    global_ssim: Number(overall.ssim) || 0,
  };
}
