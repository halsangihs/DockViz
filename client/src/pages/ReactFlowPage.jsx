import { useEffect, useState, useCallback, useRef } from "react";
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  Background,
  Controls,
  useNodesInitialized,
  useReactFlow,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ContainerNode from "../components/nodes/ContainerNode";
import ImageNode from "../components/nodes/ImageNode";
import NetworkNode from "../components/nodes/NetworkNode";
import NetworkEdge from "../components/edges/NetworkEdge";
import Sidebar from "../components/Sidebar";
import loadInitialData from "../utils/initialDataLoader";
import getLayoutedElements from "../utils/autoLayout";
import toast from "react-hot-toast";
import socket from "../utils/socket";
import { apiService } from "../api/apiService";
import { Trash2, RefreshCw, Loader2, Plus } from "lucide-react";
import FlowActionsContext from "../context/FlowActionsContext";
import EdgeDisconnectModal from "../components/EdgeDisconnectModal";
import CreateNetworkModal from "../components/CreateNetworkModal";
import DeleteNetworkModal from "../components/DeleteNetworkModal";
import PullImageModal from "../components/PullImageModal";
import DeleteImageModal from "../components/DeleteImageModal";
import DeleteContainerModal from "../components/DeleteContainerModal";

const nodeTypes = {
  container: ContainerNode,
  image: ImageNode,
  network: NetworkNode,
};

const edgeTypes = {
  network: NetworkEdge,
};

const defaultEdgeOptions = {
  style: {
    strokeWidth: 2,
    stroke: "#9ca3af",
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 10,
    height: 10,
    color: "#9ca3af",
  },
};

