import { useState } from 'react';
import C from '../constants/colors';
import SectionTitle from '../components/SectionTitle';
import GlowCard from '../components/GlowCard';
import ChartPlaceholder from '../components/ChartPlaceholder';

const VARIABLES = [
  { id: 'Temperature', label: '温度 Temperature', icon: '🌡', color: '#ff6b4a' },
  { id: 'Dust_Optical_Depth', label: '沙尘光学厚度 DOD', icon: '🌫', color: '#d4a06a' },
  { id: 'Solar_Flux_DN', label: '太阳辐射通量', icon: '☀️', color: '#ffd740' },
  { id: 'U_Wind', label: '纬向风 U Wind', icon: '💨', color: '#4a9eff' },
  { id: 'V_Wind', label: '经向风 V Wind', icon: '🌬', color: '#7c5cbf' },
  { id: 'Pressure', label: '气压 Pressure', icon: '📊', color: '#4acfac' },
];

const METRICS = [
  { name: 'RMSE', value: '0.0042', unit: 'μm-atm', trend: '↓' },
  { name: 'MAE', value: '0.0031', unit: 'μm-atm', trend: '↓' },
  { name: 'SSIM', value: '0.934', unit: '', trend: '↑' },
  { name: 'R²', value: '0.891', unit: '', trend: '↑' },
];

const VIEW_MODES = [
  { id: 'triptych', label: '三联对比 Triptych' },
  { id: 'original', label: '原始数据' },
  { id: 'prediction', label: '预测结果' },
  { id: 'diff', label: '差值分析' },
];

const TRIPTYCH_PANELS = [
  { title: '原始真值 Ground Truth', color: C.blue },
  { title: '模型预测 Prediction', color: C.mars },
  { title: '差值场 Residual', color: '#9c7bea' },
];

