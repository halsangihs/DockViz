import React, { useState } from "react";
import {
  X,
  Trash2,
  Loader2,
  Layers,
  AlertTriangle,
  Box,
  ShieldAlert,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiService } from "../api/apiService";

const DeleteImageModal = ({ imageData, onClose, onDeleted }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [force, setForce] = useState(false);
  const [dependencyError, setDependencyError] = useState(null);

  const getErrorMessage = (err) => {
    const payload = err?.response?.data;
    if (typeof payload === "string") return payload;
    return payload?.error || payload?.message || "Failed to delete image";
  };

  if (!imageData) return null;

  const { name, fullId, primaryReference, tags, size, containersCount } = imageData;
  const displayName = primaryReference ||
    (tags && tags.length > 0 ? `${name}:${tags[0]}` : name || "Untitled");

  const handleDelete = async () => {
    setIsDeleting(true);
    setDependencyError(null);
    try {
      await apiService.deleteImage(fullId, force);
      toast.success(`Image ${displayName} deleted!`);
      onDeleted?.();
      onClose();
    } catch (err) {
      if (err?.response?.status === 409) {
        // Container dependency conflict
        setDependencyError(err.response.data);
      } else {
        toast.error(getErrorMessage(err));
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const containers = dependencyError?.containers || [];

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
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Trash2 size={16} className="text-red-400" />
            <h3 className="text-sm font-bold text-white">Delete Image</h3>
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
          {/* Image info */}
          <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <div className="w-10 h-10 rounded-full bg-purple-900/40 border border-purple-800 flex items-center justify-center shrink-0">
              <Layers size={18} className="text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-200 font-medium truncate">
                {displayName}
              </p>
              <p className="text-[10px] text-gray-500 font-mono">
                {size} · {containersCount || 0} container
                {containersCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Dependency conflict from API */}
          {dependencyError && containers.length > 0 && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-red-500 shrink-0" />
                <p className="text-xs text-red-400 font-medium">
                  Image is in use by {containers.length} container
                  {containers.length !== 1 ? "s" : ""}
                </p>
              </div>
              <p className="text-[11px] text-red-600 leading-relaxed">
                {dependencyError.error || dependencyError.message}
              </p>

              <div className="space-y-1 mt-2 max-h-32 overflow-y-auto sidebar-scroll">
                {containers.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 bg-gray-800/60 rounded px-2 py-1.5"
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        c.state === "running"
                          ? "bg-green-500"
                          : c.state === "paused"
                            ? "bg-yellow-500"
                            : "bg-red-500"
                      }`}
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

              {/* Force option */}
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-red-800/30">
                <input
                  type="checkbox"
                  id="force-delete"
                  checked={force}
                  disabled={dependencyError?.hasRunningContainers}
                  onChange={(e) => setForce(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-red-500 focus:ring-red-500"
                />
                <label
                  htmlFor="force-delete"
                  className={`text-[11px] font-medium flex items-center gap-1 ${
                    dependencyError?.hasRunningContainers
                      ? "text-gray-500"
                      : "text-red-400"
                  }`}
                >
                  <ShieldAlert size={12} />
                  {dependencyError?.hasRunningContainers
                    ? "Force delete unavailable while a container is running"
                    : "Force delete (for stopped containers only)"}
                </label>
              </div>
            </div>
          )}

          {/* No dependency conflicts */}
          {!dependencyError && containersCount > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-yellow-500 shrink-0" />
                <p className="text-xs text-yellow-400">
                  This image has {containersCount} container
                  {containersCount !== 1 ? "s" : ""} that depend on it.
                </p>
              </div>
            </div>
          )}

          {!dependencyError && (
            <p className="text-xs text-gray-400 leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="text-purple-400 font-medium">{displayName}</span>
              ? This action cannot be undone.
            </p>
          )}
        </div>

        {/* Footer */}
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
            disabled={isDeleting || (dependencyError?.hasRunningContainers && force)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
              isDeleting || (dependencyError?.hasRunningContainers && force)
                ? "bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed"
                : force
                  ? "bg-red-700 hover:bg-red-600 text-white border-red-600"
                  : "bg-red-600 hover:bg-red-500 text-white border-red-500"
            }`}
          >
            {isDeleting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            {isDeleting
              ? "Deleting..."
              : force
                ? "Force Delete"
                : "Delete Image"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteImageModal;
