/**
 * Pedagog.umamatov.uz — Pedagoglar Test Tizimi
 * JavaScript Application Logic with Daily PIN-code Protection,
 * Active Session Resumption (Power Outage / Reload Protection),
 * Teacher Database Selector (Tarifikatsiya) & Mobile Anti-Cheat Proctoring.
 */

const PIN_CONFIG = {
  salt: "umamatov_pedagog_2026",
  masterPin: "2026" // Admin master PIN for Umrbek Mamatov
};

const SESSION_STORAGE_KEY = 'pedagog_active_session_2026';

// Global State
const state = {
  teachersDb: {},
  allQuestions: [],
  activeQuestions: [],
  currentIndex: 0,
  userAnswers: {}, // index -> 'A' | 'B' | 'C' | 'D'
  teacherInfo: {
    name: '',
    school: '',
    subject: ''
  },
  timeLimitMinutes: 30,
  secondsRemaining: 0,
  timerInterval: null,
  startTimestamp: null,
  endTimestamp: null,
  
  // Anti-Cheat Monitoring
  isExamActive: false,
  tabSwitchCount: 0,
  isBlocked: false,
  lastBlurTime: 0
};

// DOM Views
const views = {
  setup: document.getElementById('setupView'),
  exam: document.getElementById('examView'),
  result: document.getElementById('resultView'),
  blocked: document.getElementById('blockedView')
};

function switchView(viewName) {
  Object.values(views).forEach(v => {
    if (v) v.classList.remove('active');
  });
  if (views[viewName]) {
    views[viewName].classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function scrollToSection(sectionId) {
  switchView('setup');
  setTimeout(() => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
}

// Calculate Today's 4-digit PIN based on Tashkent Date
function getTodayTashkentDate() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(now); // "YYYY-MM-DD"
}

// Deterministic SHA-256 hash for 4-digit PIN
async function calculateDailyPin(dateStr) {
  const text = `${PIN_CONFIG.salt}_${dateStr}`;
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join('');
  const num = parseInt(hex, 16);
  const pin = String((num % 9000) + 1000);
  return pin;
}

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  setupAntiCheatListeners();
  await loadTeachersDatabase();
  await loadQuestionsDatabase();
  setupSchoolTeacherSelectEvents();

  // Test start triggers PIN modal
  const startBtn = document.getElementById('startTestBtn');
  if (startBtn) {
    startBtn.addEventListener('click', handleValidateAndOpenPinModal);
  }
  
  // PIN Modal buttons
  document.getElementById('pinCancelBtn')?.addEventListener('click', closePinModal);
  document.getElementById('pinSubmitBtn')?.addEventListener('click', handlePinSubmit);
  document.getElementById('pinInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlePinSubmit();
  });

  // Anti-cheat modal acknowledge button
  document.getElementById('acModalAcknowledgeBtn')?.addEventListener('click', () => {
    document.getElementById('antiCheatModal').classList.remove('open');
  });

  // Resume Session Modal buttons
  document.getElementById('resumeCancelBtn')?.addEventListener('click', discardSavedSession);
  document.getElementById('resumeConfirmBtn')?.addEventListener('click', resumeSavedSession);

  // Exam navigation
  document.getElementById('prevQBtn')?.addEventListener('click', () => navigateQuestion(-1));
  document.getElementById('nextQBtn')?.addEventListener('click', () => navigateQuestion(1));
  document.getElementById('finishTestBtn')?.addEventListener('click', openFinishModal);
  document.getElementById('modalCancelBtn')?.addEventListener('click', closeFinishModal);
  document.getElementById('modalConfirmBtn')?.addEventListener('click', () => {
    closeFinishModal();
    finishExam();
  });
  document.getElementById('restartBtn')?.addEventListener('click', handleRestart);

  // Check for active interrupted session (power outage / reload protection)
  checkInterruptedSession();
});

