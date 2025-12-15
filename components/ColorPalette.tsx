import React from 'react';

interface Props {
  colors: string[];
  onChange: (colors: string[]) => void;
  useRandomColor: boolean;
  onToggleRandom: (val: boolean) => void;
}

const ColorPalette: React.FC<Props> = ({ colors, onChange, useRandomColor, onToggleRandom }) => {
  const addColor = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    if (!colors.includes(newColor)) {
      onChange([...colors, newColor]);
    }
  };

  const removeColor = (colorToRemove: string) => {
    onChange(colors.filter(c => c !== colorToRemove));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700">调色板</label>
        <div className="flex items-center gap-2">
           <input 
            type="checkbox" 
            checked={useRandomColor} 
            onChange={(e) => onToggleRandom(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
           />
           <span className="text-xs text-slate-500">应用颜色</span>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {colors.map(color => (
          <div 
            key={color} 
            className="w-8 h-8 rounded-full border border-slate-200 cursor-pointer relative group shadow-sm"
            style={{ backgroundColor: color }}
            onClick={() => removeColor(color)}
            title="点击移除"
          >
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 rounded-full transition-opacity">
               <span className="text-white text-xs font-bold">×</span>
            </div>
          </div>
        ))}
        <label className="w-8 h-8 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-blue-500 hover:text-blue-500 text-slate-400 transition-colors">
          <span className="text-lg leading-none">+</span>
          <input type="color" className="opacity-0 absolute w-0 h-0" onChange={addColor} />
        </label>
      </div>
    </div>
  );
};

export default ColorPalette;