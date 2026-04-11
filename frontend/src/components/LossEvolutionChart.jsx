import React from 'react';
import { useT } from '../i18n';
import Plot from 'react-plotly.js';
import C from '../constants/colors';

const LossEvolutionChart = ({ lossHistory, isLight }) => {
  const t = useT();
  const trainLoss = lossHistory?.train || [];
  const valLoss = lossHistory?.val || [];
  const epochs = trainLoss.map((_, i) => i + 1);

  const data = [
    {
      x: epochs,
      y: trainLoss,
      type: 'scatter',
      mode: 'lines+markers',
      name: t('modelTraining.charts.trainLoss'),
      line: { color: C.mars, width: 3 },
      marker: { size: 6, color: C.mars },
    },
    {
      x: epochs,
      y: valLoss,
      type: 'scatter',
      mode: 'lines+markers',
      name: t('modelTraining.charts.valLoss'),
      line: { color: C.blue, width: 3 },
      marker: { size: 6, color: C.blue },
    }
  ];

  const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    autosize: true,
    height: 300,
    margin: { l: 40, r: 20, t: 40, b: 40 },
    showlegend: true,
    legend: {
      orientation: 'h',
      x: 0,
      y: 1.1,
      font: { color: isLight ? '#333' : '#eee', size: 10 }
    },
    xaxis: {
      title: t('modelTraining.charts.epoch'),
      gridcolor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
      tickfont: { color: isLight ? '#666' : '#aaa' },
      titlefont: { color: isLight ? '#333' : '#eee', size: 12 },
      zeroline: false,
      dtick: 1,
      tickformat: ',d'
    },
    yaxis: {
      title: t('modelTraining.charts.loss'),
      gridcolor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
      tickfont: { color: isLight ? '#666' : '#aaa' },
      titlefont: { color: isLight ? '#333' : '#eee', size: 12 },
      zeroline: false,
      rangemode: 'nonnegative'
    },
    hovermode: 'closest'
  };

  const config = {
    displayModeBar: false,
    responsive: true
  };

  const containerStyle = {
    marginTop: 16,
    padding: '16px',
    borderRadius: 12,
    background: isLight ? 'rgba(255,255,255,0.5)' : 'rgba(15,20,35,0.4)',
    border: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'}`,
    backdropFilter: 'blur(8px)',
  };

  const titleStyle = {
    fontSize: 12,
    fontWeight: 700,
    opacity: 0.6,
    marginBottom: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.1em'
  };

  return (
    <div style={containerStyle}>
      <div style={titleStyle}>{t('modelTraining.charts.lossTitle')}</div>
      {trainLoss.length === 0 ? (
        <div style={{ 
          height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0.3, fontSize: 13, fontStyle: 'italic'
        }}>
          {t('modelTraining.charts.noMetrics')}
        </div>
      ) : (
        <Plot
          data={data}
          layout={layout}
          config={config}
          style={{ width: '100%' }}
        />
      )}
    </div>
  );
};

export default LossEvolutionChart;
