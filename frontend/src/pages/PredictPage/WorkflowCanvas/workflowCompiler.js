import {
  CHANNEL_BY_VARIABLE,
  CHANNEL_DEFS,
  DEFAULT_CONTEXT_CONFIG,
  DEFAULT_DATA_SOURCE_CONFIG,
  DEFAULT_MODEL_CONFIG,
  DEFAULT_TRAINING_CONFIG,
  TRAINING_MODEL_ARCHITECTURES,
  WORKFLOW_NODE_TYPES,
  getWorkflowType,
  isValidWorkflowEdge,
} from './workflowSchema.js';
import {
  extractLegacyWorkflowConfig,
  normalizeWorkflowConfig,
} from './workflowConfig.js';
import {
  buildTrainingHyperparameters,
  createDefaultArchitectureParamsByModel,
  getModelStructureConfig,
} from '../../ModelTrainingPage/trainingParamSanitizers.js';

export const UNIFIED_TRAINING_SCRIPT = 'demo3.py';

function getNodesByType(nodes, workflowType) {
  return (nodes || []).filter((node) => getWorkflowType(node) === workflowType);
}

function getNode(nodes, id) {
  return (nodes || []).find((node) => node.id === id) || null;
}

function getIncoming(nodes, edges, targetId, sourceType = null) {
  return (edges || [])
    .filter((edge) => edge.target === targetId)
    .map((edge) => getNode(nodes, edge.source))
    .filter(Boolean)
    .filter((node) => !sourceType || getWorkflowType(node) === sourceType);
}

function getOutgoing(nodes, edges, sourceId, targetType = null) {
  return (edges || [])
    .filter((edge) => edge.source === sourceId)
    .map((edge) => getNode(nodes, edge.target))
    .filter(Boolean)
    .filter((node) => !targetType || getWorkflowType(node) === targetType);
}

function getPrimaryModel(nodes = []) {
  return getNodesByType(nodes, WORKFLOW_NODE_TYPES.PREDRNN_MODEL)[0] || null;
}

function getSelectedChannelNodes(nodes = [], edges = []) {
  const model = getPrimaryModel(nodes);
  if (model) {
    const connectedChannels = getIncoming(nodes, edges, model.id, WORKFLOW_NODE_TYPES.INPUT_CHANNEL);
    if (connectedChannels.length > 0) return connectedChannels;
  }
  return getNodesByType(nodes, WORKFLOW_NODE_TYPES.INPUT_CHANNEL);
}

function uniqueVariablesFromChannelNodes(channelNodes) {
  const seen = new Set();
  const connectedVariables = channelNodes
    .map((node) => node?.data?.variableId)
    .filter((variableId) => CHANNEL_BY_VARIABLE[variableId])
    .filter((variableId) => {
      if (seen.has(variableId)) return false;
      seen.add(variableId);
      return true;
    });

  return CHANNEL_DEFS
    .map((channel) => channel.variableId)
    .filter((variableId) => connectedVariables.includes(variableId));
}

function normalizeHorizon(value, fallback = 3) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(3, Math.round(parsed)));
}

function normalizeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeHiddenDims(value) {
  if (Array.isArray(value)) {
    const dims = value.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0);
    return dims.length > 0 ? dims : [...DEFAULT_TRAINING_CONFIG.stlstm_hidden_dims];
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return normalizeHiddenDims(parsed);
    } catch {
      const dims = value
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item) && item > 0);
      return dims.length > 0 ? dims : [...DEFAULT_TRAINING_CONFIG.stlstm_hidden_dims];
    }
  }
  return [...DEFAULT_TRAINING_CONFIG.stlstm_hidden_dims];
}

function resolveArchitectureParamsByModel(raw = {}) {
  const modelArchitecture = normalizeTrainingArchitecture(raw.model_architecture);
  const paramsByModel = {
    ...createDefaultArchitectureParamsByModel(),
    ...(raw.architecture_params_by_model || {}),
  };
  const activeParams = { ...(paramsByModel[modelArchitecture] || {}) };

  for (const field of getModelStructureConfig(modelArchitecture)) {
    if (raw[field.key] != null) {
      activeParams[field.key] = raw[field.key];
    }
  }

  paramsByModel[modelArchitecture] = activeParams;
  return paramsByModel;
}

function normalizeTrainingArchitecture(value) {
  const normalized = String(value || DEFAULT_TRAINING_CONFIG.model_architecture).trim().toLowerCase();
  return TRAINING_MODEL_ARCHITECTURES.some((item) => item.id === normalized)
    ? normalized
    : DEFAULT_TRAINING_CONFIG.model_architecture;
}

function resolveWorkflowConfig(nodes = [], workflowConfig = {}) {
  const legacyConfig = extractLegacyWorkflowConfig(nodes);
  return normalizeWorkflowConfig({
    ...legacyConfig,
    ...workflowConfig,
    training: {
      ...(legacyConfig.training || {}),
      ...(workflowConfig.training || {}),
    },
  });
}

