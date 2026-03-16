import { useState, useEffect, useRef, useCallback } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useSettings } from '../contexts/SettingsContext';
import SectionTitle from '../components/SectionTitle';
import GlowCard from '../components/GlowCard';
import {
  fetchGlobeData,
  fetchSeasonalHeatmap,
  fetchSeasonalBands,
  fetchCorrelation,
} from '../services/api';
import { getRgb, getRgbStr, rdbuRgb, makeGradient } from '../utils/colormaps';
import { convertOzone, ozoneLabel } from '../utils/units';
import { fmtNum } from '../utils/fmt';

// ─── 通用组件 ───

function LoadingBox({ h = 200, label }) {
  const t = useT();
  const displayLabel = label ?? t('common.loading');
  return (
    <div style={{
      height: h, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.02)', borderRadius: 12,
    }}>
      <div style={{
        width: 28, height: 28, border: `3px solid ${C.border}`,
        borderTop: `3px solid ${C.mars}`, borderRadius: '50%',
        animation: 'spin-slow 1s linear infinite',
      }} />
      <div style={{ marginTop: 12, fontSize: 12, color: C.ice30 }}>{displayLabel}</div>
    </div>
  );
}

function InsightBlock({ text }) {
  if (!text) return null;
  return (
    <div style={{
      marginTop: 12,
      background: 'rgba(199,91,57,0.06)',
      borderLeft: '3px solid rgba(199,91,57,0.4)',
      borderRadius: 8,
      padding: '12px 16px',
      fontSize: 12,
      color: C.ice60,
      lineHeight: 1.7,
    }}>
      {text}
    </div>
  );
}

// ─── Canvas 热力图 ───

