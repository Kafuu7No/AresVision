import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Plot from 'react-plotly.js';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import GlowCard from '../../components/GlowCard';
import { fmtNum } from '../../utils/fmt';
import { fetchShapleyGlobal, fetchShapleyValues } from '../../services/api';


/**
 * SHAP 全局特征归因分析组件
 * 展示 Mean |SHAP| 条形图与摘要蜂群图 (Summary Plot)
 */
export default function ShapleyImportanceChart({
  plotTextColor = '#A0AAB4',
  plotGridColor = 'rgba(255,255,255,0.05)',
  onClose,
  mode = null, // mode isolation
}) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [activeMode, setActiveMode] = useState(mode || 'gradient'); // 'gradient' | 'marginal'

  const [gradientData, setGradientData] = useState(null);
  const [marginalData, setMarginalData] = useState(null);
  const [error, setError] = useState(null);


  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeMode === 'gradient') {
        if (!gradientData) {
          const result = await fetchShapleyGlobal();
          setGradientData(result);
        }
      } else {
        if (!marginalData) {
          const result = await fetchShapleyValues('r2');
          setMarginalData(result);
        }
      }
    } catch (err) {
      console.error('SHAP Analysis Error:', err);
      setError(err.message || 'SHAP Analysis Failed');
    } finally {
      setLoading(false);
    }
  }, [activeMode, gradientData, marginalData]);


  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 辅助函数：获取变量翻译
  const getVarLabel = (name) => {
    // 兼容后端返回的不同名称格式
    const key = name === 'Ozone' ? 'Ozone' : name;
    return t(`predict.variables.${key}`, name);
  };


  // --- 1. 条形图数据准备 (Gradient) ---
  const barPlotData = useMemo(() => {
    if (!gradientData?.bar_data) return null;
    const sorted = [...gradientData.bar_data].reverse();
    return {
      y: sorted.map(d => getVarLabel(d.name)),
      x: sorted.map(d => d.value),
      text: sorted.map(d => d.value.toFixed(4)),
    };
  }, [gradientData, t]);

  // --- 1b. 条形图数据准备 (Marginal) ---
  const marginalPlotData = useMemo(() => {
    if (!marginalData?.shapley_values) return null;
    const entries = Object.entries(marginalData.shapley_values);
    // 过滤掉 'Ozone' (Self) 如果后端没算，或者统一翻译
    const sorted = entries.reverse(); // 从下往上
    return {
      y: sorted.map(([name]) => getVarLabel(name)),
      x: sorted.map(([, val]) => val),
      text: sorted.map(([, val]) => val.toFixed(4)),
    };
  }, [marginalData, t]);


  // --- 2. 摘要蜂群图数据准备 ---
  const summaryPlotData = useMemo(() => {
    if (!gradientData?.summary_data) return null;


    // 我们需要将所有特征的数据合并到同一个 Plotly trace 或多个 trace 中
    // 为了实现 Swarm 效果，我们为每个特征创建一个 trace，并在 Y 轴施加 Jitter
    return gradientData.summary_data.map((feat, idx) => {
      const yBase = idx;
      const jitter = feat.shap_values.map(() => yBase + (Math.random() - 0.5) * 0.4);

      return {
        x: feat.shap_values,
        y: jitter,
        name: getVarLabel(feat.name),
        mode: 'markers',
        type: 'scattergl', // 使用 WebGL 提升大量点渲染性能
        marker: {
          size: 4,
          opacity: 0.6,
          color: feat.feature_values, // 映射至特征原始数值
          colorscale: 'RdBu',
          reversescale: true, // 红色代表高值，蓝色代表低值
          showscale: idx === 0, // 仅在第一个 trace 显示 colorbar
          colorbar: idx === 0 ? {
            title: { text: t('predict.shapley.featureValue'), font: { size: 10, color: '#A0AAB4' } },
            tickfont: { color: '#A0AAB4', size: 9 },
            thickness: 12,
            x: 1.05
          } : undefined,
        },
        hovertemplate: `<b>${getVarLabel(feat.name)}</b><br>SHAP: %{x:.4f}<br>Value: %{marker.color:.2f}<extra></extra>`
      };
    }).reverse();
  }, [gradientData, t]);



  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-2xl flex items-center justify-center p-10 select-none animate-in fade-in duration-500">
        <div className="text-center">
          <div className="relative w-32 h-32 mx-auto mb-10">
            <div className="absolute inset-0 border-4 border-[#00F0FF]/10 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-t-[#00F0FF] rounded-full animate-spin"></div>
            <div className="absolute inset-6 border-2 border-dashed border-[#00F0FF]/30 rounded-full animate-reverse-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[#00F0FF] text-xs font-black font-orbitron animate-pulse">SHAP</span>
            </div>
          </div>
          <h2 className="text-[#00F0FF] font-black text-2xl tracking-[0.4em] font-orbitron mb-4">
            {t('predict.shapleyGeneratingBtn').toUpperCase()}
          </h2>
          <div className="flex flex-col gap-2">
            <p className="text-[#00F0FF]/60 font-mono text-xs tracking-widest uppercase animate-pulse">
              Scanning Spatiotemporal Engine • Test Set Epochs
            </p>
            <p className="text-gray-600 font-mono text-[10px] tracking-tighter uppercase">
              Global convergence analysis in progress...
            </p>
          </div>
        </div>

        <style>{`
          @keyframes reverse-spin { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
          .animate-reverse-spin { animation: reverse-spin 3s linear infinite; }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-10">
        <div className="max-w-md w-full p-8 border border-red-500/30 bg-red-500/5 rounded-2xl text-center">
          <div className="text-4xl mb-6">⚠️</div>
          <h3 className="text-red-400 font-bold text-lg mb-2">SHAP ANALYSIS INTERRUPTED</h3>
          <p className="text-red-400/60 text-sm font-mono mb-8">{error}</p>
          <div className="flex gap-4 justify-center">
            <button onClick={fetchData} className="px-6 py-2 bg-red-500/20 border border-red-500/50 text-red-100 rounded-lg hover:bg-red-500/40 transition-colors font-bold text-sm">
              RETRY SEQUENCE
            </button>
            <button onClick={onClose} className="px-6 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm">
              ABORT
            </button>
          </div>
        </div>
      </div>
    );
  }

  const commonLayout = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: "'Orbitron', sans-serif", color: plotTextColor },
    margin: { t: 40, b: 60, l: 160, r: 40 },
    xaxis: {
      gridcolor: plotGridColor,
      zerolinecolor: 'rgba(255,255,255,0.1)',
      tickfont: { size: 10 },
    },
    yaxis: {
      gridcolor: 'transparent',
      tickfont: { size: 12, fontWeight: 'bold' },
    },
    showlegend: false,
    hovermode: 'closest',
  };

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-6 md:p-12 overflow-y-auto"
      onDoubleClick={onClose}
    >
      <GlowCard
        className="w-full max-w-7xl bg-[#0A0A0F]/90 border border-[#1E1E26] shadow-2xl cursor-default"
        style={{ animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
        onDoubleClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 border-b border-white/5 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-6 bg-[#00F0FF] shadow-[0_0_10px_#00F0FF]"></div>
              <h1 className="text-xl font-black text-[#00F0FF] tracking-tighter font-orbitron uppercase">
                {t('predict.shapley.title')} <span className="text-white/20 ml-2 font-normal text-sm">| {activeMode === 'gradient' ? t('predict.shapley.gradientSystem') : t('predict.shapley.marginalSystem')}</span>
              </h1>
            </div>

            {!mode && (
              <div className="flex gap-4 ml-5 mt-2">
                <button
                  onClick={() => setActiveMode('gradient')}
                  className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${activeMode === 'gradient'
                      ? 'bg-[#00F0FF] border-[#00F0FF] text-black shadow-[0_0_15px_#00F0FF]'
                      : 'bg-transparent border-white/10 text-[#A0AAB4] hover:border-white/30'
                    }`}
                >
                  {t('predict.shapley.gradientTab')}
                </button>
                <button
                  onClick={() => setActiveMode('marginal')}
                  className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${activeMode === 'marginal'
                      ? 'bg-gradient-to-r from-[#9c7bea] to-[#4acfac] border-transparent text-white shadow-[0_0_15px_#9c7bea]'
                      : 'bg-transparent border-white/10 text-[#A0AAB4] hover:border-white/30'
                    }`}
                >
                  {t('predict.shapley.marginalTab')}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (activeMode === 'gradient') setGradientData(null);
                else setMarginalData(null);
                fetchData();
              }}
              className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#00F0FF]/10 hover:border-[#00F0FF]/50 transition-all text-[#00F0FF]"
            >
              <span className="text-lg">🔄</span>
            </button>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-red-500/5 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 hover:border-red-500/50 transition-all text-red-500">
              <span className="text-lg">✕</span>
            </button>
          </div>
        </div>


        {/* Marginal Description Overlay */}
        {activeMode === 'marginal' && !marginalData && !loading && (
          <div className="m-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-4 animate-in slide-in-from-top duration-300">
            <span className="text-2xl">⚡</span>
            <div>
              <h4 className="text-yellow-400 font-bold text-sm uppercase">{t('predict.shapley.cacheMissing')}</h4>
              <p className="text-yellow-400/70 text-xs font-mono">
                {t('predict.shapley.cacheMissingDesc')}
              </p>
            </div>
          </div>

        )}


        {/* Charts Grid */}
        <div className="p-8">
          {activeMode === 'gradient' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-black/20 rounded-xl border border-white/5 p-4">
                <div className="mb-4 flex items-center gap-2 px-2">
                  <div className="w-1 h-3 bg-[#00F0FF]"></div>
                  <h3 className="text-[10px] font-black tracking-widest text-[#00F0FF] uppercase">{t('predict.shapley.importanceTitle')}</h3>
                </div>
                <Plot
                  data={[{
                    type: 'bar',
                    x: barPlotData?.x,
                    y: barPlotData?.y,
                    orientation: 'h',
                    marker: {
                      color: '#00F0FF',
                      opacity: 0.8,
                      line: { color: '#00F0FF', width: 1 }
                    },
                    text: barPlotData?.text,
                    textposition: 'outside',
                    cliponaxis: false,
                  }]}
                  layout={{
                    ...commonLayout,
                    height: 480,
                    xaxis: { ...commonLayout.xaxis, title: { text: t('predict.shapley.meanShap'), font: { size: 10 } } },
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Summary Swarm Plot */}
              <div className="bg-black/20 rounded-xl border border-white/5 p-4">
                <div className="mb-4 flex items-center gap-2 px-2">
                  <div className="w-1 h-3 bg-[#ED213A]"></div>
                  <h3 className="text-[10px] font-black tracking-widest text-[#ED213A] uppercase">{t('predict.shapley.swarmTitle')}</h3>
                </div>
                <Plot
                  data={summaryPlotData}
                  layout={{
                    ...commonLayout,
                    height: 480,
                    xaxis: { ...commonLayout.xaxis, title: { text: t('predict.shapley.impactOnPred'), font: { size: 10 } } },
                    yaxis: {
                      ...commonLayout.yaxis,
                      tickvals: gradientData?.summary_data.map((_, i) => i),
                      ticktext: gradientData?.summary_data.map(d => getVarLabel(d.name)),
                    }
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          ) : (
            <div className="bg-black/20 rounded-xl border border-white/5 p-6 min-h-[500px] flex flex-col">
              <div className="mb-6 flex justify-between items-center px-2">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3 bg-[#9c7bea]"></div>
                  <h3 className="text-[10px] font-black tracking-widest text-[#9c7bea] uppercase">{t('predict.shapley.marginalAnalysisTitle')}</h3>
                </div>
                <div className="text-[10px] font-mono text-white/30">METRIC: GLOBAL R²</div>
              </div>

              <div className="flex-1">
                <Plot
                  data={[{
                    type: 'bar',
                    x: marginalPlotData?.x,
                    y: marginalPlotData?.y,
                    orientation: 'h',
                    marker: {
                      color: 'rgba(156, 123, 234, 0.8)',
                      line: { color: '#9c7bea', width: 1 }
                    },
                    text: marginalPlotData?.text,
                    textposition: 'outside',
                    cliponaxis: false,
                  }]}
                  layout={{
                    ...commonLayout,
                    height: 500,
                    xaxis: { ...commonLayout.xaxis, title: { text: t('predict.shapley.avgContribution'), font: { size: 11 } } },
                    margin: { ...commonLayout.margin, l: 200 }
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="mt-6 p-4 bg-[#9c7bea]/5 border border-[#9c7bea]/20 rounded-lg">
                <div className="text-[10px] text-[#9c7bea] font-bold mb-2 uppercase tracking-tighter">{t('predict.shapley.mathPrinciple')}</div>
                <p className="text-[11px] text-[#A0AAB4] leading-relaxed">
                  {t('predict.shapley.mathDesc')}
                </p>
              </div>
            </div>
          )}

        </div>


        {/* Footer Info */}
        <div className="px-8 pb-8 pt-2 flex flex-col md:flex-row justify-between text-[9px] font-mono text-gray-600 gap-4 uppercase tracking-tighter">
          <div className="flex gap-6">
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> {t('predict.shapley.lowValue')}</span>
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div> {t('predict.shapley.highValue')}</span>
          </div>
          <div>
            {t('predict.shapley.footerNote').split('\n')[0]}
            <br />
            {t('predict.shapley.footerNote').split('\n')[1]}
          </div>
        </div>

      </GlowCard>

      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
