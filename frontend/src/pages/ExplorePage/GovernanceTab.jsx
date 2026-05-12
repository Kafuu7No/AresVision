import { useCallback, useEffect, useMemo, useState } from 'react';
import C from '../../constants/colors';
import { useT } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import GlowCard from '../../components/GlowCard';
import { LoadingBox } from './ExploreComponents';
import {
  getDataGovernanceLineage,
  getDataGovernanceOverview,
  getDataGovernanceQuality,
} from '../../services/api';

const STATUS_COLORS = {
  valid: '#22c55e',
  invalid: '#ef4444',
  pending_review: '#f59e0b',
  approved: '#10b981',
  rejected: '#fb7185',
};

function fmtNum(v, digits = 1) {
  if (v == null || Number.isNaN(Number(v))) return '--';
  return Number(v).toFixed(digits);
}

function fmtPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '--';
  return `${(Number(v) * 100).toFixed(1)}%`;
}

function fmtLsRange(range) {
  if (!Array.isArray(range) || range.length < 2 || range[0] == null || range[1] == null) return '--';
  return `${fmtNum(range[0], 1)} - ${fmtNum(range[1], 1)} deg`;
}

function fmtLsCoverage(v) {
  if (v == null || Number.isNaN(Number(v))) return '--';
  return `${(Number(v) * 100).toFixed(1)}%`;
}

function fmtVars(vars) {
  if (!Array.isArray(vars) || vars.length === 0) return '--';
  if (vars.length <= 4) return vars.join(', ');
  return `${vars.slice(0, 4).join(', ')} ... (+${vars.length - 4})`;
}

function fmtStatusDist(dist) {
  const entries = Object.entries(dist || {}).filter(([, n]) => Number(n) > 0);
  if (!entries.length) return '--';
  return entries.map(([k, n]) => `${k}:${n}`).join(' | ');
}

