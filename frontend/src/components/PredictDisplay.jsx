import C from '../constants/colors';
import { useT } from '../i18n';
import GlowCard from './GlowCard';
import LoadingBox from './PredictPage/LoadingBox'; // Wait, I need to decide where to put helper components
import EmptyBox from './PredictPage/EmptyBox';
import FieldCanvas from './PredictPage/FieldCanvas';

// Using namespacing or passing as props for now if they are not in separate files yet.
// For now, I'll assume they are defined in PredictPage.jsx and we will move them soon, 
// or I'll just keep them as local components if they are simple enough.
// Actually, I'll extract helper components too.

export default function PredictDisplay({
  viewMode,
  setViewMode,
  VIEW_MODES,
  results,
  activeHorizon,
  setActiveHorizon,
  loading,
  truthField,
  predField,
  residField,
  stepLs,
  stepLabel,
  setFullscreen3D,
  TRIPTYCH_PANELS,
  FieldCanvas, // Passing these as props since they are currently in PredictPage
  LoadingBox,
  EmptyBox
}) {
  const t = useT();
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* 视图切换 Tab */}
      <div style={{ display: 'flex', gap: 8 }}>
        {VIEW_MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setViewMode(m.id)}
            style={{
              padding: '8px 16px',
              background: viewMode === m.id ? 'rgba(74,158,255,0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${viewMode === m.id ? C.blue : C.border}`,
              borderRadius: 8, fontSize: 12, fontWeight: 600,
              color: viewMode === m.id ? C.blue : C.ice30,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* 预测步骤选择（有多步结果时显示） */}
      {results && results.horizon > 1 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.ice30, marginRight: 4 }}>{t('predict.showStep')}</span>
          {Array.from({ length: results.horizon }, (_, i) => (
            <button key={i} onClick={() => setActiveHorizon(i)} style={{
              padding: '6px 16px',
              background: activeHorizon === i ? 'rgba(74,158,255,0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${activeHorizon === i ? C.blue : C.border}`,
              borderRadius: 8, fontSize: 12, fontWeight: 600,
              color: activeHorizon === i ? C.blue : C.ice30, cursor: 'pointer',
            }}>
              Step {i + 1}{results.ls_values[i] != null ? ` (Ls=${results.ls_values[i].toFixed(3)}°)` : ''}
            </button>
          ))}
        </div>
      )}

      {/* 三联对比视图 */}
      {viewMode === 'triptych' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {TRIPTYCH_PANELS.map((panel, i) => {
            const fieldData = i === 0 ? truthField : i === 1 ? predField : residField;
            return (
              <GlowCard key={i} breathe style={{ padding: 16 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, color: panel.color,
                  fontFamily: "'Orbitron', sans-serif", letterSpacing: 1,
                  marginBottom: 8, textAlign: 'center',
                }}>
                  {panel.title}
                  {stepLs != null && (
                    <span style={{ fontSize: 9, color: C.ice30, marginLeft: 6 }}>
                      Ls={stepLs.toFixed(3)}°
                    </span>
                  )}
                </div>
                {loading ? (
                  <LoadingBox h={220} />
                ) : fieldData ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <FieldCanvas fieldData={fieldData} colorMode={panel.mode} h={220} />
                    <button
                      onClick={() => setFullscreen3D({ fieldData, colorMode: panel.mode })}
                      style={{
                        width: '100%', padding: '8px 0',
                        background: 'rgba(74,158,255,0.06)',
                        border: `1px solid rgba(74,158,255,0.2)`, borderRadius: 6,
                        color: '#4acfac', fontSize: 11, cursor: 'pointer',
                        fontFamily: "'Orbitron', sans-serif", letterSpacing: 1,
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(74,158,255,0.15)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(74,158,255,0.06)' }}
                    >
                      🌐 3D GLOBE VIEW
                    </button>
                  </div>
                ) : (
                  <EmptyBox h={220} />
                )}
              </GlowCard>
            );
          })}
        </div>
      )}

      {/* 单图视图 */}
      {viewMode !== 'triptych' && (() => {
        const isResid = viewMode === 'diff';
        const fd = viewMode === 'original' ? truthField : viewMode === 'prediction' ? predField : residField;
        const panelTitle = viewMode === 'original'
          ? `${t('predict.panels.truth')}${stepLabel(stepLs)}`
          : viewMode === 'prediction'
            ? `${t('predict.panels.prediction')}${stepLabel(stepLs)}`
            : `${t('predict.panels.residual')}${stepLabel(stepLs)}`;
        const panelColor = viewMode === 'original' ? C.blue : viewMode === 'prediction' ? C.mars : '#9c7bea';
        return (
          <GlowCard breathe style={{ padding: 20 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: panelColor,
              fontFamily: "'Orbitron', sans-serif", letterSpacing: 1,
              marginBottom: 12, textAlign: 'center',
            }}>
              {panelTitle}
            </div>
            {loading ? (
              <LoadingBox h={400} />
            ) : fd ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <FieldCanvas fieldData={fd} colorMode={isResid ? 'rdbu' : 'inferno'} h={400} />
                <button
                  onClick={() => setFullscreen3D({ fieldData: fd, colorMode: isResid ? 'rdbu' : 'inferno' })}
                  style={{
                    width: '100%', padding: '12px 0',
                    background: 'rgba(74,158,255,0.06)',
                    border: `1px dashed rgba(74,158,255,0.3)`, borderRadius: 8,
                    color: '#4acfac', fontSize: 13, cursor: 'pointer',
                    fontFamily: "'Orbitron', sans-serif", letterSpacing: 1.5,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(74,158,255,0.15)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(74,158,255,0.06)' }}
                >
                  🌐 VIEW IN 3D GLOBE
                </button>
              </div>
            ) : (
              <EmptyBox h={400} />
            )}
          </GlowCard>
        );
      })()}
    </div>
  );
}
