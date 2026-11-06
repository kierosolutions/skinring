import React, { useState } from 'react';
import { Patient, Lesion, Language } from '../types';
import { getTranslation } from '../i18n/translations';
import { MapPin, Plus, ArrowLeftRight, Eye, Calendar, Sparkles } from 'lucide-react';

interface BodyMapProps {
  language: Language;
  patient: Patient;
  lesions: Lesion[];
  onSelectLesion: (lesion: Lesion) => void;
  onAddLesionAtLocation: (view: 'front' | 'back', x: number, y: number, regionName: string) => void;
}

export const BodyMap: React.FC<BodyMapProps> = ({
  language,
  patient,
  lesions,
  onSelectLesion,
  onAddLesionAtLocation,
}) => {
  const t = getTranslation(language);
  const [currentView, setCurrentView] = useState<'front' | 'back'>('front');
  const [selectedPin, setSelectedPin] = useState<Lesion | null>(null);

  // Filter lesions for current view
  const viewLesions = lesions.filter((l) => l.bodyLocation.view === currentView);

  // Approximate anatomical region name from coordinates
  const getRegionName = (view: 'front' | 'back', x: number, y: number): string => {
    const side = x < 50 ? 'Left' : 'Right';
    if (y < 15) return `${side} Head / Neck`;
    if (y < 28) return view === 'front' ? `${side} Chest / Clavicle` : `${side} Upper Back / Shoulder`;
    if (y < 45) return view === 'front' ? `${side} Abdomen / Flank` : `${side} Mid / Lower Back`;
    if (y < 65) {
      if (x < 25 || x > 75) return `${side} Arm / Forearm`;
      return `${side} Anterior Thigh / Hip`;
    }
    if (y < 85) return `${side} Lower Leg / Shin`;
    return `${side} Foot / Ankle`;
  };

  const handleBodyClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    const regionName = getRegionName(currentView, clickX, clickY);
    onAddLesionAtLocation(currentView, Math.round(clickX), Math.round(clickY), regionName);
  };

  const getPinColor = (lesion: Lesion) => {
    if (lesion.argenziano7.score >= 4 || lesion.abcde.score >= 4) {
      return 'bg-rose-500 border-rose-300 text-white shadow-rose-500/50';
    }
    if (lesion.argenziano7.score >= 2 || lesion.abcde.score >= 2) {
      return 'bg-amber-500 border-amber-300 text-slate-950 shadow-amber-500/50';
    }
    return 'bg-emerald-500 border-emerald-300 text-white shadow-emerald-500/50';
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-3 sm:p-5 flex flex-col gap-4 animate-fadeIn pb-24">
      {/* Header and Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-400" />
            <span>Anatomical Body Map</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Tap anywhere on the body to document a new lesion for {patient.name}
          </p>
        </div>

        {/* Front / Back Toggle */}
        <div className="flex bg-slate-900 border border-slate-700 rounded-xl p-1 text-xs sm:text-sm self-start sm:self-auto">
          <button
            onClick={() => {
              setCurrentView('front');
              setSelectedPin(null);
            }}
            className={`py-2 px-3.5 rounded-lg font-semibold transition ${
              currentView === 'front'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Front View
          </button>
          <button
            onClick={() => {
              setCurrentView('back');
              setSelectedPin(null);
            }}
            className={`py-2 px-3.5 rounded-lg font-semibold transition ${
              currentView === 'back'
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Back View
          </button>
        </div>
      </div>

      {/* Main Diagram Area */}
      <div className="relative w-full aspect-[4/5] max-h-[520px] mx-auto rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl flex items-center justify-center overflow-hidden p-4">
        {/* Anatomical Grid lines background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        {/* View Indicator Label */}
        <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-slate-800/90 border border-slate-700 text-xs font-bold text-slate-200 uppercase tracking-wider">
          {currentView === 'front' ? 'Anterior (Front)' : 'Posterior (Back)'}
        </div>

        {/* Interactive SVG Body Diagram */}
        <svg
          viewBox="0 0 200 300"
          className="w-full h-full max-h-[480px] cursor-crosshair select-none"
          onClick={handleBodyClick}
        >
          <defs>
            <linearGradient id="bodySkin" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#38bdf8" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Body Silhouette */}
          <g fill="url(#bodySkin)" stroke="#475569" strokeWidth="1.5" strokeLinejoin="round">
            {/* Head */}
            <ellipse cx="100" cy="24" rx="15" ry="19" />
            {/* Neck */}
            <path d="M 94 40 L 94 48 L 106 48 L 106 40 Z" />

            {/* Torso & Pelvis */}
            <path d="M 72 50 C 78 48 122 48 128 50 C 132 58 130 95 125 125 L 118 145 L 82 145 L 75 125 C 70 95 68 58 72 50 Z" />

            {/* Arms (Left & Right) */}
            <path d="M 71 52 C 60 70 52 100 48 125 C 46 138 44 150 42 165 C 40 172 44 176 47 172 C 51 162 55 142 58 128 C 62 108 67 85 73 70 Z" />
            <path d="M 129 52 C 140 70 148 100 152 125 C 154 138 156 150 158 165 C 160 172 156 176 153 172 C 149 162 145 142 142 128 C 138 108 133 85 127 70 Z" />

            {/* Legs (Left & Right) */}
            <path d="M 83 145 C 83 175 80 215 82 245 C 83 260 81 278 84 290 C 86 295 92 295 93 290 C 96 276 96 258 97 240 C 98 210 99 175 99 152 Z" />
            <path d="M 117 145 C 117 175 120 215 118 245 C 117 260 119 278 116 290 C 114 295 108 295 107 290 C 104 276 104 258 103 240 C 102 210 101 175 101 152 Z" />

            {/* Anatomical reference landmarks */}
            {currentView === 'front' ? (
              <g stroke="#64748b" strokeWidth="0.8" opacity="0.5" fill="none">
                {/* Clavicles */}
                <path d="M 80 54 Q 100 58 120 54" />
                {/* Umbilicus */}
                <circle cx="100" cy="115" r="1.5" fill="#64748b" />
                {/* Knees */}
                <circle cx="89" cy="225" r="3" />
                <circle cx="111" cy="225" r="3" />
              </g>
            ) : (
              <g stroke="#64748b" strokeWidth="0.8" opacity="0.5" fill="none">
                {/* Spine */}
                <line x1="100" y1="48" x2="100" y2="145" strokeDasharray="3,3" />
                {/* Scapulae (Shoulder blades) */}
                <path d="M 82 62 Q 92 75 88 90" />
                <path d="M 118 62 Q 108 75 112 90" />
              </g>
            )}
          </g>

          {/* Lesion Pins on Diagram */}
          {viewLesions.map((lesion) => {
            // Map percentage coordinates (0-100) to SVG viewbox (0-200, 0-300)
            const cx = (lesion.bodyLocation.x / 100) * 200;
            const cy = (lesion.bodyLocation.y / 100) * 300;

            const isSelected = selectedPin?.id === lesion.id;

            return (
              <g
                key={lesion.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPin(lesion);
                }}
                className="cursor-pointer group"
              >
                {/* Pulse ring if selected or high risk */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 10 : 7}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  className="animate-ping opacity-75"
                />

                {/* Marker Circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="6.5"
                  className={
                    lesion.argenziano7.score >= 4
                      ? 'fill-rose-500 stroke-rose-200'
                      : lesion.argenziano7.score >= 2
                      ? 'fill-amber-500 stroke-amber-200'
                      : 'fill-emerald-500 stroke-emerald-200'
                  }
                  strokeWidth="1.5"
                  filter="url(#glow)"
                />

                {/* Number inside pin */}
                <text
                  x={cx}
                  y={cy + 3}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="8"
                  fontWeight="bold"
                >
                  {lesion.number}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tap guide watermark */}
        <div className="absolute bottom-3 right-4 px-2.5 py-1.5 rounded-lg bg-slate-800/90 text-xs text-slate-300 pointer-events-none border border-slate-700/60">
          + Tap diagram to place marker
        </div>
      </div>

      {/* Selected Lesion Callout Card */}
      {selectedPin ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${getPinColor(selectedPin)}`}>
                #{selectedPin.number}
              </span>
              <h4 className="text-base font-bold text-white">{selectedPin.name}</h4>
              <span className="text-xs uppercase font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {selectedPin.status}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5">
              Site: <strong className="text-white">{selectedPin.bodyLocation.region}</strong> • ABCDE: {selectedPin.abcde.score}/5 • 7-Point: {selectedPin.argenziano7.score} pts
            </p>
          </div>

          <button
            onClick={() => onSelectLesion(selectedPin)}
            className="py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shrink-0 shadow-md"
          >
            <Eye className="w-4 h-4" />
            <span>Open Timeline</span>
          </button>
        </div>
      ) : (
        /* Summary count */
        <div className="text-center text-xs sm:text-sm text-slate-400">
          Showing {viewLesions.length} lesion{viewLesions.length === 1 ? '' : 's'} on {currentView} view.
        </div>
      )}
    </div>
  );
};
