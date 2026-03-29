import React from 'react'; // Re-triggering vite cache
import GlowCard from '../../components/GlowCard';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useSettings } from '../../contexts/SettingsContext';
import { convertOzone, ozoneLabel } from '../../utils/units';
import { makeGradient } from '../../utils/colormaps';

export default function Globe3DControls({
  ozoneData,
  lsValue,
  marsYear,
  playing,
  loadingGlobe,
  autoRotate,
  gestureEnabled,
  onLsChange,
  onMarsYearChange,
  onTogglePlay,
  onToggleAutoRotate,
  onToggleGesture,
}) {
  const t = useT();
  const { settings } = useSettings();
  const ozoneUnit = settings.units.ozone;
  const isZh = settings.language !== 'en';
  const copy = isZh ? {
    panelTitle: '3D 球体控制',
    play: '▶ 播放',
    pause: '⏸ 暂停',
    statistics: '数据统计',
  } : {
    panelTitle: '3D GLOBE CONTROL',
    play: '▶ PLAY',
    pause: '⏸ PAUSE',
    statistics: 'DATA STATISTICS',
  };
  const seasonName =
    lsValue < 90  ? t('common.season.spring') :
    lsValue < 180 ? t('common.season.summer') :
    lsValue < 270 ? t('common.season.autumn') : t('common.season.winter');

  return (
    <GlowCard style={{
      position: 'fixed', top: '90px', right: '20px',
      width: '300px', maxHeight: 'calc(100vh - 110px)',
      overflowY: 'auto', zIndex: 1500, padding: '24px',
    }}>

      {/* 标题 */}
      <div style={{
        fontSize: 11, fontWeight: 700, color: C.mars,
        fontFamily: "'Orbitron', sans-serif", letterSpacing: 2,
        marginBottom: 16, paddingBottom: '12px',
        borderBottom: `1px solid ${C.border}`
      }}>
        🌍 {copy.panelTitle}
      </div>

      {/* Mars Year 选择 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.ice30, marginBottom: 6 }}>{t('overview.controls.marsYear')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[27, 28].map((y) => (
            <button key={y} onClick={() => onMarsYearChange(y)} style={{
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

      {/* Ls 滑块 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: C.ice30 }}>{t('overview.controls.startLs')}</span>
          <span style={{ fontSize: 12, color: C.ice, fontFamily: "'Orbitron', sans-serif" }}>{lsValue}°</span>
        </div>
        <input
          type="range" min={0} max={360} step={5} value={lsValue}
          onChange={e => onLsChange(Number(e.target.value))}
          style={{ width: '100%', accentColor: C.mars, cursor: 'pointer', margin: '4px 0' }}
        />
        <div style={{ fontSize: '10px', color: C.ice30, textAlign: 'center', marginTop: '4px' }}>
          {seasonName}
        </div>
      </div>

      {/* 播放控制 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={onTogglePlay}
          style={{
            flex: 1, padding: '12px 0',
            background: playing ? 'rgba(199,91,57,0.2)' : `linear-gradient(135deg, ${C.mars}, #ff8e53)`,
            border: playing ? `1px solid ${C.mars}` : 'none',
            borderRadius: 8, color: playing ? C.mars : '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: "'Orbitron', sans-serif", letterSpacing: 2,
            transition: 'all 0.3s ease',
            boxShadow: playing ? 'none' : '0 4px 24px rgba(199,91,57,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {playing ? copy.pause : copy.play}
        </button>
        <button
          onClick={() => { onLsChange(0); }}
          title={t('overview.controls.resetLs')}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
            padding: '10px 14px',
            color: C.ice60,
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          ↩
        </button>
      </div>

      {/* 自动旋转控制 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '10px', padding: '10px 12px',
        background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
        border: `1px solid ${C.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>🔄</span>
          <span style={{ color: C.ice, fontSize: '12px', fontFamily: 'Exo 2' }}>{t('overview.controls.autoRotate')}</span>
        </div>
        <label style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px' }}>
          <input
            type="checkbox"
            checked={autoRotate}
            onChange={onToggleAutoRotate}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span style={{
            position: 'absolute', cursor: 'pointer',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: autoRotate ? 'rgba(74,158,255,0.3)' : 'rgba(255,255,255,0.1)',
            border: `1px solid ${autoRotate ? C.blue : C.border}`,
            transition: '.4s', borderRadius: '34px'
          }}>
            <span style={{
              position: 'absolute', content: '""',
              height: '14px', width: '14px',
              left: autoRotate ? '18px' : '2px', bottom: '2px',
              backgroundColor: autoRotate ? C.blue : 'rgba(255,255,255,0.5)',
              transition: '.4s', borderRadius: '50%'
            }} />
          </span>
        </label>
      </div>

      {/* 手势控制 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '16px', padding: '10px 12px',
        background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
        border: `1px solid ${C.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>✋</span>
          <span style={{ color: C.mars, fontSize: '12px', fontFamily: 'Exo 2', fontWeight: 'bold' }}>{t('overview.controls.gesture')}</span>
        </div>
        <label style={{ position: 'relative', display: 'inline-block', width: '36px', height: '20px' }}>
          <input
            type="checkbox"
            checked={gestureEnabled}
            onChange={onToggleGesture}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span style={{
            position: 'absolute', cursor: 'pointer',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: gestureEnabled ? 'rgba(199,91,57,0.3)' : 'rgba(255,255,255,0.1)',
            border: `1px solid ${gestureEnabled ? C.mars : C.border}`,
            transition: '.4s', borderRadius: '34px'
          }}>
            <span style={{
              position: 'absolute', content: '""',
              height: '14px', width: '14px',
              left: gestureEnabled ? '18px' : '2px', bottom: '2px',
              backgroundColor: gestureEnabled ? C.mars : 'rgba(255,255,255,0.5)',
              transition: '.4s', borderRadius: '50%'
            }} />
          </span>
        </label>
      </div>

      {/* 臭氧浓度色阶图例 */}
      <div style={{
        marginBottom: '16px', padding: '16px',
        background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
        border: `1px solid ${C.border}`
      }}>
        <div style={{ color: C.ice30, fontSize: '10px', fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, marginBottom: '10px' }}>
          {`O₃ CONCENTRATION (${ozoneLabel(ozoneUnit)})`}
        </div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '12px', height: '100px' }}>
          <div style={{
            width: '14px', flexShrink: 0, borderRadius: '4px',
            border: `1px solid ${C.border}`,
            background: makeGradient(settings.colormap),
          }} />
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '11px', color: C.ice60 }}>
            <span>{convertOzone(ozoneData.maxVal || 0, ozoneUnit).toFixed(4)}</span>
            <span>{convertOzone(((ozoneData.maxVal || 0) + (ozoneData.minVal || 0)) / 2, ozoneUnit).toFixed(4)}</span>
            <span>{convertOzone(ozoneData.minVal || 0, ozoneUnit).toFixed(4)}</span>
          </div>
        </div>
      </div>

      {/* 数据统计 */}
      <div style={{
        marginBottom: '16px', padding: '16px',
        background: 'rgba(255,255,255,0.02)', borderRadius: '12px',
        border: `1px solid ${C.border}`
      }}>
        <div style={{ color: C.ice30, fontSize: '10px', fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, marginBottom: '10px' }}>{copy.statistics}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ textAlign: 'center', padding: '10px 6px', background: 'rgba(199,91,57,0.08)', borderRadius: '8px' }}>
            <div style={{ color: C.mars, fontSize: '18px', fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif" }}>
              {ozoneData.points?.length || 0}
            </div>
            <div style={{ color: C.ice30, fontSize: '10px', marginTop: '4px' }}>{t('overview.controls.dataPoints')}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '10px 6px', background: 'rgba(74,158,255,0.05)', borderRadius: '8px' }}>
            <div style={{ color: C.blue, fontSize: '16px', fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif" }}>
              {convertOzone(ozoneData.maxVal || 0, ozoneUnit).toFixed(3)}
            </div>
            <div style={{ color: C.ice30, fontSize: '10px', marginTop: '4px' }}>{t('overview.controls.maxVal')}</div>
          </div>
        </div>
      </div>

      {/* 交互提示 */}
      <div style={{
        padding: '12px 14px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '10px',
        border: `1px solid ${C.border}`
      }}>
        <div style={{ color: C.ice60, fontSize: '11px', fontFamily: 'Exo 2', lineHeight: 1.8 }}>
          {t('overview.controls.interactionHint').split('\n').map((line, i) => (
            <React.Fragment key={i}>{line}{i < 3 && <br />}</React.Fragment>
          ))}
        </div>
      </div>
    </GlowCard>
  );
}
