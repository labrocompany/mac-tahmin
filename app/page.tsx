'use client';

import { useEffect, useMemo, useState } from 'react';
import { assetUrl } from '@/lib/config';
import { GREGORIAN_MONTHS, HIJRI_MONTHS } from '@/lib/hijri';
import { CalendarType, MatchRow, PredictionResult, predictMatch, TeamStats } from '@/lib/predictionEngine';
import TeamPicker from '@/components/TeamPicker';

const CONFIDENCE_COLORS: Record<string, string> = {
  'Çok Yüksek': 'bg-emerald-500',
  Yüksek: 'bg-amber-500',
  Orta: 'bg-sky-500',
  Düşük: 'bg-slate-400',
};

function TeamStatsCard({ stats }: { stats: TeamStats | null }) {
  if (!stats) return null;
  const winRate = ((stats.wins / stats.totalMatches) * 100).toFixed(1);
  const drawRate = ((stats.draws / stats.totalMatches) * 100).toFixed(1);
  const lossRate = ((stats.losses / stats.totalMatches) * 100).toFixed(1);

  return (
    <div className="rounded-xl bg-gradient-to-br from-rose-100 to-pink-100 p-4">
      <h3 className="mb-3 font-bold">{stats.team} İstatistikleri</h3>
      <div className="mb-2">Toplam Maç: {stats.totalMatches}</div>
      <div className="mb-2">Galibiyet: {stats.wins} (%{winRate})</div>
      <div className="mb-2">Beraberlik: {stats.draws} (%{drawRate})</div>
      <div className="mb-2">Mağlubiyet: {stats.losses} (%{lossRate})</div>
      <div className="mt-3 rounded-lg bg-white/70 p-2">
        Başarı Oranı:{' '}
        <span className="rounded bg-indigo-600 px-2 py-1 font-bold text-white">
          %{stats.successRate.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const [teams, setTeams] = useState<string[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [calendarType, setCalendarType] = useState<CalendarType>('hijri');
  const [dayFilter, setDayFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  const [predicting, setPredicting] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [teamsRes, matchesRes] = await Promise.all([
          fetch(assetUrl('/data/teams.json')),
          fetch(assetUrl('/data/matches.json')),
        ]);
        const teamsJson: string[] = await teamsRes.json();
        const matchesJson: MatchRow[] = await matchesRes.json();
        setTeams(teamsJson);
        setMatches(matchesJson);
      } catch (e) {
        setDataError('Veri yüklenemedi. Sayfayı yenilemeyi deneyin.');
      } finally {
        setDataLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [error]);

  const dayOptions = useMemo(() => {
    const max = calendarType === 'hijri' ? 30 : 31;
    return Array.from({ length: max }, (_, i) => i + 1);
  }, [calendarType]);

  const monthOptions = calendarType === 'hijri' ? HIJRI_MONTHS : GREGORIAN_MONTHS;

  function handlePredict() {
    const t1 = team1.trim();
    const t2 = team2.trim();

    if (!t1 || !t2) {
      setError('Lütfen iki takım da seçin!');
      return;
    }
    if (t1 === t2) {
      setError('Aynı takımı iki kez seçemezsiniz!');
      return;
    }
    if (!teams.includes(t1)) {
      setError(`${t1} takımı bulunamadı`);
      return;
    }
    if (!teams.includes(t2)) {
      setError(`${t2} takımı bulunamadı`);
      return;
    }

    setPredicting(true);
    setResult(null);

    window.setTimeout(() => {
      const day = dayFilter ? parseInt(dayFilter, 10) : null;
      const month = monthFilter ? parseInt(monthFilter, 10) : null;
      const prediction = predictMatch(matches, teams, t1, t2, day, month, calendarType);
      setResult(prediction);
      setPredicting(false);
    }, 50);
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="rounded-3xl bg-white/95 p-6 shadow-2xl backdrop-blur md:p-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-indigo-700 md:text-4xl">
            Hijri Takvim Maç Tahmin Sistemi
          </h1>
          <p className="mt-2 text-slate-500">Tarihsel verilere dayalı akıllı maç tahmin sistemi</p>
        </div>

        {dataLoading && (
          <div className="py-10 text-center text-slate-500">Veriler yükleniyor...</div>
        )}
        {dataError && <div className="py-4 text-center text-red-600">{dataError}</div>}

        {!dataLoading && !dataError && (
          <>
            <div className="mb-6 grid grid-cols-1 items-end gap-4 md:grid-cols-11">
              <div className="md:col-span-5">
                <TeamPicker label="Ev Sahibi Takım" value={team1} onChange={setTeam1} teams={teams} />
              </div>
              <div className="text-center font-bold text-rose-500 md:col-span-1">VS</div>
              <div className="md:col-span-5">
                <TeamPicker label="Deplasman Takımı" value={team2} onChange={setTeam2} teams={teams} />
              </div>
            </div>

            <div className="mb-6 text-center">
              <h2 className="mb-3 font-bold">Takvim Türü</h2>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  className={`rounded-lg px-5 py-2 font-semibold text-white transition ${
                    calendarType === 'hijri'
                      ? 'bg-toggle-active-gradient'
                      : 'bg-toggle-gradient opacity-80'
                  }`}
                  onClick={() => setCalendarType('hijri')}
                >
                  Hijri Takvim
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-5 py-2 font-semibold text-white transition ${
                    calendarType === 'gregorian'
                      ? 'bg-toggle-active-gradient'
                      : 'bg-toggle-gradient opacity-80'
                  }`}
                  onClick={() => setCalendarType('gregorian')}
                >
                  Miladi Takvim
                </button>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block font-bold text-slate-700">
                  Gün Filtresi (Her Ayın X. Günü)
                </label>
                <select
                  className="w-full rounded-lg border-2 border-slate-200 px-3 py-2"
                  value={dayFilter}
                  onChange={(e) => setDayFilter(e.target.value)}
                >
                  <option value="">Tüm Günler</option>
                  {dayOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}. Gün
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">Ay Filtresi</label>
                <select
                  className="w-full rounded-lg border-2 border-slate-200 px-3 py-2"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                >
                  <option value="">Tüm Aylar</option>
                  {monthOptions.map((m, idx) => (
                    <option key={m} value={idx + 1}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-8 text-center">
              <button
                type="button"
                disabled={predicting}
                onClick={handlePredict}
                className="rounded-2xl bg-btn-gradient px-10 py-3 text-lg font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {predicting ? 'Hesaplanıyor...' : 'Maç Tahmini Yap'}
              </button>
            </div>

            {result && (
              <div>
                <div className="mb-6 rounded-2xl bg-prediction-gradient p-6 text-white">
                  <h2 className="mb-4 text-center text-2xl font-bold">Tahmin Sonucu</h2>
                  <div className="mb-4 text-center text-2xl font-bold">{result.prediction}</div>
                  <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-lg bg-white/15 p-3 text-center">
                      <div className="text-sm opacity-80">Güvenilirlik</div>
                      <span
                        className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-bold ${
                          CONFIDENCE_COLORS[result.confidenceLevel] ?? 'bg-slate-400'
                        }`}
                      >
                        {result.confidenceLevel}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white/15 p-3 text-center">
                      <div className="text-sm opacity-80">Skor Tahmini</div>
                      <div className="mt-1 font-bold">{result.scorePrediction}</div>
                    </div>
                    <div className="rounded-lg bg-white/15 p-3 text-center">
                      <div className="text-sm opacity-80">Performans Farkı</div>
                      <div className="mt-1 font-bold">%{result.successDifference.toFixed(1)}</div>
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-sm">{result.analysis}</pre>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <TeamStatsCard stats={result.team1Stats} />
                  <TeamStatsCard stats={result.team2Stats} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="fixed right-4 top-4 z-50 rounded-lg bg-red-600 px-4 py-3 text-white shadow-xl">
          {error}
        </div>
      )}
    </div>
  );
}
