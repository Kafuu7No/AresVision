import SphericalFieldCanvas from '../../components/SphericalFieldCanvas';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { fmtNum } from '../../utils/fmt';
import { convertOzone, ozoneDeltaLabel, ozoneLabel } from '../../utils/units';

export default function PredictFullscreenHUD({
  fullscreen3D,
  setFullscreen3D,
  truthField,
  stepLs,
  step,
  precision,
  ozoneUnit,
}) {
  const t = useT();

  if (!fullscreen3D) return null;

  const titleText = fullscreen3D.colorMode === 'rdbu' ? t('predict.fullscreen3D.residual') :
    (fullscreen3D.fieldData === truthField ? t('predict.fullscreen3D.truth') : t('predict.fullscreen3D.prediction'));
  const minValStr = fmtNum(convertOzone(fullscreen3D.fieldData.minVal, ozoneUnit), precision);
  const maxValStr = fmtNum(convertOzone(fullscreen3D.fieldData.maxVal, ozoneUnit), precision);
  const rawMin = fullscreen3D.fieldData.minVal, rawMax = fullscreen3D.fieldData.maxVal;
  const rangeStr = fmtNum(convertOzone(rawMax - rawMin, ozoneUnit), precision);
  const colorTitle = fullscreen3D.colorMode === 'rdbu' ? ozoneDeltaLabel(ozoneUnit) : ozoneLabel(ozoneUnit);
  const absExtreme = convertOzone(Math.max(Math.abs(rawMin), Math.abs(rawMax)), ozoneUnit);
  const topLabel = fullscreen3D.colorMode === 'rdbu' ? `+${fmtNum(absExtreme, precision)}` : maxValStr;
  const midLabel = fullscreen3D.colorMode === 'rdbu' ? '0' : fmtNum(convertOzone((rawMin + rawMax) / 2, ozoneUnit), precision);
  const botLabel = fullscreen3D.colorMode === 'rdbu' ? `-${fmtNum(absExtreme, precision)}` : minValStr;

  return (
    <div
      onDoubleClick={() => setFullscreen3D(null)}
      className="panel-dark"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999, background: 'rgba(5, 5, 10, 0.98)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        cursor: 'zoom-out'
      }}
    >
      <SphericalFieldCanvas
        fieldData={fullscreen3D.fieldData}
        colorMode={fullscreen3D.colorMode}
        h="100vh"
        forceFullscreen
      />

      {/* HUD 左侧控制台 (Side Dashboard Panel) */}
      <div style={{
        position: 'absolute', top: 80, left: 40, bottom: 40, width: 340,
        padding: '24px', background: 'rgba(20,20,30,0.65)',
        backdropFilter: 'blur(16px)', border: `1px solid ${C.border}`,
        borderRadius: 16, boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', gap: 24,
        pointerEvents: 'none', zIndex: 10,
        boxSizing: 'border-box'
      }}>

        {/* 1. 顶部块：当前场数据上下文 */}
        <div style={{ paddingBottom: 16, borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
          <div style={{
            fontSize: 18, fontWeight: 800, color: C.ice,
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 8,
            textShadow: '0 0 10px rgba(255,255,255,0.3)'
          }}>
            {titleText}
          </div>
          <div style={{ fontSize: 13, color: C.ice30, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>
            {stepLs != null ? `Ls = ${stepLs.toFixed(3)}° | Step ${step + 1}` : 'Global View'}
          </div>
        </div>

        {/* 2. 中间块上：全局数据统计 */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
            GLOBAL STATISTICS
          </div>
          <div style={{ display: 'grid', gap: 12, fontSize: 14, fontFamily: "'Orbitron', sans-serif" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: C.ice60 }}>Max Value:</span>
              <span style={{ color: C.mars, fontWeight: 700, fontSize: 15 }}>{maxValStr}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: C.ice60 }}>Min Value:</span>
              <span style={{ color: '#4acfac', fontWeight: 700, fontSize: 15 }}>{minValStr}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingTop: 12, borderTop: `1px dashed rgba(255,255,255,0.1)` }}>
              <span style={{ color: C.ice30 }}>Data Range:</span>
              <span style={{ color: C.ice, fontWeight: 600 }}>{rangeStr}</span>
            </div>
          </div>
        </div>

        {/* 3. 中间块下：颜色图例 Colorbar (横向排列) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, fontFamily: "'Orbitron', sans-serif", letterSpacing: 2, marginBottom: 16 }}>
            DATA SCALE ({colorTitle})
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Min Label */}
            <div style={{ fontSize: 12, color: C.ice, fontFamily: "'Orbitron', sans-serif", minWidth: 50, textAlign: 'right' }}>
              {botLabel}
            </div>

            {/* Color Bar */}
            <div style={{
              flex: 1, height: 16, borderRadius: 8,
              background: fullscreen3D.colorMode === 'rdbu'
                ? 'linear-gradient(to right, rgb(5,48,97), rgb(247,247,247), rgb(103,0,31))'
                : 'linear-gradient(to right, rgb(0,0,4), rgb(212,72,66), rgb(252,255,164))',
              border: `1px solid rgba(255,255,255,0.2)`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              position: 'relative'
            }}>
              {/* Zero tick for rdbu Mode */}
              {fullscreen3D.colorMode === 'rdbu' && (
                <div style={{
                  position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                  fontSize: 10, color: C.ice30, fontFamily: "'Orbitron', sans-serif"
                }}>
                  | {midLabel} |
                </div>
              )}
            </div>

            {/* Max Label */}
            <div style={{ fontSize: 12, color: C.ice, fontFamily: "'Orbitron', sans-serif", minWidth: 50 }}>
              {topLabel}
            </div>
          </div>
        </div>

        {/* 4. 底部块：操作提示 */}
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: `1px solid rgba(255,255,255,0.08)` }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🖱️</span> Left Click: Rotate | Middle Scroll: Zoom
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>
            Double-click anywhere to close
          </div>
        </div>

      </div>

    </div>
  );
}
