import C from '../constants/colors';
import { useT } from '../i18n';

const NAV_IDS = ['home', 'overview', 'explore', 'predict', 'ai', 'about'];

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
      <ellipse
        cx="18" cy="18" rx="17" ry="5.5"
        stroke="rgba(199,91,57,0.42)" strokeWidth="1"
        fill="none"
        transform="rotate(-22, 18, 18)"
      />
      <circle cx="18" cy="18" r="11" fill="url(#navMarsGrad)" />
      <ellipse cx="18" cy="9.2" rx="3.6" ry="1.5" fill="rgba(248,240,225,0.58)" />
      <ellipse
        cx="21" cy="16" rx="2.8" ry="2.1"
        fill="rgba(40,14,4,0.35)"
        transform="rotate(-10, 21, 16)"
      />
      <circle cx="18" cy="18" r="11"
        fill="radial-gradient(circle at 68% 65%, rgba(0,0,0,0.4) 0%, transparent 55%)"
      />
    </svg>
  );
}


export default function Navbar({ current, onChange }) {
  const t = useT();

  return (
    <nav
      className="nav-glass"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        zIndex: 2000,
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
          <div style={{ fontSize: 10, color: C.ice60, letterSpacing: 2 }}>
            {t('nav.subtitle')}
          </div>
        </div>
      </div>

      {/* Nav Links */}
      <div style={{ display: 'flex', gap: 2 }}>
        {NAV_IDS.map((id) => {
          const isActive = current === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
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
                textTransform: 'uppercase',
              }}>
                {t(`nav.${id}`)}
              </span>
            </button>
          );
        })}
      </div>

      {/* 右侧占位（保持三列布局对称） */}
      <div style={{ width: 130 }} />
    </nav>
  );
}
