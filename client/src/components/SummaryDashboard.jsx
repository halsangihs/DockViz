import React, { useState } from "react";
import {
  Box,
  Layers,
  Network,
  ChevronDown,
  ChevronRight,
  Monitor,
  Search
} from "lucide-react";

const CategorySection = ({ title, icon: Icon, color, items, renderItem, onClickItem, isOpenDefault = false }) => {
  const [isOpen, setIsOpen] = useState(isOpenDefault);

  return (
    <div className={`mb-4 rounded-lg overflow-hidden border transition-all duration-200 ${isOpen ? 'bg-gray-900/80 border-gray-700 shadow-md' : 'bg-gray-900/40 border-gray-800 border-dashed hover:border-gray-700'}`}>
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-800/80 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-md bg-gray-800/80 ${isOpen ? 'shadow-inner' : ''}`}>
            <Icon size={16} className={color} />
          </div>
          <span className="text-sm font-semibold text-gray-200 tracking-wide">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium bg-gray-800 px-2 py-0.5 rounded-full text-gray-400 border border-gray-700/50">
            {items.length}
          </span>
          <div className="text-gray-500 bg-gray-800/50 p-1 rounded-full transition-transform">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        </div>
      </div>
      
      <div className={`transition-all overflow-hidden ${isOpen ? 'max-h-64 border-t border-gray-800/50 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="p-2 overflow-y-auto space-y-1.5 bg-black/40 min-h-[40px] max-h-64 custom-scrollbar">
          {items.length === 0 ? (
            <div className="text-xs text-gray-500 italic px-3 py-3 text-center bg-gray-900/20 rounded border border-gray-800/50 border-dashed">
              No active {title.toLowerCase()} found
            </div>
          ) : (
            items.map((item, idx) => (
              <div 
                key={item.id || idx} 
                className="text-xs flex items-center px-3 py-2.5 bg-gray-900/30 hover:bg-gray-800 border border-transparent hover:border-gray-700/60 rounded-md text-gray-300 cursor-pointer transition-all duration-200 group relative overflow-hidden"
                onClick={(e) => {
                  e.stopPropagation();
                  onClickItem && onClickItem(item.id);
                }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500/0 group-hover:bg-blue-500/50 transition-colors"></div>
                <div className="w-full truncate pl-1">
                  {renderItem(item)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const SummaryDashboard = ({ nodes, searchQuery, setSearchQuery, onSelectNode }) => {
  // Pass the full node id back when clicked (item is the full node data but we need the node ID)
  // Re-map nodes to include node id in item
  const images = nodes.filter(n => n.type === "image").map(n => ({...n.data, id: n.id}));
  const containers = nodes.filter(n => n.type === "container").map(n => ({...n.data, id: n.id}));
  const networks = nodes.filter(n => n.type === "network").map(n => ({...n.data, id: n.id}));

  const runningContainers = containers.filter(c => c.state === "running").length;

  const applySearch = (items) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item => {
      const target = `${item.name || ""} ${item.fullId || ""} ${item.driver || ""} ${item.tags?.join(" ") || ""}`.toLowerCase();
      return target.includes(q);
    });
  };

  const displayImages = applySearch(images);
  const displayContainers = applySearch(containers);
  const displayNetworks = applySearch(networks);

  return (
    <div className="w-full h-full flex flex-col pointer-events-auto bg-[#09090b]">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex flex-col gap-4 bg-[#09090b]">
        <div className="flex items-center gap-2">
          <Monitor size={16} className="text-blue-400" />
          <h3 className="text-sm font-bold text-white tracking-tight">Docker Summary</h3>
        </div>
        
        <div className="relative flex items-center">
            <Search size={14} className="absolute left-2.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search images, containers, networks..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (e.target.value.length > 0) {
                  onSelectNode(null); // Clear any selected node when searching
                }
              }}
              className="pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 text-gray-500 hover:text-gray-300 text-xs font-bold"
              >
                ×
              </button>
            )}
        </div>
      </div>
      
      {/* Quick Stats */}
      <div className="p-3 border-b border-gray-800 grid grid-cols-3 gap-2 bg-[#09090b]">
        <div className="flex flex-col items-center justify-center p-2 bg-gray-900 border border-gray-800 rounded-lg shadow-sm">
          <Layers size={16} className="text-purple-400 mb-1" />
          <span className="text-base font-bold text-gray-200">{searchQuery ? `${displayImages.length}/` : ''}{images.length}</span>
        </div>
        <div className="flex flex-col items-center justify-center p-2 bg-gray-900 border border-gray-800 rounded-lg shadow-sm relative">
          <Box size={16} className="text-blue-400 mb-1" />
          <span className="text-base font-bold text-gray-200">{searchQuery ? `${displayContainers.length}/` : ''}{containers.length}</span>
          <span className="absolute bottom-1 right-2 text-[9px] font-bold text-green-400 bg-green-900/20 px-1 rounded">{runningContainers} ON</span>
        </div>
        <div className="flex flex-col items-center justify-center p-2 bg-gray-900 border border-gray-800 rounded-lg shadow-sm">
          <Network size={16} className="text-orange-400 mb-1" />
          <span className="text-base font-bold text-gray-200">{searchQuery ? `${displayNetworks.length}/` : ''}{networks.length}</span>
        </div>
      </div>

      {/* Accordion Lists */}
      <div className="p-3 overflow-y-auto flex-1 hide-scrollbar">
        <CategorySection 
          title="Containers" 
          icon={Box} 
          color="text-blue-400" 
          items={displayContainers} 
          isOpenDefault={true}
          onClickItem={onSelectNode}
          renderItem={(c) => (
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.state === "running" ? "bg-green-500" : c.state === "paused" ? "bg-yellow-500" : "bg-red-500"}`} />
              <span className="truncate">{c.name}</span>
            </div>
          )}
        />

        <CategorySection 
          title="Images" 
          icon={Layers} 
          color="text-purple-400" 
          items={displayImages} 
          isOpenDefault={true}
          onClickItem={onSelectNode}
          renderItem={(img) => (
            <span className="truncate">{img.name || img.tags?.[0] || img.fullId?.substring(0, 12)}</span>
          )}
        />

        <CategorySection 
          title="Networks" 
          icon={Network} 
          color="text-orange-400" 
          items={displayNetworks} 
          onClickItem={onSelectNode}
          renderItem={(net) => (
            <div className="flex justify-between items-center w-full">
              <span className="truncate">{net.name}</span>
              <span className="text-[9px] bg-gray-900 px-1 rounded text-gray-500 uppercase">{net.driver}</span>
            </div>
          )}
        />
      </div>
    </div>
  );
};

export default SummaryDashboard;
