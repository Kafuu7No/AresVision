/**
 * ContributeHistoryPanel — 贡献记录右侧抽屉
 * 显示当前用户所有 is_public=true 的上传记录及其审核状态
 */

import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useSettings } from '../contexts/SettingsContext';
import { useToast } from '../contexts/ToastContext';
import { useScrollLock } from '../hooks/useScrollLock';
import { getMyUploads } from '../services/api';

// ─── Icons ────────────────────────────────────────────────────────────────────

function RefreshIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function CloseIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function InboxIcon({ size = 44, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function FileIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '—';
  return iso.replace('T', ' ').slice(0, 16);
}

// ─── StatusBlock ──────────────────────────────────────────────────────────────

function StatusBlock({ record, t, isLight }) {
  const dotClr = {
    pending_review: '#f59e0b',
    approved:       '#22c55e',
    rejected:       C.mars,
  }[record.status] ?? C.ice30;

  const textClr = {
    pending_review: '#f59e0b',
    approved:       '#22c55e',
    rejected:       C.mars,
  }[record.status] ?? (isLight ? 'rgba(42,42,58,0.55)' : 'rgba(232,237,243,0.50)');

  const statusText = {
    pending_review: t('explore.contributeHistory.statusPending'),
    approved:       t('explore.contributeHistory.statusApproved'),
    rejected:       t('explore.contributeHistory.statusRejected'),
  }[record.status] ?? record.status;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: dotClr, flexShrink: 0, display: 'inline-block',
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: textClr }}>
          {statusText}
        </span>
      </div>
      {record.status === 'rejected' && record.validation_message && (
        <div style={{
          fontSize: 11, color: isLight ? 'rgba(42,42,58,0.55)' : 'rgba(232,237,243,0.50)',
          paddingLeft: 14, lineHeight: 1.55,
        }}>
          <span style={{ fontWeight: 600 }}>{t('explore.contributeHistory.rejectedReason')}：</span>
          {record.validation_message}
        </div>
      )}
    </div>
  );
}

// ─── HistoryCard ──────────────────────────────────────────────────────────────

function HistoryCard({ record, t, isLight }) {
  const cardBg    = isLight ? 'rgba(248,248,254,0.9)' : 'rgba(16,16,32,0.7)';
  const cardBorder = isLight ? 'rgba(0,0,0,0.09)'     : 'rgba(255,255,255,0.09)';
  const nameClr   = isLight ? '#1e1e30'               : '#e8edf3';
  const dimClr    = isLight ? 'rgba(42,42,58,0.40)'   : 'rgba(232,237,243,0.35)';

  return (
    <div style={{
      background: cardBg, border: `1px solid ${cardBorder}`,
      borderRadius: 12, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Filename */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ color: dimClr, flexShrink: 0 }}>
          <FileIcon size={14} color="currentColor" />
        </span>
        <span style={{
          fontSize: 13, fontWeight: 700, color: nameClr,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }} title={record.filename}>
          {record.filename}
        </span>
      </div>

      {/* Submitted at */}
      <div style={{ fontSize: 11, color: dimClr }}>
        {t('explore.contributeHistory.submittedAt')}: <span style={{ fontWeight: 500 }}>{formatDate(record.created_at)}</span>
      </div>

      {/* Status */}
      <StatusBlock record={record} t={t} isLight={isLight} />
    </div>
  );
}

// ─── Panel Content ────────────────────────────────────────────────────────────

function PanelContent({ t, isLight, onClose }) {
  const { showToast } = useToast();
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(false);

  const titleColor  = isLight ? '#1e1e30'              : '#e8edf3';
  const subColor    = isLight ? 'rgba(42,42,58,0.45)'  : 'rgba(232,237,243,0.40)';
  const borderColor = isLight ? 'rgba(0,0,0,0.09)'     : 'rgba(255,255,255,0.09)';
  const hoverBg     = isLight ? 'rgba(0,0,0,0.04)'     : 'rgba(255,255,255,0.06)';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyUploads();
      // filter to only contributed records (is_public = true)
      const contributed = Array.isArray(data) ? data.filter(r => r.is_public) : [];
      setRecords(contributed);
    } catch {
      showToast(t('admin.errorLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 70,
        borderBottom: `1px solid ${borderColor}`, flexShrink: 0,
      }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2.5,
            fontFamily: "'Orbitron', sans-serif",
            color: C.blue, textTransform: 'uppercase', marginBottom: 3,
          }}>
            {t('explore.contributeHistory.subtitle')}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: titleColor, fontFamily: "'Orbitron', sans-serif" }}>
            {t('explore.contributeHistory.title')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={load}
            title={t('explore.contributeHistory.refresh')}
            style={{
              background: 'none', border: `1px solid ${borderColor}`,
              borderRadius: 7, padding: '5px 8px', cursor: 'pointer',
              color: subColor, display: 'flex', alignItems: 'center',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = hoverBg}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <RefreshIcon size={14} color="currentColor" />
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: `1px solid ${borderColor}`,
              borderRadius: 7, padding: '5px 8px', cursor: 'pointer',
              color: subColor, display: 'flex', alignItems: 'center',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = hoverBg}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <CloseIcon size={14} color="currentColor" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {loading && (
          <div style={{ textAlign: 'center', color: subColor, paddingTop: 60, fontSize: 13 }}>
            {t('explore.contributeHistory.loading')}
          </div>
        )}

        {!loading && records.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 14, paddingTop: 60, textAlign: 'center',
          }}>
            <div style={{ color: subColor, opacity: 0.5 }}>
              <InboxIcon size={48} color="currentColor" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: titleColor, fontFamily: "'Orbitron', sans-serif" }}>
              {t('explore.contributeHistory.empty')}
            </div>
            <div style={{ fontSize: 12, color: subColor }}>
              {t('explore.contributeHistory.emptySub')}
            </div>
          </div>
        )}

        {!loading && records.map(record => (
          <HistoryCard key={record.id} record={record} t={t} isLight={isLight} />
        ))}
      </div>
    </>
  );
}

// ─── Panel Wrapper ────────────────────────────────────────────────────────────

function ContributeHistoryPanelInner({ open, onClose }) {
  const { settings } = useSettings();
  const t = useT();
  const isLight = settings.theme === 'light';
  useScrollLock(open);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const panelVars = isLight
    ? { '--text': '#2a2a3a', '--text-60': 'rgba(42,42,58,0.65)', '--text-30': 'rgba(42,42,58,0.35)', '--border': 'rgba(26,26,46,0.12)' }
    : { '--text': '#e8edf3', '--text-60': 'rgba(232,237,243,0.6)',  '--text-30': 'rgba(232,237,243,0.3)',  '--border': 'rgba(232,237,243,0.08)' };

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: isLight ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.4)',
          zIndex: 2999,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
          zIndex: 3000,
          background: isLight ? 'rgba(248,248,254,0.98)' : 'rgba(8,8,18,0.97)',
          backdropFilter: 'blur(32px)',
          borderLeft: isLight ? '1px solid rgba(26,26,46,0.1)' : '1px solid rgba(232,237,243,0.1)',
          display: 'flex', flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
          boxShadow: isLight ? '-20px 0 60px rgba(0,0,0,0.12)' : '-20px 0 60px rgba(0,0,0,0.5)',
          ...panelVars,
        }}
      >
        {open && <PanelContent t={t} isLight={isLight} onClose={onClose} />}
      </div>
    </>
  );
}

export default function ContributeHistoryPanel({ open, onClose }) {
  return ReactDOM.createPortal(
    <ContributeHistoryPanelInner open={open} onClose={onClose} />,
    document.body
  );
}
