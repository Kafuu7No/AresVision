export function areStringArraysEqual(first = [], second = []) {
  if (first.length !== second.length) return false;
  return first.every((value, index) => value === second[index]);
}

export function nextWorkflowSelection(current, next = {}) {
  const normalized = {
    nodeId: next.nodeId || null,
    edgeIds: Array.isArray(next.edgeIds) ? next.edgeIds : [],
  };

  if (
    current?.nodeId === normalized.nodeId
    && areStringArraysEqual(current?.edgeIds || [], normalized.edgeIds)
  ) {
    return current;
  }

  return normalized;
}

export function selectionFromReactFlowSelection(selection = {}) {
  return {
    nodeId: selection.nodes?.[0]?.id || null,
    edgeIds: (selection.edges || []).map((edge) => edge.id),
  };
}
