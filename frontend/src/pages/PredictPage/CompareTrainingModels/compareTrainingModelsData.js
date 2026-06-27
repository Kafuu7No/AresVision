const CHANNEL_ORDER = ['U', 'V', 'D', 'S', 'T'];
const FEATURE_ORDER = ['Ozone', 'Temperature', 'Dust_Optical_Depth', 'Solar_Flux_DN', 'U_Wind', 'V_Wind'];

function parseHyperparameters(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeChannels(value) {
  const rawItems = typeof value === 'string'
    ? value.replaceAll('+', ',').split(',')
    : Array.isArray(value)
      ? value
      : [];
  const selected = new Set(rawItems.map((item) => String(item || '').trim().toUpperCase()).filter(Boolean));
  return CHANNEL_ORDER.filter((channel) => selected.has(channel));
}

function formatValue(value) {
  if (Array.isArray(value)) return value.length ? value.join(' / ') : '--';
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (value === 0) return '0';
  return value == null || value === '' ? '--' : String(value);
}

function metricValue(item, metric) {
  const value = Number(item?.metrics?.overall?.[metric]);
  return Number.isFinite(value) ? value : null;
}

export function buildCompareModelSummary(task) {
  const hypers = parseHyperparameters(task?.hyperparameters);
  const selectedChannels = normalizeChannels(hypers.selected_channels);
  const modelSource = String(hypers.model_source || task?.model_source || 'official').toLowerCase();
  const architecture = String(hypers.model_architecture || (modelSource === 'uploaded' ? 'uploaded' : 'predrnnv2')).toLowerCase();
  const dataSource = String(hypers._effective_data_source || hypers._data_source || 'default').toLowerCase();
  const taskId = Number(task?.id);

  return {
    taskId,
    modelName: task?.custom_model_name || `Task #${taskId}`,
    modelSource,
    architecture,
    selectedChannels,
    inputChannelText: selectedChannels.length ? selectedChannels.join(' / ') : 'O3 only',
    window: hypers.window,
    horizon: hypers.horizon,
    dataSource,
  };
}

export function sortCompareItems(items = [], options = {}) {
  const metric = options.metric || 'rmse';
  const direction = options.direction || (metric === 'rmse' || metric === 'mae' ? 'asc' : 'desc');
  const fallback = direction === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

  return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
    const av = metricValue(a, metric) ?? fallback;
    const bv = metricValue(b, metric) ?? fallback;
    return direction === 'asc' ? av - bv : bv - av;
  });
}

export function buildCompareParameterRows(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const hypers = parseHyperparameters(item?.hyperparameters);
    return {
      taskId: Number(item?.task_id),
      modelName: item?.model_name || `Task #${item?.task_id}`,
      modelSource: formatValue(item?.model_source || hypers.model_source),
      architecture: formatValue(item?.architecture || hypers.model_architecture),
      selectedChannels: formatValue(item?.selected_channels || hypers.selected_channels),
      useSphere: formatValue(Boolean(hypers.use_sphere)),
      window: formatValue(hypers.window),
      horizon: formatValue(hypers.horizon),
      epochs: formatValue(hypers.epochs),
      batchSize: formatValue(hypers.batch_size),
      learningRate: formatValue(hypers.learning_rate),
      earlyStoppingPatience: formatValue(hypers.early_stopping_patience),
      seed: formatValue(hypers.seed),
      dataSource: formatValue(hypers._effective_data_source || hypers._data_source || 'default'),
    };
  });
}

export function getCompareSelectionState(selectedIds = []) {
  const ids = (Array.isArray(selectedIds) ? selectedIds : [])
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0);
  return {
    ids,
    canCompare: ids.length >= 2,
    count: ids.length,
  };
}

export function buildStepCurveTraces(items = [], metric = 'rmse') {
  return (Array.isArray(items) ? items : []).map((item) => {
    const steps = Array.isArray(item?.metrics?.per_step) ? item.metrics.per_step : [];
    return {
      taskId: Number(item?.task_id),
      name: item?.model_name || `Task #${item?.task_id}`,
      x: steps.map((step) => Number(step.step)).filter((step) => Number.isFinite(step)),
      y: steps.map((step) => Number(step[metric])).filter((value) => Number.isFinite(value)),
    };
  }).filter((trace) => trace.x.length > 0 && trace.y.length > 0);
}

function histogramCenters(edges = []) {
  return edges.slice(0, -1).map((edge, index) => (Number(edge) + Number(edges[index + 1])) / 2);
}

export function buildErrorHistogramTraces(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => {
    const hist = item?.distribution?.hist_errors || {};
    return {
      taskId: Number(item?.task_id),
      name: item?.model_name || `Task #${item?.task_id}`,
      centers: histogramCenters(hist.bin_edges || []).filter((value) => Number.isFinite(value)),
      counts: (Array.isArray(hist.counts) ? hist.counts : []).map((value) => Number(value)).filter((value) => Number.isFinite(value)),
    };
  }).filter((trace) => trace.centers.length > 0 && trace.counts.length > 0);
}

export function buildPfiMatrix(items = []) {
  const observed = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    (Array.isArray(item?.items) ? item.items : []).forEach((entry) => {
      const name = String(entry?.name || '').trim();
      if (name && !observed.includes(name)) observed.push(name);
    });
  });
  const features = [
    ...FEATURE_ORDER.filter((name) => observed.includes(name)),
    ...observed.filter((name) => !FEATURE_ORDER.includes(name)),
  ];
  const rows = (Array.isArray(items) ? items : []).map((item) => {
    const values = Object.fromEntries(features.map((feature) => [feature, 0]));
    (Array.isArray(item?.items) ? item.items : []).forEach((entry) => {
      const name = String(entry?.name || '').trim();
      const importance = Number(entry?.importance);
      if (name && Number.isFinite(importance)) {
        values[name] = importance;
      }
    });
    return {
      taskId: Number(item?.task_id),
      modelName: item?.model_name || `Task #${item?.task_id}`,
      values,
    };
  });
  return { features, rows };
}
