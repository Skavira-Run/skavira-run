'use client';

import { useState, useEffect } from 'react';
import WordPicker from './WordPicker';

const STORAGE_KEY = 'skavira-run-v2-entries';
const CUSTOM_WORDS_KEY = 'skavira-run-v2-custom-words';

const FIXED_WORDS = [
  'тяжело', 'легко', 'злюсь', 'спокойно', 'сила',
  'сомнение', 'пусто', 'живой', 'устал', 'кайф',
  'тревога', 'ясность', 'в потоке', 'напряжён', 'свободно',
];

type Screen = 'home' | 'record' | 'gallery' | 'journey';

interface Entry {
  id: string;
  date: string;
  wordsBefore: string[];
  wordsAfter: string[];
  text: string;
}

// Взвешенная частота: чем свежее использование — тем выше вес.
function wordScore(word: string, entries: Entry[]): number {
  const now = Date.now();
  const MS_PER_DAY = 86400000;
  let score = 0;
  for (const entry of entries) {
    const all = [...entry.wordsBefore, ...entry.wordsAfter];
    if (all.includes(word)) {
      const days = (now - new Date(entry.date).getTime()) / MS_PER_DAY;
      score += 1 / (1 + days);
    }
  }
  return score;
}

function getSortedWords(entries: Entry[], customWords: string[]): string[] {
  const all = [
    ...FIXED_WORDS,
    ...customWords.filter((w) => !FIXED_WORDS.includes(w)),
  ];
  return [...all].sort((a, b) => wordScore(b, entries) - wordScore(a, entries));
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// Живая фраза под счётчиком
function getCounterPhrase(count: number): string {
  if (count === 0) return 'Первое возвращение впереди';
  if (count <= 3) return 'Начало положено';
  if (count <= 10) return 'Ритм набирается';
  if (count <= 20) return 'Это уже часть тебя';
  return 'Ты возвращаешься снова и снова';
}

// Самое частое слово в массиве записей
function topWord(words: string[]): string | null {
  if (words.length === 0) return null;
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
}

// Топ-N слов по частоте
function topWords(words: string[], n: number): string[] {
  if (words.length === 0) return [];
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

// Самые контрастные записи: те где есть и «до» и «после», разные слова
function topContrastEntries(entries: Entry[], n: number): Entry[] {
  return [...entries]
    .filter((e) => e.wordsBefore.length > 0 && e.wordsAfter.length > 0)
    .sort((a, b) => {
      // Контрастность = количество уникальных слов в обоих пикерах
      const setA = new Set([...a.wordsBefore, ...a.wordsAfter]);
      const setB = new Set([...b.wordsBefore, ...b.wordsAfter]);
      return setB.size - setA.size;
    })
    .slice(0, n);
}

export default function SkaviraApp() {
  const [screen, setScreen] = useState<Screen>('home');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [customWords, setCustomWords] = useState<string[]>([]);

  const [selectedBefore, setSelectedBefore] = useState<string[]>([]);
  const [selectedAfter, setSelectedAfter] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [textExpanded, setTextExpanded] = useState(false);
  const [afterError, setAfterError] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const rawEntries = localStorage.getItem(STORAGE_KEY);
    const rawWords = localStorage.getItem(CUSTOM_WORDS_KEY);
    if (rawEntries) setEntries(JSON.parse(rawEntries));
    if (rawWords) setCustomWords(JSON.parse(rawWords));
  }, []);

  function navigateTo(target: Screen) {
    if (target === 'record') {
      setSelectedBefore([]);
      setSelectedAfter([]);
      setText('');
      setTextExpanded(false);
      setAfterError(false);
    }
    setScreen(target);
  }

  function toggleWord(word: string, selected: string[], setSelected: (w: string[]) => void) {
    setSelected(
      selected.includes(word)
        ? selected.filter((w) => w !== word)
        : [...selected, word]
    );
  }

  function addCustomWord(word: string, autoSelectIn: 'before' | 'after') {
    if (!customWords.includes(word) && !FIXED_WORDS.includes(word)) {
      const updated = [...customWords, word];
      setCustomWords(updated);
      localStorage.setItem(CUSTOM_WORDS_KEY, JSON.stringify(updated));
    }
    if (autoSelectIn === 'before' && !selectedBefore.includes(word)) {
      setSelectedBefore([...selectedBefore, word]);
    }
    if (autoSelectIn === 'after' && !selectedAfter.includes(word)) {
      setSelectedAfter([...selectedAfter, word]);
    }
  }

  function handleSave() {
    if (selectedAfter.length === 0) {
      setAfterError(true);
      setTimeout(() => setAfterError(false), 500);
      return;
    }

    const entry: Entry = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      wordsBefore: selectedBefore,
      wordsAfter: selectedAfter,
      text,
    };

    const updated = [...entries, entry];
    setEntries(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    navigateTo('home');
  }

  const sortedWords = getSortedWords(entries, customWords);

  // Данные для экрана «Мой путь»
  const allWordsBefore = entries.flatMap((e) => e.wordsBefore);
  const allWordsAfter = entries.flatMap((e) => e.wordsAfter);
  const mostFreqBefore = topWord(allWordsBefore);
  const mostFreqAfter = topWord(allWordsAfter);
  const topAfterWords = topWords(allWordsAfter, 5);
  const contrastEntries = topContrastEntries(entries, 3);
  const firstEntry = entries[0];

  const secondaryBtn = "font-medium text-[17px] px-8 py-[14px] rounded-xl bg-white/15 text-white border border-white/30 backdrop-blur-sm transition-all hover:bg-white/25 hover:-translate-y-px active:translate-y-0 cursor-pointer";
  const primaryBtn = "font-medium text-[17px] px-8 py-[14px] rounded-xl bg-[#2a7a3e] text-white border border-transparent transition-all hover:bg-[#226630] hover:-translate-y-px active:translate-y-0 active:bg-[#1d5727] cursor-pointer";

  const videoSrc: Record<Screen, string> = {
    home:    'https://videos.pexels.com/video-files/3209011/3209011-hd_1280_720_25fps.mp4',
    record:  'https://videos.pexels.com/video-files/5387243/5387243-hd_1280_720_30fps.mp4',
    gallery: 'https://videos.pexels.com/video-files/11515017/11515017-hd_1280_720_30fps.mp4',
    journey: 'https://videos.pexels.com/video-files/6056826/6056826-hd_1280_720_30fps.mp4',
  };

  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden relative">
      {/* Экран загрузки — плавно исчезает когда видео готово */}
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-1000"
        style={{
          background: 'linear-gradient(135deg, #1a2e1e 0%, #0d1a10 100%)',
          opacity: videoReady ? 0 : 1,
          pointerEvents: videoReady ? 'none' : 'all',
        }}
      >
        <p className="loading-pulse text-[13px] font-medium tracking-[0.2em] uppercase text-white/70">
          SKAVIRA Run
        </p>
      </div>
      {/* Все 4 видео всегда в DOM — грузятся в фоне, показывается только активное */}
      {(Object.keys(videoSrc) as Screen[]).map((s, i) => (
        <video
          key={s}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onCanPlay={() => { if (i === 0) setVideoReady(true); }}
          className="fixed inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: s === screen ? 1 : 0 }}
        >
          <source src={videoSrc[s]} type="video/mp4" />
        </video>
      ))}
      {/* Тёмный оверлей — чтобы текст читался поверх видео */}
      <div className="fixed inset-0 bg-black/40" />
      <main className="w-full max-w-[640px] px-6 py-12 text-center relative z-10">

        {/* Главный экран */}
        {screen === 'home' && (
          <div className="screen-enter">
            <p className="text-[13px] font-medium tracking-[0.12em] uppercase text-white/60 mb-16">
              SKAVIRA Run
            </p>

            {/* Счётчик — главный герой */}
            <div className="mb-16">
              <div className="text-[96px] font-semibold leading-none text-white mb-4">
                {entries.length}
              </div>
              <p className="text-[17px] text-white/60">
                {getCounterPhrase(entries.length)}
              </p>
            </div>

            <h2 className="text-[28px] font-semibold leading-tight text-white mb-10">
              Ты сегодня бежал?
            </h2>

            <div className="flex gap-4 justify-center flex-wrap">
              <button onClick={() => navigateTo('record')} className={primaryBtn}>
                Да
              </button>
              <button onClick={() => navigateTo('gallery')} className={secondaryBtn}>
                Ещё нет
              </button>
              <button onClick={() => navigateTo('journey')} className={secondaryBtn}>
                Мой путь
              </button>
            </div>
          </div>
        )}

        {/* Экран записи */}
        {screen === 'record' && (
          <div className="screen-enter text-left">
            <p className="text-[13px] font-medium tracking-[0.12em] uppercase text-white/60 mb-12 text-center">
              SKAVIRA Run
            </p>

            <div className="mb-9">
              <p className="text-[12px] font-medium tracking-[0.08em] uppercase text-white/60 mb-3 flex items-center gap-2">
                Каким ты вышел
                <span className="text-[11px] font-normal tracking-[0.04em] normal-case text-[#b0b0a8] border border-[#d4d4cc] rounded-full px-2 py-0.5">
                  необязательно
                </span>
              </p>
              <WordPicker
                words={sortedWords}
                selected={selectedBefore}
                onToggle={(w) => toggleWord(w, selectedBefore, setSelectedBefore)}
                onAddCustom={(w) => addCustomWord(w, 'before')}
              />
            </div>

            <div className={`mb-9 ${afterError ? 'shake' : ''}`}>
              <p className="text-[12px] font-medium tracking-[0.08em] uppercase text-white/60 mb-3">
                Каким ты вернулся
              </p>
              <WordPicker
                words={sortedWords}
                selected={selectedAfter}
                onToggle={(w) => toggleWord(w, selectedAfter, setSelectedAfter)}
                onAddCustom={(w) => addCustomWord(w, 'after')}
              />
            </div>

            <div className="mb-9">
              {!textExpanded ? (
                <button
                  onClick={() => setTextExpanded(true)}
                  className="text-[14px] text-white/50 underline underline-offset-4 decoration-[#d4d4cc] hover:text-[#2a7a3e] hover:decoration-[#2a7a3e] transition-colors bg-transparent border-none cursor-pointer p-0"
                >
                  Написать подробнее →
                </button>
              ) : (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Несколько слов о том, каким ты стал..."
                  autoFocus
                  className="w-full min-h-[130px] text-[17px] leading-[1.55] p-[18px] border border-[#d4d4cc] rounded-xl bg-white text-white caret-[#2a7a3e] resize-y outline-none transition-colors focus:border-[#2a7a3e] placeholder:text-white/50"
                />
              )}
            </div>

            <div className="flex gap-4 justify-center flex-wrap">
              <button onClick={handleSave} className={primaryBtn}>Сохранить</button>
              <button onClick={() => navigateTo('home')} className={secondaryBtn}>Назад</button>
            </div>
          </div>
        )}

        {/* Экран галереи */}
        {screen === 'gallery' && (
          <div className="screen-enter">
            <p className="text-[13px] font-medium tracking-[0.12em] uppercase text-white/60 mb-12">
              SKAVIRA Run
            </p>
            <h1 className="text-[42px] font-semibold leading-tight text-white mb-14">
              Все твои возвращения
            </h1>

            <div className="text-left mb-10">
              {entries.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-[22px] font-semibold text-white/70 mb-2">Пока ни одной версии</p>
                  <p className="text-[15px] text-white/50">Первая — впереди.</p>
                </div>
              ) : (
                [...entries].reverse().map((entry) => (
                  <div key={entry.id} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-6 py-5 mb-4">
                    <p className="text-[13px] text-white/60 tracking-[0.03em] mb-3">{formatDate(entry.date)}</p>
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      {entry.wordsBefore.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {entry.wordsBefore.map((w) => (
                            <span key={w} className="text-[13px] font-medium px-2.5 py-1 rounded-full bg-[#eeeee8] text-white/70">{w}</span>
                          ))}
                        </div>
                      )}
                      {entry.wordsBefore.length > 0 && entry.wordsAfter.length > 0 && (
                        <span className="text-[#b0b0a8] text-[15px]">→</span>
                      )}
                      {entry.wordsAfter.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {entry.wordsAfter.map((w) => (
                            <span key={w} className="text-[13px] font-medium px-2.5 py-1 rounded-full bg-[#d4e8db] text-[#1d5727]">{w}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {entry.text && (
                      <p className="text-[15px] leading-[1.55] text-white/70 mt-2.5 whitespace-pre-wrap">{entry.text}</p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-4 justify-center">
              <button onClick={() => navigateTo('home')} className={secondaryBtn}>Назад</button>
            </div>
          </div>
        )}

        {/* Экран «Мой путь» */}
        {screen === 'journey' && (
          <div className="screen-enter">
            <p className="text-[13px] font-medium tracking-[0.12em] uppercase text-white/60 mb-12">
              SKAVIRA Run
            </p>
            <h1 className="text-[42px] font-semibold leading-tight text-white mb-14">
              Мой путь
            </h1>

            {entries.length === 0 ? (
              <div className="py-10 text-center mb-10">
                <p className="text-[22px] font-semibold text-white/70 mb-2">Ещё нет истории</p>
                <p className="text-[15px] text-white/50">Сделай первое возвращение — и здесь появится твой путь.</p>
              </div>
            ) : (
              <div className="text-left space-y-6 mb-12">

                {/* Блок 1 — начало пути */}
                {firstEntry && (
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-6 py-5">
                    <p className="text-[12px] font-medium tracking-[0.08em] uppercase text-white/60 mb-2">Начало</p>
                    <p className="text-[17px] text-white">
                      Ты начал{' '}
                      <span className="font-semibold">{formatDateShort(firstEntry.date)}</span>.
                      С тех пор — {entries.length}{' '}
                      {entries.length === 1 ? 'возвращение' : entries.length < 5 ? 'возвращения' : 'возвращений'}.
                    </p>
                  </div>
                )}

                {/* Блок 2 — паттерн трансформации */}
                {mostFreqBefore && mostFreqAfter && (
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-6 py-5">
                    <p className="text-[12px] font-medium tracking-[0.08em] uppercase text-white/60 mb-2">Твой паттерн</p>
                    <p className="text-[17px] text-white">
                      Чаще всего выходишь{' '}
                      <span className="font-semibold bg-[#eeeee8] text-white/70 px-2 py-0.5 rounded-full">{mostFreqBefore}</span>
                      {' '}— и возвращаешься{' '}
                      <span className="font-semibold bg-[#d4e8db] text-[#1d5727] px-2 py-0.5 rounded-full">{mostFreqAfter}</span>.
                    </p>
                  </div>
                )}

                {/* Блок 3 — личный словарь */}
                {topAfterWords.length > 0 && (
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-6 py-5">
                    <p className="text-[12px] font-medium tracking-[0.08em] uppercase text-white/60 mb-3">Твои слова этого периода</p>
                    <div className="flex flex-wrap gap-2">
                      {topAfterWords.map((w) => (
                        <span key={w} className="text-[14px] font-medium px-3 py-1.5 rounded-full bg-[#d4e8db] text-[#1d5727]">
                          {w}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Блок 4 — яркие моменты */}
                {contrastEntries.length > 0 && (
                  <div>
                    <p className="text-[12px] font-medium tracking-[0.08em] uppercase text-white/60 mb-3 px-1">Запомнившиеся возвращения</p>
                    {contrastEntries.map((entry) => (
                      <div key={entry.id} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-6 py-5 mb-3">
                        <p className="text-[13px] text-white/60 tracking-[0.03em] mb-3">{formatDateShort(entry.date)}</p>
                        <div className="flex items-center flex-wrap gap-2">
                          {entry.wordsBefore.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {entry.wordsBefore.map((w) => (
                                <span key={w} className="text-[13px] font-medium px-2.5 py-1 rounded-full bg-[#eeeee8] text-white/70">{w}</span>
                              ))}
                            </div>
                          )}
                          {entry.wordsBefore.length > 0 && (
                            <span className="text-[#b0b0a8] text-[15px]">→</span>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {entry.wordsAfter.map((w) => (
                              <span key={w} className="text-[13px] font-medium px-2.5 py-1 rounded-full bg-[#d4e8db] text-[#1d5727]">{w}</span>
                            ))}
                          </div>
                        </div>
                        {entry.text && (
                          <p className="text-[15px] leading-[1.55] text-white/70 mt-3 whitespace-pre-wrap">{entry.text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button onClick={() => navigateTo('home')} className={secondaryBtn}>Назад</button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
