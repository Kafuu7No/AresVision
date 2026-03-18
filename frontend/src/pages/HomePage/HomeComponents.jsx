import C from '../../constants/colors';

// ─── 图标组件 ───

export function IconGlobe({ color = C.mars, size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <circle cx="16" cy="16" r="12" />
      <ellipse cx="16" cy="16" rx="5.5" ry="12" />
      <line x1="4.5" y1="16" x2="27.5" y2="16" />
      <path d="M6 10 Q16 12 26 10" />
      <path d="M6 22 Q16 20 26 22" />
    </svg>
  );
}

export function IconCpu({ color = C.blue, size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round">
      <rect x="9" y="9" width="14" height="14" rx="2" />
      <rect x="12.5" y="12.5" width="7" height="7" rx="1" />
      <line x1="12" y1="9" x2="12" y2="5.5" /><line x1="16" y1="9" x2="16" y2="5.5" /><line x1="20" y1="9" x2="20" y2="5.5" />
      <line x1="12" y1="23" x2="12" y2="26.5" /><line x1="16" y1="23" x2="16" y2="26.5" /><line x1="20" y1="23" x2="20" y2="26.5" />
      <line x1="9" y1="12" x2="5.5" y2="12" /><line x1="9" y1="16" x2="5.5" y2="16" /><line x1="9" y1="20" x2="5.5" y2="20" />
      <line x1="23" y1="12" x2="26.5" y2="12" /><line x1="23" y1="16" x2="26.5" y2="16" /><line x1="23" y1="20" x2="26.5" y2="20" />
    </svg>
  );
}

export function IconChart({ color = C.mars, size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="27" x2="27" y2="27" />
      <line x1="5" y1="5" x2="5" y2="27" />
      <polyline points="5,22 10,15 15,18 20,10 27,6" />
      <circle cx="10" cy="15" r="1.5" fill={color} />
      <circle cx="15" cy="18" r="1.5" fill={color} />
      <circle cx="20" cy="10" r="1.5" fill={color} />
      <circle cx="27" cy="6"  r="1.5" fill={color} />
    </svg>
  );
}

export function IconMessage({ color = C.blue, size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6 Q4 4 6 4 L26 4 Q28 4 28 6 L28 20 Q28 22 26 22 L12 22 L6 28 L6 22 Q4 22 4 20 Z" />
      <line x1="9" y1="11" x2="23" y2="11" />
      <line x1="9" y1="16" x2="18" y2="16" />
    </svg>
  );
}

export function IconWrapper({ children, accent = C.mars }) {
  return (
    <div style={{
      width: 58, height: 58, borderRadius: 16,
      background: `rgba(${accent === C.mars ? '199,91,57' : '74,158,255'},0.08)`,
      border: `1px solid rgba(${accent === C.mars ? '199,91,57' : '74,158,255'},0.18)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 16px',
    }}>
      {children}
    </div>
  );
}
