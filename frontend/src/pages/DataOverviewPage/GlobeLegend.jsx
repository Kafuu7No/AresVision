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

export default function GlobeLegend({ ozoneData, sceneModel }) {
  const { settings } = useSettings();
  const isLight = settings?.theme === 'light';
  const isZh = settings?.language !== 'en';
  const { leftPanelWidth, gestureEnabled } = useDataOverview();
  const variable = ozoneData?.variable || 'o3col';
  const varMeta = getGlobeVariableMeta(variable);
  const varLabel = settings?.language === 'en' ? varMeta.en : varMeta.zh;
  const unitLabel = unitLabelByVariable(variable, settings.units);

  if (!ozoneData || typeof ozoneData.maxVal === 'undefined') return null;

  const panelWidth = gestureEnabled ? 176 : 196;
  const panelBottom = gestureEnabled ? 282 : 124;

  const pointsCount = ozoneData.points?.length || 0;
  const maxVal = convertByVariable(ozoneData.maxVal || 0, variable, settings.units).toFixed(3);
  const midVal = convertByVariable(((ozoneData.maxVal || 0) + (ozoneData.minVal || 0)) / 2, variable, settings.units).toFixed(3);
  const minVal = convertByVariable(ozoneData.minVal || 0, variable, settings.units).toFixed(3);
  const horizontalGradient = (() => {
    const n = 10;
    const pts = Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      const [r, g, b] = getRgb(settings.colormap, t);
      return `rgb(${r},${g},${b}) ${(i / (n - 1) * 100).toFixed(0)}%`;
    });
    return `linear-gradient(90deg, ${pts.join(', ')})`;
  })();

  const sourceItems = [
    { id: 'mcd', label: 'MCD', color: '#f97316' },
    { id: 'openmars', label: 'OpenMARS', color: '#38bdf8' },
    { id: 'nomad', label: 'NOMAD', color: '#34d399' },
  ];

  const activeSourceIds = new Set((sceneModel?.layers || []).map((layer) => layer.source || layer.id));
  const diffGradient = 'linear-gradient(90deg, #2b6cb0 0%, #f8fafc 50%, #c2410c 100%)';

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
      <GlowCard style={{ padding: '12px', background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(10,14,23,0.58)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 10,
          }}
        >
          <div>
            <div style={{ color: C.ice50, fontSize: 'calc(10px * var(--font-scale, 1))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {isZh ? '图例' : 'Legend'}
            </div>
            <div style={{ color: C.ice60, fontSize: 'calc(10px * var(--font-scale, 1))', marginTop: 3 }}>
              {varLabel} ({unitLabel})
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: C.ice40, fontSize: 'calc(9px * var(--font-scale, 1))' }}>
              {isZh ? '数据点' : 'Points'}
            </div>
            <div style={{ color: C.mars, fontSize: 'calc(13px * var(--font-scale, 1))', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
              {pointsCount}
            </div>
          </div>
        </div>

        {sceneModel?.legendMode === 'sources' ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {sourceItems.map((item) => {
              const active = activeSourceIds.has(item.id);
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, opacity: active ? 1 : 0.36 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.ice60, fontSize: 'calc(10px * var(--font-scale, 1))', fontWeight: 700 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: item.color, boxShadow: `0 0 10px ${item.color}88` }} />
                    {item.label}
                  </span>
                  <span style={{ color: active ? C.ice40 : C.ice30, fontSize: 'calc(9px * var(--font-scale, 1))' }}>
                    {active ? (isZh ? '可用' : 'Available') : (isZh ? '无数据' : 'No data')}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                border: `1px solid ${C.border}`,
                background: sceneModel?.legendMode === 'diff' ? diffGradient : horizontalGradient,
                marginBottom: 8,
              }}
            />

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 'calc(9px * var(--font-scale, 1))',
                color: C.ice,
                fontWeight: 700,
              }}
            >
              <span>{minVal}</span>
              <span style={{ color: C.ice60 }}>{sceneModel?.legendMode === 'diff' ? '0.000' : midVal}</span>
              <span>{maxVal}</span>
            </div>
          </>
        )}
      </GlowCard>
    </div>
  );
}
