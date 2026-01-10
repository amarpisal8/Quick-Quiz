// storage.js — lightweight IndexedDB wrapper for Quiz saving
// Exposes: TestStorage.init(), .saveTest(), .getTestByHash(), .saveAttempt(), .getLastAttempt(), .isTestSaved()

const TestStorage = (function () {
  const DB_NAME = 'quick-quiz-db';
  const DB_VERSION = 1;
  const TEST_STORE = 'tests';
  const ATTEMPT_STORE = 'attempts';

  // open DB and create object stores if needed
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(TEST_STORE)) {
          const s = db.createObjectStore(TEST_STORE, { keyPath: 'id' });
          s.createIndex('contentHash', 'contentHash', { unique: false });
        }
        if (!db.objectStoreNames.contains(ATTEMPT_STORE)) {
          const a = db.createObjectStore(ATTEMPT_STORE, { keyPath: 'id' });
          a.createIndex('testId', 'testId', { unique: false });
          a.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function runTx(storeNames, mode, callback) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, mode);
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(tx.error || new Error('Transaction failed'));
      try {
        callback(tx);
      } catch (err) {
        reject(err);
      }
    });
  }

  async function getAll(store) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([store], 'readonly');
      const s = tx.objectStore(store);
      const req = s.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // create SHA-1 hash of JSON content for deterministic test ID
  async function sha1Hex(str) {
    if (!str) return '';
    try {
      if (crypto && crypto.subtle && crypto.subtle.digest) {
        const enc = new TextEncoder();
        const buf = enc.encode(str);
        const hashBuf = await crypto.subtle.digest('SHA-1', buf);
        const hashArray = Array.from(new Uint8Array(hashBuf));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) {
      console.warn('crypto.subtle.sha1 failed, falling back to simple hash', e);
    }
    // fallback simple hash (not cryptographic) — deterministic across sessions
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
    return (h >>> 0).toString(16);
  }

  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    // fallback simple UUID
    return 'id-' + Date.now() + '-' + Math.floor(Math.random() * 1e9);
  }

  async function findTestByHash(hash) {
    if (!hash) return null;
    const all = await getAll(TEST_STORE);
    return all.find(t => t.contentHash === hash) || null;
  }

  async function saveTest(testObj) {
    // testObj must contain { title, questions }
    if (!testObj || !Array.isArray(testObj.questions) || testObj.questions.length === 0)
      throw new Error('Invalid test payload');

    const payload = JSON.stringify(testObj.questions);
    const contentHash = await sha1Hex(payload);

    // duplicate protection: check by hash
    const existing = await findTestByHash(contentHash);
    if (existing) return { saved: false, reason: 'duplicate', test: existing };

    const test = {
      id: 'test-' + contentHash.slice(0, 12),
      title: testObj.title || 'Quiz',
      createdAt: new Date().toISOString(),
      contentHash,
      version: testObj.version || 1,
      meta: {
        totalQuestions: testObj.questions.length,
      },
      questions: testObj.questions, // ALWAYS store questions so they remain immutable
    };

    await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction([TEST_STORE], 'readwrite');
        const s = tx.objectStore(TEST_STORE);
        const op = s.add(test);
        op.onsuccess = () => resolve(test);
        op.onerror = () => reject(op.error || new Error('Failed to save test'));
      };
      req.onerror = () => reject(req.error);
    });

    return { saved: true, test };
  }

  async function saveAttempt(testId, attempt) {
    if (!testId) throw new Error('testId required');
    const a = {
      id: attempt.id || uuid(),
      testId,
      timestamp: attempt.timestamp || new Date().toISOString(),
      score: attempt.score || 0,
      total: attempt.total || 0,
      percentage: attempt.percentage || 0,
      pass: !!attempt.pass,
      details: attempt.details || {},
    };

    await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction([ATTEMPT_STORE], 'readwrite');
        const s = tx.objectStore(ATTEMPT_STORE);
        const op = s.add(a);
        op.onsuccess = () => resolve(a);
        op.onerror = () => reject(op.error || new Error('Failed to save attempt'));
      };
      req.onerror = () => reject(req.error);
    });

    return a;
  }

  async function getAttemptsForTest(testId) {
    if (!testId) return [];
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([ATTEMPT_STORE], 'readonly');
      const s = tx.objectStore(ATTEMPT_STORE);
      const idx = s.index('testId');
      const req = idx.getAll(IDBKeyRange.only(testId));
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function getLastAttempt(testId) {
    const arr = await getAttemptsForTest(testId);
    if (!arr || arr.length === 0) return null;
    arr.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return arr[0];
  }

  async function isTestSavedByHash(questions) {
    const payload = JSON.stringify(questions);
    const contentHash = await sha1Hex(payload);
    const ex = await findTestByHash(contentHash);
    return ex || null;
  }

  // utilities for UI integration
  function friendlyAttemptSummary(attempt) {
    if (!attempt) return '';
    const d = new Date(attempt.timestamp);
    const dt = d.toLocaleString();
    const res = `${dt} — ${attempt.score}/${attempt.total} (${attempt.percentage}%) — ${attempt.pass ? 'Passed' : 'Failed'}`;
    return res;
  }

  // init: attach handlers and wrap finalSubmit to record attempts
  async function init(opts = {}) {
    // Add click handler for Save Test button
    document.addEventListener('DOMContentLoaded', async () => {
      const btn = document.getElementById('saveTestBtn');
      const lastEl = document.getElementById('last-attempt');

      // graceful fallback if IndexedDB is not available
      if (!('indexedDB' in window)) {
        if (btn) {
          btn.disabled = true;
          btn.title = 'Save Test unavailable (IndexedDB not supported)';
        }
        if (lastEl) {
          lastEl.textContent = 'Persistent save unavailable on this browser.';
        }
        console.warn('IndexedDB not available; Save Test disabled.');
        return;
      }

      async function updateUIForSavedTest(test) {
        if (!btn) return;
        if (test) {
          btn.textContent = 'Saved';
          btn.disabled = true;
          btn.setAttribute('aria-pressed', 'true');
          // show last attempt
          const la = await getLastAttempt(test.id);
          if (la && lastEl) lastEl.textContent = 'Last attempt: ' + friendlyAttemptSummary(la);
          else if (lastEl) lastEl.textContent = 'No attempts yet';
        } else {
          btn.textContent = 'Save Test';
          btn.disabled = false;
          btn.setAttribute('aria-pressed', 'false');
          if (lastEl) lastEl.textContent = '';
        }
      }

      // On click, attempt to save test
      if (btn) {
        btn.addEventListener('click', async (e) => {
          try {
            // Build test object from global quizData
            const testObj = { title: document.querySelector('.app-title')?.textContent || 'Quiz', questions: quizData };
            const res = await saveTest(testObj);
            if (!res.saved && res.reason === 'duplicate') {
              alert('This test has already been saved.');
              await updateUIForSavedTest(res.test);
              return;
            }
            if (res.saved) {
              alert('Test saved successfully');
              await updateUIForSavedTest(res.test);
            }
          } catch (err) {
            console.error('Save test failed', err);
            alert('Unable to save test. See console for details.');
          }
        });
      }

      // On load, check if test is already saved and update UI
      try {
        const maybe = await isTestSavedByHash(quizData);
        await updateUIForSavedTest(maybe);
      } catch (err) {
        console.warn('Failed to check saved tests', err);
      }

      // Wrap finalSubmit to record an attempt for saved tests (do not modify its internals)
      if (typeof window !== 'undefined' && window.finalSubmit) {
        const orig = window.finalSubmit.bind(window);
        window.finalSubmit = function () {
          // call original first so UI and other behavior stays the same
          try {
            orig();
          } catch (e) {
            // if original throws, still try to record attempt
            console.error('Original finalSubmit threw', e);
          }

          // now asynchronously record attempt if test is saved
          (async () => {
            try {
              const maybeTest = await isTestSavedByHash(quizData);
              if (!maybeTest) return; // no saved test

              // compute result summary from quiz state
              const total = quizData.length;
              let score = 0;
              for (let i = 0; i < total; i++) {
                const ans = userAnswers[i];
                if (typeof ans === 'number' && ans === quizData[i].correctAnswer) score++;
              }
              const percentage = Math.round((score / total) * 100);
              const pass = percentage >= (opts.passPercentage || 50);

              await saveAttempt(maybeTest.id, {
                score,
                total,
                percentage,
                pass,
                details: {
                  answers: userAnswers,
                  statuses: statuses,
                },
              });

              // update last attempt UI
              const last = await getLastAttempt(maybeTest.id);
              if (last && lastEl) lastEl.textContent = 'Last attempt: ' + friendlyAttemptSummary(last);

            } catch (err) {
              console.error('Failed to record attempt', err);
            }
          })();
        };
      }
    });
  }

  // Fetch a test record by its DB id (test.id)
  async function getTestById(testId) {
    if (!testId) return null;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([TEST_STORE], 'readonly');
      const s = tx.objectStore(TEST_STORE);
      const req = s.get(testId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    }).catch(err => {
      console.error('getTestById failed', err);
      return null;
    });
  }

  /**
   * getSavedTest(testId)
   * - Returns: { test, questions, lastAttempt } or null if not found
   * - Shows a user-friendly alert if not found
   */
  async function getSavedTest(testId) {
    if (!testId) {
      alert('Invalid test id.');
      return null;
    }
    const test = await getTestById(testId);
    if (!test) {
      alert('Saved test not found.');
      return null;
    }
    const lastAttempt = await getLastAttempt(test.id);
    return { test, questions: test.questions, lastAttempt };
  }

  /**
   * loadTestById(testId, options = { resetProgress: true })
   * - Loads saved test questions into the running app (read-only on DB)
   * - Does not mutate DB test data. Questions are deep-cloned before assignment.
   * - Resets app progress (statuses, userAnswers, currentIndex) when resetProgress is true
   */
  async function loadTestById(testId, options = { resetProgress: true }) {
    const info = await getSavedTest(testId);
    if (!info) return null;
    // Defensive: ensure quiz globals exist
    if (typeof window === 'undefined' || !Array.isArray(info.questions)) {
      console.warn('Environment unsuitable to load test into app.');
      return null;
    }

    // Deep clone questions so in-memory operations cannot mutate DB record
    const cloned = JSON.parse(JSON.stringify(info.questions));

    // Apply to global quizData (mutate existing array if present so bindings used by app update)
    try {
      // If a timer is running, stop it before changing quiz data
      if (typeof stopTimer === 'function') stopTimer();

      // Prefer mutating existing `quizData` array (declared as const in qus.js) so references remain valid
      if (typeof quizData !== 'undefined' && Array.isArray(quizData)) {
        // clear and push cloned items
        quizData.splice(0, quizData.length, ...cloned);
      } else if (window.quizData && Array.isArray(window.quizData)) {
        window.quizData.splice(0, window.quizData.length, ...cloned);
      } else {
        // fallback: set on window so other helpers can access it
        window.quizData = cloned;
      }

      // Always start navigation from the first question when loading a test
      if (typeof currentIndex !== 'undefined') currentIndex = 0;
      else window.currentIndex = 0;

      // Reset statuses and answers only when requested, otherwise ensure arrays fit the new data length
      if (options.resetProgress) {
        if (typeof statuses !== 'undefined') statuses = new Array(cloned.length).fill('none');
        else window.statuses = new Array(cloned.length).fill('none');

        if (typeof userAnswers !== 'undefined') userAnswers = new Array(cloned.length).fill(null);
        else window.userAnswers = new Array(cloned.length).fill(null);
      } else {
        if (typeof statuses !== 'undefined') {
          statuses.length = cloned.length;
        } else window.statuses = new Array(cloned.length).fill('none');

        if (typeof userAnswers !== 'undefined') {
          userAnswers.length = cloned.length;
        } else window.userAnswers = new Array(cloned.length).fill(null);
      }

      // Reinitialize UI components to reflect new quizData
      if (typeof renderQuestionBar === 'function') renderQuestionBar();
      if (typeof renderDashboard === 'function') renderDashboard();
      if (typeof loadQuestion === 'function') loadQuestion();

      // Restart timer similar to app init
      if (typeof startTimer === 'function') {
        const totalSeconds = cloned.length * 100;
        startTimer(totalSeconds);
      }

      // Update last attempt UI area if present
      const lastEl = document.getElementById('last-attempt');
      if (lastEl) {
        if (info.lastAttempt) lastEl.textContent = 'Last attempt: ' + friendlyAttemptSummary(info.lastAttempt);
        else lastEl.textContent = 'No attempts yet';
      }

      return info;
    } catch (err) {
      console.error('Failed to load saved test into app', err);
      alert('Unable to load saved test. See console for details.');
      return null;
    }
  }

  async function getAllTests() {
    // returns array of tests or empty array
    try {
      return await getAll(TEST_STORE);
    } catch (e) {
      console.error('getAllTests failed', e);
      return [];
    }
  }

  return {
    init,
    saveTest,
    saveAttempt,
    getLastAttempt,
    isTestSavedByHash,
    findTestByHash,
    // new read-only APIs for fetching and loading saved tests
    getTestById,
    getSavedTest,
    loadTestById,
    getAllTests,
    // expose attempts retrieval for UI
    getAttemptsForTest,
  };
})();

// initialize with defaults
TestStorage.init({ passPercentage: 50 });

// initialize with defaults
TestStorage.init({ passPercentage: 50 });
