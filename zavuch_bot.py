# -*- coding: utf-8 -*-
"""
Xorazm viloyati taʼlim va ilm-fan boşqarmasi huzuridagi
Qöşköpir tumani taʼlim bölimi
KRS Test Tizimi - Zavuch Nazorat Telegram Boti (@zavuch_krs_bot)
Masʼul: Boş mutaxassis Umrbek Mamatov (+998 99 660 14 15 | @umrbek_mamatov)

IMKONIYATLARI:
1. Har kuni ertalab 07:30 da guruhga kunlik PIN-kodni avtomatik e'lon qilish.
2. Saytdan (pedagog.umamatov.uz) yo'naltirilgan o'qituvchilarga avtomatik PIN-kod berish.
3. O'tgan sanalardagi o'tkazib yuborilgan mashg'ulotlar uchun ham PIN-kod berish (qayta ishlashga).
4. Kelajakdagi (vaqti yetmagan) kunlar uchun PIN-kodni sir saqlash va vaqti kelganda ochilishini tushuntirish.
5. Har bir berilgan PIN-kodni Google Sheet 'PIN_BERILGANLAR' varag'iga sekundlab qayd etish.
6. Qoidabuzarlik sababli bloklangan pedagoglarni (agar o'zi botga murojaat qilsa) avtomatik blokdan chiqarish,
   buni Google Sheetda 'Ochiq' qilib qayd etish va guruhga rasmiy xabarnoma yuborish.
7. Admin (Umrbek Mamatov) uchun to'liq boshqaruv buyruqlari.
"""

import os
import sys
import time
import json
import logging
import datetime
import asyncio
import requests
import io
import csv
import base64

from telethon import TelegramClient, events
from telethon.extensions import html
from telethon.tl.types import MessageEntitySpoiler

# Monkey-patch Telethon HTML parser to support <tg-spoiler> and <spoiler>
_orig_handle_starttag = html.HTMLToTelegramParser.handle_starttag
def _new_handle_starttag(self, tag, attrs):
    if tag in ('tg-spoiler', 'spoiler'):
        self._open_tags.appendleft(tag)
        self._open_tags_meta.appendleft(None)
        if tag not in self._building_entities:
            self._building_entities[tag] = MessageEntitySpoiler(
                offset=len(self.text),
                length=0
            )
        return
    _orig_handle_starttag(self, tag, attrs)
html.HTMLToTelegramParser.handle_starttag = _new_handle_starttag

BOT_TOKEN = "9021546030:AAG9DCoYOjBchW0bwCiOeENbpJOxVzyCUCU"
API_ID = 2040
API_HASH = "b18441a1ff607e10a989891a5462e627"

BASE_DIR = r"C:\Users\Monitoring\Desktop\ТОШҚИ МОНИТОРНИНГ\pedagog.umamatov.uz"
CONFIG_FILE = os.path.join(BASE_DIR, "zavuch_bot_config.json")
SESSION_FILE = os.path.join(BASE_DIR, "zavuch_krs_session")

# Google Sheets Webhook Backend URL
GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzzuJhhvcM3JdOLBshP4lSmZavHzRXax9jnX72Hm6jOH1cwCYaHSTKsCjGFtneYyDZg/exec"
PIN_SCHEDULE_SHEET_URL = "https://docs.google.com/spreadsheets/d/13ig6ubfR4ogSCtBrDVOtXRUIG2gWj2sAT__uMIFIJZM/gviz/tq?tqx=out:csv&sheet=PIN_KODLAR_JADVALI"
BLOCKED_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1xYF0P9ZqumezUrH20qoyANjS0Hw6G-yr6hOwwwYOzAU/gviz/tq?tqx=out:csv&sheet=BLOKLANGANLAR"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Yangi o'zbek lotin alifbosi transliteratsiyasi
def to_new_latin(text):
    if not text:
        return ""
    res = text
    # O' / o'
    res = res.replace("O‘", "Ö").replace("o‘", "ö")
    res = res.replace("O'", "Ö").replace("o'", "ö")
    res = res.replace("Oʻ", "Ö").replace("oʻ", "ö")
    res = res.replace("O`", "Ö").replace("o`", "ö")
    res = res.replace("Oʼ", "Ö").replace("oʼ", "ö")
    # G' / g'
    res = res.replace("G‘", "Ğ").replace("g‘", "ğ")
    res = res.replace("G'", "Ğ").replace("g'", "ğ")
    res = res.replace("Gʻ", "Ğ").replace("gʻ", "ğ")
    res = res.replace("G`", "Ğ").replace("g`", "ğ")
    res = res.replace("Gʼ", "Ğ").replace("gʼ", "ğ")
    # Sh / sh
    res = res.replace("Sh", "Ş").replace("SH", "Ş").replace("sh", "ş")
    # Ch / ch
    res = res.replace("Ch", "Ç").replace("CH", "Ç").replace("ch", "ç")
    return res

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logging.error(f"Config yuklashda xatolik: {e}")
    return {
        "group_chat_id": -1001320270372,
        "admin_ids": [131458889],
        "last_sent_date": None,
        "auto_post_hour": 7,
        "auto_post_minute": 30
    }

