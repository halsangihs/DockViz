import React, { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Network, Globe, Shield, Trash2 } from "lucide-react";

const NetworkNode = ({ data }) => {
  const driverType = (data.driver || "bridge").toLowerCase();

  // Protected system networks that shouldn't be deletable
  const isSystemNetwork = ["bridge", "host", "none"].includes(
    (data.name || "").toLowerCase(),
  );

  const getIcon = () => {
    switch (driverType) {
      case "host":
        return <Globe className="w-6 h-6 text-blue-600" />;
      case "none":
      case "null":
        return <Shield className="w-6 h-6 text-gray-600" />;
      default:
        return <Network className="w-6 h-6 text-orange-600" />;
    }
  };

  const getStyles = () => {
    switch (driverType) {
      case "host":
        return {
          border: "border-blue-400",
          hover: "hover:border-blue-600",
          bg: "bg-blue-100",
          handle: "bg-blue-500",
          text: "text-blue-500",
          label: "HOST",
        };
      case "none":
      case "null":
        return {
          border: "border-gray-400",
          hover: "hover:border-gray-600",
          bg: "bg-gray-200",
          handle: "bg-gray-500",
          text: "text-gray-500",
          label: "ISOLATION",
        };
      default:
        return {
          border: "border-orange-300",
          hover: "hover:border-orange-500",
          bg: "bg-orange-100",
          handle: "bg-orange-500",
          text: "text-orange-500",
          label: driverType.toUpperCase(),
        };
    }
  };

  const styles = getStyles();

  return (
    <div
      className={`shadow-sm rounded-full bg-white border-2 ${styles.border} w-48 h-48 flex flex-col items-center justify-center transition-all ${styles.hover} hover:shadow-lg relative group`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={`w-3 h-3 ${styles.handle}`}
      />
                                                    
      <div
        className={`${styles.bg} p-3 rounded-full mb-2 transition-transform group-hover:scale-110`}
      >
        {getIcon()}
      </div>

      <div className="text-center px-4 w-full">
        <h3
          className="font-bold text-gray-800 text-sm truncate w-full"
          title={data.name}
        >
          {data.name}
        </h3>

        <span
          className={`text-[10px] font-bold uppercase tracking-wider ${styles.text}`}
        >
          {styles.label}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[10px] bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
        <span className="font-mono text-gray-600">
          {data.totalContainersCount !== undefined ? (
            <>
              <span
                className={
                  data.activeContainersCount > 0
                    ? "text-green-600 font-bold"
                    : "text-gray-400"
                }
              >
                {data.activeContainersCount || 0}
              </span>
              <span className="mx-1">/</span>
              <span>{data.totalContainersCount}</span>
            </>
          ) : (
            "0"
          )}
        </span>
        <span className="text-gray-400 text-[9px]">containers</span>
      </div>

      <div className="absolute bottom-3 text-[9px] text-gray-400 font-mono">
        {data.id}
      </div>

      {/* Delete button — hidden for system networks */}
      {!isSystemNetwork && (
        <button
          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50 hover:border-red-300 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
          title="Delete network"
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete?.(data);
          }}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
};

export default memo(NetworkNode);
