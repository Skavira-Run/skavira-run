'use client';

import { useState } from 'react';

interface WordPickerProps {
  words: string[];
  selected: string[];
  onToggle: (word: string) => void;
  onAddCustom: (word: string) => void;
}

export default function WordPicker({ words, selected, onToggle, onAddCustom }: WordPickerProps) {
  const [addingWord, setAddingWord] = useState(false);
  const [inputValue, setInputValue] = useState('');

  function submitWord() {
    const word = inputValue.trim().toLowerCase();
    if (word) {
      onAddCustom(word);
    }
    setInputValue('');
    setAddingWord(false);
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {words.map((word) => (
        <button
          key={word}
          type="button"
          onClick={() => onToggle(word)}
          className={`text-[15px] px-4 py-2 rounded-full border transition-all whitespace-nowrap leading-none cursor-pointer ${
            selected.includes(word)
              ? 'bg-[#2a7a3e] border-[#2a7a3e] text-white hover:bg-[#226630] hover:border-[#226630]'
              : 'bg-white border-[#d4d4cc] text-[#4a4a44] hover:border-[#2a7a3e] hover:text-[#2a7a3e] hover:bg-[#f0f7f2]'
          }`}
        >
          {word}
        </button>
      ))}

      {addingWord ? (
        <span className="inline-flex items-center gap-1.5">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submitWord(); }
              if (e.key === 'Escape') { setAddingWord(false); setInputValue(''); }
            }}
            placeholder="своё слово..."
            maxLength={20}
            autoFocus
            className="text-[15px] px-3.5 py-[7px] border border-[#2a7a3e] rounded-full outline-none caret-[#2a7a3e] w-36 bg-white text-[#2a2a2a] placeholder:text-[#a0a098]"
          />
          <button
            type="button"
            onClick={submitWord}
            className="w-[34px] h-[34px] rounded-full bg-[#2a7a3e] text-white flex items-center justify-center flex-shrink-0 hover:bg-[#226630] transition-colors text-[15px] cursor-pointer"
          >
            ✓
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAddingWord(true)}
          className="text-[18px] px-3.5 py-[5px] rounded-full border border-dashed border-[#d4d4cc] text-[#a0a098] hover:border-[#2a7a3e] hover:text-[#2a7a3e] hover:bg-[#f0f7f2] transition-all leading-[1.2] cursor-pointer"
        >
          +
        </button>
      )}
    </div>
  );
}
