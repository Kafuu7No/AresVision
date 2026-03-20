import { useEffect, useRef } from 'react';
import { useT } from '../../i18n';
import { useSettings } from '../../contexts/SettingsContext';
import { getRgb, rdbuRgb } from '../../utils/colormaps';
import { ozoneLabel, ozoneDeltaLabel, convertOzone } from '../../utils/units';
import C from '../../constants/colors';

function fmtVal(v) {
  if (v === 0) return '0';
  if (Math.abs(v) < 0.001) return v.toExponential(2);
  return v.toFixed(3);
}

export function FieldCanvas({ fieldData, colorMode = 'inferno', h = 240 }) {
  const canvasRef = useRef(null);
  const { settings } = useSettings();
  const colormapName = settings.colormap;
  const ozoneUnit = settings.units.ozone;
  const theme = settings.theme;
  const isLight = theme === 'light';

  useEffect(() => {
    if (!fieldData || !fieldData.field) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const CW = canvas.width;
    const CH = canvas.height;
    const ML = 46, MR = 72, MT = 22, MB = 42;
    const plotW = CW - ML - MR;
    const plotH = CH - MT - MB;

    const axisTextColor  = isLight ? 'rgba(26,26,46,0.65)' : 'rgba(232,237,243,0.6)';
    const axisTitleColor = isLight ? 'rgba(26,26,46,0.4)'  : 'rgba(232,237,243,0.35)';
    const axisLineColor  = isLight ? 'rgba(26,46,80,0.2)'  : 'rgba(255,255,255,0.18)';
    const borderColor    = isLight ? 'rgba(26,46,80,0.25)' : 'rgba(255,255,255,0.18)';
    const cbBorderColor  = isLight ? 'rgba(26,46,80,0.35)' : 'rgba(255,255,255,0.25)';
    const cbLabelColor   = isLight ? 'rgba(26,26,46,0.7)'  : 'rgba(232,237,243,0.7)';
    const cbTitleColor   = isLight ? 'rgba(26,26,46,0.4)'  : 'rgba(232,237,243,0.4)';

    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(ML, MT, plotW, plotH);

    const { field, minVal, maxVal } = fieldData;
    const nLat = field.length;
    const nLon = field[0].length;

    let dMin = minVal, dMax = maxVal;
    let absMax = 0;
    if (colorMode === 'rdbu') {
      for (let li = 0; li < nLat; li++)
        for (let lj = 0; lj < nLon; lj++)
          absMax = Math.max(absMax, Math.abs(field[li][lj]));
      absMax = absMax || 1;
      dMin = -absMax;
      dMax = absMax;
    }
    const range = dMax - dMin || 1;

    const cellW = plotW / nLon;
    const cellH = plotH / nLat;

    const imgData = ctx.createImageData(plotW, plotH);
    const pixels = imgData.data;
    for (let k = 0; k < pixels.length; k += 4) {
      pixels[k] = 10; pixels[k + 1] = 10; pixels[k + 2] = 15; pixels[k + 3] = 255;
    }
    for (let li = 0; li < nLat; li++) {
      const pyStart = Math.round((nLat - 1 - li) * cellH);
      const pyEnd = Math.round((nLat - li) * cellH);
      for (let lj = 0; lj < nLon; lj++) {
        const val = field[li][lj];
        if (val == null || isNaN(val)) continue;
        const t = (val - dMin) / range;
        const rgb = colorMode === 'rdbu' ? rdbuRgb(t) : getRgb(colormapName, Math.max(0, Math.min(1, t)));
        const pxStart = Math.round(lj * cellW);
        const pxEnd = Math.round((lj + 1) * cellW);
        for (let py = pyStart; py < pyEnd; py++) {
          for (let px = pxStart; px < pxEnd; px++) {
            if (px >= plotW || py >= plotH || px < 0 || py < 0) continue;
            const idx = (py * plotW + px) * 4;
            pixels[idx] = rgb[0]; pixels[idx + 1] = rgb[1]; pixels[idx + 2] = rgb[2]; pixels[idx + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(imgData, ML, MT);

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(ML, MT, plotW, plotH);

    // Grid / Axis labels... (omitted for brevity in this scratch but should be complete in real file)
    // Actually I should provide the full implementation from PredictPage.jsx
    ctx.strokeStyle = axisLineColor;
    ctx.lineWidth = 1;
    ctx.fillStyle = axisTextColor;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    [0, 60, 120, 180, 240, 300, 360].forEach(lonV => {
      const fx = ML + (lonV / 360) * plotW;
      ctx.beginPath(); ctx.moveTo(fx, MT + plotH); ctx.lineTo(fx, MT + plotH + 4); ctx.stroke();
      ctx.fillText(`${lonV}°`, fx, MT + plotH + 15);
    });
    ctx.fillStyle = axisTitleColor;
    ctx.font = '10px sans-serif';
    ctx.fillText('Longitude (°)', ML + plotW / 2, CH - 4);

    ctx.textAlign = 'right';
    ctx.fillStyle = axisTextColor;
    ctx.font = '10px sans-serif';
    [-90, -60, -30, 0, 30, 60, 90].forEach(latV => {
      const fy = MT + ((90 - latV) / 180) * plotH;
      ctx.beginPath(); ctx.moveTo(ML, fy); ctx.lineTo(ML - 4, fy); ctx.stroke();
      ctx.fillText(`${latV}°`, ML - 6, fy + 3);
    });
    ctx.save();
    ctx.translate(10, MT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = axisTitleColor;
    ctx.font = '10px sans-serif';
    ctx.fillText('Latitude (°)', 0, 0);
    ctx.restore();

    // Colorbar
    const cbX = ML + plotW + 10;
    const cbW = 14;
    const cbH = plotH;
    const cbImgData = ctx.createImageData(cbW, cbH);
    const cbPx = cbImgData.data;
    for (let py = 0; py < cbH; py++) {
      const t = 1 - py / cbH;
      const rgb = colorMode === 'rdbu' ? rdbuRgb(t) : getRgb(colormapName, t);
      for (let px = 0; px < cbW; px++) {
        const idx = (py * cbW + px) * 4;
        cbPx[idx] = rgb[0]; cbPx[idx + 1] = rgb[1]; cbPx[idx + 2] = rgb[2]; cbPx[idx + 3] = 255;
      }
    }
    ctx.putImageData(cbImgData, cbX, MT);
    ctx.strokeStyle = cbBorderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(cbX, MT, cbW, cbH);

    const lbX = cbX + cbW + 3;
    ctx.textAlign = 'left';
    ctx.fillStyle = cbLabelColor;
    ctx.font = '9px sans-serif';
    const topLabel = colorMode === 'rdbu' ? `+${fmtVal(convertOzone(absMax, ozoneUnit))}` : fmtVal(convertOzone(dMax, ozoneUnit));
    const midLabel = colorMode === 'rdbu' ? '0' : fmtVal(convertOzone((dMin + dMax) / 2, ozoneUnit));
    const botLabel = colorMode === 'rdbu' ? `-${fmtVal(convertOzone(absMax, ozoneUnit))}` : fmtVal(convertOzone(dMin, ozoneUnit));
    ctx.fillText(topLabel, lbX, MT + 8);
    ctx.fillText(midLabel, lbX, MT + cbH / 2 + 3);
    ctx.fillText(botLabel, lbX, MT + cbH);

    ctx.save();
    ctx.translate(cbX + cbW / 2, MT + cbH + 22);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = cbTitleColor;
    ctx.font = '9px sans-serif';
    ctx.fillText(colorMode === 'rdbu' ? ozoneDeltaLabel(ozoneUnit) : ozoneLabel(ozoneUnit), 0, 0);
    ctx.restore();

  }, [fieldData, colorMode, h, colormapName, ozoneUnit, theme]);

  return (
    <div style={isLight ? { borderRadius: 10, overflow: 'hidden', background: '#f5f6f8' } : {}}>
      <canvas
        ref={canvasRef}
        width={720}
        height={h}
        className="observation-window"
        style={{ width: '100%', height: h, display: 'block', background: 'transparent' }}
      />
    </div>
  );
}

export function LoadingBox({ h = 240 }) {
  const t = useT();
  return (
    <div style={{
      height: h, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.02)', borderRadius: 8,
    }}>
      <div style={{
        width: 28, height: 28, border: `3px solid ${C.border}`,
        borderTop: `3px solid ${C.mars}`, borderRadius: '50%',
        animation: 'spin-slow 0.9s linear infinite',
      }} />
      <div style={{ marginTop: 10, fontSize: 12, color: C.ice30 }}>{t('predict.computing')}</div>
    </div>
  );
}

export function EmptyBox({ h = 240 }) {
  const t = useT();
  return (
    <div style={{
      height: h, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.02)', borderRadius: 8,
      fontSize: 11, color: C.ice30,
    }}>
      {t('predict.clickToStart')}
    </div>
  );
}
