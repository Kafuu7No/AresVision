import {
  DEFAULT_CONTEXT_CONFIG,
  DEFAULT_DATA_SOURCE_CONFIG,
  DEFAULT_TRAINING_CONFIG,
  WORKFLOW_NODE_TYPES,
  getWorkflowType,
} from './workflowSchema.js';

export const EXTERNAL_WORKFLOW_NODE_TYPES = new Set([
  WORKFLOW_NODE_TYPES.DATA_SOURCE,
  WORKFLOW_NODE_TYPES.MARS_CONTEXT,
  WORKFLOW_NODE_TYPES.TRAINING_CONFIG,
]);

function cloneTrainingConfig(training = DEFAULT_TRAINING_CONFIG) {
  const architectureParamsByModel = training.architecture_params_by_model || {};
  return {
    ...DEFAULT_TRAINING_CONFIG,
    ...training,
    stlstm_hidden_dims: Array.isArray(training.stlstm_hidden_dims)
      ? [...training.stlstm_hidden_dims]
      : training.stlstm_hidden_dims,
    architecture_params_by_model: Object.fromEntries(
      Object.entries({
        ...DEFAULT_TRAINING_CONFIG.architecture_params_by_model,
        ...architectureParamsByModel,
      }).map(([modelId, params]) => [modelId, { ...(params || {}) }])
    ),
  };
}

export function getDefaultWorkflowConfig() {
  return {
    dataSource: DEFAULT_DATA_SOURCE_CONFIG.dataSource,
    marsYear: DEFAULT_CONTEXT_CONFIG.marsYear,
    lsStart: DEFAULT_CONTEXT_CONFIG.lsStart,
    training: cloneTrainingConfig(DEFAULT_TRAINING_CONFIG),
  };
}

export function normalizeWorkflowConfig(config = {}) {
  const defaults = getDefaultWorkflowConfig();
  const training = cloneTrainingConfig({
    ...defaults.training,
    ...(config.training || {}),
  });

  return {
    dataSource: config.dataSource || defaults.dataSource,
    marsYear: config.marsYear ?? defaults.marsYear,
    lsStart: config.lsStart ?? defaults.lsStart,
    training,
  };
}

export function isExternalWorkflowNode(nodeOrType) {
  const workflowType = typeof nodeOrType === 'string' ? nodeOrType : getWorkflowType(nodeOrType);
  return EXTERNAL_WORKFLOW_NODE_TYPES.has(workflowType);
}

export function extractLegacyWorkflowConfig(nodes = []) {
  const config = {};
  const training = {};

  for (const node of nodes || []) {
    const data = node?.data || {};
    const workflowType = getWorkflowType(node);

    if (workflowType === WORKFLOW_NODE_TYPES.DATA_SOURCE && data.dataSource) {
      config.dataSource = data.dataSource;
    }

    if (workflowType === WORKFLOW_NODE_TYPES.MARS_CONTEXT) {
      if (data.marsYear != null) config.marsYear = data.marsYear;
      if (data.lsStart != null) config.lsStart = data.lsStart;
    }

    if (workflowType === WORKFLOW_NODE_TYPES.TRAINING_CONFIG) {
      for (const key of Object.keys(DEFAULT_TRAINING_CONFIG)) {
        if (data[key] != null) training[key] = data[key];
      }
    }
  }

  if (Object.keys(training).length > 0) {
    config.training = training;
  }

  return config;
}

export function migrateWorkflowConfigFromGraph(graph = {}, initialConfig = {}) {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const legacyConfig = extractLegacyWorkflowConfig(nodes);
  const config = normalizeWorkflowConfig({
    ...initialConfig,
    ...legacyConfig,
    training: {
      ...(initialConfig.training || {}),
      ...(legacyConfig.training || {}),
    },
  });
  const externalNodeIds = new Set(
    nodes
      .filter((node) => isExternalWorkflowNode(node))
      .map((node) => node.id),
  );

  return {
    config,
    graph: {
      nodes: nodes.filter((node) => !externalNodeIds.has(node.id)),
      edges: edges.filter((edge) => !externalNodeIds.has(edge.source) && !externalNodeIds.has(edge.target)),
    },
  };
}