function HeatmapCanvas({ data, year, h = 300 }) {
  const canvasRef = useRef(null);
  const [insight, setInsight] = useState('');
  const t = useT();
  const { settings } = useSettings();
  const colormapName = settings.colormap;
  const ozoneUnit = settings.units.ozone;
  const precision = settings.precision;
  const isLight = settings.theme === 'light';

  useEffect(() => {
    if (!data || !data.z || data.z.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const CW = canvas.width;   // 720
    const CH = canvas.height;  // h
    const ML = 52, MR = 78, MT = 36, MB = 50;
    const plotW = CW - ML - MR;
    const plotH = CH - MT - MB;

    const { x, y, z, min: dMin, max: dMax } = data;
    const nX = z[0].length;
    const nY = z.length;
    const range = dMax - dMin || 1;
    const cellW = plotW / nX;
    const cellH = plotH / nY;

    // 主题色常量
    const bgColor        = isLight ? '#f5f6f8'              : '#0a0a0f';
    const bgPixel        = isLight ? [245, 246, 248]        : [10, 10, 15];
    const axisColor      = isLight ? 'rgba(26,26,46,0.2)'  : 'rgba(255,255,255,0.2)';
    const tickColor      = isLight ? 'rgba(26,26,46,0.7)'  : 'rgba(232,237,243,0.65)';
    const titleColor     = isLight ? 'rgba(26,26,46,0.45)' : 'rgba(232,237,243,0.4)';
    const seasonLine     = isLight ? 'rgba(26,26,46,0.2)'  : 'rgba(255,255,255,0.35)';
    const seasonLabel    = isLight ? 'rgba(26,26,46,0.65)' : 'rgba(255,255,255,0.55)';
    const cbLabelColor   = isLight ? 'rgba(26,26,46,0.7)'  : 'rgba(232,237,243,0.7)';
    const cbBorderColor  = isLight ? 'rgba(26,26,46,0.2)'  : 'rgba(255,255,255,0.2)';
    const cbTitleColor   = isLight ? 'rgba(26,26,46,0.45)' : 'rgba(232,237,243,0.4)';

    // 背景
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CW, CH);

    // 用 ImageData 渲染热力图主体
    const imgData = ctx.createImageData(plotW, plotH);
    const pixels = imgData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = bgPixel[0]; pixels[i + 1] = bgPixel[1]; pixels[i + 2] = bgPixel[2]; pixels[i + 3] = 255;
    }
    for (let yi = 0; yi < nY; yi++) {
      const pyStart = Math.round((nY - 1 - yi) * cellH);
      const pyEnd = Math.round((nY - yi) * cellH);
      for (let xi = 0; xi < nX; xi++) {
        const val = z[yi][xi];
        if (val == null || isNaN(val)) continue;
        const t = Math.max(0, Math.min(1, (val - dMin) / range));
        const [r, g, b] = getRgb(colormapName, t);
        const pxStart = Math.round(xi * cellW);
        const pxEnd = Math.round((xi + 1) * cellW);
        for (let py = pyStart; py < pyEnd; py++) {
          for (let px = pxStart; px < pxEnd; px++) {
            if (px >= plotW || py >= plotH || px < 0 || py < 0) continue;
            const idx = (py * plotW + px) * 4;
            pixels[idx] = r; pixels[idx + 1] = g; pixels[idx + 2] = b; pixels[idx + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(imgData, ML, MT);

    // 季节分界线
    const lsMin = x[0];
    const lsRange = (x[x.length - 1] - lsMin) || 360;
    const seasonLsList = [90, 180, 270];
    const seasonLabels = [
      t('common.seasonMark.summer'),
      t('common.seasonMark.autumn'),
      t('common.seasonMark.winter'),
    ];
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = seasonLine;
    ctx.lineWidth = 1;
    seasonLsList.forEach((ls, si) => {
      const frac = (ls - lsMin) / lsRange;
      if (frac < 0 || frac > 1) return;
      const sx = ML + frac * plotW;
      ctx.beginPath(); ctx.moveTo(sx, MT); ctx.lineTo(sx, MT + plotH); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = seasonLabel;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(seasonLabels[si], sx, MT - 10);
      ctx.setLineDash([4, 3]);
    });
    ctx.setLineDash([]);

    // X 轴
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ML, MT + plotH); ctx.lineTo(ML + plotW, MT + plotH); ctx.stroke();
    const xTicks = [0, 90, 180, 270, 360];
    ctx.fillStyle = tickColor;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    xTicks.forEach(ls => {
      const frac = (ls - lsMin) / lsRange;
      if (frac < -0.02 || frac > 1.02) return;
      const tx = ML + Math.max(0, Math.min(1, frac)) * plotW;
      ctx.beginPath(); ctx.moveTo(tx, MT + plotH); ctx.lineTo(tx, MT + plotH + 4); ctx.stroke();
      ctx.fillText(`${ls}°`, tx, MT + plotH + 17);
    });
    ctx.fillStyle = titleColor;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Solar Longitude Ls (°)', ML + plotW / 2, CH - 8);

    // Y 轴
    ctx.strokeStyle = axisColor;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ML, MT); ctx.lineTo(ML, MT + plotH); ctx.stroke();
    const yTicks = [-90, -60, -30, 0, 30, 60, 90];
    ctx.fillStyle = tickColor;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    yTicks.forEach(lat => {
      const frac = (lat + 90) / 180;
      const ty = MT + plotH - frac * plotH;
      ctx.beginPath(); ctx.moveTo(ML, ty); ctx.lineTo(ML - 4, ty); ctx.stroke();
      ctx.fillText(`${lat}°`, ML - 8, ty + 4);
    });
    ctx.save();
    ctx.translate(14, MT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = titleColor;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Latitude (°)', 0, 0);
    ctx.restore();

    // Colorbar
    const cbX = CW - MR + 14;
    const cbW = 18;
    const cbImgData = ctx.createImageData(cbW, plotH);
    for (let py = 0; py < plotH; py++) {
      const t = 1 - py / plotH;
      const [r, g, b] = getRgb(colormapName, t);
      for (let px = 0; px < cbW; px++) {
        const idx = (py * cbW + px) * 4;
        cbImgData.data[idx] = r; cbImgData.data[idx + 1] = g;
        cbImgData.data[idx + 2] = b; cbImgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(cbImgData, cbX, MT);
    ctx.strokeStyle = cbBorderColor;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(cbX, MT, cbW, plotH);
    ctx.fillStyle = cbLabelColor;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(fmtNum(convertOzone(dMax, ozoneUnit), precision), cbX + cbW + 4, MT + 5);
    ctx.fillText(fmtNum(convertOzone((dMax + dMin) / 2, ozoneUnit), precision), cbX + cbW + 4, MT + plotH / 2 + 4);
    ctx.fillText(fmtNum(convertOzone(dMin, ozoneUnit), precision), cbX + cbW + 4, MT + plotH + 4);
    ctx.fillStyle = cbTitleColor;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ozoneLabel(ozoneUnit), cbX + cbW / 2, MT + plotH + 20);

    // 计算 insight
    let maxVal = -Infinity, minVal = Infinity;
    let maxYi = 0, maxXi = 0, minYi = 0, minXi = 0;
    for (let yi = 0; yi < nY; yi++) {
      for (let xi = 0; xi < nX; xi++) {
        const v = z[yi][xi];
        if (!isNaN(v) && v != null) {
          if (v > maxVal) { maxVal = v; maxYi = yi; maxXi = xi; }
          if (v < minVal) { minVal = v; minYi = yi; minXi = xi; }
        }
      }
    }
    const polarMeans = [], equatMeans = [];
    for (let yi = 0; yi < nY; yi++) {
      const lat = y[yi];
      const valid = z[yi].filter(v => !isNaN(v) && v != null);
      const rowMean = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
      if (Math.abs(lat) >= 60) polarMeans.push(rowMean);
      else if (Math.abs(lat) <= 30) equatMeans.push(rowMean);
    }
    const polarAvg = polarMeans.length > 0 ? polarMeans.reduce((a, b) => a + b) / polarMeans.length : 0;
    const equatAvg = equatMeans.length > 0 && equatMeans.reduce((a, b) => a + b) / equatMeans.length > 0
      ? equatMeans.reduce((a, b) => a + b) / equatMeans.length : 1;
    const ratio = (polarAvg / equatAvg).toFixed(1);

    const latDesc = (lat) => {
      if (lat > 60) return t('common.latRegion.n90', { lat: lat.toFixed(1) });
      if (lat > 30) return t('common.latRegion.n60', { lat: lat.toFixed(1) });
      if (lat >= -30) return t('common.latRegion.eq', { lat: lat.toFixed(1) });
      if (lat >= -60) return t('common.latRegion.s60', { lat: Math.abs(lat).toFixed(1) });
      return t('common.latRegion.s90', { lat: Math.abs(lat).toFixed(1) });
    };

    setInsight(t('explore.heatmapInsight', {
      year,
      latMaxDesc: latDesc(y[maxYi]),
      lsMax: x[maxXi]?.toFixed(0),
      valMax: fmtNum(convertOzone(maxVal, ozoneUnit), precision),
      latMinDesc: latDesc(y[minYi]),
      lsMin: x[minXi]?.toFixed(0),
      valMin: fmtNum(convertOzone(minVal, ozoneUnit), precision),
      ratio,
      unit: ozoneLabel(ozoneUnit),
    }));
  }, [data, year, t, colormapName, ozoneUnit, precision, isLight]);

  if (!data || !data.z) return <LoadingBox h={h} />;

  return (
    <div>
      <div style={isLight ? { borderRadius: 10, overflow: 'hidden', background: '#f5f6f8' } : {}}>
        <canvas
          ref={canvasRef}
          width={720}
          height={h}
          className="observation-window"
          style={{ width: '100%', display: 'block', background: 'transparent' }}
        />
      </div>
      <InsightBlock text={insight} />
    </div>
  );
}

// ─── SVG 折线图 ───

const BAND_COLORS = ['#FF6B4A', '#FFA94D', '#4ECDC4', '#45B7D1', '#9B59B6'];

function LineChart({ data, year, h = 240 }) {
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

  // Convert values to display unit before computing axis range
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
        {/* 绘图区背景 */}
        <rect x={ML} y={MT} width={plotW} height={plotH} style={{ fill: 'var(--border)' }} />

        {/* 水平网格 */}
        {yTicks.map((yv, i) => {
          const cy = toY(yv);
          if (cy < MT || cy > MT + plotH) return null;
          return <line key={`yg${i}`} x1={ML} y1={cy} x2={ML + plotW} y2={cy}
            style={{ stroke: 'var(--text-30)' }} strokeWidth="0.5" strokeDasharray="3,3" />;
        })}

        {/* 季节竖线 */}
        {[90, 180, 270].map(lsVal => {
          const sx = tickToX(lsVal);
          if (sx < ML || sx > ML + plotW) return null;
          return <line key={`sl${lsVal}`} x1={sx} y1={MT} x2={sx} y2={MT + plotH}
            style={{ stroke: 'var(--text-30)' }} strokeWidth="0.8" strokeDasharray="4,3" />;
        })}

        {/* 折线数据 */}
        {convertedBands.map((band, bi) => {
          const pts = band.values
            .map((v, i) => isNaN(v) ? null : `${toX(i)},${toY(v)}`)
            .filter(Boolean).join(' ');
          return <polyline key={bi} points={pts}
            fill="none" stroke={BAND_COLORS[bi % BAND_COLORS.length]}
            strokeWidth="2" opacity="0.9" />;
        })}

        {/* X 轴 */}
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
                fontSize="10" style={{ fill: 'var(--text-60)' }}>{lsVal}°</text>
            </g>
          );
        })}
        <text x={ML + plotW / 2} y={H - 6} textAnchor="middle"
          fontSize="10" style={{ fill: 'var(--text-30)' }}>Solar Longitude Ls (°)</text>

        {/* Y 轴 */}
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
                fontSize="9" style={{ fill: 'var(--text-60)' }}>{fmtNum(yv, precision)}</text>
            </g>
          );
        })}
        <text x={14} y={MT + plotH / 2} textAnchor="middle"
          fontSize="10" style={{ fill: 'var(--text-30)' }}
          transform={`rotate(-90, 14, ${MT + plotH / 2})`}>{`O₃ (${ozoneLabel(ozoneUnit)})`}</text>
      </svg>

      {/* 图例 */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
        {bands.map((b, i) => (
          <span key={i} style={{
            fontSize: 11, color: C.ice60,
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

// ─── 全球散点图（等距投影 SVG） ───

function GlobePlot({ data, h = 300 }) {
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
  const VB_LEFT = 48;  // 左侧留白，为纬度标签腾出空间
  const VB_BOTTOM = 18; // 底部留白，为经度标签腾出空间
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
    // 防止 tooltip 超出右边界或下边界
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
      {/* SVG：左侧 +VB_LEFT 为纬度标签区，底部 +VB_BOTTOM 为经度标签区 */}
      <svg viewBox={`-${VB_LEFT} 0 ${W + VB_LEFT} ${H + VB_BOTTOM}`} style={{ width: '100%', display: 'block' }}>
        {/* 经纬网格 */}
        {[-60, -30, 0, 30, 60].map(lat => (
          <line key={`lat${lat}`} x1="0" y1={toY(lat)} x2={W} y2={toY(lat)}
            stroke={isLight ? 'rgba(26,26,46,0.1)' : 'rgba(255,255,255,0.12)'} strokeWidth="0.5" />
        ))}
        {[-120, -60, 0, 60, 120].map(lng => (
          <line key={`lng${lng}`} x1={toX(lng)} y1="0" x2={toX(lng)} y2={H}
            stroke={isLight ? 'rgba(26,26,46,0.1)' : 'rgba(255,255,255,0.12)'} strokeWidth="0.5" />
        ))}

        {/* 纬度标注：放在左侧留白区，使用 N/S 格式 */}
        {[-60, -30, 0, 30, 60].map(lat => (
          <text key={`latl${lat}`} x={-VB_LEFT + 4} y={toY(lat) + 4}
            fontSize="8" fill={isLight ? 'rgba(26,26,46,0.55)' : 'rgba(255,255,255,0.55)'}>{latLabel(lat)}</text>
        ))}
        {/* 经度标注：E/W 格式，放在绘图区下方留白区 */}
        {[-120, -60, 0, 60, 120].map(lng => (
          <text key={`lngl${lng}`} x={toX(lng)} y={H + 13}
            textAnchor="middle" fontSize="8" fill={isLight ? 'rgba(26,26,46,0.5)' : 'rgba(255,255,255,0.5)'}>{lngLabel(lng)}</text>
        ))}

        {/* 数据点 */}
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

      {/* Colorbar：标签在渐变条左侧，避免被 overflow:hidden 裁切 */}
      <div style={{ position: 'absolute', right: 8, top: 20, bottom: 20, width: 70 }}>
        {/* 渐变条 */}
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 14,
          borderRadius: 4,
          border: isLight ? '1px solid rgba(0,0,0,0.12)' : '1px solid rgba(255,255,255,0.2)',
          background: makeGradient(colormapName),
        }} />
        {/* 最大值标签 */}
        <span style={{
          position: 'absolute', right: 18, top: 0,
          fontSize: 9, color: C.ice60, whiteSpace: 'nowrap',
        }}>{fmtNum(convertOzone(maxVal, ozoneUnit), precision)}</span>
        {/* 中间值标签 */}
        <span style={{
          position: 'absolute', right: 18, top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 9, color: C.ice60, whiteSpace: 'nowrap',
        }}>{fmtNum(convertOzone((maxVal + minVal) / 2, ozoneUnit), precision)}</span>
        {/* 最小值标签 */}
        <span style={{
          position: 'absolute', right: 18, bottom: 0,
          fontSize: 9, color: C.ice60, whiteSpace: 'nowrap',
        }}>{fmtNum(convertOzone(minVal, ozoneUnit), precision)}</span>
        {/* 单位 */}
        <span style={{
          position: 'absolute', right: 0, bottom: -14,
          fontSize: 9, color: C.ice30, whiteSpace: 'nowrap',
        }}>{ozoneLabel(ozoneUnit)}</span>
      </div>


      {/* Tooltip */}
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
          color: '#e8edf3',
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

// ─── 相关矩阵 ───

const VAR_ABBREV = {
  o3col: 'O₃',
  U_Wind: 'U Wind',
  V_Wind: 'V Wind',
  Pressure: 'Press',
  Temperature: 'Temp',
  Dust_Optical_Depth: 'DOD',
  Solar_Flux_DN: 'SolFlx',
};

function CorrelationChart({ data, year, h = 320 }) {
  const [insight, setInsight] = useState('');
  const t = useT();

  useEffect(() => {
    if (!data?.matrix || !data?.variable_names) return;
    const o3Row = data.matrix[0];
    // 排除对角线（索引 0，O₃ 与自身相关系数 1.0），并防御 NaN/null
    let maxAbsCorr = 0, maxCorrVal = 0, maxCorrIdx = -1;
    o3Row.forEach((v, i) => {
      if (i === 0) return;
      if (v == null || isNaN(v)) return;
      if (Math.abs(v) > maxAbsCorr) {
        maxAbsCorr = Math.abs(v);
        maxCorrVal = v;
        maxCorrIdx = i;
      }
    });
    const maxVar = maxCorrIdx >= 0 ? (data.variable_names[maxCorrIdx] || '-') : '-';
    const corrSign = maxCorrVal >= 0 ? t('common.positive') : t('common.negative');
    const corrStr = maxCorrIdx >= 0 ? maxCorrVal.toFixed(3) : 'N/A';
    setInsight(t('explore.corrInsight', {
      year,
      varName: VAR_ABBREV[maxVar] || maxVar,
      corrVal: corrStr,
      corrSign,
    }));
  }, [data, year, t]);

  if (!data || !data.matrix) return <LoadingBox h={h} />;

  const { matrix, variable_names } = data;
  const n = matrix.length;
  const abbrevNames = variable_names.map(v => VAR_ABBREV[v] || v);

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
          <div style={{ width: '100%', maxWidth: 520 }}>
            {/* 表头行 */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `64px repeat(${n}, 1fr)`,
              gap: 2, marginBottom: 2,
            }}>
              <div />
              {abbrevNames.map((v, i) => (
                <div key={`h${i}`} style={{
                  fontSize: 10, color: C.ice60,
                  textAlign: 'center', padding: '2px 1px', lineHeight: 1.3,
                }}>{v}</div>
              ))}
            </div>

            {/* 数据行 */}
            {matrix.map((row, ri) => (
              <div key={`r${ri}`} style={{
                display: 'grid',
                gridTemplateColumns: `64px repeat(${n}, 1fr)`,
                gap: 2, marginBottom: 2,
              }}>
                <div style={{
                  fontSize: 10, color: C.ice60,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'flex-end', paddingRight: 6,
                }}>
                  {abbrevNames[ri]}
                </div>
                {row.map((val, ci) => {
                  const isDiag = ri === ci;
                  let bg, textColor;
                  if (isDiag) {
                    bg = 'rgba(199,91,57,0.65)';
                    textColor = '#fff';
                  } else {
                    const [r, g, b] = rdbuRgb((val + 1) / 2);
                    bg = `rgb(${r},${g},${b})`;
                    const brightness = r * 0.299 + g * 0.587 + b * 0.114;
                    textColor = brightness > 160 ? '#111' : '#fff';
                  }
                  return (
                    <div key={`${ri}-${ci}`} style={{
                      background: bg,
                      borderRadius: 3,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, color: textColor,
                      fontWeight: Math.abs(val) > 0.5 ? 700 : 400,
                      minHeight: 34,
                    }}>
                      {val.toFixed(2)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <InsightBlock text={insight} />
    </div>
  );
}


// ═══════════════════════════════════════════
//  主页面组件
// ═══════════════════════════════════════════

export default function ExplorePage() {
  const t = useT();
  const [lsValue, setLsValue] = useState(90);
  const [marsYear, setMarsYear] = useState(27);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  const [globeData, setGlobeData] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [bandsData, setBandsData] = useState(null);
  const [corrData, setCorrData] = useState(null);
  const [loading, setLoading] = useState({});

  // 加载地球数据（带防抖 AbortController）
  const loadGlobe = useCallback(async (ls, year) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    setLoading(prev => ({ ...prev, globe: true }));
    try {
      const d = await fetchGlobeData(year, ls, signal);
      if (!signal.aborted) {
        setGlobeData(d);
        setLoading(prev => ({ ...prev, globe: false }));
      }
    } catch (e) {
      if (!signal.aborted) {
        console.error('Globe data error:', e);
        setLoading(prev => ({ ...prev, globe: false }));
      }
    }
  }, []);

  // 加载静态数据（热力图/折线图/相关矩阵）
  const loadStaticData = useCallback(async (year) => {
    setLoading(prev => ({ ...prev, heatmap: true, bands: true, corr: true }));
    try {
      const [hm, bd, cr] = await Promise.all([
        fetchSeasonalHeatmap(year),
        fetchSeasonalBands(year),
        fetchCorrelation(year),
      ]);
      setHeatmapData(hm);
      setBandsData(bd);
      setCorrData(cr);
    } catch (e) {
      console.error('Static data error:', e);
    }
    setLoading(prev => ({ ...prev, heatmap: false, bands: false, corr: false }));
  }, []);

  // marsYear 变化：重载静态数据
  useEffect(() => {
    setHeatmapData(null);
    setBandsData(null);
    setCorrData(null);
    loadStaticData(marsYear);
  }, [marsYear]);

  // lsValue 或 marsYear 变化：重载地球图（只有一个 effect 调 loadGlobe，避免重复）
  useEffect(() => {
    loadGlobe(lsValue, marsYear);
  }, [lsValue, marsYear]);

  // 播放动画
  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setLsValue(v => {
          if (v >= 355) { setPlaying(false); return 0; }
          return v + 5;
        });
      }, 1200);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [playing]);

  const seasonName =
    lsValue < 90  ? t('common.season.spring') :
    lsValue < 180 ? t('common.season.summer') :
    lsValue < 270 ? t('common.season.autumn') : t('common.season.winter');

  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionTitle title={t('explore.title')} subtitle={t('explore.subtitle')} />

      {/* ─── 控制栏 ─── */}
      <GlowCard style={{
        padding: '16px 24px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 11, color: C.ice60,
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 1,
          }}>MARS YEAR</span>
          <select
            value={marsYear}
            onChange={e => setMarsYear(Number(e.target.value))}
            style={{
              background: 'var(--border)', border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '6px 12px', color: C.ice, fontSize: 13,
            }}
          >
            <option value={27}>MY 27</option>
            <option value={28}>MY 28</option>
          </select>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            fontSize: 11, color: C.ice60, fontFamily: "'Orbitron', sans-serif",
            letterSpacing: 1, whiteSpace: 'nowrap',
          }}>Ls</span>
          <input
            type="range" min={0} max={360} step={5} value={lsValue}
            onChange={e => setLsValue(Number(e.target.value))}
            style={{ flex: 1, accentColor: C.mars }}
          />
          <span style={{
            fontSize: 14, fontWeight: 700, color: C.mars,
            fontFamily: "'Orbitron', sans-serif", minWidth: 50, textAlign: 'right',
          }}>
            {lsValue}°
          </span>
        </div>

        <button
          onClick={() => setPlaying(!playing)}
          style={{
            background: playing ? 'rgba(199,91,57,0.2)' : 'rgba(74,158,255,0.15)',
            border: `1px solid ${playing ? C.mars : C.blue}`,
            borderRadius: 8, padding: '8px 20px',
            color: playing ? C.mars : C.blue,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 1,
          }}
        >
          {playing ? `⏸ ${t('common.pause')}` : `▶ ${t('common.play')}`}
        </button>

        <div style={{ fontSize: 12, color: C.ice30 }}>{seasonName}</div>
      </GlowCard>

      {/* ─── 主图表区 ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* 全球臭氧图 */}
        <GlowCard breathe style={{ padding: 20 }}>
          <div style={{ minHeight: 56, marginBottom: 8, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: C.mars,
              fontFamily: "'Orbitron', sans-serif", letterSpacing: 2,
            }}>{t('explore.ozoneMap')}</span>
            <span style={{ fontSize: 10, color: C.ice30, marginTop: 4 }}>
              {globeData?.ls != null ? `Ls = ${Math.round(globeData.ls)}°` : '—'}
              {globeData?.points ? ` · ${globeData.points.length} pts` : ''}
            </span>
          </div>
          {loading.globe && !globeData
            ? <LoadingBox h={300} label={t('common.loadingGlobe')} />
            : <GlobePlot data={globeData} />}
        </GlowCard>

        {/* 热力图 */}
        <GlowCard breathe style={{ padding: 20 }}>
          <div style={{ minHeight: 56, marginBottom: 8, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: C.blue,
              fontFamily: "'Orbitron', sans-serif", letterSpacing: 2,
            }}>{t('explore.heatmapTitle')}</span>
            <span style={{ fontSize: 10, color: C.ice30, marginTop: 4 }}>
              {t('explore.heatmapSub', { year: marsYear })}
            </span>
          </div>
          {loading.heatmap && !heatmapData
            ? <LoadingBox h={300} />
            : <HeatmapCanvas data={heatmapData} year={marsYear} h={300} />}
        </GlowCard>

        {/* 折线图 */}
        <GlowCard breathe style={{ padding: 20, gridColumn: 'span 2' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.blue,
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 12,
          }}>
            {t('explore.bandsTitle')}
          </div>
          {loading.bands && !bandsData
            ? <LoadingBox h={240} />
            : <LineChart data={bandsData} year={marsYear} h={220} />}
        </GlowCard>
      </div>

      {/* ─── 相关矩阵 ─── */}
      <div style={{ marginTop: 32 }}>
        <GlowCard breathe style={{ padding: 24 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: C.blue,
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 4,
          }}>
            {t('explore.corrTitle')}
          </div>
          <div style={{ fontSize: 10, color: C.ice30, marginBottom: 16 }}>
            {t('explore.corrSub', { year: marsYear })}
          </div>
          {loading.corr && !corrData
            ? <LoadingBox h={350} />
            : <CorrelationChart data={corrData} year={marsYear} h={350} />}
        </GlowCard>
      </div>
    </div>
  );
}
