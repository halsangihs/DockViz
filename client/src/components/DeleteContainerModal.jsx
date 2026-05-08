import React, { useState } from "react";
import {
  X,
  Trash2,
  Loader2,
  Box,
  AlertTriangle,
  ShieldOff,
  Globe,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiService } from "../api/apiService";

const DeleteContainerModal = ({ containerData, onClose, onDeleted }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!containerData) return null;

  const { name, fullId, id, state, status, imageName, networks, ports } =
    containerData;

  const isRunning = state === "running";
  const isPaused = state === "paused";

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await toast.promise(apiService.containerAction(fullId, "remove"), {
        loading: isRunning || isPaused
          ? "Force removing running container..."
          : "Removing container...",
        success: "Container removed successfully!",
        error: "Failed to remove container",
      });
      onDeleted?.();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const stateColor =
    state === "running"
      ? "bg-green-500"
      : state === "paused"
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-110 overflow-hidden animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Trash2 size={16} className="text-red-400" />
            <h3 className="text-sm font-bold text-white">Delete Container</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <div className="w-10 h-10 rounded-full bg-blue-900/40 border border-blue-800 flex items-center justify-center shrink-0">
              <Box size={18} className="text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-200 font-medium truncate">
                {name}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-1.5 h-1.5 rounded-full ${stateColor}`} />
                <p className="text-[10px] text-gray-500 font-mono">
                  {status || state} · {id}
                </p>
              </div>
            </div>
          </div>

          {(isRunning || isPaused) && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-500 shrink-0" />
                <p className="text-xs text-red-400 font-medium">
                  This container is currently {isRunning ? "running" : "paused"}
                </p>
              </div>
              <p className="text-[11px] text-red-600 leading-relaxed">
                Removing it will force stop it and permanently delete the container.
                This action cannot be undone.
              </p>
            </div>
          )}

          {!isRunning && !isPaused && (
            <p className="text-xs text-gray-400 leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="text-blue-400 font-medium">{name}</span>? This
              action cannot be undone.
            </p>
          )}

          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Image
              </p>
              <p className="text-xs text-gray-300 font-mono bg-gray-800 px-2 py-1 rounded break-all">
                {imageName || "scratch"}
              </p>
            </div>

            {networks && networks.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                  Networks
                </p>
                <div className="flex flex-wrap gap-1">
                  {networks.map((network) => (
                    <span
                      key={network}
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-gray-800 text-gray-300 border border-gray-700"
                    >
                      {network === "none" ? (
                        <ShieldOff size={10} className="text-gray-500" />
                      ) : (
                        <Globe size={10} className="text-blue-400" />
                      )}
                      {network}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {ports && ports.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                  Ports
                </p>
                <div className="flex flex-wrap gap-1">
                  {ports.map((port, index) => (
                    <span
                      key={`${port.public || port.private}-${index}`}
                      className="text-[10px] font-mono bg-gray-800 text-blue-400 px-2 py-1 rounded border border-gray-700"
                    >
                      {port.public
                        ? `${port.public}:${port.private}/${port.type}`
                        : `${port.private}/${port.type}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 bg-gray-800/30 border-t border-gray-700 flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
              isDeleting
                ? "bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-500 text-white border-red-500"
            }`}
          >
            {isDeleting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            {isDeleting ? "Deleting..." : isRunning || isPaused ? "Force Remove" : "Delete Container"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteContainerModal;
