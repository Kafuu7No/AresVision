import React from 'react';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useSettings } from '../../contexts/SettingsContext';
import { useDataOverview } from '../../contexts/DataOverviewContext';

export default function TopStatusBar() {
  const t = useT();
  const { settings } = useSettings();
  const isZh = settings?.language !== 'en';
  const { globalTimeLs, selectedCoordinate } = useDataOverview();

  const seasonName =
    globalTimeLs < 90 ? t('common.season.spring') || (isZh ? '北半球春季' : 'Northern Spring') :
    globalTimeLs < 180 ? t('common.season.summer') || (isZh ? '北半球夏季' : 'Northern Summer') :
    globalTimeLs < 270 ? t('common.season.autumn') || (isZh ? '北半球秋季' : 'Northern Autumn') :
    t('common.season.winter') || (isZh ? '北半球冬季' : 'Northern Winter');

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '40px',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
        backdropFilter: 'blur(10px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: C.mars, fontSize: 14 }}>⦿</span>
          <span style={{ color: C.ice, fontSize: 12, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, fontWeight: 'bold' }}>ARES VISION</span>
        </div>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: C.ice60, fontSize: 10, fontFamily: "'Exo 2', sans-serif" }}>
            {isZh ? '太阳黄经：' : 'SOLAR LONGITUDE:'}
          </span>
          <span style={{ color: C.mars, fontSize: 12, fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold' }}>
            {globalTimeLs}°
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: C.ice60, fontSize: 10, fontFamily: "'Exo 2', sans-serif" }}>
            {isZh ? '季节：' : 'SEASON:'}
          </span>
          <span style={{ color: '#4acfac', fontSize: 12, fontFamily: "'Exo 2', sans-serif", fontWeight: 'bold' }}>
            {seasonName}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: C.ice60, fontSize: 10, fontFamily: "'Exo 2', sans-serif" }}>
            {isZh ? '焦点：' : 'FOCUS:'}
          </span>
          <span style={{ color: selectedCoordinate ? C.mars : C.blue, fontSize: 12, fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold' }}>
            {selectedCoordinate
              ? `LAT ${selectedCoordinate.lat.toFixed(1)}° / LNG ${selectedCoordinate.lng.toFixed(1)}°`
              : (isZh ? '全球视图' : 'GLOBAL VIEW')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: C.ice60, fontSize: 10, fontFamily: "'Exo 2', sans-serif" }}>
            {isZh ? '高度：' : 'ALTITUDE:'}
          </span>
          <span style={{ color: C.ice, fontSize: 12, fontFamily: "'Orbitron', sans-serif" }}>
            {isZh ? '柱平均' : 'COLUMN AVG'}
          </span>
        </div>
      </div>
    </div>
  );
}
