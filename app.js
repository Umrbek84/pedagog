// Telegram Bot Deep-Link generator for PIN code and Unblock requests
function generateTelegramBotLink(type, data) {
  try {
    const jsonStr = JSON.stringify(data);
    // UTF-8 encode and base64
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const b64 = btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return `https://t.me/zavuch_krs_bot?start=${type}_${b64}`;
  } catch (e) {
    console.error("Bot link yaratishda xatolik:", e);
    return "https://t.me/zavuch_krs_bot";
  }
}
window.generateTelegramBotLink = generateTelegramBotLink;

/**
 * Pedagog.umamatov.uz — Pedagoglar Test Tizimi
 * JavaScript Application Logic with:
 * 1. Live Google Sheets Dual PIN & Ochiq/Yopiq Status Control (BOSHQARUV varag'i)
 * 2. Cascading Selector: 1. Maktab -> 2. Fan -> 3. F.I.Sh. (O'sha fanga mos o'qituvchilar)
 * 3. Smart Phone Call Immunity (7 soniyagacha qo'ng'iroq/xabarlarga immunitet)
 * 4. Live Leaderboard from Google Sheet (To'qima ma'lumotlarsiz)
 * 5. Blocked Teachers List & Admin Permission Control (Ochiq/Yopiq ruxsat)
 * 6. Active Session Resumption (Elektr o'chishi / sahifa yangilanishiga qarshi)
 */

const GOOGLE_SHEET_CONTROL_URL = "https://docs.google.com/spreadsheets/d/13ig6ubfR4ogSCtBrDVOtXRUIG2gWj2sAT__uMIFIJZM/gviz/tq?tqx=out:csv&sheet=BOSHQARUV";
const RESULTS_SHEET_URL = "https://docs.google.com/spreadsheets/d/1xYF0P9ZqumezUrH20qoyANjS0Hw6G-yr6hOwwwYOzAU/export?format=csv&gid=0";
const BLOCKED_SHEET_URL = "https://docs.google.com/spreadsheets/d/1xYF0P9ZqumezUrH20qoyANjS0Hw6G-yr6hOwwwYOzAU/export?format=csv&gid=176295550";
const GOOGLE_SHEET_SUBMIT_URL = window.GOOGLE_SHEET_SUBMIT_URL || "https://script.google.com/macros/s/AKfycbzzuJhhvcM3JdOLBshP4lSmZavHzRXax9jnX72Hm6jOH1cwCYaHSTKsCjGFtneYyDZg/exec";

const PIN_CONFIG = {
  salt: "umamatov_pedagog_2026",
  masterPin: "1984"
};

// Remote Live Control Config (Google Sheet orqali boshqariladi)
let remoteControl = {
  pin: "9981",
  status: "Ochiq",
  notice: "Test tizimi ochiq va faol. Muvaffaqiyat tilaymiz!",
  masterPin: "1984"
};

const SESSION_STORAGE_KEY = 'pedagog_active_session_2026';
const RESULTS_STORAGE_KEY = 'pedagog_results_archive_2026';
const BLOCKED_STORAGE_KEY = 'pedagog_blocked_users_2026';

// Global State
const state = {
  teachersDb: (typeof window !== 'undefined' && (window.TEACHERS_DB || window.TEACHERS_DATABASE)) ? (window.TEACHERS_DB || window.TEACHERS_DATABASE) : {},
  allQuestions: (typeof window !== 'undefined' && window.QUESTIONS_DB) ? window.QUESTIONS_DB : [],
  activeQuestions: [],
  currentIndex: 0,
  userAnswers: {},
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
  
  // Anti-Cheat Proctoring & Phone Call Protection
  isExamActive: false,
  tabSwitchCount: 0,
  isBlocked: false,
  awayStartTime: 0,
  isMobileDevice: /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
};

// DOM Views
const views = {
  setup: document.getElementById('setupView'),
  exam: document.getElementById('examView'),
  result: document.getElementById('resultView'),
  blocked: document.getElementById('blockedView'),
  monitoring: document.getElementById('monitoringView'),
  davomat: document.getElementById('davomatView')
};

function switchView(viewName, force = false) {
  // Agar test topshirish jarayoni ketayotgan bo'lsa va foydalanuvchi boshqa bo'limga chiqmoqchi bo'lsa:
  if (state.isExamActive && viewName !== 'exam' && !force) {
    showAppConfirm(
      "<b>⚠️ DIQQAT! Test topshirish jarayoni davom etmoqda!</b><br><br>" +
      "Siz hali testni yakunlamadingiz. Agar hozir boshqa bo'limga chiqsangiz, test to'xtatiladi va natijangiz bekor bo'lishi mumkin.<br><br>" +
      "Haqiqatan ham test maydonidan chiqmoqchimisiz?",
      () => {
        // Chiqishni tasdiqlasa:
        state.isExamActive = false;
        clearInterval(state.timerInterval);
        clearSavedSession();
        document.body.classList.remove('exam-active-mode');
        switchView(viewName, true);
      },
      "Testdan chiqishni tasdiqlang",
      "⚠️",
      "Ha, testdan chiqish",
      "btn btn-danger"
    );
    return;
  }

  Object.values(views).forEach(v => {
    if (v) v.classList.remove('active');
  });

  if (viewName === 'exam') {
    document.body.classList.add('exam-active-mode');
    try {
      history.pushState({ examActive: true }, document.title, location.href);
    } catch (e) {}
  } else {
    document.body.classList.remove('exam-active-mode');
  }

  if (views[viewName]) {
    views[viewName].classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (viewName === 'monitoring') {
      initOrRefreshMonitoringDashboard();
    } else if (viewName === 'davomat') {
      initOrRefreshDavomat();
    } else if (viewName === 'setup') {
      loadLeaderboardFromSheet();
    }
  }
}