// ==========================================
// TEACHERS & SCHOOLS DATABASE LOGIC
// ==========================================
async function loadTeachersDatabase() {
  try {
    const res = await fetch('teachers_db.json');
    if (res.ok) {
      state.teachersDb = await res.json();
      populateSchoolDropdown();
    }
  } catch (err) {
    console.warn("teachers_db.json yuklanmadi:", err);
  }
}

function populateSchoolDropdown() {
  const schoolSelect = document.getElementById('schoolSelect');
  if (!schoolSelect) return;

  // Clear previous options except default
  schoolSelect.innerHTML = '<option value="">-- Maktabni tanlang --</option>';

  // Sort schools naturally (1-sonli, 2-sonli, ..., 45-sonli)
  const schoolNames = Object.keys(state.teachersDb).sort((a, b) => {
    const numA = parseInt(a) || 999;
    const numB = parseInt(b) || 999;
    if (numA !== numB) return numA - numB;
    return a.localeCompare(b);
  });

  schoolNames.forEach(sch => {
    const opt = document.createElement('option');
    opt.value = sch;
    opt.textContent = `${sch} (${state.teachersDb[sch].length} nafar o'qituvchi)`;
    schoolSelect.appendChild(opt);
  });

  // Add "Ro'yxatdan tashqari" option
  const otherOpt = document.createElement('option');
  otherOpt.value = 'CUSTOM_SCHOOL';
  otherOpt.textContent = '➕ Ro\'yxatdan tashqari maktab / muassasa';
  schoolSelect.appendChild(otherOpt);
}

function setupSchoolTeacherSelectEvents() {
  const schoolSelect = document.getElementById('schoolSelect');
  const teacherSelect = document.getElementById('teacherSelect');
  const customSchoolInput = document.getElementById('customSchoolInput');
  const customTeacherInput = document.getElementById('customTeacherInput');
  const subjectSelect = document.getElementById('subjectSelect');

  if (!schoolSelect || !teacherSelect) return;

  schoolSelect.addEventListener('change', () => {
    const val = schoolSelect.value;
    if (val === 'CUSTOM_SCHOOL') {
      customSchoolInput.style.display = 'block';
      customSchoolInput.required = true;
      customSchoolInput.focus();

      // Setup teacher select for custom entry
      teacherSelect.disabled = false;
      teacherSelect.innerHTML = '<option value="CUSTOM_TEACHER" selected>➕ Ro\'yxatdan tashqari pedagog</option>';
      customTeacherInput.style.display = 'block';
      customTeacherInput.required = true;
    } else if (val && state.teachersDb[val]) {
      customSchoolInput.style.display = 'none';
      customSchoolInput.required = false;

      teacherSelect.disabled = false;
      teacherSelect.innerHTML = '<option value="">-- O\'qituvchini tanlang --</option>';

      const teachers = [...state.teachersDb[val]].sort((a, b) => a.name.localeCompare(b.name));
      teachers.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name;
        opt.textContent = `${t.name} (${t.subject || 'O\'qituvchi'})`;
        opt.dataset.subject = t.subject || '';
        teacherSelect.appendChild(opt);
      });

      // Also add custom teacher option
      const customTOpt = document.createElement('option');
      customTOpt.value = 'CUSTOM_TEACHER';
      customTOpt.textContent = '➕ Ro\'yxatdan tashqari yangi pedagog';
      teacherSelect.appendChild(customTOpt);

      customTeacherInput.style.display = 'none';
      customTeacherInput.required = false;
    } else {
      customSchoolInput.style.display = 'none';
      teacherSelect.disabled = true;
      teacherSelect.innerHTML = '<option value="">-- Avval maktabni tanlang --</option>';
      customTeacherInput.style.display = 'none';
    }
  });

  teacherSelect.addEventListener('change', () => {
    const val = teacherSelect.value;
    if (val === 'CUSTOM_TEACHER') {
      customTeacherInput.style.display = 'block';
      customTeacherInput.required = true;
      customTeacherInput.focus();
    } else {
      customTeacherInput.style.display = 'none';
      customTeacherInput.required = false;

      // Auto-detect and select matching KRS subject
      const selectedOption = teacherSelect.options[teacherSelect.selectedIndex];
      const rawSubject = (selectedOption?.dataset?.subject || '').trim();
      if (rawSubject && subjectSelect) {
        const mapped = mapSubjectToKrs(rawSubject);
        if (mapped) {
          subjectSelect.value = mapped;
          subjectSelect.dispatchEvent(new Event('change'));
        }
      }
    }
  });
}

