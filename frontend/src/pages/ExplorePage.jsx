import { useEffect, useMemo, useState } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useAuth } from '../contexts/AuthContext';
import SectionTitle from '../components/SectionTitle';
import MyDataTab from './ExplorePage/MyDataTab';
import DefaultDatasetTab from './ExplorePage/DefaultDatasetTab';
import GovernanceTab from './ExplorePage/GovernanceTab';

export default function ExplorePage() {
  const t = useT();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [dataSource, setDataSource] = useState('default');

  const tabs = useMemo(() => {
    const base = [
      { id: 'default', label: t('explore.tabDefault') },
      { id: 'myData', label: t('explore.tabMy') },
    ];
    if (isAdmin) base.push({ id: 'governance', label: t('explore.tabGovernance') });
    return base;
  }, [isAdmin, t]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === dataSource)) {
      setDataSource('default');
    }
  }, [tabs, dataSource]);

  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionTitle title={t('explore.title')} subtitle={t('explore.subtitle')} />

      <p style={{ fontSize: 12, color: C.ice30, marginTop: -20, marginBottom: 24 }}>
        {t('explore.pageDesc')}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setDataSource(tab.id)}
            style={{
              padding: '8px 16px',
              background: dataSource === tab.id ? 'rgba(74,158,255,0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${dataSource === tab.id ? C.blue : C.border}`,
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: dataSource === tab.id ? C.blue : C.ice30,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {dataSource === 'default' && <DefaultDatasetTab />}
      {dataSource === 'myData' && <MyDataTab />}
      {dataSource === 'governance' && isAdmin && <GovernanceTab />}
    </div>
  );
}
