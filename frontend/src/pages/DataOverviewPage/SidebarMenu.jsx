import React from 'react';
import C from '../../constants/colors';
import { useDataOverview } from '../../contexts/DataOverviewContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { GLOBE_VARIABLE_OPTIONS } from '../../constants/globeVariables';
import {
  getPersonalSourceAvailability,
  getPersonalSourceBlockedMessage,
  getPersonalSourceCheckFailedMessage,
  getPersonalSourceLoginRequiredMessage,
} from '../../utils/personalSourceGuard';

const NAVBAR_HEIGHT = 70;

export const MODE_DEFS = [
  {
    id: 'temporal',
    icon: 'T',
    color: C.mars,
    title: { zh: '时序气候演化', en: 'Temporal evolution' },
    desc: { zh: '适合观察昼夜变化、季节推进与长期趋势。', en: 'Best for diurnal change, seasonal progression, and long-term trends.' },
  },
  {
    id: 'drivers',
    icon: 'D',
    color: C.green,
    title: { zh: '环境归因与驱动', en: 'Environmental drivers' },
    desc: { zh: '适合查看多变量关系、环境因子和太阳响应。', en: 'Best for multivariate relationships, environmental factors, and solar response.' },
  },
  {
    id: 'dynamics',
    icon: 'R',
    color: '#d9a441',
    title: { zh: '区域动力过程', en: 'Regional dynamics' },
    desc: { zh: '适合分析极区活动、波动结构和区域异常。', en: 'Best for polar behavior, wave structures, and regional anomalies.' },
  },
];

function SectionLabel({ children }) {
  return (
    <div
      style={{
        color: C.ice50,
        fontSize: 'calc(10px * var(--font-scale, 1))',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function SelectField({ label, value, onChange, options, disabled = false, isLight = false }) {
  const optionBg = isLight ? '#ffffff' : '#111827';
  const optionColor = isLight ? '#17212f' : '#f5f7fb';

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ color: C.ice60, fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 600 }}>{label}</span>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{
            width: '100%',
            padding: '11px 40px 11px 12px',
            borderRadius: 12,
            border: `1px solid ${C.borderStrong}`,
            background: isLight ? 'rgba(255,255,255,0.94)' : C.bgCardStrong,
            color: C.ice,
            fontSize: 'calc(12px * var(--font-scale, 1))',
            fontWeight: 600,
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.72 : 1,
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            boxShadow: isLight ? '0 8px 18px rgba(15,23,42,0.05)' : '0 10px 20px rgba(0,0,0,0.16)',
          }}
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              style={{ color: optionColor, background: optionBg }}
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
            color: C.ice40,
            fontSize: 'calc(14px * var(--font-scale, 1))',
            lineHeight: 1,
          }}
        >
          ▾
        </span>
      </div>
    </label>
  );
}