// Map teacher's subject string from Tarifikatsiya to the 12 KRS categories
function mapSubjectToKrs(raw) {
  const s = raw.toLowerCase();
  if (s.includes('boshlang') || s.includes('savod') || s.includes('o\'qish savod')) return "Boshlang'ich ta'lim";
  if (s.includes('matemat') || s.includes('algebra') || s.includes('geometr')) return "Matematika";
  if (s.includes('informat') || s.includes('axborot')) return "Informatika";
  if (s.includes('ona tili') || s.includes('adabiyot') || s.includes('ўзбек тили') || s.includes('o\'zbek tili')) return "Ona tili";
  if (s.includes('ingliz') || s.includes('english') || s.includes('chet tili')) return "English";
  if (s.includes('rus tili') || s.includes('русский') || s.includes('rus')) return "Rus tili";
  if (s.includes('biolog') || s.includes('tabiiy fan') || s.includes('botan') || s.includes('zoolog')) return "Biologiya";
  if (s.includes('fizik') || s.includes('astronom')) return "Fizika";
  if (s.includes('kimyo')) return "Kimyo";
  if (s.includes('geograf') || s.includes('iqtisod')) return "Geografiya";
  if (s.includes('tarix') || s.includes('huquq') || s.includes('tarbiya') || s.includes('davlat') || s.includes('milliy g\'oya')) return "Tarix";
  if (s.includes('texnolog') || s.includes('mehnat') || s.includes('tasviriy') || s.includes('chizma') || s.includes('musiqa') || s.includes('jismoniy')) return "Texnologiya";
  return null;
}

// ==========================================
// QUESTIONS DATABASE LOADER
// ==========================================
async function loadQuestionsDatabase() {
  try {
    const res = await fetch('questions.json');
    if (res.ok) {
      state.allQuestions = await res.json();
      console.log(`Bazada jami ${state.allQuestions.length} ta darslik test savollari yuklandi.`);
    }
  } catch (err) {
    console.warn("questions.json yuklanmadi:", err);
  }
}

// ==========================================
// MOBILE & DESKTOP ANTI-CHEAT PROCTORING
// ==========================================
function setupAntiCheatListeners() {
  const handleTabSwitch = (reason) => {
    if (!state.isExamActive || state.isBlocked) return;

    // Mobile / Desktop Debounce: ignore multiple rapid events within 1500ms
    const now = Date.now();
    if (now - state.lastBlurTime < 1500) return;
    state.lastBlurTime = now;

    state.tabSwitchCount++;
    saveActiveSession(); // persist updated strike count
    updateAntiCheatIndicator();

    if (state.tabSwitchCount === 1) {
      showAntiCheatModal(
        "⚠️",
        "OGOHLANTIRISH (1/3)!",
        `Siz test maydonidan chiqib, boshqa vkladka yoki ilovaga o'tdingiz!<br>
        <b>Qoidabuzarlik qayd etildi (Chiqishlar: 1).</b><br>
        <span style="color: var(--danger); font-weight: 700;">4-marta takrorlansa, testingiz avtomatik BLOKLANADI!</span>`
      );
    } else if (state.tabSwitchCount === 2) {
      showAntiCheatModal(
        "⚠️",
        "OGOHLANTIRISH (2/3)!",
        `Siz yana test maydonidan chiqdingiz!<br>
        <b>Qoidabuzarlik soni: 2 ta.</b><br>
        <span style="color: var(--warning); font-weight: 700;">Iltimos, diqqatingizni testda saqlang! Yana 2 ta chiqish qoldi.</span>`
      );
    } else if (state.tabSwitchCount === 3) {
      showAntiCheatModal(
        "🚨",
        "OXIRGI OGOHLANTIRISH (3/3)!",
        `<b>OGOH BO'LING! Qoidabuzarlik soni 3 taga yetdi.</b><br>
        <span style="color: var(--danger); font-weight: 800; font-size: 1.05rem;">
          AGAR YANA 1 MARTA CHIQSIZ (4-marta), TEST SHU ZAHOTIYOQ BLOKLANADI VA 0 BALL BILAN BEKOR QILINADI!
        </span>`
      );
    } else if (state.tabSwitchCount >= 4) {
      // 4th violation: Automatic Block and Immediate Disqualification
      blockExamDueToCheating();
    }
  };

  // Modern Page Visibility API (Desktop + Mobile Chrome/Safari)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      handleTabSwitch('visibilitychange');
    }
  });

  // Mobile App Switch / Home button / Lock screen (iOS Safari & Android)
  window.addEventListener('pagehide', () => {
    handleTabSwitch('pagehide');
  });

  // Desktop window blur (switching browser window / app)
  window.addEventListener('blur', () => {
    handleTabSwitch('blur');
  });
}

