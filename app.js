/**
 * Pedagog.umamatov.uz — Pedagoglar Test Tizimi
 * JavaScript Application Logic
 */

// Global State
const state = {
  allQuestions: [],
  activeQuestions: [],
  currentIndex: 0,
  userAnswers: {}, // index -> 'A' | 'B' | 'C' | 'D'
  teacherInfo: {
    name: '',
    school: '',
    subject: '',
    grades: []
  },
  timeLimitMinutes: 30,
  secondsRemaining: 0,
  timerInterval: null,
  startTime: null,
  endTime: null
};

// DOM Elements
const views = {
  setup: document.getElementById('setupView'),
  exam: document.getElementById('examView'),
  result: document.getElementById('resultView')
};

function switchView(viewName) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  if (views[viewName]) {
    views[viewName].classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupGradePillEvents();
  setupSubjectGradeHints();
  await loadQuestionsDatabase();

  document.getElementById('startTestBtn').addEventListener('click', handleStartTest);
  document.getElementById('prevQBtn').addEventListener('click', () => navigateQuestion(-1));
  document.getElementById('nextQBtn').addEventListener('click', () => navigateQuestion(1));
  document.getElementById('finishTestBtn').addEventListener('click', openFinishModal);
  document.getElementById('modalCancelBtn').addEventListener('click', closeFinishModal);
  document.getElementById('modalConfirmBtn').addEventListener('click', () => {
    closeFinishModal();
    finishExam();
  });
  document.getElementById('restartBtn').addEventListener('click', handleRestart);
});

// Load Questions (from questions.json or fallback)
async function loadQuestionsDatabase() {
  try {
    const res = await fetch('questions.json');
    if (res.ok) {
      state.allQuestions = await res.json();
      console.log(`Yuklangan savollar soni: ${state.allQuestions.length}`);
      return;
    }
  } catch (err) {
    console.warn("fetch('questions.json') ishlamadi (ehtimol local file://), ichki bazadan yuklanmoqda.");
  }

  // If fetch failed (e.g. running from file://), load minimal fallback
  state.allQuestions = [
    {
      "id": "demo-1",
      "subject": "Ona tili",
      "grade": 5,
      "topic": "Fonetika",
      "question": "O'zbek tilida nechta unli tovush bor?",
      "options": { "A": "6 ta", "B": "8 ta", "C": "10 ta", "D": "4 ta" },
      "answer": "A",
      "explanation": "5-sinf Ona tili: O'zbek tilida 6 ta unli tovush mavjud."
    },
    {
      "id": "demo-2",
      "subject": "Matematika",
      "grade": 5,
      "topic": "Kasrlar",
      "question": "1/2 qismi 15 ga teng bo'lgan sonni toping.",
      "options": { "A": "25", "B": "30", "C": "45", "D": "20" },
      "answer": "B",
      "explanation": "5-sinf Matematika: 15 * 2 = 30."
    }
  ];
}

// Grade Selection Pills (Multi-Select)
function setupGradePillEvents() {
  const pills = document.querySelectorAll('.grade-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      const checkbox = pill.querySelector('input');
      checkbox.checked = !checkbox.checked;
      pill.classList.toggle('selected', checkbox.checked);
    });
  });

  document.getElementById('selectAllGrades').addEventListener('click', () => {
    pills.forEach(pill => {
      const cb = pill.querySelector('input');
      cb.checked = true;
      pill.classList.add('selected');
    });
  });

  document.getElementById('clearGrades').addEventListener('click', () => {
    pills.forEach(pill => {
      const cb = pill.querySelector('input');
      cb.checked = false;
      pill.classList.remove('selected');
    });
  });
}

