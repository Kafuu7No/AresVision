import Plot from 'react-plotly.js';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import GlowCard from '../../components/GlowCard';
import { fmtNum } from '../../utils/fmt';
import { METRIC_META } from './PredictComponents';
import { useSettings } from '../../contexts/SettingsContext';

const SHORTHAND_MAP = {
  Temperature: 'T',
  Dust_Optical_Depth: 'D',
  Surface_Pressure: 'P',
  Solar_Flux_DN: 'S',
  U_Wind: 'U',
  V_Wind: 'V',
};

const SERIES_COLORS = [C.mars, C.blue, C.green, C.purple, '#d9a441', '#6fa9ff'];
const GOOD_METRICS = new Set(['r2', 'ssim']);

const getShorthands = (vars) => {
  if (!vars || vars.length === 0) return 'baseline';
  return vars.map((v) => SHORTHAND_MAP[v] || v[0]).sort().join('');
};

const cardTitleClampStyle = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  overflow: 'hidden',
  lineHeight: 1.35,
  minHeight: '2.7em',
};

function CompactStatCard({ label, value, hint, color, compact = false, eyebrow, valueClampLines = 3 }) {
  return (
    <div
      style={{
        padding: compact ? '12px 14px' : '14px 16px',
        borderRadius: 14,
        background: C.bgMuted,
        border: `1px solid ${C.border}`,
        minWidth: 0,
      }}
    >
      {eyebrow ? (
        <div
          style={{
            fontSize: 'calc(9px * var(--font-scale, 1))',
            color: C.ice40,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          {eyebrow}
        </div>
      ) : null}
      <div
        style={{
          fontSize: 'calc(10px * var(--font-scale, 1))',
          color: C.ice40,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          ...cardTitleClampStyle,
        }}
        title={label}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: compact ? 8 : 10,
          fontSize: compact ? 'calc(17px * var(--font-scale, 1))' : 'calc(18px * var(--font-scale, 1))',
          fontWeight: 800,
          color,
          fontFamily: 'var(--font-display)',
          letterSpacing: '-0.02em',
          overflowWrap: 'anywhere',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: valueClampLines,
          overflow: 'hidden',
        }}
        title={String(value)}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 'calc(10px * var(--font-scale, 1))',
          color: C.ice60,
          overflowWrap: 'anywhere',
          lineHeight: 1.45,
        }}
        title={hint || ''}
      >
        {hint}
      </div>
    </div>
  );
}

function MetricSelector({ activePerfMetric, setActivePerfMetric }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: 4,
        borderRadius: 14,
        background: C.bgMuted,
        border: `1px solid ${C.border}`,
        flexWrap: 'wrap',
      }}
    >
      {METRIC_META.map((metric) => {
        const active = activePerfMetric === metric.key;
        return (
          <button
            key={metric.key}
            onClick={() => setActivePerfMetric(metric.key)}
            style={{
              padding: '7px 12px',
              border: 'none',
              borderRadius: 10,
              background: active ? 'rgba(121,187,255,0.16)' : 'transparent',
              color: active ? C.blue : C.ice60,
              fontSize: 'calc(11px * var(--font-scale, 1))',
              fontWeight: active ? 700 : 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {metric.name}
          </button>
        );
      })}
    </div>
  );
}