function updateAntiCheatIndicator() {
  const counterEl = document.getElementById('switchCounter');
  const pillEl = document.getElementById('antiCheatPill');
  if (counterEl) counterEl.textContent = state.tabSwitchCount;

  if (pillEl) {
    pillEl.classList.remove('safe', 'warn', 'danger');
    if (state.tabSwitchCount === 0) {
      pillEl.classList.add('safe');
    } else if (state.tabSwitchCount <= 2) {
      pillEl.classList.add('warn');
    } else {
      pillEl.classList.add('danger');
    }
  }
}

function showAntiCheatModal(icon, title, textHtml) {
  document.getElementById('acModalIcon').textContent = icon;
  document.getElementById('acModalTitle').textContent = title;
  document.getElementById('acModalText').innerHTML = textHtml;
  document.getElementById('antiCheatModal').classList.add('open');
}

function blockExamDueToCheating() {
  state.isExamActive = false;
  state.isBlocked = true;
  clearInterval(state.timerInterval);
  clearSavedSession();

  // Close warning modals
  document.getElementById('antiCheatModal')?.classList.remove('open');
  document.getElementById('confirmModal')?.classList.remove('open');

  switchView('blocked');
}

// ==========================================
// SESSION RESUMPTION (POWER OUTAGE / RELOAD)
// ==========================================
function saveActiveSession() {
  if (!state.isExamActive || state.isBlocked) return;
  const sessionData = {
    teacherInfo: state.teacherInfo,
    activeQuestions: state.activeQuestions,
    currentIndex: state.currentIndex,
    userAnswers: state.userAnswers,
    timeLimitMinutes: state.timeLimitMinutes,
    startTimestamp: state.startTimestamp,
    endTimestamp: state.endTimestamp,
    tabSwitchCount: state.tabSwitchCount,
    savedAt: Date.now()
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
}

function clearSavedSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function checkInterruptedSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return;

    const session = JSON.parse(raw);
    const now = Date.now();
    const remainingSec = Math.floor((session.endTimestamp - now) / 1000);

    if (remainingSec > 10 && session.activeQuestions && session.activeQuestions.length > 0) {
      // Valid active session found
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      const ansCount = Object.keys(session.userAnswers || {}).length;

      const infoEl = document.getElementById('resumeSessionInfo');
      if (infoEl) {
        infoEl.innerHTML = `
          Hurmatli <b>${session.teacherInfo.name}</b>!<br>
          <b>${session.teacherInfo.subject}</b> fani bo'yicha boshlangan faol testingiz saqlab qolingan.<br>
          ⏱️ Qolgan vaqtingiz: <b>${mins} daqiqa ${secs} soniya</b>.<br>
          📝 Belgilangan javoblar: <b>${ansCount} / ${session.activeQuestions.length} ta</b>.<br>
          Chiqishlar (qoidabuzarliklar): <b>${session.tabSwitchCount || 0} / 3</b>.
        `;
      }
      document.getElementById('resumeSessionModal')?.classList.add('open');
    } else {
      // Session expired while offline
      clearSavedSession();
    }
  } catch (err) {
    console.warn("Seansni tiklashda xatolik:", err);
    clearSavedSession();
  }
}

