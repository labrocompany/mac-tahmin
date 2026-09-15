// Maç Tahmin Sistemi JavaScript

let currentCalendarType = 'hijri';
let debounceTimer;
let allTeams = [];

// DOM yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Event listener'ları ekle
    setupEventListeners();
    
    // Takım önerilerini başlat
    setupTeamSuggestions();
    
    // Tüm takımları yükle ve dropdown'ları hazırla
    loadAllTeams();
}

function setupEventListeners() {
    // Takvim toggle butonları
    document.querySelectorAll('.calendar-toggle').forEach(button => {
        button.addEventListener('click', function() {
            switchCalendar(this.dataset.calendar);
        });
    });
    
    // Tahmin butonu
    document.getElementById('predict-btn').addEventListener('click', makePrediction);
    
    // Enter tuşu ile tahmin
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            makePrediction();
        }
    });
}

function setupTeamSuggestions() {
    ['team1', 'team2'].forEach(teamId => {
        const input = document.getElementById(teamId);
        const suggestions = document.getElementById(`${teamId}-suggestions`);
        
        input.addEventListener('input', function() {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                getTeamSuggestions(this.value, suggestions, input);
            }, 300);
        });
        
        input.addEventListener('focus', function() {
            if (this.value.length >= 2) {
                getTeamSuggestions(this.value, suggestions, input);
            }
        });
        
        input.addEventListener('blur', function() {
            // Biraz gecikme ile gizle (tıklama olayını kaçırmamak için)
            setTimeout(() => {
                suggestions.style.display = 'none';
            }, 200);
        });
    });
}

function switchCalendar(calendarType) {
    currentCalendarType = calendarType;
    
    // Toggle butonlarını güncelle
    document.querySelectorAll('.calendar-toggle').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(`${calendarType}-toggle`).classList.add('active');
    
    // Filtreleri değiştir
    if (calendarType === 'hijri') {
        document.getElementById('hijri-filters').style.display = 'block';
        document.getElementById('gregorian-filters').style.display = 'none';
    } else {
        document.getElementById('hijri-filters').style.display = 'none';
        document.getElementById('gregorian-filters').style.display = 'block';
    }
}

