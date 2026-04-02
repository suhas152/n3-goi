import { vocabData } from './data.js';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  view: 'vocab',          // 'vocab' | 'flashcard' | 'test'
  chapterIdx: 0,
  partIdx: 0,
  bookmarks: new Set(JSON.parse(localStorage.getItem('bookmarks') || '[]')),
  showBookmarksOnly: false,
  searchQuery: '',
  // flashcard
  fcIndex: 0,
  fcFlipped: false,
  fcDeck: [],
  // test
  testQuestions: [],
  testCurrent: 0,
  testScore: 0,
  testAnswered: false,
  testDone: false,
};

function saveBookmarks() {
  localStorage.setItem('bookmarks', JSON.stringify([...state.bookmarks]));
}

function bookmarkKey(word) {
  return `${word.kanji}|${word.hiragana}`;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function currentChapter() { return vocabData[state.chapterIdx]; }

function currentPart() {
  const ch = currentChapter();
  return ch.parts[state.partIdx] || ch.parts[0];
}

function allChapterVocab(chapterIdx) {
  return vocabData[chapterIdx].parts.flatMap(p => p.vocabulary);
}

function allVocab() {
  return vocabData.flatMap(ch => ch.parts.flatMap(p => p.vocabulary));
}

// ── Render ─────────────────────────────────────────────────────────────────
function render() {
  renderNav();
  const app = document.getElementById('app');
  if (state.view === 'vocab') app.innerHTML = renderVocabView();
  else if (state.view === 'flashcard') app.innerHTML = renderFlashcardView();
  else if (state.view === 'test') app.innerHTML = renderTestView();
  attachEvents();
}

// NAV
function renderNav() {
  const tabs = document.getElementById('navTabs');
  tabs.innerHTML = vocabData.map((ch, i) => `
    <button class="nav-tab ${state.chapterIdx === i && state.view !== 'test' ? 'active' : ''}"
      data-chapter="${i}">Ch.${ch.chapter}</button>
  `).join('') + `
    <button class="nav-tab ${state.view === 'test' ? 'active' : ''}" data-test="1">📝 Test</button>
  `;
}

// VOCAB VIEW
function renderVocabView() {
  const ch = currentChapter();
  const part = currentPart();
  let words = part.vocabulary;

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    words = words.filter(w =>
      w.kanji.includes(q) || w.hiragana.includes(q) || w.english.toLowerCase().includes(q)
    );
  }
  if (state.showBookmarksOnly) {
    words = words.filter(w => state.bookmarks.has(bookmarkKey(w)));
  }

  return `
    <div class="chapter-header">
      <div class="chapter-title">${ch.title}</div>
      <div class="chapter-subtitle">Chapter ${ch.chapter}</div>
    </div>

    <div class="mode-tabs">
      <button class="mode-tab active" data-mode="vocab">📖 Vocabulary</button>
      <button class="mode-tab" data-mode="flashcard">🃏 Flashcards</button>
    </div>

    <div class="part-selector">
      ${ch.parts.map((p, i) => `
        <button class="part-btn ${state.partIdx === i ? 'active' : ''}" data-part="${i}">
          Part ${p.part_id}
        </button>
      `).join('')}
    </div>

    <div class="vocab-controls">
      <input class="search-input" type="text" placeholder="Search kanji, hiragana, english…"
        value="${state.searchQuery}" id="searchInput" />
      <button class="filter-btn ${state.showBookmarksOnly ? 'active' : ''}" id="bookmarkFilter">
        ⭐ Bookmarked
      </button>
    </div>

    <div class="vocab-grid">
      ${words.length ? words.map(w => {
        const key = bookmarkKey(w);
        const bm = state.bookmarks.has(key);
        return `
          <div class="vocab-card ${bm ? 'bookmarked' : ''}">
            <div class="vocab-info">
              <div class="kanji">${w.kanji}</div>
              <div class="hiragana">${w.hiragana}</div>
              <div class="english">${w.english}</div>
            </div>
            <button class="bookmark-btn ${bm ? 'active' : ''}" data-key="${key}" title="Bookmark">
              ${bm ? '⭐' : '☆'}
            </button>
          </div>
        `;
      }).join('') : '<div class="empty">No words found.</div>'}
    </div>
  `;
}

