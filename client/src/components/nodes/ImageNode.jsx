import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Layers, Database, Box, Trash2 } from 'lucide-react';

const ImageNode = ({ data }) => {
  const isDangling = data.name === '<none>';

  const containerStyle = isDangling 
    ? 'border-gray-500 border-dashed opacity-80 bg-gray-900/60' 
    : 'border-purple-500/50 bg-gray-900/80 shadow-[0_0_15px_rgba(168,85,247,0.15)] hover:shadow-[0_0_25px_rgba(168,85,247,0.25)] hover:border-purple-400/80';

  const headerStyle = isDangling 
    ? 'bg-gradient-to-r from-gray-800 to-gray-900 text-gray-400 border-b border-gray-700/50' 
    : 'bg-gradient-to-r from-purple-900/40 to-gray-900 text-purple-300 border-b border-purple-900/50';

  const handleStyle = isDangling 
    ? 'bg-gray-500 border-gray-700' 
    : 'bg-purple-400 border-purple-900 shadow-[0_0_8px_rgba(192,132,252,0.8)]';

  const safeReferences = data.references || data.tags || [];
  const displayTags = safeReferences.slice(0, 3);
  const remainingTags = safeReferences.length - 3;

  return (
    <div className={`rounded-xl border border-l-4 w-60 transition-all duration-300 group backdrop-blur-xl flex flex-col text-gray-200 ${containerStyle}`}>
      
      <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl ${headerStyle}`}>
        <div className="flex items-center gap-2 overflow-hidden">
          <Layers className={`w-4 h-4 shrink-0 ${isDangling ? 'text-gray-500' : 'text-purple-400 drop-shadow-[0_0_5px_rgba(192,132,252,0.5)]'}`} />
          <span className="font-bold text-sm truncate text-gray-100 drop-shadow-md" title={data.name}>
            {data.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 border-l border-white/5 pl-2 ml-1">
          {data.containersCount > 0 && (
              <div className="flex items-center gap-1 text-[10px] bg-purple-900/50 text-purple-200 px-1.5 py-0.5 rounded-md border border-purple-500/30" title="Active Containers">
                  <Box className="w-3 h-3 opacity-80"/>
                  <span className="font-bold">{data.containersCount}</span>
              </div>
          )}

          {/* Delete button */}
          <button
            className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-red-500/20"
            title="Delete image"
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.(data);
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="p-3.5 space-y-3 bg-gray-900/40 rounded-b-xl">
        
        <div className="flex flex-wrap gap-1.5">
          {safeReferences.length > 0 ? (
            <>
              {displayTags.map((tag, i) => (
                <span key={i} className="text-[10px] font-mono bg-purple-900/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/30 truncate max-w-40 shadow-[0_0_10px_rgba(168,85,247,0.05)]">
                  {tag}
                </span>
              ))}
              {remainingTags > 0 && (
                <span className="text-[10px] text-gray-500 self-center pl-1 font-medium">
                  +{remainingTags} more
                </span>
              )}
            </>
          ) : (
             <span className="text-[10px] text-gray-500 italic bg-black/20 px-2 py-0.5 rounded border border-white/5">no tags</span>
          )}
        </div>

        <div className="flex justify-between items-center text-[10px] text-gray-500 font-mono border-t border-gray-700/50 pt-3">
            <span className="bg-black/30 px-1.5 py-0.5 rounded border border-white/5 shadow-inner" title={`Full ID: ${data.fullImageId}`}>
                {data.id?.substring(0, 12) || 'N/A'}
            </span>
            <div className="flex items-center gap-1.5 bg-gray-800/80 px-1.5 py-0.5 rounded border border-gray-700">
               <Database className="w-3 h-3 text-gray-400" />
               <span className="text-gray-300">{data.size}</span>
            </div>
        </div>
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        isConnectable={false}
        className={`w-3 h-3 border-2 opacity-0 group-hover:opacity-100 transition-opacity ${handleStyle}`} 
      />
    </div>
  );
};

export default memo(ImageNode);
