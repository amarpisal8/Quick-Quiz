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
}

/* Saved-for-later state */
let savedForLater = [];

function toggleSaveForLater(idx) {
  const i = savedForLater.indexOf(idx);
  const adding = (i === -1);
  if (adding) savedForLater.push(idx);
  else savedForLater.splice(i, 1);
  localStorage.setItem('saved_for_later', JSON.stringify(savedForLater));
  renderDashboard();
  renderQuestionBar();

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

// Hook save button
const saveBtn = document.getElementById('saveLater');
if (saveBtn) saveBtn.addEventListener('click', () => toggleSaveForLater(currentIndex));

// Dashboard toggle for small screens
const dashToggle = document.getElementById('dashboard-toggle');
if (dashToggle) {
  dashToggle.addEventListener('click', () => {
    const dash = document.getElementById('result-dashboard');
    if (!dash) return;
    const open = dash.classList.toggle('open');
    dashToggle.textContent = open ? 'Hide' : 'Show';
    dashToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

// Ensure dashboard updates when statuses change
function notifyStatusChange() {
  renderDashboard();
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
    });
  });

  renderQuestionBar();
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
}

function nextQuestion() {
  currentIndex++;
  document.getElementById("nextBtn").classList.add("d-none");
  if (currentIndex >= quizData.length) {
    finalSubmit();
    return;
  }
  loadQuestion();
}

function finalSubmit() {
  stopTimer();
  generatePDF();
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

    // Hook save button
    const saveBtn = document.getElementById('saveLater');
    if (saveBtn) saveBtn.addEventListener('click', () => {
      toggleSaveForLater(currentIndex);
      localStorage.setItem('saved_for_later', JSON.stringify(savedForLater));
    });

    // Dashboard toggle for small screens
    const dashToggle = document.getElementById('dashboard-toggle');
    if (dashToggle) {
      dashToggle.addEventListener('click', () => {
        const dash = document.getElementById('result-dashboard');
        if (!dash) return;
        const open = dash.classList.toggle('open');
        dashToggle.textContent = open ? 'Hide' : 'Show';
        dashToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }
  }
});

loadQuestion();