// FLASHCARD VIEW
function renderFlashcardView() {
  const ch = currentChapter();
  const deck = state.fcDeck;
  const done = state.fcIndex >= deck.length;

  return `
    <div class="chapter-header">
      <div class="chapter-title">${ch.title}</div>
      <div class="chapter-subtitle">Chapter ${ch.chapter} — Flashcards</div>
    </div>

    <div class="mode-tabs">
      <button class="mode-tab" data-mode="vocab">📖 Vocabulary</button>
      <button class="mode-tab active" data-mode="flashcard">🃏 Flashcards</button>
    </div>

    <div class="part-selector">
      ${ch.parts.map((p, i) => `
        <button class="part-btn ${state.partIdx === i ? 'active' : ''}" data-part="${i}">
          Part ${p.part_id}
        </button>
      `).join('')}
    </div>

    ${done ? `
      <div class="fc-done">
        <h2>🎉 All done!</h2>
        <p>You've gone through all ${deck.length} cards.</p>
        <div class="fc-controls">
          <button class="fc-btn shuffle" id="fcRestart">Restart</button>
          <button class="fc-btn next" id="fcShuffle">Shuffle & Restart</button>
        </div>
      </div>
    ` : `
      <div class="flashcard-area">
        <div class="fc-progress">${state.fcIndex + 1} / ${deck.length}</div>
        <div class="flashcard ${state.fcFlipped ? 'flipped' : ''}" id="flashcard">
          <div class="fc-inner">
            <div class="fc-front">
              <div class="fc-kanji">${deck[state.fcIndex].kanji}</div>
              <div class="fc-hiragana">${deck[state.fcIndex].hiragana}</div>
              <div class="fc-hint">tap to reveal</div>
            </div>
            <div class="fc-back">
              <div class="fc-english">${deck[state.fcIndex].english}</div>
              <div class="fc-kanji" style="font-size:1.5rem">${deck[state.fcIndex].kanji}</div>
            </div>
          </div>
        </div>
        <div class="fc-controls">
          <button class="fc-btn prev" id="fcPrev">← Prev</button>
          <button class="fc-btn shuffle" id="fcShuffle">🔀 Shuffle</button>
          <button class="fc-btn next" id="fcNext">Next →</button>
        </div>
      </div>
    `}
  `;
}

// TEST VIEW
function renderTestView() {
  if (state.testDone) return renderTestResult();

  const q = state.testQuestions[state.testCurrent];
  if (!q) return '<div class="empty">No questions available.</div>';

  return `
    <div class="test-area">
      <div class="test-header">
        <div class="chapter-title">📝 Vocabulary Test</div>
        <div class="test-score">Score: ${state.testScore} / ${state.testCurrent}</div>
      </div>
      <div style="color:var(--muted);font-size:0.85rem;margin-bottom:1rem;">
        Question ${state.testCurrent + 1} of ${state.testQuestions.length}
      </div>

      <div class="test-question">
        <div class="test-q-label">What is the meaning of:</div>
        <div class="test-q-kanji">${q.word.kanji}</div>
        <div class="test-q-hiragana">${q.word.hiragana}</div>

        <div class="test-options">
          ${q.options.map((opt, i) => {
            let cls = '';
            if (state.testAnswered) {
              if (opt === q.word.english) cls = 'correct';
              else if (opt === q.chosen) cls = 'wrong';
            }
            return `<button class="test-option ${cls}"
              data-opt="${i}" ${state.testAnswered ? 'disabled' : ''}>${opt}</button>`;
          }).join('')}
        </div>
      </div>

      ${state.testAnswered ? `
        <button class="test-next-btn" id="testNext">
          ${state.testCurrent + 1 < state.testQuestions.length ? 'Next →' : 'See Results'}
        </button>
      ` : ''}
    </div>
  `;
}

function renderTestResult() {
  const total = state.testQuestions.length;
  const pct = Math.round((state.testScore / total) * 100);
  return `
    <div class="test-area">
      <div class="test-result">
        <h2>Test Complete!</h2>
        <div class="score-big">${pct}%</div>
        <p>${state.testScore} correct out of ${total} questions</p>
        <button class="restart-btn" id="testRestart">Try Again</button>
      </div>
    </div>
  `;
}

