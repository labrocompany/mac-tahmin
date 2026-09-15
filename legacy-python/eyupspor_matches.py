#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Eyüpspor maçlarını Hicri takvime çevirip database.csv'ye ekleyen script
"""

import csv
import datetime
from habibiur import HijriCalendar

# Eyüpspor'un 2024-2025 sezonu maçları
matches = [
    # Tarih (GG.AA.YYYY), Ev Sahibi, Deplasman, Ev Skoru, Deplasman Skoru
    ("11.08.2024", "Alanyaspor", "Eyupspor", 1, 1),
    ("19.08.2024", "Eyupspor", "Bodrum FK", 4, 1),
    ("24.08.2024", "Sivasspor", "Eyupspor", 0, 1),
    ("01.09.2024", "Eyupspor", "Trabzonspor", 0, 0),
    ("15.09.2024", "Kayserispor", "Eyupspor", 2, 2),
    ("22.09.2024", "Besiktas", "Eyupspor", 2, 1),
    ("29.09.2024", "Eyupspor", "Gaziantep FK", 3, 2),
    ("06.10.2024", "Konyaspor", "Eyupspor", 2, 1),
    ("19.10.2024", "Eyupspor", "Goztepe", 1, 0),
    ("28.10.2024", "Basaksehir", "Eyupspor", 1, 1),
    ("03.11.2024", "Eyupspor", "Hatayspor", 2, 0),
    ("09.11.2024", "Adana Demirspor", "Eyupspor", 0, 1),
    ("10.12.2024", "Eyupspor", "Galatasaray", 0, 2),
    ("22.12.2024", "Genclerbirligi", "Eyupspor", 1, 1),
    ("24.12.2024", "Eyupspor", "Goztepe", 0, 0),
    ("31.12.2024", "Kocaelispor", "Eyupspor", 1, 1),
    ("18.01.2025", "Eyupspor", "Kasimpasa", 2, 1),
    ("25.01.2025", "Trabzonspor", "Eyupspor", 2, 0),
]

def convert_to_hijri(date_str):
    """Miladi tarihi Hicri takvime çevirir"""
    day, month, year = map(int, date_str.split('.'))
    hijri_calendar = HijriCalendar()
    hijri_day, hijri_month, hijri_year = hijri_calendar.gregorian_to_hijri(year, month, day)
    return f"{hijri_year}-{hijri_month:02d}-{hijri_day:02d}"

def determine_result(home_team, away_team, home_score, away_score):
    """Maç sonucunu belirler (H: Home win, A: Away win, D: Draw)"""
    if home_score > away_score:
        return 'H'
    elif away_score > home_score:
        return 'A'
    else:
        return 'D'

def main():
    """Ana fonksiyon"""
    hijri_calendar = HijriCalendar()
    output_rows = []

    print("🔄 Eyüpspor maçları Hicri takvime çevriliyor...")

    for date_str, home_team, away_team, home_score, away_score in matches:
        # Miladi tarihi Hicri'ye çevir
        hijri_date = convert_to_hijri(date_str)

        # Sonucu belirle
        result = determine_result(home_team, away_team, home_score, away_score)

        # CSV formatına uygun satır oluştur
        row = {
            'Date': hijri_date,
            'HomeTeam': home_team,
            'AwayTeam': away_team,
            'HomeGoals': float(home_score),
            'AwayGoals': float(away_score),
            'Result': result,
            'Source': 'Turkish_Superlig_2024_25'
        }

        output_rows.append(row)
        print(f"✅ {date_str} ({hijri_date}) - {home_team} {home_score}-{away_score} {away_team} [{result}]")

    print(f"\n📊 Toplam {len(output_rows)} maç işlendi")

    # Database.csv'ye ekle
    print("\n📝 database.csv'ye ekleniyor...")

    with open('database.csv', 'a', encoding='utf-8', newline='') as f:
        fieldnames = ['Date', 'HomeTeam', 'AwayTeam', 'HomeGoals', 'AwayGoals', 'Result', 'Source']
        writer = csv.DictWriter(f, fieldnames=fieldnames)

        for row in output_rows:
            writer.writerow(row)

    print(f"✅ {len(output_rows)} maç database.csv'ye eklendi!")

    # Eyüpspor maç sayısını kontrol et
    print("\n🔍 Eyüpspor maçları kontrol ediliyor...")
    eyupspor_matches = 0

    with open('database.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if 'Eyupspor' in row.get('HomeTeam', '') or 'Eyupspor' in row.get('AwayTeam', ''):
                eyupspor_matches += 1

    print(f"✅ Veritabanında toplam {eyupspor_matches} Eyüpspor maçı bulunuyor")

if __name__ == "__main__":
    main()
