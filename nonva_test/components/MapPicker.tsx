
import React, { useEffect, useRef, useState } from 'react';
import { DEFAULT_MAP_CENTER } from '../constants';
import { MapPin, Check, Loader2 } from 'lucide-react';

// Declare Leaflet types locally since we are using CDN
declare const L: any;

interface Props {
  onConfirm: (address: string) => void;
  onCancel: () => void;
}

const MapPicker: React.FC<Props> = ({ onConfirm, onCancel }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const centerMarker = useRef<any>(null);
  
  const [currentCenter, setCurrentCenter] = useState<[number, number]>(DEFAULT_MAP_CENTER);
  const [address, setAddress] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize Map
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapContainer.current).setView(DEFAULT_MAP_CENTER, 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(mapInstance.current);

      // Custom Icon for center
      const icon = L.divIcon({
        className: 'bg-transparent',
        html: `<div class="w-8 h-8 bg-orange-600 rounded-full border-4 border-white shadow-lg flex items-center justify-center -mt-4 -ml-4 relative">
                 <div class="w-1 h-1 bg-white rounded-full"></div>
                 <div class="absolute -bottom-1 w-2 h-2 bg-orange-600 rotate-45"></div>
               </div>`
      });

      centerMarker.current = L.marker(DEFAULT_MAP_CENTER, { icon, zIndexOffset: 1000 }).addTo(mapInstance.current);

      // Events
      mapInstance.current.on('move', () => {
        const center = mapInstance.current.getCenter();
        centerMarker.current.setLatLng(center);
      });

      mapInstance.current.on('moveend', () => {
        const center = mapInstance.current.getCenter();
        setCurrentCenter([center.lat, center.lng]);
        fetchAddress(center.lat, center.lng);
      });

      // Initial fetch
      fetchAddress(DEFAULT_MAP_CENTER[0], DEFAULT_MAP_CENTER[1]);
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  const fetchAddress = async (lat: number, lng: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fa`);
      const data = await response.json();
      if (data && data.display_name) {
        // Clean up address: take first 3 parts usually
        const parts = data.display_name.split(',');
        const shortAddress = parts.slice(0, 4).join('، ');
        setAddress(shortAddress);
      } else {
        setAddress('آدرس نامشخص');
      }
    } catch (error) {
      setAddress('خطا در دریافت آدرس');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[80vh]">
        <div className="p-4 bg-white border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">انتخاب موقعیت روی نقشه</h3>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-800">بستن</button>
        </div>
        
        <div className="relative flex-1 bg-gray-100">
          <div ref={mapContainer} className="absolute inset-0 z-0" />
          
          {/* Center Indicator (Visual only, marker handles actual logic) */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
            {/* Marker is rendered via Leaflet, this div is just for layout reference if needed */}
          </div>
        </div>

        <div className="p-4 bg-white border-t border-gray-100">
          <div className="mb-4">
             <div className="text-xs text-gray-500 mb-1">آدرس تقریبی:</div>
             <div className="flex items-start gap-2">
               <MapPin className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
               {isLoading ? (
                 <span className="text-sm text-gray-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> در حال یافتن آدرس...</span>
               ) : (
                 <p className="text-sm font-medium text-gray-800 leading-snug">{address}</p>
               )}
             </div>
          </div>
          <button
            onClick={() => onConfirm(address)}
            disabled={isLoading}
            className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-200 hover:bg-orange-700 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            تایید این موقعیت
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapPicker;