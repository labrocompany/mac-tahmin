#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from prediction_algorithm import MatchPredictionEngine
import datetime

def demo_predictions():
    """Demo tahminleri gösterir"""
    
    print("🚀 Hijri Takvim Maç Tahmin Sistemi DEMO")
    print("=" * 50)
    
    try:
        # Motoru başlat
        engine = MatchPredictionEngine('düzeltilmiş_hijri.csv')
        print(f"📊 Yüklenen veri: {len(engine.data):,} maç")
        print(f"👥 Toplam takım: {len(engine.teams)} takım")
        print()
        
        # Demo tahminleri
        demos = [
            {
                'title': '🔥 BÜYÜK DERBİ - Her Ayın 4\'ü',
                'team1': 'Galatasaray',
                'team2': 'Fenerbahce',
                'day': 4,
                'month': None
            },
            {
                'title': '⚡ KARADENİZ DERBİSİ - Cemaziyelevvel',
                'team1': 'Trabzonspor',
                'team2': 'Rizespor',
                'day': None,
                'month': 5
            },
            {
                'title': '🏆 İSTANBUL KLASİĞİ - Ramazan 3\'ü',
                'team1': 'Besiktas',
                'team2': 'Galatasaray',
                'day': 3,
                'month': 9
            },
            {
                'title': '💫 GENEL KARŞILAŞTIRMA',
                'team1': 'Antalyaspor',
                'team2': 'Konyaspor',
                'day': None,
                'month': None
            }
        ]
        
        for i, demo in enumerate(demos, 1):
            print(f"\n{i}. {demo['title']}")
            print("-" * 40)
            
            # Tahmin yap
            result = engine.predict_match(
                demo['team1'], 
                demo['team2'],
                day_filter=demo['day'],
                month_filter=demo['month']
            )
            
            # Sonuçları göster
            print(f"🏆 Tahmin: {result['prediction']}")
            print(f"📈 Güvenilirlik: {result['confidence_level']}")
            print(f"⚽ Skor: {result['score_prediction']}")
            print(f"📊 Performans Farkı: %{result['success_difference']:.1f}")
            
            if result['team1_stats'] and result['team2_stats']:
                t1_stats = result['team1_stats']
                t2_stats = result['team2_stats']
                print(f"📋 {t1_stats['team']}: {t1_stats['total_matches']} maç (%{t1_stats['success_rate']:.1f} başarı)")
                print(f"📋 {t2_stats['team']}: {t2_stats['total_matches']} maç (%{t2_stats['success_rate']:.1f} başarı)")
            
            print()
        
        # Takım önerileri demo
        print("\n🔍 TAKIM ÖNERİLERİ DEMOsu")
        print("-" * 30)
        search_terms = ['Gala', 'Fener', 'Beş', 'Trabz']
        
        for term in search_terms:
            suggestions = engine.get_team_suggestions(term)
            print(f"'{term}' arama → {suggestions[:3]}")
        
        # Takvim dönüştürme demo
        print("\n📅 TAKVİM DÖNÜŞTÜRİCÜ DEMOsu")
        print("-" * 30)
        
        # Bugünü Hijri'ye çevir
        today = datetime.date.today()
        hijri_today = engine.get_calendar_conversion(today, 'gregorian')
        print(f"Bugün (Miladi): {today.strftime('%d/%m/%Y')}")
        print(f"Bugün (Hijri): {hijri_today['formatted']}")
        
        # Özel bir Hijri tarihi Miladi'ye çevir
        hijri_date = {'year': 1447, 'month': 5, 'day': 4}
        gregorian_date = engine.get_calendar_conversion(hijri_date, 'hijri')
        print(f"4 Cemaziyelevvel 1447 H → {gregorian_date['formatted']}")
        
        print("\n🎯 HIZLI KULLANIM ÖRNEĞİ")
        print("-" * 25)
        print("Web arayüzü: http://localhost:8080")
        print("1. Takımları seç:")
        print("   📝 Manuel: Takım adı yazın (otomatik öneri)")
        print("   📋 Dropdown: Liste ikonuna tıklayın (73 takım)")
        print("2. Filtreyi ayarla: Her ayın 4'ü")
        print("3. Tahmin al: ⚡ 3 saniyede sonuç!")
        
        print("\n✅ DEMO TAMAMLANDI!")
        print("🚀 Şimdi web arayüzünü kullanmaya başlayabilirsiniz!")
        
    except FileNotFoundError:
        print("❌ HATA: düzeltilmiş_hijri.csv dosyası bulunamadı!")
        print("💡 Çözüm: Önce CSV dosyasını oluşturun veya yolunu kontrol edin")
    except Exception as e:
        print(f"❌ HATA: {e}")

if __name__ == "__main__":
    demo_predictions()
