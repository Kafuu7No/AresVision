import { useMemo, useState } from 'react';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import GlowCard from '../../components/GlowCard';
import { fmtNum } from '../../utils/fmt';
import { useSettings } from '../../contexts/SettingsContext';
import { buildTrainedModelParameterItems } from './trainedModelSelection';
import { buildCompareModelSummary, getCompareSelectionState } from './CompareTrainingModels/compareTrainingModelsData';

const SHORTHAND_MAP = {
  Temperature: 'T',
  Dust_Optical_Depth: 'D',
  Surface_Pressure: 'P',
  Solar_Flux_DN: 'S',
  U_Wind: 'U',
  V_Wind: 'V',
};

function SectionTitle({ title, subtitle, accent = C.ice }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ color: accent, fontSize: 'calc(14px * var(--font-scale, 1))', fontWeight: 700, fontFamily: 'var(--font-display)' }}>
        {title}
      </div>
      {subtitle ? (
        <div style={{ color: C.ice50, fontSize: 'calc(11px * var(--font-scale, 1))', lineHeight: 1.55, marginTop: 4 }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

function OptionChips({ items, activeValue, onChange, disabled = false }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {items.map((item) => {
        const active = activeValue === item.value;
        return (
          <button
            key={item.value}
            onClick={() => !disabled && onChange(item.value)}
            disabled={disabled}
            style={{
              padding: '9px 14px',
              borderRadius: 999,
              border: `1px solid ${active ? item.borderColor || C.mars : C.border}`,
              background: active ? (item.background || 'rgba(199,91,57,0.12)') : C.bgMuted,
              color: active ? (item.color || C.mars) : C.ice60,
              fontSize: 'calc(12px * var(--font-scale, 1))',
              fontWeight: active ? 700 : 600,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.72 : 1,
              transition: 'all 0.36s ease',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function ToggleSwitch({ checked, onChange, disabled = false, personalDisabled = false, isLight = false }) {
  const { settings } = useSettings();
  const isZh = settings?.language !== 'en';
  const options = [
    { value: 'default', label: isZh ? '\u9ed8\u8ba4' : 'Default', active: !checked },
    { value: 'personal', label: isZh ? '\u4e2a\u4eba' : 'Personal', active: checked },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        padding: 5,
        width: '100%',
        minWidth: 0,
        borderRadius: 16,
        background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${C.border}`,
        boxSizing: 'border-box',
      }}
    >
      {options.map((option) => {
        const optionDisabled = disabled || (personalDisabled && option.value === 'personal');
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              if (!optionDisabled && !option.active) {
                onChange(option.value === 'personal');
              }
            }}
            disabled={optionDisabled}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: 'none',
              background: option.active ? 'rgba(74,158,255,0.14)' : 'transparent',
              color: option.active ? C.blue : C.ice60,
              fontSize: 'calc(12px * var(--font-scale, 1))',
              fontWeight: option.active ? 700 : 600,
              cursor: optionDisabled ? 'not-allowed' : 'pointer',
              opacity: optionDisabled ? 0.5 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ActionButton({ children, secondary = false, disabled = false, onClick, accent = C.mars }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '12px 14px',
        borderRadius: 12,
        border: secondary ? `1px solid ${C.borderStrong}` : 'none',
        background: secondary
          ? C.bgMuted
          : disabled
            ? 'rgba(199,91,57,0.30)'
            : `linear-gradient(135deg, ${accent}, ${C.marsLight})`,
        color: secondary ? C.ice : '#fff',
        fontSize: 'calc(13px * var(--font-scale, 1))',
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: secondary || disabled ? 'none' : '0 10px 24px rgba(199,91,57,0.24)',
        transition: 'all 0.2s ease',
      }}
    >
      {children}
    </button>
  );
}

function ModelSourceControl({
  modelMode,
  setModelMode,
  trainingModelOptions,
  selectedTrainingTaskId,
  setSelectedTrainingTaskId,
  selectedCompareTrainingTaskIds,
  setSelectedCompareTrainingTaskIds,
  trainingTasksLoading,
  selectedTrainingOption,
  isLight,
  isZh,
}) {
  const hasTrainingModels = trainingModelOptions.length > 0;
  const parameterItems = buildTrainedModelParameterItems(selectedTrainingOption?.task, { isZh });
  const [searchTerm, setSearchTerm] = useState('');
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredCompareOptions = useMemo(() => (
    trainingModelOptions.filter((option) => {
      if (!normalizedSearch) return true;
      const summary = buildCompareModelSummary(option.task);
      return [
        option.label,
        String(option.id),
        summary.architecture,
        summary.inputChannelText,
        summary.dataSource,
      ].join(' ').toLowerCase().includes(normalizedSearch);
    })
  ), [normalizedSearch, trainingModelOptions]);
  const compareSelection = getCompareSelectionState(selectedCompareTrainingTaskIds);
  const modeItems = [
    {
      value: 'system',
      label: isZh ? '系统模型' : 'System',
      borderColor: C.mars,
      background: 'rgba(199,91,57,0.12)',
      color: C.mars,
    },
    {
      value: 'trained',
      label: isZh ? '单训练模型分析' : 'Single trained model',
      borderColor: C.blue,
      background: 'rgba(74,158,255,0.12)',
      color: C.blue,
    },
    {
      value: 'trained_compare',
      label: isZh ? '多训练模型对比' : 'Compare trained models',
      borderColor: C.green,
      background: 'rgba(74,207,172,0.12)',
      color: C.green,
    },
  ];

  return (
    <GlowCard style={{ padding: 20 }}>
      <SectionTitle
        title={isZh ? '模型来源' : 'Model source'}
        subtitle={
          modelMode === 'trained_compare'
            ? (isZh ? '选择多个已完成训练任务，比较完整测试集表现。' : 'Compare completed training tasks across the full test set.')
            : modelMode === 'trained'
            ? (isZh ? '使用训练页面已完成任务的模型权重进行预测。' : 'Use weights produced by a completed training task.')
            : (isZh ? '使用平台默认预测模型和完整诊断分析。' : 'Use the default platform model with full diagnostics.')
        }
        accent={modelMode === 'trained_compare' ? C.green : modelMode === 'trained' ? C.blue : C.mars}
      />

      <OptionChips items={modeItems} activeValue={modelMode} onChange={setModelMode} />

      {modelMode === 'trained' ? (
        <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
          <select
            value={selectedTrainingTaskId || ''}
            disabled={trainingTasksLoading || !hasTrainingModels}
            onChange={(event) => setSelectedTrainingTaskId(Number(event.target.value) || null)}
            style={{
              width: '100%',
              minWidth: 0,
              padding: '11px 12px',
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: isLight ? 'rgba(255,255,255,0.92)' : C.bgMuted,
              color: hasTrainingModels ? C.ice : C.ice50,
              fontSize: 'calc(12px * var(--font-scale, 1))',
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              outline: 'none',
            }}
          >
            <option value="">
              {trainingTasksLoading
                ? (isZh ? '正在加载训练模型...' : 'Loading trained models...')
                : (isZh ? '选择已完成训练模型' : 'Select a completed model')}
            </option>
            {trainingModelOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label} · #{option.id}
              </option>
            ))}
          </select>

          <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice50, lineHeight: 1.55 }}>
            {hasTrainingModels
              ? `${isZh ? '当前模型' : 'Current model'}: ${selectedTrainingOption?.label || '--'}`
              : (isZh ? '暂无可用于预测分析的已完成训练模型。' : 'No completed trained model is available for prediction analysis.')}
          </div>

          {parameterItems.length > 0 ? (
            <div
              style={{
                marginTop: 6,
                padding: 12,
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                background: isLight ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.03)',
              }}
            >
              <div style={{ color: C.ice, fontSize: 'calc(12px * var(--font-scale, 1))', fontWeight: 700, marginBottom: 10 }}>
                {isZh ? '所选模型参数' : 'Selected model parameters'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {parameterItems.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      minWidth: 0,
                      padding: '9px 10px',
                      borderRadius: 10,
                      background: C.bgMuted,
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    <div style={{ color: C.ice40, fontSize: 'calc(9px * var(--font-scale, 1))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {item.label}
                    </div>
                    <div
                      title={item.value}
                      style={{
                        color: C.ice,
                        fontSize: 'calc(11px * var(--font-scale, 1))',
                        fontWeight: 700,
                        lineHeight: 1.45,
                        marginTop: 5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {modelMode === 'trained_compare' ? (
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={isZh ? '搜索模型名 / 架构 / 通道' : 'Search name, architecture, channels'}
            disabled={trainingTasksLoading || !hasTrainingModels}
            style={{
              width: '100%',
              minWidth: 0,
              padding: '11px 12px',
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: isLight ? 'rgba(255,255,255,0.92)' : C.bgMuted,
              color: C.ice,
              fontSize: 'calc(12px * var(--font-scale, 1))',
              fontWeight: 600,
              fontFamily: 'var(--font-body)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={!hasTrainingModels}
              onClick={() => setSelectedCompareTrainingTaskIds(filteredCompareOptions.map((option) => option.id))}
              style={{
                padding: '7px 11px',
                borderRadius: 999,
                border: `1px solid rgba(74,207,172,0.30)`,
                background: 'rgba(74,207,172,0.10)',
                color: hasTrainingModels ? C.green : C.ice40,
                fontSize: 'calc(11px * var(--font-scale, 1))',
                fontWeight: 700,
                cursor: hasTrainingModels ? 'pointer' : 'not-allowed',
              }}
            >
              {isZh ? '全选' : 'All'}
            </button>
            <button
              type="button"
              disabled={compareSelection.count === 0}
              onClick={() => setSelectedCompareTrainingTaskIds([])}
              style={{
                padding: '7px 11px',
                borderRadius: 999,
                border: `1px solid ${C.borderStrong}`,
                background: C.bgMuted,
                color: compareSelection.count > 0 ? C.ice60 : C.ice30,
                fontSize: 'calc(11px * var(--font-scale, 1))',
                fontWeight: 700,
                cursor: compareSelection.count > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              {isZh ? '清空' : 'Clear'}
            </button>
            <span style={{ marginLeft: 'auto', color: compareSelection.canCompare ? C.green : C.ice50, fontSize: 'calc(10px * var(--font-scale, 1))', fontWeight: 700 }}>
              {isZh ? `已选 ${compareSelection.count}` : `${compareSelection.count} selected`}
            </span>
          </div>

          <div style={{ maxHeight: 280, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4, display: 'grid', gap: 8 }}>
            {filteredCompareOptions.map((option) => {
              const active = selectedCompareTrainingTaskIds.includes(option.id);
              const summary = buildCompareModelSummary(option.task);
              return (
                <label
                  key={option.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: 10,
                    padding: '10px 11px',
                    borderRadius: 12,
                    border: `1px solid ${active ? 'rgba(74,207,172,0.36)' : C.border}`,
                    background: active ? 'rgba(74,207,172,0.08)' : C.bgMuted,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => {
                      setSelectedCompareTrainingTaskIds((prev) => (
                        prev.includes(option.id)
                          ? prev.filter((id) => id !== option.id)
                          : [...prev, option.id]
                      ));
                    }}
                    style={{ accentColor: C.green, marginTop: 2 }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', color: C.ice, fontSize: 'calc(12px * var(--font-scale, 1))', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {summary.modelName}
                    </span>
                    <span style={{ display: 'block', color: C.ice50, fontSize: 'calc(10px * var(--font-scale, 1))', lineHeight: 1.55, marginTop: 3 }}>
                      #{summary.taskId} · {summary.architecture} · {summary.inputChannelText}
                    </span>
                    <span style={{ display: 'block', color: C.ice40, fontSize: 'calc(10px * var(--font-scale, 1))', lineHeight: 1.55 }}>
                      {summary.modelSource} · W{summary.window || '--'} · H{summary.horizon || '--'} · {summary.dataSource}
                    </span>
                  </span>
                </label>
              );
            })}

            {!trainingTasksLoading && filteredCompareOptions.length === 0 ? (
              <div style={{ padding: 16, borderRadius: 12, background: C.bgMuted, border: `1px dashed ${C.borderStrong}`, color: C.ice50, fontSize: 'calc(11px * var(--font-scale, 1))', lineHeight: 1.6, textAlign: 'center' }}>
                {hasTrainingModels
                  ? (isZh ? '没有匹配的训练模型。' : 'No matching trained models.')
                  : (isZh ? '暂无可对比的已完成训练模型。' : 'No completed trained models are available.')}
              </div>
            ) : null}
          </div>

          <div style={{ color: compareSelection.canCompare ? C.ice50 : C.mars, fontSize: 'calc(10px * var(--font-scale, 1))', lineHeight: 1.55 }}>
            {compareSelection.canCompare
              ? (isZh ? '点击“开始对比”后将基于完整测试集计算指标。' : 'Start comparison to compute full test-set metrics.')
              : (isZh ? '至少选择 2 个模型才允许开始对比。' : 'Select at least 2 models to start comparison.')}
          </div>
        </div>
      ) : null}
    </GlowCard>
  );
}

function SelectionPerformance({ currentMetrics, perfLoading, handleFetchPerformance, precision, t, isZh }) {
  const metrics = [
    { label: t('predict.globalR2'), val: currentMetrics?.global_r2, color: C.green },
    { label: t('predict.globalRMSE'), val: currentMetrics?.global_rmse, color: C.mars },
    { label: t('predict.globalMAE'), val: currentMetrics?.global_mae, color: C.mars },
    { label: t('predict.globalSSIM'), val: currentMetrics?.global_ssim, color: C.green },
  ];

  return (
    <GlowCard style={{ padding: 20 }}>
      <SectionTitle
        title={t('predict.selectionPerfTitle')}
        subtitle={isZh ? '当前变量组合对应的全局评估结果。' : 'Global metrics for the current variable selection.'}
      />

      {perfLoading ? (
        <div style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 14, height: 14, border: `2px solid ${C.border}`, borderTop: `2px solid ${C.green}`, borderRadius: '50%', animation: 'spin-slow 0.8s linear infinite' }} />
          <span style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice50 }}>{isZh ? '正在计算…' : 'Computing...'}</span>
        </div>
      ) : currentMetrics ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {metrics.map((m) => (
            <div key={m.label} style={{ padding: 12, background: `${m.color}10`, borderRadius: 12, border: `1px solid ${m.color}33` }}>
              <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice40, fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: 'calc(18px * var(--font-scale, 1))', color: m.color, fontWeight: 800, fontFamily: 'var(--font-display)', marginTop: 6 }}>
                {fmtNum(m.val || 0, precision)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice50, lineHeight: 1.6 }}>
            {t('predict.perfEmptyHintSidebar')}
          </div>
          <ActionButton secondary onClick={handleFetchPerformance}>
            {t('predict.generateBtn')}
          </ActionButton>
        </div>
      )}
    </GlowCard>
  );
}

function ModelHyperparams({ t, isZh }) {
  const params = [
    { label: 'Epochs', val: '30', color: C.mars },
    { label: 'Layers', val: '3 (ST-LSTM)', color: C.blue },
    { label: 'Hidden', val: '[64, 64, 64]', color: C.blue },
    { label: 'Filter', val: '3 x 3', color: C.green },
    { label: 'Window', val: '3', color: C.purple },
    { label: 'Horizon', val: '3', color: C.purple },
    { label: 'LR', val: '0.001', color: '#d9a441' },
    { label: 'Batch', val: '32', color: C.ice60 },
  ];

  return (
    <GlowCard style={{ padding: 20 }}>
      <SectionTitle
        title={t('predict.hyperTitle')}
        subtitle={isZh ? '当前预测流程使用的模型配置。' : 'Model configuration used for the current prediction flow.'}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {params.map((p) => (
          <div key={p.label} style={{ padding: '10px 12px', background: C.bgMuted, borderRadius: 12, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 'calc(9px * var(--font-scale, 1))', color: C.ice40, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {p.label}
            </div>
            <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: p.color, fontWeight: 700, marginTop: 5 }}>
              {p.val}
            </div>
          </div>
        ))}
      </div>
    </GlowCard>
  );
}

export default function PredictSidebar({
  isLight,
  loading,
  isSwitchingSource,
  error,
  modelMode,
  setModelMode,
  trainingModelOptions = [],
  selectedTrainingTaskId,
  setSelectedTrainingTaskId,
  selectedCompareTrainingTaskIds = [],
  setSelectedCompareTrainingTaskIds,
  trainingTasksLoading = false,
  selectedTrainingOption,
  analysisVisibility = {},
  dataSourceMode,
  setDataSourceMode,
  sourceMeta,
  personalSourceDisabled = false,
  personalSourceHint = '',
  marsYear,
  setMarsYear,
  availableMarsYears,
  lsStart,
  setLsStart,
  predStep,
  setPredStep,
  selectedVars,
  toggleVar,
  VARIABLES,
  handlePredict,
  compareConfigs,
  selectedCompareIds,
  setSelectedCompareIds,
  setCompareConfigs,
  onShapleyClick,
  currentMetrics,
  perfLoading,
  handleFetchPerformance,
  precision,
}) {
  const t = useT();
  const { settings } = useSettings();
  const isZh = settings?.language !== 'en';
  const isPersonalMode = dataSourceMode === 'personal';
  const canShowShapley = analysisVisibility.shapley !== false;
  const canShowInputVariables = analysisVisibility.inputVariables !== false;
  const canShowPerformanceComparison = analysisVisibility.performanceComparison !== false;
  const canShowSelectionPerformance = analysisVisibility.selectionPerformance !== false;
  const canShowSystemHyperparams = analysisVisibility.systemHyperparams !== false;
  const canShowDataSourceControl = analysisVisibility.dataSourceControl !== false;
  const isTrainedMode = modelMode === 'trained';
  const isCompareMode = modelMode === 'trained_compare';
  const compareSelection = getCompareSelectionState(selectedCompareTrainingTaskIds);

  const years = Array.isArray(availableMarsYears) && availableMarsYears.length > 0
    ? availableMarsYears
    : [27, 28];

  const sourceMessage = sourceMeta?.message || (
    sourceMeta?.effective_source === 'personal_mcd_plus_system_openmars'
      ? (isZh ? '个人 OpenMARS 数据不完整，系统已自动补充 OpenMARS 与个人 MCD。' : 'Personal OpenMARS is incomplete. The system is using system OpenMARS with personal MCD.')
      : ''
  );

  const handleSeed32 = () => {
    const vars = ['Temperature', 'Dust_Optical_Depth', 'Solar_Flux_DN', 'U_Wind', 'V_Wind'];
    const combinations = [];
    for (let i = 0; i < (1 << vars.length); i += 1) {
      const combo = [];
      for (let j = 0; j < vars.length; j += 1) {
        if ((i >> j) & 1) combo.push(vars[j]);
      }
      combinations.push(combo);
    }
    const newConfigs = combinations.map((combo, idx) => {
      const shorthand = combo.map((v) => SHORTHAND_MAP[v] || v[0]).sort().join('') || 'Baseline';
      return { id: `seed_${idx}`, label: shorthand, vars: combo };
    });
    setCompareConfigs(newConfigs);
    setSelectedCompareIds(newConfigs.map((c) => c.id));
  };

  const handleSelectAll = () => {
    if (selectedCompareIds.length === compareConfigs.length && compareConfigs.length > 0) {
      setSelectedCompareIds([]);
    } else {
      setSelectedCompareIds(compareConfigs.map((c) => c.id));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ModelSourceControl
        modelMode={modelMode}
        setModelMode={setModelMode}
        trainingModelOptions={trainingModelOptions}
        selectedTrainingTaskId={selectedTrainingTaskId}
        setSelectedTrainingTaskId={setSelectedTrainingTaskId}
        selectedCompareTrainingTaskIds={selectedCompareTrainingTaskIds}
        setSelectedCompareTrainingTaskIds={setSelectedCompareTrainingTaskIds}
        trainingTasksLoading={trainingTasksLoading}
        selectedTrainingOption={selectedTrainingOption}
        isLight={isLight}
        isZh={isZh}
      />

      <GlowCard style={{ padding: 20 }}>
        <SectionTitle
          title={t('predict.sidebar.predictionControl')}
          subtitle={isCompareMode
            ? (isZh ? '选择对比使用的测试集预测步长。' : 'Choose the test-set horizon used for comparison.')
            : (isZh ? '选择预测步长并发起本次推演。' : 'Choose the prediction horizon and run the next inference.')}
          accent={isCompareMode ? C.green : C.mars}
        />

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice50, marginBottom: 8 }}>
            {t('predict.horizon')}
          </div>
          <OptionChips
            items={[1, 2, 3].map((s) => ({
              value: s,
              label: `+${s}`,
              color: C.mars,
            }))}
            activeValue={predStep}
            onChange={setPredStep}
          />
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <ActionButton
            onClick={handlePredict}
            disabled={loading || isSwitchingSource || (isCompareMode && !compareSelection.canCompare)}
            accent={isCompareMode ? C.green : C.mars}
          >
            {(loading || isSwitchingSource) ? (
              isSwitchingSource ? (isZh ? '切换数据源中…' : 'Switching data source...') : t('predict.runningBtn')
            ) : isCompareMode ? (isZh ? '开始对比' : 'Start comparison') : t('predict.runBtn')}
          </ActionButton>

          {canShowShapley ? (
            <ActionButton secondary onClick={() => onShapleyClick('gradient')}>
              {t('predict.shapleyBtn')}
            </ActionButton>
          ) : null}
        </div>

        {error ? (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.18)', fontSize: 'calc(11px * var(--font-scale, 1))', color: '#ff7b7b', lineHeight: 1.6 }}>
            {error}
          </div>
        ) : null}
      </GlowCard>

      {!isCompareMode ? (
      <GlowCard style={{ padding: 20 }}>
        <SectionTitle
          title={t('predict.sidebar.parameters')}
          subtitle={isZh ? '调整数据来源、火星年和起始黄经。' : 'Adjust the source, Mars year, and starting solar longitude.'}
          accent={C.mars}
        />

        <div style={{ display: 'grid', gap: 16 }}>
          {canShowDataSourceControl ? (
            <div style={{ padding: '12px 14px', borderRadius: 14, border: `1px solid ${C.border}`, background: C.bgMuted }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <div>
                <div style={{ color: C.ice, fontSize: 'calc(12px * var(--font-scale, 1))', fontWeight: 600 }}>
                  {isZh ? '数据源' : 'Data source'}
                </div>
                <div style={{ color: isPersonalMode ? C.blue : C.ice50, fontSize: 'calc(11px * var(--font-scale, 1))', marginTop: 3 }}>
                  {isPersonalMode ? (isZh ? '当前使用个人数据' : 'Currently using personal data') : (isZh ? '当前使用系统默认数据' : 'Currently using the default system data')}
                </div>
              </div>
              <ToggleSwitch
                checked={isPersonalMode}
                disabled={isSwitchingSource || isTrainedMode}
                personalDisabled={personalSourceDisabled}
                isLight={isLight}
                onChange={() => setDataSourceMode(isPersonalMode ? 'default' : 'personal')}
              />
            </div>

            {personalSourceDisabled ? (
              <div style={{ marginTop: 8, fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice40, lineHeight: 1.5 }}>
                {personalSourceHint}
              </div>
            ) : null}

            {isSwitchingSource ? (
              <div style={{ marginTop: 8, fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice50, lineHeight: 1.5 }}>
                {isZh ? '正在切换数据源，请稍候…' : 'Switching data source, please wait...'}
              </div>
            ) : null}

            {sourceMessage ? (
              <div style={{ marginTop: 8, fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice50, lineHeight: 1.55 }}>
                {sourceMessage}
              </div>
            ) : null}
            {isTrainedMode ? (
              <div style={{ marginTop: 8, fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice50, lineHeight: 1.55 }}>
                {isZh ? '训练模型使用任务记录里的数据来源。' : 'Trained models use the data source recorded by the training task.'}
              </div>
            ) : null}
            </div>
          ) : null}

          <div>
            <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice50, marginBottom: 8 }}>
              {t('predict.marsYear')}
            </div>
            <OptionChips
              disabled={isSwitchingSource}
              items={years.map((year) => ({
                value: year,
                label: `MY ${year}`,
                color: C.mars,
              }))}
              activeValue={marsYear}
              onChange={setMarsYear}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice50 }}>{t('predict.startLs')}</span>
              <span style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                {lsStart}°
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={355}
              step={1}
              value={lsStart}
              onChange={(e) => setLsStart(Number(e.target.value))}
              style={{ width: '100%', accentColor: C.mars }}
            />
          </div>
        </div>
      </GlowCard>
      ) : null}

      {canShowInputVariables ? (
        <GlowCard style={{ padding: 20 }}>
        <SectionTitle
          title={t('predict.sidebar.inputVariables')}
          subtitle={isZh ? '选择参与预测的输入变量。' : 'Choose the input variables used in the model.'}
          accent={C.blue}
        />

        <div style={{ display: 'grid', gap: 8 }}>
          {VARIABLES.map((v) => {
            const active = selectedVars.includes(v.id);
            return (
              <label
                key={v.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: active ? `${v.color}12` : C.bgMuted,
                  border: `1px solid ${active ? `${v.color}33` : C.border}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleVar(v.id)}
                  style={{ accentColor: v.color }}
                />
                <span style={{ flex: 1, fontSize: 'calc(12px * var(--font-scale, 1))', color: active ? C.ice : C.ice60 }}>
                  {v.label}
                </span>
              </label>
            );
          })}
        </div>
        </GlowCard>
      ) : null}

      {canShowSelectionPerformance ? (
        <SelectionPerformance
          currentMetrics={currentMetrics}
          perfLoading={perfLoading}
          handleFetchPerformance={handleFetchPerformance}
          precision={precision}
          t={t}
          isZh={isZh}
        />
      ) : null}

      {canShowSystemHyperparams ? <ModelHyperparams t={t} isZh={isZh} /> : null}

      {canShowPerformanceComparison ? (
        <GlowCard style={{ padding: 20 }}>
        <SectionTitle
          title={t('predict.matrix.title')}
          subtitle={isZh ? '管理用于性能比较的变量组合。' : 'Manage the variable combinations used for performance comparison.'}
          accent={C.green}
        />

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button
            onClick={handleSelectAll}
            style={{ padding: '7px 12px', background: 'rgba(74,207,172,0.12)', border: `1px solid rgba(74,207,172,0.30)`, borderRadius: 999, color: C.green, fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 700, cursor: 'pointer' }}
          >
            {t('predict.matrix.selectAll')}
          </button>
          <button
            onClick={handleSeed32}
            style={{ padding: '7px 12px', background: 'rgba(156,123,234,0.12)', border: `1px solid rgba(156,123,234,0.30)`, borderRadius: 999, color: C.purple, fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 700, cursor: 'pointer' }}
          >
            {t('predict.matrix.seed32')}
          </button>
        </div>

        <div style={{ maxHeight: 280, overflowY: 'auto', overflowX: 'hidden', marginBottom: 12, paddingRight: 4, background: C.bgMuted, borderRadius: 12, border: `1px solid ${C.border}` }}>
          {compareConfigs.map((c) => {
            const active = selectedCompareIds.includes(c.id);
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  borderBottom: `1px solid ${C.border}`,
                  background: active ? 'rgba(74,207,172,0.08)' : 'transparent',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => {
                      setSelectedCompareIds((prev) => (
                        prev.includes(c.id) ? prev.filter((x) => x !== c.id) : [...prev, c.id]
                      ));
                    }}
                    style={{ accentColor: C.green }}
                  />
                  <span style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: active ? C.ice : C.ice60 }}>
                    {c.label}
                  </span>
                </label>

                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCompareConfigs((prev) => prev.filter((pc) => pc.id !== c.id));
                    setSelectedCompareIds((prev) => prev.filter((pid) => pid !== c.id));
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: C.ice40,
                    fontSize: 'calc(16px * var(--font-scale, 1))',
                    cursor: 'pointer',
                    padding: '4px 6px',
                  }}
                >
                  ×
                </button>
              </div>
            );
          })}

          {compareConfigs.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice50, lineHeight: 1.6 }}>
              {t('predict.matrix.emptyHint')}
            </div>
          ) : null}
        </div>

        <button
          onClick={() => {
            const sortedVars = [...selectedVars].sort();
            const exists = compareConfigs.find((c) => {
              const cVars = [...c.vars].sort();
              return cVars.length === sortedVars.length && cVars.every((v, i) => v === sortedVars[i]);
            });
            if (exists) {
              if (!selectedCompareIds.includes(exists.id)) setSelectedCompareIds((prev) => [...prev, exists.id]);
              return;
            }
            const newId = `custom_${Date.now()}`;
            const prefix = selectedVars.length === 0 ? 'Baseline' : selectedVars.map((v) => SHORTHAND_MAP[v] || v[0]).sort().join('');
            setCompareConfigs((prev) => [...prev, { id: newId, label: prefix, vars: [...selectedVars] }]);
            setSelectedCompareIds((prev) => [...prev, newId]);
          }}
          style={{ width: '100%', padding: '11px 0', background: C.bgMuted, border: `1px dashed ${C.borderStrong}`, borderRadius: 12, color: C.ice60, fontSize: 'calc(12px * var(--font-scale, 1))', fontWeight: 600, cursor: 'pointer' }}
        >
          {t('predict.matrix.addBtn')}
        </button>
        </GlowCard>
      ) : null}
    </div>
  );
}
