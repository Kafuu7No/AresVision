/**
 * NotificationPanel — 通知右侧抽屉
 * 显示当前用户的通知列表，支持单条/全部已读
 */

import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useSettings } from '../contexts/SettingsContext';
import { useScrollLock } from '../hooks/useScrollLock';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../services/api';

// ─── Icons ────────────────────────────────────────────────────────────────────

function BellIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function CheckIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CloseIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function BellEmptyIcon({ size = 44, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(isoStr, t) {
  const utc = isoStr.endsWith('Z') ? isoStr : isoStr + 'Z';
  const diff = Date.now() - new Date(utc).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('notification.justNow');
  if (mins < 60) return t('notification.minutesAgo', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('notification.hoursAgo', { n: hours });
  const days = Math.floor(hours / 24);
  return t('notification.daysAgo', { n: days });
}

function typeIcon(type) {
  if (type === 'approved') return { icon: '✓', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.30)' };
  if (type === 'rejected') return { icon: '✕', color: C.mars,    bg: 'rgba(199,91,57,0.12)', border: 'rgba(199,91,57,0.30)' };
  return { icon: '⚠', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.30)' };
}

// ─── NotificationCard ─────────────────────────────────────────────────────────

function NotificationCard({ notif, t, isLight, onMarkRead }) {
  const { icon, color, bg, border } = typeIcon(notif.type);
  const cardBg = 'var(--bg-muted)';
  const cardBorder = notif.is_read
    ? 'var(--border)'
    : C.blue;

  return (
    <div style={{
      background: cardBg,
      border: `1px solid ${cardBorder}`,
      borderLeft: `3px solid ${notif.is_read ? 'var(--border)' : C.blue}`,
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex', gap: 12, alignItems: 'flex-start',
      opacity: notif.is_read ? 0.72 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* Type badge */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: bg, border: `1px solid ${border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: 'calc(12px * var(--font-scale, 1))', fontWeight: 700, color,
      }}>
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'calc(12px * var(--font-scale, 1))', fontWeight: notif.is_read ? 500 : 700,
          color: 'var(--text)', marginBottom: 3,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {notif.title}
        </div>
        {notif.content && (
          <div style={{
            fontSize: 'calc(11px * var(--font-scale, 1))', color: 'var(--text-60)', lineHeight: 1.55, marginBottom: 5,
          }}>
            {notif.content}
          </div>
        )}
        <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: 'var(--text-30)' }}>
          {relativeTime(notif.created_at, t)}
        </div>
      </div>

      {/* Mark read button (only for unread) */}
        {!notif.is_read && (
          <button
            onClick={() => onMarkRead(notif.id)}
            title={t('notification.markAllRead')}
            style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-30)', padding: 2, flexShrink: 0,
            display: 'flex', alignItems: 'center',
          }}
        >
          <CheckIcon size={14} color="currentColor" />
        </button>
      )}
    </div>
  );
}

// ─── Panel Content ─────────────────────────────────────────────────────────────

function PanelContent({ t, isLight, onClose, onReadCountChange }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const titleColor  = 'var(--text)';
  const subColor    = 'var(--text-60)';
  const borderColor = 'var(--border)';
  const hoverBg     = 'var(--bg-muted)';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = useCallback(async (id) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      onReadCountChange?.();
    } catch {
      // 静默失败
    }
  }, [onReadCountChange]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      onReadCountChange?.();
    } catch {
      // 静默失败
    }
  }, [onReadCountChange]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

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
            fontSize: 'calc(15px * var(--font-scale, 1))',
            fontWeight: 700,
            color: titleColor,
            fontFamily: 'var(--font-display)',
          }}>
            {t('notification.title')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              style={{
                background: 'none', border: `1px solid ${borderColor}`,
                borderRadius: 7, padding: '5px 10px', cursor: 'pointer',
                color: subColor, fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 500,
                fontFamily: 'inherit', transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = hoverBg}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              {t('notification.markAllRead')}
            </button>
          )}
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading && (
          <div style={{ textAlign: 'center', color: subColor, paddingTop: 60, fontSize: 'calc(13px * var(--font-scale, 1))' }}>
            {t('common.loading')}
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 14, paddingTop: 60, textAlign: 'center',
          }}>
            <div style={{ color: subColor, opacity: 0.5 }}>
              <BellEmptyIcon size={48} color="currentColor" />
            </div>
            <div style={{ fontSize: 'calc(14px * var(--font-scale, 1))', fontWeight: 700, color: titleColor, fontFamily: 'var(--font-display)' }}>
              {t('notification.empty')}
            </div>
            <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: subColor }}>{t('notification.emptySub')}</div>
          </div>
        )}

        {!loading && notifications.map(notif => (
          <NotificationCard
            key={notif.id}
            notif={notif}
            t={t}
            isLight={isLight}
            onMarkRead={handleMarkRead}
          />
        ))}
      </div>
    </>
  );
}

// ─── Panel Wrapper ────────────────────────────────────────────────────────────

function NotificationPanelInner({ open, onClose, onReadCountChange }) {
  const { settings } = useSettings();
  const t = useT();
  const isLight = settings.theme === 'light';
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
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
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 420,
          zIndex: 3000,
          background: 'var(--bg-card-strong)',
          backdropFilter: 'blur(18px)',
          borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
          boxShadow: isLight ? '-20px 0 60px rgba(15,23,42,0.10)' : '-20px 0 60px rgba(0,0,0,0.32)',
        }}
      >
        {open && (
          <PanelContent
            t={t}
            isLight={isLight}
            onClose={onClose}
            onReadCountChange={onReadCountChange}
          />
        )}
      </div>
    </>
  );
}

export default function NotificationPanel({ open, onClose, onReadCountChange }) {
  return ReactDOM.createPortal(
    <NotificationPanelInner open={open} onClose={onClose} onReadCountChange={onReadCountChange} />,
    document.body
  );
}
