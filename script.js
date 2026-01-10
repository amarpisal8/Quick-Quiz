let currentIndex = 0;
let userAnswers = [];

/* Question status state: 'none' | 'attempt' | 'correct' | 'wrong' */
let statuses = [];

/* Timer state */
let timerInterval = null;
let endTimestamp = null;
const TIMER_KEY = 'quiz_end';

function renderQuestionBar() {
  const bar = document.getElementById('question-bar');
  if (!bar || !Array.isArray(quizData)) return;
  bar.innerHTML = '';

  // Ensure navigation starts from first question on initial render
  if (typeof navInitialized === 'undefined') window.navInitialized = false;
  if (!navInitialized) {
    if (typeof currentIndex !== 'undefined') currentIndex = 0;
    else window.currentIndex = 0;
  }

  quizData.forEach((q, idx) => {
    const status = statuses[idx] || 'none';
    let cls = `question-item status-${status}`;
    if (savedForLater.includes(idx)) cls += ' status-saved';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = cls;
    if (idx === currentIndex) btn.classList.add('active');
    btn.textContent = idx + 1;
    btn.setAttribute('aria-label', `Question ${idx + 1}, status ${status}`);

    // Add a small indicator for 'saved for later'
    if (savedForLater.includes(idx)) {
      const star = document.createElement('span');
      star.className = 'saved-indicator';
      star.style.marginLeft = '6px';
      star.style.fontSize = '0.7rem';
      star.textContent = '★';
      btn.appendChild(star);
    }

    btn.addEventListener('click', () => {
      currentIndex = idx;
      // hide next button when navigating to an unanswered question
      document.getElementById('nextBtn').classList.add('d-none');
      loadQuestion();
      renderQuestionBar();
      renderDashboard();
    });
    bar.appendChild(btn);
  });

  // After rendering, ensure correct item is visible. On initial render, show the first question explicitly.
  requestAnimationFrame(() => {
    const active = bar.querySelector('.question-item.active');
    if (!navInitialized) {
      // show the first question at the start and focus it for accessibility
      try {
        bar.scrollTo({ left: 0, behavior: 'smooth' });
        const first = bar.querySelector('.question-item:first-child');
        if (first) {
          first.focus({ preventScroll: true });
          first.setAttribute('aria-current', 'true');
        }
      } catch (e) { bar.scrollLeft = 0; }
      navInitialized = true;
    } else if (active) {
      // ensure the active question is scrolled into view
      try { active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); } catch (e) { /* fallback */ }
      // manage aria-current for non-initial navigations
      bar.querySelectorAll('.question-item').forEach(btn => btn.removeAttribute('aria-current'));
      active && active.setAttribute('aria-current', 'true');
    }
  });
}

/* Saved-for-later state */
let savedForLater = [];

function toggleSaveForLater(idx) {
  const i = savedForLater.indexOf(idx);
  const adding = i === -1;
  if (adding) savedForLater.push(idx);
  else savedForLater.splice(i, 1);
  localStorage.setItem('saved_for_later', JSON.stringify(savedForLater));
  renderDashboard();
  renderQuestionBar();

  const saveBtnEl = document.getElementById('saveLater');
  if (saveBtnEl) saveBtnEl.setAttribute('aria-pressed', adding ? 'true' : 'false');

  // Provide a quick visual confirmation on the button
  if (adding && saveBtnEl) {
    const old = saveBtnEl.textContent;
    saveBtnEl.textContent = 'Saved';
    setTimeout(() => {
      // restore label for current question if not saved
      saveBtnEl.textContent = savedForLater.includes(currentIndex) ? 'Saved' : 'See you later';
    }, 900);
  }

  // If the user just saved this question, automatically move to the next one (if any)
  if (adding) {
    if (currentIndex < quizData.length - 1) {
      currentIndex++;
      loadQuestion();
      renderQuestionBar();
      renderDashboard();
    }
  }
}

function renderDashboard() {
  const total = quizData.length;
  const correct = statuses.filter(s => s === 'correct').length;
  const wrong = statuses.filter(s => s === 'wrong').length;
  const unsolved = statuses.filter(s => s === 'none' || s === 'attempt').length;
  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);

  const dashTotal = document.getElementById('dash-total');
  const dashCorrect = document.getElementById('dash-correct');
  const dashWrong = document.getElementById('dash-wrong');
  const dashUnsolved = document.getElementById('dash-unsolved');
  const dashPercent = document.getElementById('dashboard-percent');
  const savedCount = document.getElementById('saved-count');
  const savedList = document.getElementById('saved-list');

  if (dashTotal) dashTotal.innerText = total;
  if (dashCorrect) dashCorrect.innerText = correct;
  if (dashWrong) dashWrong.innerText = wrong;
  if (dashUnsolved) dashUnsolved.innerText = unsolved;
  if (dashPercent) dashPercent.innerText = percent + '%';

  // Keep the floating badge in sync so it shows live progress even when the dashboard is closed
  const resultBadge = document.getElementById('result-badge');
  if (resultBadge) resultBadge.innerText = percent + '%';

  if (savedCount) savedCount.innerText = savedForLater.length;
  if (savedList) {
    savedList.innerHTML = '';
    savedForLater.forEach(i => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'saved-item';
      btn.textContent = 'Q' + (i + 1);
      btn.addEventListener('click', () => {
        currentIndex = i;
        loadQuestion();
        renderQuestionBar();
      });
      savedList.appendChild(btn);
    });
  }
}

