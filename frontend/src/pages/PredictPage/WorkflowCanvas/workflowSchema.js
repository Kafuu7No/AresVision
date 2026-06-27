export const WORKFLOW_NODE_TYPES = {
  DATA_SOURCE: 'dataSource',
  MARS_CONTEXT: 'marsContext',
  INPUT_CHANNEL: 'inputChannel',
  PREDRNN_MODEL: 'predrnnModel',
  ANALYSIS_OUTPUT: 'analysisOutput',
  TRAINING_CONFIG: 'trainingConfig',
};

export const WORKFLOW_OUTPUTS = {
  TRIPTYCH: 'triptych',
  METRICS: 'metrics',
  ERROR_DISTRIBUTION: 'errorDistribution',
  PFI: 'permutationImportance',
  SHAP: 'shap',
};

export const CHANNEL_DEFS = [
  { short: 'U', variableId: 'U_Wind', labelKey: 'predict.variables.U_Wind', color: '#4a9eff' },
  { short: 'V', variableId: 'V_Wind', labelKey: 'predict.variables.V_Wind', color: '#7c5cbf' },
  { short: 'D', variableId: 'Dust_Optical_Depth', labelKey: 'predict.variables.Dust_Optical_Depth', color: '#d4a06a' },
  { short: 'S', variableId: 'Solar_Flux_DN', labelKey: 'predict.variables.Solar_Flux_DN', color: '#ffd740' },
  { short: 'T', variableId: 'Temperature', labelKey: 'predict.variables.Temperature', color: '#ff6b4a' },
];

export const CHANNEL_BY_VARIABLE = Object.fromEntries(
  CHANNEL_DEFS.map((item) => [item.variableId, item])
);

export const CHANNEL_BY_SHORT = Object.fromEntries(
  CHANNEL_DEFS.map((item) => [item.short, item])
);

export const VALID_EDGE_TYPES = new Set([
  `${WORKFLOW_NODE_TYPES.DATA_SOURCE}->${WORKFLOW_NODE_TYPES.PREDRNN_MODEL}`,
  `${WORKFLOW_NODE_TYPES.DATA_SOURCE}->${WORKFLOW_NODE_TYPES.TRAINING_CONFIG}`,
  `${WORKFLOW_NODE_TYPES.MARS_CONTEXT}->${WORKFLOW_NODE_TYPES.PREDRNN_MODEL}`,
  `${WORKFLOW_NODE_TYPES.INPUT_CHANNEL}->${WORKFLOW_NODE_TYPES.PREDRNN_MODEL}`,
  `${WORKFLOW_NODE_TYPES.INPUT_CHANNEL}->${WORKFLOW_NODE_TYPES.TRAINING_CONFIG}`,
  `${WORKFLOW_NODE_TYPES.PREDRNN_MODEL}->${WORKFLOW_NODE_TYPES.ANALYSIS_OUTPUT}`,
]);

export const TRAINING_MODEL_ARCHITECTURES = [
  { id: 'predrnnv2', label: 'PredRNNv2' },
  { id: 'predrnnpp', label: 'PredRNN++' },
  { id: 'convlstm', label: 'ConvLSTM' },
  { id: 'simvp', label: 'SimVP' },
  { id: 'dlinear', label: 'DLinear' },
  { id: 'informer', label: 'Informer' },
  { id: 'autoformer', label: 'Autoformer' },
  { id: 'patchtst', label: 'PatchTST' },
  { id: 'timemixer', label: 'TimeMixer' },
  { id: 'timexer', label: 'TimeXer' },
  { id: 'tsmixer', label: 'TSMixer' },
  { id: 'crossformer', label: 'Crossformer' },
  { id: 'earthformer', label: 'Earthformer' },
  { id: 'etsformer', label: 'ETSformer' },
  { id: 'fedformer', label: 'FEDformer' },
  { id: 'itransformer', label: 'iTransformer' },
  { id: 'mau', label: 'MAU' },
  { id: 'nbeats', label: 'N-BEATS' },
  { id: 'nhits', label: 'N-HiTS' },
  { id: 'pyraformer', label: 'Pyraformer' },
  { id: 'rnn_cnn_rnn', label: 'RNN-CNN-RNN' },
  { id: 'cnn_rnn_cnn_rnn_cnn', label: 'CNN-RNN-CNN-RNN-CNN' },
  { id: 'simvp_3dconv', label: 'SimVP-3DConv' },
  { id: 'simvp_hybrid3d', label: 'SimVP-Hybrid3D' },
  { id: 'convlstm_mst', label: 'ConvLSTM-MST' },
  { id: 'dlinear_mst', label: 'DLinear-MST' },
  { id: 'convlstm_phase_gated_mst', label: 'ConvLSTM-PhaseGated-MST' },
  { id: 'convlstm_mst_feature_refiner', label: 'ConvLSTM-MST-Feature' },
  { id: 'convlstm_climatology_anomaly', label: 'ConvLSTM-Climatology-Anomaly' },
];

export const DEFAULT_TRAINING_CONFIG = {
  epochs: 10,
  batch_size: 32,
  learning_rate: 0.001,
  stlstm_hidden_dims: [64, 64, 64],
  window: 3,
  horizon: 3,
  early_stopping_patience: 0,
  seed: 11,
  model_architecture: 'predrnnv2',
  use_sphere: false,
  architecture_params_by_model: createDefaultArchitectureParamsByModel(),
};

export const DEFAULT_MODEL_CONFIG = {
  horizon: 3,
};

export const DEFAULT_CONTEXT_CONFIG = {
  marsYear: 27,
  lsStart: 90,
};

export const DEFAULT_DATA_SOURCE_CONFIG = {
  dataSource: 'default',
};

export function getWorkflowType(node) {
  return node?.data?.workflowType || node?.type;
}

export function isValidWorkflowEdge(sourceType, targetType) {
  return VALID_EDGE_TYPES.has(`${sourceType}->${targetType}`);
}
import { createDefaultArchitectureParamsByModel } from '../../ModelTrainingPage/trainingParamSanitizers.js';
