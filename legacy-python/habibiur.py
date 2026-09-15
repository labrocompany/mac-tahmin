#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import datetime
import math
import sys

class HijriCalendar:
    """
    Gelişmiş Hijri Takvim Dönüştürücü
    Julian Day Number algoritması kullanarak kesin dönüştürme yapar
    """
    
    def __init__(self):
        # Hijri epoch (1 Muharrem 1 H = 16 Temmuz 622 M)
        self.hijri_epoch_jd = 1948439.5
        
        # Hijri ay isimleri
        self.hijri_months = [
            "Muharrem", "Safer", "Rebiülevvel", "Rebiülahir",
            "Cemaziyelevvel", "Cemaziyelahir", "Recep", "Şaban",
            "Ramazan", "Şevval", "Zilkade", "Zilhicce"
        ]
        
        # Hijri ayların uzunlukları (29-30 gün döngüsü)
        self.month_lengths = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29]
    
    def gregorian_to_julian_day(self, year, month, day):
        """Gregorian tarihi Julian Day Number'a çevirir"""
        if month <= 2:
            year -= 1
            month += 12
        
        a = math.floor(year / 100)
        b = 2 - a + math.floor(a / 4)
        
        if year < 1583 or (year == 1582 and month < 10) or (year == 1582 and month == 10 and day < 15):
            b = 0
        
        jd = math.floor(365.25 * (year + 4716)) + math.floor(30.6001 * (month + 1)) + day + b - 1524.5
        return jd
    
    def julian_day_to_gregorian(self, jd):
        """Julian Day Number'ı Gregorian tarihe çevirir"""
        jd = jd + 0.5
        z = math.floor(jd)
        f = jd - z
        
        if z < 2299161:
            a = z
        else:
            alpha = math.floor((z - 1867216.25) / 36524.25)
            a = z + 1 + alpha - math.floor(alpha / 4)
        
        b = a + 1524
        c = math.floor((b - 122.1) / 365.25)
        d = math.floor(365.25 * c)
        e = math.floor((b - d) / 30.6001)
        
        day = b - d - math.floor(30.6001 * e) + f
        month = e - 1 if e < 14 else e - 13
        year = c - 4716 if month > 2 else c - 4715
        
        return int(year), int(month), int(day)
    
    def gregorian_to_hijri(self, year, month, day):
        """Gregorian tarihi Hijri tarihe çevirir (Julian Day algoritması)"""
        # Gregorian'ı Julian Day'e çevir
        jd = self.gregorian_to_julian_day(year, month, day)
        
        # Hijri epoch'tan geçen günler
        days_since_hijri_epoch = jd - self.hijri_epoch_jd
        
        # Yaklaşık Hijri yılı hesapla (354.367 gün/yıl)
        hijri_year = math.floor(days_since_hijri_epoch / 354.367) + 1
        
        # Daha kesin hesaplama için iterasyon
        while True:
            year_start_jd = self.hijri_to_julian_day(hijri_year, 1, 1)
            if year_start_jd <= jd:
                next_year_start_jd = self.hijri_to_julian_day(hijri_year + 1, 1, 1)
                if jd < next_year_start_jd:
                    break
                hijri_year += 1
            else:
                hijri_year -= 1
        
        # Ayı bul
        hijri_month = 1
        while hijri_month <= 12:
            month_start_jd = self.hijri_to_julian_day(hijri_year, hijri_month, 1)
            if hijri_month == 12:
                next_month_start_jd = self.hijri_to_julian_day(hijri_year + 1, 1, 1)
            else:
                next_month_start_jd = self.hijri_to_julian_day(hijri_year, hijri_month + 1, 1)
            
            if month_start_jd <= jd < next_month_start_jd:
                break
            hijri_month += 1
        
        # Günü hesapla
        month_start_jd = self.hijri_to_julian_day(hijri_year, hijri_month, 1)
        hijri_day = int(jd - month_start_jd) + 1
        
        return hijri_day, hijri_month, hijri_year
    
    def hijri_to_julian_day(self, hijri_year, hijri_month, hijri_day):
        """Hijri tarihi Julian Day Number'a çevirir"""
        # Yıl başından geçen toplam günler
        total_days = 0
        
        # Önceki yılların toplam günleri
        for y in range(1, hijri_year):
            total_days += 354 + (1 if self.is_hijri_leap_year(y) else 0)
        
        # Bu yıl içindeki ayların günleri
        for m in range(1, hijri_month):
            total_days += self.get_hijri_month_length(hijri_year, m)
        
        # Günleri ekle
        total_days += hijri_day - 1
        
        return self.hijri_epoch_jd + total_days
    
    def hijri_to_gregorian(self, hijri_day, hijri_month, hijri_year):
        """Hijri tarihi Gregorian tarihe çevirir"""
        jd = self.hijri_to_julian_day(hijri_year, hijri_month, hijri_day)
        return self.julian_day_to_gregorian(jd)
    
    def is_hijri_leap_year(self, hijri_year):
        """Hijri artık yıl kontrolü (30 yıllık döngü)"""
        # 30 yıllık döngüde 11 artık yıl var
        leap_years_in_cycle = [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29]
        cycle_year = ((hijri_year - 1) % 30) + 1
        return cycle_year in leap_years_in_cycle
    
    def get_hijri_month_length(self, hijri_year, hijri_month):
        """Belirli bir Hijri ay ve yıl için ay uzunluğunu döndürür"""
        if hijri_month < 1 or hijri_month > 12:
            return 0
        
        length = self.month_lengths[hijri_month - 1]
        
        # Zilhicce ayında artık yıl kontrolü
        if hijri_month == 12 and self.is_hijri_leap_year(hijri_year):
            length = 30
        
        return length
    
    def format_hijri_date(self, day, month, year):
        """Hijri tarihi güzel formatta döndürür"""
        if 1 <= month <= 12:
            month_name = self.hijri_months[month - 1]
            return f"{day} {month_name} {year} H"
        return f"{day}/{month}/{year} H"
    
    def format_gregorian_date(self, year, month, day):
        """Gregorian tarihi güzel formatta döndürür"""
        try:
            date_obj = datetime.date(year, month, day)
            return f"{day:02d}/{month:02d}/{year} ({date_obj.strftime('%d %B %Y')})"
        except:
            return f"{day:02d}/{month:02d}/{year}"


