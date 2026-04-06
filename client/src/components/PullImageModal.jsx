import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Download,
  Search,
  Loader2,
  Star,
  BadgeCheck,
  Layers,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import toast from "react-hot-toast";
import socket from "../utils/socket";
import { apiService } from "../api/apiService";

// ── Layer Progress Bar ───────────────────────────────────────────────────────
const LayerProgress = ({ id, status, progress, progressDetail }) => {
  const current = progressDetail?.current || 0;
  const total = progressDetail?.total || 0;
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const normalizedStatus = (status || "").toLowerCase();

  const isComplete =
    normalizedStatus.includes("complete") ||
    normalizedStatus.includes("already exists") ||
    (total > 0 && current >= total);
  const isExtracting = status === "Extracting";
  const isDownloading = status === "Downloading";

  const barColor = isComplete
    ? "bg-blue-500"
    : isExtracting
      ? "bg-yellow-500"
      : "bg-blue-500";

  const textColor = isComplete
    ? "text-blue-400"
    : isExtracting
      ? "text-yellow-400"
      : "text-blue-400";

  return (
    <div className="flex items-center gap-2 text-[11px] font-mono">
      <span className="w-18 text-gray-500 shrink-0 truncate">{id}</span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-300`}
          style={{ width: `${isComplete ? 100 : pct}%` }}
        />
      </div>
      <span className={`w-24 text-right shrink-0 ${textColor}`}>
        {isComplete
          ? "Done"
          : isDownloading || isExtracting
            ? progress || `${pct}%`
            : status}
      </span>
    </div>
  );
};

// ── Search Result Card ───────────────────────────────────────────────────────
const SearchResult = ({ result, onSelect, selected }) => (
  <button
    onClick={() => onSelect(result.name)}
    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
      selected
        ? "bg-purple-900/30 border-purple-700"
        : "bg-gray-800/50 border-gray-700/50 hover:border-gray-600 hover:bg-gray-800"
    }`}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <Layers size={12} className="text-purple-400 shrink-0" />
        <span className="text-xs text-gray-200 font-medium truncate">
          {result.name}
        </span>
        {result.official && (
          <BadgeCheck
            size={12}
            className="text-blue-400 shrink-0"
            title="Official"
          />
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Star size={10} className="text-yellow-500" />
        <span className="text-[10px] text-gray-500">
          {result.stars?.toLocaleString()}
        </span>
      </div>
    </div>
    {result.description && (
      <p className="text-[10px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
        {result.description}
      </p>
    )}
  </button>
);

// ── Main Modal ───────────────────────────────────────────────────────────────
const PullImageModal = ({ onClose }) => {
  const [imageName, setImageName] = useState("");
  const [tag, setTag] = useState("latest");
  const [isPulling, setIsPulling] = useState(false);
  const [pullDone, setPullDone] = useState(false);
  const [pullError, setPullError] = useState(null);
  const [layers, setLayers] = useState({});
  const [statusMessages, setStatusMessages] = useState([]);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef(null);

  // Debounced Docker Hub search
  const doSearch = useCallback(async (term) => {
    if (!term || term.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await apiService.searchImages(term);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => doSearch(searchTerm), 400);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchTerm, doSearch]);

  // Socket listeners for pull progress
  useEffect(() => {
    const handleProgress = ({ id, status, progress, progressDetail }) => {
      if (id) {
        setLayers((prev) => ({
          ...prev,
          [id]: { status, progress, progressDetail },
        }));
      } else {
        setStatusMessages((prev) => [...prev.slice(-20), status]);
      }
    };

    const handleComplete = ({ imageName: name }) => {
      setIsPulling(false);
      setPullDone(true);
      toast.success(`${name} pulled successfully!`);
    };

    const handleError = ({ error }) => {
      setIsPulling(false);
      setPullError(error);
      toast.error(error || "Pull failed");
    };

    socket.on("image-pull-progress", handleProgress);
    socket.on("image-pull-complete", handleComplete);
    socket.on("image-pull-error", handleError);

    return () => {
      socket.off("image-pull-progress", handleProgress);
      socket.off("image-pull-complete", handleComplete);
      socket.off("image-pull-error", handleError);
    };
  }, []);

  const handlePull = () => {
    const fullName = `${imageName.trim()}${tag ? `:${tag}` : ""}`;
    if (!imageName.trim()) {
      toast.error("Image name is required");
      return;
    }
    setIsPulling(true);
    setPullDone(false);
    setPullError(null);
    setLayers({});
    setStatusMessages([]);
    socket.emit("image-pull", { imageName: fullName });
  };

  const handleRetry = () => {
    setPullError(null);
    handlePull();
  };

  const handleSelectResult = (name) => {
    setImageName(name);
    setSearchTerm("");
    setSearchResults([]);
  };

  const handleModalClose = () => {
    if (isPulling) return;
    onClose();
  };

  const layerEntries = Object.entries(layers);

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center"
      onClick={handleModalClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-130 max-h-[85vh] overflow-hidden animate-slide-in flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-gray-800 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <Download size={16} className="text-purple-400" />
            <h3 className="text-sm font-bold text-white">Pull Image</h3>
          </div>
          <button
            onClick={handleModalClose}
            disabled={isPulling}
            className="p-1 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 sidebar-scroll">
          {/* Search Docker Hub */}
          {!isPulling && !pullDone && (
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                Search Docker Hub
              </label>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search images (e.g. nginx, mongo)..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                />
                {isSearching && (
                  <Loader2
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 animate-spin"
                  />
                )}
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto sidebar-scroll">
                  {searchResults.map((r) => (
                    <SearchResult
                      key={r.name}
                      result={r}
                      selected={imageName === r.name}
                      onSelect={handleSelectResult}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Image Name + Tag */}
          {!isPulling && !pullDone && (
            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                  Image Name
                </label>
                <input
                  type="text"
                  value={imageName}
                  onChange={(e) => setImageName(e.target.value)}
                  placeholder="e.g. nginx, ubuntu, mongo"
                  autoFocus
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
              <div className="w-28 space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                  Tag
                </label>
                <input
                  type="text"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="latest"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>
          )}

          {/* Pull Progress */}
          {isPulling && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="text-purple-400 animate-spin" />
                <span className="text-xs text-gray-300 font-medium">
                  Pulling {imageName}:{tag || "latest"}...
                </span>
              </div>

              {/* Layer progress */}
              {layerEntries.length > 0 && (
                <div className="space-y-1.5 bg-gray-800/50 rounded-lg p-3 border border-gray-700/50 max-h-60 overflow-y-auto sidebar-scroll">
                  {layerEntries.map(([id, data]) => (
                    <LayerProgress
                      key={id}
                      id={id}
                      status={data.status}
                      progress={data.progress}
                      progressDetail={data.progressDetail}
                    />
                  ))}
                </div>
              )}

              {/* Status messages (non-layer) */}
              {statusMessages.length > 0 && (
                <div className="text-[10px] text-gray-500 font-mono bg-gray-800/30 rounded p-2 max-h-20 overflow-y-auto sidebar-scroll">
                  {statusMessages.map((msg, i) => (
                    <div key={i}>{msg}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pull Complete */}
          {pullDone && (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 size={40} className="text-green-500" />
              <p className="text-sm text-gray-200 font-medium">
                {imageName}:{tag || "latest"} pulled successfully!
              </p>
              <p className="text-xs text-gray-500">
                The image node will appear on the canvas automatically.
              </p>
            </div>
          )}

          {/* Pull Error */}
          {pullError && !isPulling && (
            <div className="space-y-3 py-4">
              <div className="flex items-start gap-3 bg-red-900/20 border border-red-800/50 rounded-lg p-3">
                <AlertCircle
                  size={16}
                  className="text-red-400 shrink-0 mt-0.5"
                />
                <div>
                  <p className="text-xs text-red-400 font-medium">
                    Pull Failed
                  </p>
                  <p className="text-[11px] text-red-500/70 mt-1">
                    {pullError}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-gray-800/30 border-t border-gray-700 flex items-center gap-3 shrink-0">
          {pullDone ? (
            <>
              <button
                onClick={() => {
                  setPullDone(false);
                  setImageName("");
                  setTag("latest");
                  setLayers({});
                  setStatusMessages([]);
                }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
              >
                Pull Another
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg border border-purple-500 transition-colors"
              >
                Done
              </button>
            </>
          ) : pullError && !isPulling ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRetry}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-500 rounded-lg border border-purple-500 transition-colors"
              >
                <RotateCcw size={14} />
                Retry
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={isPulling}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePull}
                disabled={isPulling || !imageName.trim()}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                  isPulling || !imageName.trim()
                    ? "bg-gray-700 text-gray-400 border-gray-600 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-500 text-white border-purple-500"
                }`}
              >
                {isPulling ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                {isPulling ? "Pulling..." : "Pull Image"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PullImageModal;