function scrollToSection(sectionId) {
  if (state.isExamActive) {
    showAppConfirm(
      "<b>⚠️ DIQQAT! Test jarayoni ketmoqda!</b><br><br>" +
      "Test topshirayotgan vaqtda boshqa bo'limlarga o'tish taqiqlanadi. Haqiqatan ham testdan chiqmoqchimisiz?",
      () => {
        state.isExamActive = false;
        clearInterval(state.timerInterval);
        clearSavedSession();
        document.body.classList.remove('exam-active-mode');
        switchView('setup', true);
        if (sectionId === 'krsSection') {
          loadLeaderboardFromSheet();
        }
        setTimeout(() => {
          const el = document.getElementById(sectionId);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      },
      "Testdan chiqish",
      "⚠️",
      "Ha, chiqish",
      "btn btn-danger"
    );
    return;
  }
  switchView('setup');
  if (sectionId === 'krsSection') {
    loadLeaderboardFromSheet();
  }
  setTimeout(() => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 100);
}

// ==========================================
// CSV PARSER HELPER
// ==========================================
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  return lines.map(line => {
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

// Format seconds into 00:04:40 (HH:MM:SS) format
function formatTimeHms(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Normalize any time string into 00:04:40 format
function normalizeTimeToHms(str) {
  if (!str) return "00:00:00";
  const s = String(str).trim();
  if (s.includes("To'xtatildi") || s.includes("Bloklangan")) return "To'xtatildi";
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const parts = s.split(':');
    return `00:${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  let mins = 0, secs = 0, hrs = 0;
  const hrMatch = s.match(/(\d+)\s*soat/i);
  const minMatch = s.match(/(\d+)\s*daq/i);
  const secMatch = s.match(/(\d+)\s*son/i);
  if (hrMatch) hrs = parseInt(hrMatch[1]) || 0;
  if (minMatch) mins = parseInt(minMatch[1]) || 0;
  if (secMatch) secs = parseInt(secMatch[1]) || 0;
  return formatTimeHms((hrs * 3600) + (mins * 60) + secs);
}

// ==========================================
// TOAST NOTIFICATION HELPER
// ==========================================
function showToast(message, icon = "ℹ️") {
  const existing = document.querySelector('.toast-notice');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast-notice';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.remove();
  }, 4200);
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
      const dataRow = rows[1];
      if (dataRow[0]) remoteControl.pin = dataRow[0].trim();
      if (dataRow[1]) remoteControl.status = dataRow[1].trim();
      if (dataRow[2]) remoteControl.notice = dataRow[2].trim();
      if (dataRow[3]) remoteControl.masterPin = dataRow[3].trim();
    }
  } catch (err) {
    console.warn("Live Google Sheet sozlamalari yuklanmadi, zaxira parametrlardan foydalaniladi:", err);
  } finally {
    updateSystemStatusBanner();
  }
}

function updateSystemStatusBanner() {
  const banner = document.getElementById('systemStatusBanner');
  const textEl = document.getElementById('systemStatusText');
  if (!banner || !textEl) return;

  const isClosed = remoteControl.status.toLowerCase() === 'yopiq';
  if (isClosed) {
    banner.className = 'system-status-banner offline';
    textEl.innerHTML = `<b>Test tizimi holati:</b> VAQTINCHA YOPIQ (${remoteControl.notice || "Bosh mutaxassis tomonidan to'xtatilgan"})`;
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
  return formatter.format(now);
}

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
document.addEventListener('DOMContentLoaded', () => {
  setupAntiCheatListeners();
  setupSchoolSubjectTeacherFlow();
  setupPinToggleVisibility();

  // Barcha tugmalarni DARHOL va sinxron ulaymiz (hech qanday tarmoq kechikishiga bog'lanmasdan!):
  const startBtn = document.getElementById('startTestBtn');
  if (startBtn) {
    startBtn.onclick = handleValidateAndOpenPinModal;
  }
  
  document.getElementById('pinCancelBtn')?.addEventListener('click', closePinModal);
  document.getElementById('pinSubmitBtn')?.addEventListener('click', handlePinSubmit);
  document.getElementById('pinInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlePinSubmit();
  });

  document.getElementById('acModalAcknowledgeBtn')?.addEventListener('click', () => {
    document.getElementById('antiCheatModal').classList.remove('open');
  });

  document.getElementById('resumeCancelBtn')?.addEventListener('click', discardSavedSession);
  document.getElementById('resumeConfirmBtn')?.addEventListener('click', resumeSavedSession);

  document.getElementById('prevQBtn')?.addEventListener('click', () => navigateQuestion(-1));
  document.getElementById('nextQBtn')?.addEventListener('click', () => navigateQuestion(1));
  document.getElementById('finishEarlyBtn')?.addEventListener('click', openFinishModal);
  document.getElementById('modalCancelBtn')?.addEventListener('click', closeFinishModal);
  document.getElementById('modalConfirmBtn')?.addEventListener('click', () => {
    closeFinishModal();
    finishExam();
  });
  document.getElementById('restartBtn')?.addEventListener('click', handleRestart);

  // Orqa fonda ma'lumotlarni yuklash:
  loadTeachersDatabase();
  loadQuestionsDatabase();
  fetchLiveControlConfig();

  setInterval(fetchLiveControlConfig, 30000);
  document.getElementById('restartBtn')?.addEventListener('click', handleRestart);

  checkInterruptedSession();
  if (window.location.hash === '#monitoringView') {
    switchView('monitoring');
  } else if (window.location.hash === '#davomatView') {
    switchView('davomat');
  }
});

// ==========================================
// TEACHERS & SCHOOLS DATABASE LOGIC
// ==========================================
async function loadTeachersDatabase() {
  const tDbGlobal = (typeof window !== 'undefined' && (window.TEACHERS_DB || window.TEACHERS_DATABASE));
  if (tDbGlobal && Object.keys(tDbGlobal).length > 0) {
    state.teachersDb = tDbGlobal;
    window.TEACHERS_DB = tDbGlobal;
    window.TEACHERS_DATABASE = tDbGlobal;
    populateSchoolDropdown();
    populateRatingSchoolDropdown();
    if (typeof refreshTeacherDropdown === 'function') refreshTeacherDropdown();
    return;
  }
  try {
    const res = await fetch('teachers_db.json?v=' + Date.now());
    if (res.ok) {
      state.teachersDb = await res.json();
      window.TEACHERS_DB = state.teachersDb;
      window.TEACHERS_DATABASE = state.teachersDb;
      populateSchoolDropdown();
      populateRatingSchoolDropdown();
      if (typeof refreshTeacherDropdown === 'function') refreshTeacherDropdown();
    }
  } catch (err) {
    console.warn("teachers_db.json yuklanmadi:", err);
  }
}

// Natural School Number Sorting Helper (Globally available)
function getSchoolNumber(name) {
  const match = (name || '').match(/\d+/);
  return match ? parseInt(match[0], 10) : 999;
}

function compareSchoolsNatural(a, b) {
  const numA = getSchoolNumber(a);
  const numB = getSchoolNumber(b);
  if (numA !== numB) return numA - numB;
  const aIsSonli = (a || '').includes('sonli');
  const bIsSonli = (b || '').includes('sonli');
  if (aIsSonli && !bIsSonli) return -1;
  if (!aIsSonli && bIsSonli) return 1;
  return (a || '').localeCompare(b || '');
}

function populateSchoolDropdown() {
  const schoolSelect = document.getElementById('schoolSelect');
  if (!schoolSelect) return;

  schoolSelect.innerHTML = '<option value="">-- 1. Maktabni tanlang --</option>';

  const schoolNames = Object.keys(state.teachersDb).sort(compareSchoolsNatural);

  schoolNames.forEach(sch => {
    const opt = document.createElement('option');
    opt.value = sch;
    opt.textContent = `${sch} (${state.teachersDb[sch].length} nafar o'qituvchi)`;
    schoolSelect.appendChild(opt);
  });

  const otherOpt = document.createElement('option');
  otherOpt.value = 'CUSTOM_SCHOOL';
  otherOpt.textContent = "➕ Ro'yxatdan tashqari maktab / muassasa";
  schoolSelect.appendChild(otherOpt);
}

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

    function normSub(s) {
      if (!s) return '';
      let res = s.toLowerCase();
      res = res.replace(/['ʻ‘ʼ`\u02BC\u02BB]/g, "'");
      res = res.replace(/ş/g, "sh").replace(/ç/g, "ch").replace(/ö/g, "o'").replace(/ğ/g, "g'");
      res = res.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
      res = res.replace(/\(.*?\)/g, "").trim();
      return res;
    }

    const schoolDb = (state.teachersDb && (state.teachersDb[schoolVal] || state.teachersDb[schoolVal.trim()])) ||
                     (typeof window !== 'undefined' && window.TEACHERS_DB && (window.TEACHERS_DB[schoolVal] || window.TEACHERS_DB[schoolVal.trim()])) || [];
    const subNorm = normSub(subjectVal);
    const matchedTeachers = schoolDb.filter(t => {
      const primaryNorm = normSub(t.subject);
      const allNorm = Array.isArray(t.all_krs) ? t.all_krs.map(normSub) : [];
      return primaryNorm === subNorm || allNorm.includes(subNorm) || (primaryNorm && subNorm && (primaryNorm.includes(subNorm) || subNorm.includes(primaryNorm)));
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
        opt.textContent = `${t.name} (${subjectVal})`;
        teacherSelect.appendChild(opt);
      });

      const customOpt = document.createElement('option');
      customOpt.value = 'CUSTOM_TEACHER';
      customOpt.textContent = '➕ Ro\'yxatdan tashqari boshqa pedagog';
      teacherSelect.appendChild(customOpt);

      customTeacherInput.style.display = 'none';
      customTeacherInput.required = false;
    } else {
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
    refreshSessionDropdown(subjectSelect.value);
    updateQuestionCountForSubject(subjectSelect.value, sessionSelect?.value);
    if (typeof checkSubjectKrsNotice === 'function') {
      checkSubjectKrsNotice(subjectSelect.value);
    }
    const subVal = subjectSelect.value;
    document.querySelectorAll('.fan-card-item').forEach(el => {
      el.classList.toggle('active-selected', el.dataset.subject === subVal);
    });
  });

  if (sessionSelect) {
    sessionSelect.addEventListener('change', () => {
      updateQuestionCountForSubject(subjectSelect.value, sessionSelect.value);
    });
  }

  const questionCountSelect = document.getElementById('questionCount');
  const timeLimitSelect = document.getElementById('timeLimit');
  if (questionCountSelect && timeLimitSelect) {
    questionCountSelect.addEventListener('change', () => {
      if (questionCountSelect.value === "40") {
        timeLimitSelect.value = "50";
      } else {
        timeLimitSelect.value = "30";
      }
    });
  }

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

  // Initial call for session dropdown and question count
  refreshSessionDropdown(subjectSelect.value);
  updateQuestionCountForSubject(subjectSelect.value, sessionSelect?.value);
}

const CORE_12_SUBJECTS = [
  "matematika", "informatika", "biologiya", "fizika", "kimyo", 
  "geografiya", "tarix", "huquq", "ona tili", "english", "rus tili", "adabiyot"
];

function isCore12Subject(subjectName) {
  if (!subjectName) return false;
  const s = String(subjectName).toLowerCase().trim();
  return CORE_12_SUBJECTS.some(sub => s.includes(sub));
}

function selectSubjectFromCard(subjectName) {
  const selectEl = document.getElementById('subjectSelect');
  if (!selectEl) return;
  selectEl.value = subjectName;
  selectEl.dispatchEvent(new Event('change'));

  // Highlight active card
  document.querySelectorAll('.fan-card-item').forEach(el => {
    el.classList.toggle('active-selected', el.dataset.subject === subjectName);
  });

  // Smooth scroll up to school or teacher selection
  const schoolSelect = document.getElementById('schoolSelect');
  if (schoolSelect && !schoolSelect.value) {
    schoolSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
    schoolSelect.focus();
  } else {
    const teacherSelect = document.getElementById('teacherSelect');
    if (teacherSelect) {
      teacherSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
      teacherSelect.focus();
    }
  }
}

function updateQuestionCountForSubject(subjectVal, sessionVal) {
  const qSelect = document.getElementById('questionCount');
  const tSelect = document.getElementById('timeLimit');
  if (!qSelect) return;
  const sNum = parseInt(sessionVal || document.getElementById('sessionSelect')?.value || "4");
  const is12 = isCore12Subject(subjectVal);
  
  // Bugun (27-noyabr) Ingliz tili 4-mashg'ulot topshiradi (yoki kelgusi haftada Rus tili)
  const isSpecialSession4 = (subjectVal === 'English' || subjectVal === 'Rus tili') && sNum === 4;
  const is40Q = is12 && (sNum >= 5 || isSpecialSession4);
  
  if (is40Q) {
    qSelect.value = "40";
    if (tSelect) tSelect.value = "50"; // 40 ta savolga 50 daqiqa
  } else {
    qSelect.value = "25";
    if (tSelect) tSelect.value = "30"; // 25 ta savolga 30 daqiqa
  }
}

function refreshSessionDropdown(subjectVal) {
  const sessionSelect = document.getElementById('sessionSelect');
  if (!sessionSelect) return;

  const is12 = isCore12Subject(subjectVal);
  const isSpecialSession4 = (subjectVal === 'English' || subjectVal === 'Rus tili');

  let matchedDates = [];
  if (typeof KRS_SCHEDULE !== 'undefined') {
    const krsName = mapSubjectToKrs(subjectVal || '');
    const item = KRS_SCHEDULE.find(x => 
      x.targetSubjects && x.targetSubjects.some(s => s.toLowerCase() === krsName.toLowerCase() || s.toLowerCase() === (subjectVal || '').toLowerCase())
    );
    if (item && item.dates) {
      matchedDates = item.dates;
    }
  }

  const prevVal = sessionSelect.value || "4";
  sessionSelect.innerHTML = '';

  for (let num = 1; num <= 12; num++) {
    const opt = document.createElement('option');
    opt.value = num;
    const dInfo = matchedDates.find(d => d.num === num);
    const dateLabel = dInfo ? ` (${dInfo.label})` : '';

    if (num <= 3) {
      opt.disabled = true;
      opt.style.color = '#94a3b8';
      opt.style.background = '#f1f5f9';
      opt.textContent = `🔒 ${num}-mashg'ulot${dateLabel} — O'tib ketgan (Test mavjud emas)`;
    } else if (num === 4) {
      opt.disabled = false;
      opt.style.fontWeight = '800';
      opt.style.color = '#047857';
      opt.style.background = '#ecfdf5';
      const qCountStr4 = (is12 && isSpecialSession4) ? "40 ta savol" : "25 ta savol";
      opt.textContent = `🔥 4-mashg'ulot${dateLabel} — ✅ FAOL / ISHLASHGA OCHIQ (${qCountStr4})`;
      if (String(prevVal) === "4" || !prevVal || parseInt(prevVal) < 4) {
        opt.selected = true;
      }
    } else if (num === 5 || num === 6) {
      opt.disabled = false;
      opt.style.color = '#1e293b';
      const qCountStr56 = is12 ? "40 ta savol" : "25 ta savol";
      opt.textContent = `📅 ${num}-mashg'ulot${dateLabel} — ⏳ Tayyor / Navbatdagi (${qCountStr56})`;
      if (String(prevVal) === String(num)) {
        opt.selected = true;
      }
    } else {
      opt.disabled = true;
      opt.style.color = '#cbd5e1';
      opt.textContent = `${num}-mashg'ulot${dateLabel} — 🔒 Reja bo'yicha`;
    }
    sessionSelect.appendChild(opt);
  }

  if (!sessionSelect.value || parseInt(sessionSelect.value) < 4) {
    sessionSelect.value = "4";
  }
}

function mapSubjectToKrs(raw) {
  const s = raw.toLowerCase();
  if (s.includes('boshlang') || s.includes('savod') || s.includes('ўқиш') || s.includes('nutq') || s.includes('нутқ') || s.includes('o‘qish') || s.includes('alifbe')) return "Boshlang'ich ta'lim";
  if (s.includes('matemat') || s.includes('algebra') || s.includes('geometr')) return "Matematika";
  if (s.includes('informat') || s.includes('axborot')) return "Informatika";
  if (s.includes('ona tili') || s.includes('adabiyot') || s.includes('ўзбек тили') || s.includes('o\'zbek tili')) return "Ona tili";
  if (s.includes('nemis') || s.includes('deutsch')) return "Nemis tili";
  if (s.includes('fransuz') || s.includes('franc') || s.includes('франсуз')) return "Fransuz tili";
  if (s.includes('ingliz') || s.includes('english') || s.includes('chet tili') || s.includes('япон')) return "English";
  if (s.includes('rus') || s.includes('рус') || s.includes('логопед')) return "Rus tili";
  if (s.includes('biolog') || s.includes('tabiiy') || s.includes('botan') || s.includes('zoolog')) return "Biologiya";
  if (s.includes('fizik') || s.includes('astronom')) return "Fizika";
  if (s.includes('kimyo')) return "Kimyo";
  if (s.includes('geograf') || s.includes('iqtisod') || s.includes('иқтисод')) return "Geografiya";
  if (s.includes('huquq') || s.includes('давлат') || s.includes('ҳуқуқ')) return "Huquq";
  if (s.includes('tarix') || s.includes('тарих') || s.includes('tarbiya') || s.includes('ориентация') || s.includes('тадбиркор')) return "Tarix";
  if (s.includes('tasviriy') || s.includes('chizma') || s.includes('тасвирий') || s.includes('чизма')) return "Tasviriy san'at";
  if (s.includes('texnolog') || s.includes('mehnat') || s.includes('технолог') || s.includes('меҳнат') || s.includes('musiqa') || s.includes('jismoniy') || s.includes('касбий') || s.includes('военная')) return "Texnologiya";
  return null;
}

// ==========================================
// QUESTIONS DATABASE LOADER
// ==========================================
async function loadQuestionsDatabase() {
  if (typeof window !== 'undefined' && window.QUESTIONS_DB && window.QUESTIONS_DB.length > 0) {
    state.allQuestions = window.QUESTIONS_DB;
    return;
  }
  try {
    const res = await fetch('questions.json');
    if (res.ok) {
      state.allQuestions = await res.json();
    }
  } catch (err) {
    console.warn("questions.json yuklanmadi:", err);
  }
}


// ==========================================
// UNIVERSAL CENTERED APP DIALOGS (REPLACING NATIVE BROWSER ALERT & CONFIRM)
// ==========================================
let appDialogCallback = null;

function showAppAlert(message, title = "Diqqat!", icon = "⚠️") {
  const modal = document.getElementById('appDialogModal');
  if (!modal) {
    console.warn("Alert:", message);
    return;
  }
  const iconEl = document.getElementById('appDialogIcon');
  const titleEl = document.getElementById('appDialogTitle');
  const msgEl = document.getElementById('appDialogMessage');
  const cancelBtn = document.getElementById('appDialogCancelBtn');
  const okBtn = document.getElementById('appDialogOkBtn');

  if (iconEl) iconEl.textContent = icon;
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.innerHTML = (message || '').replace(/\n/g, '<br>');
  if (cancelBtn) cancelBtn.style.display = 'none';

  if (okBtn) {
    okBtn.textContent = "Tushundim";
    okBtn.className = "btn btn-primary";
  }
  appDialogCallback = null;
  modal.classList.add('open');
}
window.showAppAlert = showAppAlert;
window.alert = function(msg) {
  showAppAlert(msg);
};

function showAppConfirm(message, onConfirm, title = "Tasdiqlang", icon = "⚠️", confirmText = "Ha, tasdiqlayman", confirmClass = "btn btn-danger") {
  const modal = document.getElementById('appDialogModal');
  if (!modal) {
    if (confirm(message)) onConfirm();
    return;
  }
  const iconEl = document.getElementById('appDialogIcon');
  const titleEl = document.getElementById('appDialogTitle');
  const msgEl = document.getElementById('appDialogMessage');
  const cancelBtn = document.getElementById('appDialogCancelBtn');
  const okBtn = document.getElementById('appDialogOkBtn');

  if (iconEl) iconEl.textContent = icon;
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.innerHTML = (message || '').replace(/\n/g, '<br>');

  if (cancelBtn) {
    cancelBtn.style.display = 'inline-block';
    cancelBtn.textContent = "Bekor qilish";
  }

  if (okBtn) {
    okBtn.textContent = confirmText;
    okBtn.className = confirmClass;
  }
  appDialogCallback = onConfirm;
  modal.classList.add('open');
}
window.showAppConfirm = showAppConfirm;

function handleAppDialogOk() {
  const modal = document.getElementById('appDialogModal');
  if (modal) modal.classList.remove('open');
  if (typeof appDialogCallback === 'function') {
    const cb = appDialogCallback;
    appDialogCallback = null;
    cb();
  }
}
window.handleAppDialogOk = handleAppDialogOk;

function handleAppDialogCancel() {
  const modal = document.getElementById('appDialogModal');
  if (modal) modal.classList.remove('open');
  appDialogCallback = null;
}
window.handleAppDialogCancel = handleAppDialogCancel;

// ==========================================
// SMART ANTI-CHEAT & PHONE CALL IMMUNITY
// ==========================================
function closeAntiCheatModal() {
  const modal = document.getElementById('antiCheatModal');
  if (modal) modal.classList.remove('open');
  state.awayStartTime = 0;
  if (state.isExamActive && !state.isBlocked) {
    applyExamBlurMask(false);
  }
}
window.closeAntiCheatModal = closeAntiCheatModal;

// HTML Escape Helper (Xavfsizlik va <teg> larning to'g'ri ko'rinishi uchun)
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;

// Test maydonidan chalg'ilganda savollarni xira qilish VA DOM matnini butunlay tozalash (Gemini/AI o'qiy olmasligi uchun!)
function applyExamBlurMask(isBlur) {
  const examLayout = document.querySelector('.exam-layout');
  let overlay = document.getElementById('examSecurityOverlay');

  if (isBlur) {
    // 1. DOM matnini (savol va variantlarni) butunlay o'chirish — Chrome Gemini va kengaytmalar HTML koddan ham o'qiy olmaydi!
    const qTextEl = document.getElementById('questionText');
    const optsEl = document.getElementById('optionsContainer');
    const topicEl = document.getElementById('currentQTopic');
    const imgBoxEl = document.getElementById('questionImageBox');

    if (qTextEl) qTextEl.textContent = "🔒 Xavfsizlik tizimi: Test maydoni nofaol bo'lgani uchun savol matni yashirildi.";
    if (optsEl) optsEl.innerHTML = '';
    if (topicEl) topicEl.textContent = "🔒 Yashirildi";
    if (imgBoxEl) imgBoxEl.style.display = 'none';

    if (examLayout) {
      examLayout.classList.add('exam-blurred');
    }
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'examSecurityOverlay';
      overlay.className = 'exam-security-overlay';
      overlay.innerHTML = `
        <div class="exam-security-card">
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">🚨</div>
          <h3 style="color: #ef4444; margin-bottom: 0.5rem; font-weight: 800; font-size: 1.3rem;">DIQQAT: TEST MAYDONI NOFAOL!</h3>
          <p style="color: #334155; font-size: 0.95rem; line-height: 1.5; margin-bottom: 1rem;">
            Kursoringiz test maydonidan tashqariga (Google Gemini, boshqa oyna yoki yon panelga) o'tdi!<br>
            <b>Xavfsizlik maqsadida savollar xotiradan yashirildi va vaqt hisoblanmoqda.</b>
          </p>
          <div style="background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 0.75rem 1rem; border-radius: 8px; font-weight: 700; font-size: 0.88rem; margin-bottom: 1.25rem;">
            ⚠️ 4 marta takrorlansa, test avtomatik ravishda 0 ball bilan BLOKLANADI!
          </div>
          <button type="button" class="btn btn-primary" onclick="window.focus(); applyExamBlurMask(false);" style="padding: 0.75rem 2rem; font-weight: 800; font-size: 0.95rem;">
            TESTGA QAYTISH ➡
          </button>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
  } else {
    if (examLayout) {
      examLayout.classList.remove('exam-blurred');
    }
    if (overlay) {
      overlay.style.display = 'none';
    }
    // 2. Testga qaytganda savol va variantlarni xotiradan darhol qayta tiklash
    if (state.isExamActive && !state.isBlocked && typeof renderQuestion === 'function') {
      renderQuestion();
    }
  }
}
window.applyExamBlurMask = applyExamBlurMask;

function setupAntiCheatListeners() {
  const triggerViolation = (awayMs) => {
    if (!state.isExamActive || state.isBlocked) return;
    if (document.getElementById('antiCheatModal')?.classList.contains('open')) return;

    state.tabSwitchCount++;
    saveActiveSession();
    updateAntiCheatIndicator();

    const awaySec = Math.round(awayMs / 1000);

    if (state.tabSwitchCount === 1) {
      showAntiCheatModal(
        "⚠️",
        "OGOHLANTIRISH (1/3)!",
        `Siz test maydonidan chiqib, boshqa ilova, oyna yoki yon panelga (Gemini va h.k.) o'tdingiz!<br>
        Uzoqlashgan vaqtingiz: <b>${awaySec} soniya</b>.<br>
        <b>Qoidabuzarlik qayd etildi (Chiqishlar: 1).</b><br>
        <span style="color: var(--danger); font-weight: 700;">4-marta takrorlansa, testingiz avtomatik BLOKLANADI!</span>`
      );
    } else if (state.tabSwitchCount === 2) {
      showAntiCheatModal(
        "⚠️",
        "OGOHLANTIRISH (2/3)!",
        `Siz yana test maydonidan chiqdingiz (${awaySec} soniya)!<br>
        <b>Qoidabuzarlik soni: 2 ta.</b><br>
        <span style="color: var(--warning); font-weight: 700;">Iltimos, diqqatingizni testda saqlang! Yana 2 ta chiqish qoldi.</span>`
      );
    } else if (state.tabSwitchCount === 3) {
      showAntiCheatModal(
        "🚨",
        "OXIRGI OGOHLANTIRISH (3/3)!",
        `<b>OGOH BO'LING! Qoidabuzarlik soni 3 taga yetdi (${awaySec} soniya).</b><br>
        <span style="color: var(--danger); font-weight: 800; font-size: 1.05rem;">
          AGAR YANA 1 MARTA CHIQSIZ (4-marta), TEST SHU ZAHOTIYOQ BLOKLANADI VA 0 BALL BILAN BEKOR QILINADI!
        </span>`
      );
    } else if (state.tabSwitchCount >= 4) {
      blockExamDueToCheating();
    }
  };

  const handleLeave = () => {
    if (!state.isExamActive || state.isBlocked) return;
    // DOM matnini har qanday holatda (hatto modal ochiq bo'lsa ham) darhol tozalaymiz!
    applyExamBlurMask(true);
    if (document.getElementById('antiCheatModal')?.classList.contains('open')) return;
    if (state.awayStartTime === 0) {
      state.awayStartTime = Date.now();
    }
  };

  const handleReturn = () => {
    if (!state.isExamActive || state.isBlocked) return;
    applyExamBlurMask(false);

    if (state.awayStartTime > 0) {
      const awayMs = Date.now() - state.awayStartTime;
      state.awayStartTime = 0;

      // 3 soniyadan ortiq bo'lsa (yon panel, boshqa oyna, sun'iy intellekt) qoidabuzarlik yoziladi
      if (awayMs >= 3000) {
        triggerViolation(awayMs);
      } else if (awayMs >= 800) {
        showToast(`Qisqa chalg'ish (${Math.max(1, Math.round(awayMs/1000))} soniya). Test maydonidan chiqmang!`, "⚠️");
      }
    }
  };

  // 1. Tab yashirilganda / minimallashtirilganda
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      handleLeave();
    } else {
      handleReturn();
    }
  });

  // 2. Kursor test oynasidan tashqariga (Gemini, yon panel, devtools, boshqa ilova) chiqqanda
  window.addEventListener('blur', () => {
    handleLeave();
  });

  window.addEventListener('focus', () => {
    handleReturn();
  });

  // 3. Matnni belgilash, nusxalash (kopirovat) va o'ng tugmani taqiqlash
  document.addEventListener('contextmenu', (e) => {
    if (state.isExamActive && !state.isBlocked) {
      e.preventDefault();
      showToast("Test paytida kontekst menyuni (o'ng tugmani) ochish taqiqlangan!", "🚫");
      return false;
    }
  });

  document.addEventListener('copy', (e) => {
    if (state.isExamActive && !state.isBlocked) {
      e.preventDefault();
      showToast("Test savollarini nusxalash qat'iyan taqiqlangan!", "🚫");
      return false;
    }
  });

  document.addEventListener('cut', (e) => {
    if (state.isExamActive && !state.isBlocked) {
      e.preventDefault();
      return false;
    }
  });

  document.addEventListener('selectstart', (e) => {
    if (state.isExamActive && !state.isBlocked) {
      if (!e.target.closest('input, textarea')) {
        e.preventDefault();
        return false;
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (state.isExamActive && !state.isBlocked) {
      if ((e.ctrlKey || e.metaKey) && ['c', 'C', 'a', 'A', 'u', 'U', 's', 'S', 'p', 'P'].includes(e.key)) {
        e.preventDefault();
        showToast("Klaviatura orqali nusxalash cheklangan!", "🚫");
        return false;
      }
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key))) {
        e.preventDefault();
        return false;
      }
    }
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

// ==========================================
// BLOCKING & SAVING BLOCKED TEACHER
// ==========================================
function blockExamDueToCheating() {
  state.isExamActive = false;
  state.isBlocked = true;
  clearInterval(state.timerInterval);
  clearSavedSession();
  applyExamBlurMask(false);

  // Bloklanganda FAQAT 'BLOKLANGANLAR' varag'iga saqlanadi (Varaq1 asosiy natijalar varag'iga yozilmaydi!)
  saveTeacherToBlockedList(state.teacherInfo, state.tabSwitchCount);

  document.getElementById('antiCheatModal')?.classList.remove('open');
  document.getElementById('confirmModal')?.classList.remove('open');

  const unblockBtn = document.getElementById('blockedViewUnblockBtn');
  if (unblockBtn && state.teacherInfo) {
    unblockBtn.href = generateTelegramBotLink('unblock', {
      name: state.teacherInfo.name || '',
      school: state.teacherInfo.school || '',
      subject: state.teacherInfo.subject || ''
    });
  }

  switchView('blocked', true);
  loadLeaderboardFromSheet();
}


// ==========================================
// SEND RECORD TO GOOGLE SHEETS (REAL-TIME LIVE SYNC)
// ==========================================
async function sendRecordToGoogleSheets(payload) {
  const submitUrl = window.GOOGLE_SHEET_SUBMIT_URL || GOOGLE_SHEET_SUBMIT_URL;
  if (!submitUrl) return;

  try {
    // Mode 'no-cors' allows browser to send cross-origin POST to Google Apps Script without CORS errors
    await fetch(submitUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    console.log("Google Sheets-ga muvaffaqiyatli jo'natildi:", payload.type, payload.name);
  } catch (err) {
    console.warn("Google Sheets-ga yuborishda xatolik:", err);
    if (typeof enqueueSubmissionRecord === 'function') {
      enqueueSubmissionRecord(payload);
    }
  }
}
window.sendRecordToGoogleSheets = sendRecordToGoogleSheets;

function saveTeacherToBlockedList(teacherInfo, switchCount) {
  try {
    const raw = localStorage.getItem(BLOCKED_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    
    // Check if already in list
    const existingIdx = list.findIndex(item => item.name.toLowerCase() === teacherInfo.name.toLowerCase());
    const record = {
      name: teacherInfo.name,
      school: teacherInfo.school,
      subject: teacherInfo.subject,
      switchCount: switchCount || 4,
      status: '🚫 Bloklangan',
      permission: 'Yopiq', // Admin must change to "Ochiq" to allow retake
      blockedAt: getTashkentDateTimeString()
    };

    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.push(record);
    }

    localStorage.setItem(BLOCKED_STORAGE_KEY, JSON.stringify(list));

    // Real vaqtda Google Sheet BLOKLANGANLAR varag'iga jo'natish
    sendRecordToGoogleSheets({
      type: 'BLOCKED',
      timestamp: getTashkentDateTimeString(),
      name: teacherInfo.name,
      school: teacherInfo.school,
      subject: teacherInfo.subject,
      switchCount: switchCount || 4,
      status: '🚫 Bloklangan (Qoidabuzarlik)',
      permission: 'Yopiq',
      reason: "Test vaqtida ruxsatsiz 4 marta sahifadan chiqdi"
    });
  } catch (err) {
    console.warn("Bloklanganlar ro'yxatini saqlashda xatolik:", err);
  }
}

/**
 * Check if the teacher has been blocked and whether admin allowed them to retake
 * Returns { isBlocked: boolean, allowed: boolean, reason: string }
 */
async function checkTeacherBlockedPermission(teacherName) {
  const normName = teacherName.trim().toLowerCase();

  // 1. Check Live Google Sheet BLOKLANGANLAR varag'i (cache-bust bilan, yagona rasmiy manba)
  let sheetChecked = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const cacheUrl = BLOCKED_SHEET_URL + '&_t=' + Date.now();
    const res = await fetch(cacheUrl, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timeoutId);
    if (res.ok) {
      sheetChecked = true;
      const csvText = await res.text();
      const rows = parseCsv(csvText);
      // Eng oxirgi (eng yangi) blok holatini tekshirish uchun pastdan yuqoriga qarab o'qiymiz
      for (let i = rows.length - 1; i >= 1; i--) {
        const row = rows[i];
        const rowName = (row[1] || '').trim().toLowerCase();
        if (rowName && rowName === normName) {
          const ruxsat = (row[6] || '').trim().toLowerCase();
          if (ruxsat === 'ochiq') {
            // Admin granted permission from Google Sheet!
            return { isBlocked: false, allowed: true };
          } else {
            // Still locked in Google Sheet
            return {
              isBlocked: true,
              allowed: false,
              reason: "Google Sheetdagi 'BLOKLANGANLAR' ro'yxatida 'Qayta_Topshirishga_Ruxsat' holati 'Yopiq' deb belgilangan."
            };
          }
        }
      }
      // If successfully fetched and teacher is NOT in sheet (or sheet was cleared by admin):
      // Clean up local storage and allow them!
      try {
        const raw = localStorage.getItem(BLOCKED_STORAGE_KEY);
        if (raw) {
          let list = JSON.parse(raw);
          list = list.filter(item => item.name && item.name.toLowerCase() !== normName);
          localStorage.setItem(BLOCKED_STORAGE_KEY, JSON.stringify(list));
        }
      } catch (e) {}
      return { isBlocked: false, allowed: true };
    }
  } catch (err) {
    console.warn("BLOKLANGANLAR sheetini tekshirishda xatolik:", err);
  }

  // 2. Only if Google Sheet was completely unreachable (offline), fallback to local storage
  if (!sheetChecked) {
    try {
      const raw = localStorage.getItem(BLOCKED_STORAGE_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        const found = list.find(item => item.name && item.name.toLowerCase() === normName);
        if (found) {
          if (found.permission && found.permission.toLowerCase() === 'ochiq') {
            return { isBlocked: false, allowed: true };
          } else {
            return {
              isBlocked: true,
              allowed: false,
              reason: "Siz avval ushbu qurilmada test topshirish jarayonida 4 marta qoidabuzarlik sodir etib bloklangansiz."
            };
          }
        }
      }
    } catch (err) {}
  }

  return { isBlocked: false, allowed: true };
}

// ==========================================
// SESSION RESUMPTION
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
// ==========================================
// GEOFENCING & LOCATION DETECTION (MAKTAB HUDUDI NAZORATI)
// ==========================================
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Yer radiusi metrlarda
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function isMobileUserAgent() {
  const ua = navigator.userAgent || navigator.vendor || window.opera || '';
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

function detectTeacherLocation(schoolName) {
  return new Promise((resolve) => {
    // 1. Kompyuter (Desktop) aniqlash
    if (!isMobileUserAgent()) {
      resolve({
        status: "💻 Kompyuter (Maktab xonasi)",
        distance: 0,
        coords: "Desktop PC"
      });
      return;
    }

    // 2. Mobil qurilma - Geolocation mavjudligini tekshirish
    if (!navigator.geolocation) {
      resolve({
        status: "⚠️ GPS qo'llab-quvvatlanmaydi",
        distance: -1,
        coords: "No GPS"
      });
      return;
    }

    // Maktab koordinatasini aniqlash
    let targetCoords = null;
    if (window.SCHOOL_COORDINATES) {
      const normSchool = (schoolName || '').trim().toLowerCase();
      for (const [key, val] of Object.entries(window.SCHOOL_COORDINATES)) {
        if (normSchool.includes(key.toLowerCase()) || key.toLowerCase().includes(normSchool)) {
          targetCoords = val;
          break;
        }
      }
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = pos.coords.latitude;
        const uLon = pos.coords.longitude;
        const coordStr = `${uLat.toFixed(5)}, ${uLon.toFixed(5)}`;

        if (targetCoords) {
          const dist = calculateHaversineDistance(uLat, uLon, targetCoords.lat, targetCoords.lng);
          if (dist <= 250) {
            resolve({
              status: `✅ Maktabda (${dist}m)`,
              distance: dist,
              coords: coordStr
            });
          } else {
            resolve({
              status: `⚠️ Masofadan (${dist}m)`,
              distance: dist,
              coords: coordStr
            });
          }
        } else {
          resolve({
            status: `📍 Mobil GPS aniqlandi`,
            distance: -1,
            coords: coordStr
          });
        }
      },
      (err) => {
        let reason = "❌ GPS o'chirilgan";
        if (err.code === 1) reason = "❌ GPS ruxsati berilmadi";
        else if (err.code === 2) reason = "❌ GPS signali yo'q";
        else if (err.code === 3) reason = "❌ GPS vaqti tugadi";

        resolve({
          status: reason,
          distance: -1,
          coords: "GPS_DENIED_OR_OFF"
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 30000
      }
    );
  });
}
window.detectTeacherLocation = detectTeacherLocation;

async function handleValidateAndOpenPinModal(e) {
  if (e && e.preventDefault) e.preventDefault();

  const schoolSelect = document.getElementById('schoolSelect');
  const teacherSelect = document.getElementById('teacherSelect');
  const customSchoolInput = document.getElementById('customSchoolInput');
  const customTeacherInput = document.getElementById('customTeacherInput');
  const subjectSelect = document.getElementById('subjectSelect');
  const startBtn = document.getElementById('startTestBtn');

  let school = schoolSelect ? schoolSelect.value : '';
  if (school === 'CUSTOM_SCHOOL') school = customSchoolInput ? customSchoolInput.value.trim() : '';
  if (!school) {
    alert("Iltimos, ta'lim muassasasi (maktab)ni tanlang yoki nomini kiriting!");
    schoolSelect?.focus();
    return;
  }

  const subject = subjectSelect ? subjectSelect.value : '';
  if (!subject) {
    alert("Iltimos, KRS dars beradigan faningizni tanlang!");
    subjectSelect?.focus();
    return;
  }

  let name = teacherSelect ? teacherSelect.value : '';
  if (name === 'CUSTOM_TEACHER') name = customTeacherInput ? customTeacherInput.value.trim() : '';
  if (!name) {
    alert("Iltimos, o'qituvchi F.I.Sh. (Familiya Ism Sharif)ingizni tanlang yoki kiriting!");
    teacherSelect?.focus();
    return;
  }

  const originalBtnText = startBtn ? startBtn.innerHTML : '';
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.textContent = '⏳ Tekshirilmoqda...';
  }

  try {
    // Agar savollar bazasi yuklanmagan bo'lsa, tezda yuklaymiz
    if (!state.allQuestions || state.allQuestions.length === 0) {
      await loadQuestionsDatabase();
    }

    // CHECK IF TEACHER IS BLOCKED (Fast check)
    const blockCheck = await checkTeacherBlockedPermission(name);
    if (blockCheck.isBlocked && !blockCheck.allowed) {
      const textEl = document.getElementById('teacherBlockedText');
      if (textEl) {
        textEl.innerHTML = `
          Hurmatli <b>${name}</b>!<br>
          Siz test jarayonida 4 marta qoidabuzarlik qilganingiz sababli tizim tomonidan chetlatilgansiz.<br>
          <b>Sabab:</b> ${blockCheck.reason}<br><br>
          Qayta topshirish uchun quyidagi <b>'Bot orqali ruxsat olish'</b> tugmasini bosing yoki bosh mutaxassis Umrbek Mamatovga murojaat qiling.
        `;
      }

      // Blokdan chiqarish tugmasini botga ulash
      const unblockBtn = document.getElementById('unblockViaBotBtn');
      if (unblockBtn) {
        const payload = {
          name: name,
          school: school,
          subject: subject
        };
        unblockBtn.href = generateTelegramBotLink('unblock', payload);
      }

      document.getElementById('teacherBlockedModal')?.classList.add('open');
      return;
    }

    const sessionSelect = document.getElementById('sessionSelect');
    const session = parseInt(sessionSelect ? sessionSelect.value : 4) || 4;

    // Joylashuvni aniqlash (fon rejimida 5 soniya)
    if (startBtn) startBtn.textContent = '📍 Joylashuv tekshirilmoqda...';
    const locInfo = await detectTeacherLocation(school);

    state.teacherInfo = { 
      name, 
      school, 
      subject, 
      session,
      locationStatus: locInfo.status,
      distanceMeters: locInfo.distance,
      coords: locInfo.coords
    };

    if (remoteControl && remoteControl.status && remoteControl.status.toLowerCase() === 'yopiq') {
      const textEl = document.getElementById('systemClosedNoticeText');
      if (textEl) {
        textEl.innerHTML = `
          Bosh mutaxassis Umrbek Mamatov tomonidan test topshirish vaqtincha to'xtatilgan yoki yopib qo'yilgan.<br>
          <b>Izoh:</b> ${remoteControl.notice || "Hozirda test topshirish yopiq."}<br>
          PIN-kod to'g'ri kiritilgan taqdirda ham testga kirish cheklangan.
        `;
      }
      document.getElementById('systemClosedModal')?.classList.add('open');
      return;
    }

    openPinModal();
  } catch (err) {
    console.error("Testni boshlash tekshiruvida xatolik:", err);
    openPinModal(); // Xato bo'lsa ham foydalanuvchini to'xtatmaymiz!
  } finally {
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.innerHTML = originalBtnText;
    }
  }
}
window.handleValidateAndOpenPinModal = handleValidateAndOpenPinModal;

// ==========================================
// TELEGRAM MONKEY MASCOT & PIN VISIBILITY
// ==========================================
function getTelegramMonkeySvgHtml(size, extraClass = '') {
  return `
  <svg viewBox="0 0 64 64" width="${size}" height="${size}" class="telegram-monkey-svg hidden-pin ${extraClass}">
    <g class="monkey-ears">
      <circle cx="10" cy="27" r="9.5" fill="#8D6E63"/>
      <circle cx="10" cy="27" r="5.5" fill="#FFCCBC"/>
      <circle cx="54" cy="27" r="9.5" fill="#8D6E63"/>
      <circle cx="54" cy="27" r="5.5" fill="#FFCCBC"/>
    </g>
    <circle cx="32" cy="32" r="23" fill="#8D6E63" class="monkey-head"/>
    <ellipse cx="32" cy="38" rx="16.5" ry="12.5" fill="#FDF3E7"/>
    <ellipse cx="32" cy="27" rx="15" ry="8.5" fill="#FDF3E7"/>
    <g class="monkey-eyes">
      <circle cx="23.5" cy="26" r="5.2" fill="#212529"/>
      <circle cx="22" cy="24.2" r="2" fill="#FFFFFF"/>
      <circle cx="25.5" cy="27.5" r="0.9" fill="#FFFFFF"/>
      <circle cx="40.5" cy="26" r="5.2" fill="#212529"/>
      <circle cx="39" cy="24.2" r="2" fill="#FFFFFF"/>
      <circle cx="42.5" cy="27.5" r="0.9" fill="#FFFFFF"/>
    </g>
    <circle cx="16.5" cy="35" r="3.2" fill="#FFAB91" opacity="0.65"/>
    <circle cx="47.5" cy="35" r="3.2" fill="#FFAB91" opacity="0.65"/>
    <ellipse cx="32" cy="33.5" rx="3.2" ry="2.2" fill="#4E342E"/>
    <path d="M 26 38.5 Q 32 43.5 38 38.5" fill="none" stroke="#4E342E" stroke-width="2.2" stroke-linecap="round"/>
    <g class="monkey-paws">
      <g class="paw-left">
        <ellipse cx="23.5" cy="26" rx="9" ry="7.5" fill="#6D4C41" stroke="#4E342E" stroke-width="1.3"/>
        <circle cx="19.5" cy="25" r="2" fill="#FFCCBC"/>
        <circle cx="23.5" cy="23.5" r="2" fill="#FFCCBC"/>
        <circle cx="27.5" cy="25" r="2" fill="#FFCCBC"/>
      </g>
      <g class="paw-right">
        <ellipse cx="40.5" cy="26" rx="9" ry="7.5" fill="#6D4C41" stroke="#4E342E" stroke-width="1.3"/>
        <circle cx="36.5" cy="25" r="2" fill="#FFCCBC"/>
        <circle cx="40.5" cy="23.5" r="2" fill="#FFCCBC"/>
        <circle cx="44.5" cy="25" r="2" fill="#FFCCBC"/>
      </g>
    </g>
  </svg>
  `;
}

function togglePinVisibility() {
  const pinInput = document.getElementById('pinInput');
  if (!pinInput) return;
  const isCurrentlyPassword = (pinInput.type === 'password');
  updateMonkeyPinState(isCurrentlyPassword);
  pinInput.focus();
}
window.togglePinVisibility = togglePinVisibility;

function updateMonkeyPinState(isRevealed) {
  const pinInput = document.getElementById('pinInput');
  const toggleBtn = document.getElementById('togglePinVisibilityBtn');
  const monkeySvgs = document.querySelectorAll('.telegram-monkey-svg');
  const eyeClosed = document.getElementById('eyeClosedSvg');
  const eyeOpen = document.getElementById('eyeOpenSvg');

  if (pinInput) {
    pinInput.type = isRevealed ? 'text' : 'password';
  }

  monkeySvgs.forEach(svg => {
    if (isRevealed) {
      svg.classList.remove('hidden-pin');
      svg.classList.add('revealed-pin');
    } else {
      svg.classList.remove('revealed-pin');
      svg.classList.add('hidden-pin');
    }
  });

  if (eyeClosed && eyeOpen) {
    eyeClosed.style.display = isRevealed ? 'none' : 'block';
    eyeOpen.style.display = isRevealed ? 'block' : 'none';
  }

  if (toggleBtn) {
    const title = isRevealed ? "PIN-kodni yashirish (Ko'zlarni yopish)" : "PIN-kodni ko'rsatish (Ko'zlarni ochish)";
    toggleBtn.setAttribute('title', title);
    toggleBtn.setAttribute('aria-label', title);
  }
}
window.updateMonkeyPinState = updateMonkeyPinState;

function setupPinToggleVisibility() {
  updateMonkeyPinState(false);
}

function openPinModal() {
  const pinInput = document.getElementById('pinInput');
  if (pinInput) {
    pinInput.value = '';
  }
  updateMonkeyPinState(false);

  // Botdan PIN-kod olish havolasini tayyorlash
  const botBtn = document.getElementById('getPinFromBotBtn');
  if (botBtn && state.teacherInfo) {
    const payload = {
      name: state.teacherInfo.name || '',
      school: state.teacherInfo.school || '',
      subject: state.teacherInfo.subject || '',
      session: state.teacherInfo.session || 4
    };
    botBtn.href = generateTelegramBotLink('pin', payload);
  }

  document.getElementById('pinModal').classList.add('open');
  setTimeout(() => pinInput?.focus(), 200);
}
window.openPinModal = openPinModal;

function closePinModal() {
  document.getElementById('pinModal').classList.remove('open');
}
window.closePinModal = closePinModal;

// Fan va mashg'ulot bo'yicha KRS sanasini aniqlash (15-ilova jadvali)
function getSubjectKrsSessionSchedule(subjectName, sessionNum) {
  if (!subjectName) return null;
  const num = parseInt(sessionNum) || 4;
  const cleanSubject = String(subjectName).trim().toLowerCase();

  if (typeof KRS_SCHEDULE !== 'undefined' && Array.isArray(KRS_SCHEDULE)) {
    const matched = KRS_SCHEDULE.find(item => 
      item.targetSubjects && item.targetSubjects.some(s => {
        const cs = s.trim().toLowerCase();
        return cleanSubject.includes(cs) || cs.includes(cleanSubject);
      })
    );
    if (matched && Array.isArray(matched.dates)) {
      const d = matched.dates.find(x => x.num === num);
      if (d) {
        return {
          date: d.date,
          label: d.label,
          weekday: matched.weekday,
          title: matched.title
        };
      }
    }
  }
  return null;
}
window.getSubjectKrsSessionSchedule = getSubjectKrsSessionSchedule;

async function handlePinSubmit() {
  try {
    const pinInput = document.getElementById('pinInput');
    const pinVal = pinInput ? pinInput.value.trim() : '';
    if (!pinVal || pinVal.length !== 4) {
      alert("Iltimos, 4 xonali PIN-kodni to'liq kiriting!");
      pinInput?.focus();
      return;
    }

    const sessionSelect = document.getElementById('sessionSelect');
    const selectedSession = parseInt(sessionSelect ? sessionSelect.value : (state.teacherInfo?.session || 4)) || 4;
    const selectedSubject = state.teacherInfo?.subject || document.getElementById('subjectSelect')?.value || '';

    // 1. UNIVERSAL MASTER PIN (Bosh mutaxassis Umrbek Mamatov uchun)
    // Google Jadval D2 katagidagi qiymat (yoki 1984). Jadvalda xohlagan payt qo'lda o'zgartirish mumkin!
    const activeMasterPin = (remoteControl && remoteControl.masterPin) ? remoteControl.masterPin.trim() : "1984";
    const isMasterPin = (pinVal === activeMasterPin || pinVal === "1984");

    if (isMasterPin) {
      closePinModal();
      console.log("👑 Universal Master PIN qabul qilindi. Barcha cheklovlar bekor qilindi (Bosh mutaxassis nazorat rejimi).");
      startExamSession();
      return;
    }

    // 2. KUNLIK GRAFIK PIN KOD (O'qituvchilar uchun tekshiruv - faqat jadvaldagi grafik kodlari!)
    const todayStr = getTodayTashkentDate();
    let calculatedTodayPin = "";
    try {
      calculatedTodayPin = await calculateDailyPin(todayStr);
    } catch (e) {}

    const remotePin = remoteControl && remoteControl.pin ? String(remoteControl.pin).trim() : "";
    const isDailyPin = (
      (remotePin && pinVal === remotePin) ||
      (calculatedTodayPin && pinVal === calculatedTodayPin)
    );

    if (isDailyPin) {
      const todayStr = getTodayTashkentDate();
      const sched = getSubjectKrsSessionSchedule(selectedSubject, selectedSession);

      // A) O'tib ketgan mashg'ulotlar (1-, 2-, 3-mashg'ulot) — o'tib ketgan bo'lsa HAMMAGA OCHIQ:
      if (selectedSession <= 3) {
        closePinModal();
        startExamSession();
        return;
      }

      // B) Hali kuni kelmagan fan yoki mashg'ulot bo'lsa (KRS sanasi hali yetib kelmagan):
      if (sched && sched.date > todayStr) {
        alert(
          `🔒 DIQQAT: ${selectedSubject} fani bo'yicha ${selectedSession}-mashg'ulot KRS kuni hali kelmagan!\n\n` +
          `Ushbu fan bo'yicha test tasdiqlangan 15-ilova reja-grafigi bo'yicha ${sched.label} (${sched.weekday}) kuni o'tkaziladi.\n\n` +
          `O'qituvchilar faqat o'z fanining KRS kuni yoki muddati o'tib ketgan mashg'ulotlar (1-, 2-, 3-mashg'ulot) testlarini topshirishlari mumkin.\n\n` +
          `(Kelgusi fan va mashg'ulotlarni oldindan tekshirish faqat Bosh mutaxassis Universal PIN-kodi orqali amalga oshiriladi).`
        );
        if (pinInput) {
          pinInput.value = '';
          pinInput.focus();
        }
        return;
      }

      // C) Agar mashg'ulot raqami 4 dan katta bo'lsa (5..12) va sanasi kelmagan bo'lsa:
      if (selectedSession > 4) {
        alert(
          `🔒 DIQQAT: ${selectedSession}-mashg'ulot kuni hali kelmagan!\n\n` +
          `Ushbu mashg'ulot tasdiqlangan reja-grafik bo'yicha belgilangan sanada ochiladi.\n\n` +
          `O'qituvchilar uchun o'tib ketgan (1-, 2-, 3-mashg'ulotlar) hamda joriy (4-mashg'ulot) ochiq.\n` +
          `(Kelgusi mashg'ulotlarni muddatidan oldin tekshirish faqat Bosh mutaxassis Universal PIN-kodi orqali amalga oshiriladi).`
        );
        if (pinInput) {
          pinInput.value = '';
          pinInput.focus();
        }
        return;
      }

      // D) Agar tizim bosh mutaxassis tomonidan vaqtincha to'xtatilgan bo'lsa:
      if (remoteControl && remoteControl.status && remoteControl.status.toLowerCase() === 'yopiq') {
        alert("Bosh mutaxassis tomonidan test tizimi vaqtincha to'xtatilgan:\n" + (remoteControl.notice || "Hozirda test topshirish yopiq."));
        return;
      }

      // Hammasi to'g'ri (bugungi fan yoki ochiq mashg'ulot)
      closePinModal();
      startExamSession();
      return;
    }

    // Noto'g'ri PIN
    alert("Kiritilgan PIN-kod noto'g'ri!\nAmaldagi PIN-kodni olish uchun Qo'shko'pir tumani ta'lim bo'limi bosh mutaxassisi Umrbek Mamatovga murojaat qiling (+998 99 660 14 15).");
    if (pinInput) {
      pinInput.value = '';
      pinInput.focus();
    }
  } catch (err) {
    console.error("handlePinSubmit xatosi:", err);
    closePinModal();
    startExamSession();
  }
}
window.handlePinSubmit = handlePinSubmit;

// ==========================================
// START TEST SESSION
// ==========================================
async function startExamSession() {
  if (!state.allQuestions || state.allQuestions.length === 0) {
    if (typeof window !== 'undefined' && window.QUESTIONS_DB && window.QUESTIONS_DB.length > 0) {
      state.allQuestions = window.QUESTIONS_DB;
    } else {
      await loadQuestionsDatabase();
    }
  }

  const currentSession = parseInt(state.teacherInfo.session) || 4;
  const is12 = isCore12Subject(state.teacherInfo?.subject);
  const isSpecialSession4 = (state.teacherInfo?.subject === 'English' || state.teacherInfo?.subject === 'Rus tili') && currentSession === 4;
  const defaultCount = (is12 && (currentSession >= 5 || isSpecialSession4)) ? 40 : 25;
  const countRequested = parseInt(document.getElementById('questionCount')?.value) || defaultCount;
  state.timeLimitMinutes = parseInt(document.getElementById('timeLimit')?.value) || (countRequested === 40 ? 50 : 30);

  let matched = state.allQuestions.filter(q => {
    return q.subject && 
           q.subject.toLowerCase() === state.teacherInfo.subject.toLowerCase() &&
           q.session === currentSession;
  });

  // Agar tanlangan mashg'ulot bo'yicha aynan topilmasa, ushbu fanning barcha mavjud savollaridan olamiz (test to'xtab qolmasligi uchun)
  if (matched.length === 0) {
    matched = state.allQuestions.filter(q => {
      return q.subject && q.subject.toLowerCase() === state.teacherInfo.subject.toLowerCase();
    });
  }

  if (matched.length === 0) {
    alert("Kechirasiz, tanlangan fan bo'yicha test savollari topilmadi. Iltimos, boshqa fanni tanlang!");
    return;
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
  state.awayStartTime = 0;
  updateAntiCheatIndicator();

  document.getElementById('examHeaderTeacher').textContent = state.teacherInfo.name;
  document.getElementById('examHeaderDetails').textContent = 
    `${state.teacherInfo.school} • ${state.teacherInfo.subject} (${currentSession}-mashg'ulot)`;

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

  document.getElementById('currentQGrade').textContent = `${q.grade || q.grade_span || '1-4'}-sinf`;
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
    const text = q.options ? q.options[letter] : '';
    if (text === undefined || text === null || String(text).trim() === '') return;

    const card = document.createElement('div');
    card.className = 'option-card';
    if (state.userAnswers[state.currentIndex] === letter) {
      card.classList.add('selected');
    }

    const letterEl = document.createElement('div');
    letterEl.className = 'option-letter';
    letterEl.textContent = letter;

    const textEl = document.createElement('div');
    textEl.className = 'option-text';
    textEl.textContent = String(text); // textContent renders <a>, <h1>, <link>, <href> safely as text without HTML disappearance!

    card.appendChild(letterEl);
    card.appendChild(textEl);

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
  const nextBtn = document.getElementById('nextQBtn');
  if (isLast) {
    nextBtn.textContent = '🏁 Testni yakunlash';
  } else {
    nextBtn.textContent = 'Keyingi ➡';
  }

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
window.navigateQuestion = navigateQuestion;

function confirmAndFinishExam() {
  closeFinishModal();
  finishExam();
}
window.confirmAndFinishExam = confirmAndFinishExam;
window.openFinishModal = openFinishModal;
window.closeFinishModal = closeFinishModal;

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

function finishExam(forceSave = false) {
  state.isExamActive = false;
  clearInterval(state.timerInterval);
  clearSavedSession();
  applyExamBlurMask(false);

  let correctCount = 0;
  state.activeQuestions.forEach((q, idx) => {
    const userChoice = state.userAnswers[idx];
    if (userChoice && userChoice.toUpperCase() === q.answer.toUpperCase()) {
      correctCount++;
    }
  });

  const total = state.activeQuestions.length || 25;
  const wrongCount = total - correctCount;
  const percent = Math.round((correctCount / total) * 100);
  const timeFormatted = formatTimeHms((state.timeLimitMinutes * 60) - state.secondsRemaining);
  const sessionNum = state.teacherInfo.session || 4;

  // CHECK IF RETAKE: does this teacher already have a record for this session?
  if (!forceSave) {
    let existingRecord = null;
    try {
      const raw = localStorage.getItem(RESULTS_STORAGE_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        existingRecord = list.find(r => 
          r.name && r.name.toLowerCase() === state.teacherInfo.name.toLowerCase() &&
          r.session === sessionNum
        );
      }
    } catch (e) {}

    if (existingRecord) {
      // Show retake warning modal
      const modal = document.getElementById('retakeWarningModal');
      const teacherEl = document.getElementById('retakeModalTeacher');
      const sessEl = document.getElementById('retakeModalSession');
      const oldScoreEl = document.getElementById('retakeOldScoreBadge');
      const newScoreEl = document.getElementById('retakeNewScoreBadge');

      if (modal && teacherEl && sessEl && oldScoreEl && newScoreEl) {
        teacherEl.textContent = state.teacherInfo.name;
        sessEl.textContent = `${sessionNum}-mashg'ulot (${state.teacherInfo.subject})`;
        oldScoreEl.textContent = `${existingRecord.score} / ${existingRecord.total || 25} (${existingRecord.percent}%)`;
        newScoreEl.textContent = `${correctCount} / ${total} (${percent}%)`;
        modal.classList.add('open');

        // Bind cancel and confirm
        const cancelBtn = document.getElementById('retakeCancelBtn');
        const confirmBtn = document.getElementById('retakeConfirmBtn');

        const handleCancel = () => {
          modal.classList.remove('open');
          cancelBtn?.removeEventListener('click', handleCancel);
          confirmBtn?.removeEventListener('click', handleConfirm);
          // Show results view anyway (view-only)
          showResultViewUI(correctCount, total, wrongCount, percent, timeFormatted, sessionNum);
        };

        const handleConfirm = () => {
          modal.classList.remove('open');
          cancelBtn?.removeEventListener('click', handleCancel);
          confirmBtn?.removeEventListener('click', handleConfirm);
          finishExam(true); // force save and overwrite
        };

        cancelBtn?.addEventListener('click', handleCancel);
        confirmBtn?.addEventListener('click', handleConfirm);
        return; // Wait for modal action
      }
    }
  }

  // Save / Overwrite result
  saveResultRecord({
    name: state.teacherInfo.name,
    school: state.teacherInfo.school,
    subject: `${state.teacherInfo.subject} (${sessionNum}-mashg'ulot)`,
    session: sessionNum,
    score: correctCount,
    total: total,
    percent: percent,
    timeSpent: timeFormatted,
    locationStatus: state.teacherInfo.locationStatus || "💻 Kompyuter (Maktab xonasi)",
    distanceMeters: state.teacherInfo.distanceMeters !== undefined ? state.teacherInfo.distanceMeters : 0,
    coords: state.teacherInfo.coords || "Desktop PC",
    switches: state.tabSwitchCount,
    status: 'Muvaffaqiyatli topshirdi',
    timestamp: getTashkentDateTimeString()
  });

  showResultViewUI(correctCount, total, wrongCount, percent, timeFormatted, sessionNum);
  loadLeaderboardFromSheet();
}

function showResultViewUI(correctCount, total, wrongCount, percent, timeFormatted, sessionNum) {
  document.getElementById('resTeacherName').textContent = state.teacherInfo.name;
  document.getElementById('resSubject').textContent = `${state.teacherInfo.subject} (${sessionNum}-mashg'ulot)`;
  document.getElementById('resGrades').textContent = `${state.teacherInfo.school} • ${sessionNum}-mashg'ulot (KRS)`;
  document.getElementById('resScoreText').textContent = `${correctCount}/${total}`;
  document.getElementById('resPercentText').textContent = `${percent}%`;
  document.getElementById('resCorrectCount').textContent = correctCount;
  document.getElementById('resWrongCount').textContent = wrongCount;
  document.getElementById('resTimeSpent').textContent = timeFormatted;
  
  const switchEl = document.getElementById('resSwitchCount');
  if (switchEl) {
    if (state.tabSwitchCount === 0) {
      switchEl.innerHTML = '<span class="text-success">0 ta (Halol)</span>';
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

function saveResultRecord(record) {
  try {
    const raw = localStorage.getItem(RESULTS_STORAGE_KEY);
    let list = raw ? JSON.parse(raw) : [];

    // Check if record for same teacher and session exists -> OVERWRITE IT!
    const existingIdx = list.findIndex(r => 
      r.name && r.name.toLowerCase() === record.name.toLowerCase() &&
      r.session === record.session
    );

    if (existingIdx >= 0) {
      list[existingIdx] = record; // Overwrite previous attempt with new latest attempt
    } else {
      list.unshift(record);
    }

    localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(list.slice(0, 100)));
    enqueueSubmissionRecord(record);

    // Real vaqtda Google Sheet Varaq1 ga jo'natish
    sendRecordToGoogleSheets({
      type: 'RESULT',
      timestamp: record.timestamp || getTashkentDateTimeString(),
      name: record.name,
      school: record.school,
      subject: record.subject,
      session: record.session || 4,
      score: record.score || 0,
      total: record.total || 25,
      percent: record.percent || 0,
      timeSpent: record.timeSpent || '',
      locationStatus: record.locationStatus || '💻 Kompyuter (Maktab xonasi)',
      distanceMeters: record.distanceMeters !== undefined ? record.distanceMeters : 0,
      coords: record.coords || '',
      switches: record.switches || 0,
      status: record.status || 'Muvaffaqiyatli topshirdi'
    });
  } catch (err) {
    console.warn("Natijani saqlashda xato:", err);
  }
}

// ==========================================
// REVIEW LIST (MOBILE RESPONSIVE & ORTHOGRAPHY)
// ==========================================
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
        <span><b>${idx + 1}-savol</b> (${escapeHtml(q.grade || 'Maktab')}-sinf • ${escapeHtml(q.topic || 'Darslik')})</span>
        <span style="font-weight: 700; color: ${isCorrect ? 'var(--accent)' : 'var(--danger)'};">
          ${isCorrect ? '✓ To\'g\'ri' : '✗ Noto\'g\'ri'}
        </span>
      </div>
      <div class="review-q-text">${escapeHtml(q.question)}</div>
      ${q.image ? `<div style="margin: 0.5rem 0;"><img src="${q.image}" style="max-width: 100%; max-height: 220px; border-radius: 6px;"></div>` : ''}
      <div class="review-ans-row">
        <div>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Sizning javobingiz:</span><br>
          <span class="ans-badge ${isCorrect ? 'user-correct' : 'user-wrong'}">${escapeHtml(userAnsText)}</span>
        </div>
        ${!isCorrect ? `
          <div>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Darslikdagi to'g'ri javob:</span><br>
            <span class="ans-badge correct-ans">${escapeHtml(correctAnsText)}</span>
          </div>
        ` : ''}
      </div>
      ${q.explanation ? `
        <div style="margin-top: 0.75rem; font-size: 0.82rem; color: var(--text-muted); background: var(--bg); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm);">
          📖 <b>Izoh:</b> ${escapeHtml(q.explanation)}
        </div>
      ` : ''}
    `;

    container.appendChild(item);
  });
}

function handleRestart() {
  clearSavedSession();
  state.isExamActive = false;
  state.currentIndex = 0;
  state.userAnswers = {};
  state.activeQuestions = [];
  state.tabSwitchCount = 0;
  document.body.classList.remove('exam-active-mode');

  // To'g'ridan-to'g'ri yangi test boshlash uchun setupView ga o'tkazish
  switchView('setup', true);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.handleRestart = handleRestart;

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ==========================================
// DYNAMIC LIVE LEADERBOARD (GOOGLE SHEET + LOCAL)
// ==========================================

// O'zbekiston (Toshkent, UTC+5) vaqtini olish
function getTashkentDateTimeString(date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tashkent',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(date);
    
    const p = {};
    parts.forEach(x => { p[x.type] = x.value; });
    return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
  } catch (e) {
    const d = new Date(date.getTime() + 5 * 3600 * 1000);
    return d.toISOString().replace('T', ' ').substring(0, 19);
  }
}

// Sana va vaqtni ajratib olish (Google Sheets Sana_Vaqt ustunidan)
function extractDateTime(raw) {
  if (!raw) return { date: 'Bugun', time: '—' };
  const str = String(raw).trim();
  
  // ISO format: 2026-11-22T11:50:51.592Z
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const date = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' }); // YYYY-MM-DD
      const time = d.toLocaleTimeString('uz-UZ', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return { date, time };
    }
  }

  // Format: YYYY-MM-DD HH:mm:ss
  const matchIso = str.match(/(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)/);
  if (matchIso) {
    return { date: matchIso[1], time: matchIso[2] };
  }

  // Format: DD/MM/YYYY, HH:mm:ss or DD.MM.YYYY HH:mm:ss
  const matchRu = str.match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})[,\s]+(\d{2}:\d{2}(?::\d{2})?)/);
  if (matchRu) {
    const date = matchRu[3] + '-' + matchRu[2].padStart(2, '0') + '-' + matchRu[1].padStart(2, '0');
    return { date, time: matchRu[4] };
  }

  return { date: str.substring(0, 10), time: str.length > 11 ? str.substring(11).trim() : '—' };
}

let leaderboardRecordsCache = [];

function populateRatingDateDropdown(records) {
  const dateSelect = document.getElementById('ratingDateFilter');
  if (!dateSelect) return;
  const currentVal = dateSelect.value || 'ALL';

  const dateSet = new Set();
  records.forEach(r => {
    if (r.date && r.date.length === 10) dateSet.add(r.date);
    else if (r.rawDate && r.rawDate.length >= 10) dateSet.add(r.rawDate.substring(0, 10));
  });

  const sortedDates = Array.from(dateSet).sort().reverse();
  const months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const todayStr = getTashkentDateString ? getTashkentDateString() : '';

  dateSelect.innerHTML = '<option value="ALL">🌟 Barcha sanalar (To\'liq)</option>';
  sortedDates.forEach(dStr => {
    const opt = document.createElement('option');
    opt.value = dStr;
    const parts = dStr.split('-');
    let label = dStr;
    if (parts.length === 3) {
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      if (m >= 1 && m <= 12) {
        label = `${d}-${months[m - 1]} ${parts[0]}-yil`;
      }
    }
    if (dStr === todayStr) {
      label += ' (Bugun)';
    }
    opt.textContent = `📅 ${label}`;
    dateSelect.appendChild(opt);
  });

  if (Array.from(dateSelect.options).some(o => o.value === currentVal)) {
    dateSelect.value = currentVal;
  }
}

function populateRatingSchoolDropdown() {
  const schoolSelect = document.getElementById('ratingSchoolFilter');
  if (!schoolSelect) return;

  // Agar allaqachon to'liq to'ldirilgan bo'lsa (50 dan ortiq maktab bo'lsa), qayta to'ldirmaymiz
  if (schoolSelect.options.length > 10) return;

  const currentVal = schoolSelect.value || 'ALL';

  const db = (state && state.teachersDb && Object.keys(state.teachersDb).length > 0) 
    ? state.teachersDb 
    : (typeof window !== 'undefined' && (window.TEACHERS_DB || window.TEACHERS_DATABASE) 
        ? (window.TEACHERS_DB || window.TEACHERS_DATABASE) 
        : {});

  const schoolNames = Object.keys(db).sort(compareSchoolsNatural);
  if (schoolNames.length === 0) return;

  schoolSelect.innerHTML = `<option value="ALL">🏫 Barcha maktablar (${schoolNames.length} ta)</option>`;

  schoolNames.forEach(sch => {
    const opt = document.createElement('option');
    opt.value = sch;
    opt.textContent = sch;
    schoolSelect.appendChild(opt);
  });

  if (Array.from(schoolSelect.options).some(o => o.value === currentVal)) {
    schoolSelect.value = currentVal;
  }
}

function applyLeaderboardFilters() {
  const tbody = document.getElementById('krsLeaderboardBody');
  const countBadge = document.getElementById('krsLeaderboardCountBadge');
  if (!tbody) return;

  const dateVal = document.getElementById('ratingDateFilter')?.value || 'ALL';
  const subjectVal = document.getElementById('ratingSubjectFilter')?.value || 'ALL';
  const schoolVal = document.getElementById('ratingSchoolFilter')?.value || 'ALL';
  const searchVal = (document.getElementById('ratingSearchInput')?.value || '').trim().toLowerCase();

  function normSubLocal(s) {
    if (!s) return '';
    let res = s.toLowerCase();
    res = res.replace(/['ʻ‘ʼ`\u02BC\u02BB]/g, "'");
    res = res.replace(/ş/g, "sh").replace(/ç/g, "ch").replace(/ö/g, "o'").replace(/ğ/g, "g'");
    res = res.replace(/[\u{1F300}-\u{1F9FF}]/gu, '');
    res = res.replace(/\(.*?\)/g, "").trim();
    return res;
  }

  let list = (leaderboardRecordsCache || []).slice();

  // 1. Sana filtri
  if (dateVal !== 'ALL') {
    list = list.filter(r => (r.date && r.date === dateVal) || (r.rawDate && r.rawDate.startsWith(dateVal)));
  }

  // 2. Fan filtri
  if (subjectVal !== 'ALL') {
    const targetNorm = normSubLocal(subjectVal);
    list = list.filter(r => {
      const subNorm = normSubLocal(r.subject);
      return subNorm === targetNorm || subNorm.includes(targetNorm) || targetNorm.includes(subNorm);
    });
  }

  // 3. Maktab filtri
  if (schoolVal !== 'ALL') {
    list = list.filter(r => (r.school || '').trim().toLowerCase() === schoolVal.trim().toLowerCase());
  }

  // 4. Qidiruv filtri (F.I.Sh.)
  if (searchVal) {
    list = list.filter(r => (r.name || '').toLowerCase().includes(searchVal));
  }

  // Sort: Non-blocked first by score descending, then by switches ascending, then earlier time
  list.sort((a, b) => {
    const aBlocked = (a.status || '').includes('Bloklangan');
    const bBlocked = (b.status || '').includes('Bloklangan');
    if (aBlocked && !bBlocked) return 1;
    if (!aBlocked && bBlocked) return -1;
    if (b.score !== a.score) return b.score - a.score;
    if (a.switches !== b.switches) return a.switches - b.switches;
    return (a.timeStr || '').localeCompare(b.timeStr || '');
  });

  if (countBadge) {
    countBadge.innerHTML = `📊 Topshirganlar: <b>${list.length} nafar</b>`;
  }

  tbody.innerHTML = '';

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
          <b>Tanlangan parametrlar bo'yicha natijalar topilmadi.</b><br>
          <span style="font-size: 0.85rem; color: #64748b;">Iltimos, boshqa sana, fan yoki maktabni tanlang.</span>
        </td>
      </tr>
    `;
    return;
  }

  list.forEach((item, idx) => {
    const isBlocked = (item.status || '').includes('Bloklangan');
    const tr = document.createElement('tr');
    if (isBlocked) {
      tr.style.background = '#fef2f2';
    }

    let rankBadge = `<span class="rank-badge">${idx + 1}</span>`;
    if (isBlocked) {
      rankBadge = `<span class="rank-badge rank-blocked">🚫</span>`;
    } else if (idx === 0) {
      rankBadge = `<span class="rank-badge rank-1" style="font-weight: 800;">🥇 1</span>`;
    } else if (idx === 1) {
      rankBadge = `<span class="rank-badge rank-2" style="font-weight: 800;">🥈 2</span>`;
    } else if (idx === 2) {
      rankBadge = `<span class="rank-badge rank-3" style="font-weight: 800;">🥉 3</span>`;
    } else if (idx < 10) {
      rankBadge = `<span class="rank-badge" style="font-weight: 700; color: #0284c7;">🏅 ${idx + 1}</span>`;
    }

    const scoreDisplay = isBlocked
      ? `<b style="color: var(--danger);">0 ball (0%)</b>`
      : `<b style="color: #059669; font-weight: 800; font-size: 0.95rem;">${item.score} ball</b> <span style="color: #64748b; font-size: 0.82rem; font-weight: 600;">(${item.percent}%)</span>`;

    const switchDisplay = isBlocked
      ? `<span style="color: var(--danger); font-weight: 800;">4 ta (Cheklandi)</span>`
      : (item.switches === 0 
          ? `<span style="color: var(--accent); font-weight: 700;">0 (Halol)</span>` 
          : `<span style="color: var(--warning); font-weight: 700;">${item.switches} ta</span>`);

    const timeDisplay = isBlocked
      ? `<span style="color: var(--danger); font-weight: 600;">To'xtatildi</span>`
      : `<span style="font-weight: 700; color: #1e293b; font-size: 0.88rem;">${item.timeStr || '—'}</span>`;

    let locBadge = `<span style="color: #64748b; font-size: 0.82rem;">—</span>`;
    const locText = item.locationStatus || '';
    if (locText.includes('Maktabda') || locText.includes('Kompyuter')) {
      locBadge = `<span style="background: #ecfdf5; color: #065f46; font-size: 0.78rem; font-weight: 700; padding: 2px 7px; border-radius: 9999px; border: 1px solid #a7f3d0; display: inline-block;">${escapeHtml(locText)}</span>`;
    } else if (locText.includes('Masofadan')) {
      locBadge = `<span style="background: #fffbeb; color: #92400e; font-size: 0.78rem; font-weight: 700; padding: 2px 7px; border-radius: 9999px; border: 1px solid #fde68a; display: inline-block;">${escapeHtml(locText)}</span>`;
    } else if (locText.includes('GPS') || locText.includes('rad') || locText.includes('o\'chirilgan')) {
      locBadge = `<span style="background: #fef2f2; color: #991b1b; font-size: 0.78rem; font-weight: 700; padding: 2px 7px; border-radius: 9999px; border: 1px solid #fecaca; display: inline-block;">${escapeHtml(locText)}</span>`;
    } else if (locText) {
      locBadge = `<span style="font-size: 0.8rem; color: #475569;">${escapeHtml(locText)}</span>`;
    }

    const durationDisplay = item.timeSpent 
      ? `<span style="font-weight: 700; color: #0369a1; font-size: 0.85rem;">⏱️ ${escapeHtml(item.timeSpent)}</span>`
      : `<span style="color: #94a3b8; font-size: 0.82rem;">—</span>`;

    tr.innerHTML = `
      <td style="text-align: center;">${rankBadge}</td>
      <td><b>${item.name}</b> ${isBlocked ? '<br><small style="color: var(--danger); font-weight: 700;">[QOIDABUZARLIK TUFAYLI BLOKLANGAN]</small>' : ''}</td>
      <td><span style="font-weight: 600; color: #334155;">${item.school}</span></td>
      <td><span style="font-weight: 600; color: #0369a1;">${item.subject}</span></td>
      <td style="text-align: center;">${scoreDisplay}</td>
      <td style="text-align: center;">${durationDisplay}</td>
      <td style="text-align: center;">${locBadge}</td>
      <td style="text-align: center;">${timeDisplay}</td>
      <td style="text-align: center;">${switchDisplay}</td>
      <td style="text-align: center; color: #64748b; font-size: 0.82rem; font-weight: 600;">${item.date || 'Bugun'}</td>
    `;

    tbody.appendChild(tr);
  });
}
window.applyLeaderboardFilters = applyLeaderboardFilters;