def save_config():
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(bot_state, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logging.error(f"Config saqlashda xatolik: {e}")

bot_state = load_config()

# Fanlarni KRS yo'nalishlariga moslashtirish lug'ati
KRS_KEYWORDS = {
    "ona tili": ["ona tili", "filologiya"],
    "rus tili": ["rus tili"],
    "tarix": ["tarix", "ijtimoiy"],
    "huquq": ["huquq", "ijtimoiy"],
    "tarbiya": ["tarbiya", "ijtimoiy"],
    "matematika": ["matematika", "aniq fanlar"],
    "informatika": ["informatika", "aniq fanlar"],
    "biologiya": ["biologiya", "tabiiy fanlar"],
    "kimyo": ["kimyo", "tabiiy fanlar"],
    "fizika": ["fizika", "tabiiy fanlar"],
    "geografiya": ["geografiya", "tabiiy fanlar"],
    "iqtisod": ["iqtisod", "tabiiy fanlar va iqtisodiyot"],
    "iqtisodiy bilim asoslari": ["iqtisod", "tabiiy fanlar va iqtisodiyot"],
    "tadbirkorlik": ["tadbirkorlik", "tabiiy fanlar va iqtisodiyot"],
    "tadbirkorlik asoslari": ["tadbirkorlik", "tabiiy fanlar va iqtisodiyot"],
    "ingliz tili": ["xorijiy", "ingliz"],
    "english": ["xorijiy", "ingliz"],
    "nemis tili": ["xorijiy", "nemis"],
    "fransuz tili": ["xorijiy", "fransuz"],
    "texnologiya": ["texnologiya", "amaliy fanlar"],
    "tasviriy san'at": ["tasviriy san'at", "amaliy fanlar"],
    "musiqa": ["musiqa", "amaliy fanlar"],
    "boshlang'ich ta'lim": ["boshlang'ich ta'lim"]
}

def fetch_krs_schedule():
    """Google Sheet jadvalidan barcha sanalarni yuklab oladi"""
    schedule = {}
    urls = [
        PIN_SCHEDULE_SHEET_URL,
        "https://docs.google.com/spreadsheets/d/13ig6ubfR4ogSCtBrDVOtXRUIG2gWj2sAT__uMIFIJZM/export?format=csv"
    ]
    for url in urls:
        try:
            resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
            if resp.status_code == 200:
                reader = csv.reader(io.StringIO(resp.text))
                rows = list(reader)
                for r in rows:
                    if len(r) >= 3:
                        date_str = r[0].strip()
                        if len(date_str) == 10 and date_str[4] == '-' and date_str[7] == '-':
                            weekday = r[1].strip() if len(r) > 1 else ""
                            pin = r[2].strip()
                            event = r[3].strip() if len(r) > 3 else ""
                            schedule[date_str] = {
                                "date": date_str,
                                "weekday": weekday,
                                "pin": pin,
                                "event": event
                            }
                if schedule:
                    break
        except Exception as e:
            logging.error(f"Google Sheet o'qishda xatolik ({url}): {e}")
    return schedule

def get_today_tashkent_date():
    utc_now = datetime.datetime.now(datetime.timezone.utc)
    tashkent_now = utc_now + datetime.timedelta(hours=5)
    return tashkent_now.strftime("%Y-%m-%d"), tashkent_now

def get_tashkent_datetime_str():
    utc_now = datetime.datetime.now(datetime.timezone.utc)
    tashkent_now = utc_now + datetime.timedelta(hours=5)
    return tashkent_now.strftime("%Y-%m-%d %H:%M:%S")

def format_daily_pin_message(krs_info):
    date_str = krs_info.get("date")
    weekday = to_new_latin(krs_info.get("weekday", ""))
    pin = krs_info.get("pin", "----")
    event = to_new_latin(krs_info.get("event", "KRS Test Sinovi"))
    
    try:
        d = datetime.datetime.strptime(date_str, "%Y-%m-%d")
        months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"]
        formatted_date = f"{d.day}-{months[d.month-1]} {d.year}-yil"
    except Exception:
        formatted_date = date_str

    msg = (
        f"📢 <b>DIQQAT: BUGUNGI KRS KUNI VA MAXSUS PIN-KOD!</b>\n\n"
        f"📅 <b>Sana:</b> {formatted_date} ({weekday})\n"
        f"📚 <b>Tadbir va Fan:</b> {event}\n\n"
        f"🔑 <b>BUGUNGI KUNLIK PIN-KOD:</b>\n"
        f"👉 <tg-spoiler><b>{pin}</b></tg-spoiler> 👈 <i>(Köriş uçun ustiga bosing!)</i>\n\n"
        f"🌐 <b>Rasmiy test portali:</b> https://pedagog.umamatov.uz\n"
        f"⏱️ <b>Savollar soni va vaqt:</b> 25 ta savol (30 daqiqa)\n\n"
        f"⚠️ <b>MUHIM QOIDALAR:</b>\n"
        f"• PIN-kod faqat bugun belgilangan fan öqituvçilari uçun amal qiladi.\n"
        f"• Test davomida ekrandan çiqiş, boşqa ilovalarga ötiş qatʼiyan taqiqlanadi (4-qoidabuzarlikda test avtomatik bekor qilinadi)!\n"
        f"• Test yakunlanişi bilan ballar tuman monitoring bazasida aks etadi.\n\n"
        f"👤 <b>Masʼul:</b> Qöşköpir tumani taʼlim bölimi Boş mutaxassisi <b>Umrbek Mamatov</b>\n"
        f"📞 <b>Boğlaniş:</b> +998 99 660 14 15 | @umrbek_mamatov"
    )
    return msg

def format_weekly_schedule(schedule, tashkent_now):
    curr_weekday = tashkent_now.weekday()
    monday = tashkent_now - datetime.timedelta(days=curr_weekday)
    
    week_dates = [(monday + datetime.timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
    months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"]
    
    lines = []
    lines.append("📋 <b>HAFTALIK KRS TADBIRLARI GRAFIGI VA REJASI</b>")
    lines.append(f"🗓 <b>Hafta oralig'i:</b> {week_dates[0]} dan {week_dates[-1]} gacha\n")
    
    weekdays_uz = ["Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba", "Yakshanba"]

    for i, dt in enumerate(week_dates):
        w_name = weekdays_uz[i]
        try:
            d_obj = datetime.datetime.strptime(dt, "%Y-%m-%d")
            f_date = f"{d_obj.day}-{months[d_obj.month-1]}"
        except Exception:
            f_date = dt

        if dt in schedule:
            item = schedule[dt]
            event_name = item.get("event", "").strip()
            if "Oddiy" in event_name:
                lines.append(f"▫️ <b>{to_new_latin(w_name)} ({f_date}):</b> Dam olish / Oddiy o'quv kuni")
            else:
                lines.append(f"🔹 <b>{to_new_latin(w_name)} ({f_date}):</b>\n   🎯 {to_new_latin(event_name)}")
        else:
            lines.append(f"▫️ <b>{to_new_latin(w_name)} ({f_date}):</b> Tadbir belgilanmagan")

    upcoming = []
    for dt, item in sorted(schedule.items()):
        if dt > week_dates[-1] and "Oddiy" not in item.get("event", ""):
            upcoming.append(item)
            if len(upcoming) >= 3:
                break
    
    if upcoming:
        lines.append("\n🔜 <b>Keyingi haftadagi rejalashtirilgan tadbirlar:</b>")
        for nk in upcoming:
            lines.append(f"• <b>{nk.get('date')} ({to_new_latin(nk.get('weekday',''))}):</b> {to_new_latin(nk.get('event',''))}")

    lines.append("\nℹ️ <i>Eslatma: Kunlik PIN-kodlar har kuni ertalab soat 07:30 da avtomatik tarzda guruhga eʼlon qilinadi.</i>")
    lines.append("🌐 <b>Rasmiy portal:</b> https://pedagog.umamatov.uz")
    lines.append("👤 <b>Masʼul:</b> Qöşköpir tumani taʼlim bölimi Boş mutaxassisi <b>Umrbek Mamatov</b>")
    return "\n".join(lines)

def format_welcome_message():
    return (
        f"🤝 <b>ASSALOMU ALAYKUM, HURMATLI MAKTAB DIREKTOR ÖRINBOSARLARI (ÖIBDÖLAR)!</b>\n\n"
        f"Men — <b>Qöşköpir tumani taʼlim bölimi</b>ning Kasbiy rivojlaniş soati (KRS) monitoring va xavfsizlik böyiça rasmiy boti (@zavuch_krs_bot)man.\n\n"
        f"📌 <b>ASOSIY VAZIFALARIM:</b>\n"
        f"1️⃣ Har bir KRS kuni ertalab soat 07:30 da tasdiqlangan grafik böyiça kunlik maxsus <b>PIN-kod</b>ni uşbu guruhga avtomatik yetkaziş;\n"
        f"2️⃣ PIN-kodlar xavfsizligini taʼminlaş maqsadida kodlarni yaşirin (spoiler) formatda taqdim etiş;\n"
        f"3️⃣ Saytdan yo'naltirilgan pedagoglarga shaxsiy tartibda to'g'ri PIN-kodlarni taqdim etish;\n"
        f"4️⃣ Qoidabuzarlik tufayli bloklangan pedagoglarni qayta topshirish uchun tekshirib, blokdan chiqarish;\n"
        f"5️⃣ ÖIBDÖlarga pedagoglar bilimini sinovdan ötkaziş jarayonlarini şaffof va tartibli taşkil etişda kömaklaşiş.\n\n"
        f"🌐 <b>Rasmiy test portali:</b> https://pedagog.umamatov.uz\n"
        f"👤 <b>Tuman koordinatori:</b> Boş mutaxassis <b>Umrbek Mamatov</b>\n\n"
        f"<i>Barça ÖIBDÖlarga masʼuliyatli faoliyatlarida muvaffaqiyat tilaymiz!</i>"
    )

# Fan va Mashg'ulot bo'yicha PIN-kodni topish funksiyasi
def resolve_pin_for_subject(subject_name, session_num, schedule_dict, target_date):
    sub_clean = (subject_name or '').lower().strip()
    keywords = [sub_clean]
    for k, v in KRS_KEYWORDS.items():
        if k in sub_clean:
            keywords.extend(v)
            break
            
    cands = []
    future_cands = []
    
    for dt, item in schedule_dict.items():
        event = item.get("event", "")
        ev_lower = event.lower()
        if "oddiy" in ev_lower:
            continue
            
        sess_str = f"{session_num}-mashg"
        if sess_str in ev_lower:
            match = any(kw in ev_lower for kw in keywords)
            if match:
                entry = {
                    "date": dt,
                    "weekday": item.get("weekday", ""),
                    "pin": item.get("pin", ""),
                    "event": event
                }
                if dt <= target_date:
                    cands.append(entry)
                else:
                    future_cands.append(entry)
                    
    cands.sort(key=lambda x: x["date"], reverse=True)
    future_cands.sort(key=lambda x: x["date"])
    return cands, future_cands

# Google Sheet 'PIN_BERILGANLAR' ga yozish funksiyasi
def log_pin_issuance(teacher_name, school, subject, session, pin, user_str):
    try:
        payload = {
            "type": "LOG_PIN",
            "timestamp": get_tashkent_datetime_str(),
            "name": teacher_name,
            "school": school,
            "subject": subject,
            "session": session,
            "pin": pin,
            "user": user_str
        }
        requests.post(GOOGLE_APPS_SCRIPT_URL, json=payload, timeout=8)
    except Exception as e:
        logging.error(f"PIN log yuborishda xatolik: {e}")

# O'qituvchining bloklanganligini tekshirish
def check_teacher_is_blocked(teacher_name):
    norm_target = (teacher_name or '').strip().lower()
    try:
        resp = requests.get(BLOCKED_SHEET_CSV_URL, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
        if resp.status_code == 200:
            reader = csv.reader(io.StringIO(resp.text))
            rows = list(reader)
            for i in range(len(rows) - 1, 0, -1):
                r = rows[i]
                if len(r) >= 2:
                    r_name = r[1].strip().lower()
                    if r_name == norm_target or (len(norm_target) > 5 and (r_name in norm_target or norm_target in r_name)):
                        ruxsat = r[6].strip().lower() if len(r) > 6 else ""
                        if ruxsat != "ochiq":
                            return True, r[2] if len(r) > 2 else "", r[3] if len(r) > 3 else ""
                        else:
                            return False, "", ""
    except Exception as e:
        logging.error(f"Bloklanganlarni tekshirishda xatolik: {e}")
    return False, "", ""

# O'qituvchini blokdan chiqarish (Google Sheet va Webhook)
def unblock_teacher_in_backend(teacher_name):
    try:
        payload = {
            "type": "UNBLOCK",
            "name": teacher_name,
            "timestamp": get_tashkent_datetime_str()
        }
        resp = requests.post(GOOGLE_APPS_SCRIPT_URL, json=payload, timeout=10)
        if resp.status_code == 200:
            res_json = resp.json()
            return res_json.get("unblocked", True)
    except Exception as e:
        logging.error(f"Unblock yuborishda xatolik: {e}")
    return True

# Telegram Client
client = TelegramClient(SESSION_FILE, API_ID, API_HASH)

# Avtomatik kunlik 07:30 PIN-kod yuboruvchi scheduler
async def scheduler_task():
    logging.info("Avtomatik kunlik scheduler xizmati ishga tushdi...")
    while True:
        try:
            today_str, tashkent_now = get_today_tashkent_date()
            hour = tashkent_now.hour
            minute = tashkent_now.minute
            
            target_h = bot_state.get("auto_post_hour", 7)
            target_m = bot_state.get("auto_post_minute", 30)
            
            # Agar soat 07:30 ga yetgan yoki undan o'tgan bo'lsa (server kechroq yoqilgan taqdirda ham) va bugun hali yuborilmagan bo'lsa:
            is_post_time = (hour > target_h) or (hour == target_h and minute >= target_m)
            if is_post_time and bot_state.get("last_sent_date") != today_str:
                group_id = bot_state.get("group_chat_id")
                if group_id:
                    schedule = fetch_krs_schedule()
                    if today_str in schedule:
                        krs_info = schedule[today_str]
                        if "Oddiy" not in krs_info.get("event", ""):
                            msg = format_daily_pin_message(krs_info)
                            await client.send_message(group_id, msg, parse_mode="html", link_preview=False)
                            bot_state["last_sent_date"] = today_str
                            save_config()
                            logging.info(f"Avtomatik PIN-kod guruhga jo'natildi: {today_str}")
            await asyncio.sleep(30)
        except Exception as e:
            logging.error(f"Scheduler xatosi: {e}")
            await asyncio.sleep(60)

@client.on(events.ChatAction)
async def chat_action_handler(event):
    if event.user_added or event.user_joined:
        try:
            me = await client.get_me()
            if event.user_id == me.id:
                chat_id = event.chat_id
                bot_state["group_chat_id"] = chat_id
                save_config()
                logging.info(f"Bot guruhga qo'shildi! Chat ID: {chat_id}")
                await event.respond(format_welcome_message(), parse_mode="html", link_preview=False)
        except Exception as e:
            logging.error(f"Chat action xatosi: {e}")

@client.on(events.NewMessage)
async def message_handler(event):
    try:
        chat_id = event.chat_id
        is_group = event.is_group or event.is_channel
        text = (event.raw_text or "").strip()
        sender = await event.get_sender()
        user_id = sender.id if sender else None
        username = (getattr(sender, 'username', '') or "").lower()
        first_name = getattr(sender, 'first_name', '') or ''
        user_mention = f"@{username}" if username else f"{first_name} (ID: {user_id})"
        
        if is_group:
            if bot_state.get("group_chat_id") != chat_id:
                bot_state["group_chat_id"] = chat_id
                save_config()

        # Adminni aniqlash (Umrbek Mamatov)
        is_admin = (username == "umrbek_mamatov") or (user_id in bot_state.get("admin_ids", [131458889]))
        if is_admin and user_id and user_id not in bot_state.get("admin_ids", []):
            bot_state.setdefault("admin_ids", []).append(user_id)
            save_config()

        cmd = text.split()[0].lower() if text else ""
        if "@" in cmd:
            cmd = cmd.split("@")[0]
        clean_text = text.lower().strip()

        # -------------------------------------------------------------
        # 1. GURUHDA BUYRUQLAR (FAQAT ADMIN UMRBEK MAMATOV UCHUN)
        # -------------------------------------------------------------
        if is_group:
            if not is_admin:
                return  # Oddiy a'zolarning buyruqlariga guruhda javob bermaydi

            if cmd in ["/start", "/tanishtiruv"] or clean_text in ["tanishtiruv", "start"]:
                await event.reply(format_welcome_message(), parse_mode="html", link_preview=False)

            elif cmd in ["/bugun", "/pin"] or clean_text in ["bugun", "pin", "kod", "pin kod"]:
                today_str, _ = get_today_tashkent_date()
                schedule = fetch_krs_schedule()
                if today_str in schedule and "Oddiy" not in schedule[today_str].get("event", ""):
                    daily_msg = format_daily_pin_message(schedule[today_str])
                    await event.reply(daily_msg, parse_mode="html", link_preview=False)
                else:
                    await event.reply(
                        f"📅 Bugun ({today_str}) tasdiqlangan grafik böyiça Kasbiy rivojlaniş soati (KRS) kuni emas.\n\n"
                        f"Navbatdagi KRS kuni böyiça maʼlumot oliş uçun /grafik buyruğidan foydalaning.",
                        parse_mode="html"
                    )

            elif cmd in ["/ertaga"] or clean_text in ["ertaga"]:
                _, tashkent_now = get_today_tashkent_date()
                tomorrow = tashkent_now + datetime.timedelta(days=1)
                tom_str = tomorrow.strftime("%Y-%m-%d")
                schedule = fetch_krs_schedule()
                
                if tom_str in schedule and "Oddiy" not in schedule[tom_str].get("event", ""):
                    tom_info = schedule[tom_str]
                    tom_weekday = to_new_latin(tom_info.get("weekday", ""))
                    tom_event = to_new_latin(tom_info.get("event", ""))
                    
                    await event.reply(
                        f"🔒 <b>ERTANGI KUN MAʼLUMOTI (Admin nazorati):</b>\n\n"
                        f"📅 <b>Sana:</b> {tom_str} ({tom_weekday})\n"
                        f"📚 <b>Fan:</b> {tom_event}\n"
                        f"🔑 <b>Ertangi PIN-kod:</b> <tg-spoiler><b>{tom_info.get('pin')}</b></tg-spoiler>\n\n"
                        f"<i>Uşbu PIN-kod ertaga ertalab soat 07:30 da avtomatik tarzda guruhga eʼlon qilinadi.</i>",
                        parse_mode="html"
                    )
                else:
                    await event.reply(f"Ertaga ({tom_str}) KRS kuni rejalashtirilmagan.", parse_mode="html")

            elif cmd in ["/grafik", "/reja", "/haftalik"] or clean_text in ["grafik", "reja", "haftalik"]:
                _, tashkent_now = get_today_tashkent_date()
                schedule = fetch_krs_schedule()
                weekly_msg = format_weekly_schedule(schedule, tashkent_now)
                await event.reply(weekly_msg, parse_mode="html", link_preview=False)
            return

        # -------------------------------------------------------------
        # 2. SHAXSIY CHAT (LICHKA) - PEDAGOGLAR VA ZAVUCHLAR UCHUN
        # -------------------------------------------------------------
        # A) SAYTDAN DEEP-LINK ORQALI KELGAN PARAMETRLARNI PARSE QILISH
        # Format: /start pin_ey... yoki /start unblock_ey...
        if cmd == "/start" and len(text.split()) > 1:
            param = text.split()[1].strip()
            
            # 1-HOLAT: PIN-KOD SO'ROVI (/start pin_BASE64)
            if param.startswith("pin_"):
                b64_str = param[4:]
                try:
                    padded = b64_str + '=' * (-len(b64_str) % 4)
                    raw_json = base64.urlsafe_b64decode(padded).decode('utf-8')
                    req_data = json.loads(raw_json)
                    
                    teacher_name = req_data.get("name", "").strip()
                    school = req_data.get("school", "").strip()
                    subject = req_data.get("subject", "").strip()
                    session = int(req_data.get("session", 4))
                    
                    today_str, tashkent_now = get_today_tashkent_date()
                    schedule = fetch_krs_schedule()
                    
                    open_cands, future_cands = resolve_pin_for_subject(subject, session, schedule, today_str)
                    
                    if open_cands:
                        best = open_cands[0]
                        pin_code = best["pin"]
                        event_title = best["event"]
                        krs_date = best["date"]
                        
                        # Google Sheet 'PIN_BERILGANLAR' ga yozish
                        log_pin_issuance(teacher_name, school, subject, session, pin_code, user_mention)
                        
                        is_today = (krs_date == today_str)
                        note_text = "Bugungi mashg'ulot" if is_today else f"{krs_date} sanasidagi mashg'ulot (Qayta ishlash / Kechikkan topshiruv)"
                        
                        await event.reply(
                            f"✅ <b>TEST UCHUN MAXSUS PIN-KOD TAQDIM ETILDI!</b>\n\n"
                            f"👤 <b>Pedagog:</b> <b>{to_new_latin(teacher_name)}</b>\n"
                            f"🏫 <b>Taʼlim muassasasi:</b> {to_new_latin(school)}\n"
                            f"📚 <b>Fan va Bosqich:</b> {to_new_latin(subject)} ({session}-maşğulot)\n"
                            f"📅 <b>KRS sanasi:</b> {krs_date} (<i>{note_text}</i>)\n\n"
                            f"🔑 <b>SIZNING PIN-KODINGIZ:</b>\n"
                            f"👉 <tg-spoiler><b>{pin_code}</b></tg-spoiler> 👈\n"
                            f"<i>(PIN-kodni ko'rish uchun ustiga bosing va saytga kiriting)</i>\n\n"
                            f"🌐 <b>Test sayti:</b> https://pedagog.umamatov.uz\n\n"
                            f"⚠️ <i>Eslatma: Test vaqtida sahifadan chiqish taqiqlanadi (4-qoidabuzarlikda test to'xtatiladi). Muvaffaqiyat tilaymiz!</i>",
                            parse_mode="html"
                        )
                        return
                    elif future_cands:
                        fut = future_cands[0]
                        fut_date = fut["date"]
                        fut_weekday = fut["weekday"]
                        await event.reply(
                            f"⏳ <b>HURMATLI {to_new_latin(teacher_name).upper()}!</b>\n\n"
                            f"Siz tanlagan <b>{to_new_latin(subject)} ({session}-maşğulot)</b> fanining Kasbiy rivojlanish soati (KRS) kuni hali yetib kelmadi.\n\n"
                            f"📅 <b>Ushbu fan bo'yicha test kuni:</b> <b>{fut_date} ({to_new_latin(fut_weekday)})</b>\n\n"
                            f"🔒 <i>Xavfsizlik va adolat mezonlari sababli PIN-kod faqat belgilangan kun ({fut_date}) ertalab soat 07:30 da eʼlon qilinadi va saytda faollashadi.</i>\n\n"
                            f"Iltimos, tasdiqlangan grafik bo'yicha belgilangan kuningizda test topshiring!",
                            parse_mode="html"
                        )
                        return
                    else:
                        await event.reply(
                            f"⚠️ Hurmatli <b>{to_new_latin(teacher_name)}</b>!\n\n"
                            f"Siz tanlagan <b>{to_new_latin(subject)}</b> fani bo'yicha tasdiqlangan grafikda PIN-kod topilmadi.\n\n"
                            f"Iltimos, saytda faningiz to'g'ri tanlanganini tekshiring yoki tuman koordinatori Umrbek Mamatovga murojaat qiling.",
                            parse_mode="html"
                        )
                        return
                except Exception as ex:
                    logging.error(f"Deep link pin parse error: {ex}")

            # 2-HOLAT: BLOKDAN CHIQARISH SO'ROVI (/start unblock_BASE64)
            elif param.startswith("unblock_"):
                b64_str = param[8:]
                try:
                    padded = b64_str + '=' * (-len(b64_str) % 4)
                    raw_json = base64.urlsafe_b64decode(padded).decode('utf-8')
                    req_data = json.loads(raw_json)
                    
                    teacher_name = req_data.get("name", "").strip()
                    school = req_data.get("school", "").strip()
                    subject = req_data.get("subject", "").strip()
                    
                    # 1. Backendda 'Ochiq' ga o'zgartirish
                    unblock_teacher_in_backend(teacher_name)
                    
                    # 2. Guruhga rasmiy xabarnoma yuborish
                    group_id = bot_state.get("group_chat_id")
                    if group_id:
                        g_msg = (
                            f"📢 <b>QOIDABUZARLIK TUFAYLI BLOKLANGAN PEDAGOGGA RUXSAT BERILDI</b>\n\n"
                            f"👤 <b>Pedagog:</b> {to_new_latin(teacher_name)}\n"
                            f"🏫 <b>Taʼlim muassasasi:</b> {to_new_latin(school)}\n"
                            f"📚 <b>Fan:</b> {to_new_latin(subject)}\n"
                            f"📱 <b>Murojaat qilgan Telegram:</b> {user_mention}\n\n"
                            f"✅ <i>Pedagog rasmiy botga qayta topshirish uchun murojaat qildi. Tizim tomonidan qayta test topshirishiga ruxsat ochildi.</i>\n\n"
                            f"⚠️ <b>Ogohlantirish:</b> Hurmatli ustoz, qayta topshirishda qoidabuzarliklarga (ekrandan chiqish, bildirishnomalarni ochish) yo'l qo'ymang!"
                        )
                        await client.send_message(group_id, g_msg, parse_mode="html", link_preview=False)
                    
                    # 3. O'qituvchining o'ziga tasdiq xabarini yuborish
                    await event.reply(
                        f"🔓 <b>QAYTA TEST TOPSHIRISHGA RUXSAT BERILDI!</b>\n\n"
                        f"Hurmatli <b>{to_new_latin(teacher_name)}</b>!\n"
                        f"Sizning arizangiz avtomatik qabul qilindi va test topshirishingiz uchun blok holati olib tashlandi.\n\n"
                        f"Guruhga rasmiy xabarnoma yetkazildi. Endi saytga qaytib, sahifani yangilang (F5) va testni qayta boshlashingiz mumkin.\n\n"
                        f"🌐 <b>Test portali:</b> https://pedagog.umamatov.uz\n\n"
                        f"⚠️ <i>Iltimos, qayta topshirish vaqtida telefoningizda 'Bezovta qilinmasin' rejimini yoqing va ekrandan chiqmang!</i>",
                        parse_mode="html"
                    )
                    return
                except Exception as ex:
                    logging.error(f"Deep link unblock parse error: {ex}")

        # B) ADMIN SHAXSIY CHATDA BUYRUQLAR YOZSA
        if is_admin:
            if cmd in ["/start", "/tanishtiruv"]:
                await event.reply(format_welcome_message(), parse_mode="html", link_preview=False)
            elif cmd in ["/bugun", "/pin"]:
                today_str, _ = get_today_tashkent_date()
                schedule = fetch_krs_schedule()
                if today_str in schedule and "Oddiy" not in schedule[today_str].get("event", ""):
                    daily_msg = format_daily_pin_message(schedule[today_str])
                    await event.reply(daily_msg, parse_mode="html", link_preview=False)
                else:
                    await event.reply(f"📅 Bugun ({today_str}) KRS kuni emas.", parse_mode="html")
            elif cmd in ["/grafik", "/reja", "/haftalik"]:
                _, tashkent_now = get_today_tashkent_date()
                schedule = fetch_krs_schedule()
                weekly_msg = format_weekly_schedule(schedule, tashkent_now)
                await event.reply(weekly_msg, parse_mode="html", link_preview=False)
            elif cmd in ["/ertaga"]:
                _, tashkent_now = get_today_tashkent_date()
                tomorrow = tashkent_now + datetime.timedelta(days=1)
                tom_str = tomorrow.strftime("%Y-%m-%d")
                schedule = fetch_krs_schedule()
                if tom_str in schedule and "Oddiy" not in schedule[tom_str].get("event", ""):
                    tom_info = schedule[tom_str]
                    await event.reply(
                        f"🔒 <b>ERTANGI KUN PIN-KODI:</b>\n"
                        f"📅 {tom_str} ({to_new_latin(tom_info.get('weekday',''))})\n"
                        f"📚 {to_new_latin(tom_info.get('event',''))}\n"
                        f"🔑 PIN: <tg-spoiler><b>{tom_info.get('pin')}</b></tg-spoiler>",
                        parse_mode="html"
                    )
            return

        # C) ODDIY FOYDALANUVCHI ODDIY MATN YOZSA
        await event.reply(
            f"🤖 <b>Assalomu alaykum, hurmatli pedagog!</b>\n\n"
            f"Men — <b>Qöşköpir tumani taʼlim bölimi</b>ning rasmiy KRS monitoring botiman (@zavuch_krs_bot).\n\n"
            f"🔑 <b>PIN-kod olish yoki blokdan chiqish uchun:</b>\n"
            f"Avval rasmiy saytimizga kiring, o'z maktabingiz, faningiz va F.I.Sh.ingizni tanlang, so'ngra <b>'Botdan PIN-kod olish'</b> tugmasini bosing.\n\n"
            f"🌐 <b>Rasmiy test portali:</b> https://pedagog.umamatov.uz\n"
            f"📞 <b>Murojaat uchun:</b> +998 99 660 14 15 | @umrbek_mamatov",
            parse_mode="html"
        )

    except Exception as e:
        logging.error(f"Message handler xatosi: {e}")

async def main():
    await client.start(bot_token=BOT_TOKEN)
    me = await client.get_me()
    logging.info(f"Bot muvaffaqiyatli ulandi: @{me.username} (ID: {me.id})")
    
    # Scheduler taskini orqa fonda ishga tushirish
    asyncio.create_task(scheduler_task())
    
    # Doimiy ishlash holatida ushlab turish
    await client.run_until_disconnected()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logging.info("Bot to'xtatildi.")
    except Exception as err:
        logging.critical(f"Kritik xatolik: {err}")
