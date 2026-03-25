import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';

const CompareHorizonMetricsChart = ({ models = "predrnn,ozoneetd,baseline" }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!models) return;
    
    // 防抖处理：避免用户快速连续勾选时发送大量重复评估请求
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/predict/compare-horizon-metrics?models=${models}`);
        if (!response.ok) throw new Error('Failed to fetch metrics comparison');
        const json = await response.json();
        setData(json.results);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [models]);

  if (loading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-black/20 rounded-xl border border-white/5 animate-pulse">
        <div className="w-10 h-10 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4" />
        <span className="text-gray-400 font-mono tracking-widest text-sm">ANALYZING MULTI-MODEL PERFORMANCE...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-red-900/10 text-red-500 p-4 rounded-xl border border-red-500/20 font-mono">
        Error: {error}
      </div>
    );
  }

  const modelNames = Object.keys(data || {});
  if (modelNames.length === 0) return null;

  // 极客色彩方案
  const colors = {
    'predrnn': '#B829EA',    // 霓虹紫
    'ozoneetd': '#00E5FF',   // 荧光青
    'baseline': '#FFEA00',   // 耀眼黄
    'default': '#FFFFFF'
  };

  const getTraces = (metricKey) => {
    return modelNames.map((model) => ({
      x: data[model].map(d => d.step),
      y: data[model].map(d => d[metricKey]),
      name: model.toUpperCase(),
      type: 'scatter',
      mode: 'lines+markers',
      line: {
        width: 3,
        color: colors[model.toLowerCase()] || colors.default,
        shape: 'spline'
      },
      marker: { size: 8, color: colors[model.toLowerCase()] || colors.default },
      hovertemplate: `Step %{x}<br>${metricKey.toUpperCase()}: %{y:.4f}<extra></extra>`
    }));
  };

  const layoutBase = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#A0AAB4', family: 'Inter, monospace' },
    margin: { l: 40, r: 20, t: 30, b: 40 },
    xaxis: {
      gridcolor: 'rgba(255,255,255,0.05)',
      tickfont: { color: '#6B7280' },
      dtick: 1,
      title: { text: 'Horizon Step', font: { size: 10 } }
    },
    yaxis: {
      gridcolor: 'rgba(255,255,255,0.05)',
      tickfont: { color: '#6B7280' },
      zeroline: false
    },
    showlegend: true,
    legend: {
      orientation: 'h',
      y: 1.15,
      x: 0.5,
      xanchor: 'center',
      font: { size: 10, color: '#A0AAB4' }
    },
    hovermode: 'closest'
  };

  const metrics = [
    { key: 'mse', title: 'MSE (Mean Squared Error)' },
    { key: 'rmse', title: 'RMSE (Root Mean Squared Error)' },
    { key: 'mae', title: 'MAE (Mean Absolute Error)' },
    { key: 'r2', title: 'R² (Coefficient of Determination)' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full p-2 bg-[#0a0a0c] rounded-2xl border border-white/5 shadow-2xl">
      {metrics.map((metric) => (
        <div key={metric.key} className="bg-white/5 rounded-xl p-3 border border-white/5 hover:border-purple-500/30 transition-colors">
          <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 ml-1">{metric.title}</h4>
          <div className="h-[200px]">
            <Plot
              data={getTraces(metric.key)}
              layout={{
                ...layoutBase,
                height: 200,
                width: undefined, // 使其响应式
                autosize: true
              }}
              config={{ responsive: true, displayModeBar: false }}
              className="w-full h-full"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default CompareHorizonMetricsChart;
