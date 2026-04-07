import C from '../../constants/colors';
import { useT } from '../../i18n';

export const DATA_OPTION_DEFS = [
  { id: 'globe3d', icon: '◎', color: C.mars, is3D: true },
  { id: 'seasonal', icon: '▦', color: C.blue },
  { id: 'correlation', icon: '⌘', color: C.blue },
  { id: 'realtime', icon: '◔', color: C.mars },
  { id: 'environment', icon: '△', color: '#4acfac' },
  { id: 'prediction', icon: '≈', color: C.ice },
  { id: 'distribution', icon: '▤', color: C.blue },
  { id: 'coupling', icon: '∿', color: '#ffb347' },
  { id: 'wave', icon: '〰', color: '#d2b48c' },
  { id: 'solar', icon: '☼', color: '#ffd700' },
  { id: 'polar', icon: '❄', color: '#cbeef3' },
];

const MENU_COPY = {
  globe3d: {
    title: '三维臭氧球 3D GLOBE',
    description: '查看当前 Ls 切片下的全球臭氧球面分布。',
  },
  seasonal: {
    title: '季节臭氧场 SEASONAL OZONE FIELD',
    description: '展示臭氧在纬度与季节上的整体结构。',
  },
  correlation: {
    title: '关系研究 RELATION LAB',
    description: '查看臭氧与环境变量的相关、共演化与时滞关系。',
  },
  realtime: {
    title: '昼夜变化 DIURNAL PROFILE',
    description: '分析不同纬带在当前季节下的臭氧昼夜变化。',
  },
  environment: {
    title: '环境驱动 ENVIRONMENT DRIVERS',
    description: '总览温度、沙尘、辐射和风场的季节演变与纬带影响。',
  },
  prediction: {
    title: '模型能力 MODEL SKILL TRACKER',
    description: '比较基线模型与完整驱动模型的测试表现。',
  },
  distribution: {
    title: '空间分布 SPATIAL DISTRIBUTION',
    description: '统计当前臭氧切片的分布形态和纬向剖面。',
  },
  coupling: {
    title: '沙尘冲刷 DUST WASHOUT',
    description: '探索沙尘暴爆发对全球平均臭氧含量的直接影响。',
  },
  wave: {
    title: '行星波探测 WAVE EXPLORER',
    description: '分析火星主导地形产生的大气驻波与纬向距平。',
  },
  solar: {
    title: '光化学驱动 SOLAR SENSITIVITY',
    description: '研究紫外辐射强度与臭氧生成率的非线性关系。',
  },
  polar: {
    title: '极地冬春演化 POLAR DYNAMICS',
    description: '对比南北极在极夜前后的臭氧急剧积聚趋势。',
  },
};


export default function SidebarMenu({ selectedItem, onItemSelect }) {
  const t = useT();
  const dataOptions = DATA_OPTION_DEFS.map((def) => ({
    ...def,
    title: t(`overview.menuItems.${def.id}`) || MENU_COPY[def.id]?.title || def.id,
    description: t(`overview.menuItems.${def.id}_desc`) || MENU_COPY[def.id]?.description || '',
  }));

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: '70px',
        width: '280px',
        height: 'calc(100vh - 70px)',
        background: 'var(--bg-nav)',
        backdropFilter: 'blur(20px)',
        borderRight: `1px solid ${C.border}`,
        zIndex: 1000,
        padding: '24px 16px',
        overflowY: 'auto',
      }}
    >
      <div style={{ paddingBottom: '20px', marginBottom: '16px', borderBottom: `1px solid ${C.border}` }}>
        <h2
          style={{
            color: C.ice,
            fontFamily: "'Orbitron', sans-serif",
            fontSize: '15px',
            fontWeight: 'bold',
            margin: '0 0 6px 0',
            letterSpacing: 2,
            textAlign: 'center',
          }}
        >
          DATA DASHBOARD
        </h2>
        <div
          style={{
            color: C.blue,
            fontSize: '10px',
            textAlign: 'center',
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: 1,
          }}
        >
          Mars Ozone Analysis
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {dataOptions.map((option) => {
          const isSelected = selectedItem?.id === option.id;

          return (
            <div
              key={option.id}
              onClick={() => onItemSelect(option)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 10,
                background: isSelected ? 'rgba(74,158,255,0.06)' : 'transparent',
                border: `1px solid ${isSelected ? 'rgba(74,158,255,0.2)' : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'transparent';
              }}
            >
              <div style={{ fontSize: '20px', filter: isSelected ? `drop-shadow(0 0 6px ${option.color})` : 'none', pointerEvents: 'none' }}>
                {option.icon}
              </div>

              <div style={{ flex: 1, pointerEvents: 'none' }}>
                <div
                  style={{
                    color: isSelected ? option.color : C.ice,
                    fontSize: '13px',
                    fontWeight: 'bold',
                    fontFamily: "'Orbitron', sans-serif",
                    marginBottom: '4px',
                  }}
                >
                  {option.title}
                </div>
                <div style={{ color: C.ice30, fontSize: '11px', fontFamily: "'Exo 2', sans-serif", lineHeight: 1.5 }}>
                  {option.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
