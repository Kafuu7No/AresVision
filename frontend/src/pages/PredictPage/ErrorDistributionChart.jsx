import React from 'react';
import Plot from 'react-plotly.js';
import C from '../../constants/colors';
import { useT } from '../../i18n';

export default function ErrorDistributionChart({ 
  data, 
  loading,
  isLight,
  plotTextColor,
  plotText60,
  plotGridColor
}) {
  const t = useT();
  if (!data && !loading) return null;

  if (loading || !data) {
    const skeletonBg = isLight ? 'bg-gray-100' : 'bg-white/5';
    const skeletonBorder = isLight ? 'border-gray-200' : 'border-gray-800';
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full h-[350px]">
        {[1, 2, 3].map((item) => (
          <div 
            key={item} 
            className={`animate-pulse ${skeletonBg} rounded-xl border ${skeletonBorder} backdrop-blur-sm h-full w-full min-h-[300px]`} 
          />
        ))}
      </div>
    );
  }

  // 基础暗黑宇宙图表布局配置 (极简科幻)
  const baseLayout = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: plotTextColor, family: 'Inter, system-ui, sans-serif' },
    margin: { t: 30, r: 20, l: 45, b: 40 },
    xaxis: { 
      gridcolor: plotGridColor, 
      zerolinecolor: plotGridColor,
      tickfont: { size: 9, color: plotText60 },
      showline: false,
    },
    yaxis: { 
      gridcolor: plotGridColor, 
      zerolinecolor: plotGridColor,
      tickfont: { size: 9, color: plotText60 },
      showline: false,
    },
    autosize: true
  };

  const getCenters = (edges) => edges.slice(0, -1).map((e, i) => (e + edges[i+1]) / 2);

  // --- 卡片 1 数据：密度散点图 ---
  const scatterTrace = {
    x: data.scatter.trues,
    y: data.scatter.preds,
    mode: 'markers',
    type: 'scatter',
    marker: {
      color: data.scatter.density,
      colorscale: 'Viridis',
      size: 3,
      opacity: 0.8,
      showscale: false
    },
    name: 'Density'
  };

  const minVal = Math.min(...data.scatter.trues, ...data.scatter.preds);
  const maxVal = Math.max(...data.scatter.trues, ...data.scatter.preds);
  const baselineTrace = {
    x: [minVal, maxVal],
    y: [minVal, maxVal],
    mode: 'lines',
    type: 'scatter',
    line: { color: 'rgba(248, 113, 113, 0.8)', dash: 'dash', width: 2 }, // Red-400
    name: 'y = x',
    showlegend: false
  };

  // --- 卡片 2 数据：双轨直方图覆盖 ---
  const trueHist = {
    x: getCenters(data.hist_trues.bin_edges),
    y: data.hist_trues.counts,
    type: 'bar',
    name: t('ai.errorDistribution.trueLabel'),
    marker: { color: 'rgba(56, 189, 248, 0.6)' }, // Sky-400
    opacity: 0.8
  };
  const predHist = {
    x: getCenters(data.hist_preds.bin_edges),
    y: data.hist_preds.counts,
    type: 'bar',
    name: t('ai.errorDistribution.predLabel'),
    marker: { color: 'rgba(52, 211, 153, 0.6)' }, // Emerald-400
    opacity: 0.8
  };

  // --- 卡片 3 数据：误差直方图 ---
  const errorHist = {
    x: getCenters(data.hist_errors.bin_edges),
    y: data.hist_errors.counts,
    type: 'bar',
    name: 'Error',
    marker: { color: 'rgba(167, 139, 250, 0.8)' }, // Violet-400
  };
  
  const maxErrorCount = Math.max(...data.hist_errors.counts);
  const zeroErrorLine = {
    type: 'line',
    x0: 0, x1: 0,
    y0: 0, y1: maxErrorCount * 1.05,
    line: { color: 'rgba(248, 113, 113, 0.8)', width: 2, dash: 'dash' }
  };

    const cardBg = isLight ? 'bg-white/60' : 'bg-black/40';
    const cardBorder = isLight ? 'border-gray-200' : 'border-gray-800';
    const cardShadow = isLight ? 'shadow-sm' : 'shadow-[0_0_20px_rgba(0,0,0,0.4)]';
    const headerColor = isLight ? 'text-gray-500' : 'text-gray-400';

    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        {/* 散点密度图 */}
        <div className={`${cardBg} border ${cardBorder} ${cardShadow} p-4 rounded-xl flex flex-col backdrop-blur-md relative overflow-hidden group`}>
          <h3 className={`${headerColor} font-semibold text-xs mb-1 tracking-widest uppercase`}>{t('ai.errorDistribution.trueVsPred')}</h3>
        <div className="flex-1 w-full min-h-[250px] relative z-10">
          <Plot
            data={[scatterTrace, baselineTrace]}
            layout={{ 
              ...baseLayout, 
              xaxis: { ...baseLayout.xaxis, title: { text: t('ai.errorDistribution.trueOzone'), font: { size: 11 } } },
              yaxis: { ...baseLayout.yaxis, title: { text: t('ai.errorDistribution.predOzone'), font: { size: 11 } } },
              showlegend: false
            }}
            useResizeHandler
            className="w-full h-full"
            config={{ displayModeBar: false, responsive: true }}
          />
        </div>
      </div>

      {/* 分布比对柱图 */}
      <div className={`${cardBg} border ${cardBorder} ${cardShadow} p-4 rounded-xl flex flex-col backdrop-blur-md relative overflow-hidden`}>
        <h3 className={`${headerColor} font-semibold text-xs mb-1 tracking-widest uppercase`}>{t('ai.errorDistribution.distMatch')}</h3>
        <div className="flex-1 w-full min-h-[250px] relative z-10">
          <Plot
            data={[trueHist, predHist]}
            layout={{ 
              ...baseLayout, 
              barmode: 'overlay',
              legend: { orientation: 'h', y: 1.15, x: 0.5, xanchor: 'center', font: { size: 10 } }
            }}
            useResizeHandler
            className="w-full h-full"
            config={{ displayModeBar: false, responsive: true }}
          />
        </div>
      </div>

      {/* 误差与 RMSE 指标板 */}
      <div className={`${cardBg} border ${cardBorder} ${cardShadow} p-4 rounded-xl flex flex-col backdrop-blur-md relative overflow-hidden`}>
        <div className="flex justify-between items-start mb-1">
          <h3 className={`${headerColor} font-semibold text-xs tracking-widest uppercase`}>{t('ai.errorDistribution.errorHist')}</h3>
          <div className="flex flex-col text-right">
            <span className={`${isLight ? 'text-emerald-600 bg-emerald-50' : 'text-emerald-400 bg-emerald-400/10'} font-mono text-xs font-bold px-1.5 py-0.5 rounded backdrop-blur border ${isLight ? 'border-emerald-200' : 'border-emerald-400/20'}`}>
              RMSE: {data.rmse.toFixed(3)}
            </span>
            <span className={`${isLight ? 'text-sky-600 bg-sky-50' : 'text-sky-400 bg-sky-400/10'} font-mono text-xs font-bold mt-1 px-1.5 py-0.5 rounded backdrop-blur border ${isLight ? 'border-sky-200' : 'border-sky-400/20'}`}>
              MAE: {data.mae.toFixed(3)}
            </span>
          </div>
        </div>
        <div className="flex-1 w-full min-h-[250px] relative z-10">
          <Plot
            data={[errorHist]}
            layout={{ 
              ...baseLayout, 
              shapes: [zeroErrorLine],
              showlegend: false,
              xaxis: { ...baseLayout.xaxis, title: { text: t('ai.errorDistribution.errorLabel'), font: { size: 11 } } }
            }}
            useResizeHandler
            className="w-full h-full"
            config={{ displayModeBar: false, responsive: true }}
          />
        </div>
      </div>
    </div>
  );
}