function resetLeaderboardFilters() {
  const dEl = document.getElementById('ratingDateFilter');
  const sEl = document.getElementById('ratingSubjectFilter');
  const schEl = document.getElementById('ratingSchoolFilter');
  const searchEl = document.getElementById('ratingSearchInput');
  if (dEl) dEl.value = 'ALL';
  if (sEl) sEl.value = 'ALL';
  if (schEl) schEl.value = 'ALL';
  if (searchEl) searchEl.value = '';
  applyLeaderboardFilters();
}
window.resetLeaderboardFilters = resetLeaderboardFilters;

async function loadLeaderboardFromSheet(isManual = false) {
  const tbody = document.getElementById('krsLeaderboardBody');
  const countBadge = document.getElementById('krsLeaderboardCountBadge');
  if (!tbody) return;

  if (countBadge) {
    countBadge.innerHTML = '📊 Yuklanmoqda...';
  }

  let combinedRecords = [];
  let sheetLoaded = false;

  // 1. Fetch live results from Google Sheet with cache-busting
  try {
    const cacheUrl = RESULTS_SHEET_URL + '&_t=' + Date.now();
    const res = await fetch(cacheUrl, { cache: 'no-store' });
    if (res.ok) {
      sheetLoaded = true;
      const csvText = await res.text();
      const rows = parseCsv(csvText);
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[1]) continue;
        const dt = extractDateTime(r[0]);
        const normName = r[1].trim().toLowerCase();
        const record = {
          rawDate: r[0] || '',
          date: dt.date,
          timeStr: dt.time,
          name: r[1],
          school: r[2] || '',
          subject: r[3] || '',
          session: r[4] || '',
          score: parseInt(r[5]) || 0,
          total: parseInt(r[6]) || 25,
          percent: parseInt(r[7]) || 0,
          switches: parseInt(r[8]) || 0,
          status: r[9] || 'Muvaffaqiyatli topshirdi',
          timeSpent: r[10] || '',
          locationStatus: r[11] || '',
          distanceMeters: r[12] || '',
          coords: r[13] || ''
        };

        const existingIdx = combinedRecords.findIndex(c => c.name.trim().toLowerCase() === normName);
        if (existingIdx >= 0) {
          combinedRecords[existingIdx] = record;
        } else {
          combinedRecords.push(record);
        }
      }
    }
  } catch (err) {
    console.warn("Google Sheet natijalarini yuklashda xatolik:", err);
  }

  // 2. Fetch blocked records from Google Sheet with cache-busting
  try {
    const cacheUrlB = BLOCKED_SHEET_URL + '&_t=' + Date.now();
    const resB = await fetch(cacheUrlB, { cache: 'no-store' });
    if (resB.ok) {
      const csvTextB = await resB.text();
      const rowsB = parseCsv(csvTextB);
      for (let i = 1; i < rowsB.length; i++) {
        const r = rowsB[i];
        if (!r[1]) continue;
        const ruxsat = (r[6] || '').trim().toLowerCase();
        if (ruxsat === 'ochiq') continue;
        if (combinedRecords.some(c => c.name.toLowerCase() === r[1].toLowerCase())) continue;

        const dtB = extractDateTime(r[0]);
        combinedRecords.push({
          rawDate: r[0] || '',
          date: dtB.date,
          timeStr: dtB.time,
          name: r[1],
          school: r[2] || '',
          subject: r[3] || '',
          score: 0,
          total: 25,
          percent: 0,
          switches: parseInt(r[4]) || 4,
          status: '🚫 Bloklangan (Qoidabuzarlik)'
        });
      }
    }
  } catch (err) {
    console.warn("BLOKLANGANLAR varag'ini yuklashda xatolik:", err);
  }

  if (isManual && typeof showToast === 'function') {
    showToast("Yetakchilar reytingi yangilandi!", "🔄");
  }

  // Sync cache
  leaderboardRecordsCache = combinedRecords;
  window.leaderboardRecordsCache = combinedRecords;

  // Dropdownlarni to'ldirish
  populateRatingDateDropdown(combinedRecords);
  populateRatingSchoolDropdown();

  // Filtrlarni qo'llab jadvalni chizish
  applyLeaderboardFilters();
}
window.loadLeaderboardFromSheet = loadLeaderboardFromSheet;