// ── Test Generation ────────────────────────────────────────────────────────
function buildTest() {
  const all = allVocab();
  const shuffled = shuffle(all);
  const pool = shuffled.slice(0, Math.min(30, shuffled.length));
  const allEnglish = all.map(w => w.english);

  state.testQuestions = pool.map(word => {
    const wrong = shuffle(allEnglish.filter(e => e !== word.english)).slice(0, 3);
    const options = shuffle([word.english, ...wrong]);
    return { word, options, chosen: null };
  });
  state.testCurrent = 0;
  state.testScore = 0;
  state.testAnswered = false;
  state.testDone = false;
}

// ── Events ─────────────────────────────────────────────────────────────────
function attachEvents() {
  // Nav chapter tabs
  document.querySelectorAll('.nav-tab[data-chapter]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.chapterIdx = +btn.dataset.chapter;
      state.partIdx = 0;
      state.view = 'vocab';
      state.searchQuery = '';
      state.showBookmarksOnly = false;
      initFlashcardDeck();
      render();
    });
  });

  // Nav test tab
  document.querySelector('.nav-tab[data-test]')?.addEventListener('click', () => {
    state.view = 'test';
    buildTest();
    render();
  });

  // Mode tabs
  document.querySelectorAll('.mode-tab[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.view = btn.dataset.mode;
      if (state.view === 'flashcard') initFlashcardDeck();
      render();
    });
  });

  // Part buttons
  document.querySelectorAll('.part-btn[data-part]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.partIdx = +btn.dataset.part;
      state.fcIndex = 0;
      state.fcFlipped = false;
      if (state.view === 'flashcard') initFlashcardDeck();
      render();
    });
  });

  // Search
  document.getElementById('searchInput')?.addEventListener('input', e => {
    state.searchQuery = e.target.value;
    render();
  });

  // Bookmark filter
  document.getElementById('bookmarkFilter')?.addEventListener('click', () => {
    state.showBookmarksOnly = !state.showBookmarksOnly;
    render();
  });

  // Bookmark buttons
  document.querySelectorAll('.bookmark-btn[data-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      if (state.bookmarks.has(key)) state.bookmarks.delete(key);
      else state.bookmarks.add(key);
      saveBookmarks();
      render();
    });
  });

  // Flashcard flip
  document.getElementById('flashcard')?.addEventListener('click', () => {
    state.fcFlipped = !state.fcFlipped;
    render();
  });

  document.getElementById('fcPrev')?.addEventListener('click', () => {
    if (state.fcIndex > 0) { state.fcIndex--; state.fcFlipped = false; render(); }
  });

  document.getElementById('fcNext')?.addEventListener('click', () => {
    state.fcIndex++;
    state.fcFlipped = false;
    render();
  });

  document.getElementById('fcShuffle')?.addEventListener('click', () => {
    state.fcDeck = shuffle(state.fcDeck);
    state.fcIndex = 0;
    state.fcFlipped = false;
    render();
  });

  document.getElementById('fcRestart')?.addEventListener('click', () => {
    state.fcIndex = 0;
    state.fcFlipped = false;
    render();
  });

  // Test options
  document.querySelectorAll('.test-option[data-opt]').forEach((btn, _, all) => {
    btn.addEventListener('click', () => {
      if (state.testAnswered) return;
      const q = state.testQuestions[state.testCurrent];
      q.chosen = btn.textContent;
      state.testAnswered = true;
      if (btn.textContent === q.word.english) state.testScore++;
      render();
    });
  });

  document.getElementById('testNext')?.addEventListener('click', () => {
    state.testCurrent++;
    state.testAnswered = false;
    if (state.testCurrent >= state.testQuestions.length) state.testDone = true;
    render();
  });

  document.getElementById('testRestart')?.addEventListener('click', () => {
    buildTest();
    render();
  });
}

// ── Init ───────────────────────────────────────────────────────────────────
function initFlashcardDeck() {
  state.fcDeck = [...currentPart().vocabulary];
  state.fcIndex = 0;
  state.fcFlipped = false;
}

initFlashcardDeck();
render();
