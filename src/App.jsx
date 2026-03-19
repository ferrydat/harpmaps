import React, { useState, useRef, useMemo, useCallback } from 'react';
import { toCanvas } from 'html-to-image';
import { Download, Crosshair, Map as MapIcon, Info, Search, Loader2, Layers, Globe } from 'lucide-react';
import { zonas } from './data/zones';
import { translations } from './data/i18n';
import { calculateScale } from './utils/geo';
import { applyFiltersToCanvas } from './utils/filters';
import MapEditor from './components/MapEditor';

// Map visualization styles (keys for i18n)
const mapStyles = [
  { id: 'aegis', nameKey: 'style_aegis', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', filter: 'invert(100%) hue-rotate(180deg) brightness(95%) contrast(110%)', bg: '#001122' },
  { id: 'satelite', nameKey: 'style_satelite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', filter: 'none', bg: '#000000' },
  { id: 'ocean', nameKey: 'style_ocean', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', filter: 'none', bg: '#c6dfec' },
  { id: 'topo', nameKey: 'style_topo', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', filter: 'none', bg: '#f0f0f0' },
  { id: 'esri_dark', nameKey: 'style_esri_dark', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', filter: 'none', bg: '#333333' },
  { id: 'light', nameKey: 'style_light', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', filter: 'none', bg: '#f0f0f0' },
  { id: 'night', nameKey: 'style_night', url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', filter: 'invert(100%) hue-rotate(80deg) brightness(70%) contrast(120%) saturate(200%)', bg: '#001100' },
];

function App() {
  const [lang, setLang] = useState('es');
  const [selectedZone, setSelectedZone] = useState(zonas[0]);
  const [activeStyle, setActiveStyle] = useState(mapStyles[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const mapContainerRef = useRef(null);

  const t = useCallback((key) => translations[lang]?.[key] || key, [lang]);

  // Calculate live scale preview
  const liveScale = useMemo(() => {
    const boundsStr = selectedZone.bounds;
    const boundsObj = {
      getNorth: () => Math.max(boundsStr[0][0], boundsStr[1][0]),
      getSouth: () => Math.min(boundsStr[0][0], boundsStr[1][0]),
      getEast: () => Math.max(boundsStr[0][1], boundsStr[1][1]),
      getWest: () => Math.min(boundsStr[0][1], boundsStr[1][1]),
    };
    // Estimate with a typical map width of ~920px (viewport minus sidebar)
    return calculateScale(boundsObj, 920);
  }, [selectedZone]);

  const getZoneName = (zone) => zone.nombre || t(zone.nameKey);
  const getZoneDesc = (zone) => zone.desc || t(zone.descKey);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const place = data[0];
        const bb = place.boundingbox;
        setSelectedZone({
          id: `custom_${Date.now()}`,
          nombre: place.display_name.split(',')[0],
          desc: place.display_name,
          bounds: [[parseFloat(bb[1]), parseFloat(bb[2])], [parseFloat(bb[0]), parseFloat(bb[3])]]
        });
        setSearchQuery('');
      } else {
        alert(t('noResults'));
      }
    } catch {
      alert(t('connectionError'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerate = async () => {
    if (!mapContainerRef.current) return;
    setIsGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const tilePane = mapContainerRef.current.querySelector('.leaflet-tile-pane');
      const savedFilter = tilePane ? tilePane.style.filter : '';
      if (tilePane) tilePane.style.filter = '';

      const rawCanvas = await toCanvas(mapContainerRef.current, {
        cacheBust: true,
        backgroundColor: activeStyle.bg,
        pixelRatio: 1,
        filter: (node) => {
          if (node.classList && node.classList.contains('leaflet-control-container')) return false;
          return true;
        },
      });

      if (tilePane) tilePane.style.filter = savedFilter;

      // Limitar tamaño máximo para compatibilidad con Simplot2
      const MAX_DIM = 1600;
      let w = rawCanvas.width;
      let h = rawCanvas.height;
      if (w > MAX_DIM || h > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = w;
      finalCanvas.height = h;
      const ctx = finalCanvas.getContext('2d');

      // Fondo opaco sólido (Simplot2 no soporta transparencia/alpha)
      ctx.fillStyle = activeStyle.bg || '#000000';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(rawCanvas, 0, 0, w, h);

      // Aplicar filtros de color a los píxeles
      applyFiltersToCanvas(finalCanvas, activeStyle.filter);

      // Forzar imagen completamente opaca (eliminar canal alfa)
      const imgDataObj = ctx.getImageData(0, 0, w, h);
      const px = imgDataObj.data;
      for (let i = 3; i < px.length; i += 4) px[i] = 255;
      ctx.putImageData(imgDataObj, 0, 0);

      const imgData = finalCanvas.toDataURL('image/png');

      const boundsStr = selectedZone.bounds;
      const boundsObj = {
        getNorth: () => Math.max(boundsStr[0][0], boundsStr[1][0]),
        getSouth: () => Math.min(boundsStr[0][0], boundsStr[1][0]),
        getEast: () => Math.max(boundsStr[0][1], boundsStr[1][1]),
        getWest: () => Math.min(boundsStr[0][1], boundsStr[1][1]),
      };
      const scale = calculateScale(boundsObj, finalCanvas.width);

      let safeName = getZoneName(selectedZone).replace(/[^a-z0-9]/gi, '_').toLowerCase();
      if (!safeName) safeName = 'custom_map';
      safeName += `_${activeStyle.id}`;

      const txtData = `MAP=${safeName}.png\nSCALE=${scale.toFixed(4)}\n`;
      downloadFile(imgData, `${safeName}.png`);
      downloadFile(`data:text/plain;charset=utf-8,${encodeURIComponent(txtData)}`, `${safeName}.txt`);
    } catch (err) {
      console.error('Error generating map:', err);
      alert(t('exportError'));
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadFile = (href, filename) => {
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isDarkStyle = ['aegis', 'night', 'esri_dark', 'satelite'].includes(activeStyle.id);

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col shadow-xl z-20 shrink-0">
        {/* Header */}
        <div className="p-5 border-b border-gray-700 bg-gray-800/50">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold flex items-center gap-2.5 text-blue-400">
              <Crosshair className="text-blue-500 w-5 h-5" /> {t('title')}
            </h1>
            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-medium transition-colors border border-gray-600"
              title={t('langLabel')}
            >
              <Globe className="w-3.5 h-3.5" />
              {lang === 'es' ? 'EN' : 'ES'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">{t('subtitle')}</p>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-700 bg-gray-800/20">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                disabled={isSearching}
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </form>
        </div>

        {/* Layer Selector */}
        <div className="p-3 border-b border-gray-700 bg-gray-800/20">
          <div className="flex items-center gap-2 mb-1.5">
            <Layers className="w-3.5 h-3.5 text-gray-400" />
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t('layerLabel')}</h2>
          </div>
          <select
            className="w-full bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg py-2 pl-3 pr-8 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
            value={activeStyle.id}
            onChange={(e) => setActiveStyle(mapStyles.find(s => s.id === e.target.value))}
          >
            {mapStyles.map((style) => (
              <option key={style.id} value={style.id}>{t(style.nameKey)}</option>
            ))}
          </select>
        </div>

        {/* Zones List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-3 px-1">{t('zonesTitle')}</h2>

          {/* Custom search result */}
          {!zonas.find(z => z.id === selectedZone.id) && (
            <div className="p-3 rounded-xl border bg-blue-600/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)] mb-2">
              <div className="flex items-start gap-2.5">
                <MapIcon className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-medium text-blue-300 text-sm">
                    {getZoneName(selectedZone)} <span className="text-xs text-blue-400/60">({t('searchBadge')})</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1 leading-relaxed truncate" title={getZoneDesc(selectedZone)}>{getZoneDesc(selectedZone)}</p>
                </div>
              </div>
            </div>
          )}

          {zonas.map((zona) => (
            <button
              key={zona.id}
              onClick={() => setSelectedZone(zona)}
              className={`w-full text-left p-3 rounded-xl transition-all duration-200 border ${
                selectedZone.id === zona.id
                ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                : 'bg-gray-800 border-gray-700 hover:bg-gray-700/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <MapIcon className={`w-4 h-4 mt-0.5 shrink-0 ${selectedZone.id === zona.id ? 'text-blue-400' : 'text-gray-500'}`} />
                <div className="min-w-0">
                  <h3 className={`font-medium text-sm ${selectedZone.id === zona.id ? 'text-blue-300' : 'text-gray-200'}`}>
                    {t(zona.nameKey)}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{t(zona.descKey)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Export Button */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all duration-300 ${
              isGenerating
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-500/25 active:scale-[0.98]'
            }`}
          >
            <Download className={`w-5 h-5 ${isGenerating ? 'animate-pulse' : ''}`} />
            {isGenerating ? t('generating') : t('exportBtn')}
          </button>
          <div className="mt-3 flex items-start gap-2 text-[11px] text-gray-500">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p>{t('exportNote')}</p>
          </div>
        </div>
      </div>

      {/* Map Preview Area */}
      <div className="flex-1 relative z-10" style={{ backgroundColor: activeStyle.bg }}>
        <MapEditor bounds={selectedZone.bounds} mapRef={mapContainerRef} activeStyle={activeStyle} />

        {/* Radar ring overlay for Aegis/Night styles */}
        <div className={`absolute inset-0 pointer-events-none border-[1px] z-[400] ${
          isDarkStyle ? 'border-green-500/10 shadow-[inset_0_0_100px_rgba(0,0,0,0.8)]' : 'border-gray-500/20'
        }`} />

        {/* HUD Overlay */}
        <div className={`absolute bottom-4 right-4 backdrop-blur-md p-4 rounded-xl border shadow-2xl z-[400] text-sm pointer-events-none max-w-lg ${
          isDarkStyle ? 'bg-gray-900/85 border-gray-700/50' : 'bg-white/85 border-gray-300/50'
        }`}>
          <div className="flex gap-6">
            <div className="truncate">
              <div className={`text-[10px] mb-1 uppercase tracking-widest font-semibold ${isDarkStyle ? 'text-gray-500' : 'text-gray-400'}`}>{t('hudZone')}</div>
              <div className={`font-mono text-sm truncate ${isDarkStyle ? 'text-blue-400' : 'text-blue-600'}`}>{getZoneName(selectedZone)}</div>
            </div>
            <div className="shrink-0">
              <div className={`text-[10px] mb-1 uppercase tracking-widest font-semibold ${isDarkStyle ? 'text-gray-500' : 'text-gray-400'}`}>{t('hudScale')}</div>
              <div className={`font-mono text-sm ${isDarkStyle ? 'text-amber-400' : 'text-amber-600'}`}>
                ~{liveScale.toFixed(2)} {t('hudPxNm')}
              </div>
            </div>
            <div className="shrink-0">
              <div className={`text-[10px] mb-1 uppercase tracking-widest font-semibold ${isDarkStyle ? 'text-gray-500' : 'text-gray-400'}`}>{t('hudStatus')}</div>
              <div className={`font-mono text-sm flex items-center gap-2 ${isDarkStyle ? 'text-green-400' : 'text-green-600'}`}>
                <span className={`w-2 h-2 rounded-full animate-pulse ${isDarkStyle ? 'bg-green-500' : 'bg-green-600'}`}></span>
                {t('hudOnline')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
