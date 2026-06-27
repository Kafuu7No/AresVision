const FULL_VISIBILITY = {
  predictionFields: true,
  metrics: true,
  errorDistribution: true,
  permutationImportance: true,
  performanceComparison: true,
  selectionPerformance: true,
  shapley: true,
  inputVariables: true,
  systemHyperparams: true,
  dataSourceControl: true,
  trainedModelParameters: true,
  compareSummary: false,
  compareMetricBars: false,
  compareStepCurves: false,
  compareErrorDistribution: false,
  comparePfi: false,
  compareParameterMatrix: false,
};

export function getPredictAnalysisVisibility(modelMode = 'system') {
  if (modelMode === 'trained_compare') {
    return {
      ...FULL_VISIBILITY,
      predictionFields: false,
      metrics: false,
      errorDistribution: false,
      permutationImportance: false,
      performanceComparison: false,
      selectionPerformance: false,
      shapley: false,
      inputVariables: false,
      systemHyperparams: false,
      dataSourceControl: false,
      trainedModelParameters: false,
      compareSummary: true,
      compareMetricBars: true,
      compareParameterMatrix: true,
    };
  }

  if (modelMode !== 'trained') return { ...FULL_VISIBILITY };

  return {
    ...FULL_VISIBILITY,
    performanceComparison: false,
    selectionPerformance: false,
    shapley: false,
    inputVariables: false,
    systemHyperparams: false,
    dataSourceControl: false,
    trainedModelParameters: true,
  };
}
