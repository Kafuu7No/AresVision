import { useState, useCallback, useEffect, useMemo } from 'react';
import { getPredictCache, setPredictCache } from '../stores/predictCache';
import C from '../constants/colors';
import { useT } from '../i18n';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import SectionTitle from '../components/SectionTitle';

import {
  runPrediction,
  fetchPredictMetrics,
  fetchPerformanceCurve,
  fetchPerformanceComparison,
  fetchErrorDistribution,
  fetchPermutationImportance,
  fetchDataInfo,
  fetchTasks,
  compareTrainingModelErrorDistributions,
  compareTrainingModelPfi,
  compareTrainingModels,
} from '../services/api';
import {
  getPersonalSourceAvailability,
  getPersonalSourceBlockedMessage,
  getPersonalSourceCheckFailedMessage,
  getPersonalSourceLoginRequiredMessage,
  isPersonalSourceInsufficient,
} from '../utils/personalSourceGuard';

import { VARIABLE_DEFS, VIEW_MODE_IDS, TRIPTYCH_PANEL_DEFS } from './PredictPage/PredictComponents';
import PredictSidebar from './PredictPage/PredictSidebar';
import PredictDisplay from './PredictPage/PredictDisplay';
import PredictMetrics from './PredictPage/PredictMetrics';
import PredictBarChart from './PredictPage/PredictBarChart';
import ShapleyImportanceChart from './PredictPage/ShapleyImportanceChart';
import PredictFullscreenHUD from './PredictPage/PredictFullscreenHUD';
import ErrorDistributionChart from './PredictPage/ErrorDistributionChart';
import PermutationImportanceChart from './PredictPage/PermutationImportanceChart';
import { getPredictAnalysisVisibility } from './PredictPage/predictAnalysisVisibility';
import {
  TRAINING_TASK_HANDOFF_KEY,
  getCompletedTrainingModelOptions,
  parseTrainingTaskHandoff,
} from './PredictPage/trainedModelSelection';
import {
  buildPerformanceMetricsFromEval,
} from './PredictPage/trainedModelAnalysisData';
import {
  buildErrorDistributionKey,
  buildPermutationImportanceKey,
  buildPredictMetricsKey,
  buildTrainingModelCompareKey,
} from './PredictPage/predictAnalysisCacheKeys';
import CompareTrainingModelsPanel from './PredictPage/CompareTrainingModels/CompareTrainingModelsPanel';
import { getCompareSelectionState } from './PredictPage/CompareTrainingModels/compareTrainingModelsData';

const SHORTHAND_MAP = {
  Temperature: 'T',
  Dust_Optical_Depth: 'D',
  Surface_Pressure: 'P',
  Solar_Flux_DN: 'S',
  U_Wind: 'U',
  V_Wind: 'V',
};

const PERSONAL_BOUNCE_MS = 720;

const getShorthands = (vars) => {
  if (!vars || vars.length === 0) return 'baseline';
  return vars.map((v) => SHORTHAND_MAP[v] || v[0]).sort().join('');
};

