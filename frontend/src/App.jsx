import { useState, useCallback } from 'react';
import C from './constants/colors';
import StarField from './components/StarField';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import PredictPage from './pages/PredictPage';
import AIPage from './pages/AIPage';
import AboutPage from './pages/AboutPage';

export default function App() {
  const [page, setPage] = useState('home');
  const [transitioning, setTransitioning] = useState(false);

  const navigate = useCallback(
    (target) => {
      if (target === page) return;
      setTransitioning(true);
      setTimeout(() => {
        setPage(target);
        setTransitioning(false);
        window.scrollTo({ top: 0, behavior: 'instant' });
      }, 200);
    },
    [page]
  );

  return (
    <>
      <StarField />
      <Navbar current={page} onChange={navigate} />

      {/* Page content with transition */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          opacity: transitioning ? 0 : 1,
          transform: transitioning ? 'translateY(16px)' : 'translateY(0)',
          transition: 'opacity 0.2s, transform 0.2s',
        }}
      >
        {page === 'home' && <HomePage onNavigate={navigate} />}
        {page === 'explore' && <ExplorePage />}
        {page === 'predict' && <PredictPage />}
        {page === 'ai' && <AIPage />}
        {page === 'about' && <AboutPage />}
      </div>

      {/* Footer */}
      <footer
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '32px 40px',
          borderTop: `1px solid ${C.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: 11, color: C.ice30 }}>
          © 2025 AresVision 智绘赤星 · 上海大学生计算机能力大赛
        </div>
        <div style={{ fontSize: 10, color: C.ice30, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>
          POWERED BY OPENMARS · MCD 6.1 · PREDRNNV2
        </div>
      </footer>
    </>
  );
}
