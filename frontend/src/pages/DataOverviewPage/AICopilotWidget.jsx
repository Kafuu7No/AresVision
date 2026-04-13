import React, { useState, useEffect } from 'react';
import C from '../../constants/colors';
import { useDataOverview } from '../../contexts/DataOverviewContext';
import { aiChat, fetchCorrelation, fetchSeasonalBands, fetchPolarDynamics, fetchDiurnal, fetchSolarPhotochemical, fetchCouplingData } from '../../services/api';

export default function AICopilotWidget() {
  const { globalTimeLs, setActiveAnalysisMode, activeAnalysisMode, rightPanelWidth, marsYear, selectedCoordinate, expandedCard } = useDataOverview();
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
      let enrichedKnowledge = "";
      const lsIndex = Math.min(72, Math.floor((globalTimeLs / 360) * 73)); 
      
      // 数据嗅探截取协议：基于此时真正在屏幕上“展开”的独立卡片
      try {
        if (expandedCard === 'correlation') {
           const corrData = await fetchCorrelation(marsYear);
           if (corrData && corrData.matrix && corrData.variable_names) {
              enrichedKnowledge = `正在查看 [点位相关性]。因变量与主要指标的关系为:\n变量列表: ${corrData.variable_names.join(', ')}\n数值矩阵:\n${JSON.stringify(corrData.matrix)}`;
           }
        } else if (expandedCard === 'seasonal') {
           const bandData = await fetchSeasonalBands(marsYear);
           enrichedKnowledge = `正在查看 [季节带时序演变]。截面时刻点 Ls=${globalTimeLs}° 时测得各纬度带 O3 平均值如下: \n`;
           if (bandData && bandData.bands) {
               bandData.bands.forEach(b => {
                   enrichedKnowledge += `- ${b.name}: ${Number(b.values[lsIndex]).toFixed(3)}\n`;
               });
           }
        } else if (expandedCard === 'polar') {
           const polar = await fetchPolarDynamics(marsYear);
           enrichedKnowledge = `正在查看 [极地聚积特征]。截面 (Ls=${globalTimeLs}°) 的极区测绘对比如下:\n- 北极区域 (风速: ${Number(polar.north.wind[lsIndex]).toFixed(2)} m/s, 温度: ${Number(polar.north.temp[lsIndex]).toFixed(2)} K, 臭氧柱: ${Number(polar.north.ozone[lsIndex]).toFixed(3)})\n- 南极区域 (风速: ${Number(polar.south.wind[lsIndex]).toFixed(2)} m/s, 温度: ${Number(polar.south.temp[lsIndex]).toFixed(2)} K, 臭氧柱: ${Number(polar.south.ozone[lsIndex]).toFixed(3)})`;
        } else if (expandedCard === 'realtime') {
           const diurnal = await fetchDiurnal(marsYear, globalTimeLs, 'Equatorial (30S-30N)');
           if (diurnal?.ozone_values) {
              enrichedKnowledge = `正查看 [昼夜变化Diurnal]。当前季节 Ls=${globalTimeLs}，赤道区域24小时昼夜O3平均值为: ${diurnal.ozone_values.map(v => Number(v).toFixed(3)).join(', ')}`;
           }
        } else if (expandedCard === 'environment') {
           enrichedKnowledge = `正查看 [多因子环境机制]。此图追踪极地风速或沙尘暴如何驱动局部环流变化，推断气候耦合机制。您可推断出这可能对臭氧循环带来的影响。`;
        } else if (expandedCard === 'solarsens') {
           const photo = await fetchSolarPhotochemical(marsYear, 'Equatorial (30S-30N)');
           if (photo?.ozone) {
              const p_ls = Math.min(photo.ozone.length - 1, Math.floor((globalTimeLs / 360) * photo.ozone.length));
              enrichedKnowledge = `正查看 [光化学辐射感应]。由于太阳高度角不同，在 Ls=${globalTimeLs} 处，赤道观测站太阳下行辐射值为 ${Number(photo.solar[p_ls]).toFixed(2)}，当时臭氧柱浓度为 ${Number(photo.ozone[p_ls]).toFixed(3)}`;
           }
        } else if (expandedCard === 'coupling') {
           const coupling = await fetchCouplingData(marsYear, 'o3col', 'Dust_Optical_Depth');
           if (coupling?.var1) {
              const c_ls = Math.min(coupling.var1.length - 1, Math.floor((globalTimeLs / 360) * coupling.var1.length));
              enrichedKnowledge = `正查看 [沙尘冲刷极值]。全局在 Ls=${globalTimeLs} 处截面监控显示，臭氧柱浓度均值为 ${Number(coupling.var1[c_ls]).toFixed(3)}，沙尘光学厚度均值为 ${Number(coupling.var2[c_ls]).toFixed(3)}。`;
           }
        } else if (expandedCard === 'wave') {
           enrichedKnowledge = `正查看 [地形驻波变异]。用于研究臭氧分布的经度异常及海陆双波（Wave-1, Wave-2等）随经度的扭积现象。`;
        } else {
           enrichedKnowledge = `右侧正在展示宏大气候系统视野，当前火星年 MY${marsYear}，节气 Ls=${globalTimeLs}。请根据常识推导。`;
        }
      } catch (err) {
        console.warn("上下文数据摘取存在缺失，降级至无背景环境提交", err);
      }

      console.log('Sending dynamic metrics:', enrichedKnowledge);

      const context = {
        mars_year: marsYear,
        ls_range: [globalTimeLs, globalTimeLs],
        selected_variables: ['o3col'],
        active_mode: activeAnalysisMode,
        expanded_card: expandedCard,
        coordinate: selectedCoordinate,
        dynamic_metrics: enrichedKnowledge // 真实截获数值
      };

      const question = `请根据我当前右侧展开的专属火星气象图卡（卡片名称为：${expandedCard}）以及以下为您摘录的本时刻系统测绘最新数值结果，扮演科学家进行专业级解读。
请务必严苛遵循：
1. **你的结论极其依赖上方提供的真实拦截数据指标**（如果有数字，你一定要列举出这些数值变化进行论述），严禁长篇大论不谈数据。
2. 解释此刻测得的这组气象数字处于什么样的常规状态或是何种典型的火星异常（比如沙尘遮光、极夜现象等）。`;

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
    setTimeout(() => setAiResponse(''), 500); 
  };

  const formatText = (text) => {
    return text.split('\n').map((line, i) => {
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
