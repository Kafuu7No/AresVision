/**
 * AresVision 设计 Token — 颜色常量
 * 所有组件统一从这里引用颜色，方便全局调整
 * 主题感知颜色使用 CSS 变量，accent 色保持固定
 */
const C = {
  bg:          'var(--bg)',
  bgCard:      'var(--bg-card)',
  mars:        '#c75b39',
  marsLight:   '#e8845a',
  blue:        '#4a9eff',
  blueGlow:    'rgba(74,158,255,0.25)',
  ice:         'var(--text)',
  ice80:       'var(--text-80)',
  ice60:       'var(--text-60)',
  ice40:       'var(--text-40)',
  ice30:       'var(--text-30)',
  border:      'var(--border)',
  borderHover: 'var(--border-hover)',
  green:       '#4acfac',
  purple:      '#9c7bea',
};

export default C;