const ReactFlowPage = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isPruning, setIsPruning] = useState(false);
  const [edgeModal, setEdgeModal] = useState(null);
  const [showCreateNetworkModal, setShowCreateNetworkModal] = useState(false);
  const [deleteNetworkModal, setDeleteNetworkModal] = useState(null);
  const [showPullImageModal, setShowPullImageModal] = useState(false);
  const [deleteImageModal, setDeleteImageModal] = useState(null);
  const [deleteContainerModal, setDeleteContainerModal] = useState(null);
  // Track edges we've already optimistically updated from onConnect
  const handledEdgesRef = useRef(new Set());

  const onNodesChange = useCallback((changes) => {
    setNodes((prevNodes) => applyNodeChanges(changes, prevNodes));
  }, []);

  const onEdgesChange = useCallback((changes) => {
    setEdges((prevEdges) => applyEdgeChanges(changes, prevEdges));
  }, []);

  const isNodeInitialized = useNodesInitialized();
  const { fitView, updateNodeData, getNode } = useReactFlow();

  // Derive selected node from current nodes state
  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId) || null
    : null;

  // Inject action callbacks into network and image nodes
  const injectNodeCallbacks = useCallback((nodeList) => {
    return nodeList.map((n) => {
      if (n.type === "container") {
        return {
          ...n,
          data: {
            ...n.data,
            onDelete: (containerData) => setDeleteContainerModal(containerData),
          },
        };
      }
      if (n.type === "network") {
        return {
          ...n,
          data: {
            ...n.data,
            onDelete: (networkData) => setDeleteNetworkModal(networkData),
          },
        };
      }
      if (n.type === "image") {
        return {
          ...n,
          data: {
            ...n.data,
            onDelete: (imageData) => setDeleteImageModal(imageData),
          },
        };
      }
      return n;
    });
  }, []);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const { nodes, edges } = await loadInitialData();
        setNodes(injectNodeCallbacks(nodes));
        setEdges(edges);
      } catch (error) {
        toast.error("Error loading initial data");
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Refresh all data
  const refreshData = useCallback(async () => {
    try {
      const result = await loadInitialData();
      if (result) {
        setNodes(injectNodeCallbacks(result.nodes));
        setEdges(result.edges);
        setSelectedNodeId(null);
        setTimeout(() => fitView(), 100);
      }
    } catch (error) {
      toast.error("Error refreshing data");
    }
  }, [fitView, injectNodeCallbacks]);

  // Container state change events
  useEffect(() => {
    socket.on("container_state_change", ({ id, state }) => {
      const containerNode = getNode(id);
      if (!containerNode) return;

      // Skip if the state hasn't actually changed (e.g. die + stop both emit "exited")
      if (containerNode.data.state === state) return;

      const containerNetworks = containerNode.data.networks;
      const wasRunning = containerNode.data.state === "running";
      const isNowRunning = state === "running";

      // Only update active counts when running status actually changes
      if (wasRunning !== isNowRunning) {
        containerNetworks.forEach((networkName) => {
          updateNodeData(networkName, (prevData) => ({
            activeContainersCount: isNowRunning
              ? prevData.data.activeContainersCount + 1
              : Math.max(prevData.data.activeContainersCount - 1, 0),
          }));
        });
      }

      updateNodeData(id, { state });

      setEdges((prevEdges) =>
        prevEdges.map((edge) => {
          if (edge.source === id || edge.target === id) {
            return { ...edge, animated: state === "running" };
          }
          return edge;
        }),
      );
    });

    return () => socket.off("container_state_change");
  }, [updateNodeData, getNode]);

  // Container removed events
  useEffect(() => {
    socket.on("container_removed", ({ id }) => {
      setNodes((prev) => prev.filter((n) => n.id !== id));
      setEdges((prev) =>
        prev.filter((e) => e.source !== id && e.target !== id),
      );
      setSelectedNodeId((prev) => (prev === id ? null : prev));
    });

    return () => socket.off("container_removed");
  }, []);

  // Image removed events → refresh
  useEffect(() => {
    socket.on("image_removed", () => {
      refreshData();
    });

    return () => socket.off("image_removed");
  }, [refreshData]);

  // Image changed events → refresh
  useEffect(() => {
    socket.on("image_changed", () => {
      refreshData();
    });

    return () => socket.off("image_changed");
  }, [refreshData]);

  // Network created events → add node to canvas
  useEffect(() => {
    socket.on("network_created", ({ networkId, name: netName, driver }) => {
      // Skip "none" / null-driver networks
      if (driver === "null" || netName === "none") return;

      // Don't add if already present
      setNodes((prev) => {
        if (prev.some((n) => n.data?.fullId === networkId || n.id === netName)) {
          return prev;
        }
        const newNode = {
          id: netName,
          type: "network",
          position: { x: Math.random() * 400 + 200, y: 500 },
          data: {
            id: networkId.substring(0, 12),
            fullId: networkId,
            name: netName,
            driver: driver || "bridge",
            activeContainersCount: 0,
            totalContainersCount: 0,
            onDelete: (networkData) => setDeleteNetworkModal(networkData),
          },
          deletable: false,
        };
        return [...prev, newNode];
      });
    });

    return () => socket.off("network_created");
  }, []);

  // Network destroyed events → remove node, edges, and update container data
  useEffect(() => {
    socket.on("network_destroyed", ({ networkId, name: netName }) => {
      // Single atomic setNodes: remove network node AND strip the network
      // name from every container's data.networks to avoid state races
      setNodes((prev) =>
        prev
          .filter(
            (n) =>
              !(
                n.type === "network" &&
                (n.data.fullId === networkId || n.id === netName)
              ),
          )
          .map((n) => {
            if (n.type !== "container") return n;
            const nets = n.data.networks || [];
            if (!nets.includes(netName)) return n;
            return {
              ...n,
              data: {
                ...n.data,
                networks: nets.filter((name) => name !== netName),
              },
            };
          }),
      );

      // Remove all edges targeting this network
      setEdges((prev) =>
        prev.filter((e) => e.target !== netName),
      );

      setSelectedNodeId((prev) =>
        prev === netName ? null : prev,
      );
      // Close delete modal if it's for this network
      setDeleteNetworkModal((prev) =>
        prev && (prev.fullId === networkId || prev.name === netName)
          ? null
          : prev,
      );
    });

    return () => socket.off("network_destroyed");
  }, []);

  // Network change events → targeted updates
  useEffect(() => {
    socket.on("network_change", ({ networkId, containerId, action }) => {
      if (!containerId) return;

      const containerNode = getNode(containerId);

      // Find the network node by fullId
      const networkNode = nodes.find(
        (n) => n.type === "network" && n.data.fullId === networkId,
      );

      // "none" network has no canvas node — only update container data.
      // Also handles disconnect events that arrive after network_destroyed
      // has already removed the network node.
      if (!networkNode) {
        if (containerNode && action === "disconnect") {
          // The network node is gone but the container may still reference
          // the network name.  We can't derive the name from a deleted node,
          // so strip any network whose fullId matches.
          setNodes((prev) =>
            prev.map((n) => {
              if (n.id !== containerId || n.type !== "container") return n;
              const nets = n.data.networks || [];
              // We don't know the exact name; filter by checking all remaining
              // network nodes — anything NOT matching a live network node is stale.
              const liveNetworkNames = prev
                .filter((nd) => nd.type === "network")
                .map((nd) => nd.data.name);
              const cleaned = nets.filter((name) => liveNetworkNames.includes(name));
              if (cleaned.length === nets.length) return n;
              return { ...n, data: { ...n.data, networks: cleaned } };
            }),
          );
        }
        return;
      }

      const networkName = networkNode.data.name;
      const edgeId = `${containerId}--${networkName}`;
      const isRunning = containerNode?.data?.state === "running";

      // Skip if onConnect already handled this optimistically
      if (handledEdgesRef.current.has(edgeId)) {
        handledEdgesRef.current.delete(edgeId);
        return;
      }

      if (action === "connect") {
        // Add edge if it doesn't already exist
        const edgeId = `${containerId}--${networkName}`;

        // Check if this is a redundant connect (container already on this network)
        const alreadyConnected =
          containerNode && (containerNode.data.networks || []).includes(networkName);

        setEdges((prev) => {
          const exists = prev.some((e) => e.id === edgeId);
          if (exists) {
            // Edge exists (from onConnect pending) → make it solid
            return prev.map((e) =>
              e.id === edgeId
                ? {
                    ...e,
                    animated: isRunning,
                    style: { strokeWidth: 2, stroke: "#9ca3af" },
                  }
                : e,
            );
          }
          // Edge doesn't exist (external connection) → add it
          return [
            ...prev,
            {
              id: edgeId,
              source: containerId,
              target: networkName,
              type: "network",
              animated: isRunning,
              deletable: false,
            },
          ];
        });

        // Update container networks
        if (containerNode) {
          updateNodeData(containerId, (prev) => {
            const nets = prev.data.networks || [];
            if (!nets.includes(networkName)) {
              return { networks: [...nets, networkName] };
            }
            return {};
          });
        }

        // Only update network counts for genuinely new connections
        if (!alreadyConnected) {
          updateNodeData(networkName, (prev) => ({
            totalContainersCount: (prev.data.totalContainersCount || 0) + 1,
            activeContainersCount:
              (prev.data.activeContainersCount || 0) + (isRunning ? 1 : 0),
          }));
        }
      } else if (action === "disconnect") {
        // Remove edge
        const edgeId = `${containerId}--${networkName}`;
        setEdges((prev) => prev.filter((e) => e.id !== edgeId));

        // Update container networks
        if (containerNode) {
          updateNodeData(containerId, (prev) => ({
            networks: (prev.data.networks || []).filter(
              (n) => n !== networkName,
            ),
          }));
        }

        // Update network counts
        updateNodeData(networkName, (prev) => ({
          totalContainersCount: Math.max(
            (prev.data.totalContainersCount || 1) - 1,
            0,
          ),
          activeContainersCount: Math.max(
            (prev.data.activeContainersCount || 0) - (isRunning ? 1 : 0),
            0,
          ),
        }));
      }
    });

    return () => socket.off("network_change");
  }, [updateNodeData, getNode, nodes]);

  // Container stats (real-time CPU/Memory)
  useEffect(() => {
    socket.on("container-stats", (stats) => {
      stats.forEach(({ id, cpu, memory }) => {
        updateNodeData(id, { cpu, memory });
      });
    });

    return () => socket.off("container-stats");
  }, [updateNodeData]);

  // Layout on init
  useEffect(() => {
    if (isNodeInitialized) {
      const { layoutedNodes, layoutedEdges } = getLayoutedElements({
        nodes,
        edges,
      });
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
      fitView();
      setIsLoading(false);
    }
  }, [isNodeInitialized]);

  // Node click → open sidebar
  const onNodeClick = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
  }, []);

  // Click on pane → close sidebar
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Edge click → open disconnect modal (for network edges)
  const onEdgeClick = useCallback(
    (_event, edge) => {
      if (edge.type !== "network") return;
      const containerNode = getNode(edge.source);
      setEdgeModal({
        containerId: edge.source,
        containerName:
          containerNode?.data?.name || edge.source.substring(0, 12),
        networkName: edge.target,
      });
    },
    [getNode],
  );

  // Drag-to-connect: Network ↔ Container
  const onConnect = useCallback(
    async (params) => {
      const sourceNode = getNode(params.source);
      const targetNode = getNode(params.target);
      if (!sourceNode || !targetNode) return;

      let networkNode, containerNode;
      if (
        sourceNode.type === "network" &&
        targetNode.type === "container"
      ) {
        networkNode = sourceNode;
        containerNode = targetNode;
      } else if (
        sourceNode.type === "container" &&
        targetNode.type === "network"
      ) {
        networkNode = targetNode;
        containerNode = sourceNode;
      } else {
        toast.error("Can only connect networks to containers");
        return;
      }

      const networkName = networkNode.data.name;
      const edgeId = `${containerNode.id}--${networkName}`;

      // Check if already connected
      if ((containerNode.data.networks || []).includes(networkName)) {
        toast.error(`Already connected to ${networkName}`);
        return;
      }

      // Add animated pending edge (yellow dashed)
      const pendingEdge = {
        id: edgeId,
        source: containerNode.id,
        target: networkName,
        type: "network",
        animated: true,
        style: { strokeWidth: 2, stroke: "#f59e0b", strokeDasharray: "5,5" },
        deletable: false,
      };

      setEdges((prev) => [...prev, pendingEdge]);

      // Mark BEFORE the API call so duplicate socket events are caught
      handledEdgesRef.current.add(edgeId);

      try {
        await apiService.connectToNetwork(
          networkNode.data.fullId,
          containerNode.id,
        );

        const isRunning = containerNode.data.state === "running";

        // 1. Update edge to solid
        setEdges((prev) =>
          prev.map((e) =>
            e.id === edgeId
              ? {
                  ...e,
                  animated: isRunning,
                  style: { strokeWidth: 2, stroke: "#9ca3af" },
                }
              : e,
          ),
        );

        // 2. Update container node's networks (with dedup guard)
        updateNodeData(containerNode.id, (prev) => {
          const nets = prev.data.networks || [];
          if (nets.includes(networkName)) return {};
          return { networks: [...nets, networkName] };
        });

        // 3. Update network node's container counts
        updateNodeData(networkName, (prev) => ({
          totalContainersCount: (prev.data.totalContainersCount || 0) + 1,
          activeContainersCount:
            (prev.data.activeContainersCount || 0) + (isRunning ? 1 : 0),
        }));

        // Clean up the ref after a delay
        setTimeout(() => handledEdgesRef.current.delete(edgeId), 5000);

        toast.success(
          `Connected ${containerNode.data.name} to ${networkName}`,
        );
      } catch (error) {
        toast.error("Failed to connect container to network");
        // Remove the pending edge and ref on failure
        handledEdgesRef.current.delete(edgeId);
        setEdges((prev) => prev.filter((e) => e.id !== edgeId));
      }
    },
    [getNode, updateNodeData],
  );

  // Centralized disconnect: used by both NetworkEdge buttons and Sidebar
  const disconnectFromNetwork = useCallback(
    async (containerId, networkName) => {
      const networkNode = nodes.find(
        (n) => n.type === "network" && n.data.name === networkName,
      );
      if (!networkNode) return;

      const networkFullId = networkNode.data.fullId;
      const containerNode = getNode(containerId);
      const isRunning = containerNode?.data?.state === "running";
      const edgeId = `${containerId}--${networkName}`;

      // Mark as handled so socket event won't double-update
      handledEdgesRef.current.add(edgeId);
      setTimeout(() => handledEdgesRef.current.delete(edgeId), 5000);

      // Optimistic: remove edge
      setEdges((prev) => prev.filter((e) => e.id !== edgeId));

      // Update container networks
      updateNodeData(containerId, (prev) => ({
        networks: (prev.data.networks || []).filter((n) => n !== networkName),
      }));

      // Update network counts
      updateNodeData(networkName, (prev) => ({
        totalContainersCount: Math.max(
          (prev.data.totalContainersCount || 1) - 1,
          0,
        ),
        activeContainersCount: Math.max(
          (prev.data.activeContainersCount || 0) - (isRunning ? 1 : 0),
          0,
        ),
      }));

      try {
        await apiService.disconnectFromNetwork(networkFullId, containerId);
        toast.success(
          `Disconnected ${containerNode?.data?.name || "container"} from ${networkName}`,
        );
      } catch (error) {
        toast.error("Failed to disconnect from network");
        // Revert on failure
        handledEdgesRef.current.delete(edgeId);
        setEdges((prev) => [
          ...prev,
          {
            id: edgeId,
            source: containerId,
            target: networkName,
            type: "network",
            animated: isRunning,
            deletable: false,
          },
        ]);
        updateNodeData(containerId, (prev) => ({
          networks: [...(prev.data.networks || []), networkName],
        }));
        updateNodeData(networkName, (prev) => ({
          totalContainersCount: (prev.data.totalContainersCount || 0) + 1,
          activeContainersCount:
            (prev.data.activeContainersCount || 0) + (isRunning ? 1 : 0),
        }));
      }
    },
    [nodes, getNode, updateNodeData],
  );


  // Prune unused images
  const handlePrune = async () => {
    setIsPruning(true);
    try {
      await toast.promise(apiService.pruneImages(), {
        loading: "Pruning unused images...",
        success: "Images pruned successfully!",
        error: "Failed to prune images",
      });
      await refreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsPruning(false);
    }
  };

  return (
    <FlowActionsContext.Provider value={{ disconnectFromNetwork, nodes, edges }}>
    <div style={{ width: "100vw", height: "100vh" }} className="relative">
      {/* ── Header Bar ── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-gray-900/90 backdrop-blur border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white tracking-tight">
            🐳 DockViz
          </h1>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
            Docker Management
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPullImageModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-300 bg-purple-900/30 hover:bg-purple-900/50 rounded-lg transition-colors border border-purple-800"
          >
            <Plus size={12} />
            Pull Image
          </button>
          <button
            onClick={() => setShowCreateNetworkModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-300 bg-orange-900/30 hover:bg-orange-900/50 rounded-lg transition-colors border border-orange-800"
          >
            <Plus size={12} />
            Network
          </button>
          <button
            onClick={refreshData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
          <button
            onClick={handlePrune}
            disabled={isPruning}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
              isPruning
                ? "text-gray-500 bg-gray-800 border-gray-700 cursor-not-allowed"
                : "text-red-400 bg-red-900/30 hover:bg-red-900/50 border-red-800"
            }`}
          >
            {isPruning ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
            Prune Images
          </button>
        </div>
      </div>

      {/* ── React Flow Canvas ── */}
      <ReactFlow
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onConnect={onConnect}
        defaultEdgeOptions={defaultEdgeOptions}
        style={{ backgroundColor: "#000" }}
        fitView
        fitViewOptions={{ padding: 0.4, includeHiddenNodes: false }}
      >
        <Background color="black" gap={16} />
        <Controls className="bottom-4! left-4!" />
      </ReactFlow>

      {/* ── Sidebar ── */}
      <Sidebar
        selectedNode={selectedNode}
        onClose={() => setSelectedNodeId(null)}
        onRefresh={refreshData}
        flowActions={{ setEdges, updateNodeData, getNode, handledEdgesRef }}
      />

      {/* ── Edge Disconnect Modal ── */}
      {edgeModal && (
        <EdgeDisconnectModal
          edgeData={edgeModal}
          onClose={() => setEdgeModal(null)}
        />
      )}

      {/* ── Create Network Modal ── */}
      {showCreateNetworkModal && (
        <CreateNetworkModal
          onClose={() => setShowCreateNetworkModal(false)}
          onCreated={() => {}}
        />
      )}

      {/* ── Pull Image Modal ── */}
      {showPullImageModal && (
        <PullImageModal onClose={() => setShowPullImageModal(false)} />
      )}

      {/* ── Delete Network Modal ── */}
      {deleteNetworkModal && (
        <DeleteNetworkModal
          networkData={deleteNetworkModal}
          onClose={() => setDeleteNetworkModal(null)}
          onDeleted={() => {}}
        />
      )}

      {/* ── Delete Container Modal ── */}
      {deleteContainerModal && (
        <DeleteContainerModal
          containerData={deleteContainerModal}
          onClose={() => setDeleteContainerModal(null)}
          onDeleted={() => {
            setDeleteContainerModal(null);
            setSelectedNodeId((prev) =>
              prev === deleteContainerModal.fullId ? null : prev,
            );
          }}
        />
      )}

      {/* ── Delete Image Modal ── */}
      {deleteImageModal && (
        <DeleteImageModal
          imageData={deleteImageModal}
          onClose={() => setDeleteImageModal(null)}
          onDeleted={() => {
            setDeleteImageModal(null);
            setSelectedNodeId((prev) =>
              prev === deleteImageModal.fullId ? null : prev,
            );
          }}
        />
      )}
    </div>
    </FlowActionsContext.Provider>
  );
};

export default ReactFlowPage;
