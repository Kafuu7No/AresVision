import React from 'react';
import C from '../../constants/colors';
import { useDataOverview } from '../../contexts/DataOverviewContext';
import { useSettings } from '../../contexts/SettingsContext';
import { GLOBE_VARIABLE_OPTIONS } from '../../constants/globeVariables';

const NAVBAR_HEIGHT = 70;

export const MODE_DEFS = [
  {
    id: 'temporal',
    icon: '⏱',
    color: C.mars,
    title: { zh: '时序气候演化', en: 'Temporal Evolution' },
    desc: { zh: '专注分析随时间维度（小时、季节）的自然演化。', en: 'Analyze natural evolution across time (hourly and seasonal).' },
  },
  {
    id: 'drivers',
    icon: '🧭',
    color: '#4acfac',
    title: { zh: '环境归因与驱动', en: 'Environmental Drivers' },
    desc: { zh: '多变量回归与纬向归因，挖掘主导因子。', en: 'Use multivariate regression and latitudinal attribution to identify dominant factors.' },
  },
  {
    id: 'dynamics',
    icon: '🌀',
    color: '#ffd700',
    title: { zh: '动力与区域变率', en: 'Dynamics & Regional Variability' },
    desc: { zh: '关注地形阻挡或沙尘暴等强迫导致的异常。', en: 'Focus on anomalies caused by topography blocking and dust-storm forcing.' },
  },
];

