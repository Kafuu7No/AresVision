import C from '../../constants/colors'; // Re-triggering vite cache
import { useT } from '../../i18n';

export function LoadingBox({ h = 200, label }) {
  const t = useT();
  const displayLabel = label ?? t('common.loading');
  return (
    <div style={{
      height: h, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.02)', borderRadius: 12,
    }}>
      <div style={{
        width: 28, height: 28, border: `3px solid ${C.border}`,
        borderTop: `3px solid ${C.mars}`, borderRadius: '50%',
        animation: 'spin-slow 1s linear infinite',
      }} />
      <div style={{ marginTop: 12, fontSize: 12, color: C.ice30 }}>{displayLabel}</div>
    </div>
  );
}

export function InsightBlock({ text }) {
  if (!text) return null;
  return (
    <div style={{
      marginTop: 12,
      background: 'rgba(199,91,57,0.06)',
      borderLeft: '3px solid rgba(199,91,57,0.4)',
      borderRadius: 8,
      padding: '12px 16px',
      fontSize: 12,
      color: C.ice60,
      lineHeight: 1.7,
    }}>
      {text}
    </div>
  );
}
