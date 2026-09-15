# Sürekli Çalışan Sistem Kurulumu

## Otomatik Başlatma ve Sürekli Çalışma

Bu sistem artık sürekli çalışacak ve sistem yeniden başlatıldığında otomatik olarak başlayacak şekilde yapılandırılmıştır.

## Kurulum Adımları

### 1. Gunicorn Kurulumu
```bash
source venv/bin/activate
pip install gunicorn==21.2.0
```

### 2. Start Script'i İzinlerini Ayarlama
```bash
chmod +x start.sh
```

### 3. Systemd Service Kurulumu
```bash
# Service dosyasını systemd dizinine kopyala
sudo cp mac-tahmin.service /etc/systemd/system/

# Systemd'yi yenile
sudo systemctl daemon-reload

# Servisi etkinleştir (sistem başlangıcında otomatik başlat)
sudo systemctl enable mac-tahmin.service

# Servisi başlat
sudo systemctl start mac-tahmin.service
```

## Servis Yönetimi

### Servisi Başlatma
```bash
sudo systemctl start mac-tahmin.service
```

### Servisi Durdurma
```bash
sudo systemctl stop mac-tahmin.service
```

### Servisi Yeniden Başlatma
```bash
sudo systemctl restart mac-tahmin.service
```

### Servis Durumunu Kontrol Etme
```bash
sudo systemctl status mac-tahmin.service
```

### Servisi Devre Dışı Bırakma (otomatik başlatmayı kapat)
```bash
sudo systemctl disable mac-tahmin.service
```

## Log İzleme

### Gerçek Zamanlı Log İzleme
```bash
sudo journalctl -u mac-tahmin.service -f
```

### Son 100 Log Satırını Görme
```bash
sudo journalctl -u mac-tahmin.service -n 100
```

### Bugünün Loglarını Görme
```bash
sudo journalctl -u mac-tahmin.service --since today
```

## Özellikler

### Otomatik Yeniden Başlatma
- Uygulama çökerse 10 saniye sonra otomatik olarak yeniden başlar
- Sistem yeniden başlatıldığında otomatik olarak başlar

### Production-Ready Konfigürasyon
- **Gunicorn**: Production-grade WSGI server
- **3 Worker Process**: Paralel istek işleme
- **120 saniye timeout**: Uzun süren işlemler için
- **0.0.0.0:8080**: Tüm network interfacelerinden erişilebilir

### Performans İyileştirmeleri
- Çoklu worker ile eşzamanlı istek işleme
- Otomatik worker yenileme
- Hata durumunda otomatik kurtarma

## Manuel Başlatma (Test için)

Eğer service kullanmadan manuel test etmek isterseniz:

```bash
./start.sh
```

veya

```bash
source venv/bin/activate
gunicorn --workers 3 --bind 0.0.0.0:8080 --timeout 120 app:app
```

## Sorun Giderme

### Port Zaten Kullanımda
```bash
# 8080 portunu kullanan işlemi bul
sudo lsof -i :8080

# İşlemi sonlandır
sudo kill -9 <PID>

# veya servisi yeniden başlat
sudo systemctl restart mac-tahmin.service
```

### Servis Başlamıyor
```bash
# Detaylı hata mesajlarını gör
sudo journalctl -u mac-tahmin.service -n 50 --no-pager

# Service dosyasını kontrol et
sudo systemctl cat mac-tahmin.service

# Konfigürasyonu test et
/home/prime/mac-tahmin/venv/bin/gunicorn --check-config app:app
```

### Virtual Environment Sorunları
```bash
# Virtual environment'ı yeniden oluştur
cd /home/prime/mac-tahmin
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Güvenlik Notları

- Servis `prime` kullanıcısı ile çalışır
- Root yetkisi gerektirmez (port 8080)
- Firewall kurallarını kontrol edin:
  ```bash
  sudo ufw allow 8080/tcp
  ```

## Erişim

Uygulama şu adreste çalışacak:
- **Lokal**: http://localhost:8080
- **Ağ üzerinden**: http://<SUNUCU-IP>:8080

## Güncelleme Sonrası

Kod değişiklikleri yaptığınızda:
```bash
sudo systemctl restart mac-tahmin.service
```

## Sistem Gereksinimleri

- Python 3.7+
- Linux (systemd destekli)
- En az 512MB RAM
- Port 8080 erişilebilir olmalı