export default function PredictPage() {
  const [selectedVars, setSelectedVars] = useState(VARIABLES.map((v) => v.id));
  const [viewMode, setViewMode] = useState('triptych');
  const [predStep, setPredStep] = useState(1);

  const toggleVar = (id) => {
    setSelectedVars((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionTitle title="预测分析" subtitle="PREDICTION & ANALYSIS" />

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
        {/* ─── Left Sidebar ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* File Upload */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
              FILE UPLOAD
            </div>
            <div
              style={{
                border: `2px dashed ${C.border}`,
                borderRadius: 12,
                padding: 32,
                textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
              <div style={{ fontSize: 13, color: C.ice60 }}>拖拽 .nc 文件到此处</div>
              <div style={{ fontSize: 11, color: C.ice30, marginTop: 4 }}>或点击选择文件</div>
            </div>
          </GlowCard>

          {/* Variable Checkboxes */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
              INPUT VARIABLES
            </div>
            <div style={{ fontSize: 11, color: C.ice30, marginBottom: 12, lineHeight: 1.6 }}>
              选择纳入 PredRNNv2 模型的环境驱动变量
            </div>
            {VARIABLES.map((v) => (
              <label
                key={v.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  marginBottom: 4,
                  borderRadius: 8,
                  background: selectedVars.includes(v.id) ? 'rgba(74,158,255,0.06)' : 'transparent',
                  border: `1px solid ${selectedVars.includes(v.id) ? 'rgba(74,158,255,0.15)' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
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
            <div style={{ marginTop: 16, padding: '8px 12px', borderRadius: 8, background: 'rgba(199,91,57,0.08)', fontSize: 11, color: C.ice30 }}>
              已选 {selectedVars.length}/6 变量 · 输入通道 = {selectedVars.length + 1} (O₃ 自回归 + {selectedVars.length} 环境)
            </div>
          </GlowCard>

          {/* Prediction Control */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
              PREDICTION CONTROL
            </div>
            <div style={{ fontSize: 11, color: C.ice30, marginBottom: 12 }}>预测步长 Horizon</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3].map((s) => (
                <button
                  key={s}
                  onClick={() => setPredStep(s)}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    background: predStep === s ? 'rgba(199,91,57,0.2)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${predStep === s ? C.mars : C.border}`,
                    borderRadius: 8,
                    color: predStep === s ? C.mars : C.ice60,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: "'Orbitron', sans-serif",
                  }}
                >
                  +{s}
                </button>
              ))}
            </div>
            <button
              style={{
                marginTop: 16,
                width: '100%',
                padding: '14px 0',
                background: `linear-gradient(135deg, ${C.mars}, ${C.marsLight})`,
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "'Orbitron', sans-serif",
                letterSpacing: 2,
                cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(199,91,57,0.35)',
              }}
            >
              🚀 开始预测 RUN PREDICT
            </button>
          </GlowCard>
        </div>

        {/* ─── Right: Results Area ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* View mode tabs */}
          <div style={{ display: 'flex', gap: 8 }}>
            {VIEW_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setViewMode(m.id)}
                style={{
                  padding: '8px 16px',
                  background: viewMode === m.id ? 'rgba(74,158,255,0.12)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${viewMode === m.id ? C.blue : C.border}`,
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: viewMode === m.id ? C.blue : C.ice30,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Triptych Globe View */}
          {viewMode === 'triptych' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              {TRIPTYCH_PANELS.map((panel, i) => (
                <GlowCard key={i} breathe style={{ padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: panel.color, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, marginBottom: 8, textAlign: 'center' }}>
                    {panel.title}
                  </div>
                  <ChartPlaceholder title="" type="globe" h={240} />
                </GlowCard>
              ))}
            </div>
          )}

          {viewMode !== 'triptych' && (
            <GlowCard breathe style={{ padding: 20 }}>
              <ChartPlaceholder
                title={
                  viewMode === 'original'
                    ? '原始臭氧场 OpenMARS'
                    : viewMode === 'prediction'
                      ? 'PredRNNv2 预测场'
                      : '差值场 (Prediction - Truth)'
                }
                type="globe"
                h={400}
              />
            </GlowCard>
          )}

          {/* 2D Heatmap Triptych */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {['原始 Ls-纬度热力图', '预测 Ls-纬度热力图', '差值 Ls-纬度热力图'].map((t, i) => (
              <GlowCard key={i} style={{ padding: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: C.ice60, marginBottom: 8, textAlign: 'center' }}>{t}</div>
                <ChartPlaceholder title="" type="heatmap" h={180} />
              </GlowCard>
            ))}
          </div>

          {/* Evaluation Metrics */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
              MODEL EVALUATION / 模型评估指标
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {METRICS.map((m, i) => (
                <div
                  key={i}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${C.border}`,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 10, color: C.ice30, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>{m.name}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.ice, fontFamily: "'Orbitron', sans-serif", marginTop: 8 }}>{m.value}</div>
                  <div style={{ fontSize: 10, color: m.trend === '↑' ? '#4acfac' : C.mars, marginTop: 4 }}>
                    {m.trend} {m.unit}
                  </div>
                </div>
              ))}
            </div>
          </GlowCard>

          {/* Ablation + Decay */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <GlowCard style={{ padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, marginBottom: 8 }}>
                STEP-WISE DECAY / 逐步预测衰减
              </div>
              <ChartPlaceholder title="" type="bar" h={200} />
            </GlowCard>
            <GlowCard style={{ padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, marginBottom: 8 }}>
                ABLATION STUDY / 变量消融实验
              </div>
              <ChartPlaceholder title="" type="bar" h={200} />
            </GlowCard>
          </div>

          {/* Diurnal */}
          <GlowCard style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 12 }}>
              DIURNAL CYCLE / 昼夜变化曲线
            </div>
            <ChartPlaceholder title="O₃ 昼夜变化 — 按纬度带分组" type="line" h={240} />
          </GlowCard>
        </div>
      </div>
    </div>
  );
}
