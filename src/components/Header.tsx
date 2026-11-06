import React from 'react';
import { Language, Patient } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Globe, Moon, Sun, WifiOff, User, Settings } from 'lucide-react';

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  activePatient?: Patient | null;
  onSelectPatient?: () => void;
  onGoHome?: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  darkMode,
  onToggleDarkMode,
  activePatient,
  onSelectPatient,
  onGoHome,
  onOpenSettings,
}) => {
  const isOnline = useOnlineStatus();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/95 backdrop-blur-md text-white transition-colors shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 h-15 flex items-center justify-between gap-2">
        {/* Logo and Brand */}
        <div
          onClick={onGoHome}
          className="flex items-center gap-2.5 cursor-pointer select-none group shrink-0"
        >
          <div className="relative flex items-center justify-center w-9 h-9 rounded-full bg-slate-800 border-2 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.35)] group-hover:scale-105 transition-transform">
            {/* 12 o'clock red orientation notch */}
            <div className="absolute top-0 w-2 h-2.5 bg-rose-500 rounded-b-xs" />
            {/* Center reticle */}
            <div className="w-3 h-3 rounded-full bg-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black tracking-tight text-lg sm:text-xl bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
                SkinRing
              </span>
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60 hidden sm:inline-block">
                Triage PWA
              </span>
            </div>
          </div>
        </div>

        {/* Active Patient Indicator (if selected) */}
        {activePatient && (
          <button
            onClick={onSelectPatient}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs sm:text-sm text-slate-200 transition truncate max-w-[150px] sm:max-w-[240px]"
            title={`Active Patient: ${activePatient.name} (${activePatient.mrn})`}
          >
            <User className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="font-semibold truncate">{activePatient.name}</span>
          </button>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Offline Pill */}
          {!isOnline && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold animate-pulse">
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Offline</span>
            </div>
          )}

          {/* PWA Install Button */}
          <PWAInstallButton />

          {/* Language Switcher */}
          <div className="relative flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700 text-xs sm:text-sm">
            <Globe className="w-4 h-4 ml-2 text-slate-400" />
            <select
              value={language}
              aria-label="Language selection"
              onChange={(e) => onLanguageChange(e.target.value as Language)}
              className="bg-transparent text-slate-200 text-xs sm:text-sm font-medium py-1.5 pl-1.5 pr-2.5 rounded-lg focus:outline-hidden cursor-pointer"
            >
              <option value="en" className="bg-slate-900 text-white">EN</option>
              <option value="es" className="bg-slate-900 text-white">ES</option>
              <option value="de" className="bg-slate-900 text-white">DE</option>
            </select>
          </div>

          {/* Dark / Light Toggle */}
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition"
            title={darkMode ? 'Switch to light mode' : 'Switch to clinical dark mode'}
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4.5 h-4.5 text-amber-400" /> : <Moon className="w-4.5 h-4.5 text-slate-300" />}
          </button>

          {/* Settings Button */}
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition"
              title="Hardware & App Settings"
              aria-label="Open settings"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