// Auto-filter/hint grades when subject changes
function setupSubjectGradeHints() {
  const subjectSelect = document.getElementById('subjectSelect');
  subjectSelect.addEventListener('change', () => {
    const val = subjectSelect.value;
    const pills = document.querySelectorAll('.grade-pill');
    
    // Suggest standard grade ranges for subjects
    let suggested = [];
    if (val === 'Ona tili' || val === 'Matematika' || val === 'English') {
      suggested = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    } else if (val === 'Biologiya' || val === 'Tarix' || val === 'Geografiya' || val === 'Informatika') {
      suggested = [5, 6, 7, 8, 9, 10, 11];
    } else if (val === 'Fizika') {
      suggested = [6, 7, 8, 9, 10, 11];
    } else if (val === 'Kimyo') {
      suggested = [7, 8, 9, 10, 11];
    } else if (val === 'Huquq') {
      suggested = [8, 9, 10, 11];
    } else {
      suggested = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    }

    pills.forEach(pill => {
      const grade = parseInt(pill.dataset.grade);
      if (suggested.includes(grade)) {
        pill.style.opacity = '1';
        pill.style.pointerEvents = 'auto';
      } else {
        pill.style.opacity = '0.4';
        const cb = pill.querySelector('input');
        cb.checked = false;
        pill.classList.remove('selected');
      }
    });
  });
}

// Start Test Handler
function handleStartTest() {
  const name = document.getElementById('teacherName').value.trim();
  const school = document.getElementById('schoolName').value.trim();
  const subject = document.getElementById('subjectSelect').value;
  
  const selectedPills = document.querySelectorAll('.grade-pill.selected input');
  const selectedGrades = Array.from(selectedPills).map(cb => parseInt(cb.value));

  if (!name) {
    alert("Iltimos, F.I.Sh. (Familiya, Ism, Sharifingiz)ni kiriting!");
    document.getElementById('teacherName').focus();
    return;
  }

  if (!school) {
    alert("Iltimos, maktab yoki ta'lim muassasangiz nomini kiriting!");
    document.getElementById('schoolName').focus();
    return;
  }

  if (!subject) {
    alert("Iltimos, dars beradigan faningizni tanlang!");
    document.getElementById('subjectSelect').focus();
    return;
  }

  if (selectedGrades.length === 0) {
    alert("Iltimos, kamida bitta sinfni tanlang!");
    return;
  }

  state.teacherInfo = {
    name,
    school,
    subject,
    grades: selectedGrades
  };

  const countRequested = parseInt(document.getElementById('questionCount').value) || 20;
  state.timeLimitMinutes = parseInt(document.getElementById('timeLimit').value) || 30;

  // Filter questions matching Subject and selected Grades
  let matched = state.allQuestions.filter(q => {
    const subjMatch = q.subject.toLowerCase() === subject.toLowerCase();
    const gradeMatch = selectedGrades.includes(q.grade);
    return subjMatch && gradeMatch;
  });

  // If no exact match (or small database), take any questions from that subject or general pool
  if (matched.length === 0) {
    matched = state.allQuestions.filter(q => q.subject.toLowerCase() === subject.toLowerCase());
  }

  if (matched.length === 0) {
    matched = state.allQuestions; // fallback to general pool
  }

  // Shuffle and pick requested count
  matched = shuffleArray([...matched]);
  if (matched.length > countRequested) {
    matched = matched.slice(0, countRequested);
  }

  state.activeQuestions = matched;
  state.currentIndex = 0;
  state.userAnswers = {};
  state.secondsRemaining = state.timeLimitMinutes * 60;
  state.startTime = new Date();

  // Prepare UI
  document.getElementById('examHeaderTeacher').textContent = state.teacherInfo.name;
  document.getElementById('examHeaderDetails').textContent = 
    `${state.teacherInfo.school} • ${state.teacherInfo.subject} • ${state.teacherInfo.grades.map(g => g + '-sinf').join(', ')}`;

  renderNavigatorGrid();
  renderQuestion();
  startTimer();

  switchView('exam');
}

// Render Navigator Grid (Sidebar)
function renderNavigatorGrid() {
  const grid = document.getElementById('questionsNavGrid');
  grid.innerHTML = '';

  state.activeQuestions.forEach((q, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-num-btn';
    btn.textContent = idx + 1;
    btn.dataset.index = idx;

    btn.addEventListener('click', () => {
      state.currentIndex = idx;
      renderQuestion();
    });

    grid.appendChild(btn);
  });

  updateNavigatorButtons();
}

