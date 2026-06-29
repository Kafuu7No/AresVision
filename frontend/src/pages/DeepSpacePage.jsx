import { useMemo, useState } from 'react';
import C from '../constants/colors';
import SectionTitle from '../components/SectionTitle';
import GlowCard from '../components/GlowCard';
import { useSettings } from '../contexts/SettingsContext';
import {
  fetchErrorDistribution,
  fetchPermutationImportance,
  fetchPredictMetrics,
  runPrediction,
} from '../services/api';
import { FieldCanvas, LoadingBox, VARIABLE_DEFS } from './PredictPage/PredictComponents';
import { buildAssessmentConfigKey, buildDeepSpaceAssessment } from './DeepSpacePage/deepSpaceAssessment';

const TASK_TYPES = [
  { id: 'orbital-observation', label: '轨道观测' },
  { id: 'landing-scout', label: '着陆前侦察' },
  { id: 'relay', label: '通信中继' },
  { id: 'crewed-precheck', label: '载人前置评估' },
];

const WINDOW_REGIONS = [
  { id: 'global', label: '全球' },
  { id: 'north', label: '北半球' },
  { id: 'south', label: '南半球' },
  { id: 'equatorial', label: '赤道带' },
  { id: 'polar', label: '极区' },
];

const LANDING_REGIONS = [
  { id: 'north-polar', label: '北极区' },
  { id: 'north-mid', label: '北中纬' },
  { id: 'equatorial', label: '赤道带' },
  { id: 'south-mid', label: '南中纬' },
  { id: 'south-polar', label: '南极区' },
];

const DURATIONS = [
  { id: 'short', label: '短期' },
  { id: 'medium', label: '中期' },
  { id: 'long', label: '长期' },
];

const POSTURES = [
  { id: 'conservative', label: '保守' },
  { id: 'standard', label: '标准' },
  { id: 'aggressive', label: '激进' },
];

const SELECTED_VARIABLES = VARIABLE_DEFS.map((item) => item.id);

function OptionChips({ items, value, onChange, columns = 'repeat(2, minmax(0, 1fr))' }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: columns, gap: 8 }}>
      {items.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            style={{
              minHeight: 38,
              padding: '9px 10px',
              borderRadius: 12,
              border: `1px solid ${active ? C.mars : C.border}`,
              background: active ? 'rgba(255,143,104,0.14)' : C.bgMuted,
              color: active ? C.mars : C.ice70,
              fontSize: 'calc(12px * var(--font-scale, 1))',
              fontWeight: active ? 800 : 650,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function ControlBlock({ title, children }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ color: C.ice60, fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 700 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function MetricTile({ label, value, tone = C.blue }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 8,
        background: C.bgMuted,
        border: `1px solid ${C.border}`,
        minHeight: 74,
      }}
    >
      <div style={{ color: C.ice50, fontSize: 'calc(10px * var(--font-scale, 1))', fontWeight: 800, letterSpacing: 0.4 }}>
        {label}
      </div>
      <div style={{ color: tone, fontSize: 'calc(24px * var(--font-scale, 1))', fontWeight: 900, marginTop: 8, fontFamily: 'var(--font-display)' }}>
        {value}
      </div>
    </div>
  );
}

function LevelBadge({ level }) {
  const meta = level === 'delay'
    ? { text: '暂缓', color: '#ff6b6b', bg: 'rgba(255,107,107,0.14)' }
    : level === 'caution'
      ? { text: '谨慎', color: '#ffd36a', bg: 'rgba(255,211,106,0.14)' }
      : { text: '推荐', color: C.green, bg: 'rgba(99,232,191,0.14)' };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: 36,
        padding: '0 14px',
        borderRadius: 999,
        border: `1px solid ${meta.color}`,
        background: meta.bg,
        color: meta.color,
        fontSize: 'calc(14px * var(--font-scale, 1))',
        fontWeight: 900,
      }}
    >
      {meta.text}
    </span>
  );
}

function EmptyAssessment() {
  return (
    <GlowCard style={{ padding: 32, textAlign: 'center' }}>
      <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: 14, background: C.bgMuted, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.mars, fontWeight: 900 }}>
        DS
      </div>
      <div style={{ color: C.ice, fontSize: 'calc(18px * var(--font-scale, 1))', fontWeight: 850, fontFamily: 'var(--font-display)' }}>
        配置任务并运行深空探索评估
      </div>
      <div style={{ color: C.ice50, fontSize: 'calc(13px * var(--font-scale, 1))', lineHeight: 1.8, maxWidth: 680, margin: '10px auto 0' }}>
        系统会调用默认 PredRNNv2 预测模型，把臭氧场、误差指标和特征重要性转化为任务窗口、着陆与巡视风险建议。
      </div>
    </GlowCard>
  );
}