export default function SidebarMenu() {
  const { settings } = useSettings();
  const isZh = settings?.language !== 'en';
  const {
    activeAnalysisMode,
    setActiveAnalysisMode,
    marsYear,
    setMarsYear,
    availableMarsYears,
    dataSourceMode,
    setDataSourceMode,
    sourceMeta,
    autoRotate,
    setAutoRotate,
    gestureEnabled,
    setGestureEnabled,
    showConcentration3D,
    setShowConcentration3D,
    showGeoAnnotations,
    setShowGeoAnnotations,
    showMarsTexture,
    setShowMarsTexture,
    globeVariable,
    setGlobeVariable,
    leftPanelWidth,
    setLeftPanelWidth,
  } = useDataOverview();
  const isCompact = leftPanelWidth <= 300;
  const VISIBLE_GLOBE_OPTION_COUNT = 4;
  const globeOptionColumns = leftPanelWidth >= 340 ? 2 : 1;
  const globeOptionRowsInView = Math.ceil(VISIBLE_GLOBE_OPTION_COUNT / globeOptionColumns);
  const globeOptionGap = 6;
  const globeOptionHeight = isCompact ? 34 : (globeOptionColumns === 2 ? 52 : 36);
  const globeOptionWindowHeight =
    globeOptionRowsInView * globeOptionHeight +
    (globeOptionRowsInView - 1) * globeOptionGap +
    4;

  const globeVariableOptions = GLOBE_VARIABLE_OPTIONS.map((option) => ({
    ...option,
    label: isZh ? option.zh : option.en,
  }));
  const isPersonalMode = dataSourceMode === 'personal';
  const sourceMessage = sourceMeta?.message || '';

  const handleMouseDown = React.useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftPanelWidth;

    const onMouseMove = (moveEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      setLeftPanelWidth(Math.max(240, Math.min(newWidth, 450)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [leftPanelWidth, setLeftPanelWidth]);

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: `${NAVBAR_HEIGHT}px`,
        width: leftPanelWidth,
        height: `calc(100vh - ${NAVBAR_HEIGHT}px)`,
        background: 'rgba(10, 12, 18, 0.4)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        zIndex: 1000,
        padding: isCompact ? '22px 12px' : '32px 20px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ paddingBottom: isCompact ? 16 : 24, marginBottom: isCompact ? 16 : 24, borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <h2
          style={{
            color: C.ice,
            fontFamily: "'Orbitron', sans-serif",
            fontSize: isCompact ? 14 : 16,
            fontWeight: 'bold',
            margin: '0 0 8px 0',
            letterSpacing: isCompact ? 1.4 : 3,
            textAlign: 'center',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
          }}
        >
          {isZh ? '鍒嗘瀽妯″紡' : 'EXPLORATION MODE'}
        </h2>
        <div style={{ color: C.ice60, fontSize: isCompact ? 9 : 10, textAlign: 'center', fontFamily: "'Exo 2', sans-serif" }}>
          {isZh ? '閫夋嫨涓嬮捇鍒嗘瀽瑙嗙晫' : 'Select analysis perspective'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: isCompact ? 8 : 12, flex: 1, overflowY: 'auto' }}>
        {MODE_DEFS.map((mode) => {
          const isSelected = activeAnalysisMode === mode.id;
          return (
            <div
              key={mode.id}
              onClick={() => setActiveAnalysisMode(mode.id)}
              style={{
                display: 'flex',
                alignItems: isCompact ? 'flex-start' : 'center',
                gap: isCompact ? 10 : 16,
                padding: isCompact ? 12 : 16,
                borderRadius: 12,
                background: isSelected ? 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.01))' : 'transparent',
                border: `1px solid ${isSelected ? `${mode.color}40` : 'rgba(255,255,255,0.02)'}`,
                boxShadow: isSelected ? `inset 0 0 20px ${mode.color}10, 0 4px 12px rgba(0,0,0,0.2)` : 'none',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
            >
              {isSelected && (
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: mode.color, boxShadow: `0 0 10px ${mode.color}` }} />
              )}

              <div style={{ fontSize: isCompact ? 20 : 24, filter: isSelected ? `drop-shadow(0 0 10px ${mode.color})` : 'grayscale(60%) opacity(60%)', pointerEvents: 'none', lineHeight: 1 }}>
                {mode.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0, pointerEvents: 'none' }}>
                <div
                  style={{
                    color: isSelected ? mode.color : C.ice,
                    fontSize: isCompact ? 12 : 13,
                    fontWeight: 'bold',
                    fontFamily: "'Orbitron', sans-serif",
                    marginBottom: 6,
                    letterSpacing: isCompact ? 0.4 : 1,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                  title={isZh ? mode.title.zh : mode.title.en}
                >
                  {isZh ? mode.title.zh : mode.title.en}
                </div>
                <div
                  style={{
                    color: isSelected ? C.ice80 : C.ice40,
                    fontSize: isCompact ? 10 : 11,
                    fontFamily: "'Exo 2', sans-serif",
                    lineHeight: 1.45,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                  title={isZh ? mode.desc.zh : mode.desc.en}
                >
                  {isZh ? mode.desc.zh : mode.desc.en}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: isCompact ? 16 : 24, paddingTop: isCompact ? 16 : 24, borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ color: C.ice60, fontSize: 10, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1, marginBottom: 16 }}>
          {isZh ? '绯荤粺鎺у埗' : 'SYSTEM CONTROLS'}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: C.ice30, marginBottom: 8, fontFamily: "'Exo 2', sans-serif", lineHeight: 1.3 }}>
            {isZh ? '数据源切换' : 'DATA SOURCE'}
          </div>
          <button
            onClick={() => setDataSourceMode(isPersonalMode ? 'default' : 'personal')}
            style={{
              width: '100%',
              border: `1px solid ${isPersonalMode ? C.blue : C.mars}`,
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 999,
              padding: '4px 6px',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                position: 'relative',
                height: 26,
                borderRadius: 999,
                background: isPersonalMode ? 'rgba(74,158,255,0.18)' : 'rgba(199,91,57,0.18)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 1,
                  left: isPersonalMode ? 'calc(50% + 1px)' : 1,
                  width: 'calc(50% - 2px)',
                  height: 24,
                  borderRadius: 999,
                  background: isPersonalMode ? 'rgba(74,158,255,0.35)' : 'rgba(199,91,57,0.35)',
                  border: `1px solid ${isPersonalMode ? C.blue : C.mars}`,
                  transition: 'left 0.25s ease',
                }}
              />
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  height: '100%',
                  alignItems: 'center',
                  fontFamily: "'Orbitron', sans-serif",
                  fontSize: 10,
                  letterSpacing: 0.4,
                }}
              >
                <span style={{ color: !isPersonalMode ? C.mars : C.ice60, fontWeight: !isPersonalMode ? 700 : 500 }}>
                  {isZh ? '榛樿' : 'Default'}
                </span>
                <span style={{ color: isPersonalMode ? C.blue : C.ice60, fontWeight: isPersonalMode ? 700 : 500 }}>
                  {isZh ? '涓汉' : 'Personal'}
                </span>
              </div>
            </div>
          </button>
          {sourceMessage ? (
            <div style={{ marginTop: 8, color: C.ice60, fontSize: 10, lineHeight: 1.5 }}>
              {sourceMessage}
            </div>
          ) : null}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: C.ice30, marginBottom: 8, fontFamily: "'Exo 2', sans-serif", lineHeight: 1.3 }}>
            {isZh ? '鐏槦骞达紙鏁版嵁闆嗭級' : 'MARS YEAR (Dataset)'}
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              overflowY: 'hidden',
              paddingBottom: 4,
              scrollSnapType: 'x proximity',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
            }}
          >
            {availableMarsYears.map((y) => (
              <button
                key={y}
                onClick={() => setMarsYear(y)}
                style={{
                  flex: '0 0 auto',
                  minWidth: isCompact ? 64 : 72,
                  padding: '8px 0',
                  background: marsYear === y ? 'rgba(199,91,57,0.2)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${marsYear === y ? C.mars : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 8,
                  color: marsYear === y ? C.mars : C.ice60,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Orbitron', sans-serif",
                  transition: 'all 0.2s',
                  scrollSnapAlign: 'start',
                }}
              >
                MY{y}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: C.ice30, marginBottom: 8, fontFamily: "'Exo 2', sans-serif", lineHeight: 1.3 }}>
            {isZh ? '3D球体变量' : '3D GLOBE VARIABLE'}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${globeOptionColumns}, minmax(0, 1fr))`,
              gap: globeOptionGap,
              maxHeight: globeOptionWindowHeight,
              alignContent: 'start',
              overflowY: globeVariableOptions.length > VISIBLE_GLOBE_OPTION_COUNT ? 'auto' : 'hidden',
              overflowX: 'hidden',
              paddingRight: globeVariableOptions.length > VISIBLE_GLOBE_OPTION_COUNT ? 4 : 0,
              scrollbarGutter: 'stable',
            }}
          >
            {globeVariableOptions.map((option) => {
              const isActive = globeVariable === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => setGlobeVariable(option.id)}
                  style={{
                    padding: '8px 10px',
                    minHeight: globeOptionHeight,
                    background: isActive ? 'rgba(74,158,255,0.2)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isActive ? C.blue : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 8,
                    color: isActive ? C.blue : C.ice60,
                    fontSize: 10,
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    fontFamily: "'Exo 2', sans-serif",
                    lineHeight: 1.35,
                    minWidth: 0,
                    width: '100%',
                    textAlign: 'left',
                    display: '-webkit-box',
                    WebkitLineClamp: globeOptionColumns === 2 ? 2 : 1,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                  title={option.label}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: C.ice30, marginBottom: 8, fontFamily: "'Exo 2', sans-serif", lineHeight: 1.3 }}>
            {isZh ? '3D显示选项' : '3D DISPLAY OPTIONS'}
          </div>
          <div
            style={{
              display: 'grid',
              gap: 8,
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, cursor: 'pointer' }} title={isZh ? '3D数据浓度显示开关' : '3D Concentration Display'}>
              <input
                type="checkbox"
                checked={showConcentration3D}
                onChange={() => setShowConcentration3D((v) => !v)}
                style={{ accentColor: C.blue, cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{ color: C.ice, fontSize: 11, fontFamily: "'Exo 2', sans-serif", minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isZh ? '3D鏁版嵁娴撳害灞曠ず' : '3D Concentration Display'}
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, cursor: 'pointer' }} title={isZh ? '经纬度标注开关' : 'Latitude/Longitude Labels'}>
              <input
                type="checkbox"
                checked={showGeoAnnotations}
                onChange={() => setShowGeoAnnotations((v) => !v)}
                style={{ accentColor: C.blue, cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{ color: C.ice, fontSize: 11, fontFamily: "'Exo 2', sans-serif", minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isZh ? '经纬度标注' : 'Lat/Lon Labels'}
              </span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, cursor: 'pointer' }} title={isZh ? '火星贴图显示开关' : 'Mars Texture'}>
              <input
                type="checkbox"
                checked={showMarsTexture}
                onChange={() => setShowMarsTexture((v) => !v)}
                style={{ accentColor: C.blue, cursor: 'pointer', flexShrink: 0 }}
              />
              <span style={{ color: C.ice, fontSize: 11, fontFamily: "'Exo 2', sans-serif", minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {isZh ? '鐏槦璐村浘' : 'Mars Texture'}
              </span>
            </label>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 14 }}>馃攣</span>
            <span style={{ color: C.ice, fontSize: 11, fontFamily: "'Exo 2', sans-serif", minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={isZh ? '鐞冧綋鑷姩鏃嬭浆' : 'GLOBE AUTO-ROTATE'}>
              {isZh ? '鐞冧綋鑷姩鏃嬭浆' : 'GLOBE AUTO-ROTATE'}
            </span>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: 32, height: 18 }}>
            <input type="checkbox" checked={autoRotate} onChange={() => setAutoRotate((r) => !r)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span
              style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: autoRotate ? 'rgba(74,158,255,0.3)' : 'rgba(255,255,255,0.1)',
                border: `1px solid ${autoRotate ? C.blue : 'rgba(255,255,255,0.2)'}`,
                transition: '.4s',
                borderRadius: 34,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  height: 12,
                  width: 12,
                  left: autoRotate ? 16 : 2,
                  bottom: 2,
                  backgroundColor: autoRotate ? C.blue : 'rgba(255,255,255,0.5)',
                  transition: '.4s',
                  borderRadius: '50%',
                }}
              />
            </span>
          </label>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 14 }}>✋</span>
            <span style={{ color: C.mars, fontSize: 11, fontFamily: "'Exo 2', sans-serif", fontWeight: 'bold', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={isZh ? '鎵嬪娍鎺у埗' : 'GESTURE CONTROL'}>
              {isZh ? '鎵嬪娍鎺у埗' : 'GESTURE CONTROL'}
            </span>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: 32, height: 18 }}>
            <input type="checkbox" checked={gestureEnabled} onChange={() => setGestureEnabled((g) => !g)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span
              style={{
                position: 'absolute',
                cursor: 'pointer',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: gestureEnabled ? 'rgba(199,91,57,0.3)' : 'rgba(255,255,255,0.1)',
                border: `1px solid ${gestureEnabled ? C.mars : 'rgba(255,255,255,0.2)'}`,
                transition: '.4s',
                borderRadius: 34,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  height: 12,
                  width: 12,
                  left: gestureEnabled ? 16 : 2,
                  bottom: 2,
                  backgroundColor: gestureEnabled ? C.mars : 'rgba(255,255,255,0.5)',
                  transition: '.4s',
                  borderRadius: '50%',
                }}
              />
            </span>
          </label>
        </div>
      </div>

      <div
        onMouseDown={handleMouseDown}
        style={{
          position: 'absolute',
          right: -3,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'col-resize',
          zIndex: 10,
          background: 'transparent',
        }}
      />
    </div>
  );
}


