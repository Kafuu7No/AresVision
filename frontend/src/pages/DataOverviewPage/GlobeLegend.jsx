import React from 'react';
import GlowCard from '../../components/GlowCard';
import C from '../../constants/colors';
import { useSettings } from '../../contexts/SettingsContext';
import { convertOzone, ozoneLabel } from '../../utils/units';
import { makeGradient } from '../../utils/colormaps';
import { useDataOverview } from '../../contexts/DataOverviewContext';

export default function GlobeLegend({ ozoneData }) {
  const { settings } = useSettings();
  const { leftPanelWidth, gestureEnabled } = useDataOverview();
  const ozoneUnit = settings.units.ozone;

  if (!ozoneData || typeof ozoneData.maxVal === 'undefined') return null;

  // Keep this panel compact and avoid overlap with the gesture capture window.
  const panelWidth = gestureEnabled ? 190 : 215;
  const panelBottom = gestureEnabled ? 278 : 100;

  const pointsCount = ozoneData.points?.length || 0;
  const maxVal = convertOzone(ozoneData.maxVal || 0, ozoneUnit).toFixed(3);
  const midVal = convertOzone(((ozoneData.maxVal || 0) + (ozoneData.minVal || 0)) / 2, ozoneUnit).toFixed(3);
  const minVal = convertOzone(ozoneData.minVal || 0, ozoneUnit).toFixed(3);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: `${panelBottom}px`,
        left: `${leftPanelWidth + 20}px`,
        width: `${panelWidth}px`,
        zIndex: 1000,
        pointerEvents: 'none',
        transition: 'bottom 0.2s ease, width 0.2s ease',
      }}
    >
      <GlowCard style={{ padding: '12px', background: 'rgba(10, 14, 23, 0.5)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            paddingBottom: '6px',
          }}
        >
          <span style={{ color: C.ice60, fontSize: '9px', fontFamily: "'Exo 2', sans-serif", letterSpacing: 1 }}>
            DATA POINTS
          </span>
          <span style={{ color: C.mars, fontSize: '12px', fontFamily: "'Orbitron', sans-serif", fontWeight: 'bold' }}>
            {pointsCount}
          </span>
        </div>

        <div
          style={{
            color: C.ice30,
            fontSize: '8px',
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: 1,
            marginBottom: '6px',
          }}
        >
          O3 CONCENTRATION ({ozoneLabel(ozoneUnit)})
        </div>

        <div style={{ display: 'flex', alignItems: 'stretch', gap: '10px', height: '64px' }}>
          <div
            style={{
              width: '10px',
              flexShrink: 0,
              borderRadius: '5px',
              border: `1px solid ${C.border}`,
              background: makeGradient(settings.colormap),
            }}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              fontSize: '10px',
              color: C.ice,
              fontFamily: "'Exo 2', sans-serif",
              fontWeight: 'bold',
            }}
          >
            <span>{maxVal}</span>
            <span style={{ color: C.ice60 }}>{midVal}</span>
            <span>{minVal}</span>
          </div>
        </div>
      </GlowCard>
    </div>
  );
}
