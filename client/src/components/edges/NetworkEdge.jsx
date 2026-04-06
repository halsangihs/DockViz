import React from "react";
import { BaseEdge, getBezierPath } from "@xyflow/react";

const NetworkEdge = ({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      style={{ ...style, cursor: "pointer" }}
      interactionWidth={20}
    />
  );
};

export default React.memo(NetworkEdge);
