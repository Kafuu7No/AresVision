import React from 'react';
import C from '../../constants/colors';
import { useDataOverview } from '../../contexts/DataOverviewContext';
import { useSettings } from '../../contexts/SettingsContext';
import { GLOBE_VARIABLE_OPTIONS } from '../../constants/globeVariables';

const NAVBAR_HEIGHT = 70;

export const MODE_DEFS = [
  {
    id: 'temporal',
    icon: 'T',
    color: C.mars,
    title: { zh: '时序气候演化', en: 'Temporal Evolution' },
    desc: { zh: '适合看昼夜变化、季节推进与长期趋势。', en: 'Best for diurnal change, seasonal progression, and long-term trends.' },
  },
  {
    id: 'drivers',
    icon: 'D',
    color: '#4acfac',
    title: { zh: '环境归因与驱动', en: 'Environmental Drivers' },
    desc: { zh: '适合看多变量关系、环境因子和太阳辐照响应。', en: 'Best for multivariate relationships, environmental factors, and solar response.' },
  },
  {
    id: 'dynamics',
    icon: 'R',
    color: '#ffd700',
    title: { zh: '动力与区域变率', en: 'Regional Dynamics' },
    desc: { zh: '适合看极区行为、波动结构和区域异常。', en: 'Best for polar behavior, wave structures, and regional anomalies.' },
  },
];

function SectionLabel({ children, color = C.ice30 }) {
  return (
    <div
      style={{
        color,
        fontSize: 'calc(10px * var(--font-scale, 1))',
        fontFamily: "'Orbitron', sans-serif",
        letterSpacing: 1.2,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function SelectField({ label, value, onChange, options, disabled = false, isLight = false }) {
  const selectBg = isLight
    ? 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(240,244,255,0.88))'
    : 'linear-gradient(180deg, rgba(19,26,38,0.88), rgba(9,14,24,0.92))';
  const selectBorder = isLight ? 'rgba(74,158,255,0.18)' : 'rgba(74,158,255,0.22)';
  const selectText = isLight ? '#0f172a' : C.ice;
  const caretColor = isLight ? '#3b82f6' : C.blue;

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ color: C.ice60, fontSize: 'calc(11px * var(--font-scale, 1))', fontFamily: "'Exo 2', sans-serif" }}>{label}</span>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '11px 40px 11px 12px',
            borderRadius: 12,
            border: `1px solid ${selectBorder}`,
            background: selectBg,
            boxShadow: isLight
              ? 'inset 0 1px 0 rgba(255,255,255,0.75), 0 8px 18px rgba(74,158,255,0.08)'
              : 'inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 20px rgba(0,0,0,0.18)',
            color: selectText,
            fontSize: 'calc(12px * var(--font-scale, 1))',
            fontFamily: "'Exo 2', sans-serif",
            fontWeight: 600,
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.72 : 1,
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
          }}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              style={{
                color: '#e5eefc',
                background: '#0f172a',
                fontFamily: "'Exo 2', sans-serif",
              }}
            >
              {option.label}
            </option>
          ))}
        </select>
        <span
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: caretColor,
            fontSize: 'calc(10px * var(--font-scale, 1))',
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: 1,
            opacity: disabled ? 0.5 : 0.9,
          }}
        >
          V
        </span>
      </div>
    </label>
  );
}

