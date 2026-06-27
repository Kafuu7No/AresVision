function pointKey(point) {
  return `${Number(point.lat).toFixed(3)}:${Number(point.lng).toFixed(3)}`;
}

function normalizeLayer(layer, fallbackId) {
  if (!layer) return null;
  const id = layer.source || fallbackId;
  return {
    id,
    source: id,
    points: layer.points || [],
    minVal: layer.minVal ?? 0,
    maxVal: layer.maxVal ?? 1,
    ls: layer.ls,
    variable: 'o3col',
  };
}

function buildDiffLayer(mcdLayer, comparisonLayer, id) {
  const comparisonByKey = new Map();
  (comparisonLayer?.points || []).forEach((point) => {
    if (Number.isFinite(point?.val)) comparisonByKey.set(pointKey(point), point.val);
  });

  const points = (mcdLayer?.points || [])
    .map((point) => {
      const comparisonValue = comparisonByKey.get(pointKey(point));
      if (!Number.isFinite(point?.val) || !Number.isFinite(comparisonValue)) return null;
      return {
        lat: point.lat,
        lng: point.lng,
        val: point.val - comparisonValue,
      };
    })
    .filter(Boolean);

  const values = points.map((point) => point.val).filter(Number.isFinite);
  const minVal = values.length ? Math.min(...values) : 0;
  const maxVal = values.length ? Math.max(...values) : 1;

  return {
    id,
    source: id,
    variable: 'o3col_diff',
    points,
    minVal,
    maxVal,
    ls: mcdLayer?.ls,
  };
}

export function buildOverviewSceneModel({
  globeVariable,
  ozoneDisplayMode,
  ozoneDiffPair,
  mainSlice,
  ozoneOverlay,
}) {
  if (globeVariable !== 'o3col') {
    return {
      renderMode: 'single',
      legendMode: 'continuous',
      colorMode: 'inferno',
      layers: [{ id: globeVariable, source: globeVariable, ...(mainSlice || {}) }],
    };
  }

  if (!ozoneOverlay || ozoneDisplayMode === 'mcd') {
    return {
      renderMode: 'single',
      legendMode: 'continuous',
      colorMode: 'inferno',
      layers: [{ id: 'mcd', source: 'mcd', ...(mainSlice || {}) }],
    };
  }

  const mcdLayer = normalizeLayer(ozoneOverlay.mcd || mainSlice, 'mcd');
  const openmarsLayer = normalizeLayer(ozoneOverlay.openmars, 'openmars');
  const nomadLayer = normalizeLayer(ozoneOverlay.nomad, 'nomad');
  const nomadValidation = ozoneOverlay.validation?.nomad || null;

  if (ozoneDisplayMode === 'validation') {
    if (!nomadValidation?.points?.length) {
      return {
        renderMode: 'single',
        legendMode: 'continuous',
        colorMode: 'inferno',
        layers: [mcdLayer],
        validation: ozoneOverlay.validation || null,
      };
    }

    return {
      renderMode: 'validation',
      legendMode: 'validation',
      colorMode: 'inferno',
      layers: [
        mcdLayer,
        {
          id: nomadValidation.comparison || 'MCD-NOMAD',
          source: 'nomad-validation',
          variable: 'o3col_diff',
          points: nomadValidation.points,
          minVal: nomadValidation.minDiff ?? 0,
          maxVal: nomadValidation.maxDiff ?? 1,
          ls: nomadValidation.matched_ls,
          colorMode: 'rdbu',
        },
      ],
      validation: ozoneOverlay.validation,
    };
  }

  if (ozoneDisplayMode === 'diff') {
    if (ozoneDiffPair === 'MCD-OpenMARS' && openmarsLayer) {
      return {
        renderMode: 'diff',
        legendMode: 'diff',
        colorMode: 'rdbu',
        layers: [buildDiffLayer(mcdLayer, openmarsLayer, 'MCD-OpenMARS')],
      };
    }
    if (ozoneDiffPair === 'MCD-NOMAD' && nomadLayer) {
      return {
        renderMode: 'diff',
        legendMode: 'diff',
        colorMode: 'rdbu',
        layers: [buildDiffLayer(mcdLayer, nomadLayer, 'MCD-NOMAD')],
      };
    }
  }

  const layers = [mcdLayer, openmarsLayer, nomadLayer].filter(Boolean);
  return {
    renderMode: layers.length > 1 ? 'multi-source' : 'single',
    legendMode: layers.length > 1 ? 'sources' : 'continuous',
    colorMode: 'inferno',
    layers,
  };
}
