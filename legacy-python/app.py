#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from flask import Flask, render_template, request, jsonify
import datetime
from prediction_algorithm import MatchPredictionEngine

app = Flask(__name__)

# Tahmin motorunu başlat
try:
    engine = MatchPredictionEngine('database.csv')
    print(f"✅ Tahmin motoru başlatıldı: {len(engine.data)} maç yüklendi")
    print(f"✅ Toplam takım sayısı: {len(engine.teams)}")
except Exception as e:
    print(f"❌ Hata: {e}")
    engine = None

@app.route('/')
def index():
    """Ana sayfa"""
    return render_template('index.html')

@app.route('/api/teams')
def get_teams():
    """Tüm takımları döndür"""
    if not engine:
        return jsonify({'error': 'Motor başlatılamadı'}), 500
    
    return jsonify({'teams': engine.teams})

@app.route('/api/team_suggestions')
def get_team_suggestions():
    """Takım önerileri"""
    if not engine:
        return jsonify({'error': 'Motor başlatılamadı'}), 500
    
    query = request.args.get('q', '')
    if len(query) < 2:
        return jsonify({'suggestions': []})
    
    suggestions = engine.get_team_suggestions(query)
    return jsonify({'suggestions': suggestions})

@app.route('/api/predict', methods=['POST'])
def predict_match():
    """Maç tahmini API"""
    if not engine:
        return jsonify({'error': 'Motor başlatılamadı'}), 500
    
    try:
        data = request.get_json()
        
        team1 = data.get('team1', '').strip()
        team2 = data.get('team2', '').strip()
        day_filter = data.get('day')
        month_filter = data.get('month')
        calendar_type = data.get('calendar_type', 'hijri')
        
        if not team1 or not team2:
            return jsonify({'error': 'İki takım da seçilmelidir'}), 400
        
        if team1 == team2:
            return jsonify({'error': 'Aynı takım seçilemez'}), 400
        
        # Takım kontrolü
        if team1 not in engine.teams:
            return jsonify({'error': f'{team1} takımı bulunamadı'}), 400
        
        if team2 not in engine.teams:
            return jsonify({'error': f'{team2} takımı bulunamadı'}), 400
        
        # Tahmin yap
        result = engine.predict_match(
            team1, team2, 
            day_filter=day_filter, 
            month_filter=month_filter, 
            calendar_type=calendar_type
        )
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': f'Tahmin hatası: {str(e)}'}), 500

@app.route('/api/convert_calendar', methods=['POST'])
def convert_calendar():
    """Takvim dönüştürme API"""
    if not engine:
        return jsonify({'error': 'Motor başlatılamadı'}), 500
    
    try:
        data = request.get_json()
        
        from_calendar = data.get('from_calendar', 'gregorian')
        
        if from_calendar == 'gregorian':
            date_str = data.get('date')  # YYYY-MM-DD format
            date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
            result = engine.get_calendar_conversion(date_obj, 'gregorian')
        else:
            hijri_date = {
                'year': data.get('year'),
                'month': data.get('month'), 
                'day': data.get('day')
            }
            result = engine.get_calendar_conversion(hijri_date, 'hijri')
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': f'Dönüştürme hatası: {str(e)}'}), 500

@app.route('/api/team_analysis/<team_name>')
def get_team_analysis(team_name):
    """Takım analizi"""
    if not engine:
        return jsonify({'error': 'Motor başlatılamadı'}), 500
    
    try:
        day_filter = request.args.get('day', type=int)
        month_filter = request.args.get('month', type=int)
        
        stats = engine.analyze_team_performance(team_name, day_filter, month_filter)
        
        if not stats:
            return jsonify({'error': 'Takım bulunamadı veya veri yok'}), 404
        
        return jsonify(stats)
        
    except Exception as e:
        return jsonify({'error': f'Analiz hatası: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)
