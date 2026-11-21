# Pedagog.umamatov.uz — Maktab Darsliklari Asosida Pedagoglar Test Tizimi

Ushbu platforma O'zbekiston Respublikasi umumta'lim maktablarining 1–11-sinf darsliklari (jami 211 ta darslik) asosida pedagoglarning o'z fani va dars o'tadigan sinflari bo'yicha bilimini sinovdan o'tkazish uchun yaratilgan.

---

## 🌟 Asosiy Imkoniyatlar:
1. **F.I.Sh. va Maktab:** Pedagog o'z shaxsiy ma'lumotlarini kiritadi.
2. **Fan tanlash:** 12 ta asosiy fanlar bo'yicha moslashtirilgan.
3. **Sinflarni Multi-select tanlash:**
   - O'qituvchi bitta sinfni (masalan: faqat 5-sinf) yoki bir nechta sinfni (masalan: 5, 6, 8-sinflar) tanlashi mumkin.
   - Savollar faqat tanlangan sinflar darsliklaridan saralanadi.
4. **Interaktiv Test Maydoni:**
   - 4 ta javob varianti: **A, B, C, D**.
   - Jonli vaqt hisoblagich (**Таймер**).
   - Savollar xaritasi (Navigator) — yechilgan va qolgan savollar rangi bilan ko'rinadi.
5. **Natijalar va Xatolar Tahlili:**
   - To'plangan ball va foiz.
   - Har bir savol bo'yicha darslikdagi to'g'ri javob va ilmiy izohi bilan tahlil.

---

## 🌐 Subdomenni ulash (GitHub Pages + pedagog.umamatov.uz):

1. **GitHub Repository:**
   Ushbu papkadagi fayllar (`index.html`, `style.css`, `app.js`, `questions.json`, `CNAME`) GitHub'dagi repoga yuklanadi.
   *(Diqqat: `.gitignore` orqali 3 GB hajmdagi PDF darsliklar avtomatik e'tibordan chetda qoldiriladi va repoga kirmaydi).*

2. **DNS sozlamalari (`umamatov.uz` domen boshqaruvida):**
   Domen boshqaruv panelida (cPanel, Cloudflare yoki hosting provayderda) bitta `CNAME` yozuvi qo'shiladi:
   - **Turi (Type):** `CNAME`
   - **Nomi (Name/Host):** `pedagog`
   - **Maqsad (Target/Value):** `<sizning_github_username>.github.io`
   - **TTL:** Avto (yoki 300)

3. **GitHub Pages sozlamasida:**
   - `Settings` -> `Pages` bo'limiga kirib:
   - **Source:** `Deploy from a branch` (main yoki master)
   - **Custom domain:** `pedagog.umamatov.uz`
   - **Enforce HTTPS:** Yoqiladi (Avtomatik bepul SSL beriladi).