function initDashboardToggle() {
  const dashToggle = document.getElementById('dashboard-toggle');
  const dash = document.getElementById('result-dashboard');
  const resultIcon = document.getElementById('result-icon');
  const dashExit = document.getElementById('dashboard-exit');
  if (!dash || !resultIcon) return;

  // hide dashboard initially
  dash.classList.remove('open');
  dash.setAttribute('aria-hidden', 'true');
  resultIcon.setAttribute('aria-expanded', 'false');

  // helper to toggle the dashboard
  function toggleResultPanel() {
    const open = dash.classList.toggle('open');
    resultIcon.setAttribute('aria-expanded', open ? 'true' : 'false');
    dash.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) renderDashboard();
  }

  // pointerup handles touch/pen devices quickly and prevents click duplication
  resultIcon.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      window._lastTouch = Date.now();
      toggleResultPanel();
      e.preventDefault();
    }
  });

  // click handles mouse/keyboard interactions; ignore if a recent touch occurred
  resultIcon.addEventListener('click', (e) => {
    const now = Date.now();
    if (window._lastTouch && (now - window._lastTouch) < 700) return;
    toggleResultPanel();
  });

  // If there's an existing dashboard toggle (for small screens), wire it to the same behavior
  if (dashToggle) {
    dashToggle.addEventListener('click', () => {
      const open = dash.classList.toggle('open');
      dashToggle.textContent = open ? 'Hide' : 'Saved';
      dashToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      resultIcon.setAttribute('aria-expanded', open ? 'true' : 'false');
      dash.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (open) renderDashboard();
    });
  }

  // Exit button inside dashboard just closes the panel and returns to the test
  if (dashExit) {
    dashExit.addEventListener('click', () => {
      dash.classList.remove('open');
      dash.setAttribute('aria-hidden', 'true');
      resultIcon.setAttribute('aria-expanded', 'false');
    });
  }
}

// Auto-hide header on scroll (fade/slide when scrolling down, reveal on scroll up)
function initAutoHideHeader() {
  const header = document.querySelector('.app-header');
  if (!header) return;
  let lastY = window.scrollY || window.pageYOffset;
  let ticking = false;
  const threshold = 8; // ignore tiny scrolls

  function onScroll() {
    const y = window.scrollY || window.pageYOffset;
    if (Math.abs(y - lastY) < threshold) { ticking = false; return; }
    if (y > lastY && y > 60) {
      header.classList.add('hidden');
    } else {
      header.classList.remove('hidden');
    }
    lastY = y;
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });

  // Ensure header reappears on resize or orientation change
  window.addEventListener('resize', () => header.classList.remove('hidden'));
}

// Ensure dashboard updates when statuses change
function notifyStatusChange() {
  renderDashboard();
}

/* Sync mobile action buttons with desktop controls */
function syncMobileControls() {
  const nextDesktop = document.getElementById('nextBtn');
  const mobileNext = document.getElementById('mobileNext');
  const mobileSubmit = document.getElementById('mobileSubmit');
  if (nextDesktop && mobileNext) {
    if (nextDesktop.classList.contains('d-none')) mobileNext.classList.add('d-none');
    else mobileNext.classList.remove('d-none');
  }
  const selected = document.querySelector('input[name="option"]:checked');
  if (mobileSubmit) {
    if (selected) mobileSubmit.removeAttribute('disabled');
    else mobileSubmit.setAttribute('disabled', 'true');
  }
}