def parse_date(date_str):
    """Tarih string'ini parse eder (GG/AA/YYYY formatında)"""
    try:
        parts = date_str.split('/')
        if len(parts) != 3:
            return None, None, None
        
        day = int(parts[0])
        month = int(parts[1])
        year = int(parts[2])
        
        return day, month, year
    except:
        return None, None, None


def main():
    parser = argparse.ArgumentParser(
        description="Hijri - Miladi Takvim Dönüştürücü",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Örnekler:
  python habibiur.py --miladi-to-hijri 26/10/2025
  python habibiur.py --hijri-to-miladi 4/5/1447  
  python habibiur.py -mh 19/07/2023
  python habibiur.py -hm 1/1/1445
  python habibiur.py --bugun
        """
    )
    
    parser.add_argument(
        '--miladi-to-hijri', '-mh',
        metavar='GG/AA/YYYY',
        help='Miladi tarihi Hijri tarihe çevir (GG/AA/YYYY formatında)'
    )
    
    parser.add_argument(
        '--hijri-to-miladi', '-hm',
        metavar='GG/AA/YYYY',
        help='Hijri tarihi Miladi tarihe çevir (GG/AA/YYYY formatında)'
    )
    
    parser.add_argument(
        '--bugun', '-b',
        action='store_true',
        help='Bugünün tarihini hem Miladi hem Hijri olarak göster'
    )
    
    args = parser.parse_args()
    
    if not args.miladi_to_hijri and not args.hijri_to_miladi and not args.bugun:
        parser.print_help()
        return
    
    calendar = HijriCalendar()
    
    if args.bugun:
        today = datetime.date.today()
        hijri_day, hijri_month, hijri_year = calendar.gregorian_to_hijri(today.year, today.month, today.day)
        
        print("Bugünün tarihi:")
        print(f"Miladi: {calendar.format_gregorian_date(today.year, today.month, today.day)}")
        print(f"Hijri:  {calendar.format_hijri_date(hijri_day, hijri_month, hijri_year)}")
        return
    
    if args.miladi_to_hijri:
        day, month, year = parse_date(args.miladi_to_hijri)
        if day is None:
            print("Hata: Geçersiz tarih formatı. GG/AA/YYYY formatında girmelisiniz.")
            sys.exit(1)
        
        try:
            gregorian_date = datetime.date(year, month, day)
        except ValueError:
            print("Hata: Geçersiz tarih.")
            sys.exit(1)
        
        hijri_day, hijri_month, hijri_year = calendar.gregorian_to_hijri(year, month, day)
        
        print(f"Miladi: {calendar.format_gregorian_date(year, month, day)}")
        print(f"Hijri:  {calendar.format_hijri_date(hijri_day, hijri_month, hijri_year)}")
    
    if args.hijri_to_miladi:
        day, month, year = parse_date(args.hijri_to_miladi)
        if day is None:
            print("Hata: Geçersiz tarih formatı. GG/AA/YYYY formatında girmelisiniz.")
            sys.exit(1)
        
        greg_year, greg_month, greg_day = calendar.hijri_to_gregorian(day, month, year)
        if greg_year is None:
            print("Hata: Tarih dönüştürülemiyor.")
            sys.exit(1)
        
        print(f"Hijri:  {calendar.format_hijri_date(day, month, year)}")
        print(f"Miladi: {calendar.format_gregorian_date(greg_year, greg_month, greg_day)}")


if __name__ == "__main__":
    main()