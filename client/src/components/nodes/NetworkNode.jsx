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
        return <Globe className="w-5 h-5 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]" />;
      case "none":
      case "null":
        return <Shield className="w-5 h-5 text-gray-500 drop-shadow-[0_0_8px_rgba(156,163,175,0.8)]" />;
      default:
        return <Network className="w-5 h-5 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.8)]" />;
    }
  };

  const getStyles = () => {
    switch (driverType) {
      case "host":
        return {
          container: "border-blue-500/40 hover:border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:shadow-[0_0_25px_rgba(59,130,246,0.25)]",
          bgOverlay: "bg-blue-950/20",
          iconBg: "bg-blue-900/40 border-blue-500/30",
          handle: "bg-blue-400 border-blue-900",
          textBadge: "text-blue-300",
          badgeBg: "bg-blue-900/30 border-blue-800/50",
          label: "HOST",
        };
      case "none":
      case "null":
        return {
          container: "border-gray-600/50 hover:border-gray-500 shadow-[0_0_15px_rgba(156,163,175,0.1)] hover:shadow-[0_0_25px_rgba(156,163,175,0.15)]",
          bgOverlay: "bg-gray-900/40",
          iconBg: "bg-gray-800/60 border-gray-600/40",
          handle: "bg-gray-400 border-gray-800",
          textBadge: "text-gray-400",
          badgeBg: "bg-gray-800/50 border-gray-700/50",
          label: "ISOLATION",
        };
      default:
        return {
          container: "border-orange-500/40 hover:border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.15)] hover:shadow-[0_0_25px_rgba(249,115,22,0.25)]",
          bgOverlay: "bg-orange-950/20",
          iconBg: "bg-orange-900/40 border-orange-500/30",
          handle: "bg-orange-400 border-orange-900",
          textBadge: "text-orange-300",
          badgeBg: "bg-orange-900/30 border-orange-800/50",
          label: driverType.toUpperCase(),
        };
    }
  };

  const styles = getStyles();

  return (
    <div
      className={`rounded-full backdrop-blur-xl border-2 bg-gray-900/80 w-[170px] h-[170px] flex flex-col items-center justify-center transition-all duration-300 relative group overflow-hidden ${styles.container}`}
    >
      <div className={`absolute inset-0 ${styles.bgOverlay} pointer-events-none rounded-full`}></div>
      <Handle
        type="target"
        position={Position.Top}
        className={`w-3 h-3 border-2 opacity-0 group-hover:opacity-100 transition-opacity ${styles.handle}`}
      />
                                                    
      <div
        className={`${styles.iconBg} p-3 rounded-full mb-1.5 transition-transform duration-300 group-hover:scale-110 border shadow-inner z-10`}
      >
        {getIcon()}
      </div>

      <div className="text-center px-4 w-full z-10 flex flex-col items-center gap-1">
        <h3
          className="font-bold text-gray-100 text-sm w-full truncate drop-shadow-md"
          title={data.name}
        >
          {data.name}
        </h3>

        <div className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider border ${styles.badgeBg} ${styles.textBadge}`}>
          {styles.label}
        </div>
      </div>

      <div className={`mt-2 flex items-center justify-center gap-1.5 text-[10px] w-[100px] py-1 rounded-full border shadow-inner z-10 ${styles.badgeBg}`}>
        <span className="font-mono text-gray-300 drop-shadow-md">
          {data.totalContainersCount !== undefined ? (
            <>
              <span
                className={
                  data.activeContainersCount > 0
                    ? "text-green-400 font-bold"
                    : "text-gray-500"
                }
              >
                {data.activeContainersCount || 0}
              </span>
              <span className="mx-1 text-gray-500">/</span>
              <span>{data.totalContainersCount}</span>
            </>
          ) : (
            <span className="text-gray-500">0</span>
          )}
        </span>
        <span className="text-gray-500 text-[9px] uppercase tracking-widest font-semibold">ctrs</span>
      </div>

      {/* Delete button — hidden for system networks */}
      {!isSystemNetwork && (
        <button
          className="absolute top-3 right-6 p-1.5 rounded-full bg-gray-800/80 border border-gray-600 text-gray-400 hover:text-red-400 hover:bg-red-500/20 hover:border-red-500/30 opacity-0 group-hover:opacity-100 transition-all shadow-lg z-20"
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
