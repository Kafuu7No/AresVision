import { useEffect, useMemo, useState } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import SectionTitle from '../components/SectionTitle';
import GlowCard from '../components/GlowCard';
import MyDataTab from './ExplorePage/MyDataTab';
import DefaultDatasetTab from './ExplorePage/DefaultDatasetTab';
import GovernanceTab from './ExplorePage/GovernanceTab';

function CapabilityCard({ active, index, title, body, tags, onClick }) {
  return (
    <GlowCard
      onClick={onClick}
      style={{
        padding: '18px 20px',
        minHeight: 186,
        border: `1px solid ${active ? C.blue : C.border}`,
        background: active ? 'linear-gradient(180deg, rgba(74,158,255,0.08) 0%, rgba(255,255,255,0.02) 100%)' : 'rgba(255,255,255,0.02)',
        boxShadow: active ? `0 0 0 1px ${C.blueGlow}` : 'none',
        transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: active ? C.blue : C.ice30,
            fontFamily: "'Orbitron', sans-serif",
            lineHeight: 1,
          }}
        >
          {index}
        </div>
        <div
          style={{
            fontSize: 10,
            color: active ? C.blue : C.ice30,
            border: `1px solid ${active ? 'rgba(74,158,255,0.35)' : C.border}`,
            borderRadius: 999,
            padding: '4px 10px',
            letterSpacing: 1.1,
            fontWeight: 700,
            fontFamily: "'Orbitron', sans-serif",
          }}
        >
          CORE CAPABILITY
        </div>
      </div>

      <div style={{ marginTop: 18, fontSize: 18, color: C.ice, fontWeight: 700, lineHeight: 1.4 }}>
        {title}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: C.ice60, lineHeight: 1.8 }}>
        {body}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 'auto', paddingTop: 18 }}>
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: 10,
              color: active ? C.blue : C.ice60,
              border: `1px solid ${active ? 'rgba(74,158,255,0.22)' : C.border}`,
              background: active ? 'rgba(74,158,255,0.08)' : 'rgba(255,255,255,0.03)',
              borderRadius: 999,
              padding: '4px 9px',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </GlowCard>
  );
}

export default function ExplorePage() {
  const t = useT();
  const [dataSource, setDataSource] = useState('default');

  const tabs = useMemo(() => {
    return [
      {
        id: 'default',
        index: '01',
        title: t('explore.capabilityOfficialTitle'),
        body: t('explore.capabilityOfficialDesc'),
        tags: ['OpenMARS', 'MCD 6.1', '5° x 5° Grid', 'Research Ready'],
      },
      {
        id: 'myData',
        index: '02',
        title: t('explore.capabilityMyTitle'),
        body: t('explore.capabilityMyDesc'),
        tags: ['Upload QA', 'Lifecycle', 'Public Review', 'Personal Source'],
      },
      {
        id: 'governance',
        index: '03',
        title: t('explore.capabilityGovernanceTitle'),
        body: t('explore.capabilityGovernanceDesc'),
        tags: ['Asset Overview', 'Quality Audit', 'Lineage Trace', 'Effective Source'],
      },
    ];
  }, [t]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === dataSource)) {
      setDataSource('default');
    }
  }, [tabs, dataSource]);

  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1440, margin: '0 auto' }}>
      <SectionTitle title={t('explore.title')} subtitle={t('explore.subtitle')} />

      <GlowCard style={{ padding: '20px 22px', marginTop: -8, marginBottom: 22 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.blue,
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: 2,
            marginBottom: 8,
          }}
        >
          PLATFORM VALUE PROOF
        </div>
        <div style={{ fontSize: 13, color: C.ice60, lineHeight: 1.85, maxWidth: 1080 }}>
          {t('explore.pageDesc')}
        </div>
      </GlowCard>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        {tabs.map((tab) => (
          <CapabilityCard
            key={tab.id}
            active={dataSource === tab.id}
            index={tab.index}
            title={tab.title}
            body={tab.body}
            tags={tab.tags}
            onClick={() => setDataSource(tab.id)}
          />
        ))}
      </div>

      {dataSource === 'default' && <DefaultDatasetTab />}
      {dataSource === 'myData' && <MyDataTab />}
      {dataSource === 'governance' && <GovernanceTab />}
    </div>
  );
}
