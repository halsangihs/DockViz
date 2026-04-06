import React, { useState } from "react";
import { X, Plus, Network, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { apiService } from "../api/apiService";

const CreateNetworkModal = ({ onClose, onCreated }) => {
  const [name, setName] = useState("");
  const [driver, setDriver] = useState("bridge");
  const [internal, setInternal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Network name is required");
      return;
    }

    setIsCreating(true);
    try {
      await toast.promise(
        apiService.createNetwork({
          Name: name.trim(),
          Driver: driver,
          Internal: internal,
        }),
        {
          loading: "Creating network...",
          success: "Network created successfully!",
          error: (err) =>
            err?.response?.data || "Failed to create network",
        },
      );
      onCreated?.();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
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
        className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-105 overflow-hidden animate-slide-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Network size={16} className="text-orange-400" />
            <h3 className="text-sm font-bold text-white">Create Network</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleCreate} className="px-5 py-4 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
              Network Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. prod_backend"
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>

          {/* Driver */}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
              Driver
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["bridge", "overlay", "macvlan"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDriver(d)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    driver === d
                      ? "bg-orange-900/40 text-orange-400 border-orange-700"
                      : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600 hover:text-gray-300"
                  }`}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-600">
              {driver === "bridge" &&
                "Default. Isolated network on a single host."}
              {driver === "overlay" &&
                "Multi-host networking for Docker Swarm services."}
              {driver === "macvlan" &&
                "Assigns a MAC address to containers, making them appear as physical devices."}
            </p>
          </div>

          {/* Internal Toggle */}
          <div className="space-y-1.5">
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-700 rounded-full peer-checked:bg-orange-600 transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
              </div>
              <div>
                <span className="text-xs text-gray-300 font-medium group-hover:text-white transition-colors">
                  Internal Network
                </span>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  If enabled, the network will have no access to the outside
                  world (internet). Only containers on this network can
                  communicate.
                </p>
              </div>
            </label>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !name.trim()}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                isCreating || !name.trim()
                  ? "bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed"
                  : "bg-orange-600 hover:bg-orange-500 text-white border-orange-500"
              }`}
            >
              {isCreating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              {isCreating ? "Creating..." : "Create Network"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateNetworkModal;
