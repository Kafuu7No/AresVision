import React, { useState, useEffect } from 'react';
import C from '../../constants/colors';
import { useDataOverview } from '../../contexts/DataOverviewContext';

export default function AICopilotWidget() {
  const { globalTimeLs, setActiveAnalysisMode, activeAnalysisMode, rightPanelWidth } = useDataOverview();
  const [showBubble, setShowBubble] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const [pulse, setPulse] = useState(false);

  // AI Logic: Detect specific Ls condition (e.g. onset of global dust storms)
  useEffect(() => {
    if (globalTimeLs >= 240 && globalTimeLs <= 270 && !hasTriggered) {
      setShowBubble(true);
      setPulse(true);
      setHasTriggered(true); // only trigger once during session
    }
  }, [globalTimeLs, hasTriggered]);

  const handleAction = () => {
    setActiveAnalysisMode('extreme');
    setShowBubble(false);
    setPulse(false);
  };

  const handleClose = (e) => {
    e.stopPropagation();
    setShowBubble(false);
    setPulse(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '100px', // above TimelineController
        right: `${rightPanelWidth + 40}px`,  // left of widened DetailPanel
        zIndex: 2500,
        display: 'flex',
        alignItems: 'flex-end',
        gap: '16px',
      }}
    >
      {showBubble && (
        <div
          style={{
            width: '320px',
            background: 'rgba(10, 14, 23, 0.8)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${C.blue}`,
            borderRadius: '12px',
            padding: '16px',
            boxShadow: `0 8px 32px rgba(74, 158, 255, 0.2), inset 0 0 10px rgba(74, 158, 255, 0.1)`,
            position: 'relative',
            animation: 'fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div 
            onClick={handleClose}
            style={{ position: 'absolute', top: '8px', right: '12px', color: C.ice30, cursor: 'pointer', fontSize: '12px', padding: '4px' }}
          >
            ✕
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '18px' }}>🤖</span>
            <span style={{ color: C.blue, fontFamily: "'Orbitron', sans-serif", fontSize: '12px', fontWeight: 'bold' }}>
              Ares Copilot
            </span>
            <span style={{ color: '#ffb347', fontSize: '10px', background: 'rgba(255, 179, 71, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>
              Anomaly Detected
            </span>
          </div>
          <div style={{ color: C.ice80, fontSize: '12px', fontFamily: "'Exo 2', sans-serif", lineHeight: 1.6, marginBottom: '16px' }}>
            💡 已侦测到 Ls 阶段可能存在的显著异常：该时段北半球进入秋冬交替，强沙尘极易引发南半球上层臭氧重构。<br/><br/>
            是否为您调取<span style={{ color: '#ffb347', fontWeight: 'bold' }}>【极端天气与环境耦合】</span>深度剖析视图？
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleAction}
              style={{
                flex: 1, padding: '8px', background: `linear-gradient(135deg, ${C.blue}, #00f0ff)`,
                border: 'none', borderRadius: '6px', color: '#000', fontFamily: "'Orbitron', sans-serif",
                fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                boxShadow: `0 0 12px ${C.blue}60`
              }}
            >
              一键调取
            </button>
          </div>
        </div>
      )}

      {/* Copilot Avatar Bubble */}
      <div
        onClick={() => { setShowBubble(b => !b); setPulse(false); }}
        style={{
          width: '48px', height: '48px',
          borderRadius: '50%',
          background: 'rgba(10, 14, 23, 0.8)',
          border: `2px solid ${C.blue}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: pulse ? `0 0 0 0 rgba(74, 158, 255, 0.7)` : `0 4px 12px rgba(0,0,0,0.5)`,
          animation: pulse ? 'pulseBlue 2s infinite' : 'none',
          backdropFilter: 'blur(10px)',
          fontSize: '24px'
        }}
      >
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulseBlue {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 158, 255, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 15px rgba(74, 158, 255, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(74, 158, 255, 0); }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}} />
        🤖
      </div>
    </div>
  );
}