async function getTeamSuggestions(query, suggestionsDiv, inputElement) {
    if (query.length < 2) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(`/api/team_suggestions?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.suggestions && data.suggestions.length > 0) {
            suggestionsDiv.innerHTML = '';
            
            data.suggestions.forEach(team => {
                const div = document.createElement('div');
                div.className = 'team-suggestion';
                div.textContent = team;
                div.addEventListener('click', function() {
                    inputElement.value = team;
                    suggestionsDiv.style.display = 'none';
                });
                suggestionsDiv.appendChild(div);
            });
            
            suggestionsDiv.style.display = 'block';
        } else {
            suggestionsDiv.style.display = 'none';
        }
    } catch (error) {
        console.error('Takım önerileri alınamadı:', error);
        suggestionsDiv.style.display = 'none';
    }
}

async function makePrediction() {
    const team1 = document.getElementById('team1').value.trim();
    const team2 = document.getElementById('team2').value.trim();
    
    // Validasyon
    if (!team1 || !team2) {
        showError('Lütfen iki takım da seçin!');
        return;
    }
    
    if (team1 === team2) {
        showError('Aynı takımı iki kez seçemezsiniz!');
        return;
    }
    
    // Filtreleri al
    let dayFilter = null;
    let monthFilter = null;
    
    if (currentCalendarType === 'hijri') {
        dayFilter = document.getElementById('day-filter').value;
        monthFilter = document.getElementById('month-filter').value;
    } else {
        dayFilter = document.getElementById('gregorian-day-filter').value;
        monthFilter = document.getElementById('gregorian-month-filter').value;
    }
    
    // Boş stringleri null'a çevir
    dayFilter = dayFilter === '' ? null : parseInt(dayFilter);
    monthFilter = monthFilter === '' ? null : parseInt(monthFilter);
    
    // Loading göster
    showLoading(true);
    hideResults();
    
    try {
        const requestData = {
            team1: team1,
            team2: team2,
            day: dayFilter,
            month: monthFilter,
            calendar_type: currentCalendarType
        };
        
        const response = await fetch('/api/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayPrediction(data);
        } else {
            showError(data.error || 'Tahmin hesaplanamadı');
        }
        
    } catch (error) {
        console.error('Tahmin hatası:', error);
        showError('Bağlantı hatası oluştu');
    } finally {
        showLoading(false);
    }
}

function displayPrediction(data) {
    const resultsDiv = document.getElementById('results');
    const contentDiv = document.getElementById('prediction-content');
    
    // Ana tahmin
    let confidenceIcon = '';
    let confidenceColor = '';
    
    switch(data.confidence_level) {
        case 'Çok Yüksek':
            confidenceIcon = '🔥';
            confidenceColor = 'success';
            break;
        case 'Yüksek':
            confidenceIcon = '⚡';
            confidenceColor = 'warning';
            break;
        case 'Orta':
            confidenceIcon = '📊';
            confidenceColor = 'info';
            break;
        default:
            confidenceIcon = '❓';
            confidenceColor = 'secondary';
    }
    
    contentDiv.innerHTML = `
        <div class="text-center mb-4">
            <h3 class="display-6 fw-bold mb-3">
                🏆 ${data.prediction}
            </h3>
            <div class="row">
                <div class="col-md-4">
                    <div class="border rounded p-3 mb-3">
                        <h6>Güvenilirlik</h6>
                        <span class="badge bg-${confidenceColor} fs-6">
                            ${confidenceIcon} ${data.confidence_level}
                        </span>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="border rounded p-3 mb-3">
                        <h6>Skor Tahmini</h6>
                        <strong class="fs-5">⚽ ${data.score_prediction}</strong>
                    </div>
                </div>
                <div class="col-md-4">
                    <div class="border rounded p-3 mb-3">
                        <h6>Performans Farkı</h6>
                        <strong class="fs-5">📈 %${data.success_difference.toFixed(1)}</strong>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="analysis-text">
            <h6 class="mb-3"><i class="fas fa-chart-line"></i> Detaylı Analiz:</h6>
            <pre class="text-white fs-6">${data.analysis}</pre>
        </div>
    `;
    
    // Takım istatistikleri
    displayTeamStats('team1', data.team1_stats);
    displayTeamStats('team2', data.team2_stats);
    
    // Sonuçları göster
    resultsDiv.style.display = 'block';
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}

function displayTeamStats(teamKey, stats) {
    if (!stats) return;
    
    const titleElement = document.getElementById(`${teamKey}-stats-title`);
    const statsElement = document.getElementById(`${teamKey}-stats`);
    
    titleElement.textContent = `${stats.team} İstatistikleri`;
    
    const winRate = ((stats.wins / stats.total_matches) * 100).toFixed(1);
    const drawRate = ((stats.draws / stats.total_matches) * 100).toFixed(1);
    const lossRate = ((stats.losses / stats.total_matches) * 100).toFixed(1);
    
    statsElement.innerHTML = `
        <div class="mb-3">
            <strong>📊 Toplam Maç:</strong> ${stats.total_matches}
        </div>
        <div class="mb-2">
            <strong>🏆 Galibiyet:</strong> ${stats.wins} (%${winRate})
        </div>
        <div class="mb-2">
            <strong>🤝 Beraberlik:</strong> ${stats.draws} (%${drawRate})
        </div>
        <div class="mb-2">
            <strong>❌ Mağlubiyet:</strong> ${stats.losses} (%${lossRate})
        </div>
        <div class="mt-3 p-2 bg-light rounded">
            <strong>🎯 Başarı Oranı:</strong> 
            <span class="badge bg-primary fs-6">%${stats.success_rate.toFixed(1)}</span>
        </div>
    `;
}

function showLoading(show) {
    const loading = document.querySelector('.loading');
    const btn = document.getElementById('predict-btn');
    
    if (show) {
        loading.classList.add('show');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Hesaplanıyor...';
    } else {
        loading.classList.remove('show');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-magic"></i> Maç Tahmini Yap';
    }
}

function hideResults() {
    document.getElementById('results').style.display = 'none';
}

function showError(message) {
    // Bootstrap toast ile hata göster
    const toastHtml = `
        <div class="toast align-items-center text-white bg-danger border-0 position-fixed top-0 end-0 m-3" 
             role="alert" style="z-index: 9999;">
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-exclamation-triangle me-2"></i>${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                        data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', toastHtml);
    
    const toastElement = document.querySelector('.toast:last-child');
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
    
    // Toast kaldırıldıktan sonra DOM'dan da kaldır
    toastElement.addEventListener('hidden.bs.toast', function() {
        this.remove();
    });
}

// Yardımcı fonksiyonlar
function formatNumber(num) {
    return new Intl.NumberFormat('tr-TR').format(num);
}

// Tüm takımları API'den yükle
async function loadAllTeams() {
    try {
        const response = await fetch('/api/teams');
        const data = await response.json();
        
        if (data.teams) {
            allTeams = data.teams;
            setupTeamDropdowns();
        }
    } catch (error) {
        console.error('Takımlar yüklenemedi:', error);
        // Hata durumunda dropdown'ları gizle
        document.getElementById('team1-dropdown-menu').innerHTML = 
            '<li><span class="dropdown-item-text text-danger">❌ Yükleme hatası</span></li>';
        document.getElementById('team2-dropdown-menu').innerHTML = 
            '<li><span class="dropdown-item-text text-danger">❌ Yükleme hatası</span></li>';
    }
}

// Takım dropdown menülerini hazırla
function setupTeamDropdowns() {
    setupSingleTeamDropdown('team1');
    setupSingleTeamDropdown('team2');
}

// Tek bir takım dropdown'unu hazırla
function setupSingleTeamDropdown(teamId) {
    const dropdownMenu = document.getElementById(`${teamId}-dropdown-menu`);
    const input = document.getElementById(teamId);
    
    // Dropdown menüyü temizle
    dropdownMenu.innerHTML = '';
    
    // Arama kutusu ekle
    const searchContainer = document.createElement('li');
    searchContainer.innerHTML = `
        <div class="p-2">
            <input type="text" class="form-control form-control-sm" 
                   placeholder="Takım ara..." id="${teamId}-search">
        </div>
    `;
    dropdownMenu.appendChild(searchContainer);
    
    // Ayırıcı ekle
    const divider = document.createElement('li');
    divider.innerHTML = '<hr class="dropdown-divider">';
    dropdownMenu.appendChild(divider);
    
    // Takım listesi container
    const teamsContainer = document.createElement('div');
    teamsContainer.id = `${teamId}-teams-container`;
    
    // Tüm takımları ekle
    renderTeamList(teamsContainer, allTeams, teamId);
    
    const teamsLi = document.createElement('li');
    teamsLi.appendChild(teamsContainer);
    dropdownMenu.appendChild(teamsLi);
    
    // Arama fonksiyonu
    const searchInput = document.getElementById(`${teamId}-search`);
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        const filteredTeams = allTeams.filter(team => 
            team.toLowerCase().includes(query)
        );
        renderTeamList(teamsContainer, filteredTeams, teamId);
    });
    
    // Arama kutusuna tıklandığında dropdown kapanmasını engelle
    searchInput.addEventListener('click', function(e) {
        e.stopPropagation();
    });
}

