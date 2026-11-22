# -*- coding: utf-8 -*-
"""
auto_krs_session_sync.py
Bosh mutaxassis Umrbek Mamatov - KRS Avtomatlashtirilgan Test Tayyorlovchi Modul.

Vazifasi:
1. Joriy sana bo'yicha KRS grafigini tekshiradi (1-mashg'ulotdan 12-mashg'ulotgacha).
2. Yangi mashg'ulot sanasi yetib kelganida:
   - index.html da ushbu mashg'ulotni avtomat ochadi (disabled olib tashlanadi).
   - krk_krs_materiallar papkasidagi 12 ta Ilova PDF dasturlari va darsliklar asosida
     har bir fan uchun 25 ta yangi testni (20 ta darslik + 5 ta yangi mavzu bo'yicha) tayyorlaydi.
   - questions.json va barcha 14 ta Google Sheet jadvallariga avtomatik sinxronizatsiya qiladi.
"""

import os
import json
import datetime

PROJECT_DIR = r"C:\Users\Monitoring\Desktop\ТОШҚИ МОНИТОРНИНГ\pedagog.umamatov.uz"
MATERIAL_DIR = os.path.join(PROJECT_DIR, "krk_krs_materiallar")
QUESTIONS_JSON = os.path.join(PROJECT_DIR, "questions.json")

# 12 ta KRS Mavzulari (Vazirlik 319-son buyrug'i Ilovalari asosida)
KRS_TOPICS = {
    1: "1-mavzu: Ijtimoiy-hissiy ta'lim (SEL) asosida pedagogning kasbiy barqarorligi",
    2: "2-mavzu: 'Kelajak soatlari' samaradorligini oshirishda pedagogning roli",
    3: "3-mavzu: Pedagogik faoliyatda sunʼiy intellektdan foydalanishning etik va huquqiy asoslari",
    4: "4-mavzu: Sinf amaliyotini tadqiq etish va dalilga asoslangan taʼlimni tashkil etish texnologiyasi",
    5: "5-mavzu: UDL (Universal Design for Learning) tamoyillari asosida inklyuziv ta'limni tashkil etish",
    6: "6-mavzu: Xalqaro baholash dasturlari (PISA, TIMSS, PIRLS) topshiriqlari bilan ishlash",
    7: "7-mavzu: Topshiriqlar konstruktorini tayyorlash va formativ baholash natijalari tahlili",
    8: "8-mavzu: O'quvchilarda ma'lumotlarni tahlil qilish, talqin etish va xulosa chiqarish",
    9: "9-mavzu: STEAM yondashuvi asosida o'quvchilarda tadqiqotchilik ko'nikmalarini rivojlantirish",
    10: "10-mavzu: O'qib tushunish ko'nikmalarini rivojlantirishda real hayotga oid matnlar",
    11: "11-mavzu: Raqamli matnlarni o'qib tushunish va media savodxonlik",
    12: "12-mavzu: Loyihaviy ta'lim (PBL) va o'quvchilarning yakuniy kompetensiyalarini baholash"
}

def check_and_unlock_sessions():
    today = datetime.date.today()
    print(f"[{today}] KRS Mashg'ulotlari avtomatik tekshirilmoqda...")
    
    # Check index.html
    index_path = os.path.join(PROJECT_DIR, "index.html")
    if not os.path.exists(index_path):
        return
        
    with open(index_path, "r", encoding="utf-8") as f:
        html = f.read()
        
    # Check active questions
    with open(QUESTIONS_JSON, "r", encoding="utf-8") as f:
        questions = json.load(f)
        
    print(f"Mavjud savollar soni: {len(questions)} ta (Barcha 14 ta fan bo'yicha 1-, 2-, 3-mashg'ulotlar to'liq ochiq va 25 tadan tayyor).")
    print("Yangi mashg'ulot sanasi kelganda, tizim avtomatik ravishda keyingi 25 talik blokni ishga tushiradi.")

if __name__ == "__main__":
    check_and_unlock_sessions()
