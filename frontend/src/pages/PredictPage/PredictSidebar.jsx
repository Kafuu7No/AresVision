import C from '../../constants/colors';
import { useT } from '../../i18n';
import GlowCard from '../../components/GlowCard';
import { fmtNum } from '../../utils/fmt';


const SHORTHAND_MAP = {
  "Temperature": "T",
  "Dust_Optical_Depth": "D",
  "Surface_Pressure": "P",
  "Solar_Flux_DN": "S",
  "U_Wind": "U",
  "V_Wind": "V"
};

function SelectionPerformance({ isLight, currentMetrics, perfLoading, handleFetchPerformance, precision, t }) {
  const metrics = [
    { label: t('predict.globalR2'), val: currentMetrics?.global_r2, color: '#4acfac' },
    { label: t('predict.globalRMSE'), val: currentMetrics?.global_rmse, color: C.mars },
    { label: t('predict.globalMAE'), val: currentMetrics?.global_mae, color: C.mars },
    { label: t('predict.globalSSIM'), val: currentMetrics?.global_ssim, color: '#4acfac' },
  ];

  return (
    <GlowCard style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.ice, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>
          {t('predict.selectionPerfTitle', 'SELECTION PERFORMANCE')}
        </div>
        {!currentMetrics && !perfLoading && (
          <button
            onClick={handleFetchPerformance}
            style={{
              padding: '4px 8px', background: 'rgba(74,158,255,0.1)', border: `1px solid ${C.blue}`,
              borderRadius: 6, color: C.blue, fontSize: 9, cursor: 'pointer', fontFamily: "'Orbitron', sans-serif"
            }}
          >
            {t('predict.generateBtn', 'GENERATE')}
          </button>
        )}
      </div>

      {perfLoading ? (
        <div style={{ padding: '10px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 12, height: 12, border: '2px solid rgba(74,207,172,0.2)', borderTop: '2px solid #4acfac', borderRadius: '50%', animation: 'spin-slow 0.8s linear infinite' }} />
          <span style={{ fontSize: 10, color: C.ice30 }}>{t('predict.generatingBtn', 'Computing...')}</span>
        </div>
      ) : currentMetrics ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {metrics.map((m, idx) => (
            <div key={idx} style={{
              padding: '10px', background: `${m.color}10`, borderRadius: 8,
              border: `1px solid ${m.color}30`, display: 'flex', flexDirection: 'column', gap: 2
            }}>
              <span style={{ fontSize: 9, color: C.ice30, fontWeight: 600 }}>{m.label}</span>
              <span style={{ fontSize: 14, color: m.color, fontWeight: 800, fontFamily: "'Orbitron', sans-serif" }}>
                {fmtNum(m.val || 0, precision)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: C.ice30, fontStyle: 'italic', opacity: 0.6 }}>
          {t('predict.perfEmptyHintSidebar', 'No global metrics for current selection. Click generate.')}
        </div>
      )}
    </GlowCard>
  );
}

function ModelHyperparams({ t }) {
  const params = [
    { label: 'EPOCHS', val: '30', color: C.mars },
    { label: 'LAYERS', val: '3 (ST-LSTM)', color: C.blue },
    { label: 'HIDDEN', val: '[64, 64, 64]', color: C.blue },
    { label: 'FILTER', val: '3 × 3', color: '#4acfac' },
    { label: 'WINDOW', val: '3', color: '#9c7bea' },
    { label: 'HORIZON', val: '3', color: '#9c7bea' },
    { label: 'LR', val: '0.001', color: '#ffd740' },
    { label: 'BATCH', val: '32', color: C.ice60 },
  ];

  return (
    <GlowCard style={{ padding: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.ice, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
        {t('predict.hyperTitle', 'MODEL HYPERPARAMETERS')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {params.map((p, idx) => (
          <div key={idx} style={{
            padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8,
            border: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 2,
            transition: 'all 0.3s'
          }}>
            <span style={{ fontSize: 8, color: C.ice30, fontWeight: 600, letterSpacing: 0.5 }}>{p.label}</span>
            <span style={{ fontSize: 11, color: p.color, fontWeight: 800, fontFamily: "'Orbitron', sans-serif" }}>
              {p.val}
            </span>
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
  precision
}) {

  const t = useT();
  const isPersonalMode = dataSourceMode === 'personal';
  const years = Array.isArray(availableMarsYears) && availableMarsYears.length > 0
    ? availableMarsYears
    : [27, 28];
  const sourceMessage = sourceMeta?.message
    || (
      sourceMeta?.effective_source === 'personal_mcd_plus_system_openmars'
        ? '个人 OpenMARS 不完整，自动使用系统 OpenMARS + 个人 MCD。'
        : ''
    );

  const handleSeed32 = () => {
    // Generate all 32 combinations based on 5 core variables
    const vars = ["Temperature", "Dust_Optical_Depth", "Solar_Flux_DN", "U_Wind", "V_Wind"];
    const combinations = [];
    for (let i = 0; i < (1 << vars.length); i++) {
      const combo = [];
      for (let j = 0; j < vars.length; j++) {
        if ((i >> j) & 1) combo.push(vars[j]);
      }
      combinations.push(combo);
    }
    const newConfigs = combinations.map((combo, idx) => {
      const shorthand = combo.map(v => SHORTHAND_MAP[v] || v[0]).sort().join('') || 'Baseline';
      // Use stable IDs for selection state
      return { id: `seed_${idx}`, label: shorthand, vars: combo };
    });
    setCompareConfigs(newConfigs);
    setSelectedCompareIds(newConfigs.map(c => c.id));
  };

  const handleSelectAll = () => {
    // 这里使用函数式更新，确保拿到最实时的数据
    if (selectedCompareIds.length === compareConfigs.length && compareConfigs.length > 0) {
      setSelectedCompareIds([]);
    } else {
      setSelectedCompareIds(compareConfigs.map(c => c.id));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 预测控制 */}
      <GlowCard style={{ padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
          {t('predict.sidebar.predictionControl')}
        </div>
        <div style={{ fontSize: 11, color: C.ice30, marginBottom: 10 }}>{t('predict.horizon')}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[1, 2, 3].map((s) => (
            <button key={s} onClick={() => setPredStep(s)} style={{
              flex: 1, padding: '10px 0',
              background: predStep === s ? (isLight ? 'rgba(199,91,57,0.15)' : 'rgba(199,91,57,0.2)') : (isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'),
              border: `1px solid ${predStep === s ? C.mars : C.border}`,
              borderRadius: 8, color: predStep === s ? C.mars : C.ice60,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Orbitron', sans-serif",
            }}>+{s}</button>
          ))}
        </div>
        <button
          onClick={handlePredict}
          disabled={loading || isSwitchingSource}
          style={{
            width: '100%', padding: '14px 0',
            background: (loading || isSwitchingSource)
              ? 'rgba(199,91,57,0.3)'
              : `linear-gradient(135deg, ${C.mars}, ${C.marsLight})`,
            border: 'none', borderRadius: 10, color: '#fff',
            fontSize: 13, fontWeight: 700,
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 2,
            cursor: (loading || isSwitchingSource) ? 'not-allowed' : 'pointer',
            boxShadow: (loading || isSwitchingSource) ? 'none' : '0 4px 24px rgba(199,91,57,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {(loading || isSwitchingSource) ? (
            <>
              <div style={{
                width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                borderTop: '2px solid #fff', borderRadius: '50%',
                animation: 'spin-slow 0.8s linear infinite',
              }} />
              {isSwitchingSource ? t('predict.switchingBtn', 'SWITCHING') : t('predict.runningBtn')}
            </>
          ) : t('predict.runBtn')}
        </button>

        {error && (
          <div style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 8,
            background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)',
            fontSize: 11, color: '#ff6b6b', lineHeight: 1.6,
          }}>
            {error}
          </div>
        )}

        <button
          onClick={() => onShapleyClick('gradient')}
          style={{
            width: '100%', marginTop: 12, padding: '10px 0',
            background: 'rgba(0,240,255,0.05)',
            border: '1px solid rgba(0,240,255,0.3)',
            borderRadius: 10, color: '#00F0FF',
            fontSize: 10, fontWeight: 900,
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 1.5,
            cursor: 'pointer',
            transition: 'all 0.3s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,240,255,0.15)'; e.currentTarget.style.boxShadow = '0 0 15px rgba(0,240,255,0.2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,240,255,0.05)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          {t('predict.shapleyBtn', '🧠 GLOBAL SHAP ATTRIBUTION')}
        </button>

      </GlowCard>

      {/* 参数设置 */}
      <GlowCard style={{ padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
          {t('predict.sidebar.parameters')}
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: C.ice30, marginBottom: 6 }}>
            数据源
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', borderRadius: 8,
            background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${C.border}`,
            opacity: isSwitchingSource ? 0.72 : 1,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ color: C.ice, fontSize: 11 }}>Default / Personal</span>
              <span style={{ color: isPersonalMode ? C.blue : C.ice60, fontSize: 10, fontWeight: 700 }}>
                {isPersonalMode ? '当前：Personal' : '当前：Default'}
              </span>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: 32, height: 18, pointerEvents: isSwitchingSource ? 'none' : 'auto' }}>
              <input
                type="checkbox"
                checked={isPersonalMode}
                disabled={isSwitchingSource}
                onChange={() => setDataSourceMode(isPersonalMode ? 'default' : 'personal')}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute', cursor: 'pointer', inset: 0,
                backgroundColor: isPersonalMode ? 'rgba(74,158,255,0.3)' : 'rgba(255,255,255,0.1)',
                border: `1px solid ${isPersonalMode ? C.blue : C.border}`,
                transition: '.3s', borderRadius: 34,
              }}>
                <span style={{
                  position: 'absolute', width: 12, height: 12, bottom: 2,
                  left: isPersonalMode ? 16 : 2,
                  borderRadius: '50%', transition: '.3s',
                  backgroundColor: isPersonalMode ? C.blue : C.ice60,
                }} />
              </span>
            </label>
          </div>
          {isSwitchingSource ? (
            <div style={{ marginTop: 8, fontSize: 10, color: C.ice60, lineHeight: 1.5 }}>
              {t('predict.switchingSourceHint', 'Switching data source, please wait...')}
            </div>
          ) : null}
          {sourceMessage ? (
            <div style={{ marginTop: 8, fontSize: 10, color: C.ice60, lineHeight: 1.5 }}>
              {sourceMessage}
            </div>
          ) : null}
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: C.ice30, marginBottom: 6 }}>{t('predict.marsYear')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {years.map((y) => (
              <button key={y} disabled={isSwitchingSource} onClick={() => setMarsYear(y)} style={{
                flex: 1, padding: '8px 0',
                background: marsYear === y ? (isLight ? 'rgba(199,91,57,0.15)' : 'rgba(199,91,57,0.2)') : (isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)'),
                border: `1px solid ${marsYear === y ? C.mars : C.border}`,
                borderRadius: 8, color: marsYear === y ? C.mars : C.ice60,
                fontSize: 13, fontWeight: 700, cursor: isSwitchingSource ? 'not-allowed' : 'pointer',
                fontFamily: "'Orbitron', sans-serif",
                opacity: isSwitchingSource ? 0.7 : 1,
              }}>MY{y}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: C.ice30 }}>{t('predict.startLs')}</span>
            <span style={{ fontSize: 12, color: C.ice, fontFamily: "'Orbitron', sans-serif" }}>{lsStart}°</span>
          </div>
          <input
            type="range" min={0} max={355} step={1}
            value={lsStart}
            onChange={(e) => setLsStart(Number(e.target.value))}
            style={{ width: '100%', accentColor: C.mars }}
          />
        </div>
      </GlowCard>

      {/* 变量勾选 */}
      <GlowCard style={{ padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
          {t('predict.sidebar.inputVariables')}
        </div>
        {VARIABLES.map((v) => (
          <label key={v.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', marginBottom: 4, borderRadius: 8,
            background: selectedVars.includes(v.id) ? (isLight ? 'rgba(74,158,255,0.08)' : 'rgba(74,158,255,0.06)') : 'transparent',
            border: `1px solid ${selectedVars.includes(v.id) ? (isLight ? 'rgba(74,158,255,0.2)' : 'rgba(74,158,255,0.15)') : 'transparent'}`,
            cursor: 'pointer', transition: 'all 0.2s',
          }}>
            <input
              type="checkbox"
              checked={selectedVars.includes(v.id)}
              onChange={() => toggleVar(v.id)}
              style={{ accentColor: v.color }}
            />
            <span style={{ fontSize: 12, color: selectedVars.includes(v.id) ? C.ice : C.ice30 }}>{v.label}</span>
          </label>
        ))}
      </GlowCard>

      <SelectionPerformance
        isLight={isLight}
        currentMetrics={currentMetrics}
        perfLoading={perfLoading}
        handleFetchPerformance={handleFetchPerformance}
        precision={precision}
        t={t}
      />

      <ModelHyperparams t={t} />


      {/* 模型对比 - 带上下滑动条 */}
      <GlowCard style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4acfac', fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>
            {t('predict.matrix.title', 'MODEL MATRIX')}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleSelectAll}
              style={{ padding: '4px 10px', background: isLight ? 'rgba(74,207,172,0.12)' : 'rgba(74,207,172,0.15)', border: `1px solid ${isLight ? 'rgba(74,207,172,0.3)' : '#4acfac50'}`, borderRadius: 6, color: isLight ? '#2d8c72' : '#4acfac', fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
            >{t('predict.matrix.selectAll', 'ALL')}</button>
            <button
              onClick={handleSeed32}
              style={{ padding: '4px 10px', background: isLight ? 'rgba(156,123,234,0.12)' : 'rgba(156,123,234,0.15)', border: `1px solid ${isLight ? 'rgba(156,123,234,0.3)' : '#9c7bea50'}`, borderRadius: 6, color: isLight ? '#7a5bb8' : '#9c7bea', fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
            >{t('predict.matrix.seed32', 'EXHAUSTIVE')}</button>
          </div>
        </div>

        {/* 上下滑动区，关闭左右滑动 */}
        <div style={{
          maxHeight: 280,
          overflowY: 'auto',
          overflowX: 'hidden',
          marginBottom: 12,
          paddingRight: 4,
          background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.2)',
          borderRadius: 8,
          border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : C.border}`
        }}>
          {compareConfigs.map((c) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 12px', borderRadius: 6,
              background: selectedCompareIds.includes(c.id) ? (isLight ? 'rgba(74,207,172,0.1)' : 'rgba(74,207,172,0.06)') : 'transparent',
              transition: 'all 0.2s',
              borderBottom: `1px solid ${isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.02)'}`
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}>
                <input
                  type="checkbox"
                  checked={selectedCompareIds.includes(c.id)}
                  onChange={() => {
                    setSelectedCompareIds(prev =>
                      prev.includes(c.id) ? prev.filter(x => x !== c.id) : [...prev, c.id]
                    );
                  }}
                  style={{ accentColor: '#4acfac' }}
                />
                <span style={{ fontSize: 12, color: selectedCompareIds.includes(c.id) ? C.ice : C.ice30, fontFamily: "'Orbitron', sans-serif" }}>{c.label}</span>
              </label>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCompareConfigs(prev => prev.filter(pc => pc.id !== c.id));
                  setSelectedCompareIds(prev => prev.filter(pid => pid !== c.id));
                }}
                style={{
                  background: 'none', border: 'none', color: 'rgba(199,91,57,0.4)',
                  fontSize: 14, cursor: 'pointer', padding: '4px 8px',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.color = C.mars}
                onMouseLeave={(e) => e.target.style.color = 'rgba(199,91,57,0.4)'}
              >
                ×
              </button>
            </div>
          ))}
          {compareConfigs.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: C.ice30, opacity: 0.5 }}>
              {t('predict.matrix.emptyHint', 'No models in matrix. Click SEED 32 to start or manually select variables to add.')}
            </div>
          )}
        </div>

        <div style={{ display: 'flex' }}>
          <button
            onClick={() => {
              const sortedVars = [...selectedVars].sort();
              const exists = compareConfigs.find(c => {
                const cVars = [...c.vars].sort();
                return cVars.length === sortedVars.length && cVars.every((v, i) => v === sortedVars[i]);
              });
              if (exists) {
                if (!selectedCompareIds.includes(exists.id)) setSelectedCompareIds(prev => [...prev, exists.id]);
                return;
              }
              const newId = `custom_${Date.now()}`;
              const prefix = selectedVars.length === 0 ? 'Baseline' : selectedVars.map(v => SHORTHAND_MAP[v] || v[0]).sort().join('');
              setCompareConfigs(prev => [...prev, { id: newId, label: prefix, vars: [...selectedVars] }]);
              setSelectedCompareIds(prev => [...prev, newId]);
            }}
            style={{ width: '100%', padding: '10px 0', background: isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.03)', border: `1px dashed ${isLight ? 'rgba(0,0,0,0.15)' : C.border}`, borderRadius: 10, color: isLight ? '#555' : C.ice60, fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
          >
            {t('predict.matrix.addBtn', '+ ADD')}
          </button>
        </div>
      </GlowCard>

      <div style={{ padding: '0 20px', fontSize: 9, color: C.ice30, textAlign: 'center', opacity: 0.5 }}>
        ARES_VISION_OS // {t('predict.hud.coreOsLabel')} V3.2
      </div>
    </div>
  );
}
