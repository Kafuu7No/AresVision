import { useState, useEffect, useRef, useCallback } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useSettings } from '../contexts/SettingsContext';
import SectionTitle from '../components/SectionTitle';
import GlowCard from '../components/GlowCard';
import { runPrediction, fetchPredictMetrics, fetchPerformanceCurve, fetchPerformanceComparison } from '../services/api';
import SphericalFieldCanvas from '../components/SphericalFieldCanvas';

import PredictDisplay from '../components/PredictDisplay';
import PredictMetrics from '../components/PredictMetrics';
import PredictPerformance from '../components/PredictPerformance';

import { getRgb, rdbuRgb } from '../utils/colormaps';
import { ozoneLabel, ozoneDeltaLabel, convertOzone } from '../utils/units';
import { fmtNum } from '../utils/fmt';

function fmtVal(v) {
  if (v === 0) return '0';
  if (Math.abs(v) < 0.001) return v.toExponential(2);
  return v.toFixed(3);
}

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

  const [fullscreen3D, setFullscreen3D] = useState(null);

  const [performanceData, setPerformanceData] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [activePerfMetric, setActivePerfMetric] = useState('r2');
  
  const [compareConfigs, setCompareConfigs] = useState([]);
  const [selectedCompareIds, setSelectedCompareIds] = useState([]);
  const [activeCompareId, setActiveCompareId] = useState(null);
  
  const [fusionGroups, setFusionGroups] = useState([]);

  const toggleVar = (id) => {
    setSelectedVars((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleFetchPerformance = useCallback(async () => {
    setPerfLoading(true);
    try {
      if (selectedCompareIds.length > 1) {
        const configs = compareConfigs
          .filter(c => selectedCompareIds.includes(c.id))
          .map(c => c.vars);
        const res = await fetchPerformanceComparison(configs);
        setPerformanceData(res);
      } else {
        const body = {
          selected_variables: selectedVars,
          horizon: predStep,
          ls_start: lsStart,
          mars_year: marsYear,
        };
        const res = await fetchPerformanceCurve(body);
        const key = selectedVars.length === 0 ? 'baseline' : 'current';
        setPerformanceData({ results: { [key]: res } });
      }
    } catch (e) {
      console.error('Fetch performance error:', e);
    } finally {
      setPerfLoading(false);
    }
  }, [selectedVars, predStep, lsStart, marsYear, selectedCompareIds, compareConfigs]);

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

          {/* 多模型对比勾选 */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4acfac', fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>
                COMPARE MODELS
              </div>
              {compareConfigs.length > 0 && (
                <div 
                  onClick={() => {
                    const modelIds = compareConfigs.map(c => c.id);
                    const allSelected = modelIds.every(id => selectedCompareIds.includes(id));
                    if (allSelected) {
                      setSelectedCompareIds(prev => prev.filter(id => !modelIds.includes(id)));
                    } else {
                      setSelectedCompareIds(prev => [...new Set([...prev, ...modelIds])]);
                    }
                  }}
                  style={{ fontSize: 10, color: C.blue, cursor: 'pointer', fontFamily: "'Orbitron', sans-serif", opacity: 0.8 }}
                >
                  {compareConfigs.map(c => c.id).every(id => selectedCompareIds.includes(id)) ? 'DESELECT MODELS' : 'SELECT ALL MODELS'}
                </div>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.ice30, marginBottom: 12 }}>
              在性能图表中同时展示多个模型的曲线
            </div>
            {compareConfigs.map((c) => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 10px', marginBottom: 4, borderRadius: 6,
                background: selectedCompareIds.includes(c.id) ? 'rgba(74,207,172,0.06)' : 'transparent',
                transition: 'all 0.2s',
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={selectedCompareIds.includes(c.id)}
                    onChange={() => {
                      setSelectedCompareIds(prev => 
                        prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]
                      );
                    }}
                    style={{ accentColor: '#4acfac' }}
                  />
                  <span style={{ fontSize: 12, color: selectedCompareIds.includes(c.id) ? C.ice : C.ice30 }}>{c.label}</span>
                </label>
                <button
                  onClick={() => {
                    setCompareConfigs(prev => prev.filter(pc => pc.id !== c.id));
                    setSelectedCompareIds(prev => prev.filter(pid => pid !== c.id));
                  }}
                  style={{ background: 'none', border: 'none', color: 'rgba(199,91,57,0.4)', fontSize: 14, cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>
            ))}
            <button 
              onClick={() => {
                const sortedVars = [...selectedVars].sort();
                const exists = compareConfigs.find(c => {
                  const cVars = [...c.vars].sort();
                  return cVars.length === sortedVars.length && cVars.every((v, i) => v === sortedVars[i]);
                });
                if (exists) {
                  if (!selectedCompareIds.includes(exists.id)) setSelectedCompareIds(prev => [...prev, exists.id]);
                  return;
                }
                const newId = `custom_${Date.now()}`;
                const shorthands = { "Temperature": "T", "Dust_Optical_Depth": "D", "Solar_Flux_DN": "S", "U_Wind": "U", "V_Wind": "V" };
                const label = selectedVars.length === 0 ? 'Baseline' : selectedVars.map(v => shorthands[v] || v[0]).sort().join('');
                setCompareConfigs(prev => [...prev, { id: newId, label, vars: [...selectedVars] }]);
                setSelectedCompareIds(prev => [...prev, newId]);
              }}
              style={{
                width: '100%', marginTop: 8, padding: '8px 0',
                background: 'rgba(255,255,255,0.03)', border: `1px dashed ${C.border}`,
                borderRadius: 8, color: C.ice60, fontSize: 11, cursor: 'pointer'
              }}
            >
              + 将当前配置加入对比
            </button>
          </GlowCard>

          {/* 融合组管理 */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4acfac', fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>
                ENSEMBLE GROUPS
              </div>
            </div>
            {fusionGroups.map((g) => (
              <div key={g.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 10px', marginBottom: 4, borderRadius: 6,
                background: selectedCompareIds.includes(g.id) ? 'rgba(74,207,172,0.1)' : 'transparent',
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={selectedCompareIds.includes(g.id)}
                    onChange={() => {
                      setSelectedCompareIds(prev => prev.includes(g.id) ? prev.filter(x => x !== g.id) : [...prev, g.id]);
                    }}
                    style={{ accentColor: '#4acfac' }}
                  />
                  <span style={{ fontSize: 12, color: selectedCompareIds.includes(g.id) ? C.ice : C.ice30, fontWeight: 700 }}>{g.label}</span>
                </label>
                <button
                  onClick={() => {
                    setFusionGroups(prev => prev.filter(x => x.id !== g.id));
                    setSelectedCompareIds(prev => prev.filter(pid => pid !== g.id));
                  }}
                  style={{ background: 'none', border: 'none', color: 'rgba(199,91,57,0.3)', fontSize: 14, cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>
            ))}
            <button 
              onClick={() => {
                if (selectedCompareIds.length < 2) return alert('请先在上方勾选至少 2 个模型');
                const name = prompt('请输入融合组名称', `Ensemble_${fusionGroups.length + 1}`);
                if (!name) return;
                const modelIds = selectedCompareIds.filter(id => !id.startsWith('fusion_'));
                const newId = `fusion_${Date.now()}`;
                setFusionGroups(prev => [...prev, { id: newId, label: name, modelKeys: modelIds }]);
                setSelectedCompareIds(prev => [...prev, newId]);
              }}
              style={{
                width: '100%', marginTop: 8, padding: '10px 0',
                background: 'rgba(74,207,172,0.1)', border: `1px solid rgba(74,207,172,0.3)`,
                borderRadius: 8, color: '#4acfac', fontSize: 11, fontWeight: 700, cursor: 'pointer'
              }}
            >
              将选定模型保存为融合组
            </button>
          </GlowCard>

          {/* File Upload */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
              FILE UPLOAD
            </div>
            <div style={{
              border: `2px dashed ${C.border}`, borderRadius: 12, padding: 28,
              textAlign: 'center', cursor: 'pointer',
            }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>📁</div>
              <div style={{ fontSize: 13, color: C.ice60 }}>{t('predict.fileUpload.drag')}</div>
              <div style={{ fontSize: 11, color: C.ice30, marginTop: 4 }}>{t('predict.fileUpload.click')}</div>
            </div>
          </GlowCard>
        </div>

        {/* ─── 右侧结果区 ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <PredictDisplay
            viewMode={viewMode} setViewMode={setViewMode} VIEW_MODES={VIEW_MODES}
            results={results} activeHorizon={activeHorizon} setActiveHorizon={setActiveHorizon}
            loading={loading} truthField={truthField} predField={predField} residField={residField}
            stepLs={stepLs} stepLabel={stepLabel} setFullscreen3D={setFullscreen3D}
            TRIPTYCH_PANELS={TRIPTYCH_PANELS} FieldCanvas={FieldCanvas}
            LoadingBox={LoadingBox} EmptyBox={EmptyBox}
          />

          <PredictMetrics
            loading={loading} metrics={metrics} results={results} precision={precision}
            ozoneUnit={ozoneUnit} activeHorizon={activeHorizon} setActiveHorizon={setActiveHorizon}
            lsStart={lsStart} marsYear={marsYear} METRIC_META={METRIC_META}
          />

          <PredictPerformance
            performanceData={performanceData} perfLoading={perfLoading}
            activePerfMetric={activePerfMetric} setActivePerfMetric={setActivePerfMetric}
            handleFetchPerformance={handleFetchPerformance} compareConfigs={compareConfigs}
            activeCompareId={activeCompareId} setActiveCompareId={setActiveCompareId}
            plotTextColor={plotTextColor} plotText60={plotText60} plotGridColor={plotGridColor}
            precision={precision} METRIC_META={METRIC_META}
            selectedCompareIds={selectedCompareIds} fusionGroups={fusionGroups} t={t}
          />

          {results && results.model_info && (
            <GlowCard style={{ padding: '16px 20px', border: results.model_info.is_fallback ? '1px solid rgba(255,80,80,0.3)' : `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: results.model_info.is_fallback ? 'rgba(255,80,80,0.1)' : 'rgba(74,207,172,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {results.model_info.is_fallback ? '⚠️' : '🎯'}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: C.ice30, fontFamily: "'Orbitron', sans-serif" }}>CURRENT ACTIVE MODEL</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: C.ice }}>PredRNNv2 _{results.model_info.suffix}</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ice }}>{results.model_info.input_dim} Ch | {results.model_info.weight_file}</div>
              </div>
            </GlowCard>
          )}

          {!results && !loading && (
            <GlowCard style={{ padding: 28, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔭</div>
              <div style={{ fontSize: 14, color: C.ice60 }}>{t('predict.initPrompt')}</div>
              <div style={{ fontSize: 12, color: C.ice30, lineHeight: 1.7, whiteSpace: 'pre-line' }}>{t('predict.initDesc')}</div>
            </GlowCard>
          )}
        </div>
      </div>

      {fullscreen3D && (
        <div onDoubleClick={() => setFullscreen3D(null)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'rgba(5, 5, 10, 0.98)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <SphericalFieldCanvas fieldData={fullscreen3D.fieldData} colorMode={fullscreen3D.colorMode} h="100vh" forceFullscreen />
          <div style={{ position: 'absolute', top: 80, left: 40, padding: '24px', background: 'rgba(20,20,30,0.65)', backdropFilter: 'blur(16px)', border: `1px solid ${C.border}`, borderRadius: 16 }}>
            <div style={{ fontSize: 18, color: C.ice, fontFamily: "'Orbitron', sans-serif" }}>Globe View</div>
            <div style={{ fontSize: 12, color: C.ice30, marginTop: 4 }}>Double-click anywhere to exit</div>
          </div>
        </div>
      )}
    </div>
  );
}
