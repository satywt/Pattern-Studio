import React, { useRef } from 'react';
import { ProcessedAsset } from '../types';

interface Props {
  assets: ProcessedAsset[];
  onUpload: (files: FileList) => void;
  onRemove: (id: string) => void;
}

const AssetUploader: React.FC<Props> = ({ assets, onUpload, onRemove }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-slate-50 transition-colors group"
      >
        <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-2 group-hover:bg-blue-100 group-hover:text-blue-500 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        </div>
        <span className="text-sm font-semibold text-slate-600">上传图形元素</span>
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