// Update Navigator button styles (active/answered)
function updateNavigatorButtons() {
  const buttons = document.querySelectorAll('.nav-num-btn');
  buttons.forEach((btn, idx) => {
    btn.classList.remove('current', 'answered');
    if (idx === state.currentIndex) {
      btn.classList.add('current');
    } else if (state.userAnswers[idx]) {
      btn.classList.add('answered');
    }
  });
}

// Render Current Question
function renderQuestion() {
  const q = state.activeQuestions[state.currentIndex];
  if (!q) return;

  document.getElementById('currentQGrade').textContent = `${q.grade}-sinf`;
  document.getElementById('currentQTopic').textContent = `Mavzu: ${q.topic || 'Darslik bo\'yicha'}`;
  document.getElementById('qProgressText').textContent = `${state.currentIndex + 1} / ${state.activeQuestions.length}`;
  document.getElementById('questionText').textContent = `${state.currentIndex + 1}. ${q.question}`;

  const container = document.getElementById('optionsContainer');
  container.innerHTML = '';

  const letters = ['A', 'B', 'C', 'D'];
  letters.forEach(letter => {
    const text = q.options[letter];
    if (!text) return;

    const card = document.createElement('div');
    card.className = 'option-card';
    if (state.userAnswers[state.currentIndex] === letter) {
      card.classList.add('selected');
    }

    card.innerHTML = `
      <div class="option-letter">${letter}</div>
      <div class="option-text">${text}</div>
    `;

    card.addEventListener('click', () => {
      state.userAnswers[state.currentIndex] = letter;
      renderQuestion();
      updateNavigatorButtons();
    });

    container.appendChild(card);
  });

  // Navigation button states
  document.getElementById('prevQBtn').disabled = (state.currentIndex === 0);
  const isLast = (state.currentIndex === state.activeQuestions.length - 1);
  document.getElementById('nextQBtn').textContent = isLast ? 'Tugatish 🏁' : 'Keyingi ➡';

  updateNavigatorButtons();
}

// Question Navigation (Prev / Next)
function navigateQuestion(delta) {
  const newIndex = state.currentIndex + delta;
  if (newIndex >= 0 && newIndex < state.activeQuestions.length) {
    state.currentIndex = newIndex;
    renderQuestion();
  } else if (newIndex >= state.activeQuestions.length) {
    openFinishModal();
  }
}

