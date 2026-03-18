import C from '../../constants/colors'; // Re-triggering vite cache
import { useT } from '../../i18n';
import GlowCard from '../../components/GlowCard';
import { FieldCanvas, LoadingBox, EmptyBox } from './PredictComponents';

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
              Step {i + 1}{results.ls_values?.[i] != null ? ` (Ls=${results.ls_values[i].toFixed(3)}°)` : ''}
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

      {/* 当前应用模型信息 */}
      {results && results.model_info && (
        <GlowCard style={{ padding: '16px 20px', border: results.model_info.is_fallback ? '1px solid rgba(255,80,80,0.3)' : `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: results.model_info.is_fallback ? 'rgba(255,80,80,0.1)' : 'rgba(74,207,172,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16
              }}>
                {results.model_info.is_fallback ? '⚠️' : '🎯'}
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.ice30, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>CURRENT ACTIVE MODEL</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.ice, marginTop: 2 }}>
                  PredRNNv2 <span style={{ color: C.blue }}>_{results.model_info.suffix}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: C.ice30 }}>INPUT CHANNELS</div>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: results.model_info.is_fallback ? '#ff8a8a' : '#4acfac',
                  marginTop: 2, display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap', maxWidth: 200
                }}>
                  {results.model_info.input_vars.map((v) => (
                    <span key={v} style={{
                      padding: '1px 5px', background: 'rgba(255,255,255,0.05)', borderRadius: 4
                    }}>
                      {v.replace('_Optical_Depth', '').replace('_Flux_DN', '').replace('_Wind', '')}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: C.ice30 }}>INPUT DIM</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ice }}>{results.model_info.input_dim} Ch</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: C.ice30 }}>WEIGHT FILE</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.ice }}>{results.model_info.weight_file}</div>
              </div>
            </div>
          </div>

          {results.model_info.is_fallback && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 8,
              background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)',
              display: 'flex', alignItems: 'flex-start', gap: 10
            }}>
              <span style={{ fontSize: 14 }}>💡</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#ff6b6b' }}>{t('predict.fallbackWarning')}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,107,107,0.7)', marginTop: 2 }}>
                  {t('predict.fallbackReason')}{results.model_info.fallback_reason}
                </div>
              </div>
            </div>
          )}
        </GlowCard>
      )}

      {/* 初始提示（无结果时） */}
      {!results && !loading && (
        <GlowCard style={{ padding: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔭</div>
          <div style={{ fontSize: 14, color: C.ice60, marginBottom: 8 }}>
            {t('predict.initPrompt')}
          </div>
          <div style={{ fontSize: 12, color: C.ice30, lineHeight: 1.7, whiteSpace: 'pre-line' }}>
            {t('predict.initDesc')}
          </div>
        </GlowCard>
      )}
    </div>
  );
}