function SegmentedToggle({ value, onChange, options, disabled = false, isLight = false }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        gap: 6,
        padding: 4,
        borderRadius: 12,
        background: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      {options.map((option) => {
        const active = value === option.value;
        const optionDisabled = disabled || option.disabled;
        return (
          <button
            key={option.value}
            onClick={() => !optionDisabled && onChange(option.value)}
            disabled={optionDisabled}
            style={{
              border: 'none',
              borderRadius: 10,
              padding: '9px 10px',
              background: active ? option.activeBg : 'transparent',
              color: active ? option.activeColor : C.ice60,
              fontSize: 'calc(11px * var(--font-scale, 1))',
              fontWeight: active ? 700 : 600,
              cursor: optionDisabled ? 'not-allowed' : 'pointer',
              opacity: optionDisabled ? 0.5 : 1,
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
        gridTemplateColumns: '20px minmax(0, 1fr)',
        gap: 10,
        alignItems: 'start',
        padding: '13px 12px',
        borderRadius: 14,
        border: `1px solid ${selected ? `${mode.color}55` : isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.08)'}`,
        background: selected
          ? (isLight ? `${mode.color}10` : 'rgba(255,255,255,0.05)')
          : (isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.02)'),
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      <input
        type="radio"
        name="overview-mode"
        checked={selected}
        onChange={() => onSelect(mode.id)}
        style={{ marginTop: 3, accentColor: mode.color }}
      />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: selected ? `${mode.color}1a` : C.bgMuted,
              color: selected ? mode.color : C.ice40,
              fontSize: 'calc(11px * var(--font-scale, 1))',
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {mode.icon}
          </span>
          <div
            style={{
              color: selected ? mode.color : C.ice,
              fontSize: 'calc(13px * var(--font-scale, 1))',
              fontWeight: 700,
              fontFamily: 'var(--font-display)',
              lineHeight: 1.35,
              letterSpacing: '-0.01em',
            }}
          >
            {isZh ? mode.title.zh : mode.title.en}
          </div>
        </div>
        <div style={{ color: selected ? C.ice70 : C.ice40, fontSize: 'calc(11px * var(--font-scale, 1))', lineHeight: 1.55 }}>
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
        padding: '11px 12px',
        borderRadius: 12,
        border: `1px solid ${isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.07)'}`,
        background: isLight ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.03)',
        cursor: 'pointer',
      }}
    >
      <span style={{ color: C.ice, fontSize: 'calc(12px * var(--font-scale, 1))', lineHeight: 1.45 }}>{label}</span>
      <span style={{ position: 'relative', width: 36, height: 20, flexShrink: 0 }}>
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
            background: checked ? `${accent}33` : (isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.10)'),
            border: `1px solid ${checked ? accent : isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.10)'}`,
            transition: 'all 0.2s ease',
          }}
        />
        <span
          style={{
            position: 'absolute',
            width: 14,
            height: 14,
            left: checked ? 18 : 3,
            top: 3,
            borderRadius: '50%',
            background: checked ? accent : (isLight ? 'rgba(15,23,42,0.45)' : 'rgba(255,255,255,0.60)'),
            transition: 'all 0.2s ease',
          }}
        />
      </span>
    </label>
  );
}

function AdvancedToggleGroup({ title, open, onToggle, children, isLight = false, isZh = false }) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)'}`,
        background: isLight ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.03)',
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
          padding: '13px 14px',
          border: 'none',
          background: 'transparent',
          color: C.ice,
          cursor: 'pointer',
          fontSize: 'calc(12px * var(--font-scale, 1))',
          fontWeight: 700,
          textAlign: 'left',
        }}
      >
        <span>{title}</span>
        <span style={{ color: C.ice40, fontSize: 'calc(11px * var(--font-scale, 1))' }}>
          {open ? (isZh ? '收起' : 'Hide') : (isZh ? '展开' : 'Show')}
        </span>
      </button>
      {open && <div style={{ display: 'grid', gap: 8, padding: '0 12px 12px' }}>{children}</div>}
    </div>
  );
}