// ==========================================
// KRS MONITORING & ADVANCED ANALYTICS DASHBOARD
// ==========================================

let monitoringDataRaw = [];
let monitoringFilteredList = [];
let lastLiveSubmissions = [];

function normalizePersonName(str) {
  if (!str) return '';
  return str.toUpperCase()
    .replace(/['`ʻʼ‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isSameTeacher(dbName, testName) {
  if (!dbName || !testName) return false;
  const n1 = normalizePersonName(dbName);
  const n2 = normalizePersonName(testName);
  if (n1 === n2) return true;

  // Split into components (Familiya, Ism, Sharif)
  const p1 = n1.split(' ');
  const p2 = n2.split(' ');
  if (p1.length >= 2 && p2.length >= 2) {
    // If Familiya and Ism match (e.g., 'ATAJANOVA NIYOZJON YULDASHEVNA' and 'ATAJANOVA NIYOZJON')
    if (p1[0] === p2[0] && p1[1] === p2[1]) return true;
    // In case user entered Ism Familiya order
    if (p1[0] === p2[1] && p1[1] === p2[0]) return true;
  }
  return false;
}

function normalizeSchoolName(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/gi, '');
}

function switchMonTab(tabName) {
  const tabs = ['schools', 'subjects', 'teachers'];
  tabs.forEach(t => {
    const btn = document.getElementById('tabBtn' + t.charAt(0).toUpperCase() + t.slice(1));
    const pane = document.getElementById('monTab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (btn) btn.classList.toggle('active', t === tabName);
    if (pane) pane.classList.toggle('active', t === tabName);
  });
}

// ==========================================================
// KRS MONITORING — yagona hisob-kitob mantiqi
//  * Pedagog = bazadagi bitta qator (teachers_db). Natijalar F.I.Sh. (+maktab) va FAN bo'yicha bog'lanadi.
//  * Topshirdi + Qoldi = Reja (hamma jadval va KPI shu qoidaga bo'ysunadi).
//  * Bloklangan pedagog "Qoldi" tarkibida hisoblanadi, alohida ko'rsatkichi ham bor.
//  * A'lo = 86–100%, Yaxshi 71–85%, Qoniqarli 56–70%, Qoniqarsiz 0–55% (hamma joyda bir xil).
// ==========================================================
const MON_SUBJECT_ORDER = [
  "Boshlang'ich ta'lim", 'Matematika', 'Informatika', 'Ona tili', 'English', 'Nemis tili', 'Fransuz tili',
  'Rus tili', 'Biologiya', 'Fizika', 'Kimyo', 'Geografiya', 'Tarix', 'Huquq', 'Tarbiya', 'Texnologiya',
  "Tasviriy san'at", 'Musiqa', 'Iqtisodiy bilim asoslari', 'Tadbirkorlik asoslari'
];
const MON_SUBJECT_META = {
  "Boshlang'ich ta'lim": ['🎒', "Boshlang'ich ta'lim"], 'Matematika': ['📐', 'Matematika'], 'Informatika': ['💻', 'Informatika'],
  'Ona tili': ['📚', 'Ona tili va adabiyot'], 'English': ['🇬🇧', 'Ingliz tili'], 'Nemis tili': ['🇩🇪', 'Nemis tili'],
  'Fransuz tili': ['🇫🇷', 'Fransuz tili'], 'Rus tili': ['🇷🇺', 'Rus tili'], 'Biologiya': ['🧬', 'Biologiya'],
  'Fizika': ['⚛️', 'Fizika'], 'Kimyo': ['⚗️', 'Kimyo'], 'Geografiya': ['🌍', 'Geografiya'], 'Tarix': ['🏛️', 'Tarix'],
  'Huquq': ['⚖️', 'Davlat va huquq asoslari'], 'Tarbiya': ['🌱', 'Tarbiya'], 'Texnologiya': ['🛠️', 'Texnologiya'],
  "Tasviriy san'at": ['🎨', "Tasviriy san'at"], 'Musiqa': ['🎵', 'Musiqa'],
  'Iqtisodiy bilim asoslari': ['💹', 'Iqtisodiy bilim asoslari'], 'Tadbirkorlik asoslari': ['🧾', 'Tadbirkorlik asoslari']
};
const MON_SUBJECT_ALIASES = {
  'ingliz tili': 'English', 'english': 'English', 'davlat va huquq asoslari': 'Huquq',
  'ona tili va adabiyot': 'Ona tili', 'ona tili va adabiyoti': 'Ona tili', 'rus tili va adabiyoti': 'Rus tili'
};
const MON_TEACHERS_PAGE = 250;

let monSubjectNames = new Map();   // kalit -> asosiy nom
let monTeachers = [];              // bazadagi pedagoglar (natijalar bilan bog'langan)
let monitoringPairRows = [];       // (pedagog × fan) qatorlari — fanlar jadvali uchun
let monLastSchoolRows = [];        // A4 hisobot uchun
let monTeachersLimit = MON_TEACHERS_PAGE;
let monLoadPromise = null;
let monSearchTimer = null;

function monKey(s) {
  return (s || '').toLowerCase().replace(/[‘’ʻʼ`´']/g, '').replace(/\s+/g, ' ').trim();
}
function monEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function monCanonSubject(s) {
  const x = (s || '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
  if (!x) return '';
  const k = monKey(x);
  return MON_SUBJECT_ALIASES[k] || monSubjectNames.get(k) || x;
}
function monSubjectLabel(sub) {
  const m = MON_SUBJECT_META[sub];
  return m ? m[1] : sub;
}
function monGrade(p) {
  if (p >= 86) return "A'lo";
  if (p >= 71) return 'Yaxshi';
  if (p >= 56) return 'Qoniqarli';
  return 'Qoniqarsiz';
}
function monPct(x) { return (Math.round(x * 10) / 10).toFixed(1) + '%'; }
function monNum(n) { return Number(n || 0).toLocaleString('uz-UZ'); }

function monBuildTeachers() {
  monSubjectNames = new Map();
  const db = state.teachersDb || {};
  Object.values(db).forEach(arr => (arr || []).forEach(t => {
    [t.subject].concat(Array.isArray(t.all_krs) ? t.all_krs : []).forEach(s => {
      const c = (s || '').replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
      const k = monKey(c);
      if (c && !MON_SUBJECT_ALIASES[k] && !monSubjectNames.has(k)) monSubjectNames.set(k, c);
    });
  }));
  const list = [];
  Object.entries(db).forEach(([school, arr]) => {
    const schoolKey = normalizeSchoolName(school);
    (arr || []).forEach(t => {
      const subjects = [];
      const keys = new Set();
      [t.subject].concat(Array.isArray(t.all_krs) ? t.all_krs : []).forEach(s => {
        const c = monCanonSubject(s);
        const k = monKey(c);
        if (c && !keys.has(k)) { keys.add(k); subjects.push(c); }
      });
      list.push({
        name: t.name, school, schoolKey,
        primary: subjects[0] || '', subjects, subjectKeys: keys,
        records: new Map(), blocked: new Map(), allRecs: []
      });
    });
  });
  return list;
}

function monBuildIndex(teachers) {
  const full = new Map(), two = new Map();
  const add = (m, k, t) => { if (!m.has(k)) m.set(k, []); m.get(k).push(t); };
  teachers.forEach(t => {
    const tok = monKey(t.name).split(' ').filter(Boolean);
    add(full, tok.join(' '), t);
    if (tok.length >= 2) {
      add(two, tok[0] + ' ' + tok[1], t);
      add(two, tok[1] + ' ' + tok[0], t);
    }
  });
  return { full, two };
}

function monFindTeacher(idx, rawName, school) {
  const tok = monKey(rawName).split(' ').filter(Boolean);
  if (!tok.length) return null;
  let c = idx.full.get(tok.join(' '));
  if (!c && tok.length >= 2) c = idx.two.get(tok[0] + ' ' + tok[1]);
  if (!c || !c.length) return null;
  if (c.length > 1) {
    const sk = normalizeSchoolName(school);
    const same = c.filter(t => t.schoolKey === sk);
    return same.length ? same[0] : null;
  }
  return c[0];
}

function monMakeResult(raw) {
  const score = parseFloat(raw.score) || 0;
  const total = parseInt(raw.total, 10) || (score > 25 ? 40 : 25);
  let percent = parseFloat(raw.percent);
  if (!(percent >= 0)) percent = total ? Math.round((score / total) * 100) : 0;
  return {
    date: (raw.date || '').substring(0, 19),
    name: normalizePersonName(raw.name),
    rawName: raw.name,
    school: raw.school || '',
    cleanSchool: normalizeSchoolName(raw.school),
    subject: raw.subject || '',
    session: raw.session ? (parseInt(raw.session, 10) || 4) : 4,
    score, total, percent,
    switches: parseInt(raw.switches, 10) || 0,
    status: raw.status || 'Muvaffaqiyatli topshirdi',
    isBlocked: false
  };
}

async function monLoadSources() {
  const get = async (u) => {
    try {
      const r = await fetch(u + (u.includes('?') ? '&' : '?') + '_t=' + Date.now(), { cache: 'no-store' });
      return r.ok ? r : null;
    } catch (e) { return null; }
  };
  const [jr, sr, jb, sb] = await Promise.all([
    get('results_db.json'), get(RESULTS_SHEET_URL), get('blocked_db.json'), get(BLOCKED_SHEET_URL)
  ]);

  const results = [];
  let resultsLoaded = false;
  if (jr) {
    try {
      const arr = await jr.json();
      resultsLoaded = true;
      arr.forEach(it => { if (it && it.name) results.push(monMakeResult({ ...it, session: it.grade_or_session })); });
    } catch (e) { console.warn('results_db.json:', e); }
  }
  if (sr) {
    try {
      const rows = parseCsv(await sr.text());
      resultsLoaded = true;
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[1]) continue;
        results.push(monMakeResult({
          date: r[0], name: r[1], school: r[2], subject: r[3], session: r[4],
          score: r[5], total: r[6], percent: r[7], switches: r[8], status: r[9]
        }));
      }
    } catch (e) { console.warn('Natijalar jadvali:', e); }
  }

  const blockedMap = new Map();
  let blockedLoaded = false;
  const bKey = (name, subject) => monKey(name) + '|' + monKey(monCanonSubject(subject));
  if (jb) {
    try {
      const arr = await jb.json();
      blockedLoaded = true;
      arr.forEach(b => {
        if (!b || !b.name) return;
        const subject = b.subject || b.reason || '';
        blockedMap.set(bKey(b.name, subject), { name: b.name, school: b.school || '', subject, switches: 4 });
      });
    } catch (e) { console.warn('blocked_db.json:', e); }
  }
  if (sb) {
    try {
      const rows = parseCsv(await sb.text());
      blockedLoaded = true;
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[1]) continue;
        const subject = r[3] || '';
        if ((r[6] || '').trim().toLowerCase() === 'ochiq') {
          // Administrator ruxsat bergan — blokdan chiqariladi
          if (subject) blockedMap.delete(bKey(r[1], subject));
          else Array.from(blockedMap.keys()).forEach(k => { if (k.startsWith(monKey(r[1]) + '|')) blockedMap.delete(k); });
          continue;
        }
        blockedMap.set(bKey(r[1], subject), { name: r[1], school: r[2] || '', subject, switches: parseInt(r[4], 10) || 4 });
      }
    } catch (e) { console.warn('Bloklanganlar jadvali:', e); }
  }
  return { results, blocked: Array.from(blockedMap.values()), resultsLoaded, blockedLoaded };
}

function monPopulateFilters(teachers) {
  // Maktablar
  const selS = document.getElementById('monSchoolFilter');
  if (selS) {
    const cur = selS.value;
    const names = Object.keys(state.teachersDb || {}).sort(compareSchoolsNatural);
    selS.innerHTML = `<option value="ALL">-- Barcha maktablar (${names.length} ta) --</option>` +
      names.map(n => `<option value="${monEsc(n)}">🏫 ${monEsc(n)} (${(state.teachersDb[n] || []).length} nafar)</option>`).join('');
    if (cur && names.includes(cur)) selS.value = cur;
  }
  // Fanlar
  const selF = document.getElementById('monSubjectFilter');
  if (selF) {
    const cur = selF.value;
    const counts = new Map();
    teachers.forEach(t => t.subjects.forEach(s => counts.set(s, (counts.get(s) || 0) + 1)));
    const subs = Array.from(counts.keys()).sort((a, b) => {
      const ia = MON_SUBJECT_ORDER.indexOf(a), ib = MON_SUBJECT_ORDER.indexOf(b);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
    });
    selF.innerHTML = `<option value="ALL">-- Barcha fanlar (${subs.length} ta) --</option>` +
      subs.map(s => `<option value="${monEsc(s)}">${(MON_SUBJECT_META[s] || ['📘'])[0]} ${monEsc(monSubjectLabel(s))} (${counts.get(s)})</option>`).join('');
    if (cur && subs.includes(cur)) selF.value = cur;
  }
  const schoolsCnt = Object.keys(state.teachersDb || {}).length;
  const sub = document.getElementById('monSubtitle');
  if (sub) {
    const subjCnt = selF ? selF.options.length - 1 : 0;
    sub.textContent = `${schoolsCnt} ta maktab va ${subjCnt} ta fan kesimida pedagoglar ishtiroki, qamrov foizi va reyting tahlili`;
  }
}

async function monDoLoad() {
  const btn = document.getElementById('monRefreshBtn');
  if (btn) btn.disabled = true;
  try {
    if (!state.teachersDb || Object.keys(state.teachersDb).length === 0) {
      await loadTeachersDatabase();
    }
    const src = await monLoadSources();

    const teachers = monBuildTeachers();
    const idx = monBuildIndex(teachers);

    let seq = 0, unmatched = 0;
    src.results.forEach(rec => {
      const t = monFindTeacher(idx, rec.rawName, rec.school);
      if (!t) { unmatched++; return; }
      const sub = monCanonSubject(rec.subject) || t.primary;
      const k = monKey(sub);
      if (!t.subjectKeys.has(k)) { t.subjectKeys.add(k); t.subjects.push(sub); }
      rec.sub = sub;
      rec.seq = seq++;
      t.records.set(k, rec);            // bir fan bo'yicha oxirgi natija hisoblanadi
      t.allRecs.push(rec);              // Davomat uchun: mashg'ulot (session) bo'yicha
    });
    src.blocked.forEach(b => {
      const t = monFindTeacher(idx, b.name, b.school);
      if (!t) return;
      const sub = monCanonSubject(b.subject);
      if (sub) {
        const k = monKey(sub);
        if (!t.subjectKeys.has(k)) { t.subjectKeys.add(k); t.subjects.push(sub); }
        t.blocked.set(k, b);
      } else {
        t.blocked.set('*', b);
      }
    });

    // Natijalar jadvali ham, JSON ham bo'sh bo'lsa — eski mahalliy keshni tozalaymiz
    if (src.resultsLoaded && src.results.length === 0) {
      try { localStorage.removeItem(RESULTS_STORAGE_KEY); } catch (e) {}
    }
    if (src.blockedLoaded && src.blocked.length === 0) {
      try { localStorage.removeItem(BLOCKED_STORAGE_KEY); } catch (e) {}
    }
    if (!src.resultsLoaded) showToast("Natijalar bazasini yuklab bo'lmadi. Internetni tekshirib, «Yangilash» ni bosing.", "⚠️");

    lastLiveSubmissions = src.results;     // Davomat bo'limi ham shu ro'yxatdan foydalanadi
    monTeachers = teachers;
    monitoringDataRaw = teachers;
    console.info(`[Monitoring] pedagoglar: ${teachers.length}, natijalar: ${src.results.length}, bazaga bog'lanmagan: ${unmatched}`);

    monPopulateFilters(teachers);
    applyMonitoringFilters();

    const updateEl = document.getElementById('monLastUpdated');
    if (updateEl) {
      const now = new Date();
      updateEl.textContent = `${now.toLocaleTimeString('uz-UZ')}, ${now.toLocaleDateString('uz-UZ')}`;
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function initOrRefreshMonitoringDashboard(isManualRefresh = false) {
  if (!monLoadPromise) {
    monLoadPromise = monDoLoad().finally(() => { monLoadPromise = null; });
  }
  return monLoadPromise.then(() => {
    if (isManualRefresh) showToast("Monitoring ma'lumotlari yangilandi!", "🔄");
  });
}

function refreshMonitoringData() {
  initOrRefreshMonitoringDashboard(true);
}

// Pedagog (subKey = null) yoki pedagog × fan (subKey = fan kaliti) uchun bitta qator
function monMakeRow(t, subKey) {
  let rec = null, blk = null, subject = t.primary;
  if (subKey) {
    rec = t.records.get(subKey) || null;
    blk = t.blocked.get(subKey) || t.blocked.get('*') || null;
    subject = t.subjects.find(s => monKey(s) === subKey) || t.primary;
  } else {
    t.records.forEach(r => { if (!rec || r.seq > rec.seq) rec = r; });
    if (rec) {
      blk = t.blocked.get(monKey(rec.sub)) || t.blocked.get('*') || null;
      subject = rec.sub;
    } else if (t.blocked.size) {
      blk = t.blocked.values().next().value;
      subject = (blk && monCanonSubject(blk.subject)) || t.primary;
    }
  }
  const status = blk ? 'blocked' : (rec ? 'passed' : 'missing');
  const passed = status === 'passed';
  return {
    t, name: t.name, school: t.school, subject, status,
    hasParticipated: passed, isBlocked: status === 'blocked',
    score: passed ? rec.score : 0,
    total: rec ? rec.total : 25,
    percent: passed ? rec.percent : 0,
    scorePercent: passed ? rec.percent : 0,
    switches: status === 'blocked' ? ((blk && blk.switches) || 4) : (rec ? rec.switches : 0),
    grade: status === 'blocked' ? 'Bloklangan' : (passed ? monGrade(rec.percent) : 'Topshirmagan')
  };
}

function monStatusOk(row, st) {
  switch (st) {
    case 'PASSED': return row.status === 'passed';
    case 'MISSING': return row.status !== 'passed';          // Qoldi = Reja − Topshirdi
    case 'EXCELLENT': return row.status === 'passed' && row.percent >= 86;
    case 'LOW': return row.status === 'passed' && row.percent < 56;
    case 'BLOCKED': return row.status === 'blocked';
    default: return true;
  }
}

function applyMonitoringFilters() {
  const school = document.getElementById('monSchoolFilter')?.value || 'ALL';
  const subject = document.getElementById('monSubjectFilter')?.value || 'ALL';
  const status = document.getElementById('monStatusFilter')?.value || 'ALL';
  const search = monKey(document.getElementById('monSearchInput')?.value || '');
  const subKey = subject === 'ALL' ? null : monKey(subject);

  const personRows = [];
  const pairRows = [];
  (monTeachers || []).forEach(t => {
    if (school !== 'ALL' && t.school !== school) return;
    if (search && !monKey(t.name).includes(search) && !monKey(t.school).includes(search)) return;
    if (subKey) {
      if (!t.subjectKeys.has(subKey)) return;
      const r = monMakeRow(t, subKey);
      if (monStatusOk(r, status)) { personRows.push(r); pairRows.push(r); }
    } else {
      const r = monMakeRow(t, null);
      if (monStatusOk(r, status)) personRows.push(r);
      t.subjects.forEach(s => {
        const pr = monMakeRow(t, monKey(s));
        if (monStatusOk(pr, status)) pairRows.push(pr);
      });
    }
  });

  monitoringFilteredList = personRows;
  monitoringPairRows = pairRows;
  monTeachersLimit = MON_TEACHERS_PAGE;

  // KPI
  const total = personRows.length;
  const passedRows = personRows.filter(r => r.status === 'passed');
  const passed = passedRows.length;
  const blocked = personRows.filter(r => r.status === 'blocked').length;
  const left = total - passed;
  const covPct = total ? (passed / total) * 100 : 0;
  const leftPct = total ? (left / total) * 100 : 0;
  const avgPct = passed ? passedRows.reduce((a, r) => a + r.percent, 0) / passed : 0;
  const avgScore = passed ? passedRows.reduce((a, r) => a + r.score, 0) / passed : 0;
  const alo = passedRows.filter(r => r.percent >= 86).length;
  const aloPct = passed ? (alo / passed) * 100 : 0;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('kpiTotalTeachers', monNum(total));
  set('kpiParticipated', monNum(passed));
  set('kpiCoveragePercent', monPct(covPct));
  set('kpiMissing', monNum(left));
  set('kpiMissingPercent', monPct(leftPct));
  set('kpiAvgScore', passed ? monPct(avgPct) : '—');
  set('kpiAvgPercent', passed ? `${avgScore.toFixed(1)} ball (o'rtacha)` : "ma'lumot yo'q");
  set('kpiQualityCount', monNum(alo));
  set('kpiQualityPercent', monPct(aloPct));
  set('kpiBlockedCount', monNum(blocked));
  set('tabTeachersCountBadge', monNum(total));
  set('teachersFilteredCount', monNum(total));
  set('monFilterResultsCount', `${monNum(total)} nafar pedagog tanlandi`);

  renderSchoolsRatingTable(personRows);
  renderSubjectsAnalysisTable(pairRows, total);
  renderTeachersMonitoringTable(personRows);
}

function getSchoolNumber(name) {
  const match = (name || '').match(/\d+/);
  return match ? parseInt(match[0], 10) : 999;
}

function compareSchoolsNatural(a, b) {
  const numA = getSchoolNumber(a);
  const numB = getSchoolNumber(b);
  if (numA !== numB) return numA - numB;
  const aIsSonli = a.includes('sonli');
  const bIsSonli = b.includes('sonli');
  if (aIsSonli && !bIsSonli) return -1;
  if (!aIsSonli && bIsSonli) return 1;
  return a.localeCompare(b);
}

let currentSchoolsSort = 'coverage';

function monCoverageBar(cov) {
  let color = '#10b981';
  if (cov < 40) color = '#ef4444';
  else if (cov < 70) color = '#f59e0b';
  return `<div class="coverage-bar-wrapper">
      <div class="coverage-bar-bg"><div class="coverage-bar-fill" style="width: ${cov.toFixed(0)}%; background: ${color};"></div></div>
      <span style="font-size: 0.82rem; font-weight: 700; min-width: 45px; text-align: right;">${cov.toFixed(1)}%</span>
    </div>`;
}

function monAggregateRows(rows, keyFn) {
  const map = new Map();
  rows.forEach(r => {
    const k = keyFn(r);
    if (!map.has(k)) map.set(k, { name: k, total: 0, passed: 0, blocked: 0, percentSum: 0, scoreSum: 0, alo: 0 });
    const a = map.get(k);
    a.total++;
    if (r.status === 'passed') {
      a.passed++; a.percentSum += r.percent; a.scoreSum += r.score;
      if (r.percent >= 86) a.alo++;
    } else if (r.status === 'blocked') {
      a.blocked++;
    }
  });
  return Array.from(map.values()).map(a => ({
    ...a,
    left: a.total - a.passed,
    cov: a.total ? (a.passed / a.total) * 100 : 0,
    avgPct: a.passed ? a.percentSum / a.passed : 0,
    avgScore: a.passed ? a.scoreSum / a.passed : 0,
    aloPct: a.passed ? (a.alo / a.passed) * 100 : 0
  }));
}

function monAvgCell(a) {
  return a.passed
    ? `<div style="display:flex; flex-direction:column; align-items:center; gap:2px;">
         <span style="font-size:1.05rem; font-weight:800; color:#059669;">${a.avgPct.toFixed(1)}%</span>
         <span style="font-size:0.72rem; color:#64748b; font-weight:600;">(${a.avgScore.toFixed(1)} ball)</span>
       </div>`
    : `<span style="color:#94a3b8;">—</span>`;
}
function monAloCell(a) {
  return a.alo > 0
    ? `<span style="font-weight:700; color:#047857;">${a.aloPct.toFixed(1)}%</span> <small style="color:#64748b;">(${a.alo} nafar)</small>`
    : `<span style="color:#94a3b8;">—</span>`;
}
function monLeftCell(a) {
  return `${a.left}${a.blocked ? `<div style="font-size:0.7rem; font-weight:600; color:#b91c1c;">shundan ${a.blocked} ta blok</div>` : ''}`;
}

// TAB 1: Maktablar reytingi
function renderSchoolsRatingTable(rows) {
  const tbody = document.getElementById('schoolsRatingTableBody');
  if (!tbody) return;

  const btns = { coverage: 'sortBtnCoverage', score: 'sortBtnScore', number: 'sortBtnNumber' };
  Object.entries(btns).forEach(([mode, id]) => {
    const b = document.getElementById(id);
    if (!b) return;
    const on = mode === currentSchoolsSort;
    b.classList.toggle('btn-primary-mon', on);
    b.classList.toggle('active', on);
    b.classList.toggle('btn-outline-mon', !on);
  });

  const list = monAggregateRows(rows, r => r.school);
  list.sort((a, b) => {
    if (currentSchoolsSort === 'number') return compareSchoolsNatural(a.name, b.name);
    if (currentSchoolsSort === 'score') {
      if ((a.passed > 0) !== (b.passed > 0)) return a.passed > 0 ? -1 : 1;
      if (Math.abs(b.avgPct - a.avgPct) > 0.001) return b.avgPct - a.avgPct;
      if (Math.abs(b.cov - a.cov) > 0.001) return b.cov - a.cov;
      return compareSchoolsNatural(a.name, b.name);
    }
    // coverage (asosiy reyting): qamrov → o'rtacha ball → a'lo foizi
    if (Math.abs(b.cov - a.cov) > 0.05) return b.cov - a.cov;
    if (Math.abs(b.avgPct - a.avgPct) > 0.001) return b.avgPct - a.avgPct;
    if (Math.abs(b.aloPct - a.aloPct) > 0.001) return b.aloPct - a.aloPct;
    return compareSchoolsNatural(a.name, b.name);
  });
  monLastSchoolRows = list;

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:#64748b;">🔍 Tanlangan filtr bo'yicha ma'lumot topilmadi.</td></tr>`;
    return;
  }

  const medal = ['🥇 1', '🥈 2', '🥉 3'];
  tbody.innerHTML = list.map((a, idx) => {
    const ranked = currentSchoolsSort !== 'number' && a.passed > 0 && idx < 3;
    const badge = ranked
      ? `<span class="rank-badge rank-${idx + 1}">${medal[idx]}</span>`
      : `<span class="rank-badge rank-default">${idx + 1}</span>`;
    return `<tr>
      <td style="text-align:center;">${badge}</td>
      <td><b style="white-space:nowrap;">${monEsc(a.name)}</b></td>
      <td style="text-align:center; font-weight:600;">${a.total}</td>
      <td style="text-align:center; font-weight:700; color:#059669;">${a.passed}</td>
      <td style="text-align:center; font-weight:700; color:#d97706;">${monLeftCell(a)}</td>
      <td>${monCoverageBar(a.cov)}</td>
      <td style="text-align:center;">${monAvgCell(a)}</td>
      <td style="text-align:center;">${monAloCell(a)}</td>
    </tr>`;
  }).join('');
}

function sortSchoolsRating(criterion) {
  currentSchoolsSort = criterion;
  renderSchoolsRatingTable(monitoringFilteredList);
}

// TAB 2: Fanlar kesimida tahlil (pedagog × fan)
function renderSubjectsAnalysisTable(pairRows, personTotal) {
  const tbody = document.getElementById('subjectsAnalysisTableBody');
  if (!tbody) return;

  const list = monAggregateRows(pairRows, r => r.subject).sort((a, b) => {
    const ia = MON_SUBJECT_ORDER.indexOf(a.name), ib = MON_SUBJECT_ORDER.indexOf(b.name);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.name.localeCompare(b.name);
  });

  const note = document.getElementById('monSubjectsNote');
  if (note) {
    note.textContent = pairRows.length !== personTotal
      ? `Eslatma: ayrim pedagoglar bir necha fan bo'yicha KRS topshiradi, shuning uchun fanlar kesimidagi jami (${monNum(pairRows.length)}) pedagoglar sonidan (${monNum(personTotal)}) ko'p bo'lishi mumkin.`
      : '';
  }

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2rem; color:#64748b;">🔍 Tanlangan filtr bo'yicha ma'lumot topilmadi.</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map((a, idx) => `<tr>
      <td style="text-align:center; font-weight:700; color:#64748b;">${idx + 1}</td>
      <td><b>${monEsc(monSubjectLabel(a.name))}</b></td>
      <td style="text-align:center; font-weight:600;">${a.total}</td>
      <td style="text-align:center; font-weight:700; color:#059669;">${a.passed}</td>
      <td style="text-align:center; font-weight:700; color:#d97706;">${monLeftCell(a)}</td>
      <td>${monCoverageBar(a.cov)}</td>
      <td style="text-align:center;">${monAvgCell(a)}</td>
      <td style="text-align:center;">${monAloCell(a)}</td>
    </tr>`).join('');
}

// TAB 3: Pedagoglar ro'yxati
function monGradeBadge(r) {
  if (r.status === 'blocked') return `<span class="status-badge status-blocked">🚫 Bloklangan</span>`;
  if (r.status === 'missing') return `<span class="status-badge status-missing">⏳ Topshirmagan</span>`;
  if (r.percent >= 86) return `<span class="status-badge status-passed">🏆 A'lo</span>`;
  if (r.percent >= 71) return `<span class="status-badge" style="background:#eff6ff; color:#1d4ed8;">🌟 Yaxshi</span>`;
  if (r.percent >= 56) return `<span class="status-badge" style="background:#fffbeb; color:#b45309;">👍 Qoniqarli</span>`;
  return `<span class="status-badge status-blocked">⚠️ Qoniqarsiz</span>`;
}

function renderTeachersMonitoringTable(rows) {
  const tbody = document.getElementById('teachersMonitoringTableBody');
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2.5rem 1rem; color:#64748b;">🔍 Tanlangan filtr bo'yicha hech qanday pedagog topilmadi.</td></tr>`;
    return;
  }

  const sorted = rows.slice().sort((a, b) =>
    compareSchoolsNatural(a.school, b.school) || a.name.localeCompare(b.name, 'uz'));
  const shown = sorted.slice(0, monTeachersLimit);

  let html = shown.map((r, idx) => {
    const passed = r.status === 'passed';
    const sw = r.status === 'blocked'
      ? `<b style="color:#ef4444;">${r.switches} ta</b>`
      : (passed ? (r.switches === 0 ? `<span style="color:#059669; font-weight:700;">0</span>` : `<span style="color:#d97706; font-weight:700;">${r.switches} ta</span>`) : '-');
    return `<tr${r.status === 'blocked' ? ' style="background:#fef2f2;"' : ''}>
      <td style="text-align:center; color:#64748b; font-size:0.82rem;">${idx + 1}</td>
      <td><b>${monEsc(r.name)}</b></td>
      <td>${monEsc(r.school)}</td>
      <td>${monEsc(monSubjectLabel(r.subject))}</td>
      <td style="text-align:center;">${passed ? `<b style="color:#059669;">${r.score} / ${r.total}</b>` : '-'}</td>
      <td style="text-align:center;">${passed ? `<b style="color:#059669;">${Math.round(r.percent)}%</b>` : '-'}</td>
      <td style="text-align:center;">${sw}</td>
      <td style="text-align:center;">${monGradeBadge(r)}</td>
    </tr>`;
  }).join('');

  if (sorted.length > shown.length) {
    html += `<tr><td colspan="8" style="text-align:center; padding:1rem; background:#f8fafc; color:#475569; font-size:0.88rem;">
      Jami <b>${monNum(sorted.length)}</b> nafardan <b>${monNum(shown.length)}</b> nafari ko'rsatildi.
      <button type="button" class="btn btn-sm btn-outline-mon" style="margin-left:0.75rem;" onclick="monShowMoreTeachers()">Yana ${MON_TEACHERS_PAGE} ta ko'rsatish</button>
      </td></tr>`;
  }
  tbody.innerHTML = html;
}

function monShowMoreTeachers() {
  monTeachersLimit += MON_TEACHERS_PAGE;
  renderTeachersMonitoringTable(monitoringFilteredList);
}

function monSearchDebounced() {
  clearTimeout(monSearchTimer);
  monSearchTimer = setTimeout(applyMonitoringFilters, 200);
}

function resetMonitoringFilters() {
  const ids = ['monSchoolFilter', 'monSubjectFilter', 'monStatusFilter'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = 'ALL'; });
  const s = document.getElementById('monSearchInput');
  if (s) s.value = '';
  applyMonitoringFilters();
}

// CSV Export Helpers
function downloadCSVFile(filename, csvContent) {
  const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportTeachersListCSV() {
  if (!monitoringFilteredList || monitoringFilteredList.length === 0) {
    showToast("Eksport qilish uchun ma'lumot mavjud emas", "⚠️");
    return;
  }
  const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  let csv = "№,Pedagog F.I.Sh.,Ta'lim muassasasi,KRS fani,To'plangan ball,Foiz,Qoidabuzarlik,Natija\n";
  monitoringFilteredList.slice().sort((a, b) =>
    compareSchoolsNatural(a.school, b.school) || a.name.localeCompare(b.name, 'uz')
  ).forEach((r, idx) => {
    const passed = r.status === 'passed';
    csv += [idx + 1, r.name, r.school, monSubjectLabel(r.subject),
      passed ? `${r.score}/${r.total}` : '-', passed ? Math.round(r.percent) + '%' : '-',
      r.status === 'blocked' ? r.switches + ' ta' : (passed ? r.switches + ' ta' : '-'), r.grade].map(q).join(',') + '\n';
  });
  const dateStr = new Date().toISOString().substring(0, 10);
  downloadCSVFile(`KRS_Pedagoglar_Monitoring_Royxati_${dateStr}.csv`, csv);
  showToast("Pedagoglar ro'yxati CSV formatida yuklab olindi", "📥");
}

// ==========================================
// KRS DAVOMAT & A4 REPORT GENERATION
// ==========================================
let lastDavomatSchoolList = [];

const KRS_DIRECTIONS_MAP = {
  'Ijtimoiy fanlar': ['Tarix', 'Huquq', 'Tarbiya'],
  'Filologiya': ['Ona tili'],
  'Tabiiy fanlar': ['Biologiya', 'Kimyo', 'Fizika', 'Geografiya', 'Iqtisodiy bilim asoslari', 'Tadbirkorlik asoslari'],
  'Aniq fanlar': ['Matematika', 'Informatika'],
  'Xorijiy tillar': ['English', 'Nemis tili', 'Fransuz tili'],
  "Boshlang'ich ta'lim": ["Boshlang'ich ta'lim"],
  'Amaliy fanlar': ["Tasviriy san'at", "Chizmachilik", "Musiqa"],
  'Rus tili': ['Rus tili'],
  'Texnologiya': ['Texnologiya'],
  'Musiqa': ['Musiqa'],
  'Iqtisodiy bilim asoslari': ['Iqtisodiy bilim asoslari'],
  'Tadbirkorlik asoslari': ['Tadbirkorlik asoslari']
};

function getEligibleCountForSubject(subjectVal) {
  if (!monTeachers || monTeachers.length === 0) return 0;
  let allowed = null;
  if (subjectVal !== 'ALL') {
    allowed = (KRS_DIRECTIONS_MAP[subjectVal] || [subjectVal]).map(monKey);
  }
  return monTeachers.filter(t => !allowed || allowed.some(k => t.subjectKeys.has(k))).length;
}

function updateDavomatSubjectDropdownCounts() {
  const sel = document.getElementById('davomatSubjectSelect');
  if (!sel || !monTeachers || monTeachers.length === 0) return;

  const currentVal = sel.value;

  Array.from(sel.options).forEach(opt => {
    const val = opt.value;
    const count = getEligibleCountForSubject(val);
    const countFormatted = count.toLocaleString('uz-UZ').replace(/\u00a0/g, ' ');

    let baseText = opt.getAttribute('data-base-label');
    if (!baseText) {
      let clean = opt.textContent.trim();
      clean = clean.replace(/\s*-\s*\d+[\s\d]*\s*nafar\)?$/i, '');
      clean = clean.replace(/\s*\(\d+[\s\d]*\s*nafar\)$/i, '');
      clean = clean.replace(/\)$/, '');
      baseText = clean.trim();
      opt.setAttribute('data-base-label', baseText);
    }

    if (val === 'ALL') {
      opt.textContent = `${baseText} (${countFormatted} nafar)`;
    } else if (KRS_DIRECTIONS_MAP[val]) {
      opt.textContent = `${baseText} - ${countFormatted} nafar)`;
    } else {
      opt.textContent = `${baseText} (${countFormatted} nafar)`;
    }
  });

  if (currentVal) sel.value = currentVal;
}

async function initOrRefreshDavomat(isManual = false) {
  if (!state.teachersDb || Object.keys(state.teachersDb).length === 0) {
    await loadTeachersDatabase();
  }
  if (!monTeachers || monTeachers.length === 0) {
    await initOrRefreshMonitoringDashboard(false);
  }
  updateDavomatSubjectDropdownCounts();
  renderDavomatReport();
  if (isManual) {
    showToast("Davomat ma'lumotlari yangilandi!", "🔄");
  }
}

function refreshDavomatData() {
  initOrRefreshMonitoringDashboard(false).then(() => {
    initOrRefreshDavomat(true);
  });
}

function renderDavomatReport() {
  const sessionVal = parseInt(document.getElementById('davomatSessionSelect')?.value || '4', 10);
  const subjectVal = document.getElementById('davomatSubjectSelect')?.value || 'Ijtimoiy fanlar';
  const sortVal = document.getElementById('davomatSortSelect')?.value || 'number';

  // 1. Update A4 Document Meta Header
  const subTitleEl = document.getElementById('a4DocSubjectTitle');
  const sessTitleEl = document.getElementById('a4DocSessionTitle');
  const timeEl = document.getElementById('a4DocTimestamp');

  let fullSubjectName = subjectVal;
  if (subjectVal === 'Ijtimoiy fanlar') fullSubjectName = "Ijtimoiy fanlar (Tarix, Davlat va huquq asoslari, Tarbiya)";
  else if (subjectVal === 'Filologiya') fullSubjectName = "Filologiya (Ona tili va adabiyot)";
  else if (subjectVal === 'Tabiiy fanlar') fullSubjectName = "Tabiiy fanlar (Biologiya, Kimyo, Fizika, Geografiya)";
  else if (subjectVal === 'Aniq fanlar') fullSubjectName = "Aniq fanlar (Matematika, Informatika)";
  else if (subjectVal === 'Xorijiy tillar') fullSubjectName = "Xorijiy tillar (Ingliz, Nemis, Fransuz tili)";
  else if (subjectVal === "Boshlang'ich ta'lim") fullSubjectName = "Boshlang'ich ta'lim va Tasviriy san'at";
  else if (subjectVal === 'Rus tili') fullSubjectName = "Rus tili va adabiyoti";
  else if (subjectVal === 'Texnologiya') fullSubjectName = "Texnologiya (Mehnat ta'limi)";
  else if (subjectVal === 'ALL') fullSubjectName = "Barcha fanlar (Umumiy tuman bo'yicha)";

  if (subTitleEl) subTitleEl.textContent = fullSubjectName;
  if (sessTitleEl) sessTitleEl.textContent = `${sessionVal}-mashg'ulot (2026-yil)`;

  const now = new Date();
  const monthsUz = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const formattedTime = `${now.getDate()}-${monthsUz[now.getMonth()]} ${now.getFullYear()}-yil, soat ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} holatiga`;
  if (timeEl) timeEl.textContent = formattedTime;

  // 2. Filter allowed subjects
  let allowedSubjects = [];
  if (subjectVal === 'ALL') {
    allowedSubjects = null; // all
  } else if (KRS_DIRECTIONS_MAP[subjectVal]) {
    allowedSubjects = KRS_DIRECTIONS_MAP[subjectVal];
  } else {
    allowedSubjects = [subjectVal];
  }

  // 3-4. Monitoring bilan bir xil hisob: pedagog × fan; bloklanganlar topshirgan hisoblanmaydi
  const allowedKeys = allowedSubjects ? allowedSubjects.map(monKey) : null;
  const isEligible = t => !allowedKeys || allowedKeys.some(k => t.subjectKeys.has(k));
  const isDone = t => (t.allRecs || []).some(r => {
    const k = monKey(r.sub);
    if (allowedKeys && !allowedKeys.includes(k)) return false;
    if (r.session !== sessionVal) return false;
    return !(t.blocked.get(k) || t.blocked.get('*'));
  });
  const bySchool = new Map();
  (monTeachers || []).forEach(t => {
    if (!bySchool.has(t.school)) bySchool.set(t.school, []);
    bySchool.get(t.school).push(t);
  });

  const allSchoolNames = Object.keys(state.teachersDb || {}).sort(compareSchoolsNatural);
  const schoolRows = [];

  let grandTotal = 0;
  let grandDone = 0;

  allSchoolNames.forEach(schName => {
    const eligibleTeachers = (bySchool.get(schName) || []).filter(isEligible);
    const total = eligibleTeachers.length;
    const done = eligibleTeachers.filter(isDone).length;

    const debt = Math.max(0, total - done);
    const pct = total > 0 ? ((done / total) * 100) : 0;

    grandTotal += total;
    grandDone += done;

    schoolRows.push({
      name: schName,
      total: total,
      done: done,
      debt: debt,
      pct: pct
    });
  });

  // 5. Sort Schools
  if (sortVal === 'number') {
    schoolRows.sort((a, b) => compareSchoolsNatural(a.name, b.name));
  } else if (sortVal === 'percent_desc') {
    schoolRows.sort((a, b) => {
      if (b.pct !== a.pct) return b.pct - a.pct;
      if (b.done !== a.done) return b.done - a.done;
      return compareSchoolsNatural(a.name, b.name);
    });
  } else if (sortVal === 'percent_asc') {
    schoolRows.sort((a, b) => {
      if (a.pct !== b.pct) return a.pct - b.pct;
      if (b.debt !== a.debt) return b.debt - a.debt;
      return compareSchoolsNatural(a.name, b.name);
    });
  } else if (sortVal === 'debt_desc') {
    schoolRows.sort((a, b) => {
      if (b.debt !== a.debt) return b.debt - a.debt;
      return compareSchoolsNatural(a.name, b.name);
    });
  }

  lastDavomatSchoolList = schoolRows;

  // 6. Update KPI summary badges
  const grandDebt = Math.max(0, grandTotal - grandDone);
  const grandPct = grandTotal > 0 ? ((grandDone / grandTotal) * 100) : 0;
  const fullSchoolsCount = schoolRows.filter(s => s.total > 0 && s.done >= s.total).length;
  const activeSchoolsCount = schoolRows.filter(s => s.total > 0).length;

  const kpiTot = document.getElementById('a4KpiTotal');
  const kpiDone = document.getElementById('a4KpiDone');
  const kpiDebt = document.getElementById('a4KpiDebt');
  const kpiPct = document.getElementById('a4KpiPercent');
  const kpiFull = document.getElementById('a4KpiFullSchools');

  if (kpiTot) kpiTot.textContent = grandTotal.toLocaleString('uz-UZ');
  if (kpiDone) kpiDone.textContent = grandDone.toLocaleString('uz-UZ');
  if (kpiDebt) kpiDebt.textContent = grandDebt.toLocaleString('uz-UZ');
  if (kpiPct) kpiPct.textContent = `${grandPct.toFixed(1)}%`;
  if (kpiFull) kpiFull.textContent = `${fullSchoolsCount} / ${activeSchoolsCount}`;

  // 7. Render Table Rows in A4 Sheet
  const tbody = document.getElementById('a4DavomatTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  schoolRows.forEach((sch, idx) => {
    const tr = document.createElement('tr');

    let barColor = '#059669';
    let statusBadge = '';

    if (sch.total === 0) {
      statusBadge = `<span class="status-badge" style="background:#f1f5f9; color:#94a3b8;">Reja yo'q</span>`;
    } else if (sch.done >= sch.total) {
      barColor = '#059669';
      statusBadge = `<span class="status-badge status-passed">✅ 100% To'liq</span>`;
    } else if (sch.pct >= 80) {
      barColor = '#10b981';
      statusBadge = `<span class="status-badge status-passed">✅ Yuqori (${sch.done}/${sch.total})</span>`;
    } else if (sch.pct >= 50) {
      barColor = '#f59e0b';
      statusBadge = `<span class="status-badge status-missing">⏳ O'rta (${sch.done}/${sch.total})</span>`;
    } else if (sch.done > 0) {
      barColor = '#ef4444';
      statusBadge = `<span class="status-badge status-blocked">⚠️ Kam (${sch.done}/${sch.total})</span>`;
    } else {
      barColor = '#dc2626';
      statusBadge = `<span class="status-badge status-blocked">❌ 0% Qarz</span>`;
    }

    let barHtml = '';
    if (sch.total === 0) {
      barHtml = `<span style="color:#94a3b8; font-size:0.78rem;">—</span>`;
    } else {
      barHtml = `
        <div class="a4-bar-container">
          <div class="a4-bar-track">
            <div class="a4-bar-fill" style="width: ${sch.pct.toFixed(0)}%; background: ${barColor};"></div>
          </div>
          <span class="a4-pct-text" style="color: ${barColor};">${sch.pct.toFixed(0)}%</span>
        </div>
      `;
    }

    tr.innerHTML = `
      <td style="text-align: center; color: #64748b; font-weight: 700; font-size: 0.8rem;">${idx + 1}</td>
      <td><b>${sch.name}</b></td>
      <td style="text-align: center; font-weight: 700;">${sch.total}</td>
      <td style="text-align: center; font-weight: 800; color: #059669;">${sch.done}</td>
      <td style="text-align: center; font-weight: 800; color: ${sch.debt > 0 ? '#dc2626' : '#64748b'};">${sch.debt}</td>
      <td>${barHtml}</td>
      <td style="text-align: center;">${statusBadge}</td>
    `;

    tbody.appendChild(tr);
  });
}

// 8. Download A4 Document as High Resolution JPG (Mobil va Kompyuter uchun to'liq moslashtirilgan)
async function downloadDavomatA4Jpg() {
  const sheet = document.getElementById('davomatA4Sheet');
  if (!sheet) {
    showToast("A4 hisobot konteyneri topilmadi", "⚠️");
    return;
  }

  if (typeof html2canvas === 'undefined') {
    showToast("html2canvas kutubxonasi yuklanmoqda...", "⏳");
    setTimeout(downloadDavomatA4Jpg, 500);
    return;
  }

  showToast("📸 A4 JPG rasm tayyorlanmoqda, kuting...", "⏳");

  // Faol matn ajratilishi (ko'k rangli matn foni) rasmga tushib qolmasligi uchun tozalaymiz:
  if (window.getSelection) {
    try {
      window.getSelection().removeAllRanges();
    } catch (e) {}
  }

  // Telefondagi tor ekran va gorizontal scroll ta'sirini butunlay yo'qotish uchun
  // Elementni maxsus 960px kenglikdagi toza klon shaklida olamiz:
  const clone = sheet.cloneNode(true);
  clone.id = 'davomatA4SheetClone';
  clone.style.width = '960px';
  clone.style.minWidth = '960px';
  clone.style.maxWidth = '960px';
  clone.style.position = 'fixed';
  clone.style.left = '-9999px';
  clone.style.top = '0px';
  clone.style.zIndex = '-9999';
  clone.style.transform = 'none';
  clone.style.boxShadow = 'none';
  clone.style.margin = '0';
  clone.style.padding = '36px 40px';
  clone.style.boxSizing = 'border-box';
  clone.style.background = '#ffffff';
  clone.style.overflow = 'visible';
  clone.style.userSelect = 'none';
  clone.style.webkitUserSelect = 'none';

  // Klon ichidagi barcha elementlarni tanlanishdan tozalaymiz
  clone.querySelectorAll('*').forEach(el => {
    el.style.userSelect = 'none';
    el.style.webkitUserSelect = 'none';
  });

  document.body.appendChild(clone);

  // Layout hisoblanishi uchun 150ms kutamiz
  await new Promise(r => setTimeout(r, 150));

  html2canvas(clone, {
    scale: 2, // 2x Retina resolution for razor-sharp text on Telegram!
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: 960,
    windowWidth: 1024,
    scrollX: 0,
    scrollY: 0
  }).then(canvas => {
    // Klonni xotiradan tozalaymiz
    if (document.body.contains(clone)) {
      document.body.removeChild(clone);
    }

    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const sessionVal = document.getElementById('davomatSessionSelect')?.value || '4';
    const subVal = (document.getElementById('davomatSubjectSelect')?.value || 'Ijtimoiy_fanlar').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `KRS_Davomat_${sessionVal}-mashgulot_${subVal}_${dateStr}.jpg`;

    // Toza Blob obyektiga o'tkazish (Android / iOS / Safari xotira muammolarisiz)
    canvas.toBlob(blob => {
      if (!blob) {
        showToast("Rasm yaratilmadi, qayta urinib ko'ring", "⚠️");
        return;
      }

      const blobUrl = URL.createObjectURL(blob);

      // 1. Avtomatik yuklab olishga urinish
      try {
        const link = document.createElement('a');
        link.download = filename;
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (document.body.contains(link)) document.body.removeChild(link);
        }, 800);
      } catch (e) {
        console.warn("Avtomatik yuklashda xatolik:", e);
      }

      // 2. Har doim telefonda qulay saqlash va Telegramga to'g'ridan-to'g'ri yuborish modalini ochish
      showMobileDavomatModal(blobUrl, blob, filename);
      showToast(`📸 A4 Rasm tayyor bo'ldi!`, "✅");
    }, 'image/jpeg', 0.95);

  }).catch(err => {
    if (document.body.contains(clone)) {
      document.body.removeChild(clone);
    }
    console.error("html2canvas xatosi:", err);
    alert("Rasmni yaratishda xatolik yuz berdi. Iltimos qayta urinib ko'ring yoki brauzerda 'Chop etish' orqali saqlang.");
  });
}

