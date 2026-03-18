import { useState, useEffect, useRef } from 'react'; // Re-triggering vite cache
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useSettings } from '../../contexts/SettingsContext';
import { getRgb } from '../../utils/colormaps';
import { convertOzone, ozoneLabel } from '../../utils/units';
import { fmtNum } from '../../utils/fmt';
import { LoadingBox, InsightBlock } from './ExploreComponents';

export default function HeatmapCanvas({ data, year, h = 300 }) {
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

    const CW = canvas.width;
    const CH = canvas.height;
    const ML = 52, MR = 78, MT = 36, MB = 50;
    const plotW = CW - ML - MR;
    const plotH = CH - MT - MB;

    const { x, y, z, min: dMin, max: dMax } = data;
    const nX = z[0].length;
    const nY = z.length;
    const range = dMax - dMin || 1;
    const cellW = plotW / nX;
    const cellH = plotH / nY;

    // Theme tokens
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

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, CW, CH);

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

    const latDesc = (latVal) => {
      if (latVal > 60) return t('common.latRegion.n90', { lat: latVal.toFixed(1) });
      if (latVal > 30) return t('common.latRegion.n60', { lat: latVal.toFixed(1) });
      if (latVal >= -30) return t('common.latRegion.eq', { lat: latVal.toFixed(1) });
      if (latVal >= -60) return t('common.latRegion.s60', { lat: Math.abs(latVal).toFixed(1) });
      return t('common.latRegion.s90', { lat: Math.abs(latVal).toFixed(1) });
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
