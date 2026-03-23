import { useState, useCallback, useEffect } from 'react';
import C from './constants/colors';
import { useT } from './i18n';
import StarField from './components/StarField';
import Navbar from './components/Navbar';
import SettingsPanel from './components/SettingsPanel';
import SettingsFab from './components/SettingsFab';
import AdminReviewPanel from './components/AdminReviewPanel';
import HomePage from './pages/HomePage';
import DataOverviewPage from './pages/DataOverviewPage';
import ExplorePage from './pages/ExplorePage';
import PredictPage from './pages/PredictPage';
import AIPage from './pages/AIPage';
import AboutPage from './pages/AboutPage';

const VALID_PAGES = ['home', 'overview', 'explore', 'predict', 'ai', 'about'];

function getPageFromHash() {
  const hash = window.location.hash.replace('#/', '').replace('#', '');
  return VALID_PAGES.includes(hash) ? hash : 'home';
}

export default function App() {
  const [page, setPage] = useState(getPageFromHash);
  const [transitioning, setTransitioning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [reviewSignal, setReviewSignal] = useState(0);
  const t = useT();

  const navigate = useCallback(
    (target) => {
      if (target === page) return;
      setTransitioning(true);
      window.history.pushState(null, '', target === 'home' ? '#/' : `#/${target}`);
      setTimeout(() => {
        setPage(target);
        setTransitioning(false);
        window.scrollTo({ top: 0, behavior: 'instant' });
      }, 200);
    },
    [page]
  );

  // 监听浏览器前进/后退
  useEffect(() => {
    const handlePopState = () => {
      const target = getPageFromHash();
      if (target !== page) {
        setTransitioning(true);
        setTimeout(() => {
          setPage(target);
          setTransitioning(false);
          window.scrollTo({ top: 0, behavior: 'instant' });
        }, 200);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [page]);

  // 首次加载时确保 hash 存在
  useEffect(() => {
    if (!window.location.hash || window.location.hash === '#') {
      window.history.replaceState(null, '', '#/');
    }
  }, []);

  // 禁用浏览器自动滚动恢复，刷新后始终从顶部开始
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <StarField />
      <Navbar current={page} onChange={navigate} onOpenAdmin={() => setAdminPanelOpen(true)} pendingRefreshSignal={reviewSignal} />
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AdminReviewPanel open={adminPanelOpen} onClose={() => setAdminPanelOpen(false)} onReviewComplete={() => setReviewSignal(v => v + 1)} />
      <SettingsFab
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAdmin={() => setAdminPanelOpen(true)}
      />

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
        {page === 'overview' && <DataOverviewPage />}
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
          {t('footer.copyright')}
        </div>
        <div style={{ fontSize: 10, color: C.ice30, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>
          {t('footer.powered')}
        </div>
      </footer>
    </>
  );
}