// ==========================================
// MONITORING A4 RASM (JPG) EKSPORTI
// Davomat kabi Monitoring hisobotini ham 2x Retina sifatli JPG rasm qilish
// ==========================================
async function downloadMonitoringA4Jpg() {
  if (typeof html2canvas === 'undefined') {
    showToast("html2canvas kutubxonasi yuklanmoqda...", "⏳");
    setTimeout(downloadMonitoringA4Jpg, 500);
    return;
  }

  showToast("📸 Monitoring A4 JPG rasm tayyorlanmoqda, kuting...", "⏳");

  if (window.getSelection) {
    try { window.getSelection().removeAllRanges(); } catch (e) {}
  }

  // A4 hisobot konteyneri
  const container = document.createElement('div');
  container.className = 'davomat-a4-sheet';
  container.style.width = '960px';
  container.style.minWidth = '960px';
  container.style.maxWidth = '960px';
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0px';
  container.style.zIndex = '-9999';
  container.style.background = '#ffffff';
  container.style.padding = '36px 40px';
  container.style.boxSizing = 'border-box';
  container.style.color = '#1e293b';
  container.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  // Joriy ko'rsatkichlarni olish
  const total = document.getElementById('kpiTotalTeachers')?.textContent || '3 088';
  const part = document.getElementById('kpiParticipated')?.textContent || '0';
  const covPct = document.getElementById('kpiCoveragePercent')?.textContent || '0%';
  const miss = document.getElementById('kpiMissing')?.textContent || '3 088';
  const missPct = document.getElementById('kpiMissingPercent')?.textContent || '100%';
  const avgScore = document.getElementById('kpiAvgScore')?.textContent || '0%';
  const avgPct = document.getElementById('kpiAvgPercent')?.textContent || '0%';
  const quality = document.getElementById('kpiQualityCount')?.textContent || '0';
  const qualPct = document.getElementById('kpiQualityPercent')?.textContent || '0%';
  const blocked = document.getElementById('kpiBlockedCount')?.textContent || '0';

  const now = new Date();
  const monthsUz = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
  const formattedTime = `${now.getDate()}-${monthsUz[now.getMonth()]} ${now.getFullYear()}-yil, soat ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} holatiga`;

  const schFilter = document.getElementById('monSchoolFilter')?.value || 'ALL';
  const subFilter = document.getElementById('monSubjectFilter')?.value || 'ALL';
  const statusSel = document.getElementById('monStatusFilter');
  const stFilter = statusSel ? statusSel.value : 'ALL';
  const nSchools = Object.keys(state.teachersDb || {}).length;
  const nSubjects = Math.max(0, (document.getElementById('monSubjectFilter')?.options.length || 1) - 1);
  let filterText = `Barcha ${nSchools} ta maktab va ${nSubjects} ta fan bo'yicha tuman umumiy monitoringi`;
  if (schFilter !== 'ALL' || subFilter !== 'ALL' || stFilter !== 'ALL') {
    filterText = `Filtr: ${schFilter !== 'ALL' ? schFilter : 'Barcha maktablar'} • ${subFilter !== 'ALL' ? monSubjectLabel(subFilter) : 'Barcha fanlar'}` +
      (stFilter !== 'ALL' ? ` • ${statusSel.options[statusSel.selectedIndex].text.replace(/^[^\wA-Za-z]+\s*/, '')}` : '');
  }

  // Maktablar reytingi qatorlari
  const tdS = 'padding: 5px 8px; border: 1px solid #cbd5e1;';
  const tableRowsHtml = (monLastSchoolRows || []).map((s, i) => `<tr style="${i % 2 ? 'background:#f8fafc;' : ''}">
      <td style="${tdS} text-align:center;">${i + 1}</td>
      <td style="${tdS} font-weight:700;">${monEsc(s.name)}</td>
      <td style="${tdS} text-align:center;">${s.total}</td>
      <td style="${tdS} text-align:center; font-weight:700; color:#059669;">${s.passed}</td>
      <td style="${tdS} text-align:center; font-weight:700; color:#d97706;">${s.left}</td>
      <td style="${tdS} text-align:center;">${s.cov.toFixed(1)}%</td>
      <td style="${tdS} text-align:center;">${s.passed ? s.avgPct.toFixed(1) + '%' : '—'}</td>
      <td style="${tdS} text-align:center;">${s.alo ? s.aloPct.toFixed(1) + '%' : '—'}</td>
    </tr>`).join('');

  container.innerHTML = `
    <!-- Rasmiy A4 Sarlavha -->
    <div class="a4-header-block" style="border-bottom: 2.5px solid #1e3a8a; padding-bottom: 1.25rem; margin-bottom: 1.25rem; text-align: center;">
      <div style="font-size: 0.88rem; font-weight: 800; color: #1e3a8a; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 0.25rem;">
        O'ZBEKISTON RESPUBLIKASI TA'LIM VA ILM-FAN VAZIRLIGI
      </div>
      <div style="font-size: 0.82rem; font-weight: 700; color: #475569; margin-bottom: 0.6rem;">
        XORAZM VILOYATI TA'LIM VA ILM-FAN BOSHQARMASI HUZURIDAGI QO'SHKO'PIR TUMANI TA'LIM BO'LIMI
      </div>
      <div style="font-size: 1.25rem; font-weight: 900; color: #0f172a; margin-bottom: 0.35rem;">
        KASBIY RIVOJLANISH SOATI (KRS) MONITORING VA REYTING HISOBOTI
      </div>
      <div style="font-size: 0.85rem; color: #64748b; font-weight: 600;">
        ${filterText}
      </div>
      
      <div class="a4-meta-banner" style="display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.5rem 0.85rem; margin-top: 0.85rem; font-size: 0.82rem;">
        <div><b>🕒 Holat:</b> ${formattedTime}</div>
        <div><b>👤 Mas'ul:</b> Bosh mutaxassis <b>Umrbek Mamatov</b></div>
      </div>
    </div>

    <!-- Tuman KPI Ko'rsatkichlari (6 ta ixcham blok) -->
    <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.6rem; margin-bottom: 1.25rem;">
      <div style="background: #f0f9ff; border: 1.5px solid #bae6fd; border-radius: 8px; padding: 0.6rem 0.4rem; text-align: center;">
        <div style="font-size: 1.2rem; font-weight: 900; color: #0369a1;">${total}</div>
        <div style="font-size: 0.72rem; font-weight: 700; color: #0284c7;">Jami Reja</div>
      </div>
      <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 8px; padding: 0.6rem 0.4rem; text-align: center;">
        <div style="font-size: 1.2rem; font-weight: 900; color: #15803d;">${part}</div>
        <div style="font-size: 0.72rem; font-weight: 700; color: #16a34a;">Topshirdi (${covPct})</div>
      </div>
      <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 8px; padding: 0.6rem 0.4rem; text-align: center;">
        <div style="font-size: 1.2rem; font-weight: 900; color: #b45309;">${miss}</div>
        <div style="font-size: 0.72rem; font-weight: 700; color: #d97706;">Qolgan (${missPct})</div>
      </div>
      <div style="background: #faf5ff; border: 1.5px solid #e9d5ff; border-radius: 8px; padding: 0.6rem 0.4rem; text-align: center;">
        <div style="font-size: 1.2rem; font-weight: 900; color: #7e22ce;">${avgScore}</div>
        <div style="font-size: 0.72rem; font-weight: 700; color: #9333ea;">O'rtacha ball (${avgPct})</div>
      </div>
      <div style="background: #fff7ed; border: 1.5px solid #fed7aa; border-radius: 8px; padding: 0.6rem 0.4rem; text-align: center;">
        <div style="font-size: 1.2rem; font-weight: 900; color: #c2410c;">${quality}</div>
        <div style="font-size: 0.72rem; font-weight: 700; color: #ea580c;">A'lo 86%+ (${qualPct})</div>
      </div>
      <div style="background: #fef2f2; border: 1.5px solid #fecaca; border-radius: 8px; padding: 0.6rem 0.4rem; text-align: center;">
        <div style="font-size: 1.2rem; font-weight: 900; color: #b91c1c;">${blocked}</div>
        <div style="font-size: 0.72rem; font-weight: 700; color: #dc2626;">Bloklangan</div>
      </div>
    </div>

    <!-- Maktablar Reytingi Jadvali -->
    <div style="margin-bottom: 1.25rem;">
      <table class="a4-davomat-table" style="width: 100%; border-collapse: collapse; font-size: 0.78rem;">
        <thead>
          <tr style="background: #1e3a8a; color: #ffffff;">
            <th style="padding: 6px 8px; border: 1px solid #1e3a8a; text-align: center; width: 40px;">№</th>
            <th style="padding: 6px 8px; border: 1px solid #1e3a8a;">Ta'lim muassasasi (Maktab)</th>
            <th style="padding: 6px 8px; border: 1px solid #1e3a8a; text-align: center; width: 60px;">Reja</th>
            <th style="padding: 6px 8px; border: 1px solid #1e3a8a; text-align: center; width: 65px;">Topshirdi</th>
            <th style="padding: 6px 8px; border: 1px solid #1e3a8a; text-align: center; width: 60px;">Qoldi</th>
            <th style="padding: 6px 8px; border: 1px solid #1e3a8a; text-align: center; width: 75px;">Qamrov</th>
            <th style="padding: 6px 8px; border: 1px solid #1e3a8a; text-align: center; width: 85px;">O'rtacha ball</th>
            <th style="padding: 6px 8px; border: 1px solid #1e3a8a; text-align: center; width: 80px;">A'lo (86%+)</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml || '<tr><td colspan="8" style="text-align:center; padding: 1rem;">Ma\'lumotlar yuklanmoqda...</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- Rasmiy Tasdiq va Imzo -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 1.5rem; padding-top: 1rem; border-top: 1.5px solid #cbd5e1; font-size: 0.85rem;">
      <div>
        <b>Qo'shko'pir tumani ta'lim bo'limi</b><br>
        <span style="color: #64748b;">Axborot-tahlil va monitoring tizimi</span>
      </div>
      <div style="text-align: right;">
        Bosh mutaxassis: ____________________ <b>Umrbek Mamatov</b>
      </div>
    </div>
  `;

  document.body.appendChild(container);
  await new Promise(r => setTimeout(r, 150));

  html2canvas(container, {
    scale: 2, // 2x Retina resolution
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: 960,
    windowWidth: 1024,
    scrollX: 0,
    scrollY: 0
  }).then(canvas => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }

    const d = new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const filename = `KRS_Monitoring_Hisoboti_${dateStr}.jpg`;

    canvas.toBlob(blob => {
      if (!blob) {
        showToast("Rasm yaratilmadi, qayta urinib ko'ring", "⚠️");
        return;
      }

      const blobUrl = URL.createObjectURL(blob);

      // 1. Avtomatik yuklab olish
      try {
        const link = document.createElement('a');
        link.download = filename;
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          if (document.body.contains(link)) document.body.removeChild(link);
        }, 800);
      } catch (e) {
        console.warn("Avtomatik yuklashda xatolik:", e);
      }

      // 2. Telefonda ochiluvchi modal
      showMobileDavomatModal(blobUrl, blob, filename, "KRS Monitoring Rasmi (JPG) Tayyor!");
      showToast(`📸 Monitoring A4 Rasmi tayyor bo'ldi!`, "✅");
    }, 'image/jpeg', 0.95);

  }).catch(err => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
    console.error("html2canvas xatosi:", err);
    alert("Rasmni yaratishda xatolik yuz berdi. Iltimos qayta urinib ko'ring.");
  });
}
window.downloadMonitoringA4Jpg = downloadMonitoringA4Jpg;


