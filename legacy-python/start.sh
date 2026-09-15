#!/bin/bash

# Mac Tahmin Uygulaması Başlatma Scripti
cd /home/prime/mac-tahmin

# Virtual environment'ı etkinleştir
source venv/bin/activate

# Gunicorn ile uygulamayı başlat
exec gunicorn --workers 3 --bind 0.0.0.0:8080 --timeout 120 --access-logfile - --error-logfile - app:app
