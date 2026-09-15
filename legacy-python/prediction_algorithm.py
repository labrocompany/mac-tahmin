#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import csv
import datetime
from collections import defaultdict
from habibiur import HijriCalendar

class MatchPredictionEngine:
    """Hızlı Maç Tahmin Motoru"""
    
    def __init__(self, csv_file_path):
        self.csv_file = csv_file_path
        self.hijri_calendar = HijriCalendar()
        self.data = self._load_data()
        self.teams = self._get_all_teams()
        
        # Ay isimleri
        self.hijri_months = {
            1: 'Muharrem', 2: 'Safer', 3: 'Rebiülevvel', 4: 'Rebiülahir',
            5: 'Cemaziyelevvel', 6: 'Cemaziyelahir', 7: 'Recep', 8: 'Şaban',
            9: 'Ramazan', 10: 'Şevval', 11: 'Zilkade', 12: 'Zilhicce'
        }
    
    def _load_data(self):
        """CSV verilerini yükler"""
        data = []
        with open(self.csv_file, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                try:
                    # Tarih parse et
                    date_str = row.get('Date', '')
                    hijri_parts = date_str.split('-')

                    if len(hijri_parts) >= 3:
                        home_goals = row.get('HomeGoals', '0')
                        away_goals = row.get('AwayGoals', '0')

                        match_data = {
                            'date': date_str,
                            'hijri_year': int(hijri_parts[0]),
                            'hijri_month': int(hijri_parts[1]),
                            'hijri_day': int(hijri_parts[2]),
                            'home': row.get('HomeTeam', ''),
                            'visitor': row.get('AwayTeam', ''),
                            'score': f"{home_goals}-{away_goals}",
                            'result': row.get('Result', ''),
                            'source': row.get('Source', '')
                        }
                        data.append(match_data)
                except (ValueError, KeyError):
                    continue

        return data
    
    def _get_all_teams(self):
        """Tüm takımları listeler"""
        teams = set()
        for match in self.data:
            teams.add(match['home'])
            teams.add(match['visitor'])
        return sorted(list(teams))
    
    def gregorian_to_hijri_day(self, gregorian_date):
        """Miladi tarihi Hijri güne çevirir"""
        year, month, day = gregorian_date.year, gregorian_date.month, gregorian_date.day
        hijri_day, hijri_month, hijri_year = self.hijri_calendar.gregorian_to_hijri(year, month, day)
        return hijri_day
    
    def analyze_team_performance(self, team_name, day_filter=None, month_filter=None):
        """Takımın performansını analiz eder"""
        matches = []
        
        for match in self.data:
            if team_name in match['home'] or team_name in match['visitor']:
                # Gün filtresi
                if day_filter and match['hijri_day'] != day_filter:
                    continue
                # Ay filtresi  
                if month_filter and match['hijri_month'] != month_filter:
                    continue
                
                is_home = team_name in match['home']
                
                # Sonuç analizi
                if (match['result'] == 'H' and is_home) or (match['result'] == 'A' and not is_home):
                    result = 'W'  # Win
                elif match['result'] == 'D':
                    result = 'D'  # Draw
                else:
                    result = 'L'  # Loss
                
                match_info = {
                    'date': match['date'],
                    'hijri_day': match['hijri_day'],
                    'hijri_month': match['hijri_month'],
                    'hijri_year': match['hijri_year'],
                    'opponent': match['visitor'] if is_home else match['home'],
                    'venue': 'Ev' if is_home else 'Deplasman',
                    'score': match['score'],
                    'result': result
                }
                matches.append(match_info)
        
        # İstatistik hesaplama
        if not matches:
            return None
        
        wins = sum(1 for m in matches if m['result'] == 'W')
        draws = sum(1 for m in matches if m['result'] == 'D')
        losses = sum(1 for m in matches if m['result'] == 'L')
        total = len(matches)
        
        success_rate = ((wins + draws * 0.5) / total) * 100 if total > 0 else 0
        
        return {
            'team': team_name,
            'total_matches': total,
            'wins': wins,
            'draws': draws,
            'losses': losses,
            'success_rate': success_rate,
            'matches': matches
        }
    
    def predict_match(self, team1, team2, day_filter=None, month_filter=None, calendar_type='hijri'):
        """İki takım arasında maç tahmini yapar"""
        
        # Her iki takımın performansını analiz et
        team1_stats = self.analyze_team_performance(team1, day_filter, month_filter)
        team2_stats = self.analyze_team_performance(team2, day_filter, month_filter)
        
        if not team1_stats or not team2_stats:
            return {
                'prediction': 'Yetersiz Veri',
                'confidence': 'Düşük',
                'score_prediction': 'Belirsiz',
                'team1_stats': team1_stats,
                'team2_stats': team2_stats,
                'analysis': 'Yeterli tarihsel veri bulunamadı.'
            }
        
        # Tahmin algoritması
        success_diff = abs(team1_stats['success_rate'] - team2_stats['success_rate'])
        
        # Başarı oranlarına göre tahmin
        if team1_stats['success_rate'] > team2_stats['success_rate']:
            if success_diff >= 25:
                prediction = f'{team1} Güçlü Favori'
                confidence = 'Yüksek'
                score_prediction = '2-0, 3-1'
            elif success_diff >= 15:
                prediction = f'{team1} Favori'
                confidence = 'Orta'
                score_prediction = '1-0, 2-1'
            else:
                prediction = f'{team1} Hafif Avantaj'
                confidence = 'Düşük'
                score_prediction = '1-1, 1-0'
        elif team2_stats['success_rate'] > team1_stats['success_rate']:
            if success_diff >= 25:
                prediction = f'{team2} Güçlü Favori'
                confidence = 'Yüksek'
                score_prediction = '0-2, 1-3'
            elif success_diff >= 15:
                prediction = f'{team2} Favori'
                confidence = 'Orta'
                score_prediction = '0-1, 1-2'
            else:
                prediction = f'{team2} Hafif Avantaj'
                confidence = 'Düşük'
                score_prediction = '1-1, 0-1'
        else:
            prediction = 'Tamamen Eşit'
            confidence = 'Orta'
            score_prediction = '1-1, 0-0'
        
        # Güvenilirlik ayarı (veri miktarına göre)
        total_data = team1_stats['total_matches'] + team2_stats['total_matches']
        if total_data >= 50:
            confidence_multiplier = 'Çok Yüksek'
        elif total_data >= 20:
            confidence_multiplier = 'Yüksek'
        elif total_data >= 10:
            confidence_multiplier = 'Orta'
        else:
            confidence_multiplier = 'Düşük'
        
        # Analiz metni
        filter_text = ""
        if day_filter:
            filter_text += f"Her ayın {day_filter}. günü "
        if month_filter:
            month_name = self.hijri_months.get(month_filter, str(month_filter))
            filter_text += f"{month_name} ayı "
        
        analysis = f"""
        {filter_text}analizi:
        
        {team1}: {team1_stats['total_matches']} maç, %{team1_stats['success_rate']:.1f} başarı
        {team2}: {team2_stats['total_matches']} maç, %{team2_stats['success_rate']:.1f} başarı
        
        Performans Farkı: {success_diff:.1f} puan
        Toplam Veri: {total_data} maç
        """
        
        return {
            'prediction': prediction,
            'confidence': confidence,
            'confidence_level': confidence_multiplier,
            'score_prediction': score_prediction,
            'success_difference': success_diff,
            'team1_stats': team1_stats,
            'team2_stats': team2_stats,
            'analysis': analysis.strip()
        }
    
    def get_team_suggestions(self, partial_name):
        """Takım adına göre öneriler verir"""
        suggestions = []
        partial_lower = partial_name.lower()
        
        for team in self.teams:
            if partial_lower in team.lower():
                suggestions.append(team)
        
        return sorted(suggestions)[:10]  # İlk 10 öneri
    
    def get_calendar_conversion(self, date, from_calendar='gregorian'):
        """Takvim dönüştürme"""
        if from_calendar == 'gregorian':
            # Miladi → Hijri
            hijri_day, hijri_month, hijri_year = self.hijri_calendar.gregorian_to_hijri(
                date.year, date.month, date.day
            )
            return {
                'hijri_day': hijri_day,
                'hijri_month': hijri_month,
                'hijri_year': hijri_year,
                'hijri_month_name': self.hijri_months.get(hijri_month, str(hijri_month)),
                'formatted': f"{hijri_day} {self.hijri_months.get(hijri_month)} {hijri_year} H"
            }
        else:
            # Hijri → Miladi
            year, month, day = self.hijri_calendar.hijri_to_gregorian(
                date['day'], date['month'], date['year']
            )
            greg_date = datetime.date(year, month, day)
            return {
                'gregorian_year': year,
                'gregorian_month': month,
                'gregorian_day': day,
                'formatted': greg_date.strftime('%d/%m/%Y')
            }

# Test fonksiyonu
def main():
    engine = MatchPredictionEngine('database.csv')

    print("🚀 Maç Tahmin Motoru Test")
    print(f"📊 Yüklenen veri: {len(engine.data)} maç")
    print(f"👥 Toplam takım: {len(engine.teams)} takım")
    print()

    # Test tahmini
    result = engine.predict_match('Galatasaray', 'Fenerbahce', day_filter=4)
    print("Test Tahmini - Galatasaray vs Fenerbahçe (Her ayın 4'ü):")
    print(f"Sonuç: {result['prediction']}")
    print(f"Güvenilirlik: {result['confidence']}")
    print(f"Skor Tahmini: {result['score_prediction']}")
    print()

if __name__ == "__main__":
    main()
