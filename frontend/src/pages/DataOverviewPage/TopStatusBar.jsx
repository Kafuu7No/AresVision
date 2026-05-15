import React from 'react';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useSettings } from '../../contexts/SettingsContext';
import { useDataOverview } from '../../contexts/DataOverviewContext';

export default function TopStatusBar() {
  const t = useT();
  const { settings } = useSettings();
  const isLight = settings?.theme === 'light';
  const isZh = settings?.language !== 'en';
  const { globalTimeLs, selectedCoordinate, dataSourceMode, sourceMeta } = useDataOverview();

  const seasonName =
    globalTimeLs < 90 ? t('common.season.spring') || (isZh ? '北半球春季' : 'Northern Spring')
      : globalTimeLs < 180 ? t('common.season.summer') || (isZh ? '北半球夏季' : 'Northern Summer')
        : globalTimeLs < 270 ? t('common.season.autumn') || (isZh ? '北半球秋季' : 'Northern Autumn')
          : t('common.season.winter') || (isZh ? '北半球冬季' : 'Northern Winter');

  const sourceLabel = (() => {
    const mode = sourceMeta?.effective_source;
    if (mode === 'personal_full_year') return isZh ? '个人数据源' : 'PERSONAL';
    if (mode === 'personal_mcd_plus_system_openmars') return isZh ? '个人MCD+系统OpenMARS' : 'HYBRID';
    return isZh ? '系统默认' : 'DEFAULT';
  })();
  const isEffectivePersonal =
    sourceMeta?.effective_source === 'personal_full_year' ||
    sourceMeta?.effective_source === 'personal_mcd_plus_system_openmars';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '40px',
        background: isLight
          ? 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.35) 65%, rgba(255,255,255,0) 100%)'
          : 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
        backdropFilter: 'blur(10px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        borderBottom: isLight ? '1px solid rgba(15,23,42,0.12)' : '1px solid rgba(255,255,255,0.05)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: C.mars, fontSize: 'calc(14px * var(--font-scale, 1))' }}>●</span>
          <span style={{ color: C.ice, fontSize: 'calc(12px * var(--font-scale, 1))', fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, fontWeight: 'bold' }}>ARES VISION</span>
        </div>
        <div style={{ width: 1, height: 16, background: isLight ? 'rgba(15,23,42,0.2)' : 'rgba(255,255,255,0.2)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: C.ice60, fontSize: 'calc(10px * var(--font-scale, 1))', fontFamily: "'Exo 2', sans-serif" }}>
            {isZh ? '太阳黄经:' : 'SOLAR LONGITUDE:'}
          </span>
          <span style={{ color: C.mars, fontSize: 'calc(12px * var(--font-scale, 1))', fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold' }}>
            {globalTimeLs}°
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: C.ice60, fontSize: 'calc(10px * var(--font-scale, 1))', fontFamily: "'Exo 2', sans-serif" }}>
            {isZh ? '季节:' : 'SEASON:'}
          </span>
          <span style={{ color: '#4acfac', fontSize: 'calc(12px * var(--font-scale, 1))', fontFamily: "'Exo 2', sans-serif", fontWeight: 'bold' }}>
            {seasonName}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: C.ice60, fontSize: 'calc(10px * var(--font-scale, 1))', fontFamily: "'Exo 2', sans-serif" }}>
            {isZh ? '焦点:' : 'FOCUS:'}
          </span>
          <span style={{ color: selectedCoordinate ? C.mars : C.blue, fontSize: 'calc(12px * var(--font-scale, 1))', fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold' }}>
            {selectedCoordinate
              ? `LAT ${selectedCoordinate.lat.toFixed(1)}° / LNG ${selectedCoordinate.lng.toFixed(1)}°`
              : (isZh ? '全球视图' : 'GLOBAL VIEW')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: C.ice60, fontSize: 'calc(10px * var(--font-scale, 1))', fontFamily: "'Exo 2', sans-serif" }}>
            {isZh ? '高度:' : 'ALTITUDE:'}
          </span>
          <span style={{ color: C.ice, fontSize: 'calc(12px * var(--font-scale, 1))', fontFamily: "'Orbitron', sans-serif" }}>
            {isZh ? '柱平均' : 'COLUMN AVG'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: C.ice60, fontSize: 'calc(10px * var(--font-scale, 1))', fontFamily: "'Exo 2', sans-serif" }}>
            {isZh ? '数据源:' : 'SOURCE:'}
          </span>
          <span style={{ color: isEffectivePersonal ? C.blue : C.ice, fontSize: 'calc(12px * var(--font-scale, 1))', fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold' }}>
            {sourceLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
