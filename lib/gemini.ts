import { PredictionData, RecentMatch, formatRecentMatches } from './apiFootball';

const GEMINI_MODEL = 'gemini-3.5-flash-lite';

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface GeminiMatchRef {
  home: string;
  away: string;
}

export interface GeminiAction {
  reply: string;
  team1: string | null;
  team2: string | null;
  matches: GeminiMatchRef[];
}

export interface GeminiContext {
  team1: string;
  team2: string;
  team1Recent: RecentMatch[];
  team2Recent: RecentMatch[];
  headToHead: RecentMatch[];
  listedMatches: RecentMatch[];
  listedTitle: string;
  prediction: PredictionData | null;
  todayGregorian?: string;
  todayHijri?: string;
  liveFixtures?: string;
}

function geminiKey(): string {
  return process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
}

export function hasGeminiKey(): boolean {
  return geminiKey().length > 0;
}

function parseAction(raw: string): GeminiAction {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned) as Partial<GeminiAction>;
  const rawMatches = Array.isArray(parsed.matches) ? parsed.matches : [];
  const matches: GeminiMatchRef[] = rawMatches
    .map((m) => ({
      home: String((m as Partial<GeminiMatchRef>)?.home ?? '').trim(),
      away: String((m as Partial<GeminiMatchRef>)?.away ?? '').trim(),
    }))
    .filter((m) => m.home.length > 0 && m.away.length > 0);
  return {
    reply: String(parsed.reply ?? ''),
    team1: parsed.team1 ? String(parsed.team1) : null,
    team2: parsed.team2 ? String(parsed.team2) : null,
    matches,
  };
}

function parseRetryDelaySeconds(body: unknown): number | null {
  const details = (body as { error?: { details?: unknown[] } })?.error?.details;
  if (!Array.isArray(details)) return null;
  for (const item of details) {
    const retryDelay = (item as { retryDelay?: string })?.retryDelay;
    if (typeof retryDelay === 'string') {
      const match = retryDelay.match(/([\d.]+)s/);
      if (match) return Math.ceil(parseFloat(match[1]));
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function askGemini(
  history: ChatMessage[],
  userText: string,
  context: GeminiContext,
): Promise<GeminiAction> {
  const key = geminiKey();
  if (!key) {
    throw new Error('Gemini API anahtari yok');
  }

  const system = `Sen bir futbol sohbet asistanisin. Turkce konus.
Sana verilen tum veriler API-Football'dan canli olarak cekiliyor, sabit/eski bir veritabani yok.
Her mac satirinda hem miladi tarih hem hicri tarih vardir. Hicri ay/gun sorularinda hicri tarihi kullan, miladi tarihten tahmin yurutme.
"bugun mac var mi" sorularinda yalnizca "Bugunun canli fikstur" listesine bak. Listede yoksa yok de, uydurma.
Birden fazla mac varsa reply kisa olsun ve "matches" alanina Turkiye maclarini (yoksa listedeki maclari) {"home","away"} olarak ekle; listeyi reply icinde tekrar yazma.
"bugunku maci analiz et", "bu gunku maci incele" gibi takim adi verilmeyen isteklerde: "Bugunun canli fikstur" listesindeki Turkey (Turkiye) satirlarina bak.
Tam olarak bir Turkiye maci varsa o macin ev sahibi ve deplasman takim adlarini aynen fikstur listesindeki gibi team1 ve team2 alanlarina yaz, reply'da hangi maci analiz ettigini soyle.
Birden fazla Turkiye maci varsa team1 ve team2'yi null birak, reply'da sadece "Bugun birden fazla mac var, asagidan birini secebilirsin." gibi kisa bir cumle yaz, macin listesini reply icinde tekrar yazma (liste ayrica tiklanabilir olarak gosterilecek).
Hic Turkiye maci yoksa team1 ve team2'yi null birak, bugun mac olmadigini soyle.
Kullanici iki takim adi verirse team1 ve team2 alanlarina bu takimlarin adlarini yaz.
Kullanici tek takim soruyorsa team1'e o takimi yaz, team2'yi null birak.
Son maclar, kafa kafaya gecmis ve varsa istatistiksel tahmin verilerine dayanarak kisa, dogal bir analiz yaz. Uydurma mac veya istatistik yazma, sadece sana verilen veriyi yorumla.
Kullanici mac listesi, tablo, hicri tarih, hicri ay veya "yazar misin" istediginde:
- reply sadece 1 kisa giris cumlesi olsun
- markdown tablo YAZMA, tablo arayuzde otomatik gosterilecek
- "Listelenecek maclar" blogundaki satirlari kullan, yoksa kafa kafaya / son maclar bloklarini kullan
- Veri yoksa net soyle, uydurma
Kullanici "kac mac kazanmis", "toplam kacini kazanmistir", galibiyet/maglubiyet/beraberlik sayisi sorarsa yalnizca verilen listedeki W/D/L sonucunu say. Uydurma sayi yazma. Cevapta net rakam soyle.
"matches" alanina yalnizca kullanicinin secmesi gereken canli/yaklasan mac seceneklerini ekle. Gecmis mac listesi veya tablo cevabinda matches'i bos dizi birak.
Sadece JSON don:
{"reply":"string","team1":string|null,"team2":string|null,"matches":[{"home":"string","away":"string"}]}
Degistirmeyecegin alanlari null birak.`;

  const contextBlock = `Bugunun tarihi (Istanbul): ${context.todayGregorian || '-'}
Bugunun Hicri tarihi: ${context.todayHijri || '-'}

Bugunun canli fikstur (Turkiye ve buyuk ligler, API-Football):
${context.liveFixtures || 'Fikstur yok'}

Secili durum:
Ev: ${context.team1 || '-'}
Deplasman: ${context.team2 || '-'}

Listelenecek maclar (${context.listedTitle || 'yok'}):
${formatRecentMatches(context.listedMatches)}

${context.team1 || 'Takim 1'} son maclar (API-Football):
${formatRecentMatches(context.team1Recent)}

${context.team2 || 'Takim 2'} son maclar (API-Football):
${formatRecentMatches(context.team2Recent)}

Kafa kafaya (API-Football):
${formatRecentMatches(context.headToHead)}

API-Football tahmini:
${
  context.prediction
    ? `${context.prediction.advice ?? '-'} | Ev %${context.prediction.percentHome ?? '-'} Berabere %${context.prediction.percentDraw ?? '-'} Deplasman %${context.prediction.percentAway ?? '-'}`
    : 'Henuz yok'
}`;

  const contents = [
    ...history.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    })),
    { role: 'user', parts: [{ text: `${contextBlock}\n\nKullanici: ${userText}` }] },
  ];

  const requestBody = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
    },
  };

  async function call(): Promise<Response> {
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      },
    );
  }

  let res = await call();
  let body = await res.json();
  if (res.status === 429) {
    const retryAfter = parseRetryDelaySeconds(body) ?? 5;
    await sleep(Math.min(retryAfter, 30) * 1000);
    res = await call();
    body = await res.json();
  }

  if (!res.ok) {
    if (res.status === 429) {
      const retryAfter = parseRetryDelaySeconds(body);
      throw new Error(
        retryAfter
          ? `Gemini kotasi doldu, ${retryAfter} saniye sonra tekrar deneyin.`
          : 'Gemini kotasi doldu, biraz sonra tekrar deneyin.',
      );
    }
    throw new Error(body?.error?.message || `Gemini HTTP ${res.status}`);
  }

  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini bos cevap dondu');
  }
  return parseAction(text);
}
