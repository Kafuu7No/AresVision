import React from 'react';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useSettings } from '../../contexts/SettingsContext';
import { useDataOverview } from '../../contexts/DataOverviewContext';

function StatusItem({ label, value, valueColor = C.ice }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        borderRadius: 999,
        background: C.bgMuted,
        border: `1px solid ${C.border}`,
        minWidth: 0,
      }}
    >
      <span
        style={{
          color: C.ice50,
          fontSize: 'calc(10px * var(--font-scale, 1))',
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: valueColor,
          fontSize: 'calc(11px * var(--font-scale, 1))',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function TopStatusBar() {
  const t = useT();
  const { settings } = useSettings();
  const isLight = settings?.theme === 'light';
  const isZh = settings?.language !== 'en';
  const { globalTimeLs, selectedCoordinate, sourceMeta } = useDataOverview();

  const seasonName =
    globalTimeLs < 90 ? t('common.season.spring') || (isZh ? '北半球春季' : 'Northern spring')
      : globalTimeLs < 180 ? t('common.season.summer') || (isZh ? '北半球夏季' : 'Northern summer')
        : globalTimeLs < 270 ? t('common.season.autumn') || (isZh ? '北半球秋季' : 'Northern autumn')
          : t('common.season.winter') || (isZh ? '北半球冬季' : 'Northern winter');

  const sourceLabel = (() => {
    const mode = sourceMeta?.effective_source;
    if (mode === 'personal_full_year') return isZh ? '个人数据' : 'Personal';
    if (mode === 'personal_mcd_plus_system_openmars') return isZh ? '混合数据' : 'Hybrid';
    return isZh ? '系统默认' : 'Default';
  })();

  const isEffectivePersonal =
    sourceMeta?.effective_source === 'personal_full_year' ||
    sourceMeta?.effective_source === 'personal_mcd_plus_system_openmars';

  const focusValue = selectedCoordinate
    ? `${selectedCoordinate.lat.toFixed(1)}°, ${selectedCoordinate.lng.toFixed(1)}°`
    : (isZh ? '全球视图' : 'Global view');

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        background: isLight
          ? 'linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(255,255,255,0.76) 72%, rgba(255,255,255,0.22) 100%)'
          : 'linear-gradient(180deg, rgba(10,14,20,0.92) 0%, rgba(10,14,20,0.74) 72%, rgba(10,14,20,0.18) 100%)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '0 20px',
        borderBottom: `1px solid ${isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)'}`,
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderRadius: 999,
            background: C.bgMuted,
            border: `1px solid ${C.border}`,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: C.mars,
              boxShadow: isLight ? 'none' : '0 0 0 4px rgba(199,91,57,0.12)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              color: C.ice,
              fontSize: 'calc(12px * var(--font-scale, 1))',
              fontWeight: 800,
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.01em',
            }}
          >
            AresVision
          </span>
        </div>

        <StatusItem
          label={isZh ? '太阳黄经' : 'Solar longitude'}
          value={`${globalTimeLs}°`}
          valueColor={C.mars}
        />

        <StatusItem
          label={isZh ? '季节' : 'Season'}
          value={seasonName}
          valueColor={C.green}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <StatusItem
          label={isZh ? '焦点' : 'Focus'}
          value={focusValue}
          valueColor={selectedCoordinate ? C.mars : C.blue}
        />

        <StatusItem
          label={isZh ? '高度' : 'Altitude'}
          value={isZh ? '柱平均' : 'Column average'}
        />

        <StatusItem
          label={isZh ? '数据源' : 'Source'}
          value={sourceLabel}
          valueColor={isEffectivePersonal ? C.blue : C.ice}
        />
      </div>
    </div>
  );
}
