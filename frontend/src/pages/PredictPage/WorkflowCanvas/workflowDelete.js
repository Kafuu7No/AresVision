export function deleteWorkflowSelection(nodes = [], edges = [], selection = {}) {
  const selectedNodeIds = new Set(selection.nodeIds || []);
  const selectedEdgeIds = new Set(selection.edgeIds || []);

  const nextNodes = nodes.filter((node) => !selectedNodeIds.has(node.id));
  const nextEdges = edges.filter((edge) => {
    if (selectedEdgeIds.has(edge.id)) return false;
    if (selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target)) return false;
    return true;
  });

  return { nodes: nextNodes, edges: nextEdges };
}
