import React from 'react';
import GlowCard from '../../components/GlowCard';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useSettings } from '../../contexts/SettingsContext';
import { useDataOverview } from '../../contexts/DataOverviewContext';
import {
  buildCoverageSegments,
  getActiveOzoneSources,
  getOzoneAvailabilityLabel,
} from './timelineCoverage.js';

const SOURCE_LEGEND = [
  { key: 'mcd', label: 'MCD' },
  { key: 'openmars', label: 'OpenMARS' },
  { key: 'nomad', label: 'NOMAD' },
];

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
    overviewTimeline,
    overviewOzoneCapabilities,
    marsYear,
    leftPanelWidth,
    rightPanelWidth,
  } = useDataOverview();

  const playerWidth = `clamp(380px, calc(100vw - ${leftPanelWidth + rightPanelWidth + 180}px), 680px)`;

  const seasonName =
    globalTimeLs < 90 ? t('common.season.spring') :
    globalTimeLs < 180 ? t('common.season.summer') :
    globalTimeLs < 270 ? t('common.season.autumn') :
    t('common.season.winter');

  const onTogglePlay = () => setIsPlayingTimeline((p) => !p);
  const timelineMin = Number.isFinite(overviewTimeline?.min) ? overviewTimeline.min : 0;
  const timelineMax = Number.isFinite(overviewTimeline?.max) ? overviewTimeline.max : 360;
  const timelineStep = Number.isFinite(overviewTimeline?.step) ? overviewTimeline.step : 5;
  const timelineSpan = timelineMax > timelineMin ? timelineMax - timelineMin : 360;
  const coverage = overviewOzoneCapabilities?.coverage || {};
  const mcdSegments = buildCoverageSegments({ coverage, marsYear, source: 'mcd', min: timelineMin, max: timelineMax });
  const openmarsSegments = buildCoverageSegments({ coverage, marsYear, source: 'openmars', min: timelineMin, max: timelineMax });
  const nomadSegments = buildCoverageSegments({ coverage, marsYear, source: 'nomad', min: timelineMin, max: timelineMax });
  const visibleMcdSegments = mcdSegments.length
    ? mcdSegments
    : [{ start: timelineMin, end: timelineMax, left: 0, width: 100 }];
  const activeSources = getActiveOzoneSources({ coverage, marsYear, ls: globalTimeLs });
  const availabilityLabel = getOzoneAvailabilityLabel(activeSources, isZh);
  const thumbLeft = Math.max(0, Math.min(100, ((globalTimeLs - timelineMin) / timelineSpan) * 100));
  const hasOpenMarsAtCurrentLs = activeSources.includes('openmars');
  const hasNomadAtCurrentLs = activeSources.includes('nomad');
  const hasMultiSourceAtCurrentLs = hasOpenMarsAtCurrentLs || hasNomadAtCurrentLs;
  const statusAccent = hasOpenMarsAtCurrentLs && hasNomadAtCurrentLs
    ? `linear-gradient(135deg, ${C.blue}, ${C.green})`
    : hasNomadAtCurrentLs
      ? C.green
      : hasOpenMarsAtCurrentLs
        ? C.blue
        : C.mars;
  const colorBySource = {
    mcd: C.mars,
    openmars: C.blue,
    nomad: C.green,
  };
  const activeCoverageBySource = {
    mcd: true,
    openmars: openmarsSegments.length > 0,
    nomad: nomadSegments.length > 0,
  };

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
      <GlowCard style={{ padding: '12px 14px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onTogglePlay}
            title={isPlayingTimeline ? t('common.pause') : t('common.play')}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: isPlayingTimeline ? 'rgba(199,91,57,0.14)' : `linear-gradient(135deg, ${C.mars}, ${C.marsLight})`,
              border: `1px solid ${isPlayingTimeline ? C.mars : 'transparent'}`,
              color: isPlayingTimeline ? C.mars : '#fff',
              fontSize: 'calc(14px * var(--font-scale, 1))',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: isPlayingTimeline ? 'none' : '0 10px 24px rgba(199,91,57,0.24)',
              flexShrink: 0,
            }}
          >
            {isPlayingTimeline ? '❚❚' : '▶'}
          </button>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 12 }}>
              <div style={{ fontSize: 'calc(11px * var(--font-scale, 1))', color: C.ice50, fontWeight: 600 }}>
                {isZh ? '太阳黄经' : 'Solar longitude'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div
                  title={isZh ? '当前 Ls 可用臭氧来源' : 'Available ozone sources at current Ls'}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: hasMultiSourceAtCurrentLs
                      ? isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)'
                      : 'transparent',
                    border: `1px solid ${hasMultiSourceAtCurrentLs ? C.borderHover : C.border}`,
                    color: hasMultiSourceAtCurrentLs ? C.ice70 : C.ice40,
                    fontSize: 'calc(10px * var(--font-scale, 1))',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    boxShadow: hasMultiSourceAtCurrentLs ? '0 8px 22px rgba(0,0,0,0.14)' : 'none',
                  }}
                >
                  {availabilityLabel}
                </div>
                <div style={{ fontSize: 'calc(13px * var(--font-scale, 1))', color: C.mars, fontWeight: 700, fontFamily: 'var(--font-display)' }}>
                  {globalTimeLs}°
                </div>
              </div>
            </div>

            <div style={{ position: 'relative', height: 30 }}>
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 9,
                  height: 14,
                  borderRadius: 999,
                  overflow: 'hidden',
                  background: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${C.border}`,
                  boxShadow: 'inset 0 0 12px rgba(0,0,0,0.18)',
                  pointerEvents: 'none',
                }}
              >
                {visibleMcdSegments.map((segment, index) => (
                  <div
                    key={`mcd-${index}`}
                    style={{
                      position: 'absolute',
                      left: `${segment.left}%`,
                      top: 0,
                      width: `${segment.width}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, rgba(255,143,104,0.22), rgba(255,176,142,0.34))',
                    }}
                  />
                ))}
                {openmarsSegments.map((segment, index) => (
                  <div
                    key={`openmars-${index}`}
                    title={`OpenMARS Ls ${segment.start}-${segment.end}`}
                    style={{
                      position: 'absolute',
                      left: `${segment.left}%`,
                      top: 2,
                      width: `${segment.width}%`,
                      height: 4,
                      borderRadius: 999,
                      background: C.blue,
                      boxShadow: `0 0 10px ${C.blueGlow}`,
                    }}
                  />
                ))}
                {nomadSegments.map((segment, index) => (
                  <div
                    key={`nomad-${index}`}
                    title={`NOMAD Ls ${segment.start}-${segment.end}`}
                    style={{
                      position: 'absolute',
                      left: `${segment.left}%`,
                      bottom: 2,
                      width: `${segment.width}%`,
                      height: 4,
                      borderRadius: 999,
                      background: C.green,
                      boxShadow: '0 0 10px rgba(99,232,191,0.34)',
                    }}
                  />
                ))}
                <div
                  style={{
                    position: 'absolute',
                    left: `${thumbLeft}%`,
                    top: -1,
                    width: 2,
                    height: 16,
                    transform: 'translateX(-50%)',
                    borderRadius: 999,
                    background: statusAccent,
                    boxShadow: '0 0 12px rgba(255,255,255,0.25)',
                  }}
                />
              </div>
              <input
                className="coverage-range-input"
                type="range"
                min={timelineMin}
                max={timelineMax}
                step={timelineStep}
                value={globalTimeLs}
                aria-label={isZh ? '太阳黄经时间轴' : 'Solar longitude timeline'}
                onChange={(e) => setGlobalTimeLs(Number(e.target.value))}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  margin: 0,
                  accentColor: C.mars,
                  cursor: 'pointer',
                  background: 'transparent',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              {SOURCE_LEGEND.map((item) => (
                <div
                  key={item.key}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    color: activeCoverageBySource[item.key] ? C.ice50 : C.ice30,
                    fontSize: 'calc(10px * var(--font-scale, 1))',
                    fontWeight: 700,
                    opacity: activeCoverageBySource[item.key] ? 1 : 0.48,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: colorBySource[item.key],
                      boxShadow: activeCoverageBySource[item.key] ? `0 0 8px ${colorBySource[item.key]}` : 'none',
                    }}
                  />
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setGlobalTimeLs(timelineMin)}
            title={isZh ? '重置 Ls' : 'Reset Ls'}
            style={{
              background: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${C.border}`,
              borderRadius: 999,
              minWidth: 58,
              height: 32,
              color: C.ice60,
              fontSize: 'calc(11px * var(--font-scale, 1))',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isZh ? '重置' : 'Reset'}
          </button>

          <div
            style={{
              padding: '6px 10px',
              borderRadius: 999,
              border: `1px solid ${C.border}`,
              background: C.bgMuted,
              color: C.ice60,
              fontSize: 'calc(11px * var(--font-scale, 1))',
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