export function getScriptForVariables(selectedVariables = []) {
  return UNIFIED_TRAINING_SCRIPT;
}

export function getChannelShortsForVariables(selectedVariables = []) {
  return CHANNEL_DEFS
    .filter((channel) => selectedVariables.includes(channel.variableId))
    .map((channel) => channel.short);
}

export function validateWorkflowGraph(nodes = [], edges = [], mode = 'prediction') {
  const errors = [];

  for (const edge of edges || []) {
    const source = getNode(nodes, edge.source);
    const target = getNode(nodes, edge.target);
    const sourceType = getWorkflowType(source);
    const targetType = getWorkflowType(target);
    if (!source || !target || !isValidWorkflowEdge(sourceType, targetType)) {
      errors.push({
        code: 'invalid_edge',
        message: 'This connection is not allowed.',
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
      });
    }
  }

  if (mode === 'prediction') {
    const model = getPrimaryModel(nodes);
    if (!model) {
      errors.push({
        code: 'missing_model',
        message: 'Add a PredRNNv2 model node before running prediction.',
      });
    }

    const rawHorizon = Number(model?.data?.horizon ?? DEFAULT_MODEL_CONFIG.horizon);
    if (model && (!Number.isFinite(rawHorizon) || rawHorizon < 1 || rawHorizon > 3)) {
      errors.push({
        code: 'invalid_horizon',
        message: 'Prediction horizon must be between 1 and 3.',
        nodeId: model.id,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function compilePredictionWorkflow(nodes = [], edges = [], workflowConfig = {}) {
  const validation = validateWorkflowGraph(nodes, edges, 'prediction');
  if (!validation.valid) {
    const error = new Error(validation.errors[0]?.message || 'Invalid workflow graph');
    error.validation = validation;
    throw error;
  }

  const config = resolveWorkflowConfig(nodes, workflowConfig);
  const model = getPrimaryModel(nodes);
  const channelNodes = getSelectedChannelNodes(nodes, edges);
  const outputs = model ? getOutgoing(nodes, edges, model.id, WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT) : [];

  const selectedVariables = uniqueVariablesFromChannelNodes(channelNodes);
  const enabledOutputs = outputs
    .map((node) => node?.data?.outputId)
    .filter(Boolean);

  const horizon = normalizeHorizon(model?.data?.horizon, DEFAULT_MODEL_CONFIG.horizon);
  const marsYear = Math.round(normalizeNumber(config.marsYear, DEFAULT_CONTEXT_CONFIG.marsYear));
  const lsStart = normalizeNumber(config.lsStart, DEFAULT_CONTEXT_CONFIG.lsStart);
  const resolvedDataSource = config.dataSource || DEFAULT_DATA_SOURCE_CONFIG.dataSource;

  return {
    dataSource: resolvedDataSource,
    marsYear,
    lsStart,
    horizon,
    selectedVariables,
    enabledOutputs,
    body: {
      selected_variables: selectedVariables,
      horizon,
      ls_start: lsStart,
      mars_year: marsYear,
    },
  };
}

export function compileTrainingDraft(nodes = [], edges = [], workflowConfig = {}, availableScripts = null) {
  const validation = validateWorkflowGraph(nodes, edges, 'training');
  if (!validation.valid) {
    const error = new Error(validation.errors[0]?.message || 'Invalid training workflow graph');
    error.validation = validation;
    throw error;
  }

  const config = resolveWorkflowConfig(nodes, workflowConfig);
  const channelNodes = getSelectedChannelNodes(nodes, edges);
  const selectedVariables = uniqueVariablesFromChannelNodes(channelNodes);
  const selectedChannels = getChannelShortsForVariables(selectedVariables);
  const selectedScript = getScriptForVariables(selectedVariables);

  if (Array.isArray(availableScripts) && !availableScripts.includes(selectedScript)) {
    throw new Error(`Generated script ${selectedScript} is not available.`);
  }

  const raw = config.training || DEFAULT_TRAINING_CONFIG;
  const hyperparameters = buildTrainingHyperparameters({
    epochs: raw.epochs,
    batchSize: raw.batch_size,
    learningRate: raw.learning_rate,
    hiddenDims: normalizeHiddenDims(raw.stlstm_hidden_dims),
    windowValue: raw.window,
    horizon: raw.horizon,
    earlyStoppingPatience: raw.early_stopping_patience,
    seed: raw.seed,
    selected_channels: selectedChannels,
    selectedChannels,
    channelOrder: CHANNEL_DEFS.map((channel) => channel.short),
    modelArchitecture: normalizeTrainingArchitecture(raw.model_architecture),
    useSphere: Boolean(raw.use_sphere),
    architectureParamsByModel: resolveArchitectureParamsByModel(raw),
  });

  return {
    selectedChannels,
    selectedVariables,
    selectedScript,
    hyperparameters,
    dataSource: config.dataSource || DEFAULT_DATA_SOURCE_CONFIG.dataSource,
  };
}
