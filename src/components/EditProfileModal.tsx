import React, { useState } from 'react';
import { Target, Check, X } from 'lucide-react';
import { PlayerProfile } from '../types';
import { User as FirebaseUser } from 'firebase/auth';
import { soundManager } from '../utils/audio';
import { parseTargetExam } from './CadreRankCard';
import { TARGET_EXAM_GROUPS } from './ProfileModal';

interface EditProfileModalProps {
  player: PlayerProfile;
  currentUser: FirebaseUser | null;
  onClose: () => void;
  onUpdatePlayer: (updated: Partial<PlayerProfile>) => void | Promise<void>;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  player,
  currentUser,
  onClose,
  onUpdatePlayer,
}) => {
  const [name, setName] = useState<string>(player.name);
  const [avatar, setAvatar] = useState<string>(player.avatar);
  const [targetExam, setTargetExam] = useState<string>(player.targetExam || 'SSC CPO - Sub-Inspector (Delhi Police / CAPF)');
  const [selectedPhotoURL, setSelectedPhotoURL] = useState<string | undefined>(player.photoURL);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const avatars = ['👮‍♂️', '👨‍💼', '👩‍🎓', '👨‍🏫', '👩‍⚖️', '🧑‍💻', '👨‍✈️', '👩‍🔬'];

  const popularCadres = [
    { label: 'SSC CPO - Sub-Inspector', full: 'SSC CPO - Sub-Inspector (Delhi Police / CAPF)' },
    { label: 'CGL GST Inspector', full: 'SSC CGL - GST Inspector (Central Excise / 4600 GP)' },
    { label: 'CGL Income Tax', full: 'SSC CGL - Income Tax Inspector (CBDT / 4600 GP)' },
    { label: 'CGL ASO (CSS/MEA)', full: 'SSC CGL - Assistant Section Officer (ASO - CSS / MEA / IB / 4600 GP)' },
    { label: 'SSC CHSL (10+2)', full: 'SSC CHSL - Postal Assistant / DEO / LDC (10+2)' },
    { label: 'RRB NTPC Station Master', full: 'RRB NTPC - Station Master / Traffic Assistant' },
    { label: 'Bank PO (SBI / IBPS)', full: 'Bank PO (SBI / IBPS Probationary Officer)' },
  ];

  const handleSave = async () => {
    soundManager.playTap();
    setIsSaving(true);
    try {
      await onUpdatePlayer({
        name: name.trim() || player.name,
        avatar,
        targetExam,
        photoURL: selectedPhotoURL,
      });
      setSavedSuccess(true);
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err) {
      console.error('Failed to save profile changes:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const parsedCadre = parseTargetExam(targetExam);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      <div className="w-full max-w-sm bg-slate-900 border border-cyan-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-4 no-scrollbar">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-[#00C4EE] shrink-0 shadow-inner">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-slate-100 flex items-center gap-1.5">
                Edit Profile & Target Exam
              </h3>
              <p className="text-[10px] text-slate-400">
                Set your target cadre post & aspirant details
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundManager.playTap();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center border border-slate-700 cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Active Cadre Preview Card */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/40 rounded-2xl p-3.5 space-y-2 shadow-lg shadow-cyan-950/30">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-[#00C4EE]" />
              Active Target Cadre:
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-mono font-bold">
              2026 Target
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-2.5 py-1 rounded-lg bg-[#00C4EE] text-slate-950 font-black text-xs tracking-wider shrink-0 shadow-sm shadow-[#00C4EE]/30">
              {parsedCadre.tag}
            </div>
            <div className="text-xs font-bold text-slate-100 leading-snug">
              {parsedCadre.detail}
            </div>
          </div>
        </div>

        {/* Target Exam Dropdown Selection */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
            <span>Select Target Post / Exam:</span>
            <span className="text-[10px] text-cyan-400 font-mono">All Govt Boards</span>
          </label>
          <select
            value={targetExam}
            onChange={e => setTargetExam(e.target.value)}
            className="bg-slate-950 border border-slate-700 hover:border-cyan-500/60 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-cyan-200 w-full font-semibold focus:outline-none shadow-inner cursor-pointer"
          >
            {TARGET_EXAM_GROUPS.map((groupObj, gIdx) => (
              <optgroup
                key={gIdx}
                label={groupObj.group}
                className="bg-slate-950 font-bold text-amber-300 py-1"
              >
                {groupObj.exams.map(ex => (
                  <option
                    key={ex}
                    value={ex}
                    className="bg-slate-900 text-slate-200 font-medium py-1"
                  >
                    {ex}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Quick Select Popular Cadres */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Popular Target Posts:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {popularCadres.map((item) => {
              const isSelected = targetExam === item.full;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    soundManager.playTap();
                    setTargetExam(item.full);
                  }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-sm shadow-cyan-500/30'
                      : 'bg-slate-800/80 hover:bg-slate-750 text-slate-300 border-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Aspirant Name Input */}
        <div className="space-y-1.5 border-t border-slate-800 pt-3">
          <label className="text-[11px] font-bold text-slate-300 block">
            Aspirant Name:
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter Aspirant Name"
            maxLength={30}
            className="bg-slate-950 border border-slate-700 hover:border-slate-600 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-bold text-slate-100 w-full focus:outline-none"
          />
          {currentUser?.displayName && currentUser.displayName !== name && (
            <button
              type="button"
              onClick={() => {
                soundManager.playTap();
                setName(currentUser.displayName || name);
              }}
              className="text-[10px] text-sky-400 hover:underline font-medium cursor-pointer"
            >
              Use Google Name: {currentUser.displayName}
            </button>
          )}
        </div>

        {/* Aspirant Avatar / Photo Selection */}
        <div className="space-y-1.5 border-t border-slate-800 pt-3">
          <label className="text-[11px] font-bold text-slate-300 block">
            Aspirant Avatar / Photo:
          </label>
          <div className="flex justify-center gap-1.5 flex-wrap pt-1">
            {currentUser?.photoURL && (
              <button
                type="button"
                onClick={() => {
                  soundManager.playTap();
                  setSelectedPhotoURL(currentUser.photoURL || undefined);
                }}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 border cursor-pointer transition-all ${
                  selectedPhotoURL === currentUser.photoURL
                    ? 'bg-indigo-900/80 text-indigo-200 border-indigo-400 ring-2 ring-indigo-400/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                }`}
              >
                <img
                  src={currentUser.photoURL}
                  alt="google avatar"
                  className="w-4 h-4 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <span>Google Photo</span>
              </button>
            )}
            {avatars.map(av => {
              const isSelected = !selectedPhotoURL && avatar === av;
              return (
                <button
                  key={av}
                  type="button"
                  onClick={() => {
                    soundManager.playTap();
                    setAvatar(av);
                    setSelectedPhotoURL(undefined);
                  }}
                  className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/60 scale-105 shadow-sm shadow-cyan-400/30 ring-2 ring-cyan-400/50'
                      : 'border-slate-700 bg-slate-800 hover:bg-slate-750'
                  }`}
                >
                  {av}
                </button>
              );
            })}
          </div>
        </div>

        {/* Save & Action Buttons */}
        <div className="pt-2 space-y-2 border-t border-slate-800">
          <button
            type="button"
            disabled={isSaving || savedSuccess}
            onClick={handleSave}
            className={`w-full font-black p-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-lg cursor-pointer transition-all disabled:opacity-75 ${
              savedSuccess
                ? 'bg-emerald-500 text-white shadow-emerald-950/50'
                : 'bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white shadow-emerald-950/50'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>
              {savedSuccess
                ? 'SAVED & SYNCED TO FIREBASE!'
                : isSaving
                ? 'SAVING TO FIREBASE...'
                : 'SAVE CHANGES & SYNC'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playTap();
              onClose();
            }}
            className="w-full bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold py-2 rounded-xl text-xs border border-slate-700 cursor-pointer transition-colors text-center"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