function resumeSavedSession() {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return;
    const session = JSON.parse(raw);
    const remainingSec = Math.floor((session.endTimestamp - Date.now()) / 1000);

    if (remainingSec <= 0) {
      alert("Afsuski, ajratilgan vaqt tugagan.");
      clearSavedSession();
      document.getElementById('resumeSessionModal')?.classList.remove('open');
      return;
    }

    state.teacherInfo = session.teacherInfo;
    state.activeQuestions = session.activeQuestions;
    state.currentIndex = session.currentIndex || 0;
    state.userAnswers = session.userAnswers || {};
    state.timeLimitMinutes = session.timeLimitMinutes;
    state.startTimestamp = session.startTimestamp;
    state.endTimestamp = session.endTimestamp;
    state.secondsRemaining = remainingSec;
    state.tabSwitchCount = session.tabSwitchCount || 0;

    state.isExamActive = true;
    state.isBlocked = false;

    document.getElementById('resumeSessionModal')?.classList.remove('open');

    // Update Header
    document.getElementById('examHeaderTeacher').textContent = state.teacherInfo.name;
    document.getElementById('examHeaderDetails').textContent = 
      `${state.teacherInfo.school} • ${state.teacherInfo.subject} (KRS)`;

    updateAntiCheatIndicator();
    renderNavigatorGrid();
    renderQuestion();
    startTimer();

    switchView('exam');
  } catch (err) {
    console.error("Tiklashda xato:", err);
    clearSavedSession();
    document.getElementById('resumeSessionModal')?.classList.remove('open');
  }
}

function discardSavedSession() {
  clearSavedSession();
  document.getElementById('resumeSessionModal')?.classList.remove('open');
}

// ==========================================
// VALIDATION & PIN MODAL
// ==========================================
function handleValidateAndOpenPinModal() {
  const schoolSelect = document.getElementById('schoolSelect');
  const teacherSelect = document.getElementById('teacherSelect');
  const customSchoolInput = document.getElementById('customSchoolInput');
  const customTeacherInput = document.getElementById('customTeacherInput');
  const subjectSelect = document.getElementById('subjectSelect');

  let school = schoolSelect.value;
  if (school === 'CUSTOM_SCHOOL') {
    school = customSchoolInput.value.trim();
  }
  if (!school) {
    alert("Iltimos, ta'lim muassasasi (maktab)ni tanlang yoki nomini kiriting!");
    schoolSelect.focus();
    return;
  }

  let name = teacherSelect.value;
  if (name === 'CUSTOM_TEACHER') {
    name = customTeacherInput.value.trim();
  }
  if (!name) {
    alert("Iltimos, o'qituvchi F.I.Sh. (Familiya Ism Sharif)ingizni tanlang yoki kiriting!");
    teacherSelect.focus();
    return;
  }

  const subject = subjectSelect.value;
  if (!subject) {
    alert("Iltimos, KRS dars beradigan faningizni tanlang!");
    subjectSelect.focus();
    return;
  }

  state.teacherInfo = {
    name,
    school,
    subject
  };

  openPinModal();
}

function openPinModal() {
  const pinInput = document.getElementById('pinInput');
  pinInput.value = '';
  document.getElementById('pinModal').classList.add('open');
  setTimeout(() => pinInput.focus(), 200);
}

function closePinModal() {
  document.getElementById('pinModal').classList.remove('open');
}

