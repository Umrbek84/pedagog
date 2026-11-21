/**
 * krs_data.js — O'zbekiston Respublikasi Maktabgacha va maktab ta'limi vazirining 
 * 2026-yil 27-avgustdagi 319-sonli buyrug'iga 15-ilova:
 * "Kasbiy rivojlanish kuni" va "Kasbiy rivojlanish soati" (KRS) tadbirlari reja-jadvali.
 * pedagog.umamatov.uz portali uchun maxsus ishlab chiqilgan.
 */

const KRS_SCHEDULE = [
  {
    id: "boshlangich",
    title: "Boshlang'ich ta'lim",
    category: "Boshlang'ich ta'lim",
    targetSubjects: ["Boshlang'ich ta'lim"],
    icon: "🎒",
    audience: "1–4-sinf boshlang'ich sinf o'qituvchilari",
    description: "Alifbe, Ona tili, O'qish savodxonligi, Matematika, Tabiiy fanlar (1-4 sinf)",
    allocatedHours: "3 soat",
    dates: [
      { num: 1, date: "2026-10-24", label: "24-oktabr" },
      { num: 2, date: "2026-11-07", label: "07-noyabr" },
      { num: 3, date: "2026-11-21", label: "21-noyabr" }, // BUGUN!
      { num: 4, date: "2026-12-05", label: "05-dekabr" },
      { num: 5, date: "2026-12-19", label: "19-dekabr" },
      { num: 6, date: "2027-01-09", label: "09-yanvar" },
      { num: 7, date: "2027-01-23", label: "23-yanvar" },
      { num: 8, date: "2027-02-06", label: "06-fevral" },
      { num: 9, date: "2027-02-20", label: "20-fevral" },
      { num: 10, date: "2027-03-06", label: "06-mart" },
      { num: 11, date: "2027-03-20", label: "20-mart" },
      { num: 12, date: "2027-04-03", label: "03-aprel" }
    ]
  },
  {
    id: "aniq",
    title: "Aniq fanlar",
    category: "Aniq fanlar",
    targetSubjects: ["Matematika", "Informatika"],
    icon: "📐",
    audience: "Matematika, Algebra, Geometriya, Informatika va axborot texnologiyalari o'qituvchilari",
    description: "Matematika (1-11), Informatika va axborot texnologiyalari (5-11)",
    allocatedHours: "3 soat",
    dates: [
      { num: 1, date: "2026-10-15", label: "15-oktabr" },
      { num: 2, date: "2026-10-29", label: "29-oktabr" },
      { num: 3, date: "2026-11-12", label: "12-noyabr" },
      { num: 4, date: "2026-11-26", label: "26-noyabr" },
      { num: 5, date: "2026-12-10", label: "10-dekabr" },
      { num: 6, date: "2026-12-24", label: "24-dekabr" },
      { num: 7, date: "2027-01-14", label: "14-yanvar" },
      { num: 8, date: "2027-01-28", label: "28-yanvar" },
      { num: 9, date: "2027-02-11", label: "11-fevral" },
      { num: 10, date: "2027-02-25", label: "25-fevral" },
      { num: 11, date: "2027-03-11", label: "11-mart" },
      { num: 12, date: "2027-03-25", label: "25-mart" }
    ]
  },
  {
    id: "tabiiy",
    title: "Tabiiy fanlar va iqtisodiyot",
    category: "Tabiiy fanlar",
    targetSubjects: ["Biologiya", "Kimyo", "Fizika", "Geografiya"],
    icon: "🧬",
    audience: "Biologiya, Kimyo, Fizika, Geografiya, Iqtisodiy bilim asoslari o'qituvchilari",
    description: "Biologiya (5-11), Kimyo (7-11), Fizika va astronomiya (6-11), Geografiya (5-11)",
    allocatedHours: "3 soat",
    dates: [
      { num: 1, date: "2026-10-14", label: "14-oktabr" },
      { num: 2, date: "2026-10-28", label: "28-oktabr" },
      { num: 3, date: "2026-11-11", label: "11-noyabr" },
      { num: 4, date: "2026-11-25", label: "25-noyabr" },
      { num: 5, date: "2026-12-09", label: "09-dekabr" },
      { num: 6, date: "2026-12-23", label: "23-dekabr" },
      { num: 7, date: "2027-01-06", label: "06-yanvar" },
      { num: 8, date: "2027-01-20", label: "20-yanvar" },
      { num: 9, date: "2027-02-03", label: "03-fevral" },
      { num: 10, date: "2027-02-17", label: "17-fevral" },
      { num: 11, date: "2027-03-03", label: "03-mart" },
      { num: 12, date: "2027-03-17", label: "17-mart" }
    ]
  },
  {
    id: "filologiya-ona-tili",
    title: "Filologiya fanlari (Ona tili)",
    category: "Filologiya",
    targetSubjects: ["Ona tili"],
    icon: "📚",
    audience: "Ona tili va adabiyot fani pedagoglari",
    description: "Ona tili (5-11), O'zbek adabiyoti (5-11)",
    allocatedHours: "3 soat",
    dates: [
      { num: 1, date: "2026-10-13", label: "13-oktabr" },
      { num: 2, date: "2026-10-27", label: "27-oktabr" },
      { num: 3, date: "2026-11-10", label: "10-noyabr" },
      { num: 4, date: "2026-11-24", label: "24-noyabr" },
      { num: 5, date: "2026-12-15", label: "15-dekabr" },
      { num: 6, date: "2026-12-29", label: "29-dekabr" },
      { num: 7, date: "2027-01-12", label: "12-yanvar" },
      { num: 8, date: "2027-01-26", label: "26-yanvar" },
      { num: 9, date: "2027-02-09", label: "09-fevral" },
      { num: 10, date: "2027-02-23", label: "23-fevral" },
      { num: 11, date: "2027-03-09", label: "09-mart" },
      { num: 12, date: "2027-03-23", label: "23-mart" }
    ]
  },
  {
    id: "ijtimoiy",
    title: "Ijtimoiy fanlar",
    category: "Ijtimoiy fanlar",
    targetSubjects: ["Tarix", "Huquq", "Tarbiya"],
    icon: "📜",
    audience: "O'zbekiston tarixi, Jahon tarixi, Davlat va huquq asoslari, Tarbiya fani pedagoglari",
    description: "O'zbekiston tarixi (6-11), Jahon tarixi (7-11), Davlat va huquq asoslari (8-11), Tarbiya (1-11)",
    allocatedHours: "3 soat",
    dates: [
      { num: 1, date: "2026-10-12", label: "12-oktabr" },
      { num: 2, date: "2026-10-26", label: "26-oktabr" },
      { num: 3, date: "2026-11-09", label: "09-noyabr" },
      { num: 4, date: "2026-11-23", label: "23-noyabr" },
      { num: 5, date: "2026-12-07", label: "07-dekabr" },
      { num: 6, date: "2026-12-21", label: "21-dekabr" },
      { num: 7, date: "2027-01-04", label: "04-yanvar" },
      { num: 8, date: "2027-01-18", label: "18-yanvar" },
      { num: 9, date: "2027-02-01", label: "01-fevral" },
      { num: 10, date: "2027-02-15", label: "15-fevral" },
      { num: 11, date: "2027-03-01", label: "01-mart" },
      { num: 12, date: "2027-03-29", label: "29-mart" }
    ]
  },
  {
    id: "xorijiy-ingliz",
    title: "Xorijiy tillar (Ingliz tili)",
    category: "Xorijiy tillar",
    targetSubjects: ["English"],
    icon: "🇬🇧",
    audience: "Ingliz tili o'qituvchilari",
    description: "Ingliz tili (1-11-sinf darsliklari)",
    allocatedHours: "3 soat",
    dates: [
      { num: 1, date: "2026-10-16", label: "16-oktabr" },
      { num: 2, date: "2026-10-30", label: "30-oktabr" },
      { num: 3, date: "2026-11-13", label: "13-noyabr" },
      { num: 4, date: "2026-11-27", label: "27-noyabr" },
      { num: 5, date: "2026-12-11", label: "11-dekabr" },
      { num: 6, date: "2026-12-25", label: "25-dekabr" },
      { num: 7, date: "2027-01-15", label: "15-yanvar" },
      { num: 8, date: "2027-01-29", label: "29-yanvar" },
      { num: 9, date: "2027-02-12", label: "12-fevral" },
      { num: 10, date: "2027-02-26", label: "26-fevral" },
      { num: 11, date: "2027-03-12", label: "12-mart" },
      { num: 12, date: "2027-03-26", label: "26-mart" }
    ]
  },
  {
    id: "filologiya-rus-tili",
    title: "Filologiya fanlari (Rus tili)",
    category: "Filologiya",
    targetSubjects: ["Rus tili"],
    icon: "🇷🇺",
    audience: "Rus tili va adabiyoti o'qituvchilari",
    description: "Rus tili (1-11-sinf darsliklari)",
    allocatedHours: "3 soat",
    dates: [
      { num: 1, date: "2026-10-20", label: "20-oktabr" },
      { num: 2, date: "2026-11-03", label: "03-noyabr" },
      { num: 3, date: "2026-11-17", label: "17-noyabr" },
      { num: 4, date: "2026-12-01", label: "01-dekabr" },
      { num: 5, date: "2026-12-22", label: "22-dekabr" },
      { num: 6, date: "2027-01-05", label: "05-yanvar" },
      { num: 7, date: "2027-01-19", label: "19-yanvar" },
      { num: 8, date: "2027-02-02", label: "02-fevral" },
      { num: 9, date: "2027-02-16", label: "16-fevral" },
      { num: 10, date: "2027-03-02", label: "02-mart" },
      { num: 11, date: "2027-03-16", label: "16-mart" },
      { num: 12, date: "2027-04-06", label: "06-aprel" }
    ]
  },
  {
    id: "amaliy-texnologiya",
    title: "Amaliy fanlar (Texnologiya)",
    category: "Amaliy fanlar",
    targetSubjects: ["Texnologiya"],
    icon: "🛠️",
    audience: "Texnologiya (Mehnat ta'limi) fani pedagoglari",
    description: "Texnologiya va amaliy mehnat (1-9 sinflar)",
    allocatedHours: "3 soat",
    dates: [
      { num: 1, date: "2026-10-17", label: "17-oktabr" },
      { num: 2, date: "2026-10-31", label: "31-oktabr" },
      { num: 3, date: "2026-11-14", label: "14-noyabr" },
      { num: 4, date: "2026-11-28", label: "28-noyabr" },
      { num: 5, date: "2026-12-12", label: "12-dekabr" },
      { num: 6, date: "2026-12-26", label: "26-dekabr" },
      { num: 7, date: "2027-01-16", label: "16-yanvar" },
      { num: 8, date: "2027-01-30", label: "30-yanvar" },
      { num: 9, date: "2027-02-13", label: "13-fevral" },
      { num: 10, date: "2027-02-27", label: "27-fevral" },
      { num: 11, date: "2027-03-13", label: "13-mart" },
      { num: 12, date: "2027-03-27", label: "27-mart" }
    ]
  },
  {
    id: "amaliy-sanat",
    title: "Amaliy fanlar (Tasviriy san'at)",
    category: "Amaliy fanlar",
    targetSubjects: ["Tasviriy san'at", "Chizmachilik"],
    icon: "🎨",
    audience: "Tasviriy san'at va chizmachilik pedagoglari",
    description: "Tasviriy san'at (1-7), Chizmachilik (8-9)",
    allocatedHours: "3 soat",
    dates: [
      { num: 1, date: "2026-10-17", label: "17-oktabr" },
      { num: 2, date: "2026-10-31", label: "31-oktabr" },
      { num: 3, date: "2026-11-14", label: "14-noyabr" },
      { num: 4, date: "2026-11-28", label: "28-noyabr" },
      { num: 5, date: "2026-12-12", label: "12-dekabr" },
      { num: 6, date: "2026-12-26", label: "26-dekabr" },
      { num: 7, date: "2027-01-16", label: "16-yanvar" },
      { num: 8, date: "2027-01-30", label: "30-yanvar" },
      { num: 9, date: "2027-02-13", label: "13-fevral" },
      { num: 10, date: "2027-02-27", label: "27-fevral" },
      { num: 11, date: "2027-03-13", label: "13-mart" },
      { num: 12, date: "2027-03-27", label: "27-mart" }
    ]
  },
  {
    id: "xorijiy-onlayn",
    title: "Xorijiy tillar (Nemis va Fransuz tili)",
    category: "Xorijiy tillar",
    targetSubjects: ["Nemis tili", "Fransuz tili"],
    icon: "🌐",
    audience: "Nemis va Fransuz tili o'qituvchilari (Onlayn shaklda)",
    description: "Nemis tili (1-11), Fransuz tili (1-11)",
    allocatedHours: "3 soat",
    dates: [
      { num: 1, date: "2026-10-16", label: "16-oktabr" },
      { num: 2, date: "2026-10-30", label: "30-oktabr" },
      { num: 3, date: "2026-11-13", label: "13-noyabr" },
      { num: 4, date: "2026-11-27", label: "27-noyabr" },
      { num: 5, date: "2026-12-11", label: "11-dekabr" },
      { num: 6, date: "2026-12-25", label: "25-dekabr" },
      { num: 7, date: "2027-01-15", label: "15-yanvar" },
      { num: 8, date: "2027-01-29", label: "29-yanvar" },
      { num: 9, date: "2027-02-12", label: "12-fevral" },
      { num: 10, date: "2027-02-26", label: "26-fevral" },
      { num: 11, date: "2027-03-12", label: "12-mart" },
      { num: 12, date: "2027-03-26", label: "26-mart" }
    ]
  }
];