export default function SidebarMenu() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const { showToast } = useToast();
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
    setIsSwitchingSource,
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
  const [interactionOpen, setInteractionOpen] = React.useState(true);

  const panelBg = isLight ? 'rgba(255,255,255,0.82)' : 'rgba(10,12,18,0.54)';
  const borderSoft = isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.08)';
  const contentGap = leftPanelWidth <= 300 ? 14 : 16;
  const isPersonalMode = dataSourceMode === 'personal';
  const personalSourceDisabled = !user;

  const sourceMessage = React.useMemo(() => {
    const rawMessage = sourceMeta?.message;
    if (isZh) return rawMessage || '';
    if (!rawMessage) {
      if (sourceMeta?.effective_source === 'personal_mcd_plus_system_openmars') {
        return 'Personal OpenMARS coverage is incomplete. Using system OpenMARS with personal MCD.';
      }
      return '';
    }
    if (/[a-zA-Z]/.test(rawMessage) && !/[\u4e00-\u9fff]/.test(rawMessage)) {
      return rawMessage;
    }
    if (sourceMeta?.effective_source === 'personal_mcd_plus_system_openmars') {
      return 'Personal OpenMARS coverage is incomplete. Using system OpenMARS with personal MCD.';
    }
    return '';
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

  const handleDataSourceModeChange = React.useCallback(async (nextMode) => {
    if (isSwitchingSource || nextMode === dataSourceMode) return;
    if (nextMode !== 'personal') {
      setDataSourceMode(nextMode);
      return;
    }
    if (!user) {
      showToast(getPersonalSourceLoginRequiredMessage(isZh), 'error');
      return;
    }

    try {
      setIsSwitchingSource(true);
      const { blocked } = await getPersonalSourceAvailability();
      if (blocked) {
        showToast(getPersonalSourceBlockedMessage(isZh), 'error');
        setIsSwitchingSource(false);
        return;
      }
      setDataSourceMode('personal');
    } catch {
      showToast(getPersonalSourceCheckFailedMessage(isZh), 'error');
      setIsSwitchingSource(false);
    }
  }, [
    dataSourceMode,
    isSwitchingSource,
    isZh,
    user,
    setDataSourceMode,
    setIsSwitchingSource,
    showToast,
  ]);

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
        padding: leftPanelWidth <= 300 ? '18px 14px' : '22px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ paddingBottom: 14, borderBottom: `1px solid ${borderSoft}`, flexShrink: 0 }}>
        <div style={{ color: C.ice, fontFamily: 'var(--font-display)', fontSize: leftPanelWidth <= 300 ? 16 : 18, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.02em' }}>
          {isZh ? '分析工作台' : 'Analysis workspace'}
        </div>
        <div style={{ color: C.ice50, fontSize: 'calc(11px * var(--font-scale, 1))', lineHeight: 1.6 }}>
          {isZh ? '先选择分析视角，再调整数据范围、显示图层和交互方式。' : 'Choose an analysis lens first, then tune the dataset, visible layers, and interaction behavior.'}
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
          <SectionLabel>{isZh ? '分析模式' : 'Analysis mode'}</SectionLabel>
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
          <SectionLabel>{isZh ? '数据范围' : 'Data scope'}</SectionLabel>
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <div style={{ color: C.ice60, fontSize: 'calc(11px * var(--font-scale, 1))', fontWeight: 600, marginBottom: 8 }}>
                {isZh ? '数据源' : 'Data source'}
              </div>
              <SegmentedToggle
                value={dataSourceMode}
                onChange={handleDataSourceModeChange}
                disabled={isSwitchingSource}
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
                    disabled: personalSourceDisabled,
                  },
                ]}
              />
              {personalSourceDisabled ? (
                <div style={{ marginTop: 8, color: C.ice40, fontSize: 'calc(10px * var(--font-scale, 1))', lineHeight: 1.5 }}>
                  {getPersonalSourceLoginRequiredMessage(isZh)}
                </div>
              ) : null}
              {isSwitchingSource ? (
                <div style={{ marginTop: 8, color: C.ice50, fontSize: 'calc(10px * var(--font-scale, 1))', lineHeight: 1.5 }}>
                  {isZh ? '正在切换数据源，请稍候…' : 'Switching data source, please wait...'}
                </div>
              ) : null}
              {!isSwitchingSource && sourceMessage ? (
                <div style={{ marginTop: 8, color: isPersonalMode ? C.blue : C.ice50, fontSize: 'calc(10px * var(--font-scale, 1))', lineHeight: 1.55 }}>
                  {sourceMessage}
                </div>
              ) : null}
            </div>

            <SelectField
              label={isZh ? '火星年' : 'Mars year'}
              value={String(marsYear)}
              onChange={(value) => setMarsYear(Number(value))}
              options={yearOptions}
              disabled={isSwitchingSource}
              isLight={isLight}
            />

            <SelectField
              label={isZh ? '球体变量' : 'Globe variable'}
              value={globeVariable}
              onChange={setGlobeVariable}
              options={globeVariableOptions}
              isLight={isLight}
            />
          </div>
        </section>

        <section>
          <SectionLabel>{isZh ? '显示控制' : 'Display controls'}</SectionLabel>
          <AdvancedToggleGroup
            title={isZh ? '球体图层与辅助标记' : 'Globe layers and visual markers'}
            open={displayOpen}
            onToggle={() => setDisplayOpen((value) => !value)}
            isLight={isLight}
            isZh={isZh}
          >
            <InlineSwitch
              label={isZh ? '显示 3D 浓度' : 'Show 3D concentration'}
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
          <SectionLabel>{isZh ? '动态交互' : 'Motion and interaction'}</SectionLabel>
          <AdvancedToggleGroup
            title={isZh ? '旋转与手势控制' : 'Rotation and gesture controls'}
            open={interactionOpen}
            onToggle={() => setInteractionOpen((value) => !value)}
            isLight={isLight}
            isZh={isZh}
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
