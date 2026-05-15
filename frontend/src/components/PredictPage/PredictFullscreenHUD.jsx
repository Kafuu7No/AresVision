import SphericalFieldCanvas from '../SphericalFieldCanvas';
import C from '../../constants/colors';
import { ozoneLabel, convertOzone } from '../../utils/units';
import { fmtNum } from '../../utils/fmt';

export default function PredictFullscreenHUD({
  fullscreen3D,
  setFullscreen3D,
  truthField,
  stepLs,
  step,
  precision,
  ozoneUnit
}) {
  if (!fullscreen3D) return null;

  return (
    <div 
      onDoubleClick={() => setFullscreen3D(null)} 
      style={{ 
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
        zIndex: 9999, background: 'rgba(5, 5, 10, 0.98)', 
        display: 'flex', justifyContent: 'center', alignItems: 'center' 
      }}
    >
      <SphericalFieldCanvas 
        fieldData={fullscreen3D.fieldData} 
        colorMode={fullscreen3D.colorMode} 
        h="100vh" 
        forceFullscreen 
      />
      
      {/* 覆盖 HUD */}
      <div style={{ 
        position: 'absolute', top: 80, left: 40, padding: '24px', 
        background: 'rgba(20,20,30,0.65)', backdropFilter: 'blur(16px)', 
        border: `1px solid ${C.border}`, borderRadius: 16 
      }}>
        <div style={{ fontSize: 'calc(18px * var(--font-scale, 1))', color: C.ice, fontFamily: "'Orbitron', sans-serif" }}>Globe View</div>
        <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice30, marginTop: 4 }}>Double-click anywhere to exit</div>
        
        {stepLs != null && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice30, fontFamily: "'Orbitron', sans-serif" }}>SOLAR LONGITUDE</div>
            <div style={{ fontSize: 'calc(16px * var(--font-scale, 1))', color: C.blue, fontWeight: 700 }}>Ls {stepLs.toFixed(3)}°</div>
          </div>
        )}
        
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice30, fontFamily: "'Orbitron', sans-serif" }}>ATMOSPHERIC OZONE</div>
          <div style={{ fontSize: 'calc(16px * var(--font-scale, 1))', color: C.mars, fontWeight: 700 }}>
            {fullscreen3D.fieldData.minVal != null ? fmtNum(convertOzone(fullscreen3D.fieldData.minVal, ozoneUnit), precision) : '—'} 
            <span style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.ice30, margin: '0 6px' }}>to</span>
            {fullscreen3D.fieldData.maxVal != null ? fmtNum(convertOzone(fullscreen3D.fieldData.maxVal, ozoneUnit), precision) : '—'}
            <span style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice30, marginLeft: 4 }}>{ozoneLabel(ozoneUnit)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
