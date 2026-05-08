import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Panel,
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
import {
  Trash2,
  RefreshCw,
  Loader2,
  Plus,
  Search,
  Box,
  Layers,
  Network,
  Play,
  ChevronDown,
  ChevronRight,
  Monitor,
} from "lucide-react";
import FlowActionsContext from "../context/FlowActionsContext";
import EdgeDisconnectModal from "../components/EdgeDisconnectModal";
import CreateNetworkModal from "../components/CreateNetworkModal";
import DeleteNetworkModal from "../components/DeleteNetworkModal";
import PullImageModal from "../components/PullImageModal";
import DeleteImageModal from "../components/DeleteImageModal";
import DeleteContainerModal from "../components/DeleteContainerModal";
import SummaryDashboard from "../components/SummaryDashboard";

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
    stroke: "#4b5563",
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 10,
    height: 10,
    color: "#4b5563",
  },
};

const ReactFlowPage = () => {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPruning, setIsPruning] = useState(false);
  const [edgeModal, setEdgeModal] = useState(null);
  const [showCreateNetworkModal, setShowCreateNetworkModal] = useState(false);
  const [deleteNetworkModal, setDeleteNetworkModal] = useState(null);
  const [showPullImageModal, setShowPullImageModal] = useState(false);
  const [deleteImageModal, setDeleteImageModal] = useState(null);
  const [deleteContainerModal, setDeleteContainerModal] = useState(null);
  // Track edges we've already optimistically updated from onConnect
  const handledEdgesRef = useRef(new Set());

  // Computed state for highlighting reachable topology
  const [highlightedNodes, setHighlightedNodes] = useState(new Set());
  const [highlightedEdges, setHighlightedEdges] = useState(new Set());

  useEffect(() => {
    if (!selectedNodeId) {
      setHighlightedNodes(new Set());
      setHighlightedEdges(new Set());
      return;
    }

    const visitedNodes = new Set([selectedNodeId]);
    const visitedEdges = new Set();

    const selectedNode = nodes.find((n) => n.id === selectedNodeId);
    if (!selectedNode) return;

    if (selectedNode.type === "image") {
      // Find all containers belonging to this image
      const containerEdges = edges.filter((e) => e.source === selectedNodeId);
      containerEdges.forEach((e) => {
        visitedEdges.add(e.id);
        visitedNodes.add(e.target); // container node

        // Find networks those containers are connected to
        const networkEdges = edges.filter((ne) => ne.source === e.target);
        networkEdges.forEach((ne) => {
          visitedEdges.add(ne.id);
          visitedNodes.add(ne.target); // network node
        });
      });
    } else if (selectedNode.type === "container") {
      // Highlight its parent image
      const imageEdges = edges.filter((e) => e.target === selectedNodeId);
      imageEdges.forEach((e) => {
        visitedEdges.add(e.id);
        visitedNodes.add(e.source); // image node
      });

      // Highlight its connected networks
      const networkEdges = edges.filter((e) => e.source === selectedNodeId);
      networkEdges.forEach((e) => {
        visitedEdges.add(e.id);
        visitedNodes.add(e.target); // network node
      });
    } else if (selectedNode.type === "network") {
      // Find all containers connected to this network
      const containerEdges = edges.filter((e) => e.target === selectedNodeId);
      containerEdges.forEach((e) => {
        visitedEdges.add(e.id);
        visitedNodes.add(e.source); // container node

        // Find parent images for these containers
        const imageEdges = edges.filter((ie) => ie.target === e.source);
        imageEdges.forEach((ie) => {
          visitedEdges.add(ie.id);
          visitedNodes.add(ie.source); // image node
        });
      });
    }

    setHighlightedNodes(visitedNodes);
    setHighlightedEdges(visitedEdges);
  }, [selectedNodeId, edges, nodes]);

  const displayNodes = useMemo(() => {
    return nodes.map((node) => {
      let opacity = 1;

      const isSearchActive = searchQuery.trim().length > 0;
      const isSelectedActive = selectedNodeId !== null;

      let matchesSearch = true;
      if (isSearchActive) {
        const query = searchQuery.toLowerCase();
        const searchTarget =
          `${node.data?.name || ""} ${node.data?.fullId || ""} ${node.type}`.toLowerCase();
        matchesSearch = searchTarget.includes(query);
      }

      if (isSelectedActive && isSearchActive) {
        opacity = highlightedNodes.has(node.id) && matchesSearch ? 1 : 0.2;
      } else if (isSelectedActive) {
        opacity = highlightedNodes.has(node.id) ? 1 : 0.2;
      } else if (isSearchActive) {
        opacity = matchesSearch ? 1 : 0.2;
      }

      return {
        ...node,
        style: {
          ...(node.style || {}),
          opacity,
          transition: "opacity 0.3s ease-in-out",
        },
      };
    });
  }, [nodes, selectedNodeId, highlightedNodes, searchQuery]);

  const displayEdges = useMemo(() => {
    return edges.map((edge) => {
      let opacity = 1;
      const isSearchActive = searchQuery.trim().length > 0;
      const isSelectedActive = selectedNodeId !== null;

      if (isSelectedActive) {
        opacity = highlightedEdges.has(edge.id) ? 1 : 0.1;
      } else if (isSearchActive) {
        // Find if source or target matches search
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);

        const query = searchQuery.toLowerCase();
        const srcMatches = sourceNode
          ? `${sourceNode.data?.name || ""} ${sourceNode.data?.fullId || ""} ${sourceNode.type}`
              .toLowerCase()
              .includes(query)
          : false;
        const tgtMatches = targetNode
          ? `${targetNode.data?.name || ""} ${targetNode.data?.fullId || ""} ${targetNode.type}`
              .toLowerCase()
              .includes(query)
          : false;

        opacity = srcMatches || tgtMatches ? 1 : 0.1;
      }

      return {
        ...edge,
        style: {
          ...(edge.style || {}),
          opacity,
          transition: "opacity 0.3s ease-in-out",
        },
      };
    });
  }, [edges, selectedNodeId, highlightedEdges, searchQuery, nodes]);

  const onNodesChange = useCallback((changes) => {
    setNodes((prevNodes) => applyNodeChanges(changes, prevNodes));
  }, []);

  const onEdgesChange = useCallback((changes) => {
    setEdges((prevEdges) => applyEdgeChanges(changes, prevEdges));
  }, []);

  const isNodeInitialized = useNodesInitialized();
  const { fitView, updateNodeData, getNode, setCenter, getZoom } = useReactFlow();

  // Smoothly center camera when selecting a node
  useEffect(() => {
    if (selectedNodeId) {
      const node = getNode(selectedNodeId);
      if (node && node.position) {
        const x = node.position.x + (node.measured?.width || 250) / 2;
        const y = node.position.y + (node.measured?.height || 100) / 2;
        setCenter(x, y, { zoom: Math.max(getZoom(), 1.2), duration: 800 });
      }
    }
  }, [selectedNodeId, getNode, setCenter, getZoom]);

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
        if (
          prev.some((n) => n.data?.fullId === networkId || n.id === netName)
        ) {
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
      setEdges((prev) => prev.filter((e) => e.target !== netName));

      setSelectedNodeId((prev) => (prev === netName ? null : prev));
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
              const cleaned = nets.filter((name) =>
                liveNetworkNames.includes(name),
              );
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
          containerNode &&
          (containerNode.data.networks || []).includes(networkName);

        setEdges((prev) => {
          const exists = prev.some((e) => e.id === edgeId);
          if (exists) {
            // Edge exists (from onConnect pending) → make it solid
            return prev.map((e) =>
              e.id === edgeId
                ? {
                    ...e,
                    animated: isRunning,
                    style: { strokeWidth: 2, stroke: "#6b7280" },
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
    setSearchQuery(""); // Clear search when a node is clicked on the canvas
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
      if (sourceNode.type === "network" && targetNode.type === "container") {
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
                  style: { strokeWidth: 2, stroke: "#6b7280" },
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

        toast.success(`Connected ${containerNode.data.name} to ${networkName}`);
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

  const totalImages = nodes.filter((n) => n.type === "image").length;
  const totalContainers = nodes.filter((n) => n.type === "container").length;
  const runningContainers = nodes.filter(
    (n) => n.type === "container" && n.data?.state === "running",
  ).length;
  const totalNetworks = nodes.filter((n) => n.type === "network").length;

  return (
    <FlowActionsContext.Provider
      value={{ disconnectFromNetwork, nodes, edges }}
    >
      <div style={{ width: "100vw", height: "100vh" }} className="flex flex-col bg-[#09090b] overflow-hidden">
        {/* ── Header Bar ── */}
        <div className="z-10 flex items-center justify-between px-4 py-2 bg-gray-900/90 backdrop-blur border-b border-gray-800 shrink-0">
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

        <div className="flex-1 flex overflow-hidden relative">
          <div className="w-80 h-full border-r border-gray-800 bg-[#09090b] z-20 flex-shrink-0">
            <SummaryDashboard 
              nodes={nodes} 
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSelectNode={(id) => {
                setSelectedNodeId(id);
                if (id !== null) {
                  setSearchQuery(""); // clear search query only when an item is actually clicked
                }
              }}
            />
          </div>
          
          <div className="flex-1 relative h-full">
            {/* ── React Flow Canvas ── */}
            <ReactFlow
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              nodes={displayNodes}
              edges={displayEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onPaneClick={onPaneClick}
              onConnect={onConnect}
              defaultEdgeOptions={defaultEdgeOptions}
              style={{ backgroundColor: "#09090b" }}
              fitView
              fitViewOptions={{ padding: 0.4, includeHiddenNodes: false }}
            >
              <Background color="#27272a" gap={20} size={1.5} />
              <Controls className="bottom-4! left-4! bg-gray-900! border-gray-700! fill-gray-300!" />
            </ReactFlow>
          </div>
        </div>

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
