import { useState, useCallback, useEffect } from 'react';
import { getPredictCache, setPredictCache } from '../stores/predictCache';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import SectionTitle from '../components/SectionTitle';

import {
  runPrediction,
  fetchPredictMetrics,
  fetchPerformanceCurve,
  fetchPerformanceComparison,
  fetchErrorDistribution,
  fetchPermutationImportance,
  fetchDataInfo,
} from '../services/api';

// Sub-components
import { VARIABLE_DEFS, VIEW_MODE_IDS, TRIPTYCH_PANEL_DEFS } from './PredictPage/PredictComponents';
import PredictSidebar from './PredictPage/PredictSidebar';
import PredictDisplay from './PredictPage/PredictDisplay';
import PredictMetrics from './PredictPage/PredictMetrics';
import PredictPerformance from './PredictPage/PredictPerformance';
import PredictBarChart from './PredictPage/PredictBarChart';
import ShapleyImportanceChart from './PredictPage/ShapleyImportanceChart';
import PredictFullscreenHUD from './PredictPage/PredictFullscreenHUD';
import ErrorDistributionChart from './PredictPage/ErrorDistributionChart';
import PermutationImportanceChart from './PredictPage/PermutationImportanceChart';

const SHORTHAND_MAP = {
  'Temperature': 'T',
  'Dust_Optical_Depth': 'D',
  'Surface_Pressure': 'P',
  'Solar_Flux_DN': 'S',
  'U_Wind': 'U',
  'V_Wind': 'V'
};

const getShorthands = (vars) => {
  if (!vars || vars.length === 0) return 'baseline';
  return vars.map(v => SHORTHAND_MAP[v] || v[0]).sort().join('');
};

