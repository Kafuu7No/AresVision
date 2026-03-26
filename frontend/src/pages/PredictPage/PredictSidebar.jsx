import C from '../../constants/colors';
import { useT } from '../../i18n';
import GlowCard from '../../components/GlowCard';

const SHORTHAND_MAP = {
  "Temperature": "T",
  "Dust_Optical_Depth": "D",
  "Surface_Pressure": "P",
  "Solar_Flux_DN": "S",
  "U_Wind": "U",
  "V_Wind": "V"
};

export default function PredictSidebar({
  loading,
  error,
  marsYear,
  setMarsYear,
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
  handleFuseModels,
  onShapleyClick,
}) {
  const t = useT();

  const handleSeed32 = () => {
    // 强制按 5 种核心变量生成全部 32 种组合
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
      // 这里的 id 必须稳定
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
          PREDICTION CONTROL
        </div>
        <div style={{ fontSize: 11, color: C.ice30, marginBottom: 10 }}>{t('predict.horizon')}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[1, 2, 3].map((s) => (
            <button key={s} onClick={() => setPredStep(s)} style={{
              flex: 1, padding: '10px 0',
              background: predStep === s ? 'rgba(199,91,57,0.2)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${predStep === s ? C.mars : C.border}`,
              borderRadius: 8, color: predStep === s ? C.mars : C.ice60,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Orbitron', sans-serif",
            }}>+{s}</button>
          ))}
        </div>
        <button
          onClick={handlePredict}
          disabled={loading}
          style={{
            width: '100%', padding: '14px 0',
            background: loading
              ? 'rgba(199,91,57,0.3)'
              : `linear-gradient(135deg, ${C.mars}, ${C.marsLight})`,
            border: 'none', borderRadius: 10, color: '#fff',
            fontSize: 13, fontWeight: 700,
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 2,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 4px 24px rgba(199,91,57,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {loading ? (
            <>
              <div style={{
                width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                borderTop: '2px solid #fff', borderRadius: '50%',
                animation: 'spin-slow 0.8s linear infinite',
              }} />
              {t('predict.runningBtn')}
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
          {t('predict.shapleyBtn', '🧠 全局梯度归因 (SHAP)')}
        </button>

      </GlowCard>

      {/* 参数设置 */}
      <GlowCard style={{ padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
          PARAMETERS
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: C.ice30, marginBottom: 6 }}>{t('predict.marsYear')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[27, 28].map((y) => (
              <button key={y} onClick={() => setMarsYear(y)} style={{
                flex: 1, padding: '8px 0',
                background: marsYear === y ? 'rgba(199,91,57,0.2)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${marsYear === y ? C.mars : C.border}`,
                borderRadius: 8, color: marsYear === y ? C.mars : C.ice60,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Orbitron', sans-serif",
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
          INPUT VARIABLES
        </div>
        {VARIABLES.map((v) => (
          <label key={v.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', marginBottom: 4, borderRadius: 8,
            background: selectedVars.includes(v.id) ? 'rgba(74,158,255,0.06)' : 'transparent',
            border: `1px solid ${selectedVars.includes(v.id) ? 'rgba(74,158,255,0.15)' : 'transparent'}`,
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

      {/* 模型对比 - 带上下滑动条 */}
      <GlowCard style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4acfac', fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>
            {t('predict.matrix.title', 'MODEL MATRIX')}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleSelectAll}
              style={{ padding: '4px 10px', background: 'rgba(74,207,172,0.15)', border: `1px solid #4acfac50`, borderRadius: 6, color: '#4acfac', fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
            >{t('predict.matrix.selectAll', 'ALL')}</button>
            <button
              onClick={handleSeed32}
              style={{ padding: '4px 10px', background: 'rgba(156,123,234,0.15)', border: `1px solid #9c7bea50`, borderRadius: 6, color: '#9c7bea', fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
            >{t('predict.matrix.seed32', 'SEED 32')}</button>
          </div>
        </div>

        {/* 上下滑动区，关闭左右滑动 */}
        <div style={{
          maxHeight: 280,
          overflowY: 'auto',
          overflowX: 'hidden',
          marginBottom: 12,
          paddingRight: 4,
          background: 'rgba(0,0,0,0.1)',
          borderRadius: 8,
          border: `1px solid ${C.border}`
        }}>
          {compareConfigs.map((c) => (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 12px', borderRadius: 6,
              background: selectedCompareIds.includes(c.id) ? 'rgba(74,207,172,0.06)' : 'transparent',
              transition: 'all 0.2s',
              borderBottom: `1px solid rgba(255,255,255,0.02)`
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
              {t('predict.matrix.emptyHint', 'No models in matrix. Click SEED 32 to start.')}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
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
            style={{ flex: 1, padding: '10px 0', background: 'rgba(255,255,255,0.03)', border: `1px dashed ${C.border}`, borderRadius: 10, color: C.ice60, fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: "'Orbitron', sans-serif" }}
          >
            {t('predict.matrix.addBtn', '+ ADD')}
          </button>
          <button
            onClick={handleFuseModels}
            disabled={selectedCompareIds.length < 2}
            style={{ flex: 2, padding: '10px 0', background: selectedCompareIds.length < 2 ? 'rgba(74,207,172,0.05)' : 'rgba(156,123,234,0.15)', border: `1px solid ${selectedCompareIds.length < 2 ? 'rgba(74,207,172,0.1)' : '#9c7bea'}`, borderRadius: 10, color: selectedCompareIds.length < 2 ? 'rgba(74,207,172,0.4)' : '#9c7bea', fontSize: 11, fontWeight: 800, cursor: selectedCompareIds.length < 2 ? 'not-allowed' : 'pointer', fontFamily: "'Orbitron', sans-serif" }}
          >
            {t('predict.matrix.fuseBtn', 'FUSE')}
          </button>
        </div>
      </GlowCard>

      <div style={{ padding: '0 20px', fontSize: 9, color: C.ice30, textAlign: 'center', opacity: 0.5 }}>
        ARES_VISION_OS // SYSTEM_VERSION_3.2
      </div>
    </div>
  );
}
