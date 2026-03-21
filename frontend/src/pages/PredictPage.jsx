import { useState, useCallback } from 'react';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useSettings } from '../contexts/SettingsContext';
import SectionTitle from '../components/SectionTitle';

import { runPrediction, fetchPredictMetrics, fetchPerformanceCurve, fetchPerformanceComparison } from '../services/api';

// Sub-components
import { VARIABLE_DEFS, VIEW_MODE_IDS, TRIPTYCH_PANEL_DEFS } from './PredictPage/PredictComponents';
import PredictSidebar from './PredictPage/PredictSidebar';
import PredictDisplay from './PredictPage/PredictDisplay';
import PredictMetrics from './PredictPage/PredictMetrics';
import PredictPerformance from './PredictPage/PredictPerformance';
import PredictBarChart from './PredictPage/PredictBarChart';
import ShapleyImportanceChart from './PredictPage/ShapleyImportanceChart';
import PredictFullscreenHUD from './PredictPage/PredictFullscreenHUD';

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
  const precision = settings.precision;
  const ozoneUnit = settings.units.ozone;
  const isLight = settings.theme === 'light';

  // Constants mapping
  const VARIABLES = VARIABLE_DEFS.map(v => ({ ...v, label: t(`predict.variables.${v.id}`) }));
  const VIEW_MODES = VIEW_MODE_IDS.map(id => ({ id, label: t(`predict.viewModes.${id}`) }));
  const TRIPTYCH_PANELS = TRIPTYCH_PANEL_DEFS.map(p => ({ ...p, title: t(`predict.panels.${p.key}`) }));

  // Style Tokens (for plots)
  const plotTextColor = isLight ? 'rgba(26,26,46,0.5)' : 'rgba(232,237,243,0.3)';
  const plotText60 = isLight ? 'rgba(26,26,46,0.65)' : 'rgba(232,237,243,0.6)';
  const plotGridColor = isLight ? 'rgba(26,26,46,0.08)' : 'rgba(255,255,255,0.05)';

  // --- State ---
  const [selectedVars, setSelectedVars] = useState(VARIABLE_DEFS.map((v) => v.id));
  const [predStep, setPredStep] = useState(3);
  const [lsStart, setLsStart] = useState(90);
  const [marsYear, setMarsYear] = useState(27);
  const [activeHorizon, setActiveHorizon] = useState(0);
  const [viewMode, setViewMode] = useState('triptych');

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);

  const [fullscreen3D, setFullscreen3D] = useState(null); // { fieldData, colorMode }

  const [performanceData, setPerformanceData] = useState(null);
  const [perfLoading, setPerfLoading] = useState(false);
  const [activePerfMetric, setActivePerfMetric] = useState('r2');

  const [compareConfigs, setCompareConfigs] = useState([]);
  const [selectedCompareIds, setSelectedCompareIds] = useState([]);
  const [activeCompareId, setActiveCompareId] = useState(null);
  const [hiddenCompareIds, setHiddenCompareIds] = useState([]); // 新增：仅控制图表显隐的状态
  const [showShapley, setShowShapley] = useState(false); // 控制特征贡献度的显示与隐藏
  
  // --- Handlers ---
  const toggleVar = (id) => {
    setSelectedVars((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handlePredict = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setMetrics(null);

    const body = {
      selected_variables: selectedVars,
      horizon: predStep,
      ls_start: lsStart,
      mars_year: marsYear,
    };

    try {
      const [predResult, metricsResult] = await Promise.all([
        runPrediction(body),
        fetchPredictMetrics(body),
      ]);
      setResults(predResult);
      setMetrics(metricsResult);
      setActiveHorizon(0);
    } catch (e) {
      setError(e.message || t('predict.errorPrefix'));
    } finally {
      setLoading(false);
    }
  }, [selectedVars, predStep, lsStart, marsYear, t]);

  const handleFetchPerformance = useCallback(async () => {
    setPerfLoading(true);
    try {
      if (selectedCompareIds.length > 0) {
        // 模式 1: 通选模式（只要勾选了任何对比项，就不显示 "current"）
        const configs = compareConfigs
          .filter(c => selectedCompareIds.includes(c.id) && !c.isEnsemble)
          .map(c => c.vars);

        let res = { results: {} };
        if (configs.length > 0) {
          res = await fetchPerformanceComparison(configs);
          console.log('fetchPerformanceComparison RAW:', res);
        }

        // 注入本地计算的 Ensemble 数据
        compareConfigs.forEach(c => {
          if (c.isEnsemble && selectedCompareIds.includes(c.id)) {
            res.results[c.id] = c.data;
          }
        });

        setPerformanceData(res);
      } else {
        // 模式 2: 单个模式（未勾选任何对比项，显示当前所选变量的模型性能）
        const body = {
          selected_variables: selectedVars,
          horizon: predStep,
          ls_start: lsStart,
          mars_year: marsYear,
        };
        const res = await fetchPerformanceCurve(body);
        console.log('fetchPerformanceCurve RAW (current):', res);
        const key = selectedVars.length === 0 ? 'baseline' : 'current';
        setPerformanceData({ results: { [key]: res } });
      }
    } catch (e) {
      console.error('Fetch performance error:', e);
    } finally {
      setPerfLoading(false);
    }
  }, [selectedVars, predStep, lsStart, marsYear, selectedCompareIds, compareConfigs]);

  const handleFuseModels = useCallback(async () => {
    console.log('Fusion triggered. selectedCompareIds:', selectedCompareIds);
    if (selectedCompareIds.length < 2) return;

    let currentPerfData = performanceData;

    // 1. 检查是否有缺失的数据 (排除 Ensemble 项)
    const missingConfigs = compareConfigs.filter(c => {
      if (!selectedCompareIds.includes(c.id) || c.isEnsemble) return false;
      const sh = getShorthands(c.vars);
      return !(currentPerfData?.results?.[c.id] || currentPerfData?.results?.[sh]);
    });

    if (missingConfigs.length > 0) {
      console.log(`Fetching ${missingConfigs.length} missing performance configs...`);
      setPerfLoading(true);
      try {
        const configsToFetch = missingConfigs.map(c => c.vars);
        const res = await fetchPerformanceComparison(configsToFetch);
        console.log('fetchPerformanceComparison (Fusion) RAW:', res);

        // 关键：更新局部引用，供后续计算直接使用
        const newResults = { ...(currentPerfData?.results || {}), ...res.results };
        currentPerfData = { ...currentPerfData, results: newResults };

        // 同步更新全局状态
        setPerformanceData(currentPerfData);
      } catch (e) {
        console.error('Failed to fetch missing data for fusion:', e);
        return;
      } finally {
        setPerfLoading(false);
      }
    }

    // 2. 辅助函数：根据 ID 或变量缩写查找 perf 数据
    const findPerfById = (id, data) => {
      if (!data?.results) return null;
      if (data.results[id]) return data.results[id];
      const config = compareConfigs.find(c => c.id === id);
      if (config && !config.isEnsemble) {
        const sh = getShorthands(config.vars);
        return data.results[sh] || null;
      }
      return null;
    };

    // 3. 筛选出选中的模型数据
    const selectedPerfs = selectedCompareIds
      .map(id => ({ id, data: findPerfById(id, currentPerfData) }))
      .filter(item => item.data != null);

    console.log(`Found ${selectedPerfs.length} valid performance sets for fusion`);

    if (selectedPerfs.length < 2) return;

    // 4. 获取对应的 Label
    const selectedLabels = compareConfigs
      .filter(c => selectedCompareIds.includes(c.id))
      .map(c => c.label);

    // 5. 简单算术平均融合
    const firstPerf = selectedPerfs[0]?.data;
    if (!firstPerf || !firstPerf.items) {
      console.error('No valid items found in the first selected performance set');
      return;
    }
    const itemCount = firstPerf.items.length;
    const fusedItems = [];

    for (let i = 0; i < itemCount; i++) {
      const base = firstPerf.items[i];
      const fusedPoint = { my: base.my, ls: base.ls };

      ['r2', 'rmse', 'mae', 'ssim'].forEach(metric => {
        let sum = 0, validCount = 0;
        selectedPerfs.forEach(p => {
          const val = p.data.items[i] ? p.data.items[i][metric] : null;
          if (val != null) { sum += val; validCount++; }
        });
        fusedPoint[metric] = validCount > 0 ? sum / validCount : 0;
      });
      fusedItems.push(fusedPoint);
    }

    const fuseId = `ensemble_${Date.now()}`;
    const fuseLabel = `Ens: ${selectedLabels.join('+')}`;

    // 6. 计算全局指标均值
    const globalMetrics = {};
    ['global_r2', 'global_rmse', 'global_mae', 'global_ssim'].forEach(gm => {
      let sum = 0, validCount = 0;
      selectedPerfs.forEach(p => {
        const val = p.data[gm];
        if (val != null) { sum += val; validCount++; }
      });
      globalMetrics[gm] = validCount > 0 ? sum / validCount : 0;
    });

    const newEnsembleConfig = {
      id: fuseId,
      label: fuseLabel,
      vars: [],
      isEnsemble: true,
      data: { items: fusedItems, ...globalMetrics }
    };

    console.log('New Ensemble created:', fuseLabel);

    // 批量同步更新所有相关状态，确保图表在单次重渲染中获取完整数据
    setCompareConfigs(prev => [...prev, newEnsembleConfig]);
    setSelectedCompareIds(prev => [...prev, fuseId]);
    setActiveCompareId(fuseId);
    setPerformanceData(prev => ({
      ...(prev || { results: {} }),
      results: {
        ...(prev?.results || {}),
        [fuseId]: newEnsembleConfig.data
      }
    }));
  }, [performanceData, selectedCompareIds, compareConfigs]);

  // --- Derived ---
  const step = results ? Math.min(activeHorizon, (results.horizon || 1) - 1) : 0;
  const truthField = results?.ground_truth?.[step] ?? null;
  const predField = results?.prediction?.[step] ?? null;
  const residField = results?.residual?.[step] ?? null;
  const stepLs = results?.ls_values?.[step];

  const stepLabel = (ls) => ls != null ? ` · Ls=${ls.toFixed(3)}°` : '';

  return (
    <div className="page-enter" style={{ padding: '100px 40px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <SectionTitle title={t('predict.title')} subtitle={t('predict.subtitle')} />

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
        <PredictSidebar
          loading={loading}
          error={error}
          marsYear={marsYear}
          setMarsYear={setMarsYear}
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
          handleFuseModels={handleFuseModels}
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
            results={results}
            precision={precision}
            ozoneUnit={ozoneUnit}
            activeHorizon={activeHorizon}
            setActiveHorizon={setActiveHorizon}
            lsStart={lsStart}
            marsYear={marsYear}
          />

          <PredictBarChart
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

          {showShapley && (
            <ShapleyImportanceChart
              plotTextColor={plotTextColor}
              plotGridColor={plotGridColor}
              precision={precision}
              onClose={() => setShowShapley(false)}
            />
          )}

          <PredictPerformance
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
    </div>
  );
}
