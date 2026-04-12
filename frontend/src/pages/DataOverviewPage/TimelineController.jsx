import React from 'react';
import GlowCard from '../../components/GlowCard';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useDataOverview } from '../../contexts/DataOverviewContext';

export default function TimelineController() {
  const t = useT();
  const { globalTimeLs, setGlobalTimeLs, isPlayingTimeline, setIsPlayingTimeline } = useDataOverview();

  const seasonName =
    globalTimeLs < 90  ? t('common.season.spring') :
    globalTimeLs < 180 ? t('common.season.summer') :
    globalTimeLs < 270 ? t('common.season.autumn') : t('common.season.winter');

  const onTogglePlay = () => setIsPlayingTimeline(p => !p);

  return (
    <div style={{
      position: 'fixed',
      bottom: '30px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '600px',
      zIndex: 1500,
    }}>
      <GlowCard style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '11px', color: C.ice30, fontFamily: "'Orbitron', sans-serif" }}>
            SOLAR LONGITUDE (Ls)
          </div>
          <div style={{ fontSize: '14px', color: C.mars, fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif" }}>
            {globalTimeLs}° <span style={{ fontSize: '11px', color: C.ice60, marginLeft: '8px' }}>{seasonName}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={onTogglePlay}
            style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: isPlayingTimeline ? 'rgba(199,91,57,0.2)' : `linear-gradient(135deg, ${C.mars}, #ff8e53)`,
              border: isPlayingTimeline ? `1px solid ${C.mars}` : 'none',
              color: isPlayingTimeline ? C.mars : '#fff',
              fontSize: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.3s ease',
              boxShadow: isPlayingTimeline ? 'none' : '0 4px 12px rgba(199,91,57,0.4)'
            }}
          >
            {isPlayingTimeline ? '⏸' : '▶'}
          </button>
          
          <input
            type="range" min={0} max={360} step={5} value={globalTimeLs}
            onChange={e => setGlobalTimeLs(Number(e.target.value))}
            style={{ flex: 1, accentColor: C.mars, cursor: 'pointer' }}
          />

          <button
            onClick={() => setGlobalTimeLs(0)}
            title="Reset Ls"
            style={{
              background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`,
              borderRadius: '50%', width: '32px', height: '32px',
              color: C.ice60, fontSize: '12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ↩
          </button>
        </div>
      </GlowCard>
    </div>
  );
}
