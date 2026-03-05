import C from '../constants/colors';

const NAV_ITEMS = [
  { id: 'home', label: '首页', en: 'HOME' },
  { id: 'explore', label: '数据探索', en: 'EXPLORE' },
  { id: 'predict', label: '预测分析', en: 'PREDICT' },
  { id: 'ai', label: 'AI 解读', en: 'AI INSIGHT' },
  { id: 'about', label: '关于', en: 'ABOUT' },
];

export default function Navbar({ current, onChange }) {
  return (
    <nav
      className="nav-glass"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
      }}
    >
      {/* Logo */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
        onClick={() => onChange('home')}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 35%, ${C.marsLight}, ${C.mars})`,
            boxShadow: '0 0 20px rgba(199,91,57,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 900,
            color: '#fff',
            fontFamily: "'Orbitron', sans-serif",
          }}
        >
          A
        </div>
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "'Orbitron', sans-serif",
              color: C.ice,
              letterSpacing: 2,
              lineHeight: 1.2,
            }}
          >
            ARESVISION
          </div>
          <div style={{ fontSize: 9, color: C.ice60, letterSpacing: 1 }}>智绘赤星</div>
        </div>
      </div>

      {/* Nav Links */}
      <div style={{ display: 'flex', gap: 4 }}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            style={{
              background: current === item.id ? 'rgba(199,91,57,0.15)' : 'transparent',
              border:
                current === item.id
                  ? '1px solid rgba(199,91,57,0.3)'
                  : '1px solid transparent',
              borderRadius: 8,
              padding: '8px 18px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 2,
                fontFamily: "'Orbitron', sans-serif",
                color: current === item.id ? C.mars : C.ice60,
                transition: 'color 0.3s',
              }}
            >
              {item.en}
            </span>
            <span style={{ fontSize: 10, color: current === item.id ? C.ice : C.ice30 }}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      <div style={{ width: 120 }} />
    </nav>
  );
}
