import { useState, useEffect, useRef, useCallback } from 'react';
import C from '../constants/colors';
import SectionTitle from '../components/SectionTitle';
import GlowCard from '../components/GlowCard';
import { runPrediction, fetchPredictMetrics } from '../services/api';

// ─── 色阶函数 ───

function infernoColor(t) {
  t = Math.max(0, Math.min(1, t));
  const stops = [
    [0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99],
    [212, 72, 66], [245, 125, 21], [250, 193, 39], [252, 255, 164],
  ];
  const idx = t * (stops.length - 1);
  const i = Math.min(Math.floor(idx), stops.length - 2);
  const f = idx - i;
  const c0 = stops[i], c1 = stops[i + 1];
  return [
    Math.round(c0[0] + (c1[0] - c0[0]) * f),
    Math.round(c0[1] + (c1[1] - c0[1]) * f),
    Math.round(c0[2] + (c1[2] - c0[2]) * f),
  ];
}

function rdbuColor(t) {
  // t in [0,1]: 0=蓝(负偏差), 0.5=白(零), 1=红(正偏差)
  t = Math.max(0, Math.min(1, t));
  if (t < 0.5) {
    const s = t * 2;
    return [Math.round(s * 255), Math.round(s * 255), Math.round(172 + (255 - 172) * s)];
  }
  const s = (t - 0.5) * 2;
  return [255, Math.round(255 - (255 - 24) * s), Math.round(255 - (255 - 43) * s)];
}

// ─── Canvas 场热力图 ───

function FieldCanvas({ fieldData, colorMode = 'inferno', h = 240, label = '' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!fieldData || !fieldData.field) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const CW = canvas.width;
    const CH = canvas.height;
    const ML = 40, MR = 40, MT = 28, MB = 36;
    const plotW = CW - ML - MR;
    const plotH = CH - MT - MB;

    // 清空背景
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, CW, CH);

    const { field, minVal, maxVal, lat, lon } = fieldData;
    const nLat = field.length;       // 36
    const nLon = field[0].length;    // 72
    const range = maxVal - minVal || 1;

    // 绘制热力图
    const imgData = ctx.createImageData(plotW, plotH);
    const pixels = imgData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 10; pixels[i + 1] = 10; pixels[i + 2] = 15; pixels[i + 3] = 255;
    }

    const cellW = plotW / nLon;
    const cellH = plotH / nLat;

    let absMax = 0;
    if (colorMode === 'rdbu') {
      // 差值图用发散色阶，以0为中心
      for (let li = 0; li < nLat; li++) {
        for (let lj = 0; lj < nLon; lj++) {
          absMax = Math.max(absMax, Math.abs(field[li][lj]));
        }
      }
      absMax = absMax || 1;
    }

    for (let li = 0; li < nLat; li++) {
      const pyStart = Math.round((nLat - 1 - li) * cellH);
      const pyEnd = Math.round((nLat - li) * cellH);
      for (let lj = 0; lj < nLon; lj++) {
        const val = field[li][lj];
        if (val == null || isNaN(val)) continue;

        let rgb;
        if (colorMode === 'rdbu') {
          const t = (val / absMax) * 0.5 + 0.5; // 映射到 [0,1], 0.5=零
          rgb = rdbuColor(t);
        } else {
          const t = Math.max(0, Math.min(1, (val - minVal) / range));
          rgb = infernoColor(t);
        }

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

    // 边框
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ML, MT, plotW, plotH);

    // X 轴标注（经度）
    ctx.fillStyle = 'rgba(232,237,243,0.5)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    [0, 90, 180, 270, 360].forEach(lonV => {
      const fx = ML + (lonV / 360) * plotW;
      ctx.fillText(`${lonV}°`, fx, CH - 8);
    });

    // Y 轴标注（纬度）
    ctx.textAlign = 'right';
    [-90, -45, 0, 45, 90].forEach(latV => {
      const fy = MT + ((90 - latV) / 180) * plotH;
      ctx.fillText(`${latV}°`, ML - 4, fy + 4);
    });

    // 标题
    ctx.fillStyle = 'rgba(232,237,243,0.7)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, CW / 2, 16);

  }, [fieldData, colorMode, label]);

  return (
    <canvas
      ref={canvasRef}
      width={560}
      height={h}
      style={{ width: '100%', height: h, borderRadius: 8, display: 'block' }}
    />
  );
}