// Helper: Toshkent vaqti bo'yicha bugungi sana (YYYY-MM-DD)
function getTashkentDateString() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tashkent',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(now);
}

// Har bir fanning KRS holatini aniqlash
function calculateKrsStatus(datesList, todayStr) {
  let todaySession = null;
  let nextSession = null;
  let pastCount = 0;

  for (const item of datesList) {
    if (item.date === todayStr) {
      todaySession = item;
    } else if (item.date < todayStr) {
      pastCount++;
    } else if (item.date > todayStr && !nextSession) {
      nextSession = item;
    }
  }

  // Kunlar farqini hisoblash
  let daysUntilNext = null;
  if (nextSession) {
    const todayMs = new Date(todayStr + "T00:00:00").getTime();
    const nextMs = new Date(nextSession.date + "T00:00:00").getTime();
    daysUntilNext = Math.round((nextMs - todayMs) / (1000 * 60 * 60 * 24));
  }

  return {
    isToday: !!todaySession,
    todaySession,
    nextSession,
    daysUntilNext,
    pastCount,
    totalSessions: datesList.length
  };
}

// Barcha bugungi KRS fanlarini aniqlash
function getTodayKrsSubjects(todayStr) {
  return KRS_SCHEDULE.filter(item => {
    return item.dates.some(d => d.date === todayStr);
  });
}

