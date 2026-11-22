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
const RESULTS_SHEET_URL = "https://docs.google.com/spreadsheets/d/1xYF0P9ZqumezUrH20qoyANjS0Hw6G-yr6hOwwwYOzAU/gviz/tq?tqx=out:csv&sheet=Varaq1";
const BLOCKED_SHEET_URL = "https://docs.google.com/spreadsheets/d/1xYF0P9ZqumezUrH20qoyANjS0Hw6G-yr6hOwwwYOzAU/gviz/tq?tqx=out:csv&sheet=BLOKLANGANLAR";

const PIN_CONFIG = {
  salt: "umamatov_pedagog_2026",
  masterPin: "2026"
};

// Remote Live Control Config
let remoteControl = {
  pin: "2026",
  status: "Ochiq",
  notice: "Test tizimi ochiq va faol. Muvaffaqiyat tilaymiz!",
  krsWeek1: "Ochiq"
};

const SESSION_STORAGE_KEY = 'pedagog_active_session_2026';
const RESULTS_STORAGE_KEY = 'pedagog_results_archive_2026';
const BLOCKED_STORAGE_KEY = 'pedagog_blocked_users_2026';

// Global State
const state = {
  teachersDb: {},
  allQuestions: [],
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
  monitoring: document.getElementById('monitoringView')
};