function SegmentedToggle({ value, onChange, options, isLight = false }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        gap: 6,
        padding: 4,
        borderRadius: 12,
        background: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            style={{
              border: 'none',
              borderRadius: 9,
              padding: '9px 10px',
              background: active ? option.activeBg : 'transparent',
              color: active ? option.activeColor : C.ice60,
              fontSize: 'calc(11px * var(--font-scale, 1))',
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
              fontFamily: "'Exo 2', sans-serif",
              transition: 'all 0.2s ease',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function RadioModeCard({ mode, selected, onSelect, isZh, isLight }) {
  return (
    <label
      style={{
        display: 'grid',
        gridTemplateColumns: '18px minmax(0, 1fr)',
        gap: 10,
        alignItems: 'start',
        padding: '12px 12px 12px 10px',
        borderRadius: 12,
        border: `1px solid ${selected ? `${mode.color}55` : isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.07)'}`,
        background: selected
          ? (isLight ? `${mode.color}10` : 'rgba(255,255,255,0.05)')
          : (isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.02)'),
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      <input
        type="radio"
        name="overview-mode"
        checked={selected}
        onChange={() => onSelect(mode.id)}
        style={{ marginTop: 2, accentColor: mode.color }}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 999,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: selected ? `${mode.color}20` : (isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.05)'),
              color: selected ? mode.color : C.ice40,
              fontSize: 'calc(11px * var(--font-scale, 1))',
              fontWeight: 700,
              fontFamily: "'Orbitron', sans-serif",
              flexShrink: 0,
            }}
          >
            {mode.icon}
          </span>
          <div
            style={{
              color: selected ? mode.color : C.ice,
              fontSize: 'calc(12px * var(--font-scale, 1))',
              fontWeight: 700,
              fontFamily: "'Exo 2', sans-serif",
              lineHeight: 1.35,
            }}
          >
            {isZh ? mode.title.zh : mode.title.en}
          </div>
        </div>
        <div style={{ color: selected ? C.ice70 : C.ice40, fontSize: 'calc(10px * var(--font-scale, 1))', lineHeight: 1.55 }}>
          {isZh ? mode.desc.zh : mode.desc.en}
        </div>
      </div>
    </label>
  );
}

function InlineSwitch({ label, checked, onChange, accent = C.blue, isLight = false }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 10,
        border: `1px solid ${isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.07)'}`,
        background: isLight ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.03)',
        cursor: 'pointer',
      }}
    >
      <span style={{ color: C.ice, fontSize: 'calc(11px * var(--font-scale, 1))', fontFamily: "'Exo 2', sans-serif", lineHeight: 1.45 }}>{label}</span>
      <span style={{ position: 'relative', width: 34, height: 18, flexShrink: 0 }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          style={{ opacity: 0, width: 0, height: 0 }}
        />
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: checked ? `${accent}33` : (isLight ? 'rgba(15,23,42,0.16)' : 'rgba(255,255,255,0.10)'),
            border: `1px solid ${checked ? accent : isLight ? 'rgba(15,23,42,0.14)' : 'rgba(255,255,255,0.10)'}`,
            transition: 'all 0.2s ease',
          }}
        />
        <span
          style={{
            position: 'absolute',
            width: 12,
            height: 12,
            left: checked ? 18 : 3,
            top: 3,
            borderRadius: '50%',
            background: checked ? accent : (isLight ? 'rgba(15,23,42,0.48)' : 'rgba(255,255,255,0.55)'),
            transition: 'all 0.2s ease',
          }}
        />
      </span>
    </label>
  );
}

