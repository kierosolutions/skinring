import React from 'react';
import { Language } from '../types';
import { getTranslation } from '../i18n/translations';
import { Users, Camera, MapPin, Grid, Calendar } from 'lucide-react';

export type NavTab = 'patients' | 'capture' | 'bodymap' | 'uglyduckling' | 'reminders' | 'settings';

interface NavigationProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  language: Language;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  language,
}) => {
  const t = getTranslation(language);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/98 border-t border-slate-800 backdrop-blur-lg pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
      <div className="max-w-lg mx-auto px-2 flex items-center justify-around h-18">
        {/* Patients Tab */}
        <button
          onClick={() => onTabChange('patients')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 transition-colors ${
            currentTab === 'patients' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium tracking-tight truncate max-w-[68px]">{t.navPatients}</span>
        </button>

        {/* Body Map Tab */}
        <button
          onClick={() => onTabChange('bodymap')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 transition-colors ${
            currentTab === 'bodymap' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium tracking-tight truncate max-w-[68px]">{t.navBodyMap}</span>
        </button>

        {/* Center Prominent Guided Capture Button */}
        <div className="relative -top-4 flex flex-col items-center px-1">
          <button
            onClick={() => onTabChange('capture')}
            className={`w-15 h-15 rounded-full flex items-center justify-center shadow-xl transition-transform active:scale-95 ${
              currentTab === 'capture'
                ? 'bg-gradient-to-tr from-cyan-500 to-sky-400 text-slate-950 ring-4 ring-cyan-500/40 shadow-cyan-500/50'
                : 'bg-gradient-to-tr from-cyan-600 to-sky-500 text-white shadow-cyan-900/60 hover:brightness-110'
            }`}
            title="Start Guided Ring Capture"
          >
            {/* Simple Ring Motif on Capture Button */}
            <div className="relative w-9 h-9 rounded-full border-2 border-current flex items-center justify-center">
              <div className="absolute -top-1 w-2 h-2 bg-rose-500 rounded-full" />
              <Camera className="w-5 h-5" />
            </div>
          </button>
          <span className={`text-xs mt-1 font-bold ${currentTab === 'capture' ? 'text-cyan-400' : 'text-slate-200'}`}>
            {t.navCapture}
          </span>
        </div>

        {/* Ugly Duckling Tab */}
        <button
          onClick={() => onTabChange('uglyduckling')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 transition-colors ${
            currentTab === 'uglyduckling' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Grid className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium tracking-tight truncate max-w-[68px]">{t.navUglyDuckling}</span>
        </button>

        {/* Reminders Tab */}
        <button
          onClick={() => onTabChange('reminders')}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 transition-colors ${
            currentTab === 'reminders' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium tracking-tight truncate max-w-[68px]">{t.navReminders}</span>
        </button>
      </div>
    </nav>
  );
};
