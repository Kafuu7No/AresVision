export const VARIABLE_DEFS = [
  { id: 'Temperature',        icon: '🌡',  color: '#ff6b4a' },
  { id: 'Dust_Optical_Depth', icon: '🌫',  color: '#d4a06a' },
  { id: 'Solar_Flux_DN',      icon: '☀️', color: '#ffd740' },
  { id: 'U_Wind',             icon: '💨',  color: '#4a9eff' },
  { id: 'V_Wind',             icon: '🌬',  color: '#7c5cbf' },
];

export const METRIC_META = [
  { key: 'rmse', name: 'RMSE', unit: 'μm-atm', better: '↓', color: '#ff6b4a' },
  { key: 'mae', name: 'MAE', unit: 'μm-atm', better: '↓', color: '#ff6b4a' },
  { key: 'ssim', name: 'SSIM', unit: '', better: '↑', color: '#4acfac' },
  { key: 'r2', name: 'R²', unit: '', better: '↑', color: '#4acfac' },
];

export const VIEW_MODE_IDS = ['triptych', 'original', 'prediction', 'diff'];

export const TRIPTYCH_PANEL_DEFS = [
  { key: 'truth',      color: '#4a9eff', mode: 'inferno' },
  { key: 'prediction', color: '#c75b39', mode: 'inferno' },
  { key: 'residual',   color: '#9c7bea', mode: 'rdbu' },
];