export default function PredictPerformance({
  isLight,
  performanceData,
  perfLoading,
  activePerfMetric,
  setActivePerfMetric,
  handleFetchPerformance,
  compareConfigs,
  activeCompareId,
  setActiveCompareId,
  plotTextColor,
  plotText60,
  plotGridColor,
  precision,
  selectedCompareIds,
  hiddenCompareIds = [],
}) {
  const t = useT();
  const { settings } = useSettings();
  const isZh = settings?.language !== 'en';
  const copy = {
    title: isZh ? '测试集表现走势' : 'Test-set performance trend',
    subtitle: isZh
      ? '按火星季节查看不同模型组合在测试集上的表现变化，更适合判断稳定性而不是只看单点分数。'
      : 'Inspect how each configuration behaves across the test set to judge stability, not just a single score.',
    refresh: isZh ? '刷新曲线' : 'Refresh curves',
    empty: isZh ? '生成测试集曲线后，这里会展示模型在不同时刻的表现变化。' : 'Generate the test-set curves to inspect performance changes over time.',
    noData: isZh ? '当前没有可展示的曲线数据。' : 'No curve data is available for the current selection.',
    compare: isZh ? '对比对象' : 'Comparison target',
    overview: isZh ? '当前概览' : 'Current overview',
    bestSlice: isZh ? '最佳时段' : 'Best slice',
    mean: isZh ? '平均指标' : 'Average metric',
    globalSummary: isZh ? '全局摘要' : 'Global summary',
    hiddenHint: isZh ? '隐藏组合不会出现在曲线图中。' : 'Hidden configurations are excluded from the chart.',
    activeModel: isZh ? '当前模型' : 'Active model',
    activeModelHint: isZh ? '当前详情面板聚焦的模型组合' : 'The model configuration currently highlighted in this panel',
    globalEyebrow: isZh ? '全局' : 'Global',
  };

  const filteredEntries = Object.entries(performanceData?.results || {}).filter(([key]) => {
    if (selectedCompareIds.length > 0 && (key === 'current' || key === 'baseline')) return false;
    const config = compareConfigs.find((item) => item.id === key || getShorthands(item.vars) === key);
    if (config && hiddenCompareIds.includes(config.id)) return false;
    return true;
  });

  const traces = filteredEntries
    .map(([key, perf], index) => {
      if (!perf?.items?.length) return null;
      const config = compareConfigs.find((item) => item.id === key || getShorthands(item.vars) === key);
      const label = config?.label || key;
      const color = SERIES_COLORS[index % SERIES_COLORS.length];
      return {
        key,
        label,
        color,
        plot: {
          x: perf.items.map((item) => (item.my === 27 ? item.ls : (item.ls != null ? item.ls + 360 : 0))),
          y: perf.items.map((item) => (item[activePerfMetric] != null ? item[activePerfMetric] : 0)),
          type: 'scatter',
          mode: 'lines+markers',
          name: label,
          marker: { color, size: 5 },
          line: { color, width: activeCompareId === key ? 3.5 : 2.2, shape: 'spline' },
          hovertemplate: `<b>${label}</b><br>MY%{customdata[0]} Ls %{customdata[1]:.2f}<br>${activePerfMetric.toUpperCase()}: <b>%{y:.4f}</b><extra></extra>`,
          customdata: perf.items.map((item) => [item.my, item.ls]),
        },
      };
    })
    .filter(Boolean);

  const resultKeys = traces.map((item) => item.key);
  const effectiveId = resultKeys.includes(activeCompareId) ? activeCompareId : resultKeys[0];
  const activeItem = effectiveId ? performanceData?.results?.[effectiveId] : null;

  const peakItem = activeItem?.items?.reduce((best, current) => {
    const currentValue = current?.[activePerfMetric];
    const bestValue = best?.[activePerfMetric];
    const maximize = GOOD_METRICS.has(activePerfMetric);
    if (currentValue == null) return best;
    if (!best) return current;
    return maximize ? (currentValue > bestValue ? current : best) : (currentValue < bestValue ? current : best);
  }, null);

  const globalCards = activeItem
    ? [
        { label: 'R²', value: activeItem.global_r2, color: C.green },
        { label: 'RMSE', value: activeItem.global_rmse, color: C.mars },
        { label: 'MAE', value: activeItem.global_mae, color: C.mars },
        { label: 'SSIM', value: activeItem.global_ssim, color: C.green },
      ]
    : [];

  const metricName = METRIC_META.find((item) => item.key === activePerfMetric)?.name || activePerfMetric;

  return (
    <GlowCard style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 560, minWidth: 0 }}>
          <div style={{ fontSize: 'calc(15px * var(--font-scale, 1))', fontWeight: 700, color: C.ice, fontFamily: 'var(--font-display)' }}>
            {copy.title}
          </div>
          <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice60, marginTop: 6, lineHeight: 1.6 }}>
            {copy.subtitle}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', minWidth: 0 }}>
          <MetricSelector activePerfMetric={activePerfMetric} setActivePerfMetric={setActivePerfMetric} />
          <button
            onClick={handleFetchPerformance}
            disabled={perfLoading}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: `1px solid ${C.borderStrong}`,
              background: C.bgMuted,
              color: perfLoading ? C.ice40 : C.ice70,
              fontSize: 'calc(11px * var(--font-scale, 1))',
              fontWeight: 700,
              cursor: perfLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {perfLoading ? t('predict.generatingBtn') : copy.refresh}
          </button>
        </div>
      </div>

      {performanceData ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          <div
            style={{
              background: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.02)',
              borderRadius: 18,
              border: `1px solid ${C.border}`,
              padding: 12,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            {traces.length > 0 ? (
              <Plot
                data={traces.map((item) => item.plot)}
                layout={{
                  autosize: true,
                  height: 360,
                  margin: { l: 52, r: 28, t: 16, b: 48 },
                  paper_bgcolor: 'rgba(0,0,0,0)',
                  plot_bgcolor: 'rgba(0,0,0,0)',
                  xaxis: {
                    title: { text: t('predict.performance.xAxisTitle'), font: { size: 11, color: plotTextColor } },
                    tickfont: { size: 10, color: plotText60 },
                    gridcolor: plotGridColor,
                    zeroline: false,
                    tickmode: 'array',
                    tickvals: [350, 360, 370, 380, 390, 400, 410, 420, 430],
                    ticktext: ['350', '360', '10', '20', '30', '40', '50', '60', '70'],
                  },
                  yaxis: {
                    title: { text: metricName, font: { size: 11, color: plotTextColor } },
                    tickfont: { size: 10, color: plotText60 },
                    gridcolor: plotGridColor,
                    zeroline: false,
                    range: GOOD_METRICS.has(activePerfMetric) ? [0.6, 1.0] : undefined,
                    autorange: !GOOD_METRICS.has(activePerfMetric),
                  },
                  shapes: [
                    {
                      type: 'line',
                      x0: 360,
                      x1: 360,
                      y0: 0,
                      y1: 1,
                      yref: 'paper',
                      line: { color: isLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)', width: 1, dash: 'dash' },
                    },
                  ],
                  annotations: [
                    {
                      x: 360,
                      y: 1.08,
                      xref: 'x',
                      yref: 'paper',
                      text: t('predict.performance.newYear'),
                      showarrow: false,
                      font: { size: 9, color: plotText60 },
                    },
                  ],
                  showlegend: false,
                  hovermode: 'closest',
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%', minWidth: 0 }}
              />
            ) : (
              <div
                style={{
                  padding: '56px 24px',
                  textAlign: 'center',
                  color: C.ice60,
                  fontSize: 'calc(12px * var(--font-scale, 1))',
                }}
              >
                {copy.noData}
              </div>
            )}
          </div>

          {filteredEntries.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 220px) minmax(0, 1fr)', gap: 16, minWidth: 0 }}>
              <div
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: C.bgMuted,
                  border: `1px solid ${C.border}`,
                  minWidth: 0,
                  alignSelf: 'start',
                  maxHeight: 372,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice50, marginBottom: 10 }}>
                  {copy.compare}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    minWidth: 0,
                    overflowY: 'auto',
                    paddingRight: 4,
                  }}
                >
                  {traces.map((item) => {
                    const active = item.key === effectiveId;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setActiveCompareId(item.key)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 12,
                          border: `1px solid ${active ? item.color : C.border}`,
                          background: active ? `${item.color}14` : C.bgCard,
                          color: active ? item.color : C.ice60,
                          fontSize: 'calc(11px * var(--font-scale, 1))',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s ease',
                          minWidth: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={item.label}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                {hiddenCompareIds.length > 0 ? (
                  <div style={{ marginTop: 12, fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice40, lineHeight: 1.5 }}>
                    {copy.hiddenHint}
                  </div>
                ) : null}
              </div>

              <div style={{ display: 'grid', gap: 14, minWidth: 0 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(220px, 360px) repeat(auto-fit, minmax(170px, 210px))',
                    gap: 12,
                    minWidth: 0,
                    justifyContent: 'start',
                  }}
                >
                  <CompactStatCard
                    label={copy.activeModel}
                    value={traces.find((item) => item.key === effectiveId)?.label || '--'}
                    hint={copy.activeModelHint}
                    color={C.blue}
                    valueClampLines={2}
                  />
                  {[
                    {
                      label: copy.bestSlice,
                      value: peakItem ? `MY${peakItem.my} | Ls ${fmtNum(peakItem.ls, 1)}` : '--',
                      hint: peakItem ? fmtNum(peakItem[activePerfMetric], precision) : '--',
                      color: GOOD_METRICS.has(activePerfMetric) ? C.green : C.mars,
                    },
                    {
                      label: copy.mean,
                      value: activeItem?.items?.length
                        ? fmtNum(
                            activeItem.items.reduce((sum, item) => sum + (item?.[activePerfMetric] ?? 0), 0) / activeItem.items.length,
                            precision,
                          )
                        : '--',
                      hint: metricName,
                      color: C.purple,
                    },
                  ].map((item) => (
                    <CompactStatCard
                      key={item.label}
                      label={item.label}
                      value={item.value}
                      hint={item.hint}
                      color={item.color}
                    />
                  ))}
                </div>

                {globalCards.length > 0 ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 188px))',
                      gap: 12,
                      minWidth: 0,
                      justifyContent: 'start',
                    }}
                  >
                    {globalCards.map((metric) => (
                      <CompactStatCard
                        key={metric.label}
                        label={metric.label}
                        value={fmtNum(metric.value || 0, precision)}
                        hint={isZh ? copy.globalSummary : copy.globalEyebrow}
                        color={metric.color}
                        compact
                        eyebrow={copy.globalEyebrow}
                        valueClampLines={1}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div
          style={{
            padding: '42px 0',
            textAlign: 'center',
            color: C.ice60,
            fontSize: 'calc(12px * var(--font-scale, 1))',
            background: C.bgMuted,
            borderRadius: 16,
            border: `1px dashed ${C.borderStrong}`,
          }}
        >
          {perfLoading ? t('predict.generatingHint') : copy.empty}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice40, lineHeight: 1.6 }}>
        {t('predict.testSetNote')}
      </div>
    </GlowCard>
  );
}
