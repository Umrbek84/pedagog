/**
 * Pedagog.umamatov.uz — Pedagoglar Test Tizimi
 * JavaScript Application Logic with:
 * 1. Live Google Sheets Dual PIN & Ochiq/Yopiq Status Control (BOSHQARUV varag'i)
 * 2. School -> Subject -> Teacher F.I.Sh. Smart Dynamic Filter
 * 3. Active Session Resumption (Power Outage / Reload Protection)
 * 4. 4-Strike Mobile & Desktop Anti-Cheat Proctoring
 */

const GOOGLE_SHEET_CONTROL_URL = "https://docs.google.com/spreadsheets/d/13ig6ubfR4ogSCtBrDVOtXRUIG2gWj2sAT__uMIFIJZM/gviz/tq?tqx=out:csv&sheet=BOSHQARUV";

const PIN_CONFIG = {
  salt: "umamatov_pedagog_2026",
  masterPin: "2026" // Default master PIN
};

// Remote Live Control Config (Fetched from Google Sheet)
let remoteControl = {
  pin: "2026",
  status: "Ochiq", // "Ochiq" or "Yopiq"
  notice: "Test tizimi ochiq va faol. Muvaffaqiyat tilaymiz!",
  krsWeek1: "Ochiq"
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

// ==========================================
// LIVE GOOGLE SHEET CONTROL (OCHIQ / YOPIQ & PIN)
// ==========================================
async function fetchLiveControlConfig() {
  try {
    const res = await fetch(GOOGLE_SHEET_CONTROL_URL);
    if (!res.ok) throw new Error("Google Sheet request failed");
    const csvText = await res.text();
    const rows = parseCsv(csvText);

    if (rows.length >= 2) {
      // Row 1 is header, Row 2 is data: [Amaldagi_PIN_Kod, Tizim_Holati, Foydalanuvchilarga_Xabar, ...]
      const dataRow = rows[1];
      if (dataRow[0]) remoteControl.pin = dataRow[0].trim();
      if (dataRow[1]) remoteControl.status = dataRow[1].trim();
      if (dataRow[2]) remoteControl.notice = dataRow[2].trim();
      if (dataRow[3]) remoteControl.krsWeek1 = dataRow[3].trim();
    }
  } catch (err) {
    console.warn("Live Google Sheet sozlamalari yuklanmadi, standart parametrlardan foydalaniladi:", err);
  } finally {
    updateSystemStatusBanner();
  }
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  return lines.map(line => {
    // Handle CSV quoted strings cleanly
    const regex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^",]*))/g;
    const row = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
      row.push(val || '');
      if (regex.lastIndex === line.length) break;
    }
    return row;
  });
}

function updateSystemStatusBanner() {
  const banner = document.getElementById('systemStatusBanner');
  const textEl = document.getElementById('systemStatusText');
  if (!banner || !textEl) return;

  const isClosed = remoteControl.status.toLowerCase() === 'yopiq';
  if (isClosed) {
    banner.className = 'system-status-banner offline';
    textEl.innerHTML = `<b>Test tizimi holati:</b> VAQTINCHA YOPIQ (${remoteControl.notice || "Mas'ul tomonidan to'xtatilgan"})`;
  } else {
    banner.className = 'system-status-banner online';
    textEl.innerHTML = `<b>Test tizimi holati:</b> OCHIQ (KRS grafigi bo'yicha test topshirish faol)`;
  }
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

// Deterministic SHA-256 hash for daily 4-digit PIN
async function calculateDailyPin(dateStr) {
  const text = `${PIN_CONFIG.salt}_${dateStr}`;
  const enc = new TextEncoder();
  const data = enc.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join('');
  const num = parseInt(hex, 16);
  return String((num % 9000) + 1000);
}

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  setupAntiCheatListeners();
  await loadTeachersDatabase();
  await loadQuestionsDatabase();
  setupSchoolSubjectTeacherFlow();
  await fetchLiveControlConfig();

  // Periodic poll of Google Sheet control status every 30 seconds
  setInterval(fetchLiveControlConfig, 30000);

  // Test start triggers PIN modal (or shows Closed modal)
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

  schoolSelect.innerHTML = '<option value="">-- 1. Maktabni tanlang --</option>';

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

  const otherOpt = document.createElement('option');
  otherOpt.value = 'CUSTOM_SCHOOL';
  otherOpt.textContent = '➕ Ro\'yxatdan tashqari maktab / muassasa';
  schoolSelect.appendChild(otherOpt);
}

/**
 * Smart Cascading Filter:
 * Step 1: Maktab tanlanadi
 * Step 2: Fan tanlanadi
 * Step 3: F.I.Sh. (O'sha maktabdagi faqat shu fandan dars beradigan o'qituvchilar chiqadi!)
 */
