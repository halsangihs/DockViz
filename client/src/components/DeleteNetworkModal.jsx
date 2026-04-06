import React, { useState } from "react";
import { X, Trash2, Loader2, Network, AlertTriangle, Box } from "lucide-react";
import toast from "react-hot-toast";
import { apiService } from "../api/apiService";
import { useFlowActions } from "../context/FlowActionsContext";

const DeleteNetworkModal = ({ networkData, onClose, onDeleted }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { nodes: flowNodes, edges: flowEdges } = useFlowActions();

  if (!networkData) return null;

  const { name, fullId, driver } = networkData;

  // Find connected containers from edges
  const connectedContainers = (flowEdges || [])
    .filter((e) => e.target === name && e.type === "network")
    .map((e) => {
      const containerNode = (flowNodes || []).find((n) => n.id === e.source);
      return containerNode
        ? {
            id: containerNode.id,
            name: containerNode.data.name,
            state: containerNode.data.state,
          }
        : null;
    })
    .filter(Boolean);

  const hasConnections = connectedContainers.length > 0;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await toast.promise(apiService.deleteNetwork(fullId), {
        loading: hasConnections
          ? "Disconnecting containers and deleting network..."
          : "Deleting network...",
        success: "Network deleted successfully!",
        error: (err) =>
          err?.response?.data || "Failed to delete network",
      });
      onDeleted?.();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const stateColor = (state) =>
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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-110 overflow-hidden animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Trash2 size={16} className="text-red-400" />
            <h3 className="text-sm font-bold text-white">Delete Network</h3>
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
          {/* Network info */}
          <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <div className="w-10 h-10 rounded-full bg-orange-900/40 border border-orange-800 flex items-center justify-center shrink-0">
              <Network size={18} className="text-orange-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-200 font-medium truncate">
                {name}
              </p>
              <p className="text-[10px] text-gray-500 uppercase font-semibold">
                {driver} driver
              </p>
            </div>
          </div>

          {/* Warning for connected containers */}
          {hasConnections && (
            <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-yellow-500 shrink-0" />
                <p className="text-xs text-yellow-400 font-medium">
                  {connectedContainers.length} active container
                  {connectedContainers.length !== 1 ? "s" : ""} connected
                </p>
              </div>
              <p className="text-[11px] text-yellow-600 leading-relaxed">
                These containers will be automatically disconnected from this
                network before deletion.
              </p>

              {/* Container list */}
              <div className="space-y-1 mt-2 max-h-32 overflow-y-auto sidebar-scroll">
                {connectedContainers.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 bg-gray-800/60 rounded px-2 py-1.5"
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${stateColor(c.state)}`}
                    />
                    <Box size={10} className="text-blue-400" />
                    <span className="text-[11px] text-gray-300 font-medium truncate">
                      {c.name}
                    </span>
                    <span className="text-[9px] text-gray-600 ml-auto">
                      {c.state}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!hasConnections && (
            <p className="text-xs text-gray-400 leading-relaxed">
              Are you sure you want to delete the{" "}
              <span className="text-orange-400 font-medium">{name}</span>{" "}
              network? This action cannot be undone.
            </p>
          )}
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
            onClick={handleDelete}
            disabled={isDeleting}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
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
            {isDeleting
              ? hasConnections
                ? "Disconnecting & Deleting..."
                : "Deleting..."
              : "Delete Network"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteNetworkModal;
