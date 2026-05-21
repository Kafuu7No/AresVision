import { useT } from '../../i18n';
import C from '../../constants/colors';
import GlowCard from '../GlowCard';

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
  fusionGroups,
  setFusionGroups,
}) {
  const t = useT();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 预测控制 */}
      <GlowCard style={{ padding: 20 }}>
        <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
          PREDICTION CONTROL
        </div>
        <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice30, marginBottom: 10 }}>{t('predict.horizon')}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[1, 2, 3].map((s) => (
            <button key={s} onClick={() => setPredStep(s)} style={{
              flex: 1, padding: '10px 0',
              background: predStep === s ? 'rgba(199,91,57,0.2)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${predStep === s ? C.mars : C.border}`,
              borderRadius: 8, color: predStep === s ? C.mars : C.ice60,
              fontSize: 'calc(13px * var(--font-scale, 1))', fontWeight: 700, cursor: 'pointer',
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
            fontSize: 'calc(13px * var(--font-scale, 1))', fontWeight: 700,
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
            fontSize: 'calc(11px * var(--font-scale, 1))', color: '#ff6b6b', lineHeight: 1.6,
          }}>
            {error}
          </div>
        )}
      </GlowCard>

      {/* 参数设置 */}
      <GlowCard style={{ padding: 20 }}>
        <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
          PARAMETERS
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice30, marginBottom: 6 }}>{t('predict.marsYear')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[27, 28].map((y) => (
              <button key={y} onClick={() => setMarsYear(y)} style={{
                flex: 1, padding: '8px 0',
                background: marsYear === y ? 'rgba(199,91,57,0.2)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${marsYear === y ? C.mars : C.border}`,
                borderRadius: 8, color: marsYear === y ? C.mars : C.ice60,
                fontSize: 'calc(13px * var(--font-scale, 1))', fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Orbitron', sans-serif",
              }}>MY{y}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice30 }}>{t('predict.startLs')}</span>
            <span style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice, fontFamily: "'Orbitron', sans-serif" }}>{lsStart}°</span>
          </div>
          <input
            type="range" min={0} max={355} step={1}
            value={lsStart}
            onChange={(e) => setLsStart(Number(e.target.value))}
            style={{ width: '100%', accentColor: C.mars }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice30, marginTop: 4 }}>
            <span>{t('predict.lsMarks.spring')}</span><span>{t('predict.lsMarks.summer')}</span><span>{t('predict.lsMarks.autumn')}</span><span>{t('predict.lsMarks.winter')}</span>
          </div>
        </div>
      </GlowCard>

      {/* 变量勾选 */}
      <GlowCard style={{ padding: 20 }}>
        <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
          INPUT VARIABLES
        </div>
        <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice30, marginBottom: 12, lineHeight: 1.6 }}>
          {t('predict.envVarsLabel')}
        </div>
        {VARIABLES.map((v) => (
          <label key={v.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', marginBottom: 4, borderRadius: 8,
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
            <span style={{ fontSize: 'calc(14px * var(--font-scale, 1))' }}>{v.icon}</span>
            <span style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: selectedVars.includes(v.id) ? C.ice : C.ice30 }}>{v.label}</span>
          </label>
        ))}
        <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(199,91,57,0.08)', fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice30 }}>
          {t('predict.envVarsNote', { selected: selectedVars.length })}
        </div>
      </GlowCard>

      {/* 多模型对比勾选 */}
      <GlowCard style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 700, color: '#4acfac', fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>
            COMPARE MODELS
          </div>
          {compareConfigs.length > 0 && (
            <div 
              onClick={() => {
                const modelIds = compareConfigs.map(c => c.id);
                const allSelected = modelIds.every(id => selectedCompareIds.includes(id));
                if (allSelected) {
                  setSelectedCompareIds(prev => prev.filter(id => !modelIds.includes(id)));
                } else {
                  setSelectedCompareIds(prev => [...new Set([...prev, ...modelIds])]);
                }
              }}
              style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.blue, cursor: 'pointer', fontFamily: "'Orbitron', sans-serif", opacity: 0.8 }}
            >
              {compareConfigs.map(c => c.id).every(id => selectedCompareIds.includes(id)) ? 'DESELECT MODELS' : 'SELECT ALL MODELS'}
            </div>
          )}
        </div>
        {compareConfigs.map((c) => (
          <div key={c.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 10px', marginBottom: 4, borderRadius: 6,
            background: selectedCompareIds.includes(c.id) ? 'rgba(74,207,172,0.06)' : 'transparent',
            transition: 'all 0.2s',
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
              <span style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: selectedCompareIds.includes(c.id) ? C.ice : C.ice30 }}>{c.label}</span>
            </label>
            <button
              onClick={() => {
                setCompareConfigs(prev => prev.filter(pc => pc.id !== c.id));
                setSelectedCompareIds(prev => prev.filter(pid => pid !== c.id));
              }}
              style={{ background: 'none', border: 'none', color: 'rgba(199,91,57,0.4)', fontSize: 'calc(14px * var(--font-scale, 1))', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        ))}
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
            const shorthands = { "Temperature": "T", "Dust_Optical_Depth": "D", "Solar_Flux_DN": "S", "U_Wind": "U", "V_Wind": "V" };
            const label = selectedVars.length === 0 ? 'Baseline' : selectedVars.map(v => shorthands[v] || v[0]).sort().join('');
            setCompareConfigs(prev => [...prev, { id: newId, label, vars: [...selectedVars] }]);
            setSelectedCompareIds(prev => [...prev, newId]);
          }}
          style={{
            width: '100%', marginTop: 8, padding: '8px 0',
            background: 'rgba(255,255,255,0.03)', border: `1px dashed ${C.border}`,
            borderRadius: 8, color: C.ice60, fontSize: 'calc(11px * var(--font-scale, 1))', cursor: 'pointer'
          }}
        >
          + 将当前配置加入对比
        </button>
      </GlowCard>

      {/* 融合组管理 */}
      <GlowCard style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 700, color: '#4acfac', fontFamily: "'Orbitron', sans-serif", letterSpacing: 2 }}>
            ENSEMBLE GROUPS
          </div>
        </div>
        {fusionGroups.map((g) => (
          <div key={g.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 10px', marginBottom: 4, borderRadius: 6,
            background: selectedCompareIds.includes(g.id) ? 'rgba(74,207,172,0.1)' : 'transparent',
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flex: 1 }}>
              <input
                type="checkbox"
                checked={selectedCompareIds.includes(g.id)}
                onChange={() => {
                  setSelectedCompareIds(prev => prev.includes(g.id) ? prev.filter(x => x !== g.id) : [...prev, g.id]);
                }}
                style={{ accentColor: '#4acfac' }}
              />
              <span style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: selectedCompareIds.includes(g.id) ? C.ice : C.ice30, fontWeight: 700 }}>{g.label}</span>
            </label>
            <button
              onClick={() => {
                setFusionGroups(prev => prev.filter(x => x.id !== g.id));
                setSelectedCompareIds(prev => prev.filter(pid => pid !== g.id));
              }}
              style={{ background: 'none', border: 'none', color: 'rgba(199,91,57,0.3)', fontSize: 'calc(14px * var(--font-scale, 1))', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        ))}
        <button 
          onClick={() => {
            if (selectedCompareIds.length < 2) return alert('请先在上方勾选至少 2 个模型');
            const name = prompt('请输入融合组名称', `Ensemble_${fusionGroups.length + 1}`);
            if (!name) return;
            const modelIds = selectedCompareIds.filter(id => !id.startsWith('fusion_'));
            const newId = `fusion_${Date.now()}`;
            setFusionGroups(prev => [...prev, { id: newId, label: name, modelKeys: modelIds }]);
            setSelectedCompareIds(prev => [...prev, newId]);
          }}
          style={{
            width: '100%', marginTop: 8, padding: '10px 0',
            background: 'rgba(74,207,172,0.1)', border: `1px solid rgba(74,207,172,0.3)`,
            borderRadius: 8, color: '#4acfac', fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 700, cursor: 'pointer'
          }}
        >
          将选定模型保存为融合组
        </button>
      </GlowCard>

      {/* File Upload */}
      <GlowCard style={{ padding: 20 }}>
        <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
          FILE UPLOAD
        </div>
        <div style={{
          border: `2px dashed ${C.border}`, borderRadius: 12, padding: 28,
          textAlign: 'center', cursor: 'pointer',
        }}>
          <div style={{ fontSize: 'calc(30px * var(--font-scale, 1))', marginBottom: 8 }}>📁</div>
          <div style={{ fontSize: 'calc(13px * var(--font-scale, 1))', color: C.ice60 }}>{t('predict.fileUpload.drag')}</div>
          <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice30, marginTop: 4 }}>{t('predict.fileUpload.click')}</div>
        </div>
      </GlowCard>
    </div>
  );
}
