import ReactDOM from 'react-dom';
import { useSettings } from '../contexts/SettingsContext';
import C from '../constants/colors';
import { useScrollLock } from '../hooks/useScrollLock';

function ConfirmContent({ title, message, confirmLabel, cancelLabel, onConfirm, onCancel, confirmColor }) {
  const { settings } = useSettings();
  const L = settings.theme === 'light';
  useScrollLock();

  const overlayBg  = L ? 'rgba(210,215,235,0.70)' : 'rgba(0,0,8,0.78)';
  const cardBg     = L ? 'rgba(255,255,255,0.97)'  : 'rgba(13,13,28,0.95)';
  const cardBorder = L ? 'rgba(0,0,0,0.09)'        : 'rgba(255,255,255,0.10)';
  const cardShadow = L
    ? '0 12px 36px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)'
    : '0 12px 36px rgba(0,0,0,0.70), 0 2px 8px rgba(0,0,0,0.38)';
  const titleColor = L ? '#000000' : '#ffffff';
  const msgColor   = L ? '#000000' : '#ffffff';
  const cancelBg   = L ? 'rgba(0,0,0,0.07)'     : 'rgba(255,255,255,0.08)';
  const cancelClr  = L ? '#000000' : '#ffffff';
  const color      = confirmColor ?? C.mars;

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0,
        background: overlayBg,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 9800,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overscrollBehavior: 'contain',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 320,
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: 14,
          boxShadow: cardShadow,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          padding: '24px 24px 20px',
        }}
      >
        <div style={{
          fontSize: 15, fontWeight: 700, color: titleColor, marginBottom: 10,
          fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.02em',
        }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: msgColor, marginBottom: 22, lineHeight: 1.65 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 20px', borderRadius: 8,
              background: cancelBg, border: 'none',
              color: cancelClr, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.12s',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 20px', borderRadius: 8,
              background: color, border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmDialog(props) {
  return ReactDOM.createPortal(<ConfirmContent {...props} />, document.body);
}
