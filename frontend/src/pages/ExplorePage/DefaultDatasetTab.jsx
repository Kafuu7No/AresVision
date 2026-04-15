import { useCallback, useEffect, useMemo, useState } from 'react';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import GlowCard from '../../components/GlowCard';
import { fetchDataInfo } from '../../services/api';
import { LoadingBox } from './ExploreComponents';

function toYearRows(info) {
  const years = Array.isArray(info?.available_years) ? info.available_years : [];
  const details = info?.details || {};

  return years
    .map((year) => {
      const detail = details[`MY${year}`] || {};
      const range = Array.isArray(detail.ls_range) ? detail.ls_range : [null, null];
      return {
        year,
        lsStart: range[0],
        lsEnd: range[1],
      };
    })
    .sort((a, b) => a.year - b.year);
}

function formatLs(v) {
  return Number.isFinite(v) ? `${Number(v).toFixed(1)} deg` : '--';
}

function YearDatasetCard({ row, t }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: 156,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.ice,
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: 1.2,
          }}
        >
          {`MY ${row.year}`}
        </div>
        <span
          style={{
            fontSize: 10,
            color: C.blue,
            border: `1px solid rgba(74,158,255,0.35)`,
            background: 'rgba(74,158,255,0.08)',
            borderRadius: 999,
            padding: '3px 9px',
            fontWeight: 600,
          }}
        >
          {t('explore.defaultDataset.labelOfficial')}
        </span>
      </div>

      <div style={{ fontSize: 11, color: C.ice60, lineHeight: 1.7 }}>
        <div>{`${t('explore.defaultDataset.metaLsRange')}: ${formatLs(row.lsStart)} - ${formatLs(row.lsEnd)}`}</div>
        <div>{`${t('explore.defaultDataset.metaGrid')}: 5 deg x 5 deg`}</div>
        <div>{`${t('explore.defaultDataset.metaCoverage')}: OpenMARS + MCD 6.1`}</div>
      </div>
    </div>
  );
}

function SourceCard({ title, subtitle, tags, body }) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '16px 18px',
        background: 'rgba(255,255,255,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: C.ice,
              fontFamily: "'Orbitron', sans-serif",
              letterSpacing: 1.2,
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 11, color: C.ice30, marginTop: 3 }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {tags.map((tag) => (
          <span
            key={tag}
            style={{
              fontSize: 10,
              color: C.ice60,
              padding: '3px 8px',
              borderRadius: 999,
              border: `1px solid ${C.border}`,
              background: 'rgba(255,255,255,0.03)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.ice60, lineHeight: 1.8 }}>{body}</div>
    </div>
  );
}

export default function DefaultDatasetTab() {
  const t = useT();
  const [dataInfo, setDataInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const info = await fetchDataInfo();
      setDataInfo(info);
    } catch (e) {
      setError(e?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const yearRows = useMemo(() => toYearRows(dataInfo), [dataInfo]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <GlowCard style={{ padding: '20px 22px' }}>
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
          {t('explore.defaultDataset.header')}
        </div>
        <div style={{ fontSize: 13, color: C.ice60, lineHeight: 1.8, maxWidth: 980 }}>
          {t('explore.defaultDataset.headerDesc')}
        </div>
      </GlowCard>

      <GlowCard style={{ padding: '18px 20px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.blue,
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: 2,
            marginBottom: 14,
          }}
        >
          {t('explore.defaultDataset.sourceTitle')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14 }}>
          <SourceCard
            title="OpenMARS"
            subtitle={t('explore.defaultDataset.openmarsSubtitle')}
            tags={['O3 Column', 'Global Field', 'Ls-Time']}
            body={t('explore.defaultDataset.openmarsBody')}
          />
          <SourceCard
            title="MCD 6.1"
            subtitle={t('explore.defaultDataset.mcdSubtitle')}
            tags={['Temperature', 'Pressure', 'Wind', 'Dust', 'Solar Flux']}
            body={t('explore.defaultDataset.mcdBody')}
          />
        </div>
      </GlowCard>

      <GlowCard style={{ padding: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.blue,
              fontFamily: "'Orbitron', sans-serif",
              letterSpacing: 2,
            }}
          >
            {t('explore.defaultDataset.listTitle')}
          </div>
          {!loading && (
            <div style={{ fontSize: 11, color: C.ice30 }}>
              {t('explore.defaultDataset.yearCount', { n: yearRows.length })}
            </div>
          )}
        </div>

        {loading && <LoadingBox h={170} label={t('common.loading')} />}

        {!loading && error && (
          <div
            style={{
              border: `1px dashed ${C.border}`,
              borderRadius: 12,
              padding: '20px 16px',
              textAlign: 'center',
              color: C.mars,
              fontSize: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span>{error}</span>
            <button
              onClick={load}
              style={{
                border: `1px solid ${C.border}`,
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 8,
                color: C.ice60,
                fontSize: 12,
                padding: '5px 12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {!loading && !error && yearRows.length === 0 && (
          <div
            style={{
              border: `1px dashed ${C.border}`,
              borderRadius: 12,
              padding: '26px 14px',
              textAlign: 'center',
              color: C.ice30,
              fontSize: 12,
            }}
          >
            {t('common.noData')}
          </div>
        )}

        {!loading && !error && yearRows.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {yearRows.map((row) => (
              <YearDatasetCard key={row.year} row={row} t={t} />
            ))}
          </div>
        )}
      </GlowCard>

      <GlowCard style={{ padding: '16px 20px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.blue,
            fontFamily: "'Orbitron', sans-serif",
            letterSpacing: 2,
            marginBottom: 10,
          }}
        >
          {t('explore.defaultDataset.variableTitle')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {['o3col', 'Temperature', 'Pressure', 'Dust_Optical_Depth', 'Solar_Flux_DN', 'U_Wind', 'V_Wind'].map((name) => (
            <span
              key={name}
              style={{
                fontSize: 11,
                color: C.ice60,
                padding: '4px 10px',
                borderRadius: 999,
                border: `1px solid ${C.border}`,
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              {name}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.ice30, lineHeight: 1.8 }}>
          {t('explore.defaultDataset.variableDesc')}
        </div>
      </GlowCard>
    </div>
  );
}
