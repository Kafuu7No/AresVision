import { useState, useEffect } from 'react';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useSettings } from '../../contexts/SettingsContext';
import { convertOzone, ozoneLabel } from '../../utils/units';
import { fmtNum } from '../../utils/fmt';
import { LoadingBox, InsightBlock } from './ExploreComponents';

const BAND_COLORS = ['#FF6B4A', '#FFA94D', '#4ECDC4', '#45B7D1', '#9B59B6'];

export default function LineChart({ data, year, h = 240 }) {
  const [insight, setInsight] = useState('');
  const t = useT();
  const { settings } = useSettings();
  const ozoneUnit = settings.units.ozone;
  const precision = settings.precision;

  useEffect(() => {
    if (!data?.bands?.length) return;
    const { ls, bands } = data;
    const amplitudes = bands.map(b => {
      const valid = b.values.filter(v => !isNaN(v));
      return valid.length > 0 ? Math.max(...valid) - Math.min(...valid) : 0;
    });
    const maxAmpIdx = amplitudes.indexOf(Math.max(...amplitudes));
    const minAmpIdx = amplitudes.indexOf(Math.min(...amplitudes));

    const polarN = bands[0]?.values ?? [];
    const polarS = bands[4]?.values ?? [];
    const peakN = polarN.indexOf(Math.max(...polarN.filter(v => !isNaN(v))));
    const peakS = polarS.indexOf(Math.max(...polarS.filter(v => !isNaN(v))));
    const phaseDiff = peakN >= 0 && peakS >= 0
      ? Math.abs((ls[peakN] ?? 0) - (ls[peakS] ?? 0)).toFixed(0)
      : '?';

    setInsight(t('explore.bandsInsight', {
      maxBandName: bands[maxAmpIdx]?.name,
      maxAmp: fmtNum(convertOzone(amplitudes[maxAmpIdx], ozoneUnit), precision),
      minBandName: bands[minAmpIdx]?.name,
      minAmp: fmtNum(convertOzone(amplitudes[minAmpIdx], ozoneUnit), precision),
      phaseDiff,
      unit: ozoneLabel(ozoneUnit),
    }));
  }, [data, year, t, ozoneUnit, precision]);

  if (!data || !data.bands || data.bands.length === 0) return <LoadingBox h={h} />;

  const { ls, bands } = data;

  const convertedBands = bands.map(b => ({
    ...b,
    values: b.values.map(v => (isNaN(v) ? v : convertOzone(v, ozoneUnit))),
  }));

  let yMin = Infinity, yMax = -Infinity;
  convertedBands.forEach(b => b.values.forEach(v => {
    if (!isNaN(v)) { yMin = Math.min(yMin, v); yMax = Math.max(yMax, v); }
  }));
  const yRange = yMax - yMin || 1;
  const pad = yRange * 0.08;
  yMin -= pad; yMax += pad;

  const W = 680, H = 190;
  const ML = 56, MR = 16, MT = 16, MB = 46;
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;

  const lsMin = ls[0] ?? 0;
  const lsMax = ls[ls.length - 1] ?? 360;
  const lsSpan = lsMax - lsMin || 360;

  const toX = (i) => ML + (i / (ls.length - 1)) * plotW;
  const toY = (v) => MT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;
  const tickToX = (lsVal) => ML + ((lsVal - lsMin) / lsSpan) * plotW;

  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => yMin + (i / yTickCount) * (yMax - yMin));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
        <rect x={ML} y={MT} width={plotW} height={plotH} style={{ fill: 'var(--border)' }} />

        {yTicks.map((yv, i) => {
          const cy = toY(yv);
          if (cy < MT || cy > MT + plotH) return null;
          return <line key={`yg${i}`} x1={ML} y1={cy} x2={ML + plotW} y2={cy}
            style={{ stroke: 'var(--text-30)' }} strokeWidth="0.5" strokeDasharray="3,3" />;
        })}

        {[90, 180, 270].map(lsVal => {
          const sx = tickToX(lsVal);
          if (sx < ML || sx > ML + plotW) return null;
          return <line key={`sl${lsVal}`} x1={sx} y1={MT} x2={sx} y2={MT + plotH}
            style={{ stroke: 'var(--text-30)' }} strokeWidth="0.8" strokeDasharray="4,3" />;
        })}

        {convertedBands.map((band, bi) => {
          const pts = band.values
            .map((v, i) => isNaN(v) ? null : `${toX(i)},${toY(v)}`)
            .filter(Boolean).join(' ');
          return <polyline key={bi} points={pts}
            fill="none" stroke={BAND_COLORS[bi % BAND_COLORS.length]}
            strokeWidth="2" opacity="0.9" />;
        })}

        <line x1={ML} y1={MT + plotH} x2={ML + plotW} y2={MT + plotH}
          style={{ stroke: 'var(--text-60)' }} strokeWidth="0.8" />
        {[0, 90, 180, 270, 360].map(lsVal => {
          const tx = tickToX(lsVal);
          if (tx < ML - 2 || tx > ML + plotW + 2) return null;
          return (
            <g key={`xt${lsVal}`}>
              <line x1={tx} y1={MT + plotH} x2={tx} y2={MT + plotH + 4}
                style={{ stroke: 'var(--text-60)' }} strokeWidth="0.8" />
              <text x={tx} y={MT + plotH + 15} textAnchor="middle"
                fontSize="calc(10px * var(--font-scale, 1))" style={{ fill: 'var(--text-60)' }}>{lsVal}°</text>
            </g>
          );
        })}
        <text x={ML + plotW / 2} y={H - 6} textAnchor="middle"
          fontSize="calc(10px * var(--font-scale, 1))" style={{ fill: 'var(--text-30)' }}>Solar Longitude Ls (°)</text>

        <line x1={ML} y1={MT} x2={ML} y2={MT + plotH}
          style={{ stroke: 'var(--text-60)' }} strokeWidth="0.8" />
        {yTicks.map((yv, i) => {
          const cy = toY(yv);
          if (cy < MT - 2 || cy > MT + plotH + 2) return null;
          return (
            <g key={`yt${i}`}>
              <line x1={ML - 4} y1={cy} x2={ML} y2={cy}
                style={{ stroke: 'var(--text-60)' }} strokeWidth="0.8" />
              <text x={ML - 8} y={cy + 4} textAnchor="end"
                fontSize="calc(9px * var(--font-scale, 1))" style={{ fill: 'var(--text-60)' }}>{fmtNum(yv, precision)}</text>
            </g>
          );
        })}
        <text x={14} y={MT + plotH / 2} textAnchor="middle"
          fontSize="calc(10px * var(--font-scale, 1))" style={{ fill: 'var(--text-30)' }}
          transform={`rotate(-90, 14, ${MT + plotH / 2})`}>{`O₃ (${ozoneLabel(ozoneUnit)})`}</text>
      </svg>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
        {bands.map((b, i) => (
          <span key={i} style={{
            fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice60,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{
              display: 'inline-block', width: 18, height: 3,
              borderRadius: 2, background: BAND_COLORS[i % BAND_COLORS.length],
            }} />
            {b.name}
          </span>
        ))}
      </div>

      <InsightBlock text={insight} />
    </div>
  );
}