// Countdown Timer
function startTimer() {
  clearInterval(state.timerInterval);
  updateTimerDisplay();

  state.timerInterval = setInterval(() => {
    state.secondsRemaining--;
    updateTimerDisplay();

    if (state.secondsRemaining <= 0) {
      clearInterval(state.timerInterval);
      alert("Ajratilgan vaqt tugadi! Test avtomatik tarzda yakunlanadi.");
      finishExam();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const mins = Math.floor(state.secondsRemaining / 60);
  const secs = state.secondsRemaining % 60;
  const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  
  const timerEl = document.getElementById('timerDisplay');
  const timerBox = document.getElementById('timerBox');
  timerEl.textContent = display;

  if (state.secondsRemaining <= 180) { // under 3 minutes
    timerBox.classList.add('warning');
  } else {
    timerBox.classList.remove('warning');
  }
}

// Modal handling
function openFinishModal() {
  const total = state.activeQuestions.length;
  const answeredCount = Object.keys(state.userAnswers).length;
  const unansweredCount = total - answeredCount;

  const warnEl = document.getElementById('modalWarningText');
  if (unansweredCount > 0) {
    warnEl.innerHTML = `Siz jami <b>${total}</b> ta savoldan <b>${answeredCount}</b> tasiga javob berdingiz.<br><span style="color: var(--danger); font-weight: 600;">${unansweredCount} ta savol belgilanmagan!</span>`;
  } else {
    warnEl.innerHTML = `Siz barcha <b>${total}</b> ta savolga to'liq javob berdingiz. Natijani ko'rishga tayyormisiz?`;
  }

  document.getElementById('confirmModal').classList.add('open');
}

function closeFinishModal() {
  document.getElementById('confirmModal').classList.remove('open');
}

// Finish Exam and Calculate Score
function finishExam() {
  clearInterval(state.timerInterval);
  state.endTime = new Date();

  const total = state.activeQuestions.length;
  let correctCount = 0;

  state.activeQuestions.forEach((q, idx) => {
    const userChoice = state.userAnswers[idx];
    if (userChoice && userChoice.toUpperCase() === q.answer.toUpperCase()) {
      correctCount++;
    }
  });

  const wrongCount = total - correctCount;
  const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  // Time spent
  const timeSpentSec = (state.timeLimitMinutes * 60) - Math.max(0, state.secondsRemaining);
  const spentMins = Math.floor(timeSpentSec / 60);
  const spentSecs = timeSpentSec % 60;
  const timeFormatted = `${spentMins} daq ${spentSecs} son`;

  // Render Result Screen
  document.getElementById('resTeacherName').textContent = state.teacherInfo.name;
  document.getElementById('resSubject').textContent = state.teacherInfo.subject;
  document.getElementById('resGrades').textContent = state.teacherInfo.grades.map(g => g + '-sinf').join(', ');
  document.getElementById('resScoreText').textContent = `${correctCount}/${total}`;
  document.getElementById('resPercentText').textContent = `${percent}%`;
  document.getElementById('resCorrectCount').textContent = correctCount;
  document.getElementById('resWrongCount').textContent = wrongCount;
  document.getElementById('resTimeSpent').textContent = timeFormatted;

  const emojiEl = document.getElementById('resultEmoji');
  const titleEl = document.getElementById('resultTitle');

  if (percent >= 86) {
    emojiEl.textContent = '🏆';
    titleEl.textContent = "A'lo natija! Mukammal bilim!";
  } else if (percent >= 71) {
    emojiEl.textContent = '🌟';
    titleEl.textContent = "Yaxshi natija! O'z ustingizda ishlashda davom eting.";
  } else if (percent >= 55) {
    emojiEl.textContent = '👍';
    titleEl.textContent = "Qoniqarli natija.";
  } else {
    emojiEl.textContent = '📚';
    titleEl.textContent = "Darsliklarni yana bir bor takrorlash tavsiya etiladi.";
  }

  renderReviewList();
  switchView('result');
}

// Render Review of all questions
function renderReviewList() {
  const container = document.getElementById('reviewContainer');
  container.innerHTML = '';

  state.activeQuestions.forEach((q, idx) => {
    const userChoice = state.userAnswers[idx] || null;
    const isCorrect = userChoice && (userChoice.toUpperCase() === q.answer.toUpperCase());

    const item = document.createElement('div');
    item.className = `review-item ${isCorrect ? 'correct' : 'wrong'}`;

    const userAnsText = userChoice 
      ? `${userChoice}) ${q.options[userChoice] || ''}`
      : "Belgilanmagan (Javob berilmadi)";
    const correctAnsText = `${q.answer}) ${q.options[q.answer] || ''}`;

    item.innerHTML = `
      <div class="review-q-header">
        <span><b>${idx + 1}-savol</b> (${q.grade}-sinf • ${q.topic || 'Darslik'})</span>
        <span style="font-weight: 700; color: ${isCorrect ? 'var(--accent)' : 'var(--danger)'};">
          ${isCorrect ? '✓ To\'g\'ri' : '✗ Noto\'g\'ri'}
        </span>
      </div>
      <div class="review-q-text">${q.question}</div>
      <div class="review-ans-row">
        <div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Sizning javobingiz:</span><br>
          <span class="ans-badge ${isCorrect ? 'user-correct' : 'user-wrong'}">${userAnsText}</span>
        </div>
        ${!isCorrect ? `
          <div>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Darslikdagi to'g'ri javob:</span><br>
            <span class="ans-badge correct-ans">${correctAnsText}</span>
          </div>
        ` : ''}
      </div>
      ${q.explanation ? `
        <div style="margin-top: 0.75rem; font-size: 0.82rem; color: var(--text-muted); background: var(--bg); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm);">
          📖 <b>Izoh:</b> ${q.explanation}
        </div>
      ` : ''}
    `;

    container.appendChild(item);
  });
}

// Restart
function handleRestart() {
  if (confirm("Yangi test boshlaysizmi?")) {
    switchView('setup');
  }
}

// Utility: Array shuffle
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