export default function PredictPage() {
  const t = useT();
  const { settings } = useSettings();
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  const precision = settings.precision;
  const ozoneUnit = settings.units.ozone;
  const isLight = settings.theme === 'light';

  const VARIABLES = VARIABLE_DEFS.map((v) => ({ ...v, label: t(`predict.variables.${v.id}`) }));
  const VIEW_MODES = VIEW_MODE_IDS.map((id) => ({ id, label: t(`predict.viewModes.${id}`) }));
  const TRIPTYCH_PANELS = TRIPTYCH_PANEL_DEFS.map((p) => ({ ...p, title: t(`predict.panels.${p.key}`) }));

  const plotTextColor = isLight ? 'rgba(23,33,47,0.96)' : 'rgba(236,244,255,0.96)';
  const plotText60 = isLight ? 'rgba(23,33,47,0.76)' : 'rgba(214,228,244,0.78)';
  const plotGridColor = isLight ? 'rgba(23,33,47,0.12)' : 'rgba(160,196,240,0.16)';

  const _c = getPredictCache();

  const [selectedVars, setSelectedVars] = useState(_c.params?.selectedVars ?? VARIABLE_DEFS.map((v) => v.id));
  const [predStep, setPredStep] = useState(_c.params?.predStep ?? 3);
  const [lsStart, setLsStart] = useState(_c.params?.lsStart ?? 90);
  const [marsYear, setMarsYear] = useState(_c.params?.marsYear ?? 27);
  const [dataSourceMode, setDataSourceMode] = useState(_c.params?.dataSource ?? 'default');
  const [modelMode, setModelMode] = useState(_c.params?.modelMode ?? 'system');
  const [trainingTasks, setTrainingTasks] = useState([]);
  const [trainingTasksLoading, setTrainingTasksLoading] = useState(false);
  const [trainingTasksLoaded, setTrainingTasksLoaded] = useState(false);
  const [selectedTrainingTaskId, setSelectedTrainingTaskId] = useState(_c.params?.trainingTaskId ?? null);
  const [selectedCompareTrainingTaskIds, setSelectedCompareTrainingTaskIds] = useState(_c.selectedCompareTrainingTaskIds ?? []);
  const [switchPreviewMode, setSwitchPreviewMode] = useState(null);
  const [sourceMeta, setSourceMeta] = useState(null);
  const [availableMarsYears, setAvailableMarsYears] = useState([27, 28]);
  const [activeHorizon, setActiveHorizon] = useState(_c.activeHorizon);
  const [viewMode, setViewMode] = useState(_c.viewMode);

  const [loading, setLoading] = useState(false);
  const [isSwitchingSource, setIsSwitchingSource] = useState(false);
  const [results, setResults] = useState(_c.results);
  const [metrics, setMetrics] = useState(_c.metrics);
  const [errorDistData, setErrorDistData] = useState(_c.errorDistData);
  const [pfiData, setPfiData] = useState(_c.pfiData);
  const [metricsKey, setMetricsKey] = useState(_c.metricsKey ?? null);
  const [errorDistKey, setErrorDistKey] = useState(_c.errorDistKey ?? null);
  const [pfiKey, setPfiKey] = useState(_c.pfiKey ?? null);
  const [compareTrainingMetricsData, setCompareTrainingMetricsData] = useState(_c.compareTrainingMetricsData ?? null);
  const [compareTrainingMetricsKey, setCompareTrainingMetricsKey] = useState(_c.compareTrainingMetricsKey ?? null);
  const [compareTrainingErrorData, setCompareTrainingErrorData] = useState(_c.compareTrainingErrorData ?? null);
  const [compareTrainingErrorKey, setCompareTrainingErrorKey] = useState(_c.compareTrainingErrorKey ?? null);
  const [compareTrainingPfiData, setCompareTrainingPfiData] = useState(_c.compareTrainingPfiData ?? null);
  const [compareTrainingPfiKey, setCompareTrainingPfiKey] = useState(_c.compareTrainingPfiKey ?? null);
  const [compareTrainingLoading, setCompareTrainingLoading] = useState(false);
  const [compareTrainingErrorLoading, setCompareTrainingErrorLoading] = useState(false);
  const [compareTrainingPfiLoading, setCompareTrainingPfiLoading] = useState(false);
  const [error, setError] = useState(null);

  const [fullscreen3D, setFullscreen3D] = useState(null);

  const [performanceData, setPerformanceData] = useState(_c.performanceData);
  const [perfLoading, setPerfLoading] = useState(false);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [errorDistLoading, setErrorDistLoading] = useState(false);
  const [pfiLoading, setPfiLoading] = useState(false);
  const [activePerfMetric, setActivePerfMetric] = useState('r2');

  const [compareConfigs, setCompareConfigs] = useState(_c.compareConfigs);
  const [selectedCompareIds, setSelectedCompareIds] = useState(_c.selectedCompareIds);
  const [showShapley, setShowShapley] = useState({ visible: false, mode: 'gradient' });

  const analysisVisibility = useMemo(
    () => getPredictAnalysisVisibility(modelMode),
    [modelMode]
  );
  const trainingModelOptions = useMemo(
    () => getCompletedTrainingModelOptions(trainingTasks),
    [trainingTasks]
  );
  const selectedTrainingOption = useMemo(
    () => trainingModelOptions.find((option) => option.id === Number(selectedTrainingTaskId)) || null,
    [selectedTrainingTaskId, trainingModelOptions]
  );
  const compareSelection = useMemo(
    () => getCompareSelectionState(selectedCompareTrainingTaskIds),
    [selectedCompareTrainingTaskIds]
  );
  const compareSelectionIdKey = compareSelection.ids.join(',');
  const currentCompareTrainingMetricsKey = useMemo(
    () => buildTrainingModelCompareKey({
      taskIds: compareSelection.ids,
      horizon: predStep,
      compareType: 'metrics',
    }),
    [compareSelectionIdKey, predStep]
  );
  const activeCompareTrainingData = currentCompareTrainingMetricsKey === compareTrainingMetricsKey
    ? compareTrainingMetricsData
    : null;
  const currentCompareTrainingErrorKey = useMemo(
    () => buildTrainingModelCompareKey({
      taskIds: compareSelection.ids,
      horizon: predStep,
      compareType: 'error-distribution',
    }),
    [compareSelectionIdKey, predStep]
  );
  const activeCompareTrainingErrorData = currentCompareTrainingErrorKey === compareTrainingErrorKey
    ? compareTrainingErrorData
    : null;
  const currentCompareTrainingPfiKey = useMemo(
    () => buildTrainingModelCompareKey({
      taskIds: compareSelection.ids,
      horizon: predStep,
      compareType: 'pfi',
    }),
    [compareSelectionIdKey, predStep]
  );
  const activeCompareTrainingPfiData = currentCompareTrainingPfiKey === compareTrainingPfiKey
    ? compareTrainingPfiData
    : null;

  const toggleVar = (id) => {
    setSelectedVars((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  useEffect(() => {
    if (!isLoading && !user && dataSourceMode === 'personal') {
      setDataSourceMode('default');
    }
  }, [dataSourceMode, isLoading, user]);

  useEffect(() => {
    const handoff = parseTrainingTaskHandoff(sessionStorage.getItem(TRAINING_TASK_HANDOFF_KEY));
    if (!handoff) return;

    sessionStorage.removeItem(TRAINING_TASK_HANDOFF_KEY);
    setModelMode('trained');
    setSelectedTrainingTaskId(handoff.taskId);
  }, []);

  useEffect(() => {
    if (isLoading) return undefined;

    if (!user) {
      setTrainingTasks([]);
      setTrainingTasksLoading(false);
      setTrainingTasksLoaded(false);
      if (modelMode === 'trained' || modelMode === 'trained_compare') {
        setModelMode('system');
        setSelectedTrainingTaskId(null);
        setSelectedCompareTrainingTaskIds([]);
      }
      return undefined;
    }

    let active = true;
    setTrainingTasksLoading(true);
    setTrainingTasksLoaded(false);

    fetchTasks()
      .then((items) => {
        if (!active) return;
        setTrainingTasks(Array.isArray(items) ? items : []);
      })
      .catch(() => {
        if (!active) return;
        setTrainingTasks([]);
      })
      .finally(() => {
        if (!active) return;
        setTrainingTasksLoading(false);
        setTrainingTasksLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [isLoading, user?.id]);

  useEffect(() => {
    if (modelMode !== 'trained' || trainingTasksLoading || !trainingTasksLoaded) return;
    if (trainingModelOptions.length === 0) {
      setSelectedTrainingTaskId(null);
      return;
    }
    if (!selectedTrainingOption) {
      setSelectedTrainingTaskId(trainingModelOptions[0].id);
    }
  }, [modelMode, selectedTrainingOption, trainingModelOptions, trainingTasksLoaded, trainingTasksLoading]);

  useEffect(() => {
    if (switchPreviewMode && dataSourceMode !== switchPreviewMode) {
      setSwitchPreviewMode(null);
    }
  }, [dataSourceMode, switchPreviewMode]);

  useEffect(() => {
    let active = true;
    setIsSwitchingSource(true);

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
      })
      .finally(() => {
        if (!active) return;
        setIsSwitchingSource(false);
      });

    return () => {
      active = false;
    };
  }, [dataSourceMode, user?.id]);

  const handleDataSourceModeChange = useCallback(async (nextMode) => {
    if (isSwitchingSource || nextMode === dataSourceMode) return;
    if (nextMode !== 'personal') {
      setSwitchPreviewMode(null);
      setDataSourceMode(nextMode);
      return;
    }
    if (!user) {
      showToast(getPersonalSourceLoginRequiredMessage(settings?.language !== 'en'), 'error');
      return;
    }

    try {
      setIsSwitchingSource(true);
      const { blocked } = await getPersonalSourceAvailability();
      if (blocked) {
        showToast(getPersonalSourceBlockedMessage(settings?.language !== 'en'), 'error');
        setIsSwitchingSource(false);
        return;
      }
      const info = await fetchDataInfo({ dataSource: 'personal' });
      if (isPersonalSourceInsufficient(info?.source_meta)) {
        setSwitchPreviewMode('personal');
        window.setTimeout(() => {
          setSwitchPreviewMode(null);
        }, PERSONAL_BOUNCE_MS);
        showToast(info?.source_meta?.message || getPersonalSourceCheckFailedMessage(settings?.language !== 'en'), 'error');
        setIsSwitchingSource(false);
        return;
      }
      setSwitchPreviewMode(null);
      setDataSourceMode('personal');
    } catch {
      showToast(getPersonalSourceCheckFailedMessage(settings?.language !== 'en'), 'error');
      setIsSwitchingSource(false);
    }
  }, [dataSourceMode, isSwitchingSource, settings?.language, showToast, user]);

  const handlePredict = useCallback(async () => {
    if (isSwitchingSource) return;
    if (modelMode === 'trained_compare') {
      const compareTaskIds = compareSelection.ids;
      if (!compareSelection.canCompare) {
        setError(settings?.language !== 'en' ? '至少选择 2 个已完成训练模型。' : 'Select at least 2 completed trained models.');
        return;
      }
      const nextCompareKey = currentCompareTrainingMetricsKey;
      if (!nextCompareKey) {
        setError(settings?.language !== 'en' ? '至少选择 2 个已完成训练模型。' : 'Select at least 2 completed trained models.');
        return;
      }
      setError(null);
      if (nextCompareKey === compareTrainingMetricsKey && compareTrainingMetricsData) {
        return;
      }
      setCompareTrainingLoading(true);
      try {
        const compareResult = await compareTrainingModels(compareTaskIds, { horizon: predStep });
        setCompareTrainingMetricsData(compareResult);
        setCompareTrainingMetricsKey(nextCompareKey);
        setPredictCache({
          compareTrainingMetricsData: compareResult,
          compareTrainingMetricsKey: nextCompareKey,
          selectedCompareTrainingTaskIds: compareTaskIds,
          params: {
            selectedVars,
            predStep,
            lsStart,
            marsYear,
            dataSource: dataSourceMode,
            modelMode,
            compareTrainingTaskIds: compareTaskIds,
          },
        });
      } catch (e) {
        setError(e.message || (settings?.language !== 'en' ? '多模型对比失败。' : 'Training model comparison failed.'));
      } finally {
        setCompareTrainingLoading(false);
      }
      return;
    }

    const trainingTaskId = modelMode === 'trained' ? Number(selectedTrainingTaskId) : null;
    if (modelMode === 'trained' && (!Number.isFinite(trainingTaskId) || trainingTaskId <= 0)) {
      setError(settings?.language !== 'en' ? '请先选择一个已完成的训练模型。' : 'Select a completed trained model first.');
      return;
    }

    setError(null);
    setLoading(true);

    const body = {
      selected_variables: selectedVars,
      horizon: predStep,
      ls_start: lsStart,
      mars_year: marsYear,
      ...(trainingTaskId ? { training_task_id: trainingTaskId } : {}),
    };
    const analysisContext = {
      modelMode,
      trainingTaskId,
      horizon: predStep,
      selectedVars,
      dataSourceMode,
      marsYear,
      lsStart,
    };
    const nextMetricsKey = buildPredictMetricsKey(analysisContext);
    const nextErrorDistKey = analysisVisibility.errorDistribution
      ? buildErrorDistributionKey(analysisContext)
      : null;
    const nextPfiKey = analysisVisibility.permutationImportance
      ? buildPermutationImportanceKey(analysisContext)
      : null;
    const shouldFetchMetrics = Boolean(nextMetricsKey) && (nextMetricsKey !== metricsKey || !metrics);
    const shouldFetchErrorDist = Boolean(nextErrorDistKey) && (nextErrorDistKey !== errorDistKey || !errorDistData);
    const shouldFetchPfi = Boolean(nextPfiKey) && (nextPfiKey !== pfiKey || !pfiData);

    if (shouldFetchMetrics) {
      setMetricsLoading(true);
    }
    if (shouldFetchErrorDist) {
      setErrorDistLoading(true);
    }
    if (shouldFetchPfi) {
      setPfiLoading(true);
    }

    try {
      const [predResult, metricsResult] = await Promise.all([
        runPrediction(body, { dataSource: dataSourceMode }),
        shouldFetchMetrics
          ? fetchPredictMetrics(body, { dataSource: dataSourceMode })
          : Promise.resolve(metrics),
      ]);

      const errorDistPromise = analysisVisibility.errorDistribution
        ? !nextErrorDistKey
          ? Promise.resolve(null)
          : !shouldFetchErrorDist
          ? Promise.resolve(errorDistData)
          : modelMode === 'trained'
          ? fetchErrorDistribution(predResult.selected_variables || [], {
              trainingTaskId,
              horizon: predStep,
            })
          : dataSourceMode === 'personal'
            ? Promise.resolve(null)
            : fetchErrorDistribution(selectedVars)
        : Promise.resolve(null);
      const pfiVariables = modelMode === 'trained'
        ? (predResult.selected_variables || [])
        : selectedVars;
      const pfiPromise = analysisVisibility.permutationImportance
        ? !shouldFetchPfi
          ? Promise.resolve(pfiData)
          : fetchPermutationImportance(pfiVariables, {
              trainingTaskId,
              marsYear,
              lsStart,
              horizon: predStep,
            })
        : Promise.resolve(null);
      const [errorDistResult, pfiResult] = await Promise.all([errorDistPromise, pfiPromise]);
      const nextPerformanceData = modelMode === 'trained'
        ? { results: { current: buildPerformanceMetricsFromEval(metricsResult) } }
        : performanceData;

      setResults(predResult);
      setMetrics(metricsResult);
      setErrorDistData(errorDistResult);
      setPfiData(pfiResult);
      if (nextMetricsKey) setMetricsKey(nextMetricsKey);
      setErrorDistKey(nextErrorDistKey);
      if (nextPfiKey) setPfiKey(nextPfiKey);
      if (modelMode === 'trained') {
        setPerformanceData(nextPerformanceData);
      }
      setActiveHorizon(0);
      setPredictCache({
        results: predResult,
        metrics: metricsResult,
        errorDistData: errorDistResult,
        pfiData: pfiResult,
        metricsKey: nextMetricsKey,
        errorDistKey: nextErrorDistKey,
        pfiKey: nextPfiKey,
        performanceData: nextPerformanceData,
        activeHorizon: 0,
        params: {
          selectedVars,
          predStep,
          lsStart,
          marsYear,
          dataSource: dataSourceMode,
          modelMode,
          trainingTaskId,
        },
      });
    } catch (e) {
      setError(e.message || t('predict.errorPrefix'));
    } finally {
      setLoading(false);
      setMetricsLoading(false);
      setErrorDistLoading(false);
      setPfiLoading(false);
    }
  }, [
    analysisVisibility.errorDistribution,
    analysisVisibility.permutationImportance,
    compareSelection,
    compareTrainingMetricsData,
    compareTrainingMetricsKey,
    currentCompareTrainingMetricsKey,
    dataSourceMode,
    errorDistData,
    errorDistKey,
    isSwitchingSource,
    lsStart,
    marsYear,
    metrics,
    metricsKey,
    modelMode,
    performanceData,
    predStep,
    pfiData,
    pfiKey,
    selectedTrainingTaskId,
    selectedVars,
    settings?.language,
    t,
  ]);

  const handleLoadCompareErrorDistribution = useCallback(async () => {
    if (!compareSelection.canCompare || !currentCompareTrainingErrorKey) {
      setError(settings?.language !== 'en' ? '至少选择 2 个已完成训练模型。' : 'Select at least 2 completed trained models.');
      return;
    }
    if (activeCompareTrainingErrorData) return;
    setError(null);
    setCompareTrainingErrorLoading(true);
    try {
      const result = await compareTrainingModelErrorDistributions(compareSelection.ids, { horizon: predStep });
      setCompareTrainingErrorData(result);
      setCompareTrainingErrorKey(currentCompareTrainingErrorKey);
      setPredictCache({
        compareTrainingErrorData: result,
        compareTrainingErrorKey: currentCompareTrainingErrorKey,
      });
    } catch (e) {
      setError(e.message || (settings?.language !== 'en' ? '误差分布对比失败。' : 'Error distribution comparison failed.'));
    } finally {
      setCompareTrainingErrorLoading(false);
    }
  }, [
    activeCompareTrainingErrorData,
    compareSelection,
    currentCompareTrainingErrorKey,
    predStep,
    settings?.language,
  ]);

  const handleLoadComparePfi = useCallback(async () => {
    if (!compareSelection.canCompare || !currentCompareTrainingPfiKey) {
      setError(settings?.language !== 'en' ? '至少选择 2 个已完成训练模型。' : 'Select at least 2 completed trained models.');
      return;
    }
    if (activeCompareTrainingPfiData) return;
    setError(null);
    setCompareTrainingPfiLoading(true);
    try {
      const result = await compareTrainingModelPfi(compareSelection.ids, { horizon: predStep });
      setCompareTrainingPfiData(result);
      setCompareTrainingPfiKey(currentCompareTrainingPfiKey);
      setPredictCache({
        compareTrainingPfiData: result,
        compareTrainingPfiKey: currentCompareTrainingPfiKey,
      });
    } catch (e) {
      setError(e.message || (settings?.language !== 'en' ? 'PFI 对比失败。' : 'PFI comparison failed.'));
    } finally {
      setCompareTrainingPfiLoading(false);
    }
  }, [
    activeCompareTrainingPfiData,
    compareSelection,
    currentCompareTrainingPfiKey,
    predStep,
    settings?.language,
  ]);

  useEffect(() => { setPredictCache({ viewMode }); }, [viewMode]);
  useEffect(() => { setPredictCache({ activeHorizon }); }, [activeHorizon]);
  useEffect(() => { setPredictCache({ performanceData }); }, [performanceData]);
  useEffect(() => { setPredictCache({ compareConfigs }); }, [compareConfigs]);
  useEffect(() => { setPredictCache({ selectedCompareIds }); }, [selectedCompareIds]);
  useEffect(() => { setPredictCache({ selectedCompareTrainingTaskIds }); }, [selectedCompareTrainingTaskIds]);
  useEffect(() => { setPredictCache({ pfiData }); }, [pfiData]);
  useEffect(() => { setPredictCache({ metricsKey }); }, [metricsKey]);
  useEffect(() => { setPredictCache({ errorDistKey }); }, [errorDistKey]);
  useEffect(() => { setPredictCache({ pfiKey }); }, [pfiKey]);
  useEffect(() => { setPredictCache({ compareTrainingMetricsData }); }, [compareTrainingMetricsData]);
  useEffect(() => { setPredictCache({ compareTrainingMetricsKey }); }, [compareTrainingMetricsKey]);
  useEffect(() => { setPredictCache({ compareTrainingErrorData }); }, [compareTrainingErrorData]);
  useEffect(() => { setPredictCache({ compareTrainingErrorKey }); }, [compareTrainingErrorKey]);
  useEffect(() => { setPredictCache({ compareTrainingPfiData }); }, [compareTrainingPfiData]);
  useEffect(() => { setPredictCache({ compareTrainingPfiKey }); }, [compareTrainingPfiKey]);

  useEffect(() => {
    if (analysisVisibility.performanceComparison) return;
    setPerformanceData(null);
    setErrorDistData(null);
    setPfiData(null);
    setShowShapley({ visible: false, mode: 'gradient' });
  }, [analysisVisibility.performanceComparison]);

  useEffect(() => {
    if (modelMode !== 'trained_compare') return;
    setResults(null);
    setMetrics(null);
    setPerformanceData(null);
    setErrorDistData(null);
    setPfiData(null);
    setShowShapley({ visible: false, mode: 'gradient' });
  }, [modelMode]);

  const handleFetchPerformance = useCallback(async () => {
    if (!analysisVisibility.performanceComparison) return;

    setPerfLoading(true);
    try {
      if (selectedCompareIds.length > 0) {
        const configs = compareConfigs
          .filter((c) => selectedCompareIds.includes(c.id))
          .map((c) => c.vars);

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
  }, [
    analysisVisibility.performanceComparison,
    compareConfigs,
    dataSourceMode,
    lsStart,
    marsYear,
    predStep,
    selectedCompareIds,
    selectedVars,
  ]);

  const step = results ? Math.min(activeHorizon, (results.horizon || 1) - 1) : 0;
  const truthField = results?.ground_truth?.[step] ?? null;
  const predField = results?.prediction?.[step] ?? null;
  const residField = results?.residual?.[step] ?? null;
  const stepLs = results?.ls_values?.[step];

  const stepLabel = (ls) => (ls != null ? ` · Ls=${ls.toFixed(3)}°` : '');

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
          loading={modelMode === 'trained_compare' ? compareTrainingLoading : loading}
          isSwitchingSource={isSwitchingSource}
          error={error}
          modelMode={modelMode}
          setModelMode={setModelMode}
          trainingModelOptions={trainingModelOptions}
          selectedTrainingTaskId={selectedTrainingTaskId}
          setSelectedTrainingTaskId={setSelectedTrainingTaskId}
          selectedCompareTrainingTaskIds={selectedCompareTrainingTaskIds}
          setSelectedCompareTrainingTaskIds={setSelectedCompareTrainingTaskIds}
          trainingTasksLoading={trainingTasksLoading}
          selectedTrainingOption={selectedTrainingOption}
          analysisVisibility={analysisVisibility}
          dataSourceMode={switchPreviewMode || dataSourceMode}
          setDataSourceMode={handleDataSourceModeChange}
          sourceMeta={sourceMeta}
          personalSourceDisabled={!user}
          personalSourceHint={!user ? getPersonalSourceLoginRequiredMessage(settings?.language !== 'en') : ''}
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
          onShapleyClick={(mode) => {
            if (analysisVisibility.shapley) {
              setShowShapley({ visible: true, mode });
            }
          }}
          currentMetrics={currentSelectionMetrics}
          perfLoading={perfLoading}
          handleFetchPerformance={handleFetchPerformance}
          precision={precision}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {analysisVisibility.predictionFields ? (
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
          ) : null}

          {analysisVisibility.metrics ? (
          <PredictMetrics
            loading={metricsLoading}
            metrics={metrics}
            precision={precision}
            ozoneUnit={ozoneUnit}
            modelMode={modelMode}
          />
          ) : null}

          {analysisVisibility.errorDistribution ? (
            <ErrorDistributionChart
              data={errorDistData}
              loading={errorDistLoading}
              isLight={isLight}
              plotTextColor={plotTextColor}
              plotText60={plotText60}
              plotGridColor={plotGridColor}
            />
          ) : null}

          {analysisVisibility.permutationImportance ? (
            <PermutationImportanceChart
              data={pfiData}
              loading={pfiLoading}
              plotTextColor={plotTextColor}
              plotText60={plotText60}
              plotGridColor={plotGridColor}
            />
          ) : null}

          {analysisVisibility.performanceComparison ? (
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
          ) : null}

          {analysisVisibility.compareSummary ? (
            <CompareTrainingModelsPanel
              data={activeCompareTrainingData}
              loading={compareTrainingLoading}
              errorDistributionData={activeCompareTrainingErrorData}
              errorDistributionLoading={compareTrainingErrorLoading}
              onLoadErrorDistribution={handleLoadCompareErrorDistribution}
              pfiData={activeCompareTrainingPfiData}
              pfiLoading={compareTrainingPfiLoading}
              onLoadPfi={handleLoadComparePfi}
              selectedCount={compareSelection.count}
              precision={precision}
              isZh={settings?.language !== 'en'}
              plotTextColor={plotTextColor}
              plotGridColor={plotGridColor}
            />
          ) : null}
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

      {analysisVisibility.shapley && showShapley.visible && (
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
