import C from '../../constants/colors';
import { useT } from '../../i18n';
import GlowCard from '../../components/GlowCard';
import { fmtNum } from '../../utils/fmt';
import { useSettings } from '../../contexts/SettingsContext';

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
      <GlowCard style={{ padding: 20 }}>
        <SectionTitle
          title={t('predict.sidebar.predictionControl')}
          subtitle={isZh ? '选择预测步长并发起本次推演。' : 'Choose the prediction horizon and run the next inference.'}
          accent={C.mars}
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
          <ActionButton onClick={handlePredict} disabled={loading || isSwitchingSource}>
            {(loading || isSwitchingSource) ? (
              isSwitchingSource ? (isZh ? '切换数据源中…' : 'Switching data source...') : t('predict.runningBtn')
            ) : t('predict.runBtn')}
          </ActionButton>

          <ActionButton secondary onClick={() => onShapleyClick('gradient')}>
            {t('predict.shapleyBtn')}
          </ActionButton>
        </div>

        {error ? (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.18)', fontSize: 'calc(11px * var(--font-scale, 1))', color: '#ff7b7b', lineHeight: 1.6 }}>
            {error}
          </div>
        ) : null}
      </GlowCard>

      <GlowCard style={{ padding: 20 }}>
        <SectionTitle
          title={t('predict.sidebar.parameters')}
          subtitle={isZh ? '调整数据来源、火星年和起始黄经。' : 'Adjust the source, Mars year, and starting solar longitude.'}
          accent={C.mars}
        />

        <div style={{ display: 'grid', gap: 16 }}>
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
                disabled={isSwitchingSource}
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
          </div>

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

      <SelectionPerformance
        currentMetrics={currentMetrics}
        perfLoading={perfLoading}
        handleFetchPerformance={handleFetchPerformance}
        precision={precision}
        t={t}
        isZh={isZh}
      />

      <ModelHyperparams t={t} isZh={isZh} />

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
    </div>
  );
}
