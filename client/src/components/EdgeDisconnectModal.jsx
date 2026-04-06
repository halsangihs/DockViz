import React, { useState } from "react";
import { X, Unplug, Loader2, Box, Network } from "lucide-react";
import { useFlowActions } from "../context/FlowActionsContext";

const EdgeDisconnectModal = ({ edgeData, onClose }) => {
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const { disconnectFromNetwork } = useFlowActions();

  if (!edgeData) return null;

  const { containerId, containerName, networkName } = edgeData;

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnectFromNetwork(containerId, networkName);
      onClose();
    } catch (err) {
      // handled inside disconnectFromNetwork
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-95 overflow-hidden animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Unplug size={16} className="text-orange-400" />
            <h3 className="text-sm font-bold text-white">
              Network Connection
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Connection visualization */}
          <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-900/40 border border-blue-800 flex items-center justify-center shrink-0">
                <Box size={14} className="text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">
                  Container
                </p>
                <p className="text-xs text-gray-200 font-medium truncate">
                  {containerName}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-0.5 shrink-0 px-2">
              <div className="w-8 h-px bg-gray-600" />
              <span className="text-[9px] text-gray-500 font-medium">
                connected
              </span>
              <div className="w-8 h-px bg-gray-600" />
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
              <div className="min-w-0 text-right">
                <p className="text-[10px] text-gray-500 uppercase font-semibold">
                  Network
                </p>
                <p className="text-xs text-gray-200 font-medium truncate">
                  {networkName}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-orange-900/40 border border-orange-800 flex items-center justify-center shrink-0">
                <Network size={14} className="text-orange-400" />
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            This will disconnect{" "}
            <span className="text-blue-400 font-medium">{containerName}</span>{" "}
            from the{" "}
            <span className="text-orange-400 font-medium">{networkName}</span>{" "}
            network. The container will lose connectivity to other containers on
            this network.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-gray-800/30 border-t border-gray-700 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              isDisconnecting
                ? "bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-500 text-white border-red-500"
            }`}
          >
            {isDisconnecting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Unplug size={14} />
            )}
            {isDisconnecting ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EdgeDisconnectModal;