function LoadingBox({ h = 240 }) {
  return (
    <div style={{
      height: h, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.02)', borderRadius: 8,
    }}>
      <div style={{
        width: 28, height: 28, border: `3px solid ${C.border}`,
        borderTop: `3px solid ${C.mars}`, borderRadius: '50%',
        animation: 'spin-slow 1s linear infinite',
      }} />
      <div style={{ marginTop: 10, fontSize: 12, color: C.ice30 }}>预测运算中...</div>
    </div>
  );
}

// ─── 变量定义 ───

const VARIABLES = [
  { id: 'Temperature', label: '温度 Temperature', icon: '🌡', color: '#ff6b4a' },
  { id: 'Dust_Optical_Depth', label: '沙尘光学厚度 DOD', icon: '🌫', color: '#d4a06a' },
  { id: 'Solar_Flux_DN', label: '太阳辐射通量', icon: '☀️', color: '#ffd740' },
  { id: 'U_Wind', label: '纬向风 U Wind', icon: '💨', color: '#4a9eff' },
  { id: 'V_Wind', label: '经向风 V Wind', icon: '🌬', color: '#7c5cbf' },
  { id: 'Pressure', label: '气压 Pressure', icon: '📊', color: '#4acfac' },
];

const METRIC_META = [
  { key: 'rmse', name: 'RMSE', unit: 'μm-atm', better: '↓', color: C.mars },
  { key: 'mae', name: 'MAE', unit: 'μm-atm', better: '↓', color: C.mars },
  { key: 'ssim', name: 'SSIM', unit: '', better: '↑', color: '#4acfac' },
  { key: 'r2', name: 'R²', unit: '', better: '↑', color: '#4acfac' },
];

const TRIPTYCH_PANELS = [
  { title: '原始真值 Ground Truth', color: C.blue, mode: 'inferno' },
  { title: '模型预测 Prediction', color: C.mars, mode: 'inferno' },
  { title: '差值场 Residual', color: '#9c7bea', mode: 'rdbu' },
];

