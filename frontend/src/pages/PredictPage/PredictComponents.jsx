import { useRef, useEffect } from 'react'; // Re-triggering vite cache
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useSettings } from '../../contexts/SettingsContext';
import { getRgb, rdbuRgb } from '../../utils/colormaps';
import { ozoneLabel, ozoneDeltaLabel, convertOzone } from '../../utils/units';

// fmtVal 用于 Canvas 色阶标签（精度固定 3 位，与精度设置无关，因其在 useEffect 绘图中使用）
export function fmtVal(v) {
  if (v === 0) return '0';
  if (Math.abs(v) < 0.001) return v.toExponential(2);
  return v.toFixed(3);
}

// ─── Canvas 场热力图（带坐标轴 + Colorbar） ───

export function FieldCanvas({ fieldData, colorMode = 'inferno', h = 240 }) {
  const canvasRef = useRef(null);
  const t = useT();
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

    const CW = canvas.width;   // 720
    const CH = canvas.height;  // h
    const ML = 46, MR = 72, MT = 22, MB = 42;
    const plotW = CW - ML - MR;
    const plotH = CH - MT - MB;

    const isLight = theme === 'light';
    const axisTextColor  = isLight ? '#000000' : '#ffffff';
    const axisTitleColor = isLight ? '#000000' : '#ffffff';
    const axisLineColor  = isLight ? '#000000' : '#ffffff';
    const borderColor    = isLight ? '#000000' : '#ffffff';
    const cbBorderColor  = isLight ? '#000000' : '#ffffff';
    const cbLabelColor   = isLight ? '#000000' : '#ffffff';
    const cbTitleColor   = isLight ? '#000000' : '#ffffff';

    // 只填充绘图区背景，边距保持透明（浅色主题下边距显示卡片白色背景）
    ctx.clearRect(0, 0, CW, CH);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(ML, MT, plotW, plotH);

    const { field, minVal, maxVal } = fieldData;
    const nLat = field.length;    // 36
    const nLon = field[0].length; // 72

    // 计算色阶范围
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

    // 绘制热力图主体（ImageData）
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

    // 图框边框
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(ML, MT, plotW, plotH);

    // X 轴（经度）
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
    ctx.fillText(`${t('overview.controls.longitude', '经度')} (°)`, ML + plotW / 2, CH - 4);

    // Y 轴（纬度）
    ctx.textAlign = 'right';
    ctx.fillStyle = axisTextColor;
    ctx.font = '10px sans-serif';
    [-90, -60, -30, 0, 30, 60, 90].forEach(latV => {
      const fy = MT + ((90 - latV) / 180) * plotH;
      ctx.beginPath(); ctx.moveTo(ML, fy); ctx.lineTo(ML - 4, fy); ctx.stroke();
      ctx.fillText(`${latV}°`, ML - 6, fy + 3);
    });
    // Y 轴旋转标签
    ctx.save();
    ctx.translate(10, MT + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = axisTitleColor;
    ctx.font = '10px sans-serif';
    ctx.fillText(`${t('overview.controls.latitude', '纬度')} (°)`, 0, 0);
    ctx.restore();


    // Colorbar
    const cbX = ML + plotW + 10;
    const cbW = 14;
    const cbH = plotH;
    const cbImgData = ctx.createImageData(cbW, cbH);
    const cbPx = cbImgData.data;
    for (let py = 0; py < cbH; py++) {
      const t = 1 - py / cbH; // 顶部=高值
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

    // Colorbar 刻度标签
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

    // Colorbar 单位
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
    <div style={isLight ? { borderRadius: 10, overflow: 'hidden', background: 'transparent' } : {}}>
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

// ─── 辅助组件 ───

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

// ─── 常量 ───

export const VARIABLE_DEFS = [
  { id: 'Temperature',        icon: '🌡',  color: '#ff6b4a' },
  { id: 'Dust_Optical_Depth', icon: '🌫',  color: '#d4a06a' },
  { id: 'Solar_Flux_DN',      icon: '☀️', color: '#ffd740' },
  { id: 'U_Wind',             icon: '💨',  color: '#4a9eff' },
  { id: 'V_Wind',             icon: '🌬',  color: '#7c5cbf' },
];

export const METRIC_META = [
  { key: 'rmse', name: 'RMSE', unit: 'μm-atm', better: '↓', color: C.mars },
  { key: 'mae', name: 'MAE', unit: 'μm-atm', better: '↓', color: C.mars },
  { key: 'ssim', name: 'SSIM', unit: '', better: '↑', color: '#4acfac' },
  { key: 'r2', name: 'R²', unit: '', better: '↑', color: '#4acfac' },
];

export const VIEW_MODE_IDS = ['triptych', 'original', 'prediction', 'diff'];

export const TRIPTYCH_PANEL_DEFS = [
  { key: 'truth',      color: C.blue,    mode: 'inferno' },
  { key: 'prediction', color: C.mars,    mode: 'inferno' },
  { key: 'residual',   color: '#9c7bea', mode: 'rdbu' },
];
