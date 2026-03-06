import C from '../constants/colors';

const NAV_ITEMS = [
  { id: 'home',    label: '首页',   en: 'HOME' },
  { id: 'explore', label: '数据探索', en: 'EXPLORE' },
  { id: 'predict', label: '预测分析', en: 'PREDICT' },
  { id: 'ai',      label: 'AI 解读', en: 'AI INSIGHT' },
  { id: 'about',   label: '关于',   en: 'ABOUT' },
];

// 火星 + 轨道环的 SVG Logo
function MarsLogoIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="navMarsGrad" cx="33%" cy="30%" r="70%">
          <stop offset="0%"   stopColor="#ec9268" />
          <stop offset="40%"  stopColor="#c75b39" />
          <stop offset="78%"  stopColor="#8b3a25" />
          <stop offset="100%" stopColor="#3a1208" />
        </radialGradient>
      </defs>
      {/* 轨道环 */}
      <ellipse
        cx="18" cy="18" rx="17" ry="5.5"
        stroke="rgba(199,91,57,0.42)" strokeWidth="1"
        fill="none"
        transform="rotate(-22, 18, 18)"
      />
      {/* 火星本体 */}
      <circle cx="18" cy="18" r="11" fill="url(#navMarsGrad)" />
      {/* 北极冰盖 */}
      <ellipse cx="18" cy="9.2" rx="3.6" ry="1.5" fill="rgba(248,240,225,0.58)" />
      {/* 表面暗斑（Syrtis Major） */}
      <ellipse
        cx="21" cy="16" rx="2.8" ry="2.1"
        fill="rgba(40,14,4,0.35)"
        transform="rotate(-10, 21, 16)"
      />
      {/* 边缘阴影 */}
      <circle cx="18" cy="18" r="11"
        fill="radial-gradient(circle at 68% 65%, rgba(0,0,0,0.4) 0%, transparent 55%)"
      />
    </svg>
  );
}

export default function Navbar({ current, onChange }) {
  return (
    <nav
      className="nav-glass"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        zIndex: 1000,
        height: 70,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 48px',
      }}
    >
      {/* Logo */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
        onClick={() => onChange('home')}
      >
        <MarsLogoIcon />
        <div>
          <div style={{
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "'Orbitron', sans-serif",
            color: C.ice,
            letterSpacing: 2.5,
            lineHeight: 1.2,
          }}>
            ARESVISION
          </div>
          <div style={{ fontSize: 10, color: C.ice60, letterSpacing: 2 }}>智绘赤星</div>
        </div>
      </div>

      {/* Nav Links */}
      <div style={{ display: 'flex', gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: isActive
                  ? `2px solid ${C.mars}`
                  : '2px solid transparent',
                borderRadius: 0,
                padding: '10px 22px 8px',
                cursor: 'pointer',
                transition: 'all 0.25s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 2,
                fontFamily: "'Orbitron', sans-serif",
                color: isActive ? C.mars : C.ice60,
                transition: 'color 0.25s',
              }}>
                {item.en}
              </span>
              <span style={{
                fontSize: 10,
                color: isActive ? C.ice : C.ice30,
                transition: 'color 0.25s',
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ width: 130 }} />
    </nav>
  );
}
