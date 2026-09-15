'use client';

import { useMemo, useState } from 'react';
import { getTeamSuggestions } from '@/lib/predictionEngine';

interface TeamPickerProps {
  label: string;
  icon: string;
  value: string;
  onChange: (value: string) => void;
  teams: string[];
}

export default function TeamPicker({ label, icon, value, onChange, teams }: TeamPickerProps) {
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [browserQuery, setBrowserQuery] = useState('');

  const suggestions = useMemo(() => {
    if (value.trim().length < 2) return [];
    return getTeamSuggestions(teams, value.trim());
  }, [teams, value]);

  const browserTeams = useMemo(() => {
    const q = browserQuery.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((team) => team.toLowerCase().includes(q));
  }, [teams, browserQuery]);

  return (
    <div className="relative">
      <label className="mb-1 block font-bold text-slate-700">
        {icon} {label}
      </label>
      <div className="flex gap-1">
        <input
          type="text"
          autoComplete="off"
          className="w-full rounded-lg border-2 border-slate-200 px-4 py-2.5 text-lg transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          placeholder="Takım adı yazın veya seçin..."
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setSuggestionsOpen(true);
          }}
          onFocus={() => {
            if (value.trim().length >= 2) setSuggestionsOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 150)}
        />
        <button
          type="button"
          className="rounded-lg border-2 border-indigo-300 px-3 text-indigo-600 hover:bg-indigo-50"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setBrowserOpen((v) => !v)}
        >
          ☰
        </button>
      </div>

      {suggestionsOpen &&
        suggestions.length > 0 &&
        !(suggestions.length === 1 && suggestions[0] === value.trim()) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {suggestions.map((team) => (
            <div
              key={team}
              className="cursor-pointer border-b border-slate-100 px-3 py-2 hover:bg-slate-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(team);
                setSuggestionsOpen(false);
              }}
            >
              {team}
            </div>
          ))}
        </div>
      )}

      {browserOpen && (
        <div className="absolute right-0 top-full z-30 mt-1 w-80 rounded-xl border border-slate-100 bg-white p-2 shadow-2xl">
          <input
            type="text"
            className="mb-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
            placeholder="Takım ara..."
            value={browserQuery}
            onChange={(e) => setBrowserQuery(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
          />
          <div className="max-h-64 overflow-y-auto">
            {browserTeams.length === 0 && (
              <div className="px-2 py-2 text-sm text-slate-400">Takım bulunamadı</div>
            )}
            {browserTeams.map((team) => (
              <div
                key={team}
                className="cursor-pointer rounded-md px-2 py-1.5 text-sm hover:bg-gradient-to-r hover:from-indigo-500 hover:to-purple-600 hover:text-white"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(team);
                  setBrowserOpen(false);
                  setBrowserQuery('');
                }}
              >
                {team}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