export default function PredictPage() {
  const [selectedVars, setSelectedVars] = useState(VARIABLES.map((v) => v.id));
  const [predStep, setPredStep] = useState(3);
  const [lsStart, setLsStart] = useState(90);
  const [marsYear, setMarsYear] = useState(27);
  const [activeHorizon, setActiveHorizon] = useState(0); // 显示第几步预测结果

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);   // runPrediction 返回值
  const [metrics, setMetrics] = useState(null);   // fetchPredictMetrics 返回值
  const [error, setError] = useState(null);

  const toggleVar = (id) => {
    setSelectedVars((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

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
      setError(e.message || '预测请求失败，请检查后端服务是否启动');
    } finally {
      setLoading(false);
    }
  }, [selectedVars, predStep, lsStart, marsYear]);

  // 当前显示步的真值/预测/差值
  const step = results ? Math.min(activeHorizon, results.horizon - 1) : 0;
  const truthField = results?.ground_truth?.[step] ?? null;
  const predField = results?.prediction?.[step] ?? null;
  const residField = results?.residual?.[step] ?? null;
  const stepLs = results?.ls_values?.[step];

  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionTitle title="预测分析" subtitle="PREDICTION & ANALYSIS" />

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
        {/* ─── 左侧控制栏 ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 参数设置 */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
              PARAMETERS
            </div>

            {/* 火星年 */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.ice30, marginBottom: 6 }}>火星年 Mars Year</div>
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

            {/* 起始 Ls */}
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: C.ice30 }}>起始 Ls</span>
                <span style={{ fontSize: 12, color: C.ice, fontFamily: "'Orbitron', sans-serif" }}>{lsStart}°</span>
              </div>
              <input
                type="range" min={0} max={355} step={5}
                value={lsStart}
                onChange={(e) => setLsStart(Number(e.target.value))}
                style={{ width: '100%', accentColor: C.mars }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.ice30 }}>
                <span>0° 春分</span><span>90° 夏至</span><span>180° 秋分</span><span>270° 冬至</span>
              </div>
            </div>
          </GlowCard>

          {/* 变量勾选 */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
              INPUT VARIABLES
            </div>
            <div style={{ fontSize: 11, color: C.ice30, marginBottom: 12, lineHeight: 1.6 }}>
              选择纳入 PredRNNv2 模型的环境驱动变量
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
              O₃ 自回归通道始终启用 · 已选 {selectedVars.length}/6 环境变量
            </div>
          </GlowCard>

          {/* 预测控制 */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
              PREDICTION CONTROL
            </div>
            <div style={{ fontSize: 11, color: C.ice30, marginBottom: 10 }}>预测步长 Horizon</div>
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
                  预测中...
                </>
              ) : '🚀 开始预测 RUN PREDICT'}
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
        </div>

        {/* ─── 右侧结果区 ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 步骤选择（有结果时显示） */}
          {results && results.horizon > 1 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.ice30, marginRight: 4 }}>显示预测步：</span>
              {Array.from({ length: results.horizon }, (_, i) => (
                <button key={i} onClick={() => setActiveHorizon(i)} style={{
                  padding: '6px 16px',
                  background: activeHorizon === i ? 'rgba(74,158,255,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${activeHorizon === i ? C.blue : C.border}`,
                  borderRadius: 8, fontSize: 12, fontWeight: 600,
                  color: activeHorizon === i ? C.blue : C.ice30, cursor: 'pointer',
                }}>
                  Step {i + 1}{results.ls_values[i] != null ? ` (Ls=${results.ls_values[i].toFixed(1)}°)` : ''}
                </button>
              ))}
            </div>
          )}

          {/* 三联对比热力图 */}
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
                        Ls={stepLs.toFixed(1)}°
                      </span>
                    )}
                  </div>
                  {loading ? (
                    <LoadingBox h={220} />
                  ) : fieldData ? (
                    <FieldCanvas fieldData={fieldData} colorMode={panel.mode} h={220} />
                  ) : (
                    <div style={{
                      height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(255,255,255,0.02)', borderRadius: 8,
                      fontSize: 11, color: C.ice30,
                    }}>
                      点击"开始预测"查看结果
                    </div>
                  )}
                </GlowCard>
              );
            })}
          </div>

          {/* 评估指标 */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
              MODEL EVALUATION / 模型评估指标
            </div>
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
                      {loading ? '…' : val != null ? val.toFixed(4) : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: m.color, marginTop: 4 }}>
                      {m.better} {m.unit}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 逐步指标表格 */}
            {metrics?.per_step && metrics.per_step.length > 1 && (
              <div>
                <div style={{ fontSize: 10, color: C.ice30, marginBottom: 8 }}>逐步指标 Per-Step Metrics</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Step', 'Ls', 'RMSE', 'MAE', 'SSIM', 'R²'].map((h) => (
                        <th key={h} style={{
                          padding: '6px 10px', textAlign: 'center',
                          color: C.ice30, fontWeight: 600, borderBottom: `1px solid ${C.border}`,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.per_step.map((row, i) => (
                      <tr key={i} style={{
                        background: activeHorizon === i ? 'rgba(74,158,255,0.06)' : 'transparent',
                        cursor: 'pointer',
                      }} onClick={() => setActiveHorizon(i)}>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: C.blue, fontWeight: 700 }}>Step {row.step}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: C.ice60 }}>
                          {results?.ls_values?.[i] != null ? `${results.ls_values[i].toFixed(1)}°` : '—'}
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: C.ice }}>{row.rmse.toFixed(4)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: C.ice }}>{row.mae.toFixed(4)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: '#4acfac' }}>{row.ssim.toFixed(4)}</td>
                        <td style={{ padding: '6px 10px', textAlign: 'center', color: '#4acfac' }}>{row.r2.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlowCard>

          {/* 提示信息 */}
          {!results && !loading && (
            <GlowCard style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔭</div>
              <div style={{ fontSize: 14, color: C.ice60, marginBottom: 8 }}>
                配置参数并点击"开始预测"以运行 PredRNNv2 推理
              </div>
              <div style={{ fontSize: 12, color: C.ice30, lineHeight: 1.7 }}>
                模型将基于选定的 Ls 起始时刻，利用前 3 个时间步的数据，
                预测后续最多 3 个时间步的火星臭氧柱浓度空间分布。
              </div>
            </GlowCard>
          )}

          {/* 成功提示 */}
          {results && !loading && (
            <GlowCard style={{ padding: 16 }}>
              <div style={{ fontSize: 11, color: C.ice30, lineHeight: 1.7 }}>
                预测完成 · 起始 Ls={lsStart}° · MY{marsYear} ·
                共预测 {results.horizon} 步 ·
                输入变量：O₃ + {results.selected_variables.length} 个环境变量
                {results.selected_variables.length > 0 && (
                  <span style={{ color: C.ice60 }}>（{results.selected_variables.join(', ')}）</span>
                )}
              </div>
            </GlowCard>
          )}
        </div>
      </div>
    </div>
  );
}
