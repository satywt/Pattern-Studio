import React, { useRef, useState } from 'react';
import { ProcessedAsset } from '../types';

interface Props {
  assets: ProcessedAsset[];
  onUpload: (files: FileList) => void;
  onRemove: (id: string) => void;
}

const AssetUploader: React.FC<Props> = ({ assets, onUpload, onRemove }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(e.target.files);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <div 
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
            border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors group
            ${isDragging 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50'
            }
        `}
      >
        <div className={`
            w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-colors
            ${isDragging ? 'bg-blue-100 text-blue-500' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500'}
        `}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </div>
        <span className={`text-sm font-semibold ${isDragging ? 'text-blue-600' : 'text-slate-600'}`}>
            {isDragging ? '释放以上传' : '上传图形元素'}
        </span>
        <span className="text-xs text-slate-400 mt-1">支持 SVG (推荐), PNG, JPG</span>
      </div>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/svg+xml, image/png, image/jpeg" 
        multiple 
        onChange={handleFileChange}
      />
      
      {assets.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {assets.map(asset => (
            <div key={asset.id} className="relative aspect-square bg-slate-100 rounded-lg p-2 border border-slate-200 group">
              <img src={asset.img.src} alt="asset" className="w-full h-full object-contain" />
              <button 
                onClick={(e) => { e.stopPropagation(); onRemove(asset.id); }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AssetUploader;