function formatTime(totalSec) {
  const mm = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const ss = (totalSec % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function startTimer(totalSeconds) {
  const existing = localStorage.getItem(TIMER_KEY);
  if (existing) {
    endTimestamp = parseInt(existing, 10);
  } else {
    endTimestamp = Date.now() + totalSeconds * 1000;
    localStorage.setItem(TIMER_KEY, endTimestamp);
  }

  updateTimer();
  timerInterval = setInterval(updateTimer, 500);
}

function updateTimer() {
  if (!endTimestamp) return;
  const remaining = Math.max(0, Math.round((endTimestamp - Date.now()) / 1000));
  const timerEl = document.getElementById('timer');
  if (timerEl) timerEl.innerText = 'Time: ' + formatTime(remaining);

  if (remaining <= 0) {
    stopTimer();
    // Auto submit
    alert("Time's up! Auto submitting the quiz.");
    finalSubmit();
  } else if (remaining <= 30) {
    timerEl.classList.add('warning');
  } else {
    timerEl.classList.remove('warning');
  }
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  localStorage.removeItem(TIMER_KEY);
}

function loadQuestion() {
  const q = quizData[currentIndex];
  document.getElementById("question").innerText = q.question;

  let optionsHTML = "";
  q.options.forEach((opt, index) => {
    optionsHTML += `
      <label class="option">
        <input type="radio" name="option" value="${index}">
        <span class="option-text">${opt}</span>
      </label>
    `;
  });

  document.getElementById("options").innerHTML = optionsHTML;
  document.getElementById("result").innerText = "";

  // Update progress indicators
  const qIndexEl = document.getElementById('q-index');
  if (qIndexEl) qIndexEl.innerText = currentIndex + 1;
  const qTotalEl = document.getElementById('q-total');
  if (qTotalEl) qTotalEl.innerText = quizData.length;

  // Pre-select previously answered option if present
  const prev = userAnswers[currentIndex];
  if (typeof prev === 'number') {
    const toSelect = document.querySelector(`input[name="option"][value="${prev}"]`);
    if (toSelect) toSelect.checked = true;
  }

  // Reflect previous result if evaluated
  const status = statuses[currentIndex];
  if (status === 'correct') {
    document.getElementById("result").innerHTML = "<span class='correct'>Correct Answer</span>";
    document.getElementById("nextBtn").classList.remove("d-none");
  } else if (status === 'wrong') {
    const correctIndex = quizData[currentIndex].correctAnswer;
    document.getElementById("result").innerHTML = `<span class='wrong'>Wrong Answer</span><br>Correct: ${quizData[currentIndex].options[correctIndex]}`;
    document.getElementById("nextBtn").classList.remove("d-none");
    if (currentIndex === quizData.length - 1) document.getElementById("finalSubmit").classList.remove("d-none");
  } else {
    document.getElementById("nextBtn").classList.add("d-none");
    if (currentIndex === quizData.length - 1) document.getElementById("finalSubmit").classList.add("d-none");
  }

  // Attach change listener to mark attempted before submission
  document.querySelectorAll('input[name="option"]').forEach(i => {
    i.addEventListener('change', () => {
      if (statuses[currentIndex] === 'none') statuses[currentIndex] = 'attempt';
      renderQuestionBar();
      renderDashboard();
      syncMobileControls();
    });
  });

  // When an option label (or its children) is clicked, select that option's input
  const optionsContainer = document.getElementById('options');
  if (optionsContainer && !optionsContainer.dataset.autoSelectAttached) {
    optionsContainer.addEventListener('click', (e) => {
      const label = e.target.closest('.option');
      if (!label || !optionsContainer.contains(label)) return;
      const input = label.querySelector('input[name="option"]');
      if (!input) return;
      // If not already selected, select it and trigger change so UI updates
      if (!input.checked) {
        input.checked = true;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      syncMobileControls();
    });
    // mark as attached to avoid duplicate listeners on reload
    optionsContainer.dataset.autoSelectAttached = 'true';
  }

  renderQuestionBar();
  syncMobileControls();
} 

function submitAnswer() {
  const selected = document.querySelector('input[name="option"]:checked');
  if (!selected) return alert("Select an option");

  const answer = parseInt(selected.value);
  // store answer by index
  userAnswers[currentIndex] = answer;

  const correct = quizData[currentIndex].correctAnswer;

  if (answer === correct) {
    statuses[currentIndex] = 'correct';
    document.getElementById("result").innerHTML = "<span class='correct'>Correct Answer</span>";
  } else {
    statuses[currentIndex] = 'wrong';
    document.getElementById("result").innerHTML = `<span class='wrong'>Wrong Answer</span><br>Correct: ${quizData[currentIndex].options[correct]}`;
  }

  renderQuestionBar();
  renderDashboard();

  document.getElementById("nextBtn").classList.remove("d-none");

  if (currentIndex === quizData.length - 1)
    document.getElementById("finalSubmit").classList.remove("d-none");

  syncMobileControls();
}

function nextQuestion() {
  currentIndex++;
  document.getElementById("nextBtn").classList.add("d-none");
  if (currentIndex >= quizData.length) {
    finalSubmit();
    return;
  }
  loadQuestion();
  syncMobileControls();
}

function finalSubmit() {
  stopTimer();
  generatePDF();
}

/* Restart current test: clears progress, saved-for-later, and restarts timer */
function resetTest() {
  if (!confirm('Restart test? This will clear your progress.')) return;
  if (!Array.isArray(quizData) || quizData.length === 0) return;

  stopTimer();

  // reset internal state
  currentIndex = 0;
  statuses = new Array(quizData.length).fill('none');
  userAnswers = new Array(quizData.length).fill(null);
  savedForLater = [];
  localStorage.removeItem('saved_for_later');

  // restart timer for the test length
  const totalSeconds = quizData.length * 100;
  startTimer(totalSeconds);

  // re-render UI
  loadQuestion();
  renderQuestionBar();
  renderDashboard();

  // update save button if present
  const saveBtnEl = document.getElementById('saveLater');
  if (saveBtnEl) {
    saveBtnEl.setAttribute('aria-pressed', 'false');
    saveBtnEl.textContent = 'See you later';
  }

  const finalEl = document.getElementById('finalSubmit');
  if (finalEl) finalEl.classList.add('d-none');
  const nextBtn = document.getElementById('nextBtn');
  if (nextBtn) nextBtn.classList.add('d-none');

  alert('Test restarted.');
}

function generatePDF() {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  quizData.forEach((q, i) => {
    pdf.text(`${i + 1}. ${q.question}`, 10, 10 + i * 20);
    pdf.text(`Correct Answer: ${q.options[q.correctAnswer]}`, 10, 16 + i * 20);
  });

  pdf.save("Quiz_Result.pdf");
}

/* Theme toggling and persistence */
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  updateToggleIcon();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  setTheme(current === 'dark' ? 'light' : 'dark');
}

function updateToggleIcon() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const icon = btn.querySelector('i');
  if (document.documentElement.getAttribute('data-theme') === 'dark') {
    icon.className = 'fa fa-sun';
    btn.setAttribute('aria-label', 'Switch to light theme');
  } else {
    icon.className = 'fa fa-moon';
    btn.setAttribute('aria-label', 'Switch to dark theme');
  }
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  updateToggleIcon();
}

// Init
document.addEventListener('DOMContentLoaded', function () {
  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.addEventListener('click', toggleTheme);
  initTheme();

  // Prepare statuses and answers, start timer based on number of questions (100 seconds per question)
  if (Array.isArray(quizData) && quizData.length > 0) {
    statuses = new Array(quizData.length).fill('none');
    userAnswers = new Array(quizData.length).fill(null);

    // Load saved-for-later from localStorage if present
    savedForLater = JSON.parse(localStorage.getItem('saved_for_later') || '[]');

    const totalSeconds = quizData.length * 100;
    startTimer(totalSeconds);

    renderQuestionBar();
    renderDashboard();

    // Hook save button (single handler)
    const saveBtn = document.getElementById('saveLater');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => toggleSaveForLater(currentIndex));
      // reflect saved state in aria-pressed and label
      const pressed = savedForLater.includes(currentIndex);
      saveBtn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      saveBtn.textContent = pressed ? 'Saved' : 'See you later';
    }

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetTest);
    }

    // Explanation bulb (Marathi) behaviour
    const expToggle = document.getElementById('exp-toggle');
    const expPanel = document.getElementById('exp-panel');
    if (expToggle) {
      expToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        // toggle visibility
        const isHidden = expPanel && expPanel.hasAttribute('hidden');
        if (isHidden) {
          const q = quizData[currentIndex];
          const text = q && q.exp && q.exp.trim().length ? q.exp : 'स्पष्टीकरण उपलब्ध नाही';
          if (expPanel) {
            expPanel.textContent = text;
            expPanel.removeAttribute('hidden');
            expPanel.setAttribute('lang', 'mr');
            expPanel.focus && expPanel.focus();
          }
          expToggle.setAttribute('aria-expanded', 'true');
          // stop blinking while open
          expToggle.classList.remove('blink');
        } else {
          if (expPanel) expPanel.setAttribute('hidden', '');
          expToggle.setAttribute('aria-expanded', 'false');
          if (quizData[currentIndex] && quizData[currentIndex].exp) expToggle.classList.add('blink');
        }
      });

      // Close explanation when clicking outside
      document.addEventListener('click', (e) => {
        if (expPanel && !expPanel.hasAttribute('hidden')) {
          if (!expPanel.contains(e.target) && e.target !== expToggle && !expToggle.contains(e.target)) {
            expPanel.setAttribute('hidden', '');
            expToggle.setAttribute('aria-expanded', 'false');
            if (quizData[currentIndex] && quizData[currentIndex].exp) expToggle.classList.add('blink');
          }
        }
      });
    }

    // Initialize dashboard toggle behaviour
    initDashboardToggle();
    // Initialize auto-hide header behaviour
    initAutoHideHeader();
  }
});

loadQuestion();
