import C from '../../constants/colors'; // Re-triggering vite cache
import { useT } from '../../i18n';

export const DATA_OPTION_DEFS = [
  { id: 'globe3d',      icon: '🌍',  color: C.mars,    is3D: true },
  { id: 'seasonal',     icon: '📈',  color: C.blue },
  { id: 'correlation',  icon: '🔗',  color: C.blue },
  { id: 'realtime',     icon: '⚡',  color: C.mars },
  { id: 'environment',  icon: '🌡️', color: '#4acfac' },
  { id: 'prediction',   icon: '🔮',  color: C.ice },
  { id: 'distribution', icon: '📊',  color: C.blue },
];

export default function SidebarMenu({ selectedItem, onItemSelect }) {
  const t = useT();
  const DATA_OPTIONS = DATA_OPTION_DEFS.map(def => ({
    ...def,
    title: t(`overview.menuItems.${def.id}`),
    description: '',
  }));

  return (
    <div style={{
      position: 'fixed', left: 0, top: '70px',
      width: '280px', height: 'calc(100vh - 70px)',
      background: 'rgba(10, 10, 15, 0.85)',
      backdropFilter: 'blur(20px)',
      borderRight: `1px solid ${C.border}`,
      zIndex: 1000, padding: '24px 16px', overflowY: 'auto'
    }}>
      {/* 标题区 */}
      <div style={{ paddingBottom: '20px', marginBottom: '16px', borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{
          color: C.ice, fontFamily: "'Orbitron', sans-serif",
          fontSize: '15px', fontWeight: 'bold', margin: '0 0 6px 0',
          letterSpacing: 2, textAlign: 'center'
        }}>
          DATA DASHBOARD
        </h2>
        <div style={{
          color: C.blue, fontSize: '10px', textAlign: 'center',
          fontFamily: "'Orbitron', sans-serif", letterSpacing: 1
        }}>
          Mars Ozone Analysis
        </div>
      </div>

      {/* 菜单项列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {DATA_OPTIONS.map((option) => {
          const isSelected = selectedItem?.id === option.id;

          return (
            <div
              key={option.id}
              onClick={() => onItemSelect(option)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 10,
                background: isSelected ? 'rgba(74,158,255,0.06)' : 'transparent',
                border: `1px solid ${isSelected ? 'rgba(74,158,255,0.2)' : 'transparent'}`,
                cursor: 'pointer', transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div style={{ fontSize: '20px', filter: isSelected ? `drop-shadow(0 0 6px ${option.color})` : 'none', pointerEvents: 'none' }}>
                {option.icon}
              </div>

              <div style={{ flex: 1, pointerEvents: 'none' }}>
                <div style={{
                  color: isSelected ? option.color : C.ice,
                  fontSize: '13px', fontWeight: 'bold',
                  fontFamily: "'Orbitron', sans-serif", marginBottom: '4px',
                }}>
                  {option.title}
                </div>
                <div style={{ color: C.ice30, fontSize: '11px', fontFamily: "'Exo 2', sans-serif" }}>
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
