import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Box,
  Layers,
  Network,
  Play,
  Square,
  RotateCcw,
  Zap,
  Trash2,
  Terminal,
  Info,
  Cpu,
  HardDrive,
  Plus,
  ChevronRight,
  Loader2,
  TerminalSquare,
  FileCode,
  Settings,
  Shield,
  ShieldOff,
  MemoryStick,
  Globe,
  FolderOpen,
  Lock,
  Unplug,
  Tag,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiService } from "../api/apiService";
import socket from "../utils/socket";
import TerminalExec from "./TerminalExec";
import { useFlowActions } from "../context/FlowActionsContext";

// ─── Action Button ───────────────────────────────────────────────────────────
const ActionButton = ({
  icon: Icon,
  label,
  color,
  loading,
  disabled,
  onClick,
}) => {
  const colors = {
    green:
      "bg-green-900/30 text-green-400 hover:bg-green-900/50 border-green-800",
    yellow:
      "bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50 border-yellow-800",
    blue: "bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 border-blue-800",
    orange:
      "bg-orange-900/30 text-orange-400 hover:bg-orange-900/50 border-orange-800",
    red: "bg-red-900/30 text-red-400 hover:bg-red-900/50 border-red-800",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors ${colors[color]} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Icon size={16} />
      )}
      <span className="font-medium text-sm">{label}</span>
      {!loading && (
        <ChevronRight size={14} className="ml-auto opacity-50" />
      )}
    </button>
  );
};

