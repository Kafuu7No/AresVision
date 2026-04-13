import React from 'react';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useDataOverview } from '../../contexts/DataOverviewContext';

export const MODE_DEFS = [
  { id: 'temporal', icon: '⏱️', color: C.mars, title: '时序气候演变', label: 'TEMPORAL', desc: '专注分析随时间维度（小时、季节）的自然演化。' },
  { id: 'drivers', icon: '🧬', color: '#4acfac', title: '环境归因与驱动', label: 'DRIVERS', desc: '多变量散点回归与纬度归因，发掘引爆主导因子。' },
  { id: 'dynamics', icon: '🌪️', color: '#ffd700', title: '动力与区域变异', label: 'DYNAMICS', desc: '特殊地形阻挡或巨型沙尘暴等物理强迫带来的异常。' },
  { id: 'system', icon: '🧠', color: C.ice, title: '模型智能评分', label: 'EVALUATION', desc: '对高维拟合智能体在预测数据上的置信度复盘。' }
];

export default function SidebarMenu() {
  const t = useT();
  const { 
    activeAnalysisMode, setActiveAnalysisMode,
    marsYear, setMarsYear,
    autoRotate, setAutoRotate,
    gestureEnabled, setGestureEnabled
  } = useDataOverview();

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: '40px', // Below TopStatusBar
        width: '280px',
        height: 'calc(100vh - 40px)',
        background: 'rgba(10, 12, 18, 0.4)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: `1px solid rgba(255,255,255,0.08)`,
        zIndex: 1000,
        padding: '32px 20px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ paddingBottom: '24px', marginBottom: '24px', borderBottom: `1px solid rgba(255,255,255,0.08)`, flexShrink: 0 }}>
        <h2
          style={{
            color: C.ice,
            fontFamily: "'Orbitron', sans-serif",
            fontSize: '16px',
            fontWeight: 'bold',
            margin: '0 0 8px 0',
            letterSpacing: 3,
            textAlign: 'center',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}
        >
          EXPLORATION MODE
        </h2>
        <div style={{ color: C.ice60, fontSize: '10px', textAlign: 'center', fontFamily: "'Exo 2', sans-serif" }}>
          选择下钻分析视界
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflowY: 'auto' }}>
        {MODE_DEFS.map((mode) => {
          const isSelected = activeAnalysisMode === mode.id;

          return (
            <div
              key={mode.id}
              onClick={() => setActiveAnalysisMode(mode.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '16px',
                borderRadius: 12,
                background: isSelected ? `linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01))` : 'transparent',
                border: `1px solid ${isSelected ? `${mode.color}40` : 'rgba(255,255,255,0.02)'}`,
                boxShadow: isSelected ? `inset 0 0 20px ${mode.color}10, 0 4px 12px rgba(0,0,0,0.2)` : 'none',
                cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'; }}
              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
            >
              {isSelected && (
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: mode.color, boxShadow: `0 0 10px ${mode.color}` }} />
              )}
            
              <div style={{ fontSize: '24px', filter: isSelected ? `drop-shadow(0 0 10px ${mode.color})` : 'grayscale(60%) opacity(60%)', pointerEvents: 'none' }}>
                {mode.icon}
              </div>

              <div style={{ flex: 1, pointerEvents: 'none' }}>
                <div style={{ color: isSelected ? mode.color : C.ice, fontSize: '13px', fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif", marginBottom: '6px', letterSpacing: 1 }}>
                  {mode.title}
                </div>
                <div style={{ color: isSelected ? C.ice80 : C.ice40, fontSize: '11px', fontFamily: "'Exo 2', sans-serif", lineHeight: 1.5 }}>
                  {mode.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: `1px solid rgba(255,255,255,0.08)`, flexShrink: 0 }}>
        <div style={{ color: C.ice60, fontSize: '10px', fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, marginBottom: '16px' }}>
          SYSTEM CONTROLS
        </div>
        
        {/* Mars Year 选择 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: C.ice30, marginBottom: 8, fontFamily: "'Exo 2', sans-serif" }}>MARS YEAR (Dataset)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[27, 28].map((y) => (
              <button key={y} onClick={() => setMarsYear(y)} style={{
                flex: 1, padding: '8px 0',
                background: marsYear === y ? 'rgba(199,91,57,0.2)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${marsYear === y ? C.mars : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 8, color: marsYear === y ? C.mars : C.ice60,
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Orbitron', sans-serif",
                transition: 'all 0.2s'
              }}>MY{y}</button>
            ))}
          </div>
        </div>

        {/* 自动旋转控制 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '12px', padding: '10px 12px',
          background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: `1px solid rgba(255,255,255,0.05)`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>🔄</span>
            <span style={{ color: C.ice, fontSize: '11px', fontFamily: "'Exo 2', sans-serif" }}>GLOBE AUTO-ROTATE</span>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '32px', height: '18px' }}>
            <input type="checkbox" checked={autoRotate} onChange={() => setAutoRotate(r => !r)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{
              position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: autoRotate ? 'rgba(74,158,255,0.3)' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${autoRotate ? C.blue : 'rgba(255,255,255,0.2)'}`,
              transition: '.4s', borderRadius: '34px'
            }}>
              <span style={{
                position: 'absolute', content: '""', height: '12px', width: '12px',
                left: autoRotate ? '16px' : '2px', bottom: '2px',
                backgroundColor: autoRotate ? C.blue : 'rgba(255,255,255,0.5)',
                transition: '.4s', borderRadius: '50%'
              }} />
            </span>
          </label>
        </div>

        {/* 手势控制 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: `1px solid rgba(255,255,255,0.05)`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>✋</span>
            <span style={{ color: C.mars, fontSize: '11px', fontFamily: "'Exo 2', sans-serif", fontWeight: 'bold' }}>GESTURE CONTROL</span>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '32px', height: '18px' }}>
            <input type="checkbox" checked={gestureEnabled} onChange={() => setGestureEnabled(g => !g)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{
              position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: gestureEnabled ? 'rgba(199,91,57,0.3)' : 'rgba(255,255,255,0.1)',
              border: `1px solid ${gestureEnabled ? C.mars : 'rgba(255,255,255,0.2)'}`,
              transition: '.4s', borderRadius: '34px'
            }}>
              <span style={{
                position: 'absolute', content: '""', height: '12px', width: '12px',
                left: gestureEnabled ? '16px' : '2px', bottom: '2px',
                backgroundColor: gestureEnabled ? C.mars : 'rgba(255,255,255,0.5)',
                transition: '.4s', borderRadius: '50%'
              }} />
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
