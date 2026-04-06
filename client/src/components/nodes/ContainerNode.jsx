import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Box, Globe, ShieldOff, Trash2 } from "lucide-react";

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case "running":
      return "bg-green-500";
    case "exited":
      return "bg-red-500";
    case "paused":
      return "bg-yellow-500";
    default:
      return "bg-gray-400";
  }
};

const ContainerNode = ({ data }) => {
  const statusColor = getStatusColor(data.state);
  const isIsolated =
    !data.networks ||
    data.networks.length === 0 ||
    (data.networks.length === 1 && data.networks[0] === "none");

  return (
    <div
      className={`shadow-lg rounded-md bg-white w-64 transition-all hover:shadow-xl cursor-pointer group ${
        isIsolated
          ? "border-2 border-dashed border-gray-500 hover:border-gray-400"
          : "border-2 border-gray-200 hover:border-blue-500"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-t-md border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-blue-600" />
          <span
            className="font-bold text-gray-700 text-sm truncate max-w-30"
            title={data.name}
          >
            {data.name || "Unknown Container"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isIsolated && (
            <div
              className="flex items-center gap-1 bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
              title="Network Isolated"
            >
              <ShieldOff className="w-3 h-3" />
              Isolated
            </div>
          )}
          <button
            className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
            title="Remove container"
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.(data);
            }}
          >
            <Trash2 size={12} />
          </button>
          <div
            className={`w-3 h-3 rounded-full ${statusColor} shadow-sm`}
            title={data.state}
          />
        </div>
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="font-semibold">Img:</span>
          {data.isImageDeleted ? (
              <span 
                className="truncate bg-red-100 text-red-800 px-1 py-0.5 rounded border border-red-200 font-medium"
                title={`Image is deleted/missing (${data.imageName})`}
              >
                {data.imageName || "<deleted>"}
              </span>
          ) : data.isStaleRef && data.currentValidTag ? (
             <span 
               className="truncate bg-amber-100 text-amber-800 px-1 py-0.5 rounded border border-amber-200 font-medium"
               title={`Currently tagged as ${data.currentValidTag}\n(Container started with ${data.imageName})`}
             >
               {data.currentValidTag}
             </span>
          ) : (
            <span 
              className="truncate bg-gray-100 px-1 py-0.5 rounded border border-gray-200"
              title={data.imageName}
            >
              {data.imageName || "scratch"}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="font-mono">ID: {data.id}</span>
        </div>

        {data.ports && data.ports.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex flex-wrap gap-1">
              {data.ports.map((port, index) => (
                <span
                  key={index}
                  className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100"
                >
                  <Globe className="w-3 h-3" />
                  {typeof port === "object"
                    ? port.public
                      ? `${port.public}:${port.private}`
                      : `${port.private}`
                    : port}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="w-3 h-3 bg-gray-400 opacity-50 cursor-not-allowed pointer-events-none"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-blue-500"
      />
    </div>
  );
};

export default memo(ContainerNode);
