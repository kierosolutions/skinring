import React from 'react';
import { Patient, Lesion, Language } from '../types';
import { getTranslation } from '../i18n/translations';
import {
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  User,
  Eye,
  Plus,
} from 'lucide-react';

interface RemindersViewProps {
  language: Language;
  patients: Patient[];
  lesions: Lesion[];
  onSelectLesion: (lesion: Lesion, patient: Patient) => void;
  onUpdateFollowUpDate: (lesionId: string, newDate: string) => void;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  language,
  patients,
  lesions,
  onSelectLesion,
  onUpdateFollowUpDate,
}) => {
  const t = getTranslation(language);

  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // Group lesions by reminder status
  const overdueLesions = lesions.filter(
    (l) => l.nextFollowUpDate && l.nextFollowUpDate < todayStr
  );
  const dueThisMonthLesions = lesions.filter(
    (l) =>
      l.nextFollowUpDate &&
      l.nextFollowUpDate >= todayStr &&
      l.nextFollowUpDate <= thirtyDaysAhead
  );
  const upcomingLesions = lesions.filter(
    (l) => l.nextFollowUpDate && l.nextFollowUpDate > thirtyDaysAhead
  );

  const getPatientForLesion = (patientId: string): Patient | undefined => {
    return patients.find((p) => p.id === patientId);
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-3 sm:p-5 flex flex-col gap-4.5 animate-fadeIn pb-24">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
          <Calendar className="w-6 h-6 text-cyan-400" />
          <span>{t.remindersTitle}</span>
        </h2>
        <p className="text-sm text-slate-300 font-medium mt-1">
          Automated clinical surveillance intervals: 3 months for flagged lesions, 6-12 months for routine monitoring
        </p>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-rose-900/60 shadow-lg">
          <span className="text-xs uppercase font-bold text-rose-400 block">
            {t.overdue}
          </span>
          <span className="text-2xl sm:text-3xl font-black text-white mt-1 block">
            {overdueLesions.length}
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-amber-900/60 shadow-lg">
          <span className="text-xs uppercase font-bold text-amber-400 block">
            {t.dueThisMonth}
          </span>
          <span className="text-2xl sm:text-3xl font-black text-white mt-1 block">
            {dueThisMonthLesions.length}
          </span>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900 border border-cyan-900/60 shadow-lg">
          <span className="text-xs uppercase font-bold text-cyan-400 block">
            {t.upcoming}
          </span>
          <span className="text-2xl sm:text-3xl font-black text-white mt-1 block">
            {upcomingLesions.length}
          </span>
        </div>
      </div>

      {/* Overdue Section */}
      {overdueLesions.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Overdue Follow-ups ({overdueLesions.length})</span>
          </h3>

          {overdueLesions.map((lesion) => {
            const patient = getPatientForLesion(lesion.patientId);
            return (
              <ReminderCard
                key={lesion.id}
                lesion={lesion}
                patient={patient}
                isOverdue
                onSelect={() => patient && onSelectLesion(lesion, patient)}
                onUpdateDate={(d) => onUpdateFollowUpDate(lesion.id, d)}
              />
            );
          })}
        </div>
      )}

      {/* Due This Month Section */}
      <div className="space-y-2.5 mt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>Due Within 30 Days ({dueThisMonthLesions.length})</span>
        </h3>

        {dueThisMonthLesions.length === 0 ? (
          <p className="text-xs text-slate-500 italic p-3 bg-slate-900/50 rounded-2xl border border-slate-800">
            No lesions due for review in the next 30 days.
          </p>
        ) : (
          dueThisMonthLesions.map((lesion) => {
            const patient = getPatientForLesion(lesion.patientId);
            return (
              <ReminderCard
                key={lesion.id}
                lesion={lesion}
                patient={patient}
                onSelect={() => patient && onSelectLesion(lesion, patient)}
                onUpdateDate={(d) => onUpdateFollowUpDate(lesion.id, d)}
              />
            );
          })
        )}
      </div>

      {/* Upcoming Section */}
      <div className="space-y-2.5 mt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Scheduled Routine Monitoring ({upcomingLesions.length})</span>
        </h3>

        {upcomingLesions.map((lesion) => {
          const patient = getPatientForLesion(lesion.patientId);
          return (
            <ReminderCard
              key={lesion.id}
              lesion={lesion}
              patient={patient}
              onSelect={() => patient && onSelectLesion(lesion, patient)}
              onUpdateDate={(d) => onUpdateFollowUpDate(lesion.id, d)}
            />
          );
        })}
      </div>
    </div>
  );
};

interface ReminderCardProps {
  lesion: Lesion;
  patient?: Patient;
  isOverdue?: boolean;
  onSelect: () => void;
  onUpdateDate: (newDate: string) => void;
}

const ReminderCard: React.FC<ReminderCardProps> = ({
  lesion,
  patient,
  isOverdue,
  onSelect,
  onUpdateDate,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`p-4 sm:p-5 rounded-2xl bg-slate-900 border transition cursor-pointer flex items-center justify-between gap-3 shadow-md group ${
        isOverdue ? 'border-rose-900 hover:border-rose-700' : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm sm:text-base shrink-0 shadow-inner ${
            isOverdue
              ? 'bg-rose-950 text-rose-300 border border-rose-800'
              : 'bg-slate-800 text-cyan-300 border border-slate-700'
          }`}
        >
          #{lesion.number}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-base sm:text-lg font-bold text-white group-hover:text-cyan-400 transition truncate">
              {lesion.name}
            </h4>
            {patient && (
              <span className="text-xs sm:text-sm text-slate-300 font-semibold">
                ({patient.name})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-300 mt-1.5 flex-wrap font-medium">
            <span className={isOverdue ? 'text-rose-400 font-bold' : 'text-cyan-300 font-semibold'}>
              Target Date: {lesion.nextFollowUpDate}
            </span>
            <span>•</span>
            <span className="font-bold text-white">ABCDE: {lesion.abcde.score}/5</span>
            <span>•</span>
            <span className="font-bold text-white">7-Point: {lesion.argenziano7.score} pts</span>
          </div>

          {lesion.reminderNotes && (
            <p className="text-xs sm:text-sm text-slate-300 italic mt-1 truncate max-w-sm">
              Note: {lesion.reminderNotes}
            </p>
          )}
        </div>
      </div>

      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition shrink-0" />
    </div>
  );
};