// Takım listesini render et
function renderTeamList(container, teams, teamId) {
    container.innerHTML = '';
    
    if (teams.length === 0) {
        container.innerHTML = '<div class="px-3 py-2 text-muted">Takım bulunamadı</div>';
        return;
    }
    
    teams.forEach(team => {
        const teamDiv = document.createElement('div');
        teamDiv.className = 'dropdown-item team-dropdown-item';
        teamDiv.style.cursor = 'pointer';
        teamDiv.textContent = team;
        
        teamDiv.addEventListener('click', function() {
            selectTeamFromDropdown(teamId, team);
        });
        
        // Hover efekti
        teamDiv.addEventListener('mouseenter', function() {
            this.classList.add('active');
        });
        
        teamDiv.addEventListener('mouseleave', function() {
            this.classList.remove('active');
        });
        
        container.appendChild(teamDiv);
    });
}

// Dropdown'dan takım seç
function selectTeamFromDropdown(teamId, teamName) {
    const input = document.getElementById(teamId);
    input.value = teamName;
    
    // Dropdown'ı kapat
    const dropdown = bootstrap.Dropdown.getInstance(document.getElementById(`${teamId}-dropdown`));
    if (dropdown) {
        dropdown.hide();
    }
    
    // Suggestions'ı gizle
    document.getElementById(`${teamId}-suggestions`).style.display = 'none';
    
    // Input'u vurgula
    input.focus();
    input.select();
}

function getConfidenceColor(level) {
    const colors = {
        'Çok Yüksek': 'success',
        'Yüksek': 'warning',
        'Orta': 'info',
        'Düşük': 'secondary'
    };
    return colors[level] || 'secondary';
}