function AdvancedToggleGroup({ title, children, open, onToggle, isLight = false }) {
  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.08)'}`,
        background: isLight ? 'rgba(255,255,255,0.58)' : 'rgba(255,255,255,0.03)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 14px',
          border: 'none',
          background: 'transparent',
          color: C.ice,
          cursor: 'pointer',
          fontSize: 'calc(12px * var(--font-scale, 1))',
          fontWeight: 700,
          fontFamily: "'Exo 2', sans-serif",
          textAlign: 'left',
        }}
      >
        <span>{title}</span>
        <span style={{ color: C.ice40, fontSize: 'calc(12px * var(--font-scale, 1))' }}>{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div style={{ display: 'grid', gap: 8, padding: '0 12px 12px' }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function SidebarMenu() {
  const { settings } = useSettings();
  const isLight = settings?.theme === 'light';
  const isZh = settings?.language !== 'en';
  const {
    activeAnalysisMode,
    setActiveAnalysisMode,
    marsYear,
    setMarsYear,
    availableMarsYears,
    dataSourceMode,
    setDataSourceMode,
    isSwitchingSource,
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

  const [displayOpen, setDisplayOpen] = React.useState(true);
  const [interactionOpen, setInteractionOpen] = React.useState(false);
  const panelBg = isLight ? 'rgba(255,255,255,0.80)' : 'rgba(10,12,18,0.46)';
  const borderSoft = isLight ? 'rgba(15,23,42,0.14)' : 'rgba(255,255,255,0.08)';
  const contentGap = leftPanelWidth <= 300 ? 14 : 16;
  const isPersonalMode = dataSourceMode === 'personal';

  const sourceMessage = React.useMemo(() => {
    const rawMessage = sourceMeta?.message;
    if (!rawMessage) return '';
    if (isZh) return rawMessage;

    if (/[a-zA-Z]/.test(rawMessage) && !/[\u4e00-\u9fff]/.test(rawMessage)) {
      return rawMessage;
    }

    const yearFallbackMatch = rawMessage.match(/MY\s*(\d+)\s*不可用.*?MY\s*(\d+)/i);
    if (yearFallbackMatch) {
      const [, fromYear, toYear] = yearFallbackMatch;
      return `MY${fromYear} is unavailable. Switched to system source MY${toYear}.`;
    }
    if (rawMessage.includes('未登录')) return 'Not signed in. Switched to the system default data source.';
    if (rawMessage.includes('个人 OpenMARS 不足完整一年')) return 'Personal OpenMARS is incomplete. Using system OpenMARS + personal MCD.';
    if (rawMessage.includes('个人数据源不足')) return 'Personal data source is insufficient. Switched to the system default data source.';
    return rawMessage;
  }, [isZh, sourceMeta]);

  const globeVariableOptions = React.useMemo(
    () => GLOBE_VARIABLE_OPTIONS.map((option) => ({ value: option.id, label: isZh ? option.zh : option.en })),
    [isZh],
  );

  const yearOptions = React.useMemo(
    () => availableMarsYears.map((year) => ({ value: String(year), label: `MY ${year}` })),
    [availableMarsYears],
  );

  const handleMouseDown = React.useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftPanelWidth;

    const onMouseMove = (moveEvent) => {
      const newWidth = startWidth + (moveEvent.clientX - startX);
      setLeftPanelWidth(Math.max(272, Math.min(newWidth, 420)));
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
        background: panelBg,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: `1px solid ${borderSoft}`,
        zIndex: 1000,
        padding: leftPanelWidth <= 300 ? '20px 14px' : '24px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ paddingBottom: 14, borderBottom: `1px solid ${borderSoft}`, flexShrink: 0 }}>
        <div style={{ color: C.ice, fontFamily: "'Orbitron', sans-serif", fontSize: leftPanelWidth <= 300 ? 14 : 16, fontWeight: 700, letterSpacing: 1.6, marginBottom: 6 }}>
          {isZh ? '分析控制台' : 'Analysis Console'}
        </div>
        <div style={{ color: C.ice50, fontSize: 'calc(11px * var(--font-scale, 1))', lineHeight: 1.55 }}>
          {isZh ? '先选分析视角，再调整数据与显示参数。' : 'Pick an analysis lens first, then tune dataset and display settings.'}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: contentGap,
          paddingRight: 4,
          scrollbarGutter: 'stable',
        }}
      >
        <section>
          <SectionLabel>{isZh ? '分析模式' : 'ANALYSIS MODE'}</SectionLabel>
          <div style={{ display: 'grid', gap: 8 }}>
            {MODE_DEFS.map((mode) => (
              <RadioModeCard
                key={mode.id}
                mode={mode}
                selected={activeAnalysisMode === mode.id}
                onSelect={setActiveAnalysisMode}
                isZh={isZh}
                isLight={isLight}
              />
            ))}
          </div>
        </section>

        <section>
          <SectionLabel>{isZh ? '数据范围' : 'DATA SCOPE'}</SectionLabel>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <div style={{ color: C.ice60, fontSize: 'calc(11px * var(--font-scale, 1))', fontFamily: "'Exo 2', sans-serif", marginBottom: 8 }}>
                {isZh ? '数据源' : 'Data Source'}
              </div>
              <SegmentedToggle
                value={dataSourceMode}
                onChange={setDataSourceMode}
                isLight={isLight}
                options={[
                  {
                    value: 'default',
                    label: isZh ? '默认' : 'Default',
                    activeBg: 'rgba(74,158,255,0.14)',
                    activeColor: C.blue,
                  },
                  {
                    value: 'personal',
                    label: isZh ? '个人' : 'Personal',
                    activeBg: 'rgba(74,158,255,0.14)',
                    activeColor: C.blue,
                  },
                ]}
              />
              {isSwitchingSource ? (
                <div style={{ marginTop: 8, color: C.ice50, fontSize: 'calc(10px * var(--font-scale, 1))', lineHeight: 1.5 }}>
                  {isZh ? '正在切换数据源，请稍候...' : 'Switching data source, please wait...'}
                </div>
              ) : null}
              {!isSwitchingSource && sourceMessage ? (
                <div style={{ marginTop: 8, color: isPersonalMode ? C.blue : C.ice50, fontSize: 'calc(10px * var(--font-scale, 1))', lineHeight: 1.55 }}>
                  {sourceMessage}
                </div>
              ) : null}
            </div>

            <SelectField
              label={isZh ? '火星年' : 'Mars Year'}
              value={String(marsYear)}
              onChange={(value) => setMarsYear(Number(value))}
              options={yearOptions}
              disabled={isSwitchingSource}
              isLight={isLight}
            />

            <SelectField
              label={isZh ? '球体主变量' : 'Globe Variable'}
              value={globeVariable}
              onChange={setGlobeVariable}
              options={globeVariableOptions}
              isLight={isLight}
            />
          </div>
        </section>

        <section>
          <SectionLabel>{isZh ? '显示控制' : 'DISPLAY CONTROLS'}</SectionLabel>
          <AdvancedToggleGroup
            title={isZh ? '球体显示图层与外观' : 'Globe layers and visual appearance'}
            open={displayOpen}
            onToggle={() => setDisplayOpen((value) => !value)}
            isLight={isLight}
          >
            <InlineSwitch
              label={isZh ? '显示 3D 浓度体' : 'Show 3D concentration'}
              checked={showConcentration3D}
              onChange={() => setShowConcentration3D((value) => !value)}
              accent={C.blue}
              isLight={isLight}
            />
            <InlineSwitch
              label={isZh ? '显示经纬度标注' : 'Show latitude and longitude labels'}
              checked={showGeoAnnotations}
              onChange={() => setShowGeoAnnotations((value) => !value)}
              accent={C.blue}
              isLight={isLight}
            />
            <InlineSwitch
              label={isZh ? '显示火星贴图' : 'Show Mars texture'}
              checked={showMarsTexture}
              onChange={() => setShowMarsTexture((value) => !value)}
              accent={C.blue}
              isLight={isLight}
            />
          </AdvancedToggleGroup>
        </section>

        <section>
          <SectionLabel>{isZh ? '动态交互' : 'INTERACTION CONTROLS'}</SectionLabel>
          <AdvancedToggleGroup
            title={isZh ? '球体运动与交互方式' : 'Globe motion and interaction behavior'}
            open={interactionOpen}
            onToggle={() => setInteractionOpen((value) => !value)}
            isLight={isLight}
          >
            <InlineSwitch
              label={isZh ? '自动旋转球体' : 'Auto-rotate globe'}
              checked={autoRotate}
              onChange={() => setAutoRotate((value) => !value)}
              accent={C.blue}
              isLight={isLight}
            />
            <InlineSwitch
              label={isZh ? '启用手势控制' : 'Enable gesture control'}
              checked={gestureEnabled}
              onChange={() => setGestureEnabled((value) => !value)}
              accent={C.mars}
              isLight={isLight}
            />
          </AdvancedToggleGroup>
        </section>
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