function StatusDistributionChart({ distribution }) {
  const entries = Object.entries(distribution || {});
  const total = entries.reduce((sum, [, n]) => sum + Number(n || 0), 0);
  if (!entries.length || total <= 0) return null;

  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.map(([status, count]) => {
        const safeCount = Number(count || 0);
        const pct = total > 0 ? (safeCount / total) * 100 : 0;
        return (
          <div key={`status-bar-${status}`} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 72px', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: STATUS_COLORS[status] || C.ice60 }}>{status}</span>
            <div style={{ height: 8, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.max(0, Math.min(100, pct))}%`,
                  background: STATUS_COLORS[status] || C.ice60,
                }}
              />
            </div>
            <span style={{ fontSize: 11, color: C.ice30, textAlign: 'right' }}>{`${safeCount} (${pct.toFixed(1)}%)`}</span>
          </div>
        );
      })}
    </div>
  );
}

function MetricBar({ label, value }) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.ice60 }}>
        <span>{label}</span>
        <span>{fmtNum(safe, 1)}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
        <div
          style={{
            height: '100%',
            width: `${safe}%`,
            background: safe >= 90 ? '#22c55e' : safe >= 75 ? '#4ade80' : safe >= 60 ? '#f59e0b' : '#ef4444',
            transition: 'width 0.2s',
          }}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '14px 14px',
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div style={{ fontSize: 11, color: C.ice30 }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700, color: C.ice, fontFamily: "'Orbitron', sans-serif" }}>
        {value}
      </div>
    </div>
  );
}

export default function GovernanceTab() {
  const t = useT();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [scope, setScope] = useState(isAdmin ? 'all' : 'mine');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [quality, setQuality] = useState(null);
  const [lineage, setLineage] = useState(null);

  useEffect(() => {
    setScope(isAdmin ? 'all' : 'mine');
  }, [isAdmin]);

  const assets = overview?.assets || [];
  const summary = overview?.summary || null;
  const groupedAssets = useMemo(() => {
    const map = new Map();
    assets.forEach((asset) => {
      const yearKey = asset.mars_year == null ? 'unknown' : `MY${asset.mars_year}`;
      const typeKey = asset.data_type || 'unknown';
      const key = `${yearKey}__${typeKey}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          yearLabel: yearKey,
          dataType: typeKey,
          datasetCount: 0,
          variableSet: new Set(),
          gridSet: new Set(),
          lsMin: null,
          lsMax: null,
          lsCoverageValues: [],
          statusDistribution: {},
          qualityValues: [],
          latestUploadId: asset.upload_id,
          latestCreatedAt: asset.created_at || '',
        });
      }

      const group = map.get(key);
      group.datasetCount += 1;
      (asset.variables || []).forEach((v) => group.variableSet.add(v));
      if (asset.grid?.lat_points && asset.grid?.lon_points) {
        group.gridSet.add(`${asset.grid.lat_points}x${asset.grid.lon_points}`);
      }
      if (Array.isArray(asset.ls_range) && asset.ls_range.length >= 2) {
        const [start, end] = asset.ls_range;
        if (start != null && (group.lsMin == null || start < group.lsMin)) group.lsMin = start;
        if (end != null && (group.lsMax == null || end > group.lsMax)) group.lsMax = end;
      }
      if (asset.ls_coverage != null && !Number.isNaN(Number(asset.ls_coverage))) {
        group.lsCoverageValues.push(Number(asset.ls_coverage));
      }
      const statusKey = asset.status || 'unknown';
      group.statusDistribution[statusKey] = (group.statusDistribution[statusKey] || 0) + 1;
      if (asset.quality_score != null && !Number.isNaN(Number(asset.quality_score))) {
        group.qualityValues.push(Number(asset.quality_score));
      }
      const createdAt = asset.created_at || '';
      if (createdAt > group.latestCreatedAt) {
        group.latestCreatedAt = createdAt;
        group.latestUploadId = asset.upload_id;
      }
    });

    return Array.from(map.values())
      .map((group) => {
        const lsRange =
          group.lsMin != null && group.lsMax != null
            ? [group.lsMin, group.lsMax]
            : null;
        const lsCoverage =
          group.lsCoverageValues.length > 0
            ? group.lsCoverageValues.reduce((sum, v) => sum + v, 0) / group.lsCoverageValues.length
            : null;
        const avgQuality =
          group.qualityValues.length > 0
            ? group.qualityValues.reduce((sum, v) => sum + v, 0) / group.qualityValues.length
            : null;

        return {
          key: group.key,
          yearLabel: group.yearLabel,
          dataType: group.dataType,
          datasetCount: group.datasetCount,
          variables: Array.from(group.variableSet).sort(),
          grids: Array.from(group.gridSet).sort(),
          lsRange,
          lsCoverage,
          statusDistribution: group.statusDistribution,
          avgQuality,
          latestUploadId: group.latestUploadId,
        };
      })
      .sort((a, b) => {
        if (a.yearLabel === b.yearLabel) return a.dataType.localeCompare(b.dataType);
        return a.yearLabel < b.yearLabel ? 1 : -1;
      });
  }, [assets]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getDataGovernanceOverview(scope);
      setOverview(data);
    } catch (e) {
      setError(e?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [scope, t]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!groupedAssets.length) {
      setSelectedId(null);
      return;
    }
    const validIds = new Set(groupedAssets.map((x) => x.latestUploadId));
    if (!selectedId || !validIds.has(selectedId)) {
      setSelectedId(groupedAssets[0].latestUploadId);
    }
  }, [groupedAssets, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setQuality(null);
      setLineage(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const [q, l] = await Promise.all([
          getDataGovernanceQuality(selectedId),
          getDataGovernanceLineage(selectedId),
        ]);
        if (cancelled) return;
        setQuality(q);
        setLineage(l);
      } catch {
        if (cancelled) return;
        setQuality(null);
        setLineage(null);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const statItems = useMemo(() => {
    if (!summary) return [];
    const dist = summary.status_distribution || {};
    return [
      { key: 'total', label: t('explore.governance.totalDatasets'), value: summary.total_datasets ?? 0 },
      { key: 'effective', label: t('explore.governance.effectiveDatasets'), value: summary.effective_datasets ?? 0 },
      { key: 'approved', label: t('explore.governance.approvedCount'), value: dist.approved ?? 0 },
      { key: 'pending', label: t('explore.governance.pendingCount'), value: dist.pending_review ?? 0 },
      {
        key: 'quality',
        label: t('explore.governance.avgQuality'),
        value: summary.average_quality_score != null ? fmtNum(summary.average_quality_score, 1) : '--',
      },
    ];
  }, [summary, t]);

  if (!user) {
    return (
      <GlowCard style={{ padding: 22 }}>
        <div style={{ fontSize: 13, color: C.ice60 }}>{t('explore.upload.loginPrompt')}</div>
      </GlowCard>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <GlowCard style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, letterSpacing: 2, fontFamily: "'Orbitron', sans-serif" }}>
              {t('explore.governance.title')}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: C.ice60 }}>{t('explore.governance.subtitle')}</div>
          </div>

          {isAdmin && (
            <div style={{ display: 'flex', gap: 8 }}>
              {['all', 'mine'].map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: `1px solid ${scope === s ? C.blue : C.border}`,
                    background: scope === s ? 'rgba(74,158,255,0.12)' : 'rgba(255,255,255,0.03)',
                    color: scope === s ? C.blue : C.ice60,
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {s === 'all' ? t('explore.governance.scopeAll') : t('explore.governance.scopeMine')}
                </button>
              ))}
            </div>
          )}
        </div>
      </GlowCard>

      {loading && <LoadingBox h={180} label={t('common.loading')} />}

      {!loading && error && (
        <GlowCard style={{ padding: '20px 22px' }}>
          <div style={{ color: C.mars, fontSize: 12 }}>{error}</div>
        </GlowCard>
      )}

      {!loading && !error && (
        <>
          <GlowCard style={{ padding: '18px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
              {statItems.map((item) => (
                <StatCard key={item.key} label={item.label} value={item.value} />
              ))}
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(summary?.status_distribution || {}).map(([k, n]) => (
                <span
                  key={k}
                  style={{
                    fontSize: 11,
                    color: STATUS_COLORS[k] || C.ice60,
                    border: `1px solid ${C.border}`,
                    borderRadius: 999,
                    padding: '3px 10px',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  {`${k}: ${n}`}
                </span>
              ))}
            </div>
            <StatusDistributionChart distribution={summary?.status_distribution} />

            <div style={{ marginTop: 14, fontSize: 11, color: C.ice30 }}>DATA SOURCE DISTRIBUTION</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(summary?.data_source_distribution || {}).map(([k, n]) => (
                <span
                  key={`src-${k}`}
                  style={{
                    fontSize: 11,
                    color: C.ice60,
                    border: `1px solid ${C.border}`,
                    borderRadius: 999,
                    padding: '3px 10px',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  {`${k}: ${n}`}
                </span>
              ))}
            </div>

            <div style={{ marginTop: 14, fontSize: 11, color: C.ice30 }}>MARS YEAR DISTRIBUTION</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(summary?.mars_year_distribution || {}).map(([k, n]) => (
                <span
                  key={`year-${k}`}
                  style={{
                    fontSize: 11,
                    color: C.ice60,
                    border: `1px solid ${C.border}`,
                    borderRadius: 999,
                    padding: '3px 10px',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  {`${k}: ${n}`}
                </span>
              ))}
            </div>
          </GlowCard>

          <GlowCard style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: C.blue, letterSpacing: 2, fontWeight: 700, fontFamily: "'Orbitron', sans-serif", marginBottom: 12 }}>
              {t('explore.governance.assetList')}
            </div>
            {!groupedAssets.length && (
              <div style={{ fontSize: 12, color: C.ice30, padding: '8px 0' }}>{t('common.noData')}</div>
            )}
            {groupedAssets.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1150 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {[
                        t('explore.governance.colYear'),
                        t('explore.governance.colType'),
                        'DATASETS',
                        t('explore.upload.variables'),
                        'GRID PROFILES',
                        t('explore.upload.lsRange'),
                        t('explore.governance.colLs'),
                        'STATUS DIST',
                        t('explore.governance.colQuality'),
                        t('explore.governance.colAction'),
                      ].map((h) => (
                        <th
                          key={h}
                          style={{ textAlign: 'left', fontSize: 11, color: C.ice30, fontWeight: 600, padding: '8px 6px' }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupedAssets.map((group) => {
                      const active = selectedId === group.latestUploadId;
                      return (
                        <tr
                          key={group.key}
                          style={{ borderBottom: `1px solid ${C.border}`, background: active ? 'rgba(74,158,255,0.06)' : 'transparent' }}
                        >
                          <td style={{ padding: '9px 6px', fontSize: 12, color: C.ice60 }}>
                            {group.yearLabel}
                          </td>
                          <td style={{ padding: '9px 6px', fontSize: 12, color: C.ice60 }}>{group.dataType || '--'}</td>
                          <td style={{ padding: '9px 6px', fontSize: 12, color: C.ice60 }}>{group.datasetCount}</td>
                          <td
                            style={{ padding: '9px 6px', fontSize: 12, color: C.ice60, maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            title={Array.isArray(group.variables) ? group.variables.join(', ') : '--'}
                          >
                            {fmtVars(group.variables)}
                          </td>
                          <td style={{ padding: '9px 6px', fontSize: 12, color: C.ice60 }}>
                            {group.grids.length ? group.grids.join(' | ') : '--'}
                          </td>
                          <td style={{ padding: '9px 6px', fontSize: 12, color: C.ice60 }}>{fmtLsRange(group.lsRange)}</td>
                          <td style={{ padding: '9px 6px', fontSize: 12, color: C.ice60 }}>{fmtLsCoverage(group.lsCoverage)}</td>
                          <td style={{ padding: '9px 6px', fontSize: 12, color: C.ice60 }}>{fmtStatusDist(group.statusDistribution)}</td>
                          <td style={{ padding: '9px 6px', fontSize: 12, color: C.ice60 }}>
                            {group.avgQuality != null ? fmtNum(group.avgQuality, 1) : '--'}
                          </td>
                          <td style={{ padding: '9px 6px' }}>
                            <button
                              onClick={() => setSelectedId(group.latestUploadId)}
                              style={{
                                border: `1px solid ${C.border}`,
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: 7,
                                fontSize: 11,
                                color: C.ice60,
                                padding: '4px 10px',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                              }}
                            >
                              {t('explore.governance.viewDetail')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlowCard>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
            <GlowCard style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 11, color: C.blue, letterSpacing: 2, fontWeight: 700, fontFamily: "'Orbitron', sans-serif", marginBottom: 10 }}>
                {t('explore.governance.qualityTitle')}
              </div>
              {detailLoading && <LoadingBox h={160} label={t('common.loading')} />}
              {!detailLoading && !quality && <div style={{ fontSize: 12, color: C.ice30 }}>{t('common.noData')}</div>}
              {!detailLoading && quality && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: C.ice60 }}>{t('explore.governance.overallScore')}</span>
                    <span style={{ fontSize: 18, color: C.ice, fontWeight: 700 }}>
                      {fmtNum(quality?.scores?.overall, 1)} / 100 ({quality?.scores?.grade || '--'})
                    </span>
                  </div>

                  <MetricBar label={t('explore.governance.missingRateScore')} value={quality?.scores?.missing_rate_score} />
                  <MetricBar label={t('explore.governance.validRatioScore')} value={quality?.scores?.valid_ratio_score} />
                  <MetricBar label={t('explore.governance.variableScore')} value={quality?.scores?.variable_score} />
                  <MetricBar label={t('explore.governance.timeScore')} value={quality?.scores?.time_score} />
                  <MetricBar label={t('explore.governance.gridScore')} value={quality?.scores?.grid_score} />

                  <div style={{ marginTop: 4, fontSize: 11, color: C.ice30 }}>
                    {`${t('explore.governance.missingRate')}: ${fmtPct(quality?.metrics?.missing_rate)}`}
                  </div>
                  <div style={{ fontSize: 11, color: C.ice30 }}>
                    {`${t('explore.governance.validRatio')}: ${fmtPct(quality?.metrics?.valid_value_ratio)}`}
                  </div>
                </div>
              )}
            </GlowCard>

            <GlowCard style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: 11, color: C.blue, letterSpacing: 2, fontWeight: 700, fontFamily: "'Orbitron', sans-serif", marginBottom: 10 }}>
                {t('explore.governance.lineageTitle')}
              </div>
              {detailLoading && <LoadingBox h={160} label={t('common.loading')} />}
              {!detailLoading && !lineage && <div style={{ fontSize: 12, color: C.ice30 }}>{t('common.noData')}</div>}
              {!detailLoading && lineage && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, color: C.ice60 }}>{`${t('explore.governance.hash')}: ${lineage.file_hash || '--'}`}</div>
                  <div style={{ fontSize: 12, color: C.ice60 }}>{`${t('explore.governance.uploader')}: ${lineage?.uploader?.username || lineage?.uploader?.email || '--'}`}</div>
                  <div style={{ fontSize: 12, color: C.ice60 }}>{`${t('explore.governance.reviewer')}: ${lineage?.reviewer?.username || lineage?.reviewer?.email || '--'}`}</div>
                  <div style={{ fontSize: 12, color: C.ice60 }}>{`${t('explore.governance.sourceZone')}: ${lineage?.current_effective_data_source?.storage_zone || '--'}`}</div>
                  <div style={{ fontSize: 12, color: C.ice60 }}>{`effective_status: ${lineage?.current_effective_data_source?.effective_status || '--'}`}</div>
                  <div style={{ fontSize: 12, color: C.ice60 }}>{`effective_path: ${lineage?.current_effective_data_source?.effective_path || '--'}`}</div>
                  <div style={{ fontSize: 12, color: C.ice60 }}>{`${t('explore.governance.createdAt')}: ${lineage?.timestamps?.uploaded_at || '--'}`}</div>
                  <div style={{ fontSize: 12, color: C.ice60 }}>{`${t('explore.governance.reviewedAt')}: ${lineage?.timestamps?.reviewed_at || '--'}`}</div>

                  <div style={{ marginTop: 6, fontSize: 11, color: C.ice30 }}>{t('explore.governance.eventTimeline')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(lineage.events || []).map((evt, idx) => (
                      <div
                        key={`${evt.type}-${idx}`}
                        style={{
                          border: `1px solid ${C.border}`,
                          borderRadius: 8,
                          padding: '7px 10px',
                          background: 'rgba(255,255,255,0.02)',
                        }}
                      >
                        <div style={{ fontSize: 11, color: C.ice60 }}>{`${evt.type}${evt.at ? ` | ${evt.at}` : ''}`}</div>
                        <div style={{ marginTop: 2, fontSize: 11, color: C.ice30 }}>
                          {(() => {
                            const actor = [
                              evt.actor || '',
                              evt.actor_role ? `[${evt.actor_role}]` : '',
                              evt.actor_email ? `<${evt.actor_email}>` : '',
                            ]
                              .filter(Boolean)
                              .join(' ');
                            const detail = evt.detail || '--';
                            return actor ? `${actor} | ${detail}` : detail;
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlowCard>
          </div>
        </>
      )}
    </div>
  );
}
