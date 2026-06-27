export function getModelTrainingControlVisibility(modelSource) {
  return {
    officialModelControls: modelSource !== 'uploaded',
  };
}

const UPLOADED_MODEL_HIDDEN_HYPERPARAMETERS = new Set([
  'model_source',
  'model_architecture',
  'use_sphere',
  'stlstm_hidden_dims',
  'spatial_hidden_dim',
  'temporal_hidden_dim',
  'temporal_depth',
  'linear_hidden_layers',
  'd_model',
  'n_heads',
  'e_layers',
  'd_ff',
  'patch_len',
  'stride',
  'moving_avg',
  'down_sampling_window',
  'down_sampling_layers',
  'hidden_dim',
  'seg_len',
  'win_size',
  'factor',
  'num_downsample',
  'cnn_depth',
  'mst_spatial_hidden_dim',
  'mst_temporal_hidden_dim',
  'mst_num_downsample',
  'mst_temporal_depth',
  'phase_context_dim',
  'climatology_hidden_dim',
  'kernel_size',
  'tau',
  'stack_count',
  'blocks_per_stack',
  'top_k_freq',
  'modes',
  'mlp_ratio',
  'dropout',
  'gamma',
  'initial_history_weight',
  'initial_translation_weight',
  'patch_size',
  'cuboid_size',
  'pooling_sizes',
  'downsample_factors',
]);

export function getVisibleTrainingHyperparameters(hyperparameters = {}) {
  const isUploadedModel = hyperparameters?.model_source === 'uploaded';

  return Object.entries(hyperparameters || {}).filter(([key]) => {
    if (key.startsWith('_')) return false;
    if (!isUploadedModel) return true;
    return !UPLOADED_MODEL_HIDDEN_HYPERPARAMETERS.has(key);
  });
}