function setupSchoolSubjectTeacherFlow() {
  const schoolSelect = document.getElementById('schoolSelect');
  const subjectSelect = document.getElementById('subjectSelect');
  const teacherSelect = document.getElementById('teacherSelect');
  const customSchoolInput = document.getElementById('customSchoolInput');
  const customTeacherInput = document.getElementById('customTeacherInput');

  if (!schoolSelect || !subjectSelect || !teacherSelect) return;

  function refreshTeacherDropdown() {
    const schoolVal = schoolSelect.value;
    const subjectVal = subjectSelect.value;

    if (schoolVal === 'CUSTOM_SCHOOL') {
      customSchoolInput.style.display = 'block';
      customSchoolInput.required = true;
      teacherSelect.disabled = false;
      teacherSelect.innerHTML = '<option value="CUSTOM_TEACHER" selected>➕ Ro\'yxatdan tashqari pedagog</option>';
      customTeacherInput.style.display = 'block';
      customTeacherInput.required = true;
      return;
    }

    customSchoolInput.style.display = 'none';
    customSchoolInput.required = false;

    if (!schoolVal) {
      teacherSelect.disabled = true;
      teacherSelect.innerHTML = '<option value="">-- Avval maktabni tanlang --</option>';
      customTeacherInput.style.display = 'none';
      return;
    }

    if (!subjectVal) {
      teacherSelect.disabled = true;
      teacherSelect.innerHTML = '<option value="">-- Avval 2-bosqichda fanni tanlang --</option>';
      customTeacherInput.style.display = 'none';
      return;
    }

    // Both School and Subject selected -> filter teachers!
    const allSchoolTeachers = state.teachersDb[schoolVal] || [];
    const matchedTeachers = allSchoolTeachers.filter(t => {
      const krs = mapSubjectToKrs(t.subject || '');
      return krs && krs.toLowerCase() === subjectVal.toLowerCase();
    }).sort((a, b) => a.name.localeCompare(b.name));

    teacherSelect.disabled = false;
    teacherSelect.innerHTML = '';

    if (matchedTeachers.length > 0) {
      const defOpt = document.createElement('option');
      defOpt.value = '';
      defOpt.textContent = `-- O'qituvchini tanlang (${matchedTeachers.length} nafar) --`;
      teacherSelect.appendChild(defOpt);

      matchedTeachers.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.name;
        opt.textContent = `${t.name} (${t.subject})`;
        teacherSelect.appendChild(opt);
      });

      const customOpt = document.createElement('option');
      customOpt.value = 'CUSTOM_TEACHER';
      customOpt.textContent = '➕ Ro\'yxatdan tashqari boshqa pedagog';
      teacherSelect.appendChild(customOpt);

      customTeacherInput.style.display = 'none';
      customTeacherInput.required = false;
    } else {
      // No teacher in roster for this subject -> prompt custom input
      const customOpt = document.createElement('option');
      customOpt.value = 'CUSTOM_TEACHER';
      customOpt.textContent = `➕ Ro'yxatdan tashqari yangi pedagog (${subjectVal})`;
      teacherSelect.appendChild(customOpt);

      customTeacherInput.style.display = 'block';
      customTeacherInput.required = true;
    }
  }

  schoolSelect.addEventListener('change', refreshTeacherDropdown);
  subjectSelect.addEventListener('change', () => {
    refreshTeacherDropdown();
    if (typeof checkSubjectKrsNotice === 'function') {
      checkSubjectKrsNotice(subjectSelect.value);
    }
  });

  teacherSelect.addEventListener('change', () => {
    if (teacherSelect.value === 'CUSTOM_TEACHER') {
      customTeacherInput.style.display = 'block';
      customTeacherInput.required = true;
      customTeacherInput.focus();
    } else {
      customTeacherInput.style.display = 'none';
      customTeacherInput.required = false;
    }
  });
}