export default function PredictPage() {
  const t = useT();
  const { settings } = useSettings();
  const { user } = useAuth();
  const precision = settings.precision;
  const ozoneUnit = settings.units.ozone;
  const isLight = settings.theme === 'light';

  // Constants mapping
  const VARIABLES = VARIABLE_DEFS.map(v => ({ ...v, label: t(`predict.variables.${v.id}`) }));
  const VIEW_MODES = VIEW_MODE_IDS.map(id => ({ id, label: t(`predict.viewModes.${id}`) }));
  const TRIPTYCH_PANELS = TRIPTYCH_PANEL_DEFS.map(p => ({ ...p, title: t(`predict.panels.${p.key}`) }));

  // Style Tokens (for plots)
  const plotTextColor = isLight ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)';
  const plotText60 = isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';
  const plotGridColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';

  // --- State（从缓存恢复，切换页面后保留预测结果）---
  const _c = getPredictCache();

  const [selectedVars, setSelectedVars] = useState(_c.params?.selectedVars ?? VARIABLE_DEFS.map((v) => v.id));
  const [predStep, setPredStep] = useState(_c.params?.predStep ?? 3);
  const [lsStart, setLsStart] = useState(_c.params?.lsStart ?? 90);
  const [marsYear, setMarsYear] = useState(_c.params?.marsYear ?? 27);
  const [dataSourceMode, setDataSourceMode] = useState(_c.params?.dataSource ?? 'default');
  const [sourceMeta, setSourceMeta] = useState(null);
  const [availableMarsYears, setAvailableMarsYears] = useState([27, 28]);
  const [activeHorizon, setActiveHorizon] = useState(_c.activeHorizon);
  const [viewMode, setViewMode] = useState(_c.viewMode);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(_c.results);
  const [metrics, setMetrics] = useState(_c.metrics);
  const [errorDistData, setErrorDistData] = useState(_c.errorDistData);
  const [pfiData, setPfiData] = useState(_c.pfiData);
  const [error, setError] = useState(null);

  const [fullscreen3D, setFullscreen3D] = useState(null); // { fieldData, colorMode }

  const [performanceData, setPerformanceData] = useState(_c.performanceData);
  const [perfLoading, setPerfLoading] = useState(false);
  const [pfiLoading, setPfiLoading] = useState(false);
  const [activePerfMetric, setActivePerfMetric] = useState('r2');

  const [compareConfigs, setCompareConfigs] = useState(_c.compareConfigs);
  const [selectedCompareIds, setSelectedCompareIds] = useState(_c.selectedCompareIds);
  const [activeCompareId, setActiveCompareId] = useState(null);
  const [hiddenCompareIds, setHiddenCompareIds] = useState([]); // 新增：仅控制图表显隐的状态
  const [showShapley, setShowShapley] = useState({ visible: false, mode: 'gradient' }); // 控制特征贡献度的显示与隐藏


  // --- Handlers ---
  const toggleVar = (id) => {
    setSelectedVars((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  useEffect(() => {
    let active = true;
    fetchDataInfo({ dataSource: dataSourceMode })
      .then((info) => {
        if (!active) return;
        const years = Array.isArray(info?.available_years) && info.available_years.length > 0
          ? info.available_years
          : [27, 28];
        setAvailableMarsYears(years);
        setSourceMeta(info?.source_meta || null);
        setMarsYear((prev) => (years.includes(prev) ? prev : years[0]));
      })
      .catch(() => {
        if (!active) return;
        setAvailableMarsYears([27, 28]);
        setSourceMeta(null);
      });

    return () => {
      active = false;
    };
  }, [dataSourceMode, user?.id]);

  const handlePredict = useCallback(async () => {
    setMetrics(null);
    setErrorDistData(null);
    setPfiData(null);
    setLoading(true); // 注意：由于 PFI 可能较慢，loading 状态可能需要分段显示，这里先统一控制
    setPfiLoading(true);

    const body = {
      selected_variables: selectedVars,
      horizon: predStep,
      ls_start: lsStart,
      mars_year: marsYear,
    };

    try {
      const [predResult, metricsResult] = await Promise.all([
        runPrediction(body, { dataSource: dataSourceMode }),
        fetchPredictMetrics(body, { dataSource: dataSourceMode }),
      ]);
      const [errorDistResult, pfiResult] = dataSourceMode === 'personal'
        ? [null, null]
        : await Promise.all([
            fetchErrorDistribution(selectedVars),
            fetchPermutationImportance(selectedVars),
          ]);
      setResults(predResult);
      setMetrics(metricsResult);
      setErrorDistData(errorDistResult);
      setPfiData(pfiResult);
      setActiveHorizon(0);
      setPredictCache({
        results: predResult,
        metrics: metricsResult,
        errorDistData: errorDistResult,
        pfiData: pfiResult,
        activeHorizon: 0,
        params: { selectedVars, predStep, lsStart, marsYear, dataSource: dataSourceMode },
      });
    } catch (e) {
      setError(e.message || t('predict.errorPrefix'));
    } finally {
      setLoading(false);
      setPfiLoading(false);
    }
  }, [selectedVars, predStep, lsStart, marsYear, dataSourceMode, t]);

  // 同步 UI 状态到缓存（用户在页面内的操作也持久化）
  useEffect(() => { setPredictCache({ viewMode }); }, [viewMode]);
  useEffect(() => { setPredictCache({ activeHorizon }); }, [activeHorizon]);
  useEffect(() => { setPredictCache({ performanceData }); }, [performanceData]);
  useEffect(() => { setPredictCache({ compareConfigs }); }, [compareConfigs]);
  useEffect(() => { setPredictCache({ selectedCompareIds }); }, [selectedCompareIds]);
  useEffect(() => { setPredictCache({ pfiData }); }, [pfiData]);

  const handleFetchPerformance = useCallback(async () => {
    setPerfLoading(true);
    try {
      if (selectedCompareIds.length > 0) {
        // 模式 1: 通选模式（只要勾选了任何对比项，就不显示 "current"）
        const configs = compareConfigs
          .filter(c => selectedCompareIds.includes(c.id))
          .map(c => c.vars);

        let res = { results: {} };
        if (configs.length > 0) {
          res = await fetchPerformanceComparison(configs, {
            dataSource: dataSourceMode,
            marsYear,
          });
          console.log('fetchPerformanceComparison RAW:', res);
        }

        setPerformanceData(res);
      } else {
        // 模式 2: 单个模式（未勾选任何对比项，显示当前所选变量的模型性能）
        const body = {
          selected_variables: selectedVars,
          horizon: predStep,
          ls_start: lsStart,
          mars_year: marsYear,
        };
        const res = await fetchPerformanceCurve(body, { dataSource: dataSourceMode });
        console.log('fetchPerformanceCurve RAW (current):', res);
        const key = selectedVars.length === 0 ? 'baseline' : 'current';
        setPerformanceData({ results: { [key]: res } });
      }
    } catch (e) {
      console.error('Fetch performance error:', e);
    } finally {
      setPerfLoading(false);
    }
  }, [selectedVars, predStep, lsStart, marsYear, selectedCompareIds, compareConfigs, dataSourceMode]);



  // --- Derived ---
  const step = results ? Math.min(activeHorizon, (results.horizon || 1) - 1) : 0;
  const truthField = results?.ground_truth?.[step] ?? null;
  const predField = results?.prediction?.[step] ?? null;
  const residField = results?.residual?.[step] ?? null;
  const stepLs = results?.ls_values?.[step];

  const stepLabel = (ls) => ls != null ? ` · Ls=${ls.toFixed(3)}°` : '';

  // 提取当前测边栏所选变量对应的性能指标
  const currentSelectionShorthand = getShorthands(selectedVars);
  const currentSelectionMetrics = performanceData?.results?.[currentSelectionShorthand] 
    || performanceData?.results?.current 
    || performanceData?.results?.baseline 
    || null;

  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionTitle title={t('predict.title')} subtitle={t('predict.subtitle')} />

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
        <PredictSidebar
          isLight={isLight}
          loading={loading}
          error={error}
          dataSourceMode={dataSourceMode}
          setDataSourceMode={setDataSourceMode}
          sourceMeta={sourceMeta}
          marsYear={marsYear}
          setMarsYear={setMarsYear}
          availableMarsYears={availableMarsYears}
          lsStart={lsStart}
          setLsStart={setLsStart}
          predStep={predStep}
          setPredStep={setPredStep}
          selectedVars={selectedVars}
          toggleVar={toggleVar}
          VARIABLES={VARIABLES}
          handlePredict={handlePredict}
          compareConfigs={compareConfigs}
          selectedCompareIds={selectedCompareIds}
          setSelectedCompareIds={setSelectedCompareIds}
          setCompareConfigs={setCompareConfigs}
          onShapleyClick={(mode) => setShowShapley({ visible: true, mode })}
          currentMetrics={currentSelectionMetrics}
          perfLoading={perfLoading}
          handleFetchPerformance={handleFetchPerformance}
          precision={precision}
        />


        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <PredictDisplay
            viewMode={viewMode}
            setViewMode={setViewMode}
            VIEW_MODES={VIEW_MODES}
            results={results}
            activeHorizon={activeHorizon}
            setActiveHorizon={setActiveHorizon}
            loading={loading}
            truthField={truthField}
            predField={predField}
            residField={residField}
            stepLs={stepLs}
            stepLabel={stepLabel}
            setFullscreen3D={setFullscreen3D}
            TRIPTYCH_PANELS={TRIPTYCH_PANELS}
          />

          <PredictMetrics
            loading={loading}
            metrics={metrics}
            precision={precision}
            ozoneUnit={ozoneUnit}
          />

          <ErrorDistributionChart
            data={errorDistData}
            loading={loading}
            isLight={isLight}
            plotTextColor={plotTextColor}
            plotText60={plotText60}
            plotGridColor={plotGridColor}
          />

          <PermutationImportanceChart
            data={pfiData}
            loading={pfiLoading}
            plotTextColor={plotTextColor}
            plotText60={plotText60}
            plotGridColor={plotGridColor}
          />

          <PredictBarChart
            isLight={isLight}
            performanceData={performanceData}
            compareConfigs={compareConfigs}
            selectedCompareIds={selectedCompareIds}
            activeMetric={activePerfMetric}
            setActiveMetric={setActivePerfMetric}
            plotTextColor={plotTextColor}
            plotText60={plotText60}
            plotGridColor={plotGridColor}
            precision={precision}
            handleFetchPerformance={handleFetchPerformance}
            perfLoading={perfLoading}
            showShapley={showShapley}
            setShowShapley={setShowShapley}
          />

          <PredictPerformance
            isLight={isLight}
            performanceData={performanceData}
            perfLoading={perfLoading}
            activePerfMetric={activePerfMetric}
            setActivePerfMetric={setActivePerfMetric}
            handleFetchPerformance={handleFetchPerformance}
            compareConfigs={compareConfigs}
            activeCompareId={activeCompareId}
            setActiveCompareId={setActiveCompareId}
            plotTextColor={plotTextColor}
            plotText60={plotText60}
            plotGridColor={plotGridColor}
            precision={precision}
            selectedCompareIds={selectedCompareIds}
            setSelectedCompareIds={setSelectedCompareIds}
            hiddenCompareIds={hiddenCompareIds}
            setHiddenCompareIds={setHiddenCompareIds}
          />
        </div>
      </div>

      <PredictFullscreenHUD
        fullscreen3D={fullscreen3D}
        setFullscreen3D={setFullscreen3D}
        truthField={truthField}
        stepLs={stepLs}
        step={activeHorizon}
        precision={precision}
        ozoneUnit={ozoneUnit}
      />

      {showShapley.visible && (
        <ShapleyImportanceChart
          isLight={isLight}
          plotTextColor={plotTextColor}
          plotGridColor={plotGridColor}
          onClose={() => setShowShapley({ visible: false, mode: 'gradient' })}
          mode={showShapley.mode}
        />
      )}

    </div>
  );
}