// ─── Network Badge with Disconnect ──────────────────────────────────────────
const NetworkBadge = ({ networkName, containerId }) => {
  const [disconnecting, setDisconnecting] = useState(false);
  const { disconnectFromNetwork } = useFlowActions();

  const handleDisconnect = async (e) => {
    e.stopPropagation();
    if (networkName === "none") return;
    setDisconnecting(true);
    try {
      await disconnectFromNetwork(containerId, networkName);
    } catch (err) {
      // handled inside disconnectFromNetwork
    } finally {
      setDisconnecting(false);
    }
  };

  const isNone = networkName === "none";

  return (
    <div className="flex items-center justify-between bg-gray-800 rounded px-2 py-1.5 group">
      <div className="flex items-center gap-1.5">
        <Network size={10} className="text-orange-400" />
        <span className="text-[11px] text-orange-400 font-medium">
          {networkName}
        </span>
      </div>
      {!isNone && (
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
            disconnecting
              ? "text-gray-500 cursor-not-allowed"
              : "text-gray-500 hover:text-red-400 hover:bg-red-900/30 opacity-0 group-hover:opacity-100"
          }`}
          title={`Disconnect from ${networkName}`}
        >
          {disconnecting ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <X size={10} />
          )}
          {!disconnecting && "Disconnect"}
        </button>
      )}
    </div>
  );
};

// ─── Container Sidebar ───────────────────────────────────────────────────────
const ContainerSidebar = ({ data, onClose, onRefresh, flowActions }) => {
  const [activeTab, setActiveTab] = useState("info");
  const [isActioning, setIsActioning] = useState(null);
  const [isIsolating, setIsIsolating] = useState(false);
  const [renameValue, setRenameValue] = useState(data.name || "");
  const [isRenamingContainer, setIsRenamingContainer] = useState(false);
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);
  const containerId = data.fullId;

  useEffect(() => {
    setRenameValue(data.name || "");
  }, [data.name]);

  const isIsolated =
    !data.networks ||
    data.networks.length === 0 ||
    (data.networks.length === 1 && data.networks[0] === "none");

  const tabs = [
    { id: "info", label: "Info", icon: Info },
    { id: "actions", label: "Actions", icon: Zap },
    { id: "logs", label: "Logs", icon: Terminal },
    { id: "terminal", label: "Terminal", icon: TerminalSquare },
  ];

  // Log streaming
  useEffect(() => {
    if (activeTab === "logs") {
      setLogs([]);
      socket.emit("join-logs", containerId);

      const handleLog = ({ id, log }) => {
        if (id === containerId) {
          setLogs((prev) => [...prev.slice(-500), log]);
        }
      };

      socket.on("container-logs", handleLog);

      return () => {
        socket.emit("leave-logs", containerId);
        socket.off("container-logs", handleLog);
      };
    }
  }, [activeTab, containerId]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const executeAction = async (action) => {
    if (action === "remove") {
      data.onDelete?.(data);
      return;
    }

    setIsActioning(action);
    try {
      await toast.promise(apiService.containerAction(containerId, action), {
        loading: `Performing ${action}...`,
        success: `Container ${action}ed successfully`,
        error: `Failed to ${action} container`,
      });
      if (action === "remove") {
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsActioning(null);
    }
  };

  const statusColor =
    {
      running: "text-green-500",
      exited: "text-red-500",
      paused: "text-yellow-500",
    }[data.state] || "text-gray-400";

  const toggleIsolation = async () => {
    setIsIsolating(true);
    const { setEdges, updateNodeData, getNode, handledEdgesRef } = flowActions;
    const prevNetworks = [...(data.networks || [])];
    const isRunning = data.state === "running";

    try {
      if (isIsolated) {
        // De-isolate: optimistically add bridge edge + update networks
        const bridgeNetworkName = "bridge";
        const edgeId = `${containerId}--${bridgeNetworkName}`;

        updateNodeData(containerId, { networks: [bridgeNetworkName] });

        setEdges((prev) => [
          ...prev,
          {
            id: edgeId,
            source: containerId,
            target: bridgeNetworkName,
            type: "network",
            animated: isRunning,
            deletable: false,
          },
        ]);

        updateNodeData(bridgeNetworkName, (prev) => ({
          totalContainersCount: (prev.data.totalContainersCount || 0) + 1,
          activeContainersCount:
            (prev.data.activeContainersCount || 0) + (isRunning ? 1 : 0),
        }));

        // Mark as handled so socket event doesn't double-update
        handledEdgesRef.current.add(edgeId);
        setTimeout(() => handledEdgesRef.current.delete(edgeId), 5000);

        await toast.promise(apiService.deisolateContainer(containerId), {
          loading: "Reconnecting to bridge...",
          success: "Container reconnected to bridge network",
          error: "Failed to de-isolate container",
        });
      } else {
        // Isolate: optimistically remove all network edges
        const networkNames = prevNetworks.filter((n) => n !== "none");

        // Remove all network edges for this container
        const edgeIdsToRemove = networkNames.map(
          (n) => `${containerId}--${n}`,
        );
        setEdges((prev) =>
          prev.filter((e) => !edgeIdsToRemove.includes(e.id)),
        );

        // Update container networks to empty
        updateNodeData(containerId, { networks: [] });

        // Update each network's counts
        networkNames.forEach((netName) => {
          // Mark as handled so socket disconnect events don't double-update
          handledEdgesRef.current.add(`${containerId}--${netName}`);
          setTimeout(
            () =>
              handledEdgesRef.current.delete(`${containerId}--${netName}`),
            5000,
          );

          updateNodeData(netName, (prev) => ({
            totalContainersCount: Math.max(
              (prev.data.totalContainersCount || 1) - 1,
              0,
            ),
            activeContainersCount: Math.max(
              (prev.data.activeContainersCount || 0) - (isRunning ? 1 : 0),
              0,
            ),
          }));
        });

        await toast.promise(apiService.isolateContainer(containerId), {
          loading: "Disconnecting from all networks...",
          success: "Container isolated from all networks",
          error: "Failed to isolate container",
        });
      }
    } catch (err) {
      // Revert on error by refreshing
      console.error(err);
      onRefresh?.();
    } finally {
      setIsIsolating(false);
    }
  };

  const handleRenameContainer = async (e) => {
    e.preventDefault();
    const nextName = renameValue.trim();

    if (!nextName) {
      toast.error("Container name is required");
      return;
    }

    if (nextName === data.name) {
      toast.error("Enter a different container name");
      return;
    }

    setIsRenamingContainer(true);
    try {
      await toast.promise(apiService.renameContainer(containerId, nextName), {
        loading: "Renaming container...",
        success: `Container renamed to ${nextName}`,
        error: (err) => err?.response?.data?.error || "Failed to rename container",
      });
      setTimeout(() => onRefresh?.(), 250);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRenamingContainer(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-gray-700 overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? "text-blue-400 border-b-2 border-blue-400 bg-gray-800/50"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 sidebar-scroll">
        {activeTab === "info" && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Status
              </label>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold uppercase ${statusColor}`}
                >
                  {data.state}
                </span>
              </div>
              <p className="text-xs text-gray-400">{data.status}</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Image
              </label>
              <p className="text-sm text-gray-200 font-mono bg-gray-800 px-2 py-1 rounded">
                {data.imageName}
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                ID
              </label>
              <p className="text-xs text-gray-400 font-mono break-all">
                {data.fullId}
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Command
              </label>
              <p className="text-xs text-gray-400 font-mono bg-gray-800 px-2 py-1 rounded">
                {data.command}
              </p>
            </div>

            {data.ports && data.ports.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                  Ports
                </label>
                <div className="space-y-1">
                  {data.ports.map((port, i) => (
                    <div
                      key={i}
                      className="text-xs text-blue-400 font-mono bg-gray-800 px-2 py-1 rounded"
                    >
                      {typeof port === "object"
                        ? port.public
                          ? `${port.public}:${port.private}/${port.type}`
                          : `${port.private}/${port.type}`
                        : port}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.networks && data.networks.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                  Networks
                </label>
                <div className="space-y-1">
                  {data.networks.map((net, i) => (
                    <NetworkBadge
                      key={i}
                      networkName={net}
                      containerId={containerId}
                    />
                  ))}
                </div>
              </div>
            )}

            {data.volumes && data.volumes.length > 0 && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                  Volumes
                </label>
                <div className="space-y-1">
                  {data.volumes.map((vol, i) => (
                    <div
                      key={i}
                      className="text-[10px] text-gray-400 font-mono bg-gray-800 px-2 py-1 rounded"
                    >
                      {vol.source} &rarr; {vol.destination}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CPU / Memory Stats */}
            {(data.cpu !== undefined || data.memory !== undefined) && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                  Resources
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-800 rounded p-2">
                    <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1">
                      <Cpu size={10} /> CPU
                    </div>
                    <span className="text-sm font-bold text-blue-400">
                      {data.cpu ?? 0}%
                    </span>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-1">
                      <HardDrive size={10} /> Memory
                    </div>
                    <span className="text-sm font-bold text-purple-400">
                      {data.memory ?? 0}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Created
              </label>
              <p className="text-xs text-gray-400">
                {new Date(data.created).toLocaleString()}
              </p>
            </div>

            <div className="border-t border-gray-700 pt-4 space-y-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Danger Zone
              </p>
              <ActionButton
                icon={Trash2}
                label="Force Remove"
                color="red"
                onClick={() => executeAction("remove")}
              />
            </div>
          </div>
        )}

        {activeTab === "actions" && (
          <div className="space-y-3">
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Rename Container
              </p>
              <form onSubmit={handleRenameContainer} className="space-y-3">
                <Input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder="new-container-name"
                />
                <button
                  type="submit"
                  disabled={isRenamingContainer || !renameValue.trim()}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                    isRenamingContainer || !renameValue.trim()
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-500"
                  }`}
                >
                  {isRenamingContainer ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Settings size={16} />
                  )}
                  {isRenamingContainer ? "Renaming..." : "Rename Container"}
                </button>
              </form>
            </div>

            <div className="border-t border-gray-700 pt-3" />

            {data.state === "running" && (
              <>
                <ActionButton
                  icon={Square}
                  label="Stop"
                  color="yellow"
                  loading={isActioning === "stop"}
                  disabled={!!isActioning}
                  onClick={() => executeAction("stop")}
                />
                <ActionButton
                  icon={RotateCcw}
                  label="Restart"
                  color="blue"
                  loading={isActioning === "restart"}
                  disabled={!!isActioning}
                  onClick={() => executeAction("restart")}
                />
                <ActionButton
                  icon={Zap}
                  label="Kill"
                  color="orange"
                  loading={isActioning === "kill"}
                  disabled={!!isActioning}
                  onClick={() => executeAction("kill")}
                />
              </>
            )}
            {data.state !== "running" && (
              <ActionButton
                icon={Play}
                label="Start"
                color="green"
                loading={isActioning === "start"}
                disabled={!!isActioning}
                onClick={() => executeAction("start")}
              />
            )}
            <div className="border-t border-gray-700 pt-3 mt-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3 flex items-center gap-1.5">
                <Unplug size={10} />
                Network Isolation
              </p>
              <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isIsolated ? (
                      <ShieldOff size={14} className="text-gray-400" />
                    ) : (
                      <Shield size={14} className="text-green-400" />
                    )}
                    <span className="text-xs text-gray-300 font-medium">
                      {isIsolated ? "Isolated" : "Connected"}
                    </span>
                  </div>
                  <button
                    onClick={toggleIsolation}
                    disabled={isIsolating || !!isActioning}
                    className={`px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${
                      isIsolating || !!isActioning
                        ? "opacity-50 cursor-not-allowed bg-gray-800 text-gray-500 border-gray-700"
                        : isIsolated
                          ? "bg-green-900/30 text-green-400 border-green-800 hover:bg-green-900/50"
                          : "bg-orange-900/30 text-orange-400 border-orange-800 hover:bg-orange-900/50"
                    }`}
                  >
                    {isIsolating ? (
                      <Loader2 size={12} className="animate-spin inline mr-1" />
                    ) : null}
                    {isIsolated ? "De-Isolate" : "Disconnect All"}
                  </button>
                </div>
                <p className="text-[10px] text-gray-600 leading-relaxed">
                  {isIsolated
                    ? "This container has no network connectivity. Click to de-isolate to the bridge network."
                    : "Disconnect this container from all networks to fully isolate it."}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div className="flex flex-col h-[calc(100vh-220px)]">
            {/* Logs header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-800">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Live Stream
              </span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] text-green-500/70">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  streaming
                </span>
                {logs.length > 0 && (
                  <button
                    onClick={() => setLogs([])}
                    className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 bg-[#0a0e14] rounded-xl border border-gray-700/40 overflow-y-auto p-3 font-mono text-[11px] text-green-400/90 whitespace-pre-wrap sidebar-scroll leading-relaxed">
              {logs.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <span className="text-gray-600 italic text-xs">
                    Waiting for logs...
                  </span>
                </div>
              )}
              {logs.map((log, i) => (
                <div key={i} className="leading-5 hover:bg-white/2 rounded px-1 -mx-1">
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}

        {/* Terminal tab — always mounted, hidden via CSS to preserve shell session */}
        <div
          className={`flex flex-col h-[calc(100vh-220px)] ${
            activeTab === "terminal" ? "" : "hidden"
          }`}
        >
          <TerminalExec
            containerId={containerId}
            isRunning={data.state === "running"}
            visible={activeTab === "terminal"}
          />
        </div>
      </div>
    </div>
  );
};

// ─── Shared Form Components ──────────────────────────────────────────────────
const Label = ({ children }) => (
  <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
    {children}
  </label>
);

const Input = ({ ...props }) => (
  <input
    {...props}
    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 disabled:opacity-50"
  />
);

const Select = ({ children, ...props }) => (
  <select
    {...props}
    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
  >
    {children}
  </select>
);

const Toggle = ({ label, checked, onChange, description }) => (
  <label className="flex items-start gap-3 cursor-pointer group">
    <div className="relative mt-0.5">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
      <div className="w-9 h-5 bg-gray-700 rounded-full peer-checked:bg-purple-600 transition-colors" />
      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
    </div>
    <div>
      <span className="text-xs text-gray-300 font-medium group-hover:text-white transition-colors">
        {label}
      </span>
      {description && (
        <p className="text-[10px] text-gray-600 mt-0.5">{description}</p>
      )}
    </div>
  </label>
);

const Hint = ({ children }) => (
  <p className="text-[10px] text-gray-600">{children}</p>
);

// ─── Image Sidebar ───────────────────────────────────────────────────────────
const ImageSidebar = ({ data, onRefresh }) => {
  const [activeTab, setActiveTab] = useState("info");
  const [blueprint, setBlueprint] = useState(null);
  const [blueprintLoading, setBlueprintLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [tagRepo, setTagRepo] = useState("");
  const [tagValue, setTagValue] = useState("latest");
  const [isTagging, setIsTagging] = useState(false);
  const [referenceToRename, setReferenceToRename] = useState("");
  const [renameRepo, setRenameRepo] = useState("");
  const [renameTag, setRenameTag] = useState("latest");
  const [isRenamingImage, setIsRenamingImage] = useState(false);
  const [referenceToUntag, setReferenceToUntag] = useState("");
  const [isUntagging, setIsUntagging] = useState(false);
  const [selectedDeployRef, setSelectedDeployRef] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    ports: "",
    env: "",
    cmd: "",
    tty: false,
    openStdin: false,
    restartPolicy: "",
    memory: "",
    cpuShares: "",
    autoStart: true,
    attachMode: false,
    networkMode: "",
  });

  const tabs = [
    { id: "info", label: "Info", icon: Info },
    { id: "actions", label: "Actions", icon: Zap },
    { id: "blueprint", label: "Blueprint", icon: FileCode },
    { id: "deploy", label: "Deploy", icon: Settings },
  ];

  // Fetch blueprint on tab switch
  useEffect(() => {
    if (activeTab === "blueprint" && !blueprint && !blueprintLoading) {
      setBlueprintLoading(true);
      apiService
        .inspectImage(data.fullId)
        .then((res) => {
          setBlueprint(res);
          // Pre-fill CMD in form if available
          if (res.cmd) {
            setFormData((prev) => ({
              ...prev,
              cmd: prev.cmd || res.cmd.join(" "),
            }));
          }
        })
        .catch(() => toast.error("Failed to inspect image"))
        .finally(() => setBlueprintLoading(false));
    }
  }, [activeTab, blueprint, blueprintLoading, data.fullId]);

  // Also load on deploy tab if not loaded yet
  useEffect(() => {
    if (activeTab === "deploy" && !blueprint && !blueprintLoading) {
      setBlueprintLoading(true);
      apiService
        .inspectImage(data.fullId)
        .then((res) => {
          setBlueprint(res);
          if (res.cmd) {
            setFormData((prev) => ({
              ...prev,
              cmd: prev.cmd || res.cmd.join(" "),
            }));
          }
        })
        .catch(() => {})
        .finally(() => setBlueprintLoading(false));
    }
  }, [activeTab, blueprint, blueprintLoading, data.fullId]);

  const updateForm = (key, value) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const imageReferences = data.references || [];
  const primaryReference =
    data.primaryReference ||
    imageReferences[0] ||
    (data.name ? `${data.name}:${data.primaryTag || data.tags?.[0] || "latest"}` : null);

  const splitReference = (reference) => {
    if (!reference) return { repo: "", tag: "latest" };
    const lastColon = reference.lastIndexOf(":");
    if (lastColon === -1) return { repo: reference, tag: "latest" };
    return {
      repo: reference.substring(0, lastColon),
      tag: reference.substring(lastColon + 1) || "latest",
    };
  };

  useEffect(() => {
    setReferenceToRename((prev) =>
      imageReferences.includes(prev) ? prev : imageReferences[0] || "",
    );
    setReferenceToUntag((prev) =>
      imageReferences.includes(prev) ? prev : imageReferences[0] || "",
    );
    setSelectedDeployRef((prev) =>
      imageReferences.includes(prev) ? prev : imageReferences[0] || (data.name === "<none>" ? data.fullId : `${data.name}:${data.primaryTag || "latest"}`),
    );
    setTagRepo(data.name === "<none>" ? "" : data.name || "");
    setTagValue("latest");
  }, [data.name, data.primaryTag, imageReferences]);

  useEffect(() => {
    const { repo, tag } = splitReference(referenceToRename);
    setRenameRepo(repo);
    setRenameTag(tag);
  }, [referenceToRename]);

  const handleTagImage = async (e) => {
    e.preventDefault();
    if (!tagRepo.trim()) {
      toast.error("Repository name is required");
      return;
    }

    setIsTagging(true);
    try {
      await toast.promise(
        apiService.tagImage(data.fullId, tagRepo.trim(), tagValue.trim() || "latest"),
        {
          loading: "Creating image tag...",
          success: `Added ${tagRepo.trim()}:${tagValue.trim() || "latest"}`,
          error: (err) =>
            err?.response?.data?.error ||
            err?.response?.data?.message ||
            "Failed to tag image",
        },
      );
      setTagValue("latest");
      setTimeout(() => onRefresh?.(), 300);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTagging(false);
    }
  };

  const handleUntagImage = async () => {
    if (!referenceToUntag) {
      toast.error("No reference selected");
      return;
    }

    setIsUntagging(true);
    try {
      await toast.promise(
        apiService.untagImage(data.fullId, referenceToUntag),
        {
          loading: `Removing ${referenceToUntag}...`,
          success: (result) =>
            result.wasLastTag
              ? `Removed ${referenceToUntag} — image is now untagged`
              : `Removed ${referenceToUntag}`,
          error: (err) =>
            err?.response?.data?.error ||
            err?.response?.data?.message ||
            "Failed to remove tag",
        },
      );
      setReferenceToUntag("");
      setTimeout(() => onRefresh?.(), 300);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUntagging(false);
    }
  };

  const handleRenameImage = async (e) => {
    e.preventDefault();
    if (!renameRepo.trim()) {
      toast.error("Repository name is required");
      return;
    }

    if (!referenceToRename) {
      toast.error("No current image reference available to rename");
      return;
    }

    setIsRenamingImage(true);
    try {
      await toast.promise(
        apiService.renameImage(
          data.fullId,
          referenceToRename,
          renameRepo.trim(),
          renameTag.trim() || "latest",
        ),
        {
          loading: "Renaming image reference...",
          success: `Renamed to ${renameRepo.trim()}:${renameTag.trim() || "latest"}`,
          error: (err) =>
            err?.response?.data?.error ||
            err?.response?.data?.message ||
            "Failed to rename image",
        },
      );
      setReferenceToRename("");
      setTimeout(() => onRefresh?.(), 300);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRenamingImage(false);
    }
  };

  const handleDeleteImage = () => {
    data.onDelete?.(data);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const config = {
        Image: selectedDeployRef || data.primaryReference || (data.name && data.name !== "<none>" ? `${data.name}:latest` : data.fullId),
        autoStart: formData.autoStart,
      };

      if (formData.name) config.name = formData.name;

      // CMD override
      if (formData.cmd.trim()) {
        config.Cmd = formData.cmd.trim().split(/\s+/);
      }

      // TTY & Interactive
      config.Tty = formData.tty;
      config.OpenStdin = formData.openStdin;

      // Attach mode
      if (formData.attachMode) {
        config.AttachStdout = true;
        config.AttachStderr = true;
      }

      // Port mappings
      if (formData.ports.trim()) {
        const ExposedPorts = {};
        const PortBindings = {};
        formData.ports.split(",").forEach((mapping) => {
          const [host, container] = mapping.trim().split(":");
          if (host && container) {
            ExposedPorts[`${container}/tcp`] = {};
            PortBindings[`${container}/tcp`] = [{ HostPort: host.trim() }];
          }
        });
        config.ExposedPorts = ExposedPorts;
        config.HostConfig = { PortBindings };
      }

      // Env vars
      if (formData.env.trim()) {
        config.Env = formData.env
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean);
      }

      // Restart policy
      if (formData.restartPolicy) {
        config.RestartPolicy = formData.restartPolicy;
      }

      // Resource limits
      if (formData.memory) config.Memory = formData.memory;
      if (formData.cpuShares) config.CpuShares = formData.cpuShares;

      // Network mode
      if (formData.networkMode) config.NetworkMode = formData.networkMode;

      await toast.promise(apiService.createContainer(config), {
        loading: formData.autoStart
          ? "Creating & starting container..."
          : "Creating container...",
        success: formData.autoStart
          ? "Container created and started!"
          : "Container created (stopped)!",
        error: (err) => err?.response?.data || "Failed to create container",
      });

      setFormData({
        name: "",
        ports: "",
        env: "",
        cmd: blueprint?.cmd?.join(" ") || "",
        tty: false,
        openStdin: false,
        restartPolicy: "",
        memory: "",
        cpuShares: "",
        autoStart: true,
        attachMode: false,
        networkMode: "",
      });
      setTimeout(() => onRefresh?.(), 500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-gray-700 overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? "text-purple-400 border-b-2 border-purple-400 bg-gray-800/50"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 sidebar-scroll">
        {/* ── Info Tab ── */}
        {activeTab === "info" && (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <p className="text-sm text-gray-200">{data.name}</p>
            </div>
            <div className="space-y-1">
              <Label>ID</Label>
              <p className="text-xs text-gray-400 font-mono break-all">{data.fullId}</p>
            </div>
            <div className="space-y-1">
              <Label>References</Label>
              <div className="flex flex-wrap gap-1">
                {imageReferences.length > 0 ? (
                  imageReferences.map((reference, i) => (
                    <span key={i} className="text-[10px] font-mono bg-purple-900/40 text-purple-400 px-2 py-0.5 rounded break-all">
                      {reference}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-500 italic">dangling image</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Size</Label>
                <p className="text-sm text-gray-200">{data.size}</p>
              </div>
              <div className="space-y-1">
                <Label>Containers</Label>
                <p className="text-sm text-gray-200">{data.containersCount || 0}</p>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Created</Label>
              <p className="text-xs text-gray-400">{new Date(data.created).toLocaleString()}</p>
            </div>

            <div className="border-t border-gray-700 pt-4 space-y-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Danger Zone
              </p>
              <ActionButton
                icon={Trash2}
                label="Delete Image"
                color="red"
                onClick={handleDeleteImage}
              />
            </div>
          </div>
        )}

        {activeTab === "actions" && (
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Add Tag
              </p>
              <form onSubmit={handleTagImage} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Repository</Label>
                  <Input
                    type="text"
                    value={tagRepo}
                    onChange={(e) => setTagRepo(e.target.value)}
                    placeholder="myrepo/myimage"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tag</Label>
                  <Input
                    type="text"
                    value={tagValue}
                    onChange={(e) => setTagValue(e.target.value)}
                    placeholder="latest"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isTagging || !tagRepo.trim()}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                    isTagging || !tagRepo.trim()
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-purple-600 text-white hover:bg-purple-500"
                  }`}
                >
                  {isTagging ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  {isTagging ? "Tagging..." : "Add Tag"}
                </button>
              </form>
              <Hint>Create an additional reference for this image without replacing existing ones.</Hint>
            </div>

            <div className="border-t border-gray-700 pt-4 space-y-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Rename Reference
              </p>
              <form onSubmit={handleRenameImage} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Current Reference</Label>
                  <Select
                    value={referenceToRename}
                    onChange={(e) => setReferenceToRename(e.target.value)}
                    disabled={imageReferences.length === 0}
                  >
                    {imageReferences.length === 0 ? (
                      <option value="">No tagged references</option>
                    ) : (
                      imageReferences.map((reference) => (
                        <option key={reference} value={reference}>
                          {reference}
                        </option>
                      ))
                    )}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>New Repository</Label>
                  <Input
                    type="text"
                    value={renameRepo}
                    onChange={(e) => setRenameRepo(e.target.value)}
                    placeholder="myrepo/myimage"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>New Tag</Label>
                  <Input
                    type="text"
                    value={renameTag}
                    onChange={(e) => setRenameTag(e.target.value)}
                    placeholder="latest"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isRenamingImage || !renameRepo.trim() || !referenceToRename}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                    isRenamingImage || !renameRepo.trim() || !referenceToRename
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : "bg-purple-600 text-white hover:bg-purple-500"
                  }`}
                >
                  {isRenamingImage ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Settings size={16} />
                  )}
                  {isRenamingImage ? "Renaming..." : "Rename Reference"}
                </button>
              </form>
              <Hint>Use this when you want to replace one specific repo:tag reference with a new name.</Hint>
            </div>

            <div className="border-t border-gray-700 pt-4 space-y-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Remove Tag
              </p>
              <div className="space-y-1.5">
                <Label>Reference to Remove</Label>
                <Select
                  value={referenceToUntag}
                  onChange={(e) => setReferenceToUntag(e.target.value)}
                  disabled={imageReferences.length === 0}
                >
                  {imageReferences.length === 0 ? (
                    <option value="">No tagged references</option>
                  ) : (
                    imageReferences.map((reference) => (
                      <option key={reference} value={reference}>
                        {reference}
                      </option>
                    ))
                  )}
                </Select>
              </div>
              <button
                type="button"
                disabled={isUntagging || !referenceToUntag}
                onClick={handleUntagImage}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                  isUntagging || !referenceToUntag
                    ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-orange-700 text-white hover:bg-orange-600"
                }`}
              >
                {isUntagging ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Tag size={16} />
                )}
                {isUntagging ? "Removing..." : "Remove Tag"}
              </button>
              <Hint>Remove a specific repo:tag reference. If this is the last tag, the image becomes untagged (dangling).</Hint>
            </div>
          </div>
        )}

        {/* ── Blueprint Tab ── */}
        {activeTab === "blueprint" && (
          <div className="space-y-4">
            {blueprintLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-purple-400" />
              </div>
            )}
            {blueprint && (
              <>
                {/* Entrypoint & CMD */}
                <div className="space-y-1">
                  <Label>Entrypoint</Label>
                  <div className="bg-gray-800 rounded px-3 py-2 font-mono text-xs text-cyan-400">
                    {blueprint.entrypoint
                      ? blueprint.entrypoint.join(" ")
                      : <span className="text-gray-600 italic">not set</span>}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Default Command (CMD)</Label>
                  <div className="bg-gray-800 rounded px-3 py-2 font-mono text-xs text-green-400">
                    {blueprint.cmd
                      ? blueprint.cmd.join(" ")
                      : <span className="text-gray-600 italic">not set</span>}
                  </div>
                  <Hint>This command runs when the container starts</Hint>
                </div>

                <div className="space-y-1">
                  <Label>Working Directory</Label>
                  <div className="flex items-center gap-2 bg-gray-800 rounded px-3 py-2">
                    <FolderOpen size={12} className="text-yellow-500" />
                    <span className="font-mono text-xs text-gray-300">
                      {blueprint.workingDir || "/"}
                    </span>
                  </div>
                </div>

                {/* Exposed Ports */}
                {blueprint.exposedPorts.length > 0 && (
                  <div className="space-y-1">
                    <Label>Exposed Ports</Label>
                    <div className="flex flex-wrap gap-1">
                      {blueprint.exposedPorts.map((port, i) => (
                        <span key={i} className="flex items-center gap-1 text-[10px] bg-blue-900/40 text-blue-400 px-2 py-1 rounded font-mono">
                          <Globe size={10} />
                          {port}
                        </span>
                      ))}
                    </div>
                    <Hint>Ports the image expects you to map to the host</Hint>
                  </div>
                )}

                {/* Environment Defaults */}
                {blueprint.env.length > 0 && (
                  <div className="space-y-1">
                    <Label>Environment Defaults</Label>
                    <div className="bg-gray-800 rounded p-2 max-h-40 overflow-y-auto sidebar-scroll space-y-1">
                      {blueprint.env.map((envVar, i) => {
                        const eqIdx = envVar.indexOf("=");
                        const key = envVar.substring(0, eqIdx);
                        const val = envVar.substring(eqIdx + 1);
                        return (
                          <div key={i} className="text-[10px] font-mono flex">
                            <span className="text-purple-400 shrink-0">{key}</span>
                            <span className="text-gray-600 mx-1">=</span>
                            <span className="text-gray-400 break-all">{val}</span>
                          </div>
                        );
                      })}
                    </div>
                    <Hint>Variables baked into the image by the developer</Hint>
                  </div>
                )}

                {/* Volumes */}
                {blueprint.volumes.length > 0 && (
                  <div className="space-y-1">
                    <Label>Volumes</Label>
                    <div className="flex flex-wrap gap-1">
                      {blueprint.volumes.map((vol, i) => (
                        <span key={i} className="text-[10px] font-mono bg-orange-900/40 text-orange-400 px-2 py-1 rounded">
                          {vol}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="border-t border-gray-700 pt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Architecture</Label>
                      <p className="text-xs text-gray-300">{blueprint.architecture}/{blueprint.os}</p>
                    </div>
                    <div className="space-y-1">
                      <Label>Layers</Label>
                      <p className="text-xs text-gray-300">{blueprint.layersCount}</p>
                    </div>
                  </div>

                  {blueprint.user && (
                    <div className="space-y-1">
                      <Label>User</Label>
                      <div className="flex items-center gap-2">
                        <Lock size={10} className="text-gray-500" />
                        <span className="text-xs text-gray-300 font-mono">{blueprint.user}</span>
                      </div>
                    </div>
                  )}

                  {blueprint.author && (
                    <div className="space-y-1">
                      <Label>Author</Label>
                      <p className="text-xs text-gray-300">{blueprint.author}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Deploy Tab ── */}
        {activeTab === "deploy" && (
          <form onSubmit={handleCreate} className="space-y-4">
            {/* Image Name */}
            <div className="space-y-1.5">
              <Label>Image</Label>
              {imageReferences.length > 1 ? (
                <Select
                  value={selectedDeployRef}
                  onChange={(e) => setSelectedDeployRef(e.target.value)}
                >
                  {imageReferences.map((ref) => (
                    <option key={ref} value={ref}>
                      {ref}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="text-sm text-purple-400 font-mono bg-gray-800 px-2 py-1.5 rounded break-all">
                  {selectedDeployRef || primaryReference || data.fullId?.substring(0, 12)}
                </p>
              )}
              {imageReferences.length > 1 && (
                <Hint>Select which reference (tag) to use for the new container.</Hint>
              )}
            </div>

            {/* Container Name */}
            <div className="space-y-1.5">
              <Label>Container Name</Label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder="my-container"
              />
            </div>

            {/* ── Command & Args Override ── */}
            <div className="space-y-1.5">
              <Label>Command Override (CMD)</Label>
              <Input
                type="text"
                value={formData.cmd}
                onChange={(e) => updateForm("cmd", e.target.value)}
                placeholder={blueprint?.cmd?.join(" ") || "e.g. npm run dev"}
              />
              <Hint>
                {blueprint?.entrypoint
                  ? `Entrypoint: ${blueprint.entrypoint.join(" ")} — your command is appended`
                  : "Leave blank to use image default"}
              </Hint>
            </div>

            {/* ── Network Mode ── */}
            <div className="space-y-1.5">
              <Label>Network Mode</Label>
              <Select
                value={formData.networkMode}
                onChange={(e) => updateForm("networkMode", e.target.value)}
              >
                <option value="">Bridge (default)</option>
                <option value="host">Host</option>
                <option value="none">None (isolated)</option>
              </Select>
              <Hint>
                {formData.networkMode === "none"
                  ? "Container will have no network access — port mappings are disabled"
                  : formData.networkMode === "host"
                    ? "Container shares the host's network stack — port mappings are not needed"
                    : "Container joins the default bridge network"}
              </Hint>
            </div>

            {/* ── Port Mappings ── */}
            <div className="space-y-1.5">
              <Label>Port Mappings</Label>
              <Input
                type="text"
                value={formData.ports}
                onChange={(e) => updateForm("ports", e.target.value)}
                placeholder={
                  blueprint?.exposedPorts?.length
                    ? blueprint.exposedPorts.map((p) => `${p.split("/")[0]}:${p.split("/")[0]}`).join(", ")
                    : "8080:80, 3000:3000"
                }
                disabled={formData.networkMode === "none" || formData.networkMode === "host"}
              />
              {formData.networkMode === "none" ? (
                <Hint>Port mappings disabled in isolated (none) mode</Hint>
              ) : formData.networkMode === "host" ? (
                <Hint>Port mappings not needed in host mode</Hint>
              ) : (
                <Hint>hostPort:containerPort (comma-separated)</Hint>
              )}
              {blueprint?.exposedPorts?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-[10px] text-gray-600">Image expects:</span>
                  {blueprint.exposedPorts.map((p, i) => (
                    <span key={i} className="text-[10px] font-mono text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded cursor-pointer hover:bg-blue-900/50"
                      onClick={() => {
                        const port = p.split("/")[0];
                        const current = formData.ports.trim();
                        const mapping = `${port}:${port}`;
                        updateForm("ports", current ? `${current}, ${mapping}` : mapping);
                      }}
                      title="Click to add mapping"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── Environment Variables ── */}
            <div className="space-y-1.5">
              <Label>Environment Variables</Label>
              <textarea
                value={formData.env}
                onChange={(e) => updateForm("env", e.target.value)}
                placeholder={"KEY=value\nFOO=bar"}
                rows={3}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none font-mono"
              />
              <Hint>One per line: KEY=value</Hint>
            </div>

            {/* ── Separator: Runtime Options ── */}
            <div className="border-t border-gray-700 pt-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3 flex items-center gap-1.5">
                <Settings size={10} />
                Runtime Options
              </p>

              <div className="space-y-3">
                <Toggle
                  label="Allocate TTY (-t)"
                  description="Allocate a pseudo-terminal (required for interactive shells)"
                  checked={formData.tty}
                  onChange={(e) => updateForm("tty", e.target.checked)}
                />
                <Toggle
                  label="Interactive (-i)"
                  description="Keep STDIN open for interactive processes"
                  checked={formData.openStdin}
                  onChange={(e) => updateForm("openStdin", e.target.checked)}
                />
                <Toggle
                  label="Attach Mode"
                  description="Attach stdout/stderr — logs start streaming immediately"
                  checked={formData.attachMode}
                  onChange={(e) => updateForm("attachMode", e.target.checked)}
                />
                <Toggle
                  label="Auto-Start"
                  description="Start the container immediately after creation"
                  checked={formData.autoStart}
                  onChange={(e) => updateForm("autoStart", e.target.checked)}
                />
              </div>
            </div>

            {/* ── Restart Policy ── */}
            <div className="space-y-1.5">
              <Label>Restart Policy</Label>
              <Select
                value={formData.restartPolicy}
                onChange={(e) => updateForm("restartPolicy", e.target.value)}
              >
                <option value="">None (default)</option>
                <option value="always">Always</option>
                <option value="unless-stopped">Unless Stopped</option>
                <option value="on-failure">On Failure</option>
              </Select>
            </div>

            {/* ── Resource Limits ── */}
            <div className="border-t border-gray-700 pt-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3 flex items-center gap-1.5">
                <Shield size={10} />
                Resource Limits
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <MemoryStick size={10} className="text-gray-500" />
                    <Label>Memory (MB)</Label>
                  </div>
                  <Input
                    type="number"
                    min="4"
                    value={formData.memory}
                    onChange={(e) => updateForm("memory", e.target.value)}
                    placeholder="512"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Cpu size={10} className="text-gray-500" />
                    <Label>CPU Shares</Label>
                  </div>
                  <Input
                    type="number"
                    min="2"
                    value={formData.cpuShares}
                    onChange={(e) => updateForm("cpuShares", e.target.value)}
                    placeholder="1024"
                  />
                  <Hint>Default: 1024. Lower = less priority</Hint>
                </div>
              </div>
            </div>

            {/* ── Submit ── */}
            <button
              type="submit"
              disabled={isCreating}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                isCreating
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-purple-600 text-white hover:bg-purple-500"
              }`}
            >
              {isCreating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              {isCreating
                ? "Creating..."
                : formData.autoStart
                  ? "Create & Start Container"
                  : "Create Container"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

// ─── Container Badge with Disconnect (for Network Sidebar) ─────────────────
const ContainerBadge = ({ containerId, containerName, containerState, networkName }) => {
  const [disconnecting, setDisconnecting] = useState(false);
  const { disconnectFromNetwork } = useFlowActions();

  const handleDisconnect = async (e) => {
    e.stopPropagation();
    setDisconnecting(true);
    try {
      await disconnectFromNetwork(containerId, networkName);
    } catch (err) {
      // handled
    } finally {
      setDisconnecting(false);
    }
  };

  const stateColor =
    containerState === "running"
      ? "bg-green-500"
      : containerState === "paused"
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="flex items-center justify-between bg-gray-800 rounded px-2 py-1.5 group">
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${stateColor}`} />
        <Box size={10} className="text-blue-400" />
        <span className="text-[11px] text-blue-400 font-medium truncate max-w-45">
          {containerName}
        </span>
      </div>
      <button
        onClick={handleDisconnect}
        disabled={disconnecting}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
          disconnecting
            ? "text-gray-500 cursor-not-allowed"
            : "text-gray-500 hover:text-red-400 hover:bg-red-900/30 opacity-0 group-hover:opacity-100"
        }`}
        title={`Disconnect ${containerName}`}
      >
        {disconnecting ? (
          <Loader2 size={10} className="animate-spin" />
        ) : (
          <X size={10} />
        )}
        {!disconnecting && "Disconnect"}
      </button>
    </div>
  );
};

// ─── Network Sidebar ─────────────────────────────────────────────────────────
const NetworkSidebar = ({ data, onRefresh }) => {
  const { nodes: flowNodes, edges: flowEdges } = useFlowActions();
  const isSystemNetwork = ["bridge", "host", "none"].includes(
    (data.name || "").toLowerCase(),
  );
  const [renameValue, setRenameValue] = useState(data.name || "");
  const [isRenamingNetwork, setIsRenamingNetwork] = useState(false);

  useEffect(() => {
    setRenameValue(data.name || "");
  }, [data.name]);

  const handleRenameNetwork = async (e) => {
    e.preventDefault();
    const nextName = renameValue.trim();

    if (!nextName) {
      toast.error("Network name is required");
      return;
    }

    if (nextName === data.name) {
      toast.error("Enter a different network name");
      return;
    }

    setIsRenamingNetwork(true);
    try {
      await toast.promise(apiService.renameNetwork(data.fullId, nextName), {
        loading: "Renaming network...",
        success: `Network renamed to ${nextName}`,
        error: (err) => err?.response?.data?.error || "Failed to rename network",
      });
      setTimeout(() => onRefresh?.(), 300);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRenamingNetwork(false);
    }
  };

  // Find containers connected to this network from edges
  const connectedContainers = (flowEdges || [])
    .filter((e) => e.target === data.name && e.type === "network")
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-gray-700">
        <div className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-orange-400 border-b-2 border-orange-400 bg-gray-800/50">
          <Info size={14} />
          Info
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 sidebar-scroll">
        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
            Name
          </label>
          <p className="text-sm text-gray-200">{data.name}</p>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
            ID
          </label>
          <p className="text-xs text-gray-400 font-mono break-all">
            {data.fullId}
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
            Driver
          </label>
          <p className="text-sm text-gray-200 uppercase">{data.driver}</p>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
            Containers
          </label>
          <div className="bg-gray-800 rounded p-3 flex items-center justify-between">
            <span className="text-gray-400 text-xs">Active / Total</span>
            <span className="text-sm font-bold">
              <span
                className={
                  data.activeContainersCount > 0
                    ? "text-green-400"
                    : "text-gray-500"
                }
              >
                {data.activeContainersCount || 0}
              </span>
              <span className="text-gray-600 mx-1">/</span>
              <span className="text-gray-300">
                {data.totalContainersCount || 0}
              </span>
            </span>
          </div>
        </div>

        {/* Connected Containers with Disconnect */}
        {connectedContainers.length > 0 && (
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
              Connected Containers
            </label>
            <div className="space-y-1">
              {connectedContainers.map((c) => (
                <ContainerBadge
                  key={c.id}
                  containerId={c.id}
                  containerName={c.name}
                  containerState={c.state}
                  networkName={data.name}
                />
              ))}
            </div>
          </div>
        )}

        {!isSystemNetwork && (
          <div className="border-t border-gray-700 pt-4 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
              Rename Network
            </p>
            <form onSubmit={handleRenameNetwork} className="space-y-3">
              <Input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="new-network-name"
              />
              <button
                type="submit"
                disabled={isRenamingNetwork || !renameValue.trim()}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors ${
                  isRenamingNetwork || !renameValue.trim()
                    ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-orange-600 text-white hover:bg-orange-500"
                }`}
              >
                {isRenamingNetwork ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Settings size={16} />
                )}
                {isRenamingNetwork ? "Renaming..." : "Rename Network"}
              </button>
            </form>
          </div>
        )}

        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <p className="text-[10px] text-gray-500 uppercase font-semibold mb-2">
            Drag-to-Connect
          </p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Drag an edge from this network node to a container node on
            the canvas to connect them to this network.
          </p>
        </div>

        {!isSystemNetwork && (
          <div className="border-t border-gray-700 pt-4 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
              Danger Zone
            </p>
            <ActionButton
              icon={Trash2}
              label="Delete Network"
              color="red"
              onClick={() => data.onDelete?.(data)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Sidebar ────────────────────────────────────────────────────────────
const Sidebar = ({ selectedNode, onClose, onRefresh, flowActions }) => {
  if (!selectedNode) return null;

  const { type, data } = selectedNode;

  const typeConfig = {
    container: { icon: Box, color: "text-blue-400", label: "Container" },
    image: { icon: Layers, color: "text-purple-400", label: "Image" },
    network: { icon: Network, color: "text-orange-400", label: "Network" },
  };

  const config = typeConfig[type] || typeConfig.container;

  return (
    <div className="fixed top-0 right-0 h-full w-110 bg-gray-900 border-l border-gray-700 shadow-2xl z-50 flex flex-col animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2 min-w-0">
          <config.icon size={18} className={config.color} />
          <div className="min-w-0">
            <span
              className={`text-[10px] uppercase tracking-wider ${config.color} font-semibold`}
            >
              {config.label}
            </span>
            <h2
              className="text-sm font-bold text-white truncate"
              title={data.name}
            >
              {data.name || "Unknown"}
            </h2>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {type === "container" && (
          <ContainerSidebar
            data={data}
            onClose={onClose}
            onRefresh={onRefresh}
            flowActions={flowActions}
          />
        )}
        {type === "image" && (
          <ImageSidebar data={data} onRefresh={onRefresh} />
        )}
        {type === "network" && <NetworkSidebar data={data} onRefresh={onRefresh} />}
      </div>
    </div>
  );
};

export default Sidebar;
