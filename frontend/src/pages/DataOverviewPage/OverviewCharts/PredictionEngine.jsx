import { useEffect, useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import C from '../../../constants/colors';
import { useT } from '../../../i18n';
import { useSettings } from '../../../contexts/SettingsContext';
import { fetchPerformanceComparison } from '../../../services/api';
import { fmtNum } from '../../../utils/fmt';

const FULL_VARS = ['U_Wind', 'V_Wind', 'Temperature', 'Dust_Optical_Depth', 'Solar_Flux_DN'];

function getCompareData(results) {
  const keys = Object.keys(results || {});
  const baselineKey = keys.find((key) => key === 'baseline') || keys[0];
  const fullKey = keys.find((key) => key !== baselineKey) || keys[1];
  return {
    baseline: results?.[baselineKey],
    full: results?.[fullKey],
  };
}

export default function PredictionEngine() {
  const t = useT();
  const { settings } = useSettings();

  const isLight = settings?.theme === 'light';
  const plotText = isLight ? '#444444' : 'rgba(255,255,255,0.85)';
  const plotGrid = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.15)';

  const isZh = settings.language !== 'en';
  const copy = isZh ? {
    loading: '正在加载模型表现...',
    baselineLabel: '仅 O3',
    fullLabel: '完整驱动',
    baselineR2: '基线模型 R²',
    fullR2: '完整模型 R²',
    gain: '相对提升',
    baselineDesc: '仅使用 O3 自回归',
    fullDesc: 'O3 + 5 个环境驱动',
    gainDesc: '全局 R² 提升',
    rmse: 'RMSE 降幅',
    ssim: 'SSIM 提升',
    scope: '评估范围',
    scopeValue: 'MY27 → MY28',
    xTitle: '太阳黄经推进',
    yTitle: '空间 R²',
    my28Begins: 'MY28 开始',
  } : {
    loading: 'LOADING MODEL PERFORMANCE...',
    baselineLabel: 'O3 Only',
    fullLabel: 'Full Forcing',
    baselineR2: 'BASELINE R²',
    fullR2: 'FULL MODEL R²',
    gain: 'GAIN OVER BASELINE',
    baselineDesc: 'O3 autoregressive only',
    fullDesc: 'O3 + 5 environmental forcings',
    gainDesc: 'global R² improvement',
    rmse: 'RMSE reduction',
    ssim: 'SSIM gain',
    scope: 'Evaluation scope',
    scopeValue: 'MY27 → MY28',
    xTitle: 'Solar longitude progression',
    yTitle: 'Spatial R²',
    my28Begins: 'MY28 begins',
  };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPerformanceComparison([[], FULL_VARS])
      .then((res) => {
        if (active) {
          setData(getCompareData(res.results));
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const improvement = useMemo(() => {
    if (!data?.baseline || !data?.full) return null;
    return {
      r2: data.full.global_r2 - data.baseline.global_r2,
      rmse: data.baseline.global_rmse - data.full.global_rmse,
      ssim: data.full.global_ssim - data.baseline.global_ssim,
    };
  }, [data]);

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.ice, fontFamily: "'Orbitron', sans-serif", display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 16,
            height: 16,
            border: `2px solid rgba(199,91,57,0.2)`,
            borderTop: `2px solid ${C.mars}`,
            borderRadius: '50%',
            animation: 'spin-slow 1s linear infinite',
          }} />
          {copy.loading}
        </div>
      </div>
    );
  }

  if (!data?.baseline || !data?.full) {
    return <div style={{ color: C.mars, padding: 20 }}>{t('overview.charts.noData')}</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateRows: 'auto auto minmax(320px, 1fr)', gap: 16, overflowX: 'hidden', overflowY: 'auto', scrollbarGutter: 'stable', paddingRight: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(74,158,255,0.08)', border: '1px solid rgba(74,158,255,0.18)' }}>
          <div style={{ color: C.ice30, fontSize: 10, letterSpacing: 1, fontFamily: "'Orbitron', sans-serif" }}>{copy.baselineR2}</div>
          <div style={{ marginTop: 6, color: C.blue, fontSize: 20, fontWeight: 800, fontFamily: "'Orbitron', sans-serif" }}>
            {fmtNum(data.baseline.global_r2, 4)}
          </div>
          <div style={{ color: C.ice30, fontSize: 11 }}>{copy.baselineDesc}</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(199,91,57,0.08)', border: '1px solid rgba(199,91,57,0.18)' }}>
          <div style={{ color: C.ice30, fontSize: 10, letterSpacing: 1, fontFamily: "'Orbitron', sans-serif" }}>{copy.fullR2}</div>
          <div style={{ marginTop: 6, color: C.mars, fontSize: 20, fontWeight: 800, fontFamily: "'Orbitron', sans-serif" }}>
            {fmtNum(data.full.global_r2, 4)}
          </div>
          <div style={{ color: C.ice30, fontSize: 11 }}>{copy.fullDesc}</div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(74,207,172,0.08)', border: '1px solid rgba(74,207,172,0.18)' }}>
          <div style={{ color: C.ice30, fontSize: 10, letterSpacing: 1, fontFamily: "'Orbitron', sans-serif" }}>{copy.gain}</div>
          <div style={{ marginTop: 6, color: '#4acfac', fontSize: 20, fontWeight: 800, fontFamily: "'Orbitron', sans-serif" }}>
            +{fmtNum(improvement?.r2 ?? 0, 4)}
          </div>
          <div style={{ color: C.ice30, fontSize: 11 }}>{copy.gainDesc}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
          <div style={{ color: C.ice30, fontSize: 10 }}>{copy.rmse}</div>
          <div style={{ marginTop: 4, color: C.ice, fontSize: 16, fontWeight: 700 }}>{fmtNum(improvement?.rmse ?? 0, 4)}</div>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
          <div style={{ color: C.ice30, fontSize: 10 }}>{copy.ssim}</div>
          <div style={{ marginTop: 4, color: C.ice, fontSize: 16, fontWeight: 700 }}>{fmtNum(improvement?.ssim ?? 0, 4)}</div>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
          <div style={{ color: C.ice30, fontSize: 10 }}>{copy.scope}</div>
          <div style={{ marginTop: 4, color: C.ice, fontSize: 16, fontWeight: 700 }}>{copy.scopeValue}</div>
        </div>
      </div>

      <div style={{ minHeight: 320 }}>
        <Plot
          data={[
            {
              x: data.baseline.items.map((item) => item.ls + (item.my === 28 ? 360 : 0)),
              y: data.baseline.items.map((item) => item.r2),
              type: 'scatter',
              mode: 'lines',
              name: copy.baselineLabel,
              line: { color: C.blue, width: 2.5, shape: 'spline' },
              hovertemplate: `${copy.baselineLabel}<br>MY%{text} · Ls %{customdata:.1f}°<br>R² %{y:.4f}<extra></extra>`,
              text: data.baseline.items.map((item) => item.my),
              customdata: data.baseline.items.map((item) => item.ls),
            },
            {
              x: data.full.items.map((item) => item.ls + (item.my === 28 ? 360 : 0)),
              y: data.full.items.map((item) => item.r2),
              type: 'scatter',
              mode: 'lines',
              name: copy.fullLabel,
              line: { color: C.mars, width: 3, shape: 'spline' },
              hovertemplate: `${copy.fullLabel}<br>MY%{text} · Ls %{customdata:.1f}°<br>R² %{y:.4f}<extra></extra>`,
              text: data.full.items.map((item) => item.my),
              customdata: data.full.items.map((item) => item.ls),
            },
          ]}
          layout={{
            autosize: true,
            paper_bgcolor: 'transparent',
            plot_bgcolor: 'transparent',
            margin: { l: 58, r: 24, t: 24, b: 52 },
            xaxis: {
              title: copy.xTitle,
              gridcolor: plotGrid,
              tickfont: { color: plotText, size: 10  },
              titlefont: { color: plotText, size: 11  },
              automargin: true,
            },
            yaxis: {
              title: copy.yTitle,
              gridcolor: plotGrid,
              tickfont: { color: plotText, size: 10  },
              titlefont: { color: plotText, size: 11  },
              automargin: true,
            },
            legend: {
              orientation: 'h',
              y: 1.08,
              font: { color: plotText, size: 11  },
            },
            shapes: [
              {
                type: 'line',
                x0: 360,
                x1: 360,
                y0: 0,
                y1: 1,
                yref: 'paper',
                line: { color: 'rgba(255,255,255,0.16)', width: 1, dash: 'dash' },
              },
            ],
            annotations: [
              {
                x: 360,
                y: 1.06,
                xref: 'x',
                yref: 'paper',
                text: copy.my28Begins,
                showarrow: false,
                font: { color: plotText, size: 10  },
              },
            ],
          }}
          config={{ displayModeBar: false, responsive: true }}
          useResizeHandler
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </div>
  );
}
