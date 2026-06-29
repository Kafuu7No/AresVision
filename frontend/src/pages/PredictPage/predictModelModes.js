export const PREDICT_MODEL_MODE_TRAINED = 'trained';
export const PREDICT_MODEL_MODE_COMPARE = 'trained_compare';

export const PREDICT_MODEL_MODES = [
  PREDICT_MODEL_MODE_TRAINED,
  PREDICT_MODEL_MODE_COMPARE,
];

export const DEFAULT_PREDICT_MODEL_MODE = PREDICT_MODEL_MODE_TRAINED;

export function normalizePredictModelMode(value) {
  const mode = String(value || '').trim();
  return PREDICT_MODEL_MODES.includes(mode) ? mode : DEFAULT_PREDICT_MODEL_MODE;
}