// Mobile Modal Boshqaruvi
let currentDavomatBlob = null;
let currentDavomatFilename = '';
let currentDavomatBlobUrl = '';

function showMobileDavomatModal(blobUrl, blob, filename, customTitle = "KRS Hisoboti Rasmi (JPG) Tayyor!") {
  currentDavomatBlob = blob;
  currentDavomatFilename = filename;
  currentDavomatBlobUrl = blobUrl;

  const titleEl = document.getElementById('mobileModalTitle');
  if (titleEl && customTitle) titleEl.textContent = customTitle;

  const previewImg = document.getElementById('davomatMobilePreviewImg');
  if (previewImg) previewImg.src = blobUrl;

  const downloadBtn = document.getElementById('mobileDirectDownloadBtn');
  if (downloadBtn) {
    downloadBtn.onclick = () => {
      const link = document.createElement('a');
      link.download = filename;
      link.href = blobUrl;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) document.body.removeChild(link);
      }, 800);
      showToast("Fayl telefoningizga yuklanmoqda...", "📥");
    };
  }

  const shareBtn = document.getElementById('mobileShareTelegramBtn');
  if (shareBtn) {
    shareBtn.onclick = async () => {
      if (navigator.share && navigator.canShare) {
        try {
          const file = new File([blob], filename, { type: 'image/jpeg' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: "KRS Test Davomati",
              text: document.getElementById('a4DocSubjectTitle')?.textContent || "Kasbiy rivojlanish soati davomati",
              files: [file]
            });
            showToast("Telegramga muvaffaqiyatli ulashildi!", "✅");
            return;
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.warn("Share API xatosi:", err);
          }
        }
      }
      // Agar brauzerda faylni ulashish qo'llab-quvvatlanmasa:
      copyDavomatTelegramText();
      showToast("Telegram uchun tahliliy matn nusxalandi! Rasmni esa pastdan saqlab oling.", "📋");
    };
  }

  const modal = document.getElementById('davomatMobileModal');
  if (modal) modal.classList.add('open');
}

