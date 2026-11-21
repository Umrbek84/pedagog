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
    const item = KRS_SCHEDULE.find(x => 
      x.targetSubjects && x.targetSubjects.some(s => s.toLowerCase() === (subjectVal || '').toLowerCase())
    );
    if (item && item.dates) {
      matchedDates = item.dates;
    }
  }

  const prevVal = sessionSelect.value || "3";
  sessionSelect.innerHTML = '';

  for (let num = 1; num <= 12; num++) {
    const opt = document.createElement('option');
    opt.value = num;
    const startQ = (num - 1) * 20 + 1;
    const endQ = num * 20;
    const dInfo = matchedDates.find(d => d.num === num);
    const dateLabel = dInfo ? ` (${dInfo.label})` : '';

    if (num <= 3) {
      opt.disabled = false;
      const statusLabel = num === 3 ? "✅ Ochiq (3-bosqich / O'tilgan)" : "✅ Ochiq (O'tilgan)";
      opt.textContent = `${num}-mashg'ulot (${startQ}–${endQ}-savollar)${dateLabel} — ${statusLabel}`;
      if (String(num) === String(prevVal)) {
        opt.selected = true;
      }
    } else {
      opt.disabled = true;
      opt.textContent = `${num}-mashg'ulot (${startQ}–${endQ}-savollar)${dateLabel} — ⏳ Reja bo'yicha (Kelgusi)`;
    }
    sessionSelect.appendChild(opt);
  }

  if (!sessionSelect.value) {
    sessionSelect.value = "3";
  }
}

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
        Qayta test topshirishingiz uchun mas'ul mutaxassis Umrbek Mamatov tomonidan ruxsat berilishi kerak.
      `;
    }
    document.getElementById('teacherBlockedModal')?.classList.add('open');
    return;
  }

  const sessionSelect = document.getElementById('sessionSelect');
  const session = parseInt(sessionSelect ? sessionSelect.value : 3) || 1;

  state.teacherInfo = { name, school, subject, session };

  // Check live status from Google Sheet
  await fetchLiveControlConfig();

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

  openPinModal();
}

const PIN_EYE_OPEN_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const PIN_EYE_CLOSED_SVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

function setupPinToggleVisibility() {
  const toggleBtn = document.getElementById('togglePinVisibilityBtn');
  const pinInput = document.getElementById('pinInput');
  const iconContainer = document.getElementById('pinEyeIconContainer');

  if (toggleBtn && pinInput && iconContainer) {
    toggleBtn.addEventListener('click', () => {
      if (pinInput.type === 'password') {
        pinInput.type = 'text';
        iconContainer.innerHTML = PIN_EYE_CLOSED_SVG;
        toggleBtn.setAttribute('title', "PIN-kodni yashirish");
        toggleBtn.setAttribute('aria-label', "PIN-kodni yashirish");
      } else {
        pinInput.type = 'password';
        iconContainer.innerHTML = PIN_EYE_OPEN_SVG;
        toggleBtn.setAttribute('title', "PIN-kodni ko'rsatish");
        toggleBtn.setAttribute('aria-label', "PIN-kodni ko'rsatish");
      }
      pinInput.focus();
    });
  }
}

function openPinModal() {
  const pinInput = document.getElementById('pinInput');
  const toggleBtn = document.getElementById('togglePinVisibilityBtn');
  const iconContainer = document.getElementById('pinEyeIconContainer');
  if (pinInput) {
    pinInput.value = '';
    pinInput.type = 'password';
  }
  if (iconContainer) {
    iconContainer.innerHTML = PIN_EYE_OPEN_SVG;
  }
  if (toggleBtn) {
    toggleBtn.setAttribute('title', "PIN-kodni ko'rsatish");
    toggleBtn.setAttribute('aria-label', "PIN-kodni ko'rsatish");
  }
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

  const currentSession = state.teacherInfo.session || 1;

  let matched = state.allQuestions.filter(q => {
    return q.subject && 
           q.subject.toLowerCase() === state.teacherInfo.subject.toLowerCase() &&
           q.session === currentSession;
  });

  if (matched.length === 0) {
    matched = state.allQuestions.filter(q => {
      const matchSubj = q.subject && (
        q.subject.toLowerCase().includes(state.teacherInfo.subject.toLowerCase()) ||
        state.teacherInfo.subject.toLowerCase().includes(q.subject.toLowerCase())
      );
      return matchSubj && q.session === currentSession;
    });
  }

  if (matched.length === 0) {
    matched = state.allQuestions.filter(q => {
      return q.subject && q.subject.toLowerCase() === state.teacherInfo.subject.toLowerCase();
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
  const timeFormatted = formatTimeHms(timeSpentSec);
  const sessionNum = state.teacherInfo.session || 1;

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

  // Save result to archive
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

  renderReviewList();
  switchView('result');
  loadLeaderboardFromSheet();
}

function saveResultRecord(record) {
  try {
    const raw = localStorage.getItem(RESULTS_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(record);
    localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
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
          total: parseInt(r[6]) || 20,
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
          total: 20,
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
            total: loc.total || 20,
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