function switchView(viewName) {
  Object.values(views).forEach(v => {
    if (v) v.classList.remove('active');
  });
  if (views[viewName]) {
    views[viewName].classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (viewName === 'monitoring') {
      initOrRefreshMonitoringDashboard();
    }
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
      if (dataRow[3]) remoteControl.krsWeek1 = dataRow[3].trim();
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
document.addEventListener('DOMContentLoaded', async () => {
  setupAntiCheatListeners();
  await loadTeachersDatabase();
  await loadQuestionsDatabase();
  setupSchoolSubjectTeacherFlow();
  await fetchLiveControlConfig();
  await loadLeaderboardFromSheet();

  setInterval(fetchLiveControlConfig, 30000);
  setInterval(loadLeaderboardFromSheet, 60000);

  const startBtn = document.getElementById('startTestBtn');
  if (startBtn) {
    startBtn.addEventListener('click', handleValidateAndOpenPinModal);
  }
  
  document.getElementById('pinCancelBtn')?.addEventListener('click', closePinModal);
  document.getElementById('pinSubmitBtn')?.addEventListener('click', handlePinSubmit);
  document.getElementById('pinInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlePinSubmit();
  });
  setupPinToggleVisibility();

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

  checkInterruptedSession();
  if (window.location.hash === '#monitoringView') {
    switchView('monitoring');
  }
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

    const allSchoolTeachers = state.teachersDb[schoolVal] || [];
    const matchedTeachers = allSchoolTeachers.filter(t => {
      if (t.subject && t.subject.toLowerCase() === subjectVal.toLowerCase()) return true;
      if (t.all_krs && t.all_krs.some(k => k.toLowerCase() === subjectVal.toLowerCase())) return true;
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

  // Initial call for session dropdown
  refreshSessionDropdown(subjectSelect.value);
}

function refreshSessionDropdown(subjectVal) {
  const sessionSelect = document.getElementById('sessionSelect');
  if (!sessionSelect) return;

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
      opt.textContent = `🔥 4-mashg'ulot${dateLabel} — ✅ FAOL / ISHLASHGA OCHIQ (25 ta savol)`;
      if (String(prevVal) === "4" || !prevVal || parseInt(prevVal) < 4) {
        opt.selected = true;
      }
    } else if (num === 5 || num === 6) {
      opt.disabled = false;
      opt.style.color = '#1e293b';
      opt.textContent = `📅 ${num}-mashg'ulot${dateLabel} — ⏳ Tayyor / Navbatdagi (25 ta savol)`;
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
// SMART ANTI-CHEAT & PHONE CALL IMMUNITY
// ==========================================
function setupAntiCheatListeners() {
  const triggerViolation = (awayMs) => {
    if (!state.isExamActive || state.isBlocked) return;

    state.tabSwitchCount++;
    saveActiveSession();
    updateAntiCheatIndicator();

    const awaySec = Math.round(awayMs / 1000);

    if (state.tabSwitchCount === 1) {
      showAntiCheatModal(
        "⚠️",
        "OGOHLANTIRISH (1/3)!",
        `Siz test sahifasidan chiqib, boshqa ilova yoki vkladkaga o'tdingiz!<br>
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

  // Visibility Change with 7-second Phone Call & Notification Immunity
  document.addEventListener('visibilitychange', () => {
    if (!state.isExamActive || state.isBlocked) return;

    if (document.hidden) {
      // User minimized/left page or received a full-screen phone call
      state.awayStartTime = Date.now();
    } else {
      // User returned back to the test page
      if (state.awayStartTime > 0) {
        const awayMs = Date.now() - state.awayStartTime;
        state.awayStartTime = 0;

        // SMART PHONE CALL IMMUNITY: If away for less than 7 seconds, it was an incoming call / notification dismiss!
        if (awayMs < 7000) {
          showToast(`Qisqa uzilish (${Math.max(1, Math.round(awayMs/1000))} soniya) aniqlandi. Test davom etmoqda.`, "📞");
          return; // Immunity granted, no violation strike!
        }

        // If away for 7 seconds or more (switched app, searching, etc.)
        triggerViolation(awayMs);
      }
    }
  });

  // Desktop only: window blur (Bypassed on mobile phones to prevent false alarms on calls/notifications)
  if (!state.isMobileDevice) {
    window.addEventListener('blur', () => {
      if (!state.isExamActive || state.isBlocked) return;
      triggerViolation(5000);
    });
  }
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

  // Save to blocked local storage
  saveTeacherToBlockedList(state.teacherInfo, state.tabSwitchCount);

  // Save 0-ball record to local results archive
  saveResultRecord({
    name: state.teacherInfo.name,
    school: state.teacherInfo.school,
    subject: state.teacherInfo.subject,
    score: 0,
    total: state.activeQuestions.length,
    percent: 0,
    timeSpent: '0 daq 0 son',
    switches: state.tabSwitchCount,
    status: '🚫 Bloklangan (Qoidabuzarlik)',
    timestamp: new Date().toISOString()
  });

  document.getElementById('antiCheatModal')?.classList.remove('open');
  document.getElementById('confirmModal')?.classList.remove('open');

  switchView('blocked');
  loadLeaderboardFromSheet();
}

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
      blockedAt: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.push(record);
    }

    localStorage.setItem(BLOCKED_STORAGE_KEY, JSON.stringify(list));
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

  // 1. Check Live Google Sheet BLOKLANGANLAR varag'i
  try {
    const res = await fetch(BLOCKED_SHEET_URL);
    if (res.ok) {
      const csvText = await res.text();
      const rows = parseCsv(csvText);
      // Skip header row
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowName = (row[1] || '').trim().toLowerCase();
        if (rowName === normName) {
          const ruxsat = (row[6] || '').trim().toLowerCase();
          if (ruxsat === 'ochiq') {
            // Admin granted permission from Google Sheet!
            return { isBlocked: false, allowed: true };
          } else {
            // Still locked
            return {
              isBlocked: true,
              allowed: false,
              reason: "Google Sheetdagi 'BLOKLANGANLAR' ro'yxatida 'Qayta_Topshirishga_Ruxsat' holati 'Yopiq' deb belgilangan."
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn("BLOKLANGANLAR sheetini tekshirishda xatolik:", err);
  }

  // 2. Check local blocked storage fallback
  try {
    const raw = localStorage.getItem(BLOCKED_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      const found = list.find(item => item.name.toLowerCase() === normName);
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
  } catch (err) {
    console.warn("Local blocked storage tekshirilmadi:", err);
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
async function handleValidateAndOpenPinModal() {
  const schoolSelect = document.getElementById('schoolSelect');
  const teacherSelect = document.getElementById('teacherSelect');
  const customSchoolInput = document.getElementById('customSchoolInput');
  const customTeacherInput = document.getElementById('customTeacherInput');
  const subjectSelect = document.getElementById('subjectSelect');

  let school = schoolSelect.value;
  if (school === 'CUSTOM_SCHOOL') school = customSchoolInput.value.trim();
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
  if (name === 'CUSTOM_TEACHER') name = customTeacherInput.value.trim();
  if (!name) {
    alert("Iltimos, o'qituvchi F.I.Sh. (Familiya Ism Sharif)ingizni tanlang yoki kiriting!");
    teacherSelect.focus();
    return;
  }

  // CHECK IF TEACHER IS BLOCKED AND NEEDS ADMIN PERMISSION
  const blockCheck = await checkTeacherBlockedPermission(name);
  if (blockCheck.isBlocked && !blockCheck.allowed) {
    const textEl = document.getElementById('teacherBlockedText');
    if (textEl) {
      textEl.innerHTML = `
        Hurmatli <b>${name}</b>!<br>
        Siz avval test topshirish jarayonida 4 marta qoidabuzarlik qilganingiz sababli tizim tomonidan chetlatilgansiz.<br>
        <b>Sabab:</b> ${blockCheck.reason}<br>
        Qayta test topshirishingiz uchun bosh mutaxassis Umrbek Mamatov tomonidan ruxsat berilishi kerak.
      `;
    }
    document.getElementById('teacherBlockedModal')?.classList.add('open');
    return;
  }

  const sessionSelect = document.getElementById('sessionSelect');
  const session = parseInt(sessionSelect ? sessionSelect.value : 4) || 4;

  state.teacherInfo = { name, school, subject, session };

  // Check live status from Google Sheet
  await fetchLiveControlConfig();

  if (remoteControl.status.toLowerCase() === 'yopiq') {
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
}

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

function updateMonkeyPinState(isRevealed) {
  const pinInput = document.getElementById('pinInput');
  const toggleBtn = document.getElementById('togglePinVisibilityBtn');
  const monkeySvgs = document.querySelectorAll('.telegram-monkey-svg');

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

  if (toggleBtn) {
    const title = isRevealed ? "PIN-kodni yashirish (Ko'zlarni yopish)" : "PIN-kodni ko'rsatish (Ko'zlarni ochish)";
    toggleBtn.setAttribute('title', title);
    toggleBtn.setAttribute('aria-label', title);
  }
}

function setupPinToggleVisibility() {
  const toggleBtn = document.getElementById('togglePinVisibilityBtn');
  const pinInput = document.getElementById('pinInput');
  const btnContainer = document.getElementById('pinMonkeyBtnContainer');
  const mascotContainer = document.getElementById('pinMonkeyMascot');

  if (btnContainer && !btnContainer.innerHTML.trim()) {
    btnContainer.innerHTML = getTelegramMonkeySvgHtml(30);
  }
  if (mascotContainer && !mascotContainer.innerHTML.trim()) {
    mascotContainer.innerHTML = getTelegramMonkeySvgHtml(72);
  }

  const toggleHandler = () => {
    if (!pinInput) return;
    const isCurrentlyPassword = (pinInput.type === 'password');
    updateMonkeyPinState(isCurrentlyPassword);
    pinInput.focus();
  };

  toggleBtn?.addEventListener('click', toggleHandler);
  mascotContainer?.addEventListener('click', toggleHandler);
}

function openPinModal() {
  const pinInput = document.getElementById('pinInput');
  if (pinInput) {
    pinInput.value = '';
  }
  updateMonkeyPinState(false);
  document.getElementById('pinModal').classList.add('open');
  setTimeout(() => pinInput?.focus(), 200);
}

function closePinModal() {
  document.getElementById('pinModal').classList.remove('open');
}

async function handlePinSubmit() {
  const pinInput = document.getElementById('pinInput').value.trim();
  if (!pinInput || pinInput.length !== 4) {
    alert("Iltimos, 4 xonali PIN-kodni to'liq kiriting!");
    return;
  }

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
    alert("Kiritilgan PIN-kod noto'g'ri!\nAmaldagi PIN-kodni olish uchun bosh mutaxassis Umrbek Mamatovga murojaat qiling (+998 99 660 14 15).");
    document.getElementById('pinInput').value = '';
    document.getElementById('pinInput').focus();
  }
}

// ==========================================
// START TEST SESSION
// ==========================================
function startExamSession() {
  const countRequested = parseInt(document.getElementById('questionCount').value) || 25;
  state.timeLimitMinutes = parseInt(document.getElementById('timeLimit').value) || 30;

  const currentSession = state.teacherInfo.session || 4;

  let matched = state.allQuestions.filter(q => {
    return q.subject && 
           q.subject.toLowerCase() === state.teacherInfo.subject.toLowerCase() &&
           q.session === currentSession;
  });

  if (matched.length === 0) {
    alert("Tanlangan " + currentSession + "-mashg'ulot o'tib ketgan yoki faol emas. Iltimos, amaldagi 4-mashg'ulotni tanlang!");
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
    switches: state.tabSwitchCount,
    status: 'Muvaffaqiyatli topshirdi',
    timestamp: new Date().toISOString()
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
        <span><b>${idx + 1}-savol</b> (${q.grade || 'Maktab'}-sinf • ${q.topic || 'Darslik'})</span>
        <span style="font-weight: 700; color: ${isCorrect ? 'var(--accent)' : 'var(--danger)'};">
          ${isCorrect ? '✓ To\'g\'ri' : '✗ Noto\'g\'ri'}
        </span>
      </div>
      <div class="review-q-text">${q.question}</div>
      ${q.image ? `<div style="margin: 0.5rem 0;"><img src="${q.image}" style="max-width: 100%; max-height: 220px; border-radius: 6px;"></div>` : ''}
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

// ==========================================
// DYNAMIC LIVE LEADERBOARD (GOOGLE SHEET + LOCAL)
// ==========================================
async function loadLeaderboardFromSheet() {
  const tbody = document.getElementById('krsLeaderboardBody');
  if (!tbody) return;

  let combinedRecords = [];

  // 1. Fetch live results from Google Sheet
  try {
    const res = await fetch(RESULTS_SHEET_URL);
    if (res.ok) {
      const csvText = await res.text();
      const rows = parseCsv(csvText);
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r[1]) continue;
        combinedRecords.push({
          date: (r[0] || '').substring(0, 10),
          name: r[1],
          school: r[2] || '',
          subject: r[3] || '',
          score: parseInt(r[5]) || 0,
          total: parseInt(r[6]) || 25,
          percent: parseInt(r[7]) || 0,
          switches: parseInt(r[8]) || 0,
          status: r[9] || 'Muvaffaqiyatli topshirdi',
          timeSpent: '20 daq'
        });
      }
    }
  } catch (err) {
    console.warn("Google Sheet natijalarini yuklashda xatolik:", err);
  }

  // 2. Fetch blocked records from Google Sheet
  try {
    const resB = await fetch(BLOCKED_SHEET_URL);
    if (resB.ok) {
      const csvTextB = await resB.text();
      const rowsB = parseCsv(csvTextB);
      for (let i = 1; i < rowsB.length; i++) {
        const r = rowsB[i];
        if (!r[1]) continue;
        combinedRecords.push({
          date: (r[0] || '').substring(0, 10),
          name: r[1],
          school: r[2] || '',
          subject: r[3] || '',
          score: 0,
          total: 25,
          percent: 0,
          switches: parseInt(r[4]) || 4,
          status: '🚫 Bloklangan (Qoidabuzarlik)',
          timeSpent: 'To\'xtatildi'
        });
      }
    }
  } catch (err) {
    console.warn("BLOKLANGANLAR varag'ini yuklashda xatolik:", err);
  }

  // 3. Merge local recent submissions
  try {
    const localRaw = localStorage.getItem(RESULTS_STORAGE_KEY);
    if (localRaw) {
      const localList = JSON.parse(localRaw);
      localList.forEach(loc => {
        // Avoid duplicate by name and date
        const exists = combinedRecords.some(c => c.name.toLowerCase() === loc.name.toLowerCase());
        if (!exists) {
          combinedRecords.push({
            date: (loc.timestamp || '').substring(0, 10),
            name: loc.name,
            school: loc.school,
            subject: loc.subject,
            score: loc.score,
            total: loc.total || 25,
            percent: loc.percent,
            switches: loc.switches,
            status: loc.status || 'Muvaffaqiyatli topshirdi',
            timeSpent: loc.timeSpent || '18 daq'
          });
        }
      });
    }
  } catch (err) {}

  if (combinedRecords.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📊</div>
          <b>Hozircha test natijalari mavjud emas.</b><br>
          Pedagoglar test topshirishi bilan natijalar avtomatik ravishda reyting jadvalida paydo bo'ladi.
        </td>
      </tr>
    `;
    return;
  }

  // Sort: Non-blocked first by score descending, then blocked at the bottom
  combinedRecords.sort((a, b) => {
    const aBlocked = (a.status || '').includes('Bloklangan');
    const bBlocked = (b.status || '').includes('Bloklangan');
    if (aBlocked && !bBlocked) return 1;
    if (!aBlocked && bBlocked) return -1;
    return b.score - a.score;
  });

  tbody.innerHTML = '';

  combinedRecords.slice(0, 20).forEach((item, idx) => {
    const isBlocked = (item.status || '').includes('Bloklangan');
    const tr = document.createElement('tr');
    if (isBlocked) {
      tr.style.background = '#fef2f2';
    }

    let rankBadge = `<span class="rank-badge">${idx + 1}</span>`;
    if (isBlocked) {
      rankBadge = `<span class="rank-badge rank-blocked">🚫</span>`;
    } else if (idx === 0) {
      rankBadge = `<span class="rank-badge rank-1">🥇 1</span>`;
    } else if (idx === 1) {
      rankBadge = `<span class="rank-badge rank-2">🥈 2</span>`;
    } else if (idx === 2) {
      rankBadge = `<span class="rank-badge rank-3">🥉 3</span>`;
    }

    const scoreDisplay = isBlocked
      ? `<b style="color: var(--danger);">0 ball (0%)</b>`
      : `<b style="color: var(--accent);">${item.percent}% (${item.score}/${item.total})</b>`;

    const switchDisplay = isBlocked
      ? `<span style="color: var(--danger); font-weight: 800;">4 ta (Cheklandi)</span>`
      : (item.switches === 0 
          ? `<span style="color: var(--accent); font-weight: 700;">0 (Halol)</span>` 
          : `<span style="color: var(--warning); font-weight: 700;">${item.switches} ta</span>`);

    tr.innerHTML = `
      <td>${rankBadge}</td>
      <td><b>${item.name}</b> ${isBlocked ? '<br><small style="color: var(--danger); font-weight: 700;">[QOIDABUZARLIK TUFAYLI BLOKLANGAN]</small>' : ''}</td>
      <td>${item.school}</td>
      <td>${item.subject}</td>
      <td>${scoreDisplay}</td>
      <td>${isBlocked ? "To'xtatildi" : normalizeTimeToHms(item.timeSpent)}</td>
      <td>${switchDisplay}</td>
      <td>${item.date || 'Bugun'}</td>
    `;

    tbody.appendChild(tr);
  });
}

// ==========================================
// KRS MONITORING & ADVANCED ANALYTICS DASHBOARD
// ==========================================

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

let currentSchoolsSort = 'score'; // Default dynamic ranking by average score

// TAB 1: Maktablar Reytingi Jadvali (Dinamik o'zgaruvchan reyting va raqami bo'yicha ketma-ketlik)
function renderSchoolsRatingTable(teachers) {
  const tbody = document.getElementById('schoolsRatingTableBody');
  if (!tbody) return;

  // Update Sort Button UI Active states
  const btnScore = document.getElementById('sortBtnScore');
  const btnNumber = document.getElementById('sortBtnNumber');
  const btnCov = document.getElementById('sortBtnCoverage');
  const btnTeachers = document.getElementById('sortBtnTeachers');

  [btnScore, btnNumber, btnCov, btnTeachers].forEach(btn => {
    if (btn) {
      btn.classList.remove('btn-primary-mon', 'active');
      btn.classList.add('btn-outline-mon');
    }
  });

  if (currentSchoolsSort === 'score' && btnScore) {
    btnScore.classList.add('btn-primary-mon', 'active');
    btnScore.classList.remove('btn-outline-mon');
  } else if (currentSchoolsSort === 'number' && btnNumber) {
    btnNumber.classList.add('btn-primary-mon', 'active');
    btnNumber.classList.remove('btn-outline-mon');
  } else if (currentSchoolsSort === 'coverage' && btnCov) {
    btnCov.classList.add('btn-primary-mon', 'active');
    btnCov.classList.remove('btn-outline-mon');
  } else if (currentSchoolsSort === 'teachers' && btnTeachers) {
    btnTeachers.classList.add('btn-primary-mon', 'active');
    btnTeachers.classList.remove('btn-outline-mon');
  }

  // Aggregate stats for all 55 schools
  const schoolMap = new Map();
  const allSchools = Object.keys(state.teachersDb || {}).sort(compareSchoolsNatural);
  
  allSchools.forEach(sch => {
    schoolMap.set(sch, {
      name: sch,
      total: (state.teachersDb[sch] || []).length,
      participated: 0,
      blocked: 0,
      scoresSum: 0,
      aloCount: 0
    });
  });

  teachers.forEach(t => {
    if (!schoolMap.has(t.school)) {
      schoolMap.set(t.school, {
        name: t.school,
        total: 0,
        participated: 0,
        blocked: 0,
        scoresSum: 0,
        aloCount: 0
      });
    }
    const item = schoolMap.get(t.school);
    if (t.hasParticipated && !t.isBlocked) {
      item.participated++;
      item.scoresSum += (t.score || 0);
      if (t.scorePercent >= 86) item.aloCount++;
    } else if (t.isBlocked) {
      item.blocked++;
    }
  });

  const list = Array.from(schoolMap.values());

  // SORTING ALGORITHM
  list.sort((a, b) => {
    const doneA = a.participated + a.blocked;
    const doneB = b.participated + b.blocked;
    const covA = a.total > 0 ? (doneA / a.total) * 100 : 0;
    const covB = b.total > 0 ? (doneB / b.total) * 100 : 0;
    const avgA = a.participated > 0 ? (a.scoresSum / a.participated) : 0;
    const avgB = b.participated > 0 ? (b.scoresSum / b.participated) : 0;
    const aloA = a.participated > 0 ? (a.aloCount / a.participated) * 100 : 0;
    const aloB = b.participated > 0 ? (b.aloCount / b.participated) * 100 : 0;

    // 1. STRICT NUMBER ORDER (1-55)
    if (currentSchoolsSort === 'number') {
      return compareSchoolsNatural(a.name, b.name);
    }

    // 2. DYNAMIC QUALITY & SCORE RANKING (Default)
    if (currentSchoolsSort === 'score') {
      const aHasDone = a.participated > 0;
      const bHasDone = b.participated > 0;

      // Participating schools come first
      if (aHasDone && !bHasDone) return -1;
      if (!aHasDone && bHasDone) return 1;

      // Both participated: rank by highest average score!
      if (aHasDone && bHasDone) {
        if (Math.abs(avgB - avgA) > 0.001) {
          return avgB - avgA; // Higher average score rises to 1st place!
        }
        // Tie-breaker 1: Quality / A'lo percentage
        if (Math.abs(aloB - aloA) > 0.001) {
          return aloB - aloA;
        }
        // Tie-breaker 2: Coverage percentage
        if (Math.abs(covB - covA) > 0.001) {
          return covB - covA;
        }
        return compareSchoolsNatural(a.name, b.name);
      }

      // Neither participated: sort strictly in natural school number order (1, 2, 3...)
      return compareSchoolsNatural(a.name, b.name);
    }

    // 3. COVERAGE ORDER
    if (currentSchoolsSort === 'coverage') {
      if (Math.abs(covB - covA) > 0.001) return covB - covA;
      if (Math.abs(avgB - avgA) > 0.001) return avgB - avgA;
      return compareSchoolsNatural(a.name, b.name);
    }

    // 4. TEACHERS COUNT ORDER
    if (currentSchoolsSort === 'teachers') {
      if (b.total !== a.total) return b.total - a.total;
      return compareSchoolsNatural(a.name, b.name);
    }

    return compareSchoolsNatural(a.name, b.name);
  });

  tbody.innerHTML = '';
  list.forEach((sch, idx) => {
    const total = sch.total;
    const done = sch.participated + sch.blocked;
    const missing = Math.max(0, total - done);
    const covPct = total > 0 ? ((done / total) * 100) : 0;
    const avg = sch.participated > 0 ? (sch.scoresSum / sch.participated) : 0;
    const aloPct = sch.participated > 0 ? ((sch.aloCount / sch.participated) * 100) : 0;

    let barColor = '#10b981';
    if (covPct < 40) barColor = '#ef4444';
    else if (covPct < 70) barColor = '#f59e0b';

    let rankBadge = `<span class="rank-badge rank-default">${idx + 1}</span>`;
    if (sch.participated > 0) {
      if (idx === 0) rankBadge = `<span class="rank-badge rank-1" title="1-o'rin (Eng yuqori o'rtacha ball)">🥇 1</span>`;
      else if (idx === 1) rankBadge = `<span class="rank-badge rank-2" title="2-o'rin">🥈 2</span>`;
      else if (idx === 2) rankBadge = `<span class="rank-badge rank-3" title="3-o'rin">🥉 3</span>`;
    }

    let statusBadge = `<span class="status-badge status-missing">Kutilmoqda</span>`;
    if (sch.participated > 0) {
      if (covPct >= 80) {
        statusBadge = `<span class="status-badge status-passed">Yuqori qamrov (${done} ta)</span>`;
      } else {
        statusBadge = `<span class="status-badge status-passed">Topshirmoqda (${done} ta)</span>`;
      }
    }

    const avgScoreDisplay = avg > 0
      ? `<span style="font-size: 1.05rem; font-weight: 800; color: #059669;">${avg.toFixed(1)} ball</span>`
      : `<span style="color: #94a3b8; font-weight: 500;">—</span>`;

    const aloDisplay = aloPct > 0
      ? `<span style="font-weight: 700; color: #047857;">${aloPct.toFixed(1)}%</span> <small style="color: #64748b;">(${sch.aloCount} nafar)</small>`
      : `<span style="color: #94a3b8;">—</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${rankBadge}</td>
      <td>
        <b>${sch.name}</b>
        ${idx === 0 && sch.participated > 0 ? ' <span class="mon-live-badge" style="padding:0.1rem 0.4rem; font-size:0.7rem; margin-left:0.3rem;">🏆 Yetakchi</span>' : ''}
      </td>
      <td style="text-align: center; font-weight: 600;">${total}</td>
      <td style="text-align: center; font-weight: 700; color: #059669;">${done}</td>
      <td style="text-align: center; font-weight: 700; color: #d97706;">${missing}</td>
      <td>
        <div class="coverage-bar-wrapper">
          <div class="coverage-bar-bg">
            <div class="coverage-bar-fill" style="width: ${covPct.toFixed(0)}%; background: ${barColor};"></div>
          </div>
          <span style="font-size: 0.82rem; font-weight: 700; min-width: 45px; text-align: right;">${covPct.toFixed(1)}%</span>
        </div>
      </td>
      <td style="text-align: center;">${avgScoreDisplay}</td>
      <td style="text-align: center;">${aloDisplay}</td>
      <td style="text-align: center;">${statusBadge}</td>
    `;
    tbody.appendChild(tr);
  });
}

function sortSchoolsRating(criterion) {
  currentSchoolsSort = criterion;
  renderSchoolsRatingTable(monitoringFilteredList);
}


// TAB 2: Fanlar Kesimida Tahlil Jadvali
function renderSubjectsAnalysisTable(teachers) {
  const tbody = document.getElementById('subjectsAnalysisTableBody');
  if (!tbody) return;

  const subjectOrder = [
    "Boshlang'ich ta'lim", "Matematika", "Informatika", "Ona tili",
    "English", "Rus tili", "Biologiya", "Fizika", "Kimyo",
    "Geografiya", "Tarix", "Huquq", "Texnologiya", "Tasviriy san'at"
  ];

  const subMap = new Map();
  subjectOrder.forEach(sub => {
    subMap.set(sub, {
      name: sub,
      total: 0,
      participated: 0,
      blocked: 0,
      scoresSum: 0,
      aloCount: 0
    });
  });

  teachers.forEach(t => {
    let matchedSub = subjectOrder.find(s => (t.subject || '').toLowerCase().includes(s.toLowerCase()));
    if (!matchedSub) matchedSub = t.subject || "Boshqa";

    if (!subMap.has(matchedSub)) {
      subMap.set(matchedSub, {
        name: matchedSub,
        total: 0,
        participated: 0,
        blocked: 0,
        scoresSum: 0,
        aloCount: 0
      });
    }

    const item = subMap.get(matchedSub);
    item.total++;
    if (t.hasParticipated && !t.isBlocked) {
      item.participated++;
      item.scoresSum += (t.score || 0);
      if (t.scorePercent >= 86) item.aloCount++;
    } else if (t.isBlocked) {
      item.blocked++;
    }
  });

  const list = Array.from(subMap.values());
  tbody.innerHTML = '';

  list.forEach((sub, idx) => {
    const total = sub.total;
    const done = sub.participated + sub.blocked;
    const missing = Math.max(0, total - done);
    const covPct = total > 0 ? ((done / total) * 100) : 0;
    const avg = sub.participated > 0 ? (sub.scoresSum / sub.participated) : 0;
    const aloPct = sub.participated > 0 ? ((sub.aloCount / sub.participated) * 100) : 0;

    let barColor = '#10b981';
    if (covPct < 40) barColor = '#ef4444';
    else if (covPct < 70) barColor = '#f59e0b';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
      <td><b>${sub.name}</b></td>
      <td style="text-align: center; font-weight: 600;">${total}</td>
      <td style="text-align: center; font-weight: 700; color: #059669;">${done}</td>
      <td style="text-align: center; font-weight: 700; color: #d97706;">${missing}</td>
      <td>
        <div class="coverage-bar-wrapper">
          <div class="coverage-bar-bg">
            <div class="coverage-bar-fill" style="width: ${covPct.toFixed(0)}%; background: ${barColor};"></div>
          </div>
          <span style="font-size: 0.82rem; font-weight: 700; min-width: 45px; text-align: right;">${covPct.toFixed(1)}%</span>
        </div>
      </td>
      <td style="text-align: center; font-weight: 700;">${avg > 0 ? avg.toFixed(1) : '-'}</td>
      <td style="text-align: center; font-weight: 600;">${aloPct > 0 ? aloPct.toFixed(1) + '%' : '-'}</td>
      <td style="text-align: center;">
        <span class="status-badge ${covPct >= 50 ? 'status-passed' : 'status-missing'}">
          ${covPct >= 50 ? 'Faol' : 'Past'}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// TAB 3: Pedagoglar To'liq Monitoring Ro'yxati
function renderTeachersMonitoringTable(teachers) {
  const tbody = document.getElementById('teachersMonitoringTableBody');
  if (!tbody) return;

  if (teachers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2.5rem 1rem; color: #64748b;">
          🔍 Tanlangan filtr bo'yicha hech qanday pedagog topilmadi.
        </td>
      </tr>
    `;
    return;
  }

  const renderLimit = 250;
  const displayList = teachers.slice(0, renderLimit);

  tbody.innerHTML = '';
  displayList.forEach((t, idx) => {
    const tr = document.createElement('tr');
    if (t.isBlocked) {
      tr.style.background = '#fef2f2';
    }

    let statusHtml = `<span class="status-badge status-missing">⏳ Topshirmagan</span>`;
    let scoreDisplay = `-`;
    let pctDisplay = `-`;
    let switchDisplay = `<span style="color:#64748b;">-</span>`;
    let gradeBadge = `<span style="color:#64748b;">-</span>`;

    if (t.isBlocked) {
      statusHtml = `<span class="status-badge status-blocked">🚫 Bloklangan</span>`;
      scoreDisplay = `<b style="color: #ef4444;">0 / 25</b>`;
      pctDisplay = `<b style="color: #ef4444;">0%</b>`;
      switchDisplay = `<b style="color: #ef4444;">${t.switches} ta (Cheklandi)</b>`;
      gradeBadge = `<span class="status-badge status-blocked">Qoniqarsiz</span>`;
    } else if (t.hasParticipated) {
      statusHtml = `<span class="status-badge status-passed">✅ Topshirdi</span>`;
      scoreDisplay = `<b style="color: #059669;">${t.score} / ${t.total}</b>`;
      pctDisplay = `<b style="color: #059669;">${t.scorePercent}%</b>`;
      switchDisplay = t.switches === 0 
        ? `<span style="color: #059669; font-weight: 700;">0 (Halol)</span>` 
        : `<span style="color: #d97706; font-weight: 700;">${t.switches} ta</span>`;

      if (t.scorePercent >= 86) {
        gradeBadge = `<span class="status-badge status-passed">🏆 A'lo</span>`;
      } else if (t.scorePercent >= 71) {
        gradeBadge = `<span class="status-badge" style="background:#eff6ff; color:#1d4ed8;">🌟 Yaxshi</span>`;
      } else if (t.scorePercent >= 56) {
        gradeBadge = `<span class="status-badge" style="background:#fffbeb; color:#b45309;">👍 Qoniqarli</span>`;
      } else {
        gradeBadge = `<span class="status-badge status-blocked">⚠️ Qoniqarsiz</span>`;
      }
    }

    tr.innerHTML = `
      <td style="text-align: center; color: #64748b; font-size: 0.82rem;">${idx + 1}</td>
      <td><b>${t.name}</b></td>
      <td>${t.school}</td>
      <td>${t.subject}</td>
      <td style="text-align: center;">${statusHtml}</td>
      <td style="text-align: center;">${scoreDisplay}</td>
      <td style="text-align: center;">${pctDisplay}</td>
      <td style="text-align: center;">${switchDisplay}</td>
      <td style="text-align: center;">${gradeBadge}</td>
    `;
    tbody.appendChild(tr);
  });

  if (teachers.length > renderLimit) {
    const trMore = document.createElement('tr');
    trMore.innerHTML = `
      <td colspan="9" style="text-align: center; padding: 1rem; background: #f8fafc; color: #475569; font-size: 0.88rem;">
        ℹ️ Jami <b>${teachers.length.toLocaleString('uz-UZ')}</b> nafar pedagogdan dastlabki <b>${renderLimit}</b> nafari ko'rsatildi. 
        Barcha pedagoglarni yuklab olish uchun yuqoridagi <b>"Ro'yxatni yuklash (CSV)"</b> tugmasidan foydalaning.
      </td>
    `;
    tbody.appendChild(trMore);
  }
}

// Quick Filter Helpers
function resetMonitoringFilters() {
  const sSchool = document.getElementById('monSchoolFilter');
  const sSub = document.getElementById('monSubjectFilter');
  const sStatus = document.getElementById('monStatusFilter');
  const sSearch = document.getElementById('monSearchInput');
  if (sSchool) sSchool.value = 'ALL';
  if (sSub) sSub.value = 'ALL';
  if (sStatus) sStatus.value = 'ALL';
  if (sSearch) sSearch.value = '';
  applyMonitoringFilters();
}

function filterOnlyMissingTeachers() {
  const sStatus = document.getElementById('monStatusFilter');
  if (sStatus) sStatus.value = 'MISSING';
  switchMonTab('teachers');
  applyMonitoringFilters();
}

function filterOnlyPassedTeachers() {
  const sStatus = document.getElementById('monStatusFilter');
  if (sStatus) sStatus.value = 'PASSED';
  switchMonTab('teachers');
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

function exportMonitoringReportCSV() {
  if (!monitoringDataRaw || monitoringDataRaw.length === 0) {
    showToast("Eksport qilish uchun ma'lumot mavjud emas", "⚠️");
    return;
  }

  const schoolMap = new Map();
  Object.keys(state.teachersDb || {}).forEach(sch => {
    schoolMap.set(sch, {
      name: sch,
      total: (state.teachersDb[sch] || []).length,
      participated: 0,
      blocked: 0,
      scoresSum: 0,
      aloCount: 0
    });
  });

  monitoringFilteredList.forEach(t => {
    if (!schoolMap.has(t.school)) {
      schoolMap.set(t.school, { name: t.school, total: 0, participated: 0, blocked: 0, scoresSum: 0, aloCount: 0 });
    }
    const item = schoolMap.get(t.school);
    if (t.hasParticipated && !t.isBlocked) {
      item.participated++;
      item.scoresSum += (t.score || 0);
      if (t.scorePercent >= 86) item.aloCount++;
    } else if (t.isBlocked) {
      item.blocked++;
    }
  });

  let csv = "O'rin,Ta'lim muassasasi,Rejalashtirilgan pedagoglar,Topshirganlar,Topshirmaganlar (Qarzdor),Qamrov foizi,O'rtacha ball,A'lo natija foizi\n";
  const list = Array.from(schoolMap.values());
  list.sort((a, b) => {
    const covA = a.total > 0 ? (((a.participated + a.blocked) / a.total) * 100) : 0;
    const covB = b.total > 0 ? (((b.participated + b.blocked) / b.total) * 100) : 0;
    return covB - covA;
  });

  list.forEach((sch, idx) => {
    const total = sch.total;
    const done = sch.participated + sch.blocked;
    const missing = Math.max(0, total - done);
    const covPct = total > 0 ? ((done / total) * 100).toFixed(1) : "0.0";
    const avg = sch.participated > 0 ? (sch.scoresSum / sch.participated).toFixed(1) : "0.0";
    const aloPct = sch.participated > 0 ? ((sch.aloCount / sch.participated) * 100).toFixed(1) : "0.0";
    csv += `"${idx + 1}","${sch.name}","${total}","${done}","${missing}","${covPct}%","${avg}","${aloPct}%"\n`;
  });

  const dateStr = new Date().toISOString().substring(0, 10);
  downloadCSVFile(`KRS_Monitoring_Maktablar_Reytingi_${dateStr}.csv`, csv);
  showToast("Maktablar reytingi CSV formatida yuklab olindi", "📥");
}

function exportTeachersListCSV() {
  if (!monitoringFilteredList || monitoringFilteredList.length === 0) {
    showToast("Eksport qilish uchun ma'lumot mavjud emas", "⚠️");
    return;
  }

  let csv = "№,Pedagog F.I.Sh.,Ta'lim muassasasi,KRS Fani,Holati,To'plangan ball,Foiz,Qoidabuzarlik,Baho darajasi\n";
  monitoringFilteredList.forEach((t, idx) => {
    const scoreText = t.hasParticipated ? `${t.score}/${t.total}` : "-";
    const pctText = t.hasParticipated ? `${t.scorePercent}%` : "-";
    const switchText = t.isBlocked ? "4 ta (Bloklangan)" : (t.hasParticipated ? `${t.switches} ta` : "-");
    csv += `"${idx + 1}","${t.name}","${t.school}","${t.subject}","${t.statusText}","${scoreText}","${pctText}","${switchText}","${t.gradeLevel}"\n`;
  });

  const dateStr = new Date().toISOString().substring(0, 10);
  downloadCSVFile(`KRS_Pedagoglar_Monitoring_Royxati_${dateStr}.csv`, csv);
  showToast("Pedagoglar ro'yxati CSV formatida yuklab olindi", "📥");
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
      queuedAt: new Date().toISOString(),
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