// KRS Grafigini UI ga chizish
function renderKrsScheduleUI(activeFilter = 'all') {
  const container = document.getElementById('krsCardsGrid');
  if (!container) return;

  const todayStr = getTashkentDateString();
  const todaySubjects = getTodayKrsSubjects(todayStr);

  // Filterlash
  let list = KRS_SCHEDULE;
  if (activeFilter === 'today') {
    list = list.filter(item => item.dates.some(d => d.date === todayStr));
  } else if (activeFilter !== 'all') {
    list = list.filter(item => item.category.toLowerCase().includes(activeFilter.toLowerCase()));
  }

  // Agar filter bo'yicha ma'lumot topilmasa
  if (list.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: #fff; border-radius: 16px; border: 1px dashed var(--border);">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📅</div>
        <h4 style="font-size: 1.15rem; font-weight: 700;">Bu toifada bugun KRS kuni mavjud emas</h4>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 0.25rem;">Boshqa toifalarni yoki "Barchasi" filtrini tanlang.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(item => {
    const status = calculateKrsStatus(item.dates, todayStr);
    const isTodayCard = status.isToday;

    // Kunlar pill-lari
    const pillsHtml = item.dates.map(d => {
      const isPast = d.date < todayStr;
      const isToday = d.date === todayStr;
      const isNext = status.nextSession && d.date === status.nextSession.date;

      let pillClass = 'krs-pill';
      let badgeTag = '';

      if (isToday) {
        pillClass += ' krs-pill-today';
        badgeTag = '<span class="pill-dot">⚡️ Bugun</span>';
      } else if (isNext) {
        pillClass += ' krs-pill-next';
        badgeTag = '<span class="pill-dot">Navbatdagi</span>';
      } else if (isPast) {
        pillClass += ' krs-pill-past';
        badgeTag = '<span class="pill-dot">✓</span>';
      } else {
        pillClass += ' krs-pill-future';
      }

      return `
        <div class="${pillClass}" title="${d.num}-mashg'ulot: ${d.label} (3 soat)">
          <span class="pill-num">${d.num}</span>
          <span class="pill-date">${d.label}</span>
          ${badgeTag}
        </div>
      `;
    }).join('');

    // Holat ko'rsatkichi (Badge)
    let headerBadge = '';
    if (isTodayCard) {
      headerBadge = `
        <div class="krs-status-tag tag-today">
          <span class="pulse-icon">🔥</span>
          <b>BUGUN KRS KUNI! (${status.todaySession.num}-mashg'ulot)</b>
        </div>
      `;
    } else if (status.nextSession) {
      headerBadge = `
        <div class="krs-status-tag tag-next">
          <span>⏳</span>
          <b>Navbatdagi: ${status.nextSession.label}</b> (${status.daysUntilNext} kundan keyin)
        </div>
      `;
    } else {
      headerBadge = `
        <div class="krs-status-tag tag-done">
          <span>✓</span> Barcha 12 mashg'ulot yakunlangan
        </div>
      `;
    }

    const cardClass = isTodayCard ? 'krs-card krs-card-active-today' : 'krs-card';

    return `
      <div class="${cardClass}" id="krs-card-${item.id}">
        ${isTodayCard ? '<div class="krs-ribbon">BUGUN TADBIR KUNI</div>' : ''}
        
        <div class="krs-card-header">
          <div class="krs-card-icon-title">
            <div class="krs-card-icon">${item.icon}</div>
            <div>
              <h3 class="krs-card-title">${item.title}</h3>
              <p class="krs-card-audience">${item.audience}</p>
            </div>
          </div>
          ${headerBadge}
        </div>

        <div class="krs-progress-wrap">
          <div class="krs-progress-meta">
            <span>Dastur rejasi: <b>${status.pastCount + (status.isToday ? 1 : 0)} / ${status.totalSessions} mashg'ulot</b></span>
            <span>Vaqt: <b>${item.allocatedHours}</b></span>
          </div>
          <div class="krs-progress-bar">
            <div class="krs-progress-fill" style="width: ${Math.round(((status.pastCount + (status.isToday ? 1 : 0)) / status.totalSessions) * 100)}%;"></div>
          </div>
        </div>

        <div class="krs-card-body">
          <div class="krs-schedule-label">
            <span>📅 12 ta mashg'ulot o'tkazilish jadvali (KRS soatlari):</span>
          </div>
          <div class="krs-pills-grid">
            ${pillsHtml}
          </div>
        </div>

        <div class="krs-card-footer">
          <button type="button" class="btn btn-sm ${isTodayCard ? 'btn-primary' : 'btn-outline'}" onclick="selectKrsSubject('${item.targetSubjects[0]}')">
            ${isTodayCard ? '🔥 Bugungi testni topshirish' : '✍️ Shu fandan test ishlash'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Bosh sahifadagi Top-Banner (Hero banner)
function renderTopHeroKrsAlert() {
  const bannerContainer = document.getElementById('topKrsAlertBanner');
  if (!bannerContainer) return;

  const todayStr = getTashkentDateString();
  const todaySubjects = getTodayKrsSubjects(todayStr);

  if (todaySubjects.length > 0) {
    const s = todaySubjects[0];
    const status = calculateKrsStatus(s.dates, todayStr);
    bannerContainer.innerHTML = `
      <div class="krs-live-alert">
        <div class="krs-live-alert-left">
          <div class="live-pulse-badge">
            <span class="pulse-dot"></span>
            <b>BUGUN KRS KUNI!</b>
          </div>
          <div class="krs-live-alert-text">
            <h4>${s.icon} ${s.title} — ${status.todaySession ? status.todaySession.num : 1}-mashg'ulot (${status.todaySession ? status.todaySession.label : todayStr})</h4>
            <p>Bugun ushbu fan o'qituvchilari uchun Kasbiy Rivojlanish Soati bo'lib o'tmoqda. Darsliklar asosidagi testni topshirib, haftalik tuman reytingida yetakchilik qiling!</p>
          </div>
        </div>
        <div class="krs-live-alert-right">
          <button type="button" class="btn btn-primary" onclick="selectKrsSubject('${s.targetSubjects[0]}')">
            ⚡️ Bugungi testni topshirish
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="scrollToSection('krsGrafikSection')">
            📅 Reja-jadvalni ko'rish
          </button>
        </div>
      </div>
    `;
    bannerContainer.style.display = 'block';
  } else {
    bannerContainer.style.display = 'none';
  }
}

// Ro'yxatdan o'tish formasi ichida fanni tanlashda tezkor KRS eslatmasi
function checkSubjectKrsNotice(subjectName) {
  const noticeEl = document.getElementById('subjectKrsNotice');
  if (!noticeEl) return;

  if (!subjectName) {
    noticeEl.style.display = 'none';
    noticeEl.innerHTML = '';
    return;
  }

  const todayStr = getTashkentDateString();
  const matchedItem = KRS_SCHEDULE.find(item => 
    item.targetSubjects.some(s => s.toLowerCase() === subjectName.toLowerCase())
  );

  if (!matchedItem) {
    noticeEl.style.display = 'none';
    return;
  }

  const status = calculateKrsStatus(matchedItem.dates, todayStr);

  if (status.isToday) {
    noticeEl.className = 'subject-krs-notice notice-today';
    noticeEl.innerHTML = `
      <div class="notice-icon">🔥</div>
      <div>
        <b>DIQQAT: Bugun ${matchedItem.title} bo'yicha KRS KUNI! (${status.todaySession.num}-mashg'ulot)</b>
        <p>Siz topshirgan test natijasi ushbu kunning tuman reytingiga to'g'ridan-to'g'ri kiritiladi.</p>
      </div>
    `;
    noticeEl.style.display = 'flex';
  } else if (status.nextSession) {
    noticeEl.className = 'subject-krs-notice notice-next';
    noticeEl.innerHTML = `
      <div class="notice-icon">📅</div>
      <div>
        <b>Navbatdagi KRS kuni: ${status.nextSession.label} (${status.nextSession.num}-mashg'ulot)</b>
        <p>Tadbirga qadar yana <b>${status.daysUntilNext} kun</b> qoldi. Hozirdan tayyorgarlik ko'rib test topshirishingiz mumkin.</p>
      </div>
    `;
    noticeEl.style.display = 'flex';
  } else {
    noticeEl.style.display = 'none';
  }
}

// Kartadagi tugmani bosganda fanni avtomatik tanlab yuqoriga o'tish
function selectKrsSubject(subjectName) {
  switchView('setup');
  const sel = document.getElementById('subjectSelect');
  if (sel) {
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value.toLowerCase() === subjectName.toLowerCase()) {
        sel.selectedIndex = i;
        sel.dispatchEvent(new Event('change'));
        break;
      }
    }
  }
  const formCard = document.querySelector('.card-center');
  if (formCard) {
    formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    formCard.style.outline = '3px solid var(--primary)';
    setTimeout(() => { formCard.style.outline = 'none'; }, 1500);
  }
}

// Initsializatsiya
document.addEventListener('DOMContentLoaded', () => {
  renderTopHeroKrsAlert();
  renderKrsScheduleUI('all');

  // Filter tugmalari hodisasi
  const filterBtns = document.querySelectorAll('.krs-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterBtns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const filterValue = e.target.getAttribute('data-filter') || 'all';
      renderKrsScheduleUI(filterValue);
    });
  });

  // Fan tanlanganda KRS eslatmasi
  const subjectSelect = document.getElementById('subjectSelect');
  if (subjectSelect) {
    subjectSelect.addEventListener('change', (e) => {
      checkSubjectKrsNotice(e.target.value);
    });
  }
});