// Validate PIN Code
async function handlePinSubmit() {
  const pinInput = document.getElementById('pinInput').value.trim();
  if (!pinInput || pinInput.length !== 4) {
    alert("Iltimos, 4 xonali PIN-kodni to'liq kiriting!");
    return;
  }

  const todayStr = getTodayTashkentDate();
  const expectedPin = await calculateDailyPin(todayStr);

  if (pinInput === expectedPin || pinInput === PIN_CONFIG.masterPin) {
    closePinModal();
    startExamSession();
  } else {
    alert("Kiritilgan PIN-kod noto'g'ri!\nBugungi amaldagi PIN-kodni olish uchun Umrbek Mamatovga murojaat qiling (+998 99 660 14 15).");
    document.getElementById('pinInput').value = '';
    document.getElementById('pinInput').focus();
  }
}

// ==========================================
// START TEST SESSION
// ==========================================
function startExamSession() {
  const countRequested = parseInt(document.getElementById('questionCount').value) || 20;
  state.timeLimitMinutes = parseInt(document.getElementById('timeLimit').value) || 30;

  // Filter 20 textbook questions matching the selected KRS subject
  let matched = state.allQuestions.filter(q => {
    return q.subject && q.subject.toLowerCase() === state.teacherInfo.subject.toLowerCase();
  });

  // Fallback if subject name has slight variations
  if (matched.length === 0) {
    matched = state.allQuestions.filter(q => {
      return q.subject && (
        q.subject.toLowerCase().includes(state.teacherInfo.subject.toLowerCase()) ||
        state.teacherInfo.subject.toLowerCase().includes(q.subject.toLowerCase())
      );
    });
  }

  if (matched.length === 0) {
    matched = state.allQuestions;
  }

  // Shuffle and pick 20 questions
  matched = shuffleArray([...matched]);
  if (matched.length > countRequested) {
    matched = matched.slice(0, countRequested);
  }

  state.activeQuestions = matched;
  state.currentIndex = 0;
  state.userAnswers = {};
  state.secondsRemaining = state.timeLimitMinutes * 60;
  state.startTimestamp = Date.now();
  state.endTimestamp = state.startTimestamp + (state.secondsRemaining * 1000);
  
  // Anti-cheat state init
  state.isExamActive = true;
  state.tabSwitchCount = 0;
  state.isBlocked = false;
  updateAntiCheatIndicator();

  // Header display
  document.getElementById('examHeaderTeacher').textContent = state.teacherInfo.name;
  document.getElementById('examHeaderDetails').textContent = 
    `${state.teacherInfo.school} • ${state.teacherInfo.subject} (KRS fan yo'nalishi)`;

  // Save session state to localStorage immediately
  saveActiveSession();

  renderNavigatorGrid();
  renderQuestion();
  startTimer();

  switchView('exam');
}

// ==========================================
// EXAM INTERACTION & RENDERING
// ==========================================
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
      saveActiveSession();
      renderQuestion();
    });

    grid.appendChild(btn);
  });

  updateNavigatorButtons();
}

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

function renderQuestion() {
  const q = state.activeQuestions[state.currentIndex];
  if (!q) return;

  document.getElementById('currentQGrade').textContent = `${q.grade || 'Maktab'}-sinf`;
  document.getElementById('currentQTopic').textContent = `Mavzu: ${q.topic || 'Darslik bo\'yicha'}`;
  document.getElementById('qProgressText').textContent = `${state.currentIndex + 1} / ${state.activeQuestions.length}`;
  document.getElementById('questionText').textContent = `${state.currentIndex + 1}. ${q.question}`;

  // Optional image
  const imgBox = document.getElementById('questionImageBox');
  const imgTag = document.getElementById('questionImage');
  if (q.image) {
    imgTag.src = q.image;
    imgBox.style.display = 'block';
  } else {
    imgBox.style.display = 'none';
  }

  // Options
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
      saveActiveSession(); // Persist answer immediately
      renderQuestion();
      updateNavigatorButtons();
    });

    container.appendChild(card);
  });

  document.getElementById('prevQBtn').disabled = (state.currentIndex === 0);
  const isLast = (state.currentIndex === state.activeQuestions.length - 1);
  document.getElementById('nextQBtn').textContent = isLast ? 'Tugatish 🏁' : 'Keyingi ➡';

  updateNavigatorButtons();
}