function closeDavomatMobileModal() {
  const modal = document.getElementById('davomatMobileModal');
  if (modal) modal.classList.remove('open');
}

// 9. Copy Formatted Telegram Text for Directors Group
function copyDavomatTelegramText() {
  const sessionNum = document.getElementById('davomatSessionSelect')?.value || '4';
  const subTitle = document.getElementById('a4DocSubjectTitle')?.textContent || 'Ijtimoiy fanlar';
  const timeStr = document.getElementById('a4DocTimestamp')?.textContent || '';

  const total = document.getElementById('a4KpiTotal')?.textContent || '0';
  const done = document.getElementById('a4KpiDone')?.textContent || '0';
  const debt = document.getElementById('a4KpiDebt')?.textContent || '0';
  const pct = document.getElementById('a4KpiPercent')?.textContent || '0%';

  const fullSchools = [];
  const debtorSchools = [];

  lastDavomatSchoolList.forEach(sch => {
    if (sch.total > 0) {
      if (sch.done >= sch.total) {
        fullSchools.push(sch.name);
      } else {
        debtorSchools.push(`${sch.name} — ${sch.done}/${sch.total} nafar (${sch.pct.toFixed(0)}%, ${sch.debt} ta qarz)`);
      }
    }
  });

  let text = `📢 DIQQAT! KRS TEST TOPSHIRISH DAVOMATI\n`;
  text += `🏛️ Fan / Yo'nalish: ${subTitle}\n`;
  text += `📅 Bosqich: ${sessionNum}-mashg'ulot\n`;
  text += `🕒 Vaqti: ${timeStr}\n\n`;
  text += `📊 TUMAN BO'YICHA UMUMIY KO'RSATKICH:\n`;
  text += `• Jami pedagoglar (Reja): ${total} nafar\n`;
  text += `• Test topshirdi: ${done} nafar\n`;
  text += `• Qarzdorlar: ${debt} nafar\n`;
  text += `• Davomat ko'rsatkichi: ${pct}\n\n`;

  if (fullSchools.length > 0) {
    text += `🏆 100% BAJARGAN MAKTABLAR (${fullSchools.length} ta):\n`;
    text += fullSchools.map((s, i) => `${i + 1}. ${s} ✅`).join('\n') + '\n\n';
  }

  if (debtorSchools.length > 0) {
    text += `⚠️ QARZDORLIGI MAVJUD MAKTABLAR (${debtorSchools.length} ta):\n`;
    text += debtorSchools.slice(0, 20).map((s, i) => `${i + 1}. ${s}`).join('\n');
    if (debtorSchools.length > 20) {
      text += `\n... va yana ${debtorSchools.length - 20} ta maktab`;
    }
    text += '\n\n';
  }

  text += `⚠️ Barcha maktab direktorlari va o'qituvchilari testni zudlik bilan yakunlashlari so'raladi!\n`;
  text += `🌐 Test topshirish: https://pedagog.umamatov.uz\n`;
  text += `👤 Mas'ul: Xorazm viloyati ta'lim va ilm-fan boshqarmasi huzuridagi Qo'shko'pir tumani ta'lim bo'limi Bosh mutaxassisi Umrbek Mamatov`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast("Telegram uchun tahliliy matn nusxalandi!", "📋");
    }).catch(err => {
      prompt("Nusxalash uchun Ctrl+C bosing:", text);
    });
  } else {
    prompt("Nusxalash uchun Ctrl+C bosing:", text);
  }
}

