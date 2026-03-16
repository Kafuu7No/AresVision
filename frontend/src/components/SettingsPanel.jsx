import { useEffect, useRef, createContext, useContext } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useT } from '../i18n';
import C from '../constants/colors';

/* ─── 面板内 isLight 上下文 ─── */
const LightCtx = createContext(false);

/* ─── 小工具组件 ─── */

function SectionHeader({ label }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 2.5,
        fontFamily: "'Orbitron', sans-serif",
        color: C.mars,
        textTransform: 'uppercase',
        marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{ height: 1, background: `linear-gradient(to right, ${C.mars}40, transparent)` }} />
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '20px 0' }} />;
}

/** 二选一 / 多选一 pill 按钮组 */
function ChipGroup({ options, value, onChange, cols = 2 }) {
  const isLight = useContext(LightCtx);
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 6,
    }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            title={opt.desc || opt.label}
            style={{
              padding: '7px 10px',
              borderRadius: 6,
              border: active
                ? `1px solid ${C.blue}66`
                : `1px solid var(--border)`,
              background: active
                ? `${C.blue}1a`
                : isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.03)',
              color: active ? C.blue : 'var(--text-60)',
              fontSize: 11,
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.18s',
              textAlign: 'center',
              lineHeight: 1.3,
            }}
          >
            {opt.label}
            {opt.sub && (
              <div style={{ fontSize: 9, color: active ? `${C.blue}aa` : 'var(--text-30)', marginTop: 1 }}>
                {opt.sub}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** 行内标签 + 控件 */
function SettingRow({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--text-60)', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        {children}
      </div>
    </div>
  );
}

/** 紧凑型 pill 切换（用于行内 unit 选择等） */
function InlinePill({ options, value, onChange }) {
  const isLight = useContext(LightCtx);
  return (
    <div style={{
      display: 'flex',
      background: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
      borderRadius: 6, padding: 2, gap: 2,
    }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '4px 10px',
              border: 'none',
              borderRadius: 5,
              background: active ? `${C.blue}33` : 'transparent',
              color: active ? C.blue : 'var(--text-30)',
              fontSize: 11,
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Checkbox */
function Checkbox({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 8 }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          border: checked ? `1px solid ${C.blue}` : `1px solid var(--text-30)`,
          background: checked ? `${C.blue}33` : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.15s',
          cursor: 'pointer',
        }}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke={C.blue} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span style={{ fontSize: 12, color: 'var(--text-60)' }}>{label}</span>
    </label>
  );
}

/* ─── 主组件 ─── */

export default function SettingsPanel({ open, onClose }) {
  const { settings, updateSetting } = useSettings();
  const t = useT();
  const panelRef = useRef(null);
  const isLight = settings.theme === 'light';

  // 点击面板外侧关闭
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    // 延迟绑定，避免与触发按钮的点击事件冲突
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open, onClose]);

  // ESC 关闭
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // 浅色/深色主题对应的 CSS 变量值，覆盖页面级主题
  const panelVars = isLight
    ? {
        '--text':    '#2a2a3a',
        '--text-60': 'rgba(42,42,58,0.65)',
        '--text-30': 'rgba(42,42,58,0.35)',
        '--border':  'rgba(26,26,46,0.12)',
      }
    : {
        '--text':    '#e8edf3',
        '--text-60': 'rgba(232,237,243,0.6)',
        '--text-30': 'rgba(232,237,243,0.3)',
        '--border':  'rgba(232,237,243,0.08)',
      };

  return (
    <LightCtx.Provider value={isLight}>
      {/* 遮罩 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: isLight ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.4)',
          zIndex: 2999,
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.25s',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* 面板主体 */}
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 360,
          zIndex: 3000,
          background: isLight ? 'rgba(248,248,254,0.98)' : 'rgba(8,8,18,0.97)',
          backdropFilter: 'blur(32px)',
          borderLeft: isLight
            ? '1px solid rgba(26,26,46,0.1)'
            : '1px solid rgba(232,237,243,0.1)',
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
          boxShadow: isLight
            ? '-20px 0 60px rgba(0,0,0,0.12)'
            : '-20px 0 60px rgba(0,0,0,0.5)',
          ...panelVars,
        }}
      >
        {/* 面板头部 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          height: 70,
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 3,
              fontFamily: "'Orbitron', sans-serif",
              color: 'var(--text)',
              textTransform: 'uppercase',
            }}>
              {t('settings.titleEn')}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-30)', marginTop: 2 }}>{t('settings.title')}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-60)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = isLight ? 'rgba(26,26,46,0.3)' : C.ice30;
              e.currentTarget.style.color = isLight ? '#2a2a3a' : C.ice;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--text-60)';
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* 可滚动内容区 */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}>

          {/* ── 单位制 ── */}
          <SectionHeader label={t('settings.units.label')} />
          <SettingRow label={t('settings.units.ozone')}>
            <InlinePill
              options={[
                { value: 'um-atm', label: 'μm-atm' },
                { value: 'DU',     label: 'DU' },
              ]}
              value={settings.units.ozone}
              onChange={v => updateSetting('units.ozone', v)}
            />
          </SettingRow>
          <SettingRow label={t('settings.units.temperature')}>
            <InlinePill
              options={[
                { value: 'K', label: 'K' },
                { value: 'C', label: '°C' },
              ]}
              value={settings.units.temperature}
              onChange={v => updateSetting('units.temperature', v)}
            />
          </SettingRow>
          <SettingRow label={t('settings.units.wind')}>
            <InlinePill
              options={[
                { value: 'm/s',  label: 'm/s' },
                { value: 'km/h', label: 'km/h' },
              ]}
              value={settings.units.wind}
              onChange={v => updateSetting('units.wind', v)}
            />
          </SettingRow>
          <SettingRow label={t('settings.units.pressure')}>
            <InlinePill
              options={[
                { value: 'Pa',  label: 'Pa' },
                { value: 'hPa', label: 'hPa' },
              ]}
              value={settings.units.pressure}
              onChange={v => updateSetting('units.pressure', v)}
            />
          </SettingRow>

          <Divider />

          {/* ── 数据精度 ── */}
          <SectionHeader label={t('settings.precision.label')} />
          <p style={{ fontSize: 10, color: 'var(--text-30)', marginBottom: 12, lineHeight: 1.5 }}>
            {t('settings.precision.desc')}
          </p>
          <ChipGroup
            cols={4}
            options={[
              { value: 2,      label: t('settings.precision.opt2') },
              { value: 4,      label: t('settings.precision.opt4') },
              { value: 6,      label: t('settings.precision.opt6') },
              { value: 'full', label: t('settings.precision.optFull') },
            ]}
            value={settings.precision}
            onChange={v => updateSetting('precision', v)}
          />

          <Divider />

          {/* ── 导出偏好 ── */}
          <SectionHeader label={t('settings.export.label')} />
          <p style={{ fontSize: 10, color: 'var(--text-30)', marginBottom: 12, lineHeight: 1.5 }}>
            {t('settings.export.desc')}
          </p>

          <div style={{ fontSize: 11, color: 'var(--text-60)', marginBottom: 6 }}>{t('settings.export.format')}</div>
          <ChipGroup
            cols={3}
            options={[
              { value: 'png', label: t('settings.export.png'), sub: t('settings.export.pngSub') },
              { value: 'svg', label: t('settings.export.svg'), sub: t('settings.export.svgSub') },
              { value: 'pdf', label: t('settings.export.pdf'), sub: t('settings.export.pdfSub') },
            ]}
            value={settings.export.format}
            onChange={v => updateSetting('export.format', v)}
          />

          <div style={{ fontSize: 11, color: 'var(--text-60)', margin: '12px 0 6px' }}>{t('settings.export.dpi')}</div>
          <ChipGroup
            cols={3}
            options={[
              { value: 150, label: '150', sub: t('settings.export.dpi150Sub') },
              { value: 300, label: '300', sub: t('settings.export.dpi300Sub') },
              { value: 600, label: '600', sub: t('settings.export.dpi600Sub') },
            ]}
            value={settings.export.dpi}
            onChange={v => updateSetting('export.dpi', v)}
          />

          <div style={{ fontSize: 11, color: 'var(--text-60)', margin: '12px 0 6px' }}>{t('settings.export.fontSize')}</div>
          <ChipGroup
            cols={3}
            options={[
              { value: 8,  label: '8 pt' },
              { value: 10, label: '10 pt' },
              { value: 12, label: '12 pt' },
            ]}
            value={settings.export.fontSize}
            onChange={v => updateSetting('export.fontSize', v)}
          />

          <div style={{ marginTop: 12 }}>
            <Checkbox
              label={t('settings.export.includeTitle')}
              checked={settings.export.includeTitle}
              onChange={v => updateSetting('export.includeTitle', v)}
            />
          </div>

        </div>

        {/* 面板底部 */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-30)' }}>{t('settings.autoSave')}</span>
          <button
            onClick={() => {
              if (window.confirm(t('settings.resetConfirm'))) {
                localStorage.removeItem('aresvision_settings');
                window.location.reload();
              }
            }}
            style={{
              background: 'transparent',
              border: `1px solid rgba(199,91,57,0.3)`,
              borderRadius: 6,
              padding: '5px 12px',
              color: `${C.mars}cc`,
              fontSize: 11,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = `${C.mars}77`;
              e.currentTarget.style.color = C.mars;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = `rgba(199,91,57,0.3)`;
              e.currentTarget.style.color = `${C.mars}cc`;
            }}
          >
            {t('settings.reset')}
          </button>
        </div>
      </div>
    </LightCtx.Provider>
  );
}