// Map teacher's raw subject from Tarifikatsiya to the 12 KRS categories
function mapSubjectToKrs(raw) {
  const s = raw.toLowerCase();
  if (s.includes('boshlang') || s.includes('savod') || s.includes('ўқиш') || s.includes('nutq') || s.includes('нутқ') || s.includes('o‘qish') || s.includes('alifbe')) return "Boshlang'ich ta'lim";
  if (s.includes('matemat') || s.includes('algebra') || s.includes('geometr')) return "Matematika";
  if (s.includes('informat') || s.includes('axborot')) return "Informatika";
  if (s.includes('ona tili') || s.includes('adabiyot') || s.includes('ўзбек тили') || s.includes('o\'zbek tili')) return "Ona tili";
  if (s.includes('ingliz') || s.includes('english') || s.includes('nemis') || s.includes('франсуз') || s.includes('япон') || s.includes('chet tili')) return "English";
  if (s.includes('rus') || s.includes('рус') || s.includes('логопед')) return "Rus tili";
  if (s.includes('biolog') || s.includes('tabiiy') || s.includes('botan') || s.includes('zoolog')) return "Biologiya";
  if (s.includes('fizik') || s.includes('astronom')) return "Fizika";
  if (s.includes('kimyo')) return "Kimyo";
  if (s.includes('geograf') || s.includes('iqtisod') || s.includes('иқтисод')) return "Geografiya";
  if (s.includes('tarix') || s.includes('huquq') || s.includes('tarbiya') || s.includes('тарих') || s.includes('ориентация') || s.includes('тадбиркор')) return "Tarix";
  if (s.includes('texnolog') || s.includes('mehnat') || s.includes('tasviriy') || s.includes('chizma') || s.includes('musiqa') || s.includes('jismoniy') || s.includes('касбий') || s.includes('военная')) return "Texnologiya";
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
      console.log(`Bazada jami ${state.allQuestions.length} ta darslik test savollari mavjud.`);
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

    // Debounce multiple rapid events within 1500ms
    const now = Date.now();
    if (now - state.lastBlurTime < 1500) return;
    state.lastBlurTime = now;

    state.tabSwitchCount++;
    saveActiveSession();
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
      blockExamDueToCheating();
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) handleTabSwitch('visibilitychange');
  });

  window.addEventListener('pagehide', () => {
    handleTabSwitch('pagehide');
  });

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
// VALIDATION & LIVE PIN VERIFICATION
// ==========================================
async function handleValidateAndOpenPinModal() {
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

  const subject = subjectSelect.value;
  if (!subject) {
    alert("Iltimos, KRS dars beradigan faningizni tanlang!");
    subjectSelect.focus();
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

  state.teacherInfo = {
    name,
    school,
    subject
  };

  // Check live status from Google Sheet
  await fetchLiveControlConfig();

  // If status is YOPIQ, block test entry with modal
  if (remoteControl.status.toLowerCase() === 'yopiq') {
    const textEl = document.getElementById('systemClosedNoticeText');
    if (textEl) {
      textEl.innerHTML = `
        Mas'ul mutaxassis tomonidan test topshirish vaqtincha to'xtatilgan yoki yopib qo'yilgan.<br>
        <b>Izoh:</b> ${remoteControl.notice || "Hozirda test topshirish yopiq."}<br>
        PIN-kod to'g'ri kiritilgan taqdirda ham testga kirish cheklangan.
      `;
    }
    document.getElementById('systemClosedModal')?.classList.add('open');
    return;
  }

  // System is OCHIQ -> open PIN entry modal
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

// Validate PIN Code (Checks Google Sheet PIN, Master PIN 2026, or Daily Hash)
async function handlePinSubmit() {
  const pinInput = document.getElementById('pinInput').value.trim();
  if (!pinInput || pinInput.length !== 4) {
    alert("Iltimos, 4 xonali PIN-kodni to'liq kiriting!");
    return;
  }

  // Check again in case admin closed it just now
  await fetchLiveControlConfig();
  if (remoteControl.status.toLowerCase() === 'yopiq') {
    closePinModal();
    document.getElementById('systemClosedModal')?.classList.add('open');
    return;
  }

  const todayStr = getTodayTashkentDate();
  const dailyPin = await calculateDailyPin(todayStr);

  const isValidPin = (
    pinInput === remoteControl.pin ||
    pinInput === PIN_CONFIG.masterPin ||
    pinInput === dailyPin
  );

  if (isValidPin) {
    closePinModal();
    startExamSession();
  } else {
    alert("Kiritilgan PIN-kod noto'g'ri!\nAmaldagi PIN-kodni olish uchun mas'ul mutaxassis Umrbek Mamatovga murojaat qiling (+998 99 660 14 15).");
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
  
  state.isExamActive = true;
  state.tabSwitchCount = 0;
  state.isBlocked = false;
  updateAntiCheatIndicator();

  document.getElementById('examHeaderTeacher').textContent = state.teacherInfo.name;
  document.getElementById('examHeaderDetails').textContent = 
    `${state.teacherInfo.school} • ${state.teacherInfo.subject} (KRS fan yo'nalishi)`;

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

  const imgBox = document.getElementById('questionImageBox');
  const imgTag = document.getElementById('questionImage');
  if (q.image) {
    imgTag.src = q.image;
    imgBox.style.display = 'block';
  } else {
    imgBox.style.display = 'none';
  }

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
      saveActiveSession();
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

function startTimer() {
  clearInterval(state.timerInterval);
  updateTimerDisplay();

  state.timerInterval = setInterval(() => {
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
    if (state.secondsRemaining <= 180) {
      timerBox.classList.add('warning');
    } else {
      timerBox.classList.remove('warning');
    }
  }
}

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

function finishExam() {
  state.isExamActive = false;
  clearInterval(state.timerInterval);
  clearSavedSession();

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