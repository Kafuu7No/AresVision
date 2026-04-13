import React, { useState, useEffect } from 'react';
import C from '../../constants/colors';
import { useDataOverview } from '../../contexts/DataOverviewContext';
import { aiChat } from '../../services/api';

export default function AICopilotWidget() {
  const { globalTimeLs, setActiveAnalysisMode, activeAnalysisMode, rightPanelWidth, marsYear, selectedCoordinate } = useDataOverview();
  const [showBubble, setShowBubble] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResponse, setAiResponse] = useState('');

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

  const handleAIChat = async () => {
    setIsAnalyzing(true);
    setAiResponse('');
    try {
      const context = {
        mars_year: marsYear,
        ls_range: [globalTimeLs, globalTimeLs],
        selected_variables: ['o3col'], // 默认主要关注臭氧场
        active_mode: activeAnalysisMode,
        coordinate: selectedCoordinate
      };
      const question = "请根据我当前右侧显示的火星面板信息（当前所在季节、所在经纬等分析模式），提供一段基于科学气象数据的图表内容概览深度解读。";
      const res = await aiChat(question, context);
      setAiResponse(res.answer);
    } catch (e) {
      setAiResponse(`> 终端连接异常: ${e.message}。请检查后端或 API Key 配置是否正确。`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClose = (e) => {
    e.stopPropagation();
    setShowBubble(false);
    setPulse(false);
    // 可选设置：关闭面板时是否重置上下文。这里重置以便下次再问时重新读取。
    setTimeout(() => setAiResponse(''), 500); 
  };

  // 因为引入的是简单的文本字符串可能带有换行，用这个工具函数防止换行被吞掉
  const formatText = (text) => {
    return text.split('\n').map((line, i) => {
      // 简单的高亮加粗Markdown语法解析兜底支持
      const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return (
        <span key={i}>
          <span dangerouslySetInnerHTML={{ __html: formattedLine }} />
          <br />
        </span>
      );
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '100px', // above TimelineController
        right: `${rightPanelWidth + 40}px`,  // 浮在拉伸式 DetailPanel 的左边
        zIndex: 2500,
        display: 'flex',
        alignItems: 'flex-end',
        gap: '16px',
        transition: 'right 0.1s ease',
      }}
    >
      {showBubble && (
        <div
          style={{
            width: '360px',
            background: 'rgba(10, 14, 23, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${C.blue}`,
            borderRadius: '12px',
            padding: '20px',
            boxShadow: `0 8px 32px rgba(74, 158, 255, 0.2), inset 0 0 10px rgba(74, 158, 255, 0.1)`,
            position: 'relative',
            animation: 'fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div 
            onClick={handleClose}
            style={{ position: 'absolute', top: '10px', right: '14px', color: C.ice30, cursor: 'pointer', fontSize: '14px', padding: '4px' }}
          >
            ✕
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontSize: '20px' }}>🤖</span>
            <span style={{ color: C.blue, fontFamily: "'Orbitron', sans-serif", fontSize: '14px', fontWeight: 'bold' }}>
              Ares Copilot
            </span>
            {aiResponse && !isAnalyzing && (
              <span style={{ color: C.ice, fontSize: '10px', background: 'rgba(255, 255, 255, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                ✓ 已完成深度分析
              </span>
            )}
          </div>

          <div style={{
            color: C.ice80, fontSize: '12px', fontFamily: "'Exo 2', sans-serif", lineHeight: 1.6, marginBottom: '16px',
            maxHeight: '300px', overflowY: 'auto', paddingRight: '8px',
          }}>
            {!aiResponse && !isAnalyzing ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  💡 扫描完成。<br/>我是您的专属气象分析副驾驶，已实时连接大模型端。您可以让我为您提取总结右侧大数据的特征，或针对强异常自动调取极端天气视图。
                </div>
              </>
            ) : isAnalyzing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: C.blue, height: '40px' }}>
                <span className="copilot-dot-pulse">正在利用大语言模型计算推理中...</span>
              </div>
            ) : (
              <div style={{ color: C.ice, background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', borderLeft: `3px solid ${C.blue}` }}>
                {formatText(aiResponse)}
              </div>
            )}
          </div>

          {!aiResponse && !isAnalyzing && (
            <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
              <button
                onClick={handleAIChat}
                style={{
                  padding: '10px', background: `transparent`,
                  border: `1px solid ${C.blue}`, borderRadius: '6px', color: C.blue, fontFamily: "'Orbitron', sans-serif",
                  fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                  transition: '0.3s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(74, 158, 255, 0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                ✨ DeepSeek 智能解读当前页
              </button>
              
              <button
                onClick={handleAction}
                style={{
                  padding: '10px', background: `linear-gradient(135deg, ${C.mars}, #ff8e53)`,
                  border: 'none', borderRadius: '6px', color: '#000', fontFamily: "'Orbitron', sans-serif",
                  fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                  boxShadow: `0 0 12px rgba(199,91,57,0.4)`
                }}
              >
                🚨 调取极端环境耦合剖析
              </button>
            </div>
          )}
        </div>
      )}

      {/* Copilot Avatar Bubble */}
      <div
        onClick={() => { setShowBubble(b => !b); setPulse(false); }}
        style={{
          width: '52px', height: '52px',
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
          .copilot-dot-pulse {
            animation: blink 1.5s infinite;
          }
          @keyframes blink { 0% { opacity: 0.2; } 50% { opacity: 1; } 100% { opacity: 0.2; } }
        `}} />
        🤖
      </div>
    </div>
  );
}