function AssessmentResults({ assessment, results, metrics, mode, activeStep, setActiveStep }) {
  const step = Math.min(activeStep, (results?.horizon || 1) - 1);
  const predField = results?.prediction?.[step] ?? null;
  const residField = results?.residual?.[step] ?? null;
  const stepLs = results?.ls_values?.[step];
  const metricValues = metrics?.overall || metrics || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <GlowCard style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) repeat(4, minmax(110px, 0.6fr))', gap: 14, alignItems: 'stretch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <LevelBadge level={assessment.level} />
              <div style={{ color: C.ice, fontSize: 'calc(18px * var(--font-scale, 1))', fontWeight: 900, fontFamily: 'var(--font-display)' }}>
                深空任务窗口判定
              </div>
            </div>
            <div style={{ color: C.ice60, fontSize: 'calc(12px * var(--font-scale, 1))', lineHeight: 1.7 }}>
              {assessment.narrative}
            </div>
          </div>
          <MetricTile label="RISK INDEX" value={assessment.score} tone={assessment.level === 'delay' ? '#ff6b6b' : assessment.level === 'caution' ? '#ffd36a' : C.green} />
          <MetricTile label="RMSE" value={metricValues?.rmse?.toFixed?.(2) ?? '--'} tone={C.mars} />
          <MetricTile label="SSIM" value={metricValues?.ssim?.toFixed?.(2) ?? '--'} tone={C.green} />
          <MetricTile label="R²" value={metricValues?.r2?.toFixed?.(2) ?? '--'} tone={C.green} />
        </div>
      </GlowCard>

      {results && results.horizon > 1 ? (
        <GlowCard style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: C.ice50, fontSize: 'calc(12px * var(--font-scale, 1))', fontWeight: 700 }}>预测步长</span>
            {Array.from({ length: results.horizon }, (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveStep(index)}
                style={{
                  padding: '9px 13px',
                  borderRadius: 999,
                  border: `1px solid ${activeStep === index ? C.blue : C.border}`,
                  background: activeStep === index ? 'rgba(121,187,255,0.12)' : C.bgMuted,
                  color: activeStep === index ? C.blue : C.ice60,
                  fontWeight: 750,
                  cursor: 'pointer',
                }}
              >
                第 {index + 1} 步{results.ls_values?.[index] != null ? ` · Ls=${results.ls_values[index].toFixed(3)}°` : ''}
              </button>
            ))}
          </div>
        </GlowCard>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18 }}>
        <GlowCard style={{ padding: 18 }}>
          <div style={{ color: C.mars, fontSize: 'calc(14px * var(--font-scale, 1))', fontWeight: 850, marginBottom: 12 }}>
            预测臭氧场{stepLs != null ? ` · Ls=${stepLs.toFixed(3)}°` : ''}
          </div>
          {predField ? <FieldCanvas fieldData={predField} colorMode="inferno" h={260} /> : <LoadingBox h={260} />}
        </GlowCard>
        <GlowCard style={{ padding: 18 }}>
          <div style={{ color: C.purple, fontSize: 'calc(14px * var(--font-scale, 1))', fontWeight: 850, marginBottom: 12 }}>
            不确定性 / 残差场
          </div>
          {residField ? <FieldCanvas fieldData={residField} colorMode="rdbu" h={260} /> : <LoadingBox h={260} />}
        </GlowCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <GlowCard style={{ padding: 20 }}>
          <div style={{ color: C.blue, fontSize: 'calc(15px * var(--font-scale, 1))', fontWeight: 900, marginBottom: 12 }}>
            {mode === 'landing' ? '着陆与巡视建议' : '任务窗口建议'}
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <MetricTile label="RECOMMENDED STEP" value={`第 ${assessment.recommendedStep} 步`} tone={C.blue} />
            <MetricTile label="RECOMMENDED REGION" value={assessment.recommendedRegions.join(' / ') || '--'} tone={C.green} />
            <MetricTile label="AVOID REGION" value={assessment.avoidRegions.join(' / ') || '无强制避让'} tone={assessment.avoidRegions.length ? '#ff6b6b' : C.ice60} />
          </div>
        </GlowCard>

        <GlowCard style={{ padding: 20 }}>
          <div style={{ color: C.mars, fontSize: 'calc(15px * var(--font-scale, 1))', fontWeight: 900, marginBottom: 12 }}>
            风险来源
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {assessment.riskDrivers.map((driver) => (
              <div key={`${driver.key}-${driver.label}`} style={{ padding: 12, borderRadius: 8, background: C.bgMuted, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: C.ice, fontWeight: 850 }}>{driver.label}</span>
                  <span style={{ color: C.mars, fontWeight: 850 }}>{driver.impact.toFixed?.(3) ?? driver.impact}</span>
                </div>
                <div style={{ color: C.ice50, fontSize: 'calc(11px * var(--font-scale, 1))', lineHeight: 1.65, marginTop: 5 }}>
                  {driver.description}
                </div>
              </div>
            ))}
          </div>
        </GlowCard>
      </div>

      <GlowCard style={{ padding: 20 }}>
        <div style={{ color: C.green, fontSize: 'calc(15px * var(--font-scale, 1))', fontWeight: 900, marginBottom: 10 }}>
          任务指导
        </div>
        <div style={{ color: C.ice70, fontSize: 'calc(13px * var(--font-scale, 1))', lineHeight: 1.8 }}>
          当前建议重点监测 {assessment.monitoringVariables.join('、')}。若执行窗口为“谨慎”或“暂缓”，建议调整 Ls 起点、缩短地表作业时长，或优先选择推荐区域进行后续仿真复核。
        </div>
      </GlowCard>
    </div>
  );
}

