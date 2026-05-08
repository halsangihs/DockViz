import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Box, Globe, ShieldOff, Trash2 } from "lucide-react";

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case "running":
      return "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]";
    case "exited":
      return "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]";
    case "paused":
      return "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.6)]";
    default:
      return "bg-gray-500";
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
      className={`rounded-xl backdrop-blur-xl w-64 transition-all duration-300 hover:shadow-[0_0_25px_rgba(59,130,246,0.15)] cursor-pointer group flex flex-col text-gray-200 ${
        isIsolated
          ? "border border-dashed border-gray-600 hover:border-gray-500 bg-gray-900/60"
          : "border border-gray-700/80 hover:border-blue-500/50 bg-gray-900/80 shadow-xl"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-linear-to-r from-gray-800/80 to-gray-900/80 border-b border-gray-700/50 rounded-t-xl overflow-hidden">
        <div className="flex items-center gap-2.5 flex-1 min-w-0 pr-2">
          <Box className="w-4 h-4 text-blue-400 drop-shadow-[0_0_5px_rgba(96,165,250,0.5)] shrink-0" />
          <span
            className="font-bold text-gray-100 text-sm truncate drop-shadow-md"
            title={data.name}
          >
            {data.name || "Unknown Container"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isIsolated && (
            <div
              className="flex items-center gap-1 bg-red-900/30 text-red-300 border border-red-800/50 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
              title="Network Isolated"
            >
              <ShieldOff className="w-3 h-3" />
              Isolated
            </div>
          )}
          <button
            className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-red-500/20"
            title="Remove container"
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.(data);
            }}
          >
            <Trash2 size={13} />
          </button>
          <div
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColor}`}
            title={data.state}
          />
        </div>
      </div>

      <div className="p-3.5 space-y-3 bg-gray-900/40 rounded-b-xl">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="font-semibold text-gray-500 uppercase tracking-widest text-[9px]">Img</span>
          {data.isImageDeleted ? (
              <span 
                className="truncate bg-red-900/20 text-red-400 px-1.5 py-0.5 rounded border border-red-800/30 font-medium"
                title={`Image is deleted/missing (${data.imageName})`}
              >
                {data.imageName || "<deleted>"}
              </span>
          ) : data.isStaleRef && data.currentValidTag ? (
             <span 
               className="truncate bg-amber-900/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-800/30 font-medium"
               title={`Currently tagged as ${data.currentValidTag}\n(Container started with ${data.imageName})`}
             >
               {data.currentValidTag}
             </span>
          ) : (
            <span 
              className="truncate bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded border border-gray-700/50"
              title={data.imageName}
            >
              {data.imageName || "scratch"}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="font-mono text-[10px] bg-black/30 px-1.5 py-0.5 rounded border border-white/5 shadow-inner" title={data.id}>
            {data.id ? data.id.substring(0, 12) : "N/A"}
          </span>
          
          {data.cpu !== undefined && (
            <span className="text-[10px] font-mono text-gray-400">
                CPU {data.cpu}%
            </span>
          )}
        </div>

        {data.ports && data.ports.length > 0 && (
          <div className="mt-2 pt-3 border-t border-gray-700/50">
            <div className="flex flex-wrap gap-1.5">
              {data.ports.map((port, index) => (
                <span
                  key={index}
                  className="flex items-center gap-1 text-[10px] bg-blue-900/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-800/30 shadow-[0_0_10px_rgba(59,130,246,0.05)]"
                >
                  <Globe className="w-3 h-3 opacity-70" />
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
        className="w-2.5 h-2.5 bg-gray-600 border-2 border-gray-800 opacity-0 group-hover:opacity-50 transition-opacity cursor-not-allowed pointer-events-none"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-blue-400 border-2 border-gray-900 shadow-[0_0_8px_rgba(96,165,250,0.8)] opacity-0 group-hover:opacity-100 transition-opacity"
      />
    </div>
  );
};

export default memo(ContainerNode);
