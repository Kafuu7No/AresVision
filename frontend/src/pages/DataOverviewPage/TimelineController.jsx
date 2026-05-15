import React from 'react';
import GlowCard from '../../components/GlowCard';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useSettings } from '../../contexts/SettingsContext';
import { useDataOverview } from '../../contexts/DataOverviewContext';

export default function TimelineController() {
  const t = useT();
  const { settings } = useSettings();
  const isLight = settings?.theme === 'light';
  const isZh = settings?.language !== 'en';
  const {
    globalTimeLs,
    setGlobalTimeLs,
    isPlayingTimeline,
    setIsPlayingTimeline,
    leftPanelWidth,
    rightPanelWidth,
  } = useDataOverview();

  const playerWidth = `clamp(360px, calc(100vw - ${leftPanelWidth + rightPanelWidth + 180}px), 620px)`;

  const seasonName =
    globalTimeLs < 90 ? t('common.season.spring') :
    globalTimeLs < 180 ? t('common.season.summer') :
    globalTimeLs < 270 ? t('common.season.autumn') :
    t('common.season.winter');

  const onTogglePlay = () => setIsPlayingTimeline((p) => !p);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: `calc(50% + ${(leftPanelWidth - rightPanelWidth) / 2}px)`,
        transform: 'translateX(-50%)',
        width: playerWidth,
        zIndex: 1500,
        transition: 'none',
      }}
    >
      <GlowCard style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onTogglePlay}
            title={isPlayingTimeline ? t('common.pause') : t('common.play')}
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: isPlayingTimeline ? 'rgba(199,91,57,0.2)' : `linear-gradient(135deg, ${C.mars}, #ff8e53)`,
              border: isPlayingTimeline ? `1px solid ${C.mars}` : 'none',
              color: isPlayingTimeline ? C.mars : '#fff',
              fontSize: 'calc(13px * var(--font-scale, 1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: isPlayingTimeline ? 'none' : '0 3px 10px rgba(199,91,57,0.35)',
              flexShrink: 0,
            }}
          >
            {isPlayingTimeline ? '||' : '>'}
          </button>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <div style={{ fontSize: 'calc(10px * var(--font-scale, 1))', color: C.ice30, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>
                {isZh ? '太阳黄经' : 'SOLAR LONGITUDE'}
              </div>
              <div style={{ fontSize: 'calc(12px * var(--font-scale, 1))', color: C.mars, fontWeight: 'bold', fontFamily: "'Orbitron', sans-serif" }}>
                {globalTimeLs}°
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={globalTimeLs}
              onChange={(e) => setGlobalTimeLs(Number(e.target.value))}
              style={{ width: '100%', accentColor: C.mars, cursor: 'pointer' }}
            />
          </div>

          <button
            onClick={() => setGlobalTimeLs(0)}
            title={isZh ? '重置 Ls' : 'Reset Ls'}
            style={{
              background: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${C.border}`,
              borderRadius: '50%',
              width: 28,
              height: 28,
              color: C.ice60,
              fontSize: 'calc(12px * var(--font-scale, 1))',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            R
          </button>

          <div
            style={{
              padding: '4px 9px',
              borderRadius: '999px',
              border: `1px solid ${C.border}`,
              color: C.ice60,
              fontSize: 'calc(10px * var(--font-scale, 1))',
              fontFamily: "'Exo 2', sans-serif",
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {seasonName}
          </div>
        </div>
      </GlowCard>
    </div>
  );
}
