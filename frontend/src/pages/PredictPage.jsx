import { useState, useEffect, useRef, useCallback } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useSettings } from '../contexts/SettingsContext';
import SectionTitle from '../components/SectionTitle';
import GlowCard from '../components/GlowCard';
import { runPrediction, fetchPredictMetrics, fetchPerformanceCurve } from '../services/api';
import Plot from 'react-plotly.js';
import SphericalFieldCanvas from '../components/SphericalFieldCanvas';

import { getRgb, rdbuRgb } from '../utils/colormaps';
import { ozoneLabel, ozoneDeltaLabel, convertOzone } from '../utils/units';
import { fmtNum } from '../utils/fmt';

// fmtVal 用于 Canvas 色阶标签（精度固定 3 位，与精度设置无关，因其在 useEffect 绘图中使用）
function fmtVal(v) {
  if (v === 0) return '0';
  if (Math.abs(v) < 0.001) return v.toExponential(2);
  return v.toFixed(3);
}

// ─── Canvas 场热力图（带坐标轴 + Colorbar） ───

function FieldCanvas({ fieldData, colorMode = 'inferno', h = 240 }) {
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

    const CW = canvas.width;   // 720
    const CH = canvas.height;  // h
    const ML = 46, MR = 72, MT = 22, MB = 42;
    const plotW = CW - ML - MR;
    const plotH = CH - MT - MB;

    const isLight = theme === 'light';
    const axisTextColor  = isLight ? 'rgba(26,26,46,0.65)' : 'rgba(232,237,243,0.6)';
    const axisTitleColor = isLight ? 'rgba(26,26,46,0.4)'  : 'rgba(232,237,243,0.35)';
    const axisLineColor  = isLight ? 'rgba(26,46,80,0.2)'  : 'rgba(255,255,255,0.18)';
    const borderColor    = isLight ? 'rgba(26,46,80,0.25)' : 'rgba(255,255,255,0.18)';
    const cbBorderColor  = isLight ? 'rgba(26,46,80,0.35)' : 'rgba(255,255,255,0.25)';
    const cbLabelColor   = isLight ? 'rgba(26,26,46,0.7)'  : 'rgba(232,237,243,0.7)';
    const cbTitleColor   = isLight ? 'rgba(26,26,46,0.4)'  : 'rgba(232,237,243,0.4)';

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
    ctx.fillText('Longitude (°)', ML + plotW / 2, CH - 4);

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
    ctx.fillText('Latitude (°)', 0, 0);
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

// ─── 辅助组件 ───

function LoadingBox({ h = 240 }) {
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

function EmptyBox({ h = 240 }) {
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

const VARIABLE_DEFS = [
  { id: 'Temperature',        icon: '🌡',  color: '#ff6b4a' },
  { id: 'Dust_Optical_Depth', icon: '🌫',  color: '#d4a06a' },
  { id: 'Solar_Flux_DN',      icon: '☀️', color: '#ffd740' },
  { id: 'U_Wind',             icon: '💨',  color: '#4a9eff' },
  { id: 'V_Wind',             icon: '🌬',  color: '#7c5cbf' },
];

const METRIC_META = [
  { key: 'rmse', name: 'RMSE', unit: 'μm-atm', better: '↓', color: C.mars },
  { key: 'mae', name: 'MAE', unit: 'μm-atm', better: '↓', color: C.mars },
  { key: 'ssim', name: 'SSIM', unit: '', better: '↑', color: '#4acfac' },
  { key: 'r2', name: 'R²', unit: '', better: '↑', color: '#4acfac' },
];

const VIEW_MODE_IDS = ['triptych', 'original', 'prediction', 'diff'];

const TRIPTYCH_PANEL_DEFS = [
  { key: 'truth',      color: C.blue,    mode: 'inferno' },
  { key: 'prediction', color: C.mars,    mode: 'inferno' },
  { key: 'residual',   color: '#9c7bea', mode: 'rdbu' },
];

// ─── 主页面 ───

export default function PredictPage() {
  const t = useT();
  const { settings } = useSettings();
  const precision = settings.precision;
  const ozoneUnit = settings.units.ozone;
  const isLight = settings.theme === 'light';
  const plotTextColor  = isLight ? 'rgba(26,26,46,0.5)'  : 'rgba(232,237,243,0.3)';
  const plotText60     = isLight ? 'rgba(26,26,46,0.65)' : 'rgba(232,237,243,0.6)';
  const plotGridColor  = isLight ? 'rgba(26,26,46,0.08)' : 'rgba(255,255,255,0.05)';
  const VARIABLES = VARIABLE_DEFS.map(v => ({ ...v, label: t(`predict.variables.${v.id}`) }));
  const VIEW_MODES = VIEW_MODE_IDS.map(id => ({ id, label: t(`predict.viewModes.${id}`) }));
  const TRIPTYCH_PANELS = TRIPTYCH_PANEL_DEFS.map(p => ({ ...p, title: t(`predict.panels.${p.key}`) }));

  const [selectedVars, setSelectedVars] = useState(VARIABLE_DEFS.map((v) => v.id));
  const [predStep, setPredStep] = useState(3);
  const [lsStart, setLsStart] = useState(90);
  const [marsYear, setMarsYear] = useState(27);
  const [activeHorizon, setActiveHorizon] = useState(0);
  const [viewMode, setViewMode] = useState('triptych');

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  // 控制整个网页 3D 悬浮球体
  const [fullscreen3D, setFullscreen3D] = useState(null); // { fieldData, colorMode }

  // 性能曲线数据
  const [performanceData, setPerformanceData] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);

  // ... (toggleVar remains same)
  const toggleVar = (id) => {
    setSelectedVars((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleFetchPerformance = useCallback(async () => {
    setPerfLoading(true);
    try {
      const body = {
        selected_variables: selectedVars,
        horizon: predStep,
        ls_start: lsStart,
        mars_year: marsYear,
      };
      const res = await fetchPerformanceCurve(body);
      setPerformanceData(res);
    } catch (e) {
      console.error('Fetch performance error:', e);
    } finally {
      setPerfLoading(false);
    }
  }, [selectedVars, predStep, lsStart, marsYear]);

  const handlePredict = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setMetrics(null);

    const body = {
      selected_variables: selectedVars,
      horizon: predStep,
      ls_start: lsStart,
      mars_year: marsYear,
    };

    try {
      const [predResult, metricsResult] = await Promise.all([
        runPrediction(body),
        fetchPredictMetrics(body),
      ]);
      setResults(predResult);
      setMetrics(metricsResult);
      setActiveHorizon(0);
    } catch (e) {
      setError(e.message || t('predict.errorPrefix'));
    } finally {
      setLoading(false);
    }
  }, [selectedVars, predStep, lsStart, marsYear]);

  // 当前显示步数据
  const step = results ? Math.min(activeHorizon, results.horizon - 1) : 0;
  const truthField = results?.ground_truth?.[step] ?? null;
  const predField = results?.prediction?.[step] ?? null;
  const residField = results?.residual?.[step] ?? null;
  const stepLs = results?.ls_values?.[step];

  const stepLabel = (ls) => ls != null ? ` · Ls=${ls.toFixed(3)}°` : '';

  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionTitle title={t('predict.title')} subtitle={t('predict.subtitle')} />

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>

        {/* ─── 左侧控制栏 ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 预测控制 */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
              PREDICTION CONTROL
            </div>
            <div style={{ fontSize: 11, color: C.ice30, marginBottom: 10 }}>{t('predict.horizon')}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[1, 2, 3].map((s) => (
                <button key={s} onClick={() => setPredStep(s)} style={{
                  flex: 1, padding: '10px 0',
                  background: predStep === s ? 'rgba(199,91,57,0.2)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${predStep === s ? C.mars : C.border}`,
                  borderRadius: 8, color: predStep === s ? C.mars : C.ice60,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'Orbitron', sans-serif",
                }}>+{s}</button>
              ))}
            </div>
            <button
              onClick={handlePredict}
              disabled={loading}
              style={{
                width: '100%', padding: '14px 0',
                background: loading
                  ? 'rgba(199,91,57,0.3)'
                  : `linear-gradient(135deg, ${C.mars}, ${C.marsLight})`,
                border: 'none', borderRadius: 10, color: '#fff',
                fontSize: 13, fontWeight: 700,
                fontFamily: "'Orbitron', sans-serif", letterSpacing: 2,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 24px rgba(199,91,57,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                    borderTop: '2px solid #fff', borderRadius: '50%',
                    animation: 'spin-slow 0.8s linear infinite',
                  }} />
                  {t('predict.runningBtn')}
                </>
              ) : t('predict.runBtn')}
            </button>

            {error && (
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 8,
                background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)',
                fontSize: 11, color: '#ff6b6b', lineHeight: 1.6,
              }}>
                {error}
              </div>
            )}
          </GlowCard>

          {/* 参数设置 */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
              PARAMETERS
            </div>

            {/* 火星年 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: C.ice30, marginBottom: 6 }}>{t('predict.marsYear')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[27, 28].map((y) => (
                  <button key={y} onClick={() => setMarsYear(y)} style={{
                    flex: 1, padding: '8px 0',
                    background: marsYear === y ? 'rgba(199,91,57,0.2)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${marsYear === y ? C.mars : C.border}`,
                    borderRadius: 8, color: marsYear === y ? C.mars : C.ice60,
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    fontFamily: "'Orbitron', sans-serif",
                  }}>MY{y}</button>
                ))}
              </div>
            </div>

            {/* 起始 Ls 滑块 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: C.ice30 }}>{t('predict.startLs')}</span>
                <span style={{ fontSize: 12, color: C.ice, fontFamily: "'Orbitron', sans-serif" }}>{lsStart}°</span>
              </div>
              <input
                type="range" min={0} max={355} step={1}
                value={lsStart}
                onChange={(e) => setLsStart(Number(e.target.value))}
                style={{ width: '100%', accentColor: C.mars }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.ice30, marginTop: 4 }}>
                <span>{t('predict.lsMarks.spring')}</span><span>{t('predict.lsMarks.summer')}</span><span>{t('predict.lsMarks.autumn')}</span><span>{t('predict.lsMarks.winter')}</span>
              </div>
            </div>
          </GlowCard>

          {/* 变量勾选 */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
              INPUT VARIABLES
            </div>
            <div style={{ fontSize: 11, color: C.ice30, marginBottom: 12, lineHeight: 1.6 }}>
              {t('predict.envVarsLabel')}
            </div>
            {VARIABLES.map((v) => (
              <label key={v.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', marginBottom: 4, borderRadius: 8,
                background: selectedVars.includes(v.id) ? 'rgba(74,158,255,0.06)' : 'transparent',
                border: `1px solid ${selectedVars.includes(v.id) ? 'rgba(74,158,255,0.15)' : 'transparent'}`,
                cursor: 'pointer', transition: 'all 0.2s',
              }}>
                <input
                  type="checkbox"
                  checked={selectedVars.includes(v.id)}
                  onChange={() => toggleVar(v.id)}
                  style={{ accentColor: v.color }}
                />
                <span style={{ fontSize: 14 }}>{v.icon}</span>
                <span style={{ fontSize: 12, color: selectedVars.includes(v.id) ? C.ice : C.ice30 }}>{v.label}</span>
              </label>
            ))}
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(199,91,57,0.08)', fontSize: 11, color: C.ice30 }}>
              {t('predict.envVarsNote', { selected: selectedVars.length })}
            </div>
          </GlowCard>

          {/* File Upload */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
              FILE UPLOAD
            </div>
            <div style={{
              border: `2px dashed ${C.border}`,
              borderRadius: 12,
              padding: 28,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>📁</div>
              <div style={{ fontSize: 13, color: C.ice60 }}>{t('predict.fileUpload.drag')}</div>
              <div style={{ fontSize: 11, color: C.ice30, marginTop: 4 }}>{t('predict.fileUpload.click')}</div>
            </div>
          </GlowCard>
        </div>

        {/* ─── 右侧结果区 ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 视图切换 Tab */}
          <div style={{ display: 'flex', gap: 8 }}>
            {VIEW_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setViewMode(m.id)}
                style={{
                  padding: '8px 16px',
                  background: viewMode === m.id ? 'rgba(74,158,255,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${viewMode === m.id ? C.blue : C.border}`,
                  borderRadius: 8, fontSize: 12, fontWeight: 600,
                  color: viewMode === m.id ? C.blue : C.ice30,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* 预测步骤选择（有多步结果时显示） */}
          {results && results.horizon > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.ice30, marginRight: 4 }}>{t('predict.showStep')}</span>
              {Array.from({ length: results.horizon }, (_, i) => (
                <button key={i} onClick={() => setActiveHorizon(i)} style={{
                  padding: '6px 16px',
                  background: activeHorizon === i ? 'rgba(74,158,255,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${activeHorizon === i ? C.blue : C.border}`,
                  borderRadius: 8, fontSize: 12, fontWeight: 600,
                  color: activeHorizon === i ? C.blue : C.ice30, cursor: 'pointer',
                }}>
                  Step {i + 1}{results.ls_values[i] != null ? ` (Ls=${results.ls_values[i].toFixed(3)}°)` : ''}
                </button>
              ))}
            </div>
          )}

          {/* 三联对比视图 */}
          {viewMode === 'triptych' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              {TRIPTYCH_PANELS.map((panel, i) => {
                const fieldData = i === 0 ? truthField : i === 1 ? predField : residField;
                return (
                  <GlowCard key={i} breathe style={{ padding: 16 }}>
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: panel.color,
                      fontFamily: "'Orbitron', sans-serif", letterSpacing: 1,
                      marginBottom: 8, textAlign: 'center',
                    }}>
                      {panel.title}
                      {stepLs != null && (
                        <span style={{ fontSize: 9, color: C.ice30, marginLeft: 6 }}>
                          Ls={stepLs.toFixed(3)}°
                        </span>
                      )}
                    </div>
                    {loading ? (
                      <LoadingBox h={220} />
                    ) : fieldData ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <FieldCanvas fieldData={fieldData} colorMode={panel.mode} h={220} />
                        <button
                          onClick={() => setFullscreen3D({ fieldData, colorMode: panel.mode })}
                          style={{
                            width: '100%', padding: '8px 0',
                            background: 'rgba(74,158,255,0.06)',
                            border: `1px solid rgba(74,158,255,0.2)`, borderRadius: 6,
                            color: '#4acfac', fontSize: 11, cursor: 'pointer',
                            fontFamily: "'Orbitron', sans-serif", letterSpacing: 1,
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(74,158,255,0.15)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(74,158,255,0.06)' }}
                        >
                          🌐 3D GLOBE VIEW
                        </button>
                      </div>
                    ) : (
                      <EmptyBox h={220} />
                    )}
                  </GlowCard>
                );
              })}
            </div>
          )}

          {/* 单图视图 */}
          {viewMode !== 'triptych' && (() => {
            // eslint-disable-next-line no-unused-vars
            const isResid = viewMode === 'diff';
            const fd = viewMode === 'original' ? truthField : viewMode === 'prediction' ? predField : residField;
            const panelTitle = viewMode === 'original'
              ? `${t('predict.panels.truth')}${stepLabel(stepLs)}`
              : viewMode === 'prediction'
                ? `${t('predict.panels.prediction')}${stepLabel(stepLs)}`
                : `${t('predict.panels.residual')}${stepLabel(stepLs)}`;
            const panelColor = viewMode === 'original' ? C.blue : viewMode === 'prediction' ? C.mars : '#9c7bea';
            return (
              <GlowCard breathe style={{ padding: 20 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: panelColor,
                  fontFamily: "'Orbitron', sans-serif", letterSpacing: 1,
                  marginBottom: 12, textAlign: 'center',
                }}>
                  {panelTitle}
                </div>
                {loading ? (
                  <LoadingBox h={400} />
                ) : fd ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <FieldCanvas fieldData={fd} colorMode={isResid ? 'rdbu' : 'inferno'} h={400} />
                    <button
                      onClick={() => setFullscreen3D({ fieldData: fd, colorMode: isResid ? 'rdbu' : 'inferno' })}
                      style={{
                        width: '100%', padding: '12px 0',
                        background: 'rgba(74,158,255,0.06)',
                        border: `1px dashed rgba(74,158,255,0.3)`, borderRadius: 8,
                        color: '#4acfac', fontSize: 13, cursor: 'pointer',
                        fontFamily: "'Orbitron', sans-serif", letterSpacing: 1.5,
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(74,158,255,0.15)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(74,158,255,0.06)' }}
                    >
                      🌐 VIEW IN 3D GLOBE
                    </button>
                  </div>
                ) : (
                  <EmptyBox h={400} />
                )}
              </GlowCard>
            );
          })()}

          {/* 当前应用模型信息 */}
          {results && results.model_info && (
            <GlowCard style={{ padding: '16px 20px', border: results.model_info.is_fallback ? '1px solid rgba(255,80,80,0.3)' : `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ 
                    width: 32, height: 32, borderRadius: '50%', 
                    background: results.model_info.is_fallback ? 'rgba(255,80,80,0.1)' : 'rgba(74,207,172,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16
                  }}>
                    {results.model_info.is_fallback ? '⚠️' : '🎯'}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.ice30, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>CURRENT ACTIVE MODEL</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.ice, marginTop: 2 }}>
                      PredRNNv2 <span style={{ color: C.blue }}>_{results.model_info.suffix}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 24 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: C.ice30 }}>INPUT CHANNELS</div>
                    <div style={{ 
                      fontSize: 11, fontWeight: 600, color: results.model_info.is_fallback ? '#ff8a8a' : '#4acfac', 
                      marginTop: 2, display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap', maxWidth: 200 
                    }}>
                      {results.model_info.input_vars.map((v, idx) => (
                        <span key={v} style={{ 
                          padding: '1px 5px', background: 'rgba(255,255,255,0.05)', borderRadius: 4 
                        }}>
                          {v.replace('_Optical_Depth', '').replace('_Flux_DN', '').replace('_Wind', '')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: C.ice30 }}>INPUT DIM</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ice }}>{results.model_info.input_dim} Ch</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: C.ice30 }}>WEIGHT FILE</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.ice }}>{results.model_info.weight_file}</div>
                  </div>
                </div>
              </div>

              {results.model_info.is_fallback && (
                <div style={{ 
                  marginTop: 12, padding: '10px 14px', borderRadius: 8, 
                  background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)',
                  display: 'flex', alignItems: 'flex-start', gap: 10
                }}>
                  <span style={{ fontSize: 14 }}>💡</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#ff6b6b' }}>{t('predict.fallbackWarning')}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,107,107,0.7)', marginTop: 2 }}>
                      {t('predict.fallbackReason')}{results.model_info.fallback_reason}
                    </div>
                  </div>
                </div>
              )}
            </GlowCard>
          )}

          {/* 评估指标 */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
              {t('predict.evalTitle')}
            </div>

            {/* 四大指标卡片 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
              {METRIC_META.map((m) => {
                const val = metrics?.overall?.[m.key];
                return (
                  <div key={m.key} style={{
                    padding: 16, borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${C.border}`, textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 10, color: C.ice30, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>{m.name}</div>
                    <div style={{
                      fontSize: 26, fontWeight: 800, color: C.ice,
                      fontFamily: "'Orbitron', sans-serif", marginTop: 8,
                    }}>
                      {loading ? '…' : val != null ? fmtNum(val, precision) : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: m.color, marginTop: 4 }}>
                      {m.better} {m.key === 'rmse' || m.key === 'mae' ? ozoneLabel(ozoneUnit) : m.unit}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 逐步指标表格 */}
            {metrics?.per_step && metrics.per_step.length > 1 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: C.ice30, marginBottom: 8 }}>{t('predict.perStepTitle')}</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Step', 'Ls', 'RMSE', 'MAE', 'SSIM', 'R²'].map((hd) => (
                        <th key={hd} style={{
                          padding: '6px 10px', textAlign: 'center',
                          color: C.ice30, fontWeight: 600,
                          borderBottom: `1px solid ${C.border}`,
                        }}>{hd}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.per_step.map((row, i) => (
                      <tr
                        key={i}
                        onClick={() => setActiveHorizon(i)}
                        style={{
                          background: activeHorizon === i ? 'rgba(74,158,255,0.06)' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: C.blue, fontWeight: 700 }}>Step {row.step}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: C.ice60 }}>
                          {results?.ls_values?.[i] != null ? `${results.ls_values[i].toFixed(3)}°` : '—'}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: C.ice }}>{fmtNum(row.rmse, precision)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: C.ice }}>{fmtNum(row.mae, precision)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: '#4acfac' }}>{fmtNum(row.ssim, precision)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: '#4acfac' }}>{fmtNum(row.r2, precision)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 指标解读文字 */}
            {metrics && results && (
              <div style={{
                background: 'rgba(199,91,57,0.06)',
                borderLeft: '3px solid rgba(199,91,57,0.4)',
                borderRadius: 8,
                padding: '12px 16px',
                fontSize: 12,
                color: C.ice60,
                lineHeight: 1.8,
              }}>
                <strong style={{ color: C.ice }}>{t('predict.summaryDone')}</strong>：{t('predict.summaryL1', { lsStart, year: marsYear, horizon: results.horizon })}<br />
                {t('predict.summaryL2a', { varCount: results.selected_variables.length })}
                {results.selected_variables.length > 0
                  ? t('predict.summaryL2b', { varNames: results.selected_variables.join('、') })
                  : t('predict.summaryL2c')}。<br />
                {t('predict.summaryL3a')}<span style={{ color: C.mars }}>{fmtNum(metrics.overall.rmse, precision)}{t('predict.summaryL3b')}</span>
                <span style={{ color: '#4acfac' }}>{fmtNum(metrics.overall.ssim, precision)}</span>
                {t('predict.summaryL3c')}<span style={{ color: '#4acfac' }}>{fmtNum(metrics.overall.r2, precision)}</span>。
              </div>
            )}
          </GlowCard>

          {/* 模型性能趋势 (测试集) */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4acfac', fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>
                {t('predict.perfTitle')}
              </div>
              <button
                onClick={handleFetchPerformance}
                disabled={perfLoading}
                style={{
                  padding: '6px 12px', background: 'rgba(74,158,255,0.1)',
                  border: `1px solid ${C.blue}`, borderRadius: 6,
                  color: C.blue, fontSize: 10, cursor: 'pointer',
                  fontFamily: "'Orbitron', sans-serif", transition: 'all 0.2s'
                }}
              >
                {perfLoading ? t('predict.generatingBtn') : t('predict.generateBtn')}
              </button>
            </div>

            {performanceData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* 2D 趋势图表 */}
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  padding: '16px',
                  height: 380
                }}>
                  <Plot
                    data={[
                      {
                        // 计算连续时间轴：MY27 原始 Ls，MY28 累加 360
                        x: performanceData.items.map(it => it.my === 27 ? it.ls : it.ls + 360),
                        y: performanceData.items.map(it => it.r2),
                        type: 'scatter',
                        mode: 'lines+markers',
                        name: 'R² Score',
                        marker: {
                          color: C.mars,
                          size: 7,
                          line: { color: 'rgba(255,255,255,0.5)', width: 1 }
                        },
                        line: {
                          color: C.mars,
                          width: 3,
                          shape: 'spline'
                        },
                        fill: 'tozeroy',
                        fillcolor: 'rgba(199,91,57,0.08)',
                        hovertemplate: '<b>MY%{text}</b><br>Ls: %{customdata:.2f}°<br>R²: <b>%{y:.4f}</b><extra></extra>',
                        text: performanceData.items.map(it => it.my),
                        customdata: performanceData.items.map(it => it.ls)
                      }
                    ]}
                    layout={{
                      autosize: true,
                      height: 340,
                      margin: { l: 50, r: 30, t: 20, b: 50 },
                      paper_bgcolor: 'rgba(0,0,0,0)',
                      plot_bgcolor: 'rgba(0,0,0,0)',
                      xaxis: {
                        title: { text: 'Solar Longitude progression (MY27 → MY28)', font: { size: 11, color: plotTextColor } },
                        tickfont: { size: 10, color: plotText60 },
                        gridcolor: plotGridColor,
                        zeroline: false,
                        showgrid: true
                      },
                      yaxis: {
                        title: { text: 'R² (Spatial Accuracy)', font: { size: 11, color: plotTextColor } },
                        tickfont: { size: 10, color: plotText60 },
                        gridcolor: plotGridColor,
                        zeroline: false,
                        range: [0, 1.0]
                      },
                      shapes: [
                        {
                          type: 'line',
                          x0: 360, x1: 360,
                          y0: 0, y1: 1,
                          yref: 'paper',
                          line: { color: 'rgba(255,255,255,0.2)', width: 1, dash: 'dash' }
                        }
                      ],
                      annotations: [
                        {
                          x: 360, y: 1.05,
                          xref: 'x', yref: 'y',
                          text: 'NEW YEAR (MY28)',
                          showarrow: false,
                          font: { color: plotTextColor, size: 9 }
                        }
                      ],
                      hovermode: 'closest',
                      showlegend: false
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* 底部数据明细表 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ 
                      padding: '12px 16px', 
                      background: 'rgba(74,207,172,0.1)', 
                      borderRadius: 10, 
                      border: '1px solid rgba(74,207,172,0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}>
                      <span style={{ fontSize: 10, color: C.ice30, fontWeight: 600 }}>{t('predict.avgR2')}</span>
                      <span style={{ fontSize: 20, color: '#4acfac', fontWeight: 800, fontFamily: "'Orbitron', sans-serif" }}>
                        {fmtNum(performanceData.items.reduce((acc, it) => acc + it.r2, 0) / performanceData.items.length, precision)}
                      </span>
                    </div>

                    <div style={{ 
                      padding: '12px 16px', 
                      background: 'rgba(74,158,255,0.1)', 
                      borderRadius: 10, 
                      border: '1px solid rgba(74,158,255,0.3)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: C.ice30, fontWeight: 600 }}>{t('predict.globalR2')}</span>
                        <div style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: 4, fontSize: 8, color: C.ice30 }}>Flattened</div>
                      </div>
                      <span style={{ fontSize: 20, color: C.blue, fontWeight: 800, fontFamily: "'Orbitron', sans-serif" }}>
                        {performanceData.global_r2 ? fmtNum(performanceData.global_r2, precision) : fmtNum(0, precision)}
                      </span>
                    </div>
                  </div>

                  <div style={{ maxHeight: 180, overflowY: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead style={{ position: 'sticky', top: 0, background: '#0a0a0f', zIndex: 1 }}>
                        <tr>
                          {[t('predict.tableHeaders.my'), t('predict.tableHeaders.ls'), t('predict.tableHeaders.r2')].map(h => (
                            <th key={h} style={{ padding: '10px', textAlign: 'center', color: C.ice30, borderBottom: `1px solid ${C.border}`, fontWeight: 600 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {performanceData.items.map((it, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                            <td style={{ padding: '10px', textAlign: 'center', color: C.ice60 }}>MY{it.my}</td>
                            <td style={{ padding: '10px', textAlign: 'center', color: C.ice60 }}>{it.ls.toFixed(2)}°</td>
                            <td style={{
                              padding: '10px', textAlign: 'center',
                              color: it.r2 > 0.9 ? '#4acfac' : it.r2 > 0.8 ? '#ffd740' : C.mars,
                              fontWeight: 700
                            }}>{fmtNum(it.r2, precision)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '40px 0', textAlign: 'center', color: C.ice30, fontSize: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: `1px dashed ${C.border}` }}>
                {perfLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 20, height: 20, border: '2px solid rgba(74,207,172,0.2)', borderTop: '2px solid #4acfac', borderRadius: '50%', animation: 'spin-slow 0.8s linear infinite' }} />
                    {t('predict.generatingHint')}
                  </div>
                ) : t('predict.perfEmptyHint')}
              </div>
            )}
            <div style={{ marginTop: 12, fontSize: 10, color: C.ice30, fontStyle: 'italic' }}>
              {t('predict.testSetNote')}
            </div>
          </GlowCard>

          {/* 初始提示（无结果时） */}
          {!results && !loading && (
            <GlowCard style={{ padding: 28, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔭</div>
              <div style={{ fontSize: 14, color: C.ice60, marginBottom: 8 }}>
                {t('predict.initPrompt')}
              </div>
              <div style={{ fontSize: 12, color: C.ice30, lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                {t('predict.initDesc')}
              </div>
            </GlowCard>
          )}
        </div>
      </div>

      {/* 沉浸式 3D 全屏球体层 */}
      {fullscreen3D && (() => {
        const titleText = fullscreen3D.colorMode === 'rdbu' ? t('predict.fullscreen3D.residual') :
          (fullscreen3D.fieldData === truthField ? t('predict.fullscreen3D.truth') : t('predict.fullscreen3D.prediction'));
        const minValStr = fmtNum(convertOzone(fullscreen3D.fieldData.minVal, ozoneUnit), precision);
        const maxValStr = fmtNum(convertOzone(fullscreen3D.fieldData.maxVal, ozoneUnit), precision);
        const rawMin = fullscreen3D.fieldData.minVal, rawMax = fullscreen3D.fieldData.maxVal;
        const rangeStr = fmtNum(convertOzone(rawMax - rawMin, ozoneUnit), precision);
        const colorTitle = fullscreen3D.colorMode === 'rdbu' ? ozoneDeltaLabel(ozoneUnit) : ozoneLabel(ozoneUnit);
        const absExtreme = convertOzone(Math.max(Math.abs(rawMin), Math.abs(rawMax)), ozoneUnit);
        const topLabel = fullscreen3D.colorMode === 'rdbu' ? `+${fmtNum(absExtreme, precision)}` : maxValStr;
        const midLabel = fullscreen3D.colorMode === 'rdbu' ? '0' : fmtNum(convertOzone((rawMin + rawMax) / 2, ozoneUnit), precision);
        const botLabel = fullscreen3D.colorMode === 'rdbu' ? `-${fmtNum(absExtreme, precision)}` : minValStr;

        return (
          <div
            onDoubleClick={() => setFullscreen3D(null)}
            className="panel-dark"
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 9999, background: 'rgba(5, 5, 10, 0.98)',
              display: 'flex', justifyContent: 'center', alignItems: 'center',
              cursor: 'zoom-out'
            }}
          >
            <SphericalFieldCanvas
              fieldData={fullscreen3D.fieldData}
              colorMode={fullscreen3D.colorMode}
              h="100vh"
              forceFullscreen
            />

            {/* HUD 左侧控制台 (Side Dashboard Panel) */}
            <div style={{
              position: 'absolute', top: 80, left: 40, bottom: 40, width: 340,
              padding: '24px', background: 'rgba(20,20,30,0.65)',
              backdropFilter: 'blur(16px)', border: `1px solid ${C.border}`,
              borderRadius: 16, boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
              display: 'flex', flexDirection: 'column', gap: 24,
              pointerEvents: 'none', zIndex: 10,
              boxSizing: 'border-box'
            }}>

              {/* 1. 顶部块：当前场数据上下文 */}
              <div style={{ paddingBottom: 16, borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
                <div style={{
                  fontSize: 18, fontWeight: 800, color: C.ice,
                  fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 8,
                  textShadow: '0 0 10px rgba(255,255,255,0.3)'
                }}>
                  {titleText}
                </div>
                <div style={{ fontSize: 13, color: C.ice30, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>
                  {stepLs != null ? `Ls = ${stepLs.toFixed(3)}° | Step ${step + 1}` : 'Global View'}
                </div>
              </div>

              {/* 2. 中间块上：全局数据统计 */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
                  GLOBAL STATISTICS
                </div>
                <div style={{ display: 'grid', gap: 12, fontSize: 14, fontFamily: "'Orbitron', sans-serif" }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: C.ice60 }}>Max Value:</span>
                    <span style={{ color: C.mars, fontWeight: 700, fontSize: 15 }}>{maxValStr}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: C.ice60 }}>Min Value:</span>
                    <span style={{ color: '#4acfac', fontWeight: 700, fontSize: 15 }}>{minValStr}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 12, borderTop: `1px dashed rgba(255,255,255,0.1)` }}>
                    <span style={{ color: C.ice30 }}>Data Range:</span>
                    <span style={{ color: C.ice, fontWeight: 600 }}>{rangeStr}</span>
                  </div>
                </div>
              </div>

              {/* 3. 中间块下：颜色图例 Colorbar (横向排列) */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
                  DATA SCALE ({colorTitle})
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* Min Label */}
                  <div style={{ fontSize: 12, color: C.ice, fontFamily: "'Orbitron', sans-serif", minWidth: 50, textAlign: 'right' }}>
                    {botLabel}
                  </div>

                  {/* Color Bar */}
                  <div style={{
                    flex: 1, height: 16, borderRadius: 8,
                    background: fullscreen3D.colorMode === 'rdbu'
                      ? 'linear-gradient(to right, rgb(5,48,97), rgb(247,247,247), rgb(103,0,31))'
                      : 'linear-gradient(to right, rgb(0,0,4), rgb(212,72,66), rgb(252,255,164))',
                    border: `1px solid rgba(255,255,255,0.2)`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    position: 'relative'
                  }}>
                    {/* Zero tick for rdbu Mode */}
                    {fullscreen3D.colorMode === 'rdbu' && (
                      <div style={{
                        position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                        fontSize: 10, color: C.ice30, fontFamily: "'Orbitron', sans-serif"
                      }}>
                        | {midLabel} |
                      </div>
                    )}
                  </div>

                  {/* Max Label */}
                  <div style={{ fontSize: 12, color: C.ice, fontFamily: "'Orbitron', sans-serif", minWidth: 50 }}>
                    {topLabel}
                  </div>
                </div>
              </div>

              {/* 4. 底部块：操作提示 */}
              <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: `1px solid rgba(255,255,255,0.08)` }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🖱️</span> Left Click: Rotate | Middle Scroll: Zoom
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>
                  Double-click anywhere to close
                </div>
              </div>

            </div>

          </div>
        );
      })()}
    </div>
  );
}
