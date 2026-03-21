import React, { useState, useEffect, useCallback } from 'react';
import Plot from 'react-plotly.js';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import GlowCard from '../../components/GlowCard';
import { fmtNum } from '../../utils/fmt';
import { fetchShapleyValues } from '../../services/api';
import { METRIC_META } from './PredictComponents';

export default function ShapleyImportanceChart({
  plotTextColor,
  plotGridColor,
  precision,
  onClose,
}) {
  const t = useT();
  const [activeMetric, setActiveMetric] = useState('r2');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const handleFetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchShapleyValues(activeMetric);
      setData(result.shapley_values);
    } catch (err) {
      setError(err.message || 'Error fetching Shapley values');
    } finally {
      setLoading(false);
    }
  }, [activeMetric]);

  // Fetch automatically on mount or when metric changes
  useEffect(() => {
    handleFetch();
  }, [handleFetch]);

  let content;

  if (loading && !data) {
    content = (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(156,123,234,0.5)' }}>
        <div style={{ fontSize: 30, marginBottom: 16, animation: 'spin 2s linear infinite' }}>⚙️</div>
        <div style={{ fontFamily: "'Orbitron', sans-serif" }}>{t('predict.shapleyGeneratingBtn')}</div>
      </div>
    );
  } else if (error) {
    content = (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#ff6b6b' }}>
        <div style={{ fontSize: 30, marginBottom: 16 }}>⚠️</div>
        <div>{error}</div>
        <button onClick={handleFetch} style={{ marginTop: 12, padding: '6px 16px', background: 'rgba(255,107,107,0.2)', border: '1px solid #ff6b6b', borderRadius: 6, color: '#fff', cursor: 'pointer' }}>
          {t('common.retry')}
        </button>
      </div>
    );
  } else if (data) {
    // Note: features are returned in sorted order from backend (value descending)
    const features = Object.keys(data);
    const values = Object.values(data);
    
    // Check if the metric represents an error (where negative means improvement)
    const isErrorMetric = activeMetric === 'rmse' || activeMetric === 'mae';
    
    // For waterfall/bar chart, reverse them so biggest is at top
    // Plotly horizontal bar chart puts the first element at the bottom
    features.reverse();
    values.reverse();

    const shortLabels = features.map(f => {
      let tKey = `predict.variables.${f}`;
      // In case translation returns the key itself because it doesn't exist, we fallback
      let translated = t(tKey);
      if (translated === tKey) translated = f.replace('_', ' ');
      return translated;
    });

    const colors = values.map((v) => {
      // If error metric (RMSE), negative is good (green), positive is bad (red)
      // If quality metric (R2), positive is good (green), negative is bad (red)
      const isGood = isErrorMetric ? v <= 0 : v >= 0;
      return isGood ? 'rgba(74, 207, 172, 0.7)' : 'rgba(255, 107, 107, 0.7)';
    });

    content = (
      <div style={{ padding: '0 20px 20px' }}>
        <Plot
          data={[
            {
              type: 'bar',
              x: values,
              y: shortLabels,
              orientation: 'h',
              marker: {
                color: colors,
                line: { color: 'rgba(255,255,255,0.2)', width: 2 }, // Thicker border
              },
              hovertemplate: '<b>%{y}</b><br>Shapley Val: %{x}<extra></extra>',
              text: values.map(v => fmtNum(v, precision)),
              textposition: 'auto',
              textfont: { family: "'Orbitron', sans-serif", color: '#fff', size: 14 }, // Larger text
            }
          ]}
          layout={{
            height: 600, // Make it taller for fullscreen
            margin: { l: 240, r: 80, t: 40, b: 60 },
            plot_bgcolor: 'transparent',
            paper_bgcolor: 'transparent',
            font: { family: "'Inter', sans-serif", color: plotTextColor },
            xaxis: {
              title: { text: `Marginal Contribution to ${activeMetric.toUpperCase()}`, font: { size: 14, color: 'rgba(255,255,255,0.4)' } },
              gridcolor: plotGridColor,
              zerolinecolor: 'rgba(255,255,255,0.2)',
              zerolinewidth: 2,
              tickfont: { size: 12 },
            },
            yaxis: {
              gridcolor: 'transparent',
              tickfont: { size: 16, fontWeight: 'bold' },
            },
            showlegend: false,
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: 600 }}
        />
        <div style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 24 }}>
          {isErrorMetric ? 
            <span><span style={{ color: '#4acfac' }}>Negative values</span> indicate error reduction (Performance Improvement)</span> : 
            <span><span style={{ color: '#4acfac' }}>Positive values</span> indicate metric increase (Performance Improvement)</span>
          }
          <div style={{ marginTop: 8, opacity: 0.6, fontSize: 11 }}>~ Double Click anywhere to return ~</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      onDoubleClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        animation: 'fadeIn 0.3s ease-out',
        cursor: 'pointer' // indicating it's clickable
      }}
    >
      <GlowCard 
        onDoubleClick={(e) => {
          // Allow bubbling so the background double click also triggers
        }}
        style={{ 
          background: 'rgba(10,10,15,0.7)', 
          border: `1px solid ${C.border}`,
          width: '100%',
          maxWidth: 1200,
          cursor: 'default',
          boxShadow: '0 0 50px rgba(0,0,0,0.8), 0 0 20px rgba(74,207,172,0.1)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 30px', borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#4acfac', fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>
              {t('predict.shapleyTitle', 'FEATURE IMPORTANCE')}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
              {t('predict.shapleyDesc', 'Shapley values for marginal performance contribution')}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{
              display: 'flex', background: 'rgba(0,0,0,0.4)',
              borderRadius: 14, padding: 6, border: `1px solid rgba(74,207,172,0.2)`
            }}>
              {METRIC_META.map(m => (
                <button
                  key={m.key}
                  onClick={(e) => {
                    e.stopPropagation(); // prevent double clicking the button from closing
                    setActiveMetric(m.key);
                  }}
                  onDoubleClick={(e) => e.stopPropagation()} // double click on buttons should not close
                  style={{
                    padding: '8px 16px',
                    background: activeMetric === m.key ? 'rgba(74,207,172,0.3)' : 'transparent',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 900,
                    color: activeMetric === m.key ? '#fff' : 'rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    fontFamily: "'Orbitron', sans-serif",
                    transition: 'all 0.3s',
                    boxShadow: activeMetric === m.key ? '0 0 15px rgba(74,207,172,0.3)' : 'none',
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleFetch();
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              disabled={loading}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: loading ? 'transparent' : 'rgba(74,207,172,0.1)',
                border: `1px solid ${loading ? 'transparent' : 'rgba(74,207,172,0.3)'}`,
                color: '#4acfac',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <span style={{ fontSize: 16, animation: loading ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'rgba(255,107,107,0.1)',
                border: `1px solid rgba(255,107,107,0.3)`,
                color: '#ff6b6b', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginLeft: 8
              }}
              title="Close (Or double-click background)"
            >
              ✕
            </button>
          </div>
        </div>
        
        {content}
      </GlowCard>
    </div>
  );
}