// ==========================================
// RESILIENT SUBMISSION QUEUE (3088 PEDAGOG VA GOOGLE SHEETS IMMUNITETI)
// ==========================================
const SUBMISSION_QUEUE_KEY = 'pedagog_submission_queue_2026';
let isProcessingQueue = false;

function enqueueSubmissionRecord(record) {
  try {
    const raw = localStorage.getItem(SUBMISSION_QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({
      ...record,
      queuedAt: getTashkentDateTimeString(),
      attempts: 0
    });
    localStorage.setItem(SUBMISSION_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn("Navbatga saqlashda xato:", err);
  }
}

async function processSubmissionQueue() {
  if (isProcessingQueue || !navigator.onLine) return;
  isProcessingQueue = true;

  try {
    const raw = localStorage.getItem(SUBMISSION_QUEUE_KEY);
    if (!raw) {
      isProcessingQueue = false;
      return;
    }
    const queue = JSON.parse(raw);
    if (!queue || queue.length === 0) {
      isProcessingQueue = false;
      return;
    }

    const remaining = [];
    for (const item of queue) {
      if (item.attempts < 5) {
        item.attempts++;
      } else {
        remaining.push(item);
      }
    }

    if (remaining.length === 0) {
      localStorage.removeItem(SUBMISSION_QUEUE_KEY);
    } else {
      localStorage.setItem(SUBMISSION_QUEUE_KEY, JSON.stringify(remaining));
    }
  } catch (e) {
    console.warn("Queue processing error:", e);
  } finally {
    isProcessingQueue = false;
  }
}

window.addEventListener('online', () => {
  processSubmissionQueue();
  loadLeaderboardFromSheet();
});

// Escape key listener for closing mobile image modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDavomatMobileModal();
  }
});

// ==========================================
// 10. ADMIN RESET TESTING DATA (SINOV NATIJALARINI TOZALASH)
// ==========================================
function resetTestingData() {
  const enteredPin = prompt("Admin (Umrbek Mamatov) maxfiy PIN-kodini kiriting:");
  if (!enteredPin || enteredPin.trim() !== "2026") {
    showAppAlert("Xato! Noto'g'ri PIN-kod kiritildi. Faqat bosh mutaxassis Umrbek Mamatov ma'lumotlarni tozalash huquqiga ega.", "Kirish taqiqlandi", "🔒");
    return;
  }

  showAppConfirm(
    "<b>⚠️ DIQQAT BOSHQARUVCHI (UMRBEK MAMATOV)!</b><br><br>" +
    "Barcha sinov test topshirish natijalari, saqlangan seanslar va bloklangan pedagoglar ro'yxati tozalansinmi?<br><br>" +
    "Bu amal orqali test maydoni ertangi rasmiy kunga to'liq 100% toza holatga keltiriladi.",
    () => {
      try {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        localStorage.removeItem(RESULTS_STORAGE_KEY);
        localStorage.removeItem(BLOCKED_STORAGE_KEY);
        sessionStorage.clear();
        state.isExamActive = false;
        state.isBlocked = false;
        state.tabSwitchCount = 0;
        state.userAnswers = {};
        state.activeQuestions = [];
        showAppAlert("✅ Barcha sinov ma'lumotlari, bloklar va seanslar muvaffaqiyatli tozalandi! Test maydoni toza holatga keltirildi.", "Muvaffaqiyat", "✅");
        setTimeout(() => {
          window.location.hash = '#setupView';
          window.location.reload();
        }, 1200);
      } catch (err) {
        showAppAlert("Tozalashda xatolik yuz berdi: " + err.message, "Xatolik", "❌");
      }
    },
    "Boshqaruv tozalash xizmati",
    "🗑️",
    "Ha, barchasini tozalash",
    "btn btn-danger"
  );
}
window.resetTestingData = resetTestingData;
window.adminReset = resetTestingData;

// Secret Admin Shortcut: Ctrl + Shift + Alt + R
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.altKey && (e.key === 'R' || e.key === 'r')) {
    e.preventDefault();
    resetTestingData();
  }
});

// ==========================================
// 11. SMART PHONE & ACCIDENTAL EXIT PROTECTION
// Mobil telefon sensorida bexosdan orqaga bosib yuborishdan himoya
// ==========================================
window.addEventListener('popstate', (e) => {
  if (state.isExamActive) {
    try {
      history.pushState({ examActive: true }, document.title, location.href);
    } catch (err) {}
    showAppConfirm(
      "<b>⚠️ DIQQAT! Test topshirish jarayoni ketmoqda!</b><br><br>" +
      "Telefoningizda yoki brauzerda 'Orqaga' amali bajarildi. Agar hozir testdan chiqsangiz, test to'xtatiladi va ball saqlanmaydi.<br><br>" +
      "Testni davom ettirasizmi?",
      () => {
        // Chiqishni tasdiqlasa:
        state.isExamActive = false;
        clearInterval(state.timerInterval);
        clearSavedSession();
        document.body.classList.remove('exam-active-mode');
        switchView('setup', true);
      },
      "Testdan chiqishni tasdiqlang",
      "⚠️",
      "Ha, testdan chiqish",
      "btn btn-danger"
    );
  }
});

window.addEventListener('beforeunload', (e) => {
  if (state.isExamActive) {
    e.preventDefault();
    e.returnValue = "Diqqat! Test hali yakunlanmadi. Chiqib ketsangiz, natijangiz bekor bo'lishi mumkin.";
    return e.returnValue;
  }
});


