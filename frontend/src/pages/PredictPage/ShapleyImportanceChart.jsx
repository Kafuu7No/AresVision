import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  const [activeMetric, setActiveMetric] = useState('r2');
  const [gradientData, setGradientData] = useState(null);
  const [marginalDataCache, setMarginalDataCache] = useState({}); // { r2: data, rmse: data, ... }
  const [error, setError] = useState(null);

  const marginalData = marginalDataCache[activeMetric] || null;




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
        if (!marginalDataCache[activeMetric]) {
          const result = await fetchShapleyValues(activeMetric);
          setMarginalDataCache(prev => ({ ...prev, [activeMetric]: result }));
        }
      }
    } catch (err) {
      console.error('SHAP Analysis Error:', err);
      setError(err.message || 'SHAP Analysis Failed');
    } finally {
      setLoading(false);
    }
  }, [activeMode, activeMetric, gradientData, marginalDataCache]);



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
    return createPortal(
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
      </div>,
      document.body
    );
  }

  if (error) {
    return createPortal(
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
      </div>,
      document.body
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

  const content = (
    <div
      className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-4 md:p-8"
      onDoubleClick={onClose}
    >
      <GlowCard
        className="w-full max-w-7xl max-h-[90vh] bg-[#0A0A0F]/90 border border-[#1E1E26] shadow-2xl cursor-default flex flex-col"
        style={{ animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
        onDoubleClick={e => e.stopPropagation()}
      >
        {/* Header - Fixed */}
        <div className="flex-none flex flex-col md:flex-row justify-between items-start md:items-center p-6 border-b border-white/5 gap-4">
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
            {activeMode === 'marginal' && (
              <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-1 mr-4">
                {['r2', 'rmse', 'mae', 'ssim'].map(m => (
                  <button
                    key={m}
                    onClick={() => setActiveMetric(m)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black font-orbitron transition-all ${activeMetric === m
                        ? 'bg-[#9c7bea] text-white shadow-[0_0_10px_rgba(156,123,234,0.3)]'
                        : 'text-white/30 hover:text-white/60 hover:bg-white/5'
                      }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => {
                if (activeMode === 'gradient') setGradientData(null);
                else setMarginalDataCache(prev => ({ ...prev, [activeMetric]: null }));
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

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto px-8 py-4">
          {/* Marginal Description Overlay */}
          {activeMode === 'marginal' && !marginalData && !loading && (
            <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-4 animate-in slide-in-from-top duration-300">
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
          <div className="charts-view-area">
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
                  <div className="text-[10px] font-mono text-white/30 tracking-widest uppercase">METRIC: GLOBAL {activeMetric}</div>
                </div>

                <div className="flex-1">
                  <Plot
                    data={[{
                      type: 'bar',
                      x: marginalPlotData?.x,
                      y: marginalPlotData?.y,
                      orientation: 'h',
                      marker: {
                        color: marginalPlotData?.x?.map(v =>
                          (activeMetric === 'r2' || activeMetric === 'ssim')
                            ? (v > 0 ? '#9c7bea' : 'rgba(156,123,234,0.3)')
                            : (v < 0 ? '#9c7bea' : 'rgba(156,123,234,0.3)')
                        ),
                        line: { color: '#9c7bea', width: 0 }
                      },
                      text: marginalPlotData?.text,
                      textposition: 'outside',
                      cliponaxis: false,
                    }]}
                    layout={{
                      ...commonLayout,
                      height: 500,
                      xaxis: {
                        ...commonLayout.xaxis,
                        title: {
                          text: t('predict.shapley.avgContribution').replace('{metric}', activeMetric.toUpperCase()),
                          font: { size: 10, color: 'rgba(232,237,243,0.3)' }
                        }
                      },
                      margin: { ...commonLayout.margin, l: 200 }
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%', height: '100%' }}
                  />
                </div>

                <div className="mt-8 p-6 bg-white/5 rounded-2xl border border-white/5">
                  <h4 className="flex items-center gap-2 text-[#9c7bea] font-black text-xs uppercase mb-3 font-orbitron">
                    <span className="w-1.5 h-1.5 bg-[#9c7bea] rounded-full shadow-[0_0_5px_#9c7bea]"></span>
                    {t('predict.shapley.mathPrinciple')}
                  </h4>
                  <p className="text-white/40 text-[11px] leading-relaxed font-mono">
                    {t('predict.shapley.mathDesc').replace('{metric}', activeMetric.toUpperCase())}
                    <span className="text-[#9c7bea]/80 ml-2">
                      {(activeMetric === 'r2' || activeMetric === 'ssim')
                        ? t('predict.shapley.mathDescNote.higher').replace('{metric}', activeMetric.toUpperCase())
                        : t('predict.shapley.mathDescNote.lower').replace('{metric}', activeMetric.toUpperCase())
                      }
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Info - Fixed */}
        <div className="flex-none px-8 pb-8 pt-2 flex flex-col md:flex-row justify-between text-[9px] font-mono text-gray-600 gap-4 uppercase tracking-tighter">
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

  return createPortal(content, document.body);
}
