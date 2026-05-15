import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Plot from 'react-plotly.js';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import GlowCard from '../../components/GlowCard';
import { fetchShapleyGlobal, fetchShapleyValues } from '../../services/api';

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 11a8 8 0 1 0 2.1 5.4M20 11v6m0-6h-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ShapleyImportanceChart({
  isLight,
  plotTextColor,
  plotGridColor,
  onClose,
  mode = null,
}) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [activeMode, setActiveMode] = useState(mode || 'gradient');
  const [activeMetric, setActiveMetric] = useState('r2');
  const [gradientData, setGradientData] = useState(null);
  const [marginalDataCache, setMarginalDataCache] = useState({});
  const [error, setError] = useState(null);

  const marginalData = marginalDataCache[activeMetric] || null;

  const theme = useMemo(() => ({
    overlay: isLight ? 'rgba(243,246,250,0.72)' : 'rgba(10,14,20,0.76)',
    card: isLight ? 'rgba(255,255,255,0.98)' : 'rgba(23,29,38,0.96)',
    panel: isLight ? 'rgba(15,23,42,0.03)' : 'rgba(255,255,255,0.04)',
    panelStrong: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)',
    border: isLight ? 'rgba(23,33,47,0.10)' : 'rgba(255,255,255,0.10)',
    borderStrong: isLight ? 'rgba(23,33,47,0.16)' : 'rgba(255,255,255,0.16)',
    text: isLight ? '#17212f' : '#f5f7fb',
    textSoft: isLight ? 'rgba(23,33,47,0.72)' : 'rgba(245,247,251,0.72)',
    textMute: isLight ? 'rgba(23,33,47,0.50)' : 'rgba(245,247,251,0.48)',
    accent: isLight ? '#2f6fd6' : C.blue,
    accentSoft: isLight ? 'rgba(47,111,214,0.10)' : 'rgba(74,158,255,0.12)',
    accentBorder: isLight ? 'rgba(47,111,214,0.22)' : 'rgba(74,158,255,0.24)',
    purple: '#8b6fe8',
    purpleSoft: isLight ? 'rgba(139,111,232,0.10)' : 'rgba(139,111,232,0.14)',
    warningBg: isLight ? 'rgba(180,126,16,0.08)' : 'rgba(245,158,11,0.10)',
    warningBorder: isLight ? 'rgba(180,126,16,0.18)' : 'rgba(245,158,11,0.24)',
    warningText: isLight ? '#8a5f12' : '#f5c15b',
    errorBg: isLight ? 'rgba(199,91,57,0.08)' : 'rgba(199,91,57,0.12)',
    errorBorder: isLight ? 'rgba(199,91,57,0.22)' : 'rgba(199,91,57,0.26)',
  }), [isLight]);

  const resolvedPlotText = plotTextColor ?? theme.textSoft;
  const resolvedPlotGrid = plotGridColor ?? (isLight ? 'rgba(23,33,47,0.08)' : 'rgba(255,255,255,0.08)');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeMode === 'gradient') {
        if (!gradientData) {
          const result = await fetchShapleyGlobal();
          setGradientData(result);
        }
      } else if (!marginalDataCache[activeMetric]) {
        const result = await fetchShapleyValues(activeMetric);
        setMarginalDataCache((prev) => ({ ...prev, [activeMetric]: result }));
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

  const getVarLabel = (name) => {
    const key = name === 'Ozone' ? 'Ozone' : name;
    return t(`predict.variables.${key}`, name);
  };

  const barPlotData = useMemo(() => {
    if (!gradientData?.bar_data) return null;
    const sorted = [...gradientData.bar_data].reverse();
    return {
      y: sorted.map((d) => getVarLabel(d.name)),
      x: sorted.map((d) => d.value),
      text: sorted.map((d) => d.value.toFixed(4)),
    };
  }, [gradientData, t]);

  const marginalPlotData = useMemo(() => {
    if (!marginalData?.shapley_values) return null;
    const sorted = Object.entries(marginalData.shapley_values).reverse();
    return {
      y: sorted.map(([name]) => getVarLabel(name)),
      x: sorted.map(([, val]) => val),
      text: sorted.map(([, val]) => val.toFixed(4)),
    };
  }, [marginalData, t]);

  const summaryPlotData = useMemo(() => {
    if (!gradientData?.summary_data) return null;
    return gradientData.summary_data.map((feat, idx) => {
      const yBase = idx;
      const jitter = feat.shap_values.map(() => yBase + (Math.random() - 0.5) * 0.4);

      return {
        x: feat.shap_values,
        y: jitter,
        name: getVarLabel(feat.name),
        mode: 'markers',
        type: 'scattergl',
        marker: {
          size: 4,
          opacity: 0.65,
          color: feat.feature_values,
          colorscale: 'RdBu',
          reversescale: true,
          showscale: idx === 0,
          colorbar: idx === 0 ? {
            title: { text: t('predict.shapley.featureValue'), font: { size: 10, color: resolvedPlotText } },
            tickfont: { color: resolvedPlotText, size: 9 },
            thickness: 12,
            outlinewidth: 0,
            x: 1.04,
          } : undefined,
        },
        hovertemplate: `<b>${getVarLabel(feat.name)}</b><br>SHAP: %{x:.4f}<br>Value: %{marker.color:.2f}<extra></extra>`,
      };
    }).reverse();
  }, [gradientData, resolvedPlotText, t]);

  const commonLayout = useMemo(() => ({
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Inter, sans-serif', color: resolvedPlotText },
    margin: { t: 32, b: 56, l: 200, r: 40 },
    xaxis: {
      gridcolor: resolvedPlotGrid,
      zerolinecolor: isLight ? 'rgba(23,33,47,0.10)' : 'rgba(255,255,255,0.10)',
      tickfont: { size: 10, color: resolvedPlotText },
      titlefont: { size: 11, color: resolvedPlotText },
    },
    yaxis: {
      gridcolor: 'transparent',
      tickfont: { size: 12, color: theme.textSoft },
      tickpad: 22,
      automargin: true,
    },
    hovermode: 'closest',
    showlegend: false,
  }), [isLight, resolvedPlotGrid, resolvedPlotText, theme.textSoft]);

  const handleRefresh = () => {
    if (activeMode === 'gradient') {
      setGradientData(null);
    } else {
      setMarginalDataCache((prev) => ({ ...prev, [activeMetric]: null }));
    }
    fetchData();
  };

  if (loading) {
    return createPortal(
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: theme.overlay,
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            width: 320,
            maxWidth: '100%',
            background: theme.card,
            border: `1px solid ${theme.border}`,
            borderRadius: 20,
            boxShadow: isLight ? '0 20px 48px rgba(15,23,42,0.10)' : '0 20px 48px rgba(0,0,0,0.28)',
            padding: '32px 28px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              margin: '0 auto 18px',
              borderRadius: '50%',
              border: `3px solid ${theme.accentSoft}`,
              borderTopColor: theme.accent,
              animation: 'shap-spin 0.8s linear infinite',
            }}
          />
          <div
            style={{
              fontSize: 'calc(18px * var(--font-scale, 1))',
              fontWeight: 700,
              color: theme.text,
              fontFamily: 'var(--font-display)',
              marginBottom: 8,
            }}
          >
            {t('predict.shapleyGeneratingBtn')}
          </div>
          <div
            style={{
              fontSize: 'calc(12px * var(--font-scale, 1))',
              color: theme.textSoft,
              lineHeight: 1.6,
            }}
          >
            Loading feature contribution data and preparing the analysis view.
          </div>
        </div>
        <style>{`
          @keyframes shap-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>,
      document.body,
    );
  }

  if (error) {
    return createPortal(
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: theme.overlay,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div
          style={{
            width: 420,
            maxWidth: '100%',
            background: theme.card,
            border: `1px solid ${theme.errorBorder}`,
            borderRadius: 20,
            padding: '28px 28px 24px',
            boxShadow: isLight ? '0 20px 48px rgba(15,23,42,0.10)' : '0 20px 48px rgba(0,0,0,0.28)',
          }}
        >
          <div
            style={{
              fontSize: 'calc(18px * var(--font-scale, 1))',
              fontWeight: 700,
              color: theme.text,
              fontFamily: 'var(--font-display)',
              marginBottom: 8,
            }}
          >
            SHAP analysis unavailable
          </div>
          <div
            style={{
              fontSize: 'calc(13px * var(--font-scale, 1))',
              color: theme.textSoft,
              lineHeight: 1.7,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: 10,
                border: `1px solid ${theme.border}`,
                background: theme.panel,
                color: theme.text,
                fontSize: 'calc(12px * var(--font-scale, 1))',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
            <button
              onClick={fetchData}
              style={{
                padding: '9px 16px',
                borderRadius: 10,
                border: `1px solid ${theme.accentBorder}`,
                background: theme.accent,
                color: '#ffffff',
                fontSize: 'calc(12px * var(--font-scale, 1))',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: theme.overlay,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 20px',
      }}
      onDoubleClick={onClose}
    >
      <GlowCard
        className="border shadow-2xl"
        style={{
          width: '100%',
          maxWidth: 1240,
          maxHeight: '92vh',
          background: theme.card,
          borderColor: theme.border,
          animation: 'shap-scale-in 0.24s ease-out',
          cursor: 'default',
        }}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            padding: '24px 28px 18px',
            borderBottom: `1px solid ${theme.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 'calc(11px * var(--font-scale, 1))',
                fontWeight: 700,
                color: theme.accent,
                letterSpacing: 0.6,
                fontFamily: 'var(--font-display)',
                marginBottom: 8,
              }}
            >
              Explainability
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontSize: 'calc(22px * var(--font-scale, 1))',
                  fontWeight: 700,
                  color: theme.text,
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '-0.01em',
                }}
              >
                {t('predict.shapley.title')}
              </h1>
              <span
                style={{
                  padding: '5px 10px',
                  borderRadius: 999,
                  background: activeMode === 'gradient' ? theme.accentSoft : theme.purpleSoft,
                  border: `1px solid ${activeMode === 'gradient' ? theme.accentBorder : 'rgba(139,111,232,0.20)'}`,
                  color: activeMode === 'gradient' ? theme.accent : theme.purple,
                  fontSize: 'calc(11px * var(--font-scale, 1))',
                  fontWeight: 600,
                }}
              >
                {activeMode === 'gradient' ? t('predict.shapley.gradientSystem') : t('predict.shapley.marginalSystem')}
              </span>
            </div>
            <div
              style={{
                marginTop: 8,
                fontSize: 'calc(12px * var(--font-scale, 1))',
                color: theme.textSoft,
                lineHeight: 1.6,
              }}
            >
              Compare global importance and metric-level contribution patterns in one focused analysis workspace.
            </div>
            {!mode && (
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setActiveMode('gradient')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: `1px solid ${activeMode === 'gradient' ? theme.accentBorder : theme.border}`,
                    background: activeMode === 'gradient' ? theme.accentSoft : 'transparent',
                    color: activeMode === 'gradient' ? theme.accent : theme.textSoft,
                    fontSize: 'calc(12px * var(--font-scale, 1))',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('predict.shapley.gradientTab')}
                </button>
                <button
                  onClick={() => setActiveMode('marginal')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: `1px solid ${activeMode === 'marginal' ? 'rgba(139,111,232,0.20)' : theme.border}`,
                    background: activeMode === 'marginal' ? theme.purpleSoft : 'transparent',
                    color: activeMode === 'marginal' ? theme.purple : theme.textSoft,
                    fontSize: 'calc(12px * var(--font-scale, 1))',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t('predict.shapley.marginalTab')}
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {activeMode === 'marginal' && (
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  padding: 4,
                  borderRadius: 12,
                  border: `1px solid ${theme.border}`,
                  background: theme.panel,
                }}
              >
                {['r2', 'rmse', 'mae', 'ssim'].map((metric) => {
                  const active = activeMetric === metric;
                  return (
                    <button
                      key={metric}
                      onClick={() => setActiveMetric(metric)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: 'none',
                        background: active ? theme.purple : 'transparent',
                        color: active ? '#ffffff' : theme.textSoft,
                        fontSize: 'calc(11px * var(--font-scale, 1))',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {metric.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              onClick={handleRefresh}
              aria-label="Refresh shap charts"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                border: `1px solid ${theme.border}`,
                background: theme.panel,
                color: theme.textSoft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <RefreshIcon />
            </button>
            <button
              onClick={onClose}
              aria-label="Close shap charts"
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                border: `1px solid ${theme.border}`,
                background: theme.panel,
                color: theme.textSoft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '22px 28px 20px',
          }}
        >
          {activeMode === 'marginal' && !marginalData && !loading && (
            <div
              style={{
                marginBottom: 20,
                padding: '14px 16px',
                borderRadius: 14,
                background: theme.warningBg,
                border: `1px solid ${theme.warningBorder}`,
              }}
            >
              <div
                style={{
                  fontSize: 'calc(12px * var(--font-scale, 1))',
                  fontWeight: 700,
                  color: theme.warningText,
                  marginBottom: 4,
                }}
              >
                {t('predict.shapley.cacheMissing')}
              </div>
              <div
                style={{
                  fontSize: 'calc(12px * var(--font-scale, 1))',
                  color: theme.textSoft,
                  lineHeight: 1.6,
                }}
              >
                {t('predict.shapley.cacheMissingDesc')}
              </div>
            </div>
          )}

          {activeMode === 'gradient' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: 18,
              }}
            >
              <div
                style={{
                  background: theme.panel,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 18,
                  padding: 18,
                }}
              >
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 'calc(14px * var(--font-scale, 1))',
                      fontWeight: 700,
                      color: theme.text,
                      fontFamily: 'var(--font-display)',
                      marginBottom: 4,
                    }}
                  >
                    {t('predict.shapley.importanceTitle')}
                  </div>
                  <div
                    style={{
                      fontSize: 'calc(11px * var(--font-scale, 1))',
                      color: theme.textMute,
                    }}
                  >
                    Mean absolute SHAP contribution by variable.
                  </div>
                </div>
                <Plot
                  data={[{
                    type: 'bar',
                    x: barPlotData?.x,
                    y: barPlotData?.y,
                    orientation: 'h',
                    marker: {
                      color: theme.accent,
                      opacity: 0.85,
                      line: { color: theme.accent, width: 0 },
                    },
                    text: barPlotData?.text,
                    textposition: 'outside',
                    cliponaxis: false,
                  }]}
                  layout={{
                    ...commonLayout,
                    height: 480,
                    xaxis: {
                      ...commonLayout.xaxis,
                      title: { text: t('predict.shapley.meanShap'), font: { size: 11, color: resolvedPlotText } },
                    },
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                />
              </div>

              <div
                style={{
                  background: theme.panel,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 18,
                  padding: 18,
                }}
              >
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 'calc(14px * var(--font-scale, 1))',
                      fontWeight: 700,
                      color: theme.text,
                      fontFamily: 'var(--font-display)',
                      marginBottom: 4,
                    }}
                  >
                    {t('predict.shapley.swarmTitle')}
                  </div>
                  <div
                    style={{
                      fontSize: 'calc(11px * var(--font-scale, 1))',
                      color: theme.textMute,
                    }}
                  >
                    Distribution of local impact values across samples.
                  </div>
                </div>
                <Plot
                  data={summaryPlotData}
                  layout={{
                    ...commonLayout,
                    height: 480,
                    xaxis: {
                      ...commonLayout.xaxis,
                      title: { text: t('predict.shapley.impactOnPred'), font: { size: 11, color: resolvedPlotText } },
                    },
                    yaxis: {
                      ...commonLayout.yaxis,
                      tickvals: gradientData?.summary_data.map((_, i) => i),
                      ticktext: gradientData?.summary_data.map((d) => getVarLabel(d.name)),
                    },
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          ) : (
            <div
              style={{
                background: theme.panel,
                border: `1px solid ${theme.border}`,
                borderRadius: 18,
                padding: 20,
                minHeight: 520,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                  marginBottom: 18,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 'calc(14px * var(--font-scale, 1))',
                      fontWeight: 700,
                      color: theme.text,
                      fontFamily: 'var(--font-display)',
                      marginBottom: 4,
                    }}
                  >
                    {t('predict.shapley.marginalAnalysisTitle')}
                  </div>
                  <div
                    style={{
                      fontSize: 'calc(11px * var(--font-scale, 1))',
                      color: theme.textMute,
                    }}
                  >
                    Average variable contribution against the selected evaluation metric.
                  </div>
                </div>
                <div
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: theme.purpleSoft,
                    border: '1px solid rgba(139,111,232,0.20)',
                    color: theme.purple,
                    fontSize: 'calc(11px * var(--font-scale, 1))',
                    fontWeight: 700,
                  }}
                >
                  METRIC · {activeMetric.toUpperCase()}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <Plot
                  data={[{
                    type: 'bar',
                    x: marginalPlotData?.x,
                    y: marginalPlotData?.y,
                    orientation: 'h',
                    marker: {
                      color: marginalPlotData?.x?.map((v) =>
                        (activeMetric === 'r2' || activeMetric === 'ssim')
                          ? (v > 0 ? theme.purple : 'rgba(139,111,232,0.28)')
                          : (v < 0 ? theme.purple : 'rgba(139,111,232,0.28)'),
                      ),
                      line: { color: theme.purple, width: 0 },
                    },
                    text: marginalPlotData?.text,
                    textposition: marginalPlotData?.x?.map((v) => v < 0 ? 'inside' : 'outside'),
                    insidetextanchor: 'end',
                    cliponaxis: false,
                  }]}
                  layout={{
                    ...commonLayout,
                    height: 500,
                    margin: { ...commonLayout.margin, l: 240 },
                    xaxis: {
                      ...commonLayout.xaxis,
                      title: {
                        text: t('predict.shapley.avgContribution', { metric: activeMetric.toUpperCase() }),
                        font: { size: 11, color: resolvedPlotText },
                      },
                    },
                  }}
                  config={{ displayModeBar: false, responsive: true }}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>

              <div
                style={{
                  marginTop: 18,
                  padding: '16px 18px',
                  borderRadius: 16,
                  background: theme.panelStrong,
                  border: `1px solid ${theme.border}`,
                }}
              >
                <div
                  style={{
                    fontSize: 'calc(12px * var(--font-scale, 1))',
                    fontWeight: 700,
                    color: theme.purple,
                    fontFamily: 'var(--font-display)',
                    marginBottom: 8,
                  }}
                >
                  {t('predict.shapley.mathPrinciple')}
                </div>
                <div
                  style={{
                    fontSize: 'calc(12px * var(--font-scale, 1))',
                    color: theme.textSoft,
                    lineHeight: 1.7,
                  }}
                >
                  {t('predict.shapley.mathDesc', { metric: activeMetric.toUpperCase() })}
                  <span style={{ color: theme.purple }}>
                    {' '}
                    {(activeMetric === 'r2' || activeMetric === 'ssim')
                      ? t('predict.shapley.mathDescNote.higher', { metric: activeMetric.toUpperCase() })
                      : t('predict.shapley.mathDescNote.lower', { metric: activeMetric.toUpperCase() })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 12,
            padding: '0 28px 24px',
            color: theme.textMute,
            fontSize: 'calc(10px * var(--font-scale, 1))',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme.accent, display: 'inline-block' }} />
              {t('predict.shapley.lowValue')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d34f4f', display: 'inline-block' }} />
              {t('predict.shapley.highValue')}
            </span>
          </div>
          <div style={{ lineHeight: 1.6 }}>
            {t('predict.shapley.footerNote').split('\n')[0]}
            <br />
            {t('predict.shapley.footerNote').split('\n')[1]}
          </div>
        </div>
      </GlowCard>

      <style>{`
        @keyframes shap-scale-in {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>,
    document.body,
  );
}
