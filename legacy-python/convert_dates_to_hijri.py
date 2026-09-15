#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import csv
import datetime
from habibiur import HijriCalendar

def convert_csv_to_hijri(input_file, output_file):
    """CSV dosyasındaki tarihleri Hijri takvime çevirir"""
    
    hijri_calendar = HijriCalendar()
    
    with open(input_file, 'r', encoding='utf-8') as infile, \
         open(output_file, 'w', encoding='utf-8', newline='') as outfile:
        
        reader = csv.reader(infile, delimiter=';')
        writer = csv.writer(outfile, delimiter=';')
        
        # İlk satırı oku (tsl_dataset)
        first_line = next(reader)
        writer.writerow(first_line)
        
        # Header satırını oku
        headers = next(reader)
        
        # Date sütununun indeksini bul
        try:
            date_idx = headers.index('Date')
        except ValueError:
            print("Hata: 'Date' sütunu bulunamadı!")
            return False
        
        # Header'ı yaz
        writer.writerow(headers)
        
        # Veri satırlarını işle
        converted_count = 0
        error_count = 0
        
        for row_num, row in enumerate(reader, start=3):  # 3'den başla çünkü 2 header satırı var
            try:
                # Orijinal tarihi parse et (hem YYYY-MM-DD hem DD/MM/YYYY formatını destekle)
                date_str = row[date_idx]
                
                if '-' in date_str:
                    # YYYY-MM-DD formatı
                    year, month, day = map(int, date_str.split('-'))
                elif '/' in date_str:
                    # DD/MM/YYYY formatı
                    day, month, year = map(int, date_str.split('/'))
                else:
                    raise ValueError(f"Tanınmayan tarih formatı: {date_str}")
                
                # Hijri tarihe çevir
                hijri_day, hijri_month, hijri_year = hijri_calendar.gregorian_to_hijri(year, month, day)
                
                # Hijri tarihi formatla (YYYY-MM-DD formatında)
                hijri_date_str = f"{hijri_year:04d}-{hijri_month:02d}-{hijri_day:02d}"
                
                # Yeni satırı oluştur
                new_row = row.copy()
                new_row[date_idx] = hijri_date_str
                
                writer.writerow(new_row)
                converted_count += 1
                
                # İlerleme göstergesi
                if converted_count % 1000 == 0:
                    print(f"İşlenen satır: {converted_count}")
                
            except Exception as e:
                print(f"Hata (satır {row_num}): {e}")
                error_count += 1
                # Hatalı satırı olduğu gibi yaz
                writer.writerow(row)
        
        print(f"\nİşlem tamamlandı!")
        print(f"Başarıyla dönüştürülen satır: {converted_count}")
        print(f"Hatalı satır: {error_count}")
        
        return True

def main():
    input_file = 'düzeltilmiş.csv'
    output_file = 'düzeltilmiş_hijri.csv'
    
    print("CSV dosyasındaki tarihleri Hijri takvime çeviriliyor...")
    print(f"Giriş dosyası: {input_file}")
    print(f"Çıkış dosyası: {output_file}")
    print("-" * 50)
    
    success = convert_csv_to_hijri(input_file, output_file)
    
    if success:
        print(f"\n✅ Başarıyla tamamlandı! Hijri tarihli dosya: {output_file}")
        
        # Örnek dönüştürme göster
        print("\n📅 Örnek dönüştürme:")
        hijri_calendar = HijriCalendar()
        
        # İlk tarih örneği (1959-02-21)
        hijri_day, hijri_month, hijri_year = hijri_calendar.gregorian_to_hijri(1959, 2, 21)
        hijri_formatted = hijri_calendar.format_hijri_date(hijri_day, hijri_month, hijri_year)
        
        print(f"Miladi: 1959-02-21 → Hijri: {hijri_year:04d}-{hijri_month:02d}-{hijri_day:02d}")
        print(f"Güzel format: {hijri_formatted}")
    else:
        print("\n❌ İşlem başarısız!")

if __name__ == "__main__":
    main()
