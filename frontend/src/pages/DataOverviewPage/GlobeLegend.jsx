import React from 'react';
import GlowCard from '../../components/GlowCard';
import C from '../../constants/colors';
import { useSettings } from '../../contexts/SettingsContext';
import { convertOzone, ozoneLabel } from '../../utils/units';
import { makeGradient } from '../../utils/colormaps';
import { useT } from '../../i18n';

export default function GlobeLegend({ ozoneData }) {
  const { settings } = useSettings();
  const t = useT();
  const ozoneUnit = settings.units.ozone;

  if (!ozoneData || typeof ozoneData.maxVal === 'undefined') return null;

  const pointsCount = ozoneData.points?.length || 0;
  const maxVal = convertOzone(ozoneData.maxVal || 0, ozoneUnit).toFixed(3);
  const midVal = convertOzone(((ozoneData.maxVal || 0) + (ozoneData.minVal || 0)) / 2, ozoneUnit).toFixed(3);
  const minVal = convertOzone(ozoneData.minVal || 0, ozoneUnit).toFixed(3);

  return (
    <div style={{
      position: 'fixed',
      bottom: '100px', // above TimelineController
      left: '300px',   // right of SidebarMenu
      width: '240px',
      zIndex: 1000,
      pointerEvents: 'none',
    }}>
      <GlowCard style={{ padding: '16px', background: 'rgba(10, 14, 23, 0.6)' }}>
        
        {/* 数据散点数 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: `1px solid rgba(255,255,255,0.05)`, paddingBottom: '8px' }}>
          <span style={{ color: C.ice60, fontSize: '10px', fontFamily: "'Exo 2', sans-serif", letterSpacing: 1 }}>DATA POINTS</span>
          <span style={{ color: C.mars, fontSize: '14px', fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold' }}>{pointsCount}</span>
        </div>

        {/* 臭氧浓度色阶图例 */}
        <div style={{ color: C.ice30, fontSize: '9px', fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, marginBottom: '8px' }}>
          O₃ CONCENTRATION ({ozoneLabel(ozoneUnit)})
        </div>
        
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '12px', height: '80px' }}>
          <div style={{
            width: '12px', flexShrink: 0, borderRadius: '6px',
            border: `1px solid ${C.border}`,
            background: makeGradient(settings.colormap),
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '11px', color: C.ice, fontFamily: "'Exo 2', sans-serif", fontWeight: 'bold' }}>
            <span>{maxVal}</span>
            <span style={{ color: C.ice60 }}>{midVal}</span>
            <span>{minVal}</span>
          </div>
        </div>

      </GlowCard>
    </div>
  );
}