function navigateQuestion(delta) {
  const newIndex = state.currentIndex + delta;
  if (newIndex >= 0 && newIndex < state.activeQuestions.length) {
    state.currentIndex = newIndex;
    saveActiveSession();
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
    // Calculate remaining seconds from absolute end timestamp
    const now = Date.now();
    state.secondsRemaining = Math.max(0, Math.floor((state.endTimestamp - now) / 1000));
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
  if (timerEl) timerEl.textContent = display;

  if (timerBox) {
    if (state.secondsRemaining <= 180) { // under 3 minutes
      timerBox.classList.add('warning');
    } else {
      timerBox.classList.remove('warning');
    }
  }
}

// Finish Modal
function openFinishModal() {
  const total = state.activeQuestions.length;
  const answeredCount = Object.keys(state.userAnswers).length;
  const unansweredCount = total - answeredCount;

  const warnEl = document.getElementById('modalWarningText');
  if (unansweredCount > 0) {
    warnEl.innerHTML = `Siz jami <b>${total}</b> ta savoldan <b>${answeredCount}</b> tasiga javob berdingiz.<br><span style="color: var(--danger); font-weight: 700;">${unansweredCount} ta savol belgilanmagan!</span>`;
  } else {
    warnEl.innerHTML = `Siz barcha <b>${total}</b> ta savolga to'liq javob berdingiz. Natijani ko'rishga tayyormisiz?`;
  }

  document.getElementById('confirmModal').classList.add('open');
}

function closeFinishModal() {
  document.getElementById('confirmModal').classList.remove('open');
}

// Finish Exam and Score
function finishExam() {
  state.isExamActive = false;
  clearInterval(state.timerInterval);
  clearSavedSession(); // Session successfully completed

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

  const timeSpentSec = Math.max(0, Math.floor((Date.now() - state.startTimestamp) / 1000));
  const spentMins = Math.floor(timeSpentSec / 60);
  const spentSecs = timeSpentSec % 60;
  const timeFormatted = `${spentMins} daq ${spentSecs} son`;

  document.getElementById('resTeacherName').textContent = state.teacherInfo.name;
  document.getElementById('resSubject').textContent = state.teacherInfo.subject;
  document.getElementById('resGrades').textContent = `${state.teacherInfo.school} • KRS fani`;
  document.getElementById('resScoreText').textContent = `${correctCount}/${total}`;
  document.getElementById('resPercentText').textContent = `${percent}%`;
  document.getElementById('resCorrectCount').textContent = correctCount;
  document.getElementById('resWrongCount').textContent = wrongCount;
  document.getElementById('resTimeSpent').textContent = timeFormatted;
  
  // Anti-cheat switch count display
  const switchEl = document.getElementById('resSwitchCount');
  if (switchEl) {
    if (state.tabSwitchCount === 0) {
      switchEl.innerHTML = `<span class="text-success">0 ta (Halol)</span>`;
    } else {
      switchEl.innerHTML = `<span class="text-warning">${state.tabSwitchCount} ta</span>`;
    }
  }

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

// Render Review List
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
        <span><b>${idx + 1}-savol</b> (${q.grade || 'Maktab'}-sinf • ${q.topic || 'Darslik'})</span>
        <span style="font-weight: 700; color: ${isCorrect ? 'var(--accent)' : 'var(--danger)'};">
          ${isCorrect ? '✓ To\'g\'ri' : '✗ Noto\'g\'ri'}
        </span>
      </div>
      <div class="review-q-text">${q.question}</div>
      ${q.image ? `<div style="margin: 0.5rem 0;"><img src="${q.image}" style="max-height: 200px; border-radius: 6px;"></div>` : ''}
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

function handleRestart() {
  if (confirm("Yangi test boshlaysizmi?")) {
    clearSavedSession();
    switchView('setup');
  }
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}