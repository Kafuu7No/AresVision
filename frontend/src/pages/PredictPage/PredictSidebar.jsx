import C from '../../constants/colors'; // Re-triggering vite cache
import { useT } from '../../i18n';
import GlowCard from '../../components/GlowCard';

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
}) {
  const t = useT();

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
      </GlowCard>

      {/* 参数设置 */}
      <GlowCard style={{ padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
          PARAMETERS
        </div>

        {/* 火星年 */}
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

        {/* 起始 Ls 滑块 */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.ice30, marginTop: 4 }}>
            <span>{t('predict.lsMarks.spring')}</span><span>{t('predict.lsMarks.summer')}</span><span>{t('predict.lsMarks.autumn')}</span><span>{t('predict.lsMarks.winter')}</span>
          </div>
        </div>
      </GlowCard>

      {/* 变量勾选 */}
      <GlowCard style={{ padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
          INPUT VARIABLES
        </div>
        <div style={{ fontSize: 11, color: C.ice30, marginBottom: 12, lineHeight: 1.6 }}>
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
            <span style={{ fontSize: 14 }}>{v.icon}</span>
            <span style={{ fontSize: 12, color: selectedVars.includes(v.id) ? C.ice : C.ice30 }}>{v.label}</span>
          </label>
        ))}
      </GlowCard>

      {/* 多模型对比勾选 */}
      <GlowCard style={{ padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#4acfac', fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
          COMPARE MODELS
        </div>
        <div style={{ fontSize: 11, color: C.ice30, marginBottom: 12, lineHeight: 1.6 }}>
          在性能图表中同时展示多个模型的曲线，或进行多模型融合。
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
              <span style={{ fontSize: 12, color: selectedCompareIds.includes(c.id) ? C.ice : C.ice30 }}>{c.label}</span>
            </label>

            <button
              onClick={(e) => {
                e.preventDefault();
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

        <button
          onClick={() => {
            // 检查是否已存在完全相同的配置
            const sortedVars = [...selectedVars].sort();
            const exists = compareConfigs.find(c => {
              if (c.isEnsemble) return false;
              const cVars = [...c.vars].sort();
              return cVars.length === sortedVars.length && cVars.every((v, i) => v === sortedVars[i]);
            });

            if (exists) {
              // 如果已存在，确保它是勾选状态即可
              if (!selectedCompareIds.includes(exists.id)) {
                setSelectedCompareIds(prev => [...prev, exists.id]);
              }
              return;
            }

            const newId = `custom_${Date.now()}`;

            // 使用缩写命名，例如 UVDST
            const SHORTHAND_MAP = {
              "Temperature": "T",
              "Dust_Optical_Depth": "D",
              "Solar_Flux_DN": "S",
              "U_Wind": "U",
              "V_Wind": "V"
            };

            let label;
            if (selectedVars.length === 0) {
              label = 'Baseline';
            } else {
              const prefix = selectedVars
                .map(v => SHORTHAND_MAP[v] || v[0])
                .sort()
                .join('');
              label = prefix;
            }

            setCompareConfigs(prev => [...prev, { id: newId, label, vars: [...selectedVars] }]);
            setSelectedCompareIds(prev => [...prev, newId]);
          }}
          style={{
            width: '100%', marginTop: 8, padding: '8px 0',
            background: 'rgba(255,255,255,0.03)', border: `1px dashed ${C.border}`,
            borderRadius: 8, color: C.ice60, fontSize: 11, cursor: 'pointer',
            fontFamily: "'Orbitron', sans-serif"
          }}
        >
          {t('predict.compareAction')}
        </button>

        {/* 融合已选模型按钮 */}
        <button
          onClick={handleFuseModels}
          disabled={selectedCompareIds.length < 2}
          style={{
            width: '100%', marginTop: 8, padding: '10px 0',
            background: selectedCompareIds.length < 2 ? 'rgba(74,207,172,0.05)' : 'rgba(74,207,172,0.12)',
            border: `1px solid ${selectedCompareIds.length < 2 ? 'rgba(74,207,172,0.1)' : '#4acfac'}`,
            borderRadius: 8, color: selectedCompareIds.length < 2 ? 'rgba(74,207,172,0.4)' : '#4acfac',
            fontSize: 11, fontWeight: 700, cursor: selectedCompareIds.length < 2 ? 'not-allowed' : 'pointer',
            fontFamily: "'Orbitron', sans-serif",
            transition: 'all 0.2s'
          }}
        >
          {selectedCompareIds.length < 2 ? 'SELECT 2+ TO FUSE' : 'FUSE SELECTED (ENSEMBLE)'}
        </button>
      </GlowCard>

      {/* File Upload (原有) */}
      <GlowCard style={{ padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.mars, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
          FILE UPLOAD
        </div>
        <div style={{
          border: `2px dashed ${C.border}`,
          borderRadius: 12,
          padding: 28,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.2s',
        }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>📁</div>
          <div style={{ fontSize: 13, color: C.ice60 }}>{t('predict.fileUpload.drag')}</div>
          <div style={{ fontSize: 11, color: C.ice30, marginTop: 4 }}>{t('predict.fileUpload.click')}</div>
        </div>
      </GlowCard>
    </div>
  );
}
