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

type Screen = 'home' | 'record' | 'gallery';

interface Entry {
  id: string;
  date: string;
  wordsBefore: string[];
  wordsAfter: string[];
  text: string;
}

// Взвешенная частота: чем свежее использование — тем выше вес.
// Вес одного использования = 1 / (1 + дней_с_тех_пор)
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

export default function SkaviraApp() {
  const [screen, setScreen] = useState<Screen>('home');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [customWords, setCustomWords] = useState<string[]>([]);

  // Состояние экрана записи
  const [selectedBefore, setSelectedBefore] = useState<string[]>([]);
  const [selectedAfter, setSelectedAfter] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [textExpanded, setTextExpanded] = useState(false);
  const [afterError, setAfterError] = useState(false);

  // Загружаем данные из localStorage при первом рендере
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

  function toggleWord(
    word: string,
    selected: string[],
    setSelected: (w: string[]) => void
  ) {
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
    // Автоматически выбираем новое слово в нужном пикере
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

  return (
    <div className="min-h-screen bg-[#fafaf8] flex items-center justify-center">
      <main className="w-full max-w-[640px] px-6 py-12 text-center">

        {/* Главный экран */}
        {screen === 'home' && (
          <div className="screen-enter">
            <p className="text-[13px] font-medium tracking-[0.12em] uppercase text-[#8a8a80] mb-12">
              SKAVIRA Run
            </p>
            <h1 className="text-[42px] font-semibold leading-tight text-[#2a2a2a] mb-14">
              Ты сегодня бежал?
            </h1>
            <div className="flex gap-4 justify-center flex-wrap">
              <button
                onClick={() => navigateTo('record')}
                className="font-medium text-[17px] px-8 py-[14px] rounded-xl bg-[#2a7a3e] text-white border border-transparent transition-all hover:bg-[#226630] hover:-translate-y-px active:translate-y-0 active:bg-[#1d5727] cursor-pointer"
              >
                Да
              </button>
              <button
                onClick={() => navigateTo('gallery')}
                className="font-medium text-[17px] px-8 py-[14px] rounded-xl bg-transparent text-[#6a6a6a] border border-[#d4d4cc] transition-all hover:bg-[#f0f0ea] hover:text-[#2a2a2a] hover:-translate-y-px active:translate-y-0 cursor-pointer"
              >
                Ещё нет
              </button>
            </div>
            <p className="mt-16 text-[14px] text-[#8a8a80] tracking-[0.04em]">
              Возвращений:{' '}
              <span className="text-[#2a7a3e] font-semibold">{entries.length}</span>
            </p>
          </div>
        )}

        {/* Экран записи */}
        {screen === 'record' && (
          <div className="screen-enter text-left">
            <p className="text-[13px] font-medium tracking-[0.12em] uppercase text-[#8a8a80] mb-12 text-center">
              SKAVIRA Run
            </p>

            {/* Слова «до» */}
            <div className="mb-9">
              <p className="text-[12px] font-medium tracking-[0.08em] uppercase text-[#8a8a80] mb-3 flex items-center gap-2">
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

            {/* Слова «после» */}
            <div className={`mb-9 ${afterError ? 'shake' : ''}`}>
              <p className="text-[12px] font-medium tracking-[0.08em] uppercase text-[#8a8a80] mb-3">
                Каким ты вернулся
              </p>
              <WordPicker
                words={sortedWords}
                selected={selectedAfter}
                onToggle={(w) => toggleWord(w, selectedAfter, setSelectedAfter)}
                onAddCustom={(w) => addCustomWord(w, 'after')}
              />
            </div>

            {/* Опциональный текст */}
            <div className="mb-9">
              {!textExpanded ? (
                <button
                  onClick={() => setTextExpanded(true)}
                  className="text-[14px] text-[#a0a098] underline underline-offset-4 decoration-[#d4d4cc] hover:text-[#2a7a3e] hover:decoration-[#2a7a3e] transition-colors bg-transparent border-none cursor-pointer p-0"
                >
                  Написать подробнее →
                </button>
              ) : (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Несколько слов о том, каким ты стал..."
                  autoFocus
                  className="w-full min-h-[130px] text-[17px] leading-[1.55] p-[18px] border border-[#d4d4cc] rounded-xl bg-white text-[#2a2a2a] caret-[#2a7a3e] resize-y outline-none transition-colors focus:border-[#2a7a3e] placeholder:text-[#a0a098]"
                />
              )}
            </div>

            <div className="flex gap-4 justify-center flex-wrap">
              <button
                onClick={handleSave}
                className="font-medium text-[17px] px-8 py-[14px] rounded-xl bg-[#2a7a3e] text-white border border-transparent transition-all hover:bg-[#226630] hover:-translate-y-px active:translate-y-0 active:bg-[#1d5727] cursor-pointer"
              >
                Сохранить
              </button>
              <button
                onClick={() => navigateTo('home')}
                className="font-medium text-[17px] px-8 py-[14px] rounded-xl bg-transparent text-[#6a6a6a] border border-[#d4d4cc] transition-all hover:bg-[#f0f0ea] hover:text-[#2a2a2a] hover:-translate-y-px active:translate-y-0 cursor-pointer"
              >
                Назад
              </button>
            </div>
          </div>
        )}

        {/* Экран галереи */}
        {screen === 'gallery' && (
          <div className="screen-enter">
            <p className="text-[13px] font-medium tracking-[0.12em] uppercase text-[#8a8a80] mb-12">
              SKAVIRA Run
            </p>
            <h1 className="text-[42px] font-semibold leading-tight text-[#2a2a2a] mb-14">
              Все твои возвращения
            </h1>

            <div className="text-left mb-10">
              {entries.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-[22px] font-semibold text-[#6a6a6a] mb-2">
                    Пока ни одной версии
                  </p>
                  <p className="text-[15px] text-[#a0a098]">Первая — впереди.</p>
                </div>
              ) : (
                [...entries].reverse().map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-[#f8f3ea] border border-[#efe7d6] rounded-xl px-6 py-5 mb-4"
                  >
                    <p className="text-[13px] text-[#8a8a80] tracking-[0.03em] mb-3">
                      {formatDate(entry.date)}
                    </p>
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      {entry.wordsBefore.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {entry.wordsBefore.map((w) => (
                            <span
                              key={w}
                              className="text-[13px] font-medium px-2.5 py-1 rounded-full bg-[#eeeee8] text-[#6a6a6a]"
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                      )}
                      {entry.wordsBefore.length > 0 && entry.wordsAfter.length > 0 && (
                        <span className="text-[#b0b0a8] text-[15px]">→</span>
                      )}
                      {entry.wordsAfter.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {entry.wordsAfter.map((w) => (
                            <span
                              key={w}
                              className="text-[13px] font-medium px-2.5 py-1 rounded-full bg-[#d4e8db] text-[#1d5727]"
                            >
                              {w}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {entry.text && (
                      <p className="text-[15px] leading-[1.55] text-[#6a6a6a] mt-2.5 whitespace-pre-wrap">
                        {entry.text}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigateTo('home')}
                className="font-medium text-[17px] px-8 py-[14px] rounded-xl bg-transparent text-[#6a6a6a] border border-[#d4d4cc] transition-all hover:bg-[#f0f0ea] hover:text-[#2a2a2a] hover:-translate-y-px active:translate-y-0 cursor-pointer"
              >
                Назад
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
