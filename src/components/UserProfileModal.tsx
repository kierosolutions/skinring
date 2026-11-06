import React, { useState } from 'react';
import { UserProfile, Language } from '../types';
import { User, Check, Shield } from 'lucide-react';

interface UserProfileModalProps {
  language: Language;
  initialProfile?: UserProfile;
  onSave: (profile: UserProfile) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  initialProfile,
  onSave,
}) => {
  const [name, setName] = useState(initialProfile?.name || '');
  const [role, setRole] = useState(initialProfile?.role || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your clinician name.');
      return;
    }
    onSave({
      name: name.trim(),
      role: role.trim() || 'Medical Provider',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 flex flex-col gap-4 animate-scaleUp">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Clinician Profile Setup</h2>
            <p className="text-xs text-slate-400">Personalize your lesion capture identity</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Please enter your name and clinical role. This will be stamped as &ldquo;Captured by&rdquo; on all photographic records and clinical export reports.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Clinician Name <span className="text-cyan-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g. Dr. Alex Morgan or Taylor Bailey, RN"
              className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Clinical Role / Specialty
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Dermatologist, Triage Nurse, General Practitioner"
              className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-medium">{error}</p>
          )}

          <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700 text-[11px] text-slate-400 flex items-start gap-2">
            <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span>Profile details are stored exclusively in your browser&apos;s local IndexedDB. You can update this anytime in Settings.</span>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-white font-bold text-sm shadow-lg shadow-cyan-900/40 transition flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <Check className="w-4 h-4" />
            <span>Save Profile &amp; Continue</span>
          </button>
        </form>
      </div>
    </div>
  );
};
