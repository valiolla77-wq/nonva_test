
import React from 'react';
import { X, Lock } from 'lucide-react';

interface Props {
  status: 'available' | 'full' | 'closed';
  isSelected: boolean;
  quantity: number;
  maxAllowed: number;
  onSelect: () => void;
  onChangeQuantity: (newQty: number) => void;
}

const TimeSlotCell: React.FC<Props> = ({ status, isSelected, quantity, maxAllowed, onSelect, onChangeQuantity }) => {
  if (status === 'closed') {
    return (
      <div className="h-14 md:h-16 bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 cursor-not-allowed rounded-lg relative group opacity-70">
        <Lock className="w-4 h-4" />
        <span className="absolute bottom-1 text-[8px] md:text-[10px] opacity-0 group-hover:opacity-100 transition-opacity font-bold">بسته</span>
      </div>
    );
  }

  if (status === 'full') {
    return (
      <div className="h-14 md:h-16 bg-red-50 border border-red-200 flex items-center justify-center text-red-400 cursor-not-allowed rounded-lg relative group">
        <X className="w-4 h-4" />
        <span className="absolute bottom-1 text-[8px] md:text-[10px] text-red-500 font-bold">تکمیل</span>
      </div>
    );
  }

  return (
    <div
      className={`h-14 md:h-16 border flex flex-col items-center justify-center cursor-pointer transition-all duration-200 relative rounded-lg shadow-sm min-w-[60px]
        ${isSelected 
          ? 'bg-green-600 border-green-600 ring-2 ring-green-400 ring-inset z-10' 
          : 'bg-white border-gray-200 hover:border-green-500 hover:bg-green-50 text-gray-700 hover:text-green-700'}
      `}
      onClick={() => {
        if (!isSelected) onSelect();
      }}
    >
      {isSelected ? (
        <div className="flex items-center gap-1 md:gap-2 animate-in fade-in zoom-in duration-200 text-white">
          <button
             type="button"
             className="w-5 h-5 md:w-6 md:h-6 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-sm"
             onClick={(e) => {
               e.stopPropagation();
               if (quantity > 1) onChangeQuantity(quantity - 1);
               else onChangeQuantity(0);
             }}
          >
            -
          </button>
          <span className="font-bold text-sm md:text-lg w-3 md:w-4 text-center">{quantity}</span>
          <button
             type="button"
             disabled={quantity >= maxAllowed}
             className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center transition-colors text-sm
               ${quantity >= maxAllowed ? 'bg-white/10 cursor-not-allowed opacity-50' : 'bg-white/20 hover:bg-white/40'}
             `}
             onClick={(e) => {
               e.stopPropagation();
               if (quantity < maxAllowed) onChangeQuantity(quantity + 1);
             }}
          >
            +
          </button>
        </div>
      ) : (
        <>
          <span className="text-xs md:text-sm font-bold">انتخاب</span>
          <span className="text-[9px] md:text-[10px] text-gray-400 leading-none mt-1">{maxAllowed} موجود</span>
        </>
      )}
    </div>
  );
};

export default TimeSlotCell;
