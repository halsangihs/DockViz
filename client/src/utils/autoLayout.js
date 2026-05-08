import dagre from "dagre";
import { Position } from "@xyflow/react";

const getLayoutedElements = ({ nodes, edges }) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: "TB", ranksep: 100, nodesep: 50 });

  nodes.forEach((node) => {
    const width = node.measured?.width ?? 250;
    const height = node.measured?.height ?? 150;

    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const layoutedNode = dagreGraph.node(node.id);
    const width = node.measured?.width ?? 250;
    const height = node.measured?.height ?? 150;

    return {
      ...node,
      targetPosition: Position.Top,
      sourcePosition: Position.Bottom,
      position: {
        x: layoutedNode.x - width / 2,
        y: layoutedNode.y - height / 2,
      },
    };
  });

  return { layoutedNodes, layoutedEdges: edges };
};

export default getLayoutedElements;
