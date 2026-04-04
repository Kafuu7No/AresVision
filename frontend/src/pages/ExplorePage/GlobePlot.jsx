import { useState, useRef } from 'react';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useSettings } from '../../contexts/SettingsContext';
import { getRgbStr, makeGradient } from '../../utils/colormaps';
import { convertOzone, ozoneLabel } from '../../utils/units';
import { fmtNum } from '../../utils/fmt';
import { LoadingBox } from './ExploreComponents';

export default function GlobePlot({ data, h = 300 }) {
  const [tooltip, setTooltip] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const containerRef = useRef(null);
  const t = useT();
  const { settings } = useSettings();
  const colormapName = settings.colormap;
  const ozoneUnit = settings.units.ozone;
  const precision = settings.precision;
  const isLight = settings.theme === 'light';

  if (!data || !data.points || data.points.length === 0) {
    return <LoadingBox h={h} label={t('common.loadingGlobe')} />;
  }

  const { points, minVal, maxVal } = data;
  const range = maxVal - minVal || 1;

  const W = 600, H = 300;
  const VB_LEFT = 48;
  const VB_BOTTOM = 18;
  const toX = (lng) => ((lng + 180) / 360) * W;
  const toY = (lat) => ((90 - lat) / 180) * H;

  const formatLat = (lat) => lat >= 0 ? `${lat.toFixed(1)}°N` : `${Math.abs(lat).toFixed(1)}°S`;
  const formatLng = (lng) => lng >= 0 ? `${lng.toFixed(1)}°E` : `${Math.abs(lng).toFixed(1)}°W`;
  const latLabel = (lat) => lat === 0 ? '0°' : lat > 0 ? `${lat}°N` : `${Math.abs(lat)}°S`;
  const lngLabel = (lng) => lng === 0 ? '0°' : lng > 0 ? `${lng}°E` : `${Math.abs(lng)}°W`;

  const handleCircleClick = (e, p, i) => {
    e.stopPropagation();
    if (selectedIdx === i) {
      setTooltip(null);
      setSelectedIdx(null);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left + 10;
    let y = e.clientY - rect.top - 10;
    if (x + 140 > rect.width) x = e.clientX - rect.left - 150;
    if (y + 70 > rect.height) y = e.clientY - rect.top - 80;
    if (y < 0) y = 4;
    setTooltip({ x, y, lat: p.lat, lng: p.lng, val: p.val });
    setSelectedIdx(i);
  };

  const handleContainerClick = () => {
    setTooltip(null);
    setSelectedIdx(null);
  };

  return (
    <div
      ref={containerRef}
      className={isLight ? 'observation-window' : 'observation-window panel-dark'}
      style={{
        position: 'relative', overflow: 'hidden',
        background: isLight ? '#f5f6f8' : 'radial-gradient(ellipse at center, #0a1525 0%, #050a12 100%)',
        paddingRight: 90,
      }}
      onClick={handleContainerClick}
    >
      <svg viewBox={`-${VB_LEFT} 0 ${W + VB_LEFT} ${H + VB_BOTTOM}`} style={{ width: '100%', display: 'block' }}>
        {[-60, -30, 0, 30, 60].map(lat => (
          <line key={`lat${lat}`} x1="0" y1={toY(lat)} x2={W} y2={toY(lat)}
            stroke={isLight ? 'rgba(26,26,46,0.1)' : 'rgba(255,255,255,0.12)'} strokeWidth="0.5" />
        ))}
        {[-120, -60, 0, 60, 120].map(lng => (
          <line key={`lng${lng}`} x1={toX(lng)} y1="0" x2={toX(lng)} y2={H}
            stroke={isLight ? 'rgba(26,26,46,0.1)' : 'rgba(255,255,255,0.12)'} strokeWidth="0.5" />
        ))}

        {[-60, -30, 0, 30, 60].map(lat => (
          <text key={`latl${lat}`} x={-VB_LEFT + 4} y={toY(lat) + 4}
            fontSize="8" fill={isLight ? 'rgba(26,26,46,0.55)' : 'rgba(255,255,255,0.55)'}>{latLabel(lat)}</text>
        ))}
        {[-120, -60, 0, 60, 120].map(lng => (
          <text key={`lngl${lng}`} x={toX(lng)} y={H + 13}
            textAnchor="middle" fontSize="8" fill={isLight ? 'rgba(26,26,46,0.5)' : 'rgba(255,255,255,0.5)'}>{lngLabel(lng)}</text>
        ))}

        {points.map((p, i) => {
          const nv = (p.val - minVal) / range;
          const isSelected = selectedIdx === i;
          const r = isLight ? 2.56 : 3.2;
          const opacity = isLight ? Math.max(0.05, Math.pow(nv, 0.6)) : 0.85;
          return (
            <circle
              key={i}
              cx={toX(p.lng)} cy={toY(p.lat)}
              r={r}
              fill={getRgbStr(colormapName, nv)}
              opacity={opacity}
              stroke={isSelected ? (isLight ? '#333' : 'white') : 'none'}
              strokeWidth={isSelected ? 1.5 : 0}
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleCircleClick(e, p, i)}
            />
          );
        })}
      </svg>

      <div style={{ position: 'absolute', right: 8, top: 20, bottom: 20, width: 70 }}>
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 14,
          borderRadius: 4,
          border: isLight ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.2)',
          background: makeGradient(colormapName),
        }} />
        <span style={{
          position: 'absolute', right: 18, top: 0,
          fontSize: 9, color: C.ice60, whiteSpace: 'nowrap',
        }}>{fmtNum(convertOzone(maxVal, ozoneUnit), precision)}</span>
        <span style={{
          position: 'absolute', right: 18, top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 9, color: C.ice60, whiteSpace: 'nowrap',
        }}>{fmtNum(convertOzone((maxVal + minVal) / 2, ozoneUnit), precision)}</span>
        <span style={{
          position: 'absolute', right: 18, bottom: 0,
          fontSize: 9, color: C.ice60, whiteSpace: 'nowrap',
        }}>{fmtNum(convertOzone(minVal, ozoneUnit), precision)}</span>
        <span style={{
          position: 'absolute', right: 0, bottom: -14,
          fontSize: 9, color: C.ice30, whiteSpace: 'nowrap',
        }}>{ozoneLabel(ozoneUnit)}</span>
      </div>

      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x,
          top: tooltip.y,
          background: 'rgba(15,15,25,0.9)',
          border: '1px solid rgba(232,237,243,0.15)',
          backdropFilter: 'blur(10px)',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 12,
          color: C.ice,
          pointerEvents: 'none',
          zIndex: 10,
          whiteSpace: 'nowrap',
          lineHeight: 1.7,
        }}>
          <div>{formatLat(tooltip.lat)}</div>
          <div>{formatLng(tooltip.lng)}</div>
          <div style={{ color: C.mars, fontWeight: 700 }}>{fmtNum(convertOzone(tooltip.val, ozoneUnit), precision)} {ozoneLabel(ozoneUnit)}</div>
        </div>
      )}
    </div>
  );
}
