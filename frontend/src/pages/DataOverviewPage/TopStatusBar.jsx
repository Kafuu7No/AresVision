import React from 'react';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useDataOverview } from '../../contexts/DataOverviewContext';

export default function TopStatusBar() {
  const t = useT();
  const { globalTimeLs, selectedCoordinate } = useDataOverview();

  const seasonName =
    globalTimeLs < 90  ? t('common.season.spring') || 'Northern Spring' :
    globalTimeLs < 180 ? t('common.season.summer') || 'Northern Summer' :
    globalTimeLs < 270 ? t('common.season.autumn') || 'Northern Autumn' : t('common.season.winter') || 'Northern Winter';

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
        pointerEvents: 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: C.mars, fontSize: '14px' }}>⎈</span>
          <span style={{ color: C.ice, fontSize: '12px', fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, fontWeight: 'bold' }}>ARES VISION</span>
        </div>
        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: C.ice60, fontSize: '10px', fontFamily: "'Exo 2', sans-serif" }}>SOLAR LONGITUDE :</span>
          <span style={{ color: C.mars, fontSize: '12px', fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold' }}>{globalTimeLs}°</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: C.ice60, fontSize: '10px', fontFamily: "'Exo 2', sans-serif" }}>SEASON :</span>
          <span style={{ color: '#4acfac', fontSize: '12px', fontFamily: "'Exo 2', sans-serif", fontWeight: 'bold' }}>{seasonName}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: C.ice60, fontSize: '10px', fontFamily: "'Exo 2', sans-serif" }}>FOCUS :</span>
          <span style={{ color: selectedCoordinate ? C.mars : C.blue, fontSize: '12px', fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold' }}>
            {selectedCoordinate 
              ? `LAT ${selectedCoordinate.lat.toFixed(1)}° / LNG ${selectedCoordinate.lng.toFixed(1)}°`
              : 'GLOBAL VIEW'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: C.ice60, fontSize: '10px', fontFamily: "'Exo 2', sans-serif" }}>ALTITUDE :</span>
          <span style={{ color: C.ice, fontSize: '12px', fontFamily: "'Orbitron', sans-serif" }}>COLUMN AVG</span>
        </div>
      </div>
    </div>
  );
}
