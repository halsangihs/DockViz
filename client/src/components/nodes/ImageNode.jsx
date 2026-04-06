import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Layers, Database, Box, Trash2 } from 'lucide-react';

const ImageNode = ({ data }) => {
  const isDangling = data.name === '<none>';

  const containerStyle = isDangling 
    ? 'border-gray-300 border-dashed opacity-80 bg-gray-50' 
    : 'border-purple-500 bg-white shadow-md hover:shadow-xl';

  const headerStyle = isDangling 
    ? 'bg-gray-200 text-gray-500' 
    : 'bg-purple-50 text-purple-700';

  const handleStyle = isDangling ? 'bg-gray-400' : 'bg-purple-500';

  const safeReferences = data.references || data.tags || [];
  const displayTags = safeReferences.slice(0, 3);
  const remainingTags = safeReferences.length - 3;

  return (
    <div className={`rounded-lg border-l-4 w-60 transition-all duration-200 group ${containerStyle}`}>
      
      <div className={`flex items-center justify-between px-3 py-2 rounded-tr-lg ${headerStyle}`}>
        <div className="flex items-center gap-2 overflow-hidden">
          <Layers className="w-4 h-4 shrink-0" />
          <span className="font-bold text-sm truncate" title={data.name}>
            {data.name}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {data.containersCount > 0 && (
              <div className="flex items-center gap-1 text-[10px] bg-white/60 px-1.5 py-0.5 rounded-full border border-black/5" title="Active Containers">
                  <Box className="w-3 h-3"/>
                  <span className="font-semibold">{data.containersCount}</span>
              </div>
          )}

          {/* Delete button */}
          <button
            className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
            title="Delete image"
            onClick={(e) => {
              e.stopPropagation();
              data.onDelete?.(data);
            }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        
        <div className="flex flex-wrap gap-1">
          {safeReferences.length > 0 ? (
            <>
              {displayTags.map((tag, i) => (
                <span key={i} className="text-[10px] font-mono bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 truncate max-w-40">
                  {tag}
                </span>
              ))}
              {remainingTags > 0 && (
                <span className="text-[10px] text-gray-400 self-center pl-1">
                  +{remainingTags} more
                </span>
              )}
            </>
          ) : (
             <span className="text-[10px] text-gray-400 italic">no tags</span>
          )}
        </div>

        <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono border-t border-gray-100 pt-2">
            <span title={`Full ID: ${data.fullImageId}`}>
                ID: {data.id?.substring(0, 12) || 'N/A'}
            </span>
            <div className="flex items-center gap-1">
               <Database className="w-3 h-3" />
               <span>{data.size}</span>
            </div>
        </div>
      </div>

      <Handle 
        type="source" 
        position={Position.Bottom} 
        isConnectable={false}
        className={`w-3 h-3 bg-gray-400 opacity-50 cursor-not-allowed pointer-events-none`} 
      />
    </div>
  );
};

export default memo(ImageNode);