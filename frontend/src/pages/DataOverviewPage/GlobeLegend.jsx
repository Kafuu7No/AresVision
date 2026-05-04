import React from 'react';
import GlowCard from '../../components/GlowCard';
import C from '../../constants/colors';
import { useSettings } from '../../contexts/SettingsContext';
import { convertOzone, ozoneLabel, convertTemp, tempLabel, convertWind, windLabel } from '../../utils/units';
import { getRgb } from '../../utils/colormaps';
import { useDataOverview } from '../../contexts/DataOverviewContext';
import { getGlobeVariableMeta } from '../../constants/globeVariables';

function convertByVariable(value, variable, units) {
  if (!Number.isFinite(value)) return value;
  if (variable === 'o3col') return convertOzone(value, units.ozone);
  if (variable === 'Temperature') return convertTemp(value, units.temperature);
  if (variable === 'U_Wind' || variable === 'V_Wind') return convertWind(value, units.wind);
  return value;
}

function unitLabelByVariable(variable, units) {
  if (variable === 'o3col') return ozoneLabel(units.ozone);
  if (variable === 'Temperature') return tempLabel(units.temperature);
  if (variable === 'U_Wind' || variable === 'V_Wind') return windLabel(units.wind);
  if (variable === 'Dust_Optical_Depth') return 'tau';
  if (variable === 'Solar_Flux_DN') return 'W/m²';
  return '';
}

export default function GlobeLegend({ ozoneData }) {
  const { settings } = useSettings();
  const isLight = settings?.theme === 'light';
  const isZh = settings?.language !== 'en';
  const { leftPanelWidth, gestureEnabled } = useDataOverview();
  const variable = ozoneData?.variable || 'o3col';
  const varMeta = getGlobeVariableMeta(variable);
  const varLabel = settings?.language === 'en' ? varMeta.en : varMeta.zh;
  const unitLabel = unitLabelByVariable(variable, settings.units);

  if (!ozoneData || typeof ozoneData.maxVal === 'undefined') return null;

  // Compact legend and lift it above the bottom timeline area.
  const panelWidth = gestureEnabled ? 172 : 186;
  const panelBottom = gestureEnabled ? 278 : 120;

  const pointsCount = ozoneData.points?.length || 0;
  const maxVal = convertByVariable(ozoneData.maxVal || 0, variable, settings.units).toFixed(3);
  const midVal = convertByVariable(((ozoneData.maxVal || 0) + (ozoneData.minVal || 0)) / 2, variable, settings.units).toFixed(3);
  const minVal = convertByVariable(ozoneData.minVal || 0, variable, settings.units).toFixed(3);
  const horizontalGradient = (() => {
    const n = 10;
    const pts = Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1); // low -> high (left -> right)
      const [r, g, b] = getRgb(settings.colormap, t);
      return `rgb(${r},${g},${b}) ${(i / (n - 1) * 100).toFixed(0)}%`;
    });
    return `linear-gradient(90deg, ${pts.join(', ')})`;
  })();

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
      <GlowCard style={{ padding: '10px', background: isLight ? 'rgba(255,255,255,0.84)' : 'rgba(10, 14, 23, 0.5)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px',
            borderBottom: `1px solid ${C.border}`,
            paddingBottom: '5px',
          }}
        >
          <span style={{ color: C.ice60, fontSize: '9px', fontFamily: "'Exo 2', sans-serif", letterSpacing: 1 }}>
            {isZh ? '数据点' : 'DATA POINTS'}
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
            marginBottom: '7px',
          }}
        >
          {varLabel} ({unitLabel})
        </div>

        <div>
          <div
            style={{
              height: '10px',
              borderRadius: '999px',
              border: `1px solid ${C.border}`,
              background: horizontalGradient,
              marginBottom: '6px',
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '9px',
              color: C.ice,
              fontFamily: "'Exo 2', sans-serif",
              fontWeight: 'bold',
            }}
          >
            <span>{minVal}</span>
            <span style={{ color: C.ice60 }}>{midVal}</span>
            <span>{maxVal}</span>
          </div>
        </div>
      </GlowCard>
    </div>
  );
}