export default function DeepSpacePage() {
  const { settings } = useSettings();
  const isLight = settings.theme === 'light';
  const [mode, setMode] = useState('window');
  const [taskType, setTaskType] = useState('orbital-observation');
  const [landingDuration, setLandingDuration] = useState('short');
  const [marsYear, setMarsYear] = useState(27);
  const [lsStart, setLsStart] = useState(90);
  const [horizon, setHorizon] = useState(3);
  const [targetRegion, setTargetRegion] = useState('global');
  const [landingRegion, setLandingRegion] = useState('equatorial');
  const [riskPosture, setRiskPosture] = useState('standard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [pfi, setPfi] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [assessmentKey, setAssessmentKey] = useState(null);
  const [activeStep, setActiveStep] = useState(0);

  const activeRegion = mode === 'landing' ? landingRegion : targetRegion;
  const currentAssessmentKey = buildAssessmentConfigKey({
    mode,
    taskType: mode === 'landing' ? 'landing-rover' : taskType,
    targetRegion: activeRegion,
    riskPosture,
    marsYear,
    lsStart,
    horizon,
    landingDuration,
  });
  const activeAssessment = currentAssessmentKey === assessmentKey ? assessment : null;
  const modeItems = useMemo(() => [
    { id: 'window', label: '任务窗口评估' },
    { id: 'landing', label: '着陆与巡视风险' },
  ], []);


  const runAssessment = async () => {
    setLoading(true);
    setError(null);
    const body = {
      selected_variables: SELECTED_VARIABLES,
      horizon,
      ls_start: lsStart,
      mars_year: marsYear,
    };

    try {
      const [predictionResult, metricsResult] = await Promise.all([
        runPrediction(body, { dataSource: 'default' }),
        fetchPredictMetrics(body, { dataSource: 'default' }),
      ]);
      const [errorDistributionResult, pfiResult] = await Promise.all([
        fetchErrorDistribution(SELECTED_VARIABLES),
        fetchPermutationImportance(SELECTED_VARIABLES, { marsYear, lsStart, horizon }),
      ]);
      const nextAssessment = buildDeepSpaceAssessment({
        mode,
        taskType: mode === 'landing' ? 'landing-rover' : taskType,
        targetRegion: activeRegion,
        riskPosture,
        marsYear,
        lsStart,
        horizon,
        metrics: metricsResult,
        errorDistribution: errorDistributionResult,
        pfi: pfiResult,
        landingDuration,
      });

      setResults(predictionResult);
      setMetrics(metricsResult);
      setPfi(pfiResult);
      setAssessment(nextAssessment);
      setAssessmentKey(currentAssessmentKey);
      setActiveStep(0);
    } catch (err) {
      setError(err.message || '深空探索评估失败，请检查后端服务。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionTitle title="深空探索" subtitle="任务窗口评估与着陆巡视风险决策支持" />

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <GlowCard style={{ padding: 20 }}>
            <ControlBlock title="评估模式">
              <OptionChips items={modeItems} value={mode} onChange={setMode} columns="1fr" />
            </ControlBlock>
          </GlowCard>

          <GlowCard style={{ padding: 20 }}>
            <div style={{ color: C.mars, fontSize: 'calc(15px * var(--font-scale, 1))', fontWeight: 900, marginBottom: 16 }}>
              任务配置
            </div>
            <div style={{ display: 'grid', gap: 18 }}>
              {mode === 'window' ? (
                <ControlBlock title="任务类型">
                  <OptionChips items={TASK_TYPES} value={taskType} onChange={setTaskType} />
                </ControlBlock>
              ) : (
                <>
                  <ControlBlock title="候选着陆纬度带">
                    <OptionChips items={LANDING_REGIONS} value={landingRegion} onChange={setLandingRegion} />
                  </ControlBlock>
                  <ControlBlock title="巡视任务时长">
                    <OptionChips items={DURATIONS} value={landingDuration} onChange={setLandingDuration} columns="repeat(3, minmax(0, 1fr))" />
                  </ControlBlock>
                </>
              )}

              <ControlBlock title="火星年">
                <OptionChips
                  items={[{ id: 27, label: 'MY 27' }, { id: 28, label: 'MY 28' }]}
                  value={marsYear}
                  onChange={setMarsYear}
                />
              </ControlBlock>

              <ControlBlock title={`起始太阳黄经 ${lsStart}°`}>
                <input
                  type="range"
                  min="0"
                  max="355"
                  step="5"
                  value={lsStart}
                  onChange={(event) => setLsStart(Number(event.target.value))}
                  style={{ width: '100%', accentColor: C.mars }}
                />
              </ControlBlock>

              <ControlBlock title="预测步长">
                <OptionChips
                  items={[{ id: 1, label: '+1' }, { id: 2, label: '+2' }, { id: 3, label: '+3' }]}
                  value={horizon}
                  onChange={setHorizon}
                  columns="repeat(3, minmax(0, 1fr))"
                />
              </ControlBlock>

              {mode === 'window' ? (
                <ControlBlock title="目标区域">
                  <OptionChips items={WINDOW_REGIONS} value={targetRegion} onChange={setTargetRegion} />
                </ControlBlock>
              ) : null}

              <ControlBlock title="风险策略">
                <OptionChips items={POSTURES} value={riskPosture} onChange={setRiskPosture} columns="repeat(3, minmax(0, 1fr))" />
              </ControlBlock>

              <button
                type="button"
                onClick={runAssessment}
                disabled={loading}
                style={{
                  minHeight: 46,
                  borderRadius: 12,
                  border: 'none',
                  background: loading ? 'rgba(255,143,104,0.35)' : `linear-gradient(135deg, ${C.mars}, ${C.marsLight})`,
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: 'calc(13px * var(--font-scale, 1))',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 14px 28px rgba(255,143,104,0.22)',
                }}
              >
                {loading ? '评估中...' : '运行深空探索评估'}
              </button>

              {error ? (
                <div style={{ color: '#ff8a8a', background: 'rgba(255,107,107,0.10)', border: '1px solid rgba(255,107,107,0.22)', borderRadius: 10, padding: 12, fontSize: 'calc(12px * var(--font-scale, 1))', lineHeight: 1.6 }}>
                  {error}
                </div>
              ) : null}
            </div>
          </GlowCard>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {loading ? (
            <GlowCard style={{ padding: 28 }}>
              <LoadingBox h={280} />
            </GlowCard>
          ) : activeAssessment ? (
            <AssessmentResults
              assessment={activeAssessment}
              results={results}
              metrics={metrics}
              pfi={pfi}
              mode={mode}
              activeStep={activeStep}
              setActiveStep={setActiveStep}
            />
          ) : (
            <EmptyAssessment />
          )}

          <GlowCard style={{ padding: 18, borderColor: isLight ? C.border : undefined }}>
            <div style={{ color: C.ice60, fontSize: 'calc(12px * var(--font-scale, 1))', lineHeight: 1.75 }}>
              说明：本页提供科研展示和任务决策支持，不构成真实航天任务安全认证。评分来自当前预测场、全局指标与特征重要性的透明组合。
            </div>
          </GlowCard>
        </div>
      </div>
    </div>
  );
}
