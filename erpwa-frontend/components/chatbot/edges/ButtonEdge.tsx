import React from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getSmoothStepPath,
  useReactFlow,
} from "reactflow";

// Define vibrant distinct colors for each node type
const nodeColors: Record<string, string> = {
  start: "#a855f7", // purple-500
  message: "#06b6d4", // cyan-500
  button: "#f97316", // orange-500
  list: "#3b82f6", // blue-500
  image: "#ec4899", // pink-500
  gallery: "#10b981", // emerald-500
  default: "#94a3b8", // slate-400
};

export default function ButtonEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const { setEdges, getNode } = useReactFlow();
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = () => {
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  };

  const sourceNode = getNode(source);
  const targetNode = getNode(target);

  const sourceColor = sourceNode
    ? nodeColors[sourceNode.type as string] || nodeColors.default
    : nodeColors.default;
  const targetColor = targetNode
    ? nodeColors[targetNode.type as string] || nodeColors.default
    : nodeColors.default;

  // Use a sanitized code-safe ID for the gradient
  const gradientId = `gradient-${id.replace(/[^a-zA-Z0-9-]/g, "_")}`;

  return (
    <>
      {/* Define the gradient. React Flow edges are inside an SVG, so we can use defs directly. 
          However, putting it in portal or standard flow is safer. 
          Since we are inside the <g> of the edge, just rendering defs works. */}
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={sourceX}
          y1={sourceY}
          x2={targetX}
          y2={targetY}
        >
          <stop offset="0%" stopColor={sourceColor} />
          <stop offset="100%" stopColor={targetColor} />
        </linearGradient>
      </defs>

      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          strokeWidth: 3,
          stroke: `url(#${gradientId})`,
          strokeLinecap: "round",
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            fontSize: 12,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          <button
            className="w-5 h-5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-full shadow-sm flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-white dark:hover:text-white hover:bg-red-500 hover:border-red-500 transition-all cursor-pointer"
            onClick={onEdgeClick}
            title="Remove connection"
          >
            <span className="leading-none text-lg mb-0.5">×</span>
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
