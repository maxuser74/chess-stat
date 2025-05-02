document.addEventListener('DOMContentLoaded', function() {
    // Elementi DOM
    const usernameForm = document.getElementById('username-form');
    const downloadForm = document.getElementById('download-form');
    const usernameInput = document.getElementById('username');
    const monthSelector = document.getElementById('month-selector');
    const resultSection = document.getElementById('result-section');
    const loadingSpinner = document.getElementById('loading-spinner');
    const selectAllBtn = document.getElementById('select-all-btn');
    const unselectAllBtn = document.getElementById('unselect-all-btn');
    const errorAlert = document.getElementById('error-alert');
    const errorMessage = document.getElementById('error-message');
    const resultSummary = document.getElementById('result-summary');
    const resultTable = document.getElementById('result-table');
    const downloadCSVBtn = document.getElementById('download-csv');
    const downloadJSONBtn = document.getElementById('download-json');
    const playerBadgeContainer = document.getElementById('player-badge-container');
    const playerBadge = document.getElementById('player-badge');
    
    // Variabili per la funzionalità dello slider date
    let allGameData = []; // Contiene tutti i dati delle partite caricate
    let dateRangeStart = 0;
    let dateRangeEnd = 100;
    let gameDates = [];
    let lastHeatmapData = null; // Per memorizzare gli ultimi dati della heatmap
    const dateRangeStartSlider = document.getElementById('date-range-start-slider');
    const dateRangeEndSlider = document.getElementById('date-range-end-slider');
    const dateRangeStartLabel = document.getElementById('date-range-start');
    const dateRangeEndLabel = document.getElementById('date-range-end');
    const resetDateRangeBtn = document.getElementById('reset-date-range');

    // Nasconde elementi all'avvio
    hideElement(downloadForm);
    hideElement(resultSection);
    hideElement(loadingSpinner);
    hideElement(errorAlert);
    hideElement(playerBadgeContainer);

    // Configura gli eventi per la rotazione delle icone nei collapsible di Bootstrap
    setupCollapseIconToggle();

    // Event Listeners
    if (usernameForm) {
        usernameForm.addEventListener('submit', handleUsernameSubmit);
    }
    
    if (downloadForm) {
        downloadForm.addEventListener('submit', handleDownloadSubmit);
    }
    
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', selectAllMonths);
    }
    
    if (unselectAllBtn) {
        unselectAllBtn.addEventListener('click', unselectAllMonths);
    }

    // Funzione per configurare la rotazione delle icone nei collapsible
    function setupCollapseIconToggle() {
        // Gestisce la rotazione dell'icona quando un collapsible cambia stato
        document.querySelectorAll('.collapse').forEach(collapseEl => {
            collapseEl.addEventListener('hide.bs.collapse', function () {
                const trigger = document.querySelector(`[data-bs-target="#${this.id}"]`);
                if (trigger) {
                    const icon = trigger.querySelector('.fa-chevron-down');
                    if (icon) icon.style.transform = 'rotate(-90deg)';
                }
            });
            
            collapseEl.addEventListener('show.bs.collapse', function () {
                const trigger = document.querySelector(`[data-bs-target="#${this.id}"]`);
                if (trigger) {
                    const icon = trigger.querySelector('.fa-chevron-down');
                    if (icon) icon.style.transform = 'rotate(0)';
                }
            });
        });
    }

    // Gestione invio form username
    async function handleUsernameSubmit(e) {
        e.preventDefault();
        const username = usernameInput.value.trim();
        
        if (!username) {
            showError('Inserisci un nome utente valido');
            return;
        }
        
        showElement(loadingSpinner);
        hideElement(errorAlert);
        hideElement(downloadForm);
        hideElement(resultSection);
        hideElement(playerBadgeContainer);
        
        try {
            const response = await fetch(`/api/check-username/${username}`);
            const data = await response.json();
            
            if (data.exists) {
                // Visualizza il badge del giocatore se abbiamo dati del profilo
                if (data.profile) {
                    renderPlayerBadge(data.profile, username);
                    showElement(playerBadgeContainer);
                }
                
                renderMonthSelector(data.months, username);
                hideElement(loadingSpinner);
                showElement(downloadForm);
            } else {
                showError(data.error || 'Utente non trovato');
                hideElement(loadingSpinner);
            }
        } catch (error) {
            console.error('Error:', error);
            showError('Errore di connessione al server');
            hideElement(loadingSpinner);
        }
    }

    // Funzione per renderizzare il badge del giocatore
    function renderPlayerBadge(profile, username) {
        // Prepara i dati per il badge
        const avatarUrl = profile.avatar || 'https://www.chess.com/bundles/web/images/user-image.007dad08.svg'; // Avatar di default di Chess.com
        const title = profile.title || '';
        const name = profile.name || '';
        const country = profile.country ? profile.country.split('/').pop() : '';
        const status = profile.status || '';
        const lastOnline = profile.last_online ? new Date(profile.last_online * 1000).toLocaleDateString() : 'N/A';
        const profileUrl = profile.url || `https://www.chess.com/member/${username}`;
        
        // Prepara le statistiche se disponibili
        let ratingRapid = 'N/A';
        let ratingBlitz = 'N/A';
        let ratingBullet = 'N/A';
        
        if (profile.stats) {
            if (profile.stats.chess_rapid) {
                ratingRapid = profile.stats.chess_rapid.last ? profile.stats.chess_rapid.last.rating : 'N/A';
            }
            if (profile.stats.chess_blitz) {
                ratingBlitz = profile.stats.chess_blitz.last ? profile.stats.chess_blitz.last.rating : 'N/A';
            }
            if (profile.stats.chess_bullet) {
                ratingBullet = profile.stats.chess_bullet.last ? profile.stats.chess_bullet.last.rating : 'N/A';
            }
        }
        
        // Costruisce l'HTML del badge
        playerBadge.innerHTML = `
            <div class="player-badge-avatar">
                <img src="${avatarUrl}" alt="${username}" onerror="this.src='https://www.chess.com/bundles/web/images/user-image.007dad08.svg'">
            </div>
            <div class="player-badge-info">
                <div class="player-badge-header">
                    <div class="player-badge-username">
                        ${title ? `<span class="player-badge-title">${title}</span>` : ''}
                        ${username}
                    </div>
                    
                    <div class="player-badge-stats">
                        <div class="player-badge-stat">
                            <div class="player-badge-stat-icon rapid-icon">
                                <i class="fas fa-hourglass-half text-white"></i>
                            </div>
                            <div>
                                <div class="player-badge-stat-title">Rapid</div>
                                <div class="player-badge-stat-value">${ratingRapid}</div>
                            </div>
                        </div>
                        <div class="player-badge-stat">
                            <div class="player-badge-stat-icon blitz-icon">
                                <i class="fas fa-bolt text-white"></i>
                            </div>
                            <div>
                                <div class="player-badge-stat-title">Blitz</div>
                                <div class="player-badge-stat-value">${ratingBlitz}</div>
                            </div>
                        </div>
                        <div class="player-badge-stat">
                            <div class="player-badge-stat-icon bullet-icon">
                                <i class="fas fa-tachometer-alt text-white"></i>
                            </div>
                            <div>
                                <div class="player-badge-stat-title">Bullet</div>
                                <div class="player-badge-stat-value">${ratingBullet}</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${name ? `<div class="player-badge-name">${name}</div>` : ''}
                
                <div class="player-badge-status">
                    ${country ? `<i class="fas fa-globe me-1"></i> ${country} · ` : ''}
                    <i class="fas fa-circle ${status === 'online' ? 'text-success' : 'text-muted'} me-1"></i> 
                    ${status === 'online' ? 'Online' : `Ultimo accesso: ${lastOnline}`}
                </div>
                
                <div class="player-badge-links">
                    <a href="${profileUrl}" target="_blank" class="player-badge-link">
                        <i class="fas fa-external-link-alt me-1"></i> Profilo Chess.com
                    </a>
                </div>
            </div>
        `;
    }

    // Gestione invio form download
    async function handleDownloadSubmit(e) {
        e.preventDefault();
        
        const username = document.getElementById('hidden-username').value;
        const selectedMonths = getSelectedMonths();
        
        if (selectedMonths.length === 0) {
            showError('Seleziona almeno un mese');
            return;
        }
        
        showElement(loadingSpinner);
        hideElement(errorAlert);
        hideElement(resultSection);
        
        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('selected_months', JSON.stringify(selectedMonths));
            
            const response = await fetch('/api/download-games', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                renderResults(data, username);
                hideElement(loadingSpinner);
                showElement(resultSection);
                
                // Configura i bottoni di download
                if (data.summary.csv_path) {
                    const csvFilename = data.summary.csv_path.split('/').pop();
                    downloadCSVBtn.setAttribute('data-file', csvFilename);
                    downloadCSVBtn.addEventListener('click', handleFileDownload);
                }
                
                if (data.summary.json_path) {
                    const jsonFilename = data.summary.json_path.split('/').pop();
                    downloadJSONBtn.setAttribute('data-file', jsonFilename);
                    downloadJSONBtn.addEventListener('click', handleFileDownload);
                }
            } else {
                showError(data.error || 'Errore nel recupero delle partite');
                hideElement(loadingSpinner);
            }
        } catch (error) {
            console.error('Error:', error);
            showError('Errore di connessione al server');
            hideElement(loadingSpinner);
        }
    }

    // Gestione download file
    async function handleFileDownload(e) {
        const filename = e.target.getAttribute('data-file');
        if (!filename) return;
        
        try {
            const response = await fetch(`/api/download-file/${filename}`);
            const data = await response.json();
            
            // Converti hex a bytes array
            const byteString = atob(
                data.file_content_base64.match(/.{1,2}/g)
                    .map(hex => String.fromCharCode(parseInt(hex, 16)))
                    .join('')
            );
            
            let buffer = new ArrayBuffer(byteString.length);
            let intArray = new Uint8Array(buffer);
            for (let i = 0; i < byteString.length; i++) {
                intArray[i] = byteString.charCodeAt(i);
            }
            
            const blob = new Blob([intArray], { type: data.mime_type });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = data.file_name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading file:', error);
            showError('Errore nel download del file');
        }
    }

    // Rendering del selettore dei mesi
    function renderMonthSelector(months, username) {
        monthSelector.innerHTML = '';
        document.getElementById('hidden-username').value = username;
        
        if (months.length === 0) {
            monthSelector.innerHTML = '<p class="text-muted">Nessun dato disponibile per questo utente</p>';
            return;
        }
        
        // Ordina mesi dal più recente al più vecchio
        months.reverse();
        
        // Ottieni l'anno corrente
        const currentYear = new Date().getFullYear().toString();
        
        // Raggruppa i mesi per anno
        const yearGroups = {};
        const monthNames = {
            "1": "Gennaio", "2": "Febbraio", "3": "Marzo", "4": "Aprile", 
            "5": "Maggio", "6": "Giugno", "7": "Luglio", "8": "Agosto",
            "9": "Settembre", "10": "Ottobre", "11": "Novembre", "12": "Dicembre"
        };
        
        months.forEach((monthData, index) => {
            const [url, label] = monthData;
            
            // Estrai l'anno e il mese dall'URL (formato: .../games/YYYY/MM)
            const parts = url.split('/');
            const year = parts[parts.length - 2];
            const month = parts[parts.length - 1];
            
            if (!yearGroups[year]) {
                yearGroups[year] = [];
            }
            
            // Assicurati che il mese sia sempre una stringa
            const monthStr = month.toString();
            
            // Salva i dati del mese nel gruppo dell'anno corrispondente
            yearGroups[year].push({
                url: url,
                month: monthStr,
                // Usa sempre il nome del mese dalla mappa monthNames, se non esiste usa il numero
                monthName: monthNames[monthStr] || `Mese ${monthStr}`,
                index: index
            });
        });
        
        // Crea la struttura ad albero
        const treeView = document.createElement('ul');
        treeView.className = 'tree-view';
        
        // Ottieni gli anni in ordine decrescente
        const years = Object.keys(yearGroups).sort((a, b) => b - a);
        
        years.forEach(year => {
            const yearNode = document.createElement('li');
            yearNode.className = 'tree-node';
            
            // Determina se questo anno è l'anno corrente
            const isCurrentYear = (year === currentYear);
            
            const yearHeader = document.createElement('div');
            // Se non è l'anno corrente, aggiungi la classe 'collapsed'
            yearHeader.className = `tree-year ${isCurrentYear ? '' : 'collapsed'}`;
            yearHeader.innerHTML = `
                <i class="fas fa-caret-down"></i>
                ${year}
                <span class="year-select-all select-all-btn" data-year="${year}">Seleziona tutti</span>
                <span class="year-select-all unselect-all-btn" data-year="${year}">Deseleziona tutti</span>
            `;
            
            // Aggiungi evento di toggle per espandere/collassare
            yearHeader.addEventListener('click', function(e) {
                // Se il click è avvenuto sui pulsanti "seleziona/deseleziona", non fare nulla
                // perché questi hanno i propri eventi
                if (e.target.classList.contains('year-select-all')) {
                    return;
                }
                
                this.classList.toggle('collapsed');
                const monthsList = this.nextElementSibling;
                monthsList.classList.toggle('collapsed');
            });
            
            yearNode.appendChild(yearHeader);
            
            // Crea la lista dei mesi per questo anno
            const monthsList = document.createElement('ul');
            // Se non è l'anno corrente, collassa la lista dei mesi
            monthsList.className = `tree-months ${isCurrentYear ? '' : 'collapsed'}`;
            
            // Ordina i mesi in modo decrescente (più recenti prima)
            yearGroups[year].sort((a, b) => b.month - a.month);
            
            yearGroups[year].forEach(monthData => {
                const monthItem = document.createElement('li');
                monthItem.className = 'month-item';
                
                const checkboxId = `month-${monthData.index}`;
                
                monthItem.innerHTML = `
                    <input type="checkbox" class="month-checkbox" 
                           id="${checkboxId}" value="${monthData.url}" data-year="${year}">
                    <label for="${checkboxId}">${monthData.monthName}</label>
                `;
                
                monthsList.appendChild(monthItem);
            });
            
            yearNode.appendChild(monthsList);
            treeView.appendChild(yearNode);
        });
        
        monthSelector.appendChild(treeView);
        
        // Seleziona il mese più recente per default (primo nell'elenco)
        if (months.length > 0) {
            const firstCheckbox = monthSelector.querySelector('.month-checkbox');
            if (firstCheckbox) {
                firstCheckbox.checked = true;
            }
        }
        
        // Aggiungi eventi per i pulsanti "seleziona tutti" e "deseleziona tutti" per anno
        monthSelector.querySelectorAll('.select-all-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const year = this.getAttribute('data-year');
                document.querySelectorAll(`.month-checkbox[data-year="${year}"]`).forEach(cb => {
                    cb.checked = true;
                });
            });
        });
        
        monthSelector.querySelectorAll('.unselect-all-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const year = this.getAttribute('data-year');
                document.querySelectorAll(`.month-checkbox[data-year="${year}"]`).forEach(cb => {
                    cb.checked = false;
                });
            });
        });
    }

    // Rendering dei risultati
    function renderResults(data, username) {
        const summary = data.summary;
        const gameData = data.data;
        
        // Salva i dati completi delle partite per usarli con lo slider delle date
        allGameData = gameData;
        
        // Inizializza lo slider dell'intervallo date
        initializeDateRangeSlider(gameData);
        
        // Formattazione del periodo
        const period = summary.period || {};
        const monthNames = {
            "1": "Gennaio", "2": "Febbraio", "3": "Marzo", "4": "Aprile", 
            "5": "Maggio", "6": "Giugno", "7": "Luglio", "8": "Agosto",
            "9": "Settembre", "10": "Ottobre", "11": "Novembre", "12": "Dicembre"
        };
        
        let periodText = '';
        if (period && period.start && period.end) {
            const [startYear, startMonth] = period.start.split('-');
            const [endYear, endMonth] = period.end.split('-');
            
            const startMonthName = monthNames[startMonth] || startMonth;
            const endMonthName = monthNames[endMonth] || endMonth;
            
            if (period.start === period.end) {
                periodText = `${startMonthName} ${startYear}`;
            } else {
                periodText = `${startMonthName} ${startYear} - ${endMonthName} ${endYear}`;
            }
        }
        
        // Informazioni sulla cache
        let cacheInfo = '';
        if (summary.cache_info) {
            const fromCache = summary.cache_info.months_from_cache || 0;
            const fromAPI = summary.cache_info.months_from_api || 0;
            const totalMonths = fromCache + fromAPI;
            
            if (totalMonths > 0) {
                let cacheText = '';
                
                if (fromCache > 0 && fromAPI > 0) {
                    cacheText = `
                        <div class="d-flex align-items-center mt-1">
                            <div class="badge bg-success me-1"><i class="fas fa-hdd"></i> ${fromCache} mesi dalla cache</div>
                            <div class="badge bg-info me-1"><i class="fas fa-cloud-download-alt"></i> ${fromAPI} mesi dall'API</div>
                        </div>
                    `;
                } else if (fromCache > 0) {
                    cacheText = `
                        <div class="d-flex align-items-center mt-1">
                            <div class="badge bg-success me-1"><i class="fas fa-hdd"></i> Tutti i dati caricati dalla cache locale</div>
                        </div>
                    `;
                } else {
                    cacheText = `
                        <div class="d-flex align-items-center mt-1">
                            <div class="badge bg-info me-1"><i class="fas fa-cloud-download-alt"></i> Tutti i dati scaricati dall'API</div>
                        </div>
                    `;
                }
                
                cacheInfo = cacheText;
            }
        }
        
        // Popola il sommario
        resultSummary.innerHTML = `
            <p><strong>Giocatore:</strong> ${username}</p>
            <p>
                <strong>Periodo:</strong> ${periodText}
                ${cacheInfo}
            </p>
            <p><strong>Totale partite:</strong> ${summary.total_games}</p>
            <div class="progress mb-3" style="height: 25px;">
                <div class="progress-bar bg-chess-win" style="width: ${(summary.wins / summary.total_games * 100).toFixed(1)}%" 
                     role="progressbar" aria-valuenow="${summary.wins}" aria-valuemin="0" 
                     aria-valuemax="${summary.total_games}">
                    Vittorie: ${summary.wins} (${(summary.wins / summary.total_games * 100).toFixed(1)}%)
                </div>
                <div class="progress-bar bg-chess-draw" style="width: ${(summary.draws / summary.total_games * 100).toFixed(1)}%" 
                     role="progressbar" aria-valuenow="${summary.draws}" aria-valuemin="0" 
                     aria-valuemax="${summary.total_games}">
                    Patte: ${summary.draws} (${(summary.draws / summary.total_games * 100).toFixed(1)}%)
                </div>
                <div class="progress-bar bg-chess-loss" style="width: ${(summary.losses / summary.total_games * 100).toFixed(1)}%" 
                     role="progressbar" aria-valuenow="${summary.losses}" aria-valuemin="0" 
                     aria-valuemax="${summary.total_games}">
                    Sconfitte: ${summary.losses} (${(summary.losses / summary.total_games * 100).toFixed(1)}%)
                </div>
            </div>
            <div class="row">
                <div class="col-md-6">
                    <p>
                        <span class="mini-board mini-white"></span>
                        <strong>Come Bianco:</strong> ${summary.as_white} partite
                    </p>
                </div>
                <div class="col-md-6">
                    <p>
                        <span class="mini-board mini-black"></span>
                        <strong>Come Nero:</strong> ${summary.as_black} partite
                    </p>
                </div>
            </div>
        `;

        // Crea il grafico dell'andamento Elo con tutti i dati
        createEloChart(gameData);
        
        // Aggiungi event listener ai radio button per aggiornare il grafico quando cambia la selezione
        document.querySelectorAll('input[name="timeControl"]').forEach(radio => {
            radio.addEventListener('change', () => createEloChart(gameData));
        });
        
        // Assicurati che il radio button "rapid" sia selezionato di default
        document.getElementById('rapid').checked = true;
        
        // Riattiva la gestione delle icone nei collapse dopo aver caricato nuovi contenuti
        setupCollapseIconToggle();

        // Carica i dati per la heatmap
        loadHeatmapData(username);
        
        // Popola la tabella delle partite (mostra solo le prime 20 partite per prestazioni migliori)
        const tableBody = resultTable.querySelector('tbody');
        tableBody.innerHTML = '';
        
        // Ottieni il riferimento all'intestazione della tabella
        const tableHead = document.querySelector('#result-table thead tr');
        
        // Determina se mostrare tutte le partite o solo un sottoinsieme
        const MAX_PREVIEW_GAMES = 20;
        const gamesToShow = gameData.slice(0, MAX_PREVIEW_GAMES);
        const totalGames = gameData.length;
        
        // Rimuovi eventuali note informative esistenti
        const existingNotes = document.querySelectorAll('.alert.alert-info.mt-2');
        existingNotes.forEach(note => note.remove());
        
        // Aggiungi una nota se stiamo mostrando solo un sottoinsieme delle partite
        if (totalGames > MAX_PREVIEW_GAMES) {
            const note = document.createElement('div');
            note.className = 'alert alert-info mt-2';
            note.innerHTML = `
                <i class="fas fa-info-circle me-2"></i>
                Mostrando le prime ${MAX_PREVIEW_GAMES} partite di ${totalGames} totali nel periodo selezionato.
                Per vedere tutte le partite, scarica i dati completi utilizzando i pulsanti qui sopra.
            `;
            resultTable.parentNode.insertBefore(note, resultTable);
        }
        
        gamesToShow.forEach(game => {
            const row = document.createElement('tr');
            
            const resultClass = game.result === 'win' 
                ? 'result-win' 
                : (game.result === 'loss' ? 'result-loss' : 'result-draw');
            
            const resultText = game.result === 'win'
                ? 'Vittoria'
                : (game.result === 'loss' ? 'Sconfitta' : 'Patta');
            
            const colorIcon = game.user_color === 'white' 
                ? '<span class="mini-board mini-white"></span>' 
                : '<span class="mini-board mini-black"></span>';
                
            row.innerHTML = `
                <td>${game.date}</td>
                <td>${colorIcon} ${game.user_color === 'white' ? 'Bianco' : 'Nero'}</td>
                <td>${game.opponent}</td>
                <td class="${resultClass}">${resultText}</td>
                <td>${game.time_class}</td>
                <td>
                    <a href="${game.url}" target="_blank" class="btn btn-sm btn-outline-primary">
                        Visualizza
                    </a>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    }

    // Funzione per caricare i dati della heatmap
    async function loadHeatmapData(username) {
        const selectedMonths = getSelectedMonths();
        
        if (selectedMonths.length === 0) {
            showError('Seleziona almeno un mese per visualizzare la heatmap');
            return;
        }
        
        try {
            showElement(loadingSpinner);
            
            const formData = new FormData();
            formData.append('username', username);
            formData.append('selected_months', JSON.stringify(selectedMonths));
            
            const response = await fetch('/api/heatmap-data', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            hideElement(loadingSpinner);
            
            if (data.success) {
                lastHeatmapData = data.heatmap_data; // Memorizza i dati della heatmap
                renderHeatmap(data.heatmap_data);
                
                // Aggiungi listener per i radio button della heatmap
                document.querySelectorAll('input[name="heatmapResult"]').forEach(radio => {
                    radio.addEventListener('change', () => {
                        renderHeatmap(data.heatmap_data, radio.value);
                    });
                });
            } else {
                showError(data.error || 'Errore nel recupero dei dati della heatmap');
            }
        } catch (error) {
            console.error('Error loading heatmap data:', error);
            showError('Errore di connessione al server durante il caricamento della heatmap');
            hideElement(loadingSpinner);
        }
    }
    
    // Funzione per renderizzare la heatmap
    function renderHeatmap(heatmapData, resultType = 'wins') {
        // Controlla se abbiamo già un grafico e lo distrugge per evitare sovrapposizioni
        if (window.heatmapChart instanceof Chart) {
            window.heatmapChart.destroy();
        }
        
        // Prepara i dati in base al tipo di risultato selezionato
        let dataType, colorScale, titleText;
        
        switch (resultType) {
            case 'wins':
                dataType = heatmapData.wins;
                colorScale = 'greens';
                titleText = 'Distribuzione delle Vittorie per Giorno e Ora';
                break;
            case 'losses':
                dataType = heatmapData.losses;
                colorScale = 'reds';
                titleText = 'Distribuzione delle Sconfitte per Giorno e Ora';
                break;
            case 'draws':
                dataType = heatmapData.draws;
                colorScale = 'blues';
                titleText = 'Distribuzione delle Patte per Giorno e Ora';
                break;
            case 'total':
            default:
                dataType = heatmapData.totals;
                colorScale = 'purples';
                titleText = 'Distribuzione Totale delle Partite per Giorno e Ora';
        }
        
        // Formatta le etichette delle ore
        const hourLabels = heatmapData.hours.map(hour => {
            return hour < 10 ? `0${hour}:00` : `${hour}:00`;
        });
        
        // Plugin per aggiungere un testo sopra ogni cella della heatmap
        const dataLabelsPlugin = {
            id: 'dataLabels',
            afterDatasetsDraw(chart) {
                const { ctx } = chart;
                chart.data.datasets.forEach((dataset, datasetIndex) => {
                    const meta = chart.getDatasetMeta(datasetIndex);
                    if (!meta.hidden) {
                        meta.data.forEach((element, index) => {
                            // Posizione per l'etichetta
                            const { x, y } = element.getCenterPoint();
                            
                            // Valore da mostrare
                            const value = dataset.data[index].v;
                            
                            // Non mostra etichette per celle vuote
                            if (value > 0) {
                                ctx.fillStyle = 'white';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';
                                ctx.font = 'bold 12px Arial';
                                ctx.fillText(value, x, y);
                            }
                        });
                    }
                });
            }
        };
        
        // Ottieni il canvas per il grafico
        const ctx = document.getElementById('heatmapChart').getContext('2d');
        
        // Determina i colori in base al tipo selezionato
        let colorScheme;
        switch (resultType) {
            case 'wins':
                colorScheme = [
                    'rgba(40, 167, 69, 0.1)',
                    'rgba(40, 167, 69, 0.3)',
                    'rgba(40, 167, 69, 0.5)',
                    'rgba(40, 167, 69, 0.7)',
                    'rgba(40, 167, 69, 0.9)'
                ];
                break;
            case 'losses':
                colorScheme = [
                    'rgba(220, 53, 69, 0.1)',
                    'rgba(220, 53, 69, 0.3)',
                    'rgba(220, 53, 69, 0.5)',
                    'rgba(220, 53, 69, 0.7)',
                    'rgba(220, 53, 69, 0.9)'
                ];
                break;
            case 'draws':
                colorScheme = [
                    'rgba(52, 152, 219, 0.1)',
                    'rgba(52, 152, 219, 0.3)',
                    'rgba(52, 152, 219, 0.5)',
                    'rgba(52, 152, 219, 0.7)',
                    'rgba(52, 152, 219, 0.9)'
                ];
                break;
            case 'total':
            default:
                colorScheme = [
                    'rgba(111, 66, 193, 0.1)',
                    'rgba(111, 66, 193, 0.3)',
                    'rgba(111, 66, 193, 0.5)',
                    'rgba(111, 66, 193, 0.7)',
                    'rgba(111, 66, 193, 0.9)'
                ];
        }
        
        // Prepara i dati per la heatmap
        const data = [];
        for (let dayIndex = 0; dayIndex < heatmapData.days.length; dayIndex++) {
            for (let hourIndex = 0; hourIndex < hourLabels.length; hourIndex++) {
                data.push({
                    x: hourLabels[hourIndex],
                    y: heatmapData.days[dayIndex],
                    v: dataType[dayIndex][hourIndex]
                });
            }
        }
        
        // Trova il valore massimo per la scala dei colori
        const maxValue = Math.max(...dataType.flat());
        
        // Crea il grafico della heatmap
        window.heatmapChart = new Chart(ctx, {
            type: 'matrix',
            plugins: [dataLabelsPlugin],
            data: {
                datasets: [{
                    label: 'Numero di partite',
                    data: data,
                    backgroundColor(context) {
                        const value = context.dataset.data[context.dataIndex].v;
                        if (value === 0) return 'rgba(0, 0, 0, 0.05)'; // Celle vuote trasparenti
                        
                        // Calcola l'indice colore basato sul valore
                        const colorIndex = Math.min(
                            Math.floor((value / maxValue) * colorScheme.length),
                            colorScheme.length - 1
                        );
                        return colorScheme[colorIndex];
                    },
                    borderColor: 'rgba(20, 20, 20, 0.1)',
                    borderWidth: 1,
                    width: ({ chart }) => (chart.chartArea || {}).width / 24 - 1,
                    height: ({ chart }) => (chart.chartArea || {}).height / 7 - 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            title() {
                                return '';
                            },
                            label(context) {
                                const v = context.dataset.data[context.dataIndex];
                                return [
                                    `Giorno: ${v.y}`,
                                    `Ora: ${v.x}`,
                                    `Partite: ${v.v}`
                                ];
                            }
                        }
                    },
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: titleText,
                        color: '#e0e0e0',
                        font: {
                            size: 16
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'category',
                        labels: hourLabels,
                        offset: true,
                        ticks: {
                            color: '#e0e0e0'
                        },
                        grid: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: 'Ora del Giorno',
                            color: '#e0e0e0'
                        }
                    },
                    y: {
                        type: 'category',
                        labels: heatmapData.days,
                        offset: true,
                        ticks: {
                            color: '#e0e0e0'
                        },
                        grid: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: 'Giorno della Settimana',
                            color: '#e0e0e0'
                        }
                    }
                }
            }
        });
    }

    // Funzione per creare il grafico dell'andamento Elo
    function createEloChart(gameData) {
        // Controlla se abbiamo già un grafico e lo distrugge per evitare sovrapposizioni
        if (window.eloChart instanceof Chart) {
            window.eloChart.destroy();
        }

        // Ottieni il canvas per il grafico
        const ctx = document.getElementById('eloChart').getContext('2d');

        // Ottieni la categoria di tempo selezionata
        const selectedTimeControl = document.querySelector('input[name="timeControl"]:checked').value;
        
        // Filtra le partite in base alla categoria di tempo selezionata
        let filteredGames = gameData;
        if (selectedTimeControl !== 'all') {
            filteredGames = gameData.filter(game => game.time_class === selectedTimeControl);
            
            // Se non ci sono partite per la categoria selezionata, mostra un messaggio
            if (filteredGames.length === 0) {
                // Crea un grafico vuoto con un messaggio
                window.eloChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Nessun dato'],
                        datasets: []
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: `Nessuna partita trovata con tempo di gioco "${selectedTimeControl}" nel periodo selezionato`,
                                color: '#e0e0e0',
                                font: {
                                    size: 16
                                }
                            }
                        }
                    }
                });
                
                // Rimuovi eventuali statistiche di min/max precedenti
                const statsContainer = document.querySelector('.elo-stats-container');
                if (statsContainer) {
                    statsContainer.innerHTML = '';
                }
                
                return;
            }
        }

        // Le partite arrivano ordinate per data decrescente (dal più recente al meno recente)
        // Per il grafico abbiamo bisogno di ordinarle cronologicamente per data crescente
        const sortedGames = [...filteredGames].sort((a, b) => {
            return new Date(a.date) - new Date(b.date);
        });

        // Calcola il punteggio minimo e massimo nel periodo
        const ratings = sortedGames.map(game => game.user_rating);
        const maxRating = Math.max(...ratings);
        const minRating = Math.min(...ratings);
        
        // Trova le date e i dettagli delle partite con punteggio massimo e minimo
        const maxRatingGame = sortedGames.find(game => game.user_rating === maxRating);
        const minRatingGame = sortedGames.find(game => game.user_rating === minRating);
        
        // Formatta le date
        const maxRatingDate = new Date(maxRatingGame.date).toLocaleDateString();
        const minRatingDate = new Date(minRatingGame.date).toLocaleDateString();
        
        // Aggiorna o crea il container per le statistiche di min/max
        let statsContainer = document.querySelector('.elo-stats-container');
        if (!statsContainer) {
            statsContainer = document.createElement('div');
            statsContainer.className = 'elo-stats-container mb-3';
            const chartContainer = document.querySelector('.elo-chart-container');
            chartContainer.parentNode.insertBefore(statsContainer, chartContainer);
        }
        
        // Determina le classi CSS in base al tipo di tempo
        let maxClass = 'text-success';
        let minClass = 'text-danger';
        let timeControlName = 'Rapid';
        
        if (selectedTimeControl === 'blitz') {
            maxClass = 'text-warning';
            timeControlName = 'Blitz';
        } else if (selectedTimeControl === 'bullet') {
            maxClass = 'text-danger';
            timeControlName = 'Bullet';
            minClass = 'text-secondary';
        } else if (selectedTimeControl === 'all') {
            maxClass = 'text-info';
            timeControlName = 'tutti i tempi';
        }
        
        // Crea il contenuto HTML
        statsContainer.innerHTML = `
        <div class="card bg-chess-dark mb-2">
            <div class="card-body p-2">
                <div class="row">
                    <div class="col-md-6">
                        <h6 class="mb-1">Punteggio massimo (${timeControlName})</h6>
                        <div class="d-flex align-items-center">
                            <span class="h3 mb-0 ${maxClass}">${maxRating}</span>
                            <span class="ms-2 small text-muted">
                                ${maxRatingDate} - vs ${maxRatingGame.opponent}
                                <span class="badge ${maxRatingGame.result === 'win' ? 'bg-chess-win' : maxRatingGame.result === 'loss' ? 'bg-chess-loss' : 'bg-chess-draw'} ms-1">
                                    ${maxRatingGame.result === 'win' ? 'Vittoria' : maxRatingGame.result === 'loss' ? 'Sconfitta' : 'Patta'}
                                </span>
                            </span>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <h6 class="mb-1">Punteggio minimo (${timeControlName})</h6>
                        <div class="d-flex align-items-center">
                            <span class="h3 mb-0 ${minClass}">${minRating}</span>
                            <span class="ms-2 small text-muted">
                                ${minRatingDate} - vs ${minRatingGame.opponent}
                                <span class="badge ${minRatingGame.result === 'win' ? 'bg-chess-win' : minRatingGame.result === 'loss' ? 'bg-chess-loss' : 'bg-chess-draw'} ms-1">
                                    ${minRatingGame.result === 'win' ? 'Vittoria' : minRatingGame.result === 'loss' ? 'Sconfitta' : 'Patta'}
                                </span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;

        // Estrai i dati per il grafico
        const labels = sortedGames.map(game => {
            // Formatta la data in formato più corto per il grafico
            const date = new Date(game.date);
            return date.toLocaleDateString();
        });

        const ratingValues = sortedGames.map(game => {
            return game.user_rating;
        });

        // Usa colori diversi per i punti in base al risultato della partita
        const pointBackgroundColors = sortedGames.map(game => {
            if (game.result === 'win') return '#75b175'; // Verde per le vittorie
            if (game.result === 'loss') return '#c33'; // Rosso per le sconfitte
            return '#3498db'; // Blu per le patte
        });

        // Determina il colore della linea del grafico in base al tempo di gioco
        let borderColor = '#75b175'; // Default verde per rapid
        if (selectedTimeControl === 'blitz') {
            borderColor = '#f89e31'; // Arancione per blitz
        } else if (selectedTimeControl === 'bullet') {
            borderColor = '#c33'; // Rosso per bullet
        } else if (selectedTimeControl === 'all') {
            borderColor = '#3498db'; // Blu per tutti
        }

        // Prepara un titolo per il grafico che indica il tipo di tempo
        let chartTitle = '';
        if (selectedTimeControl !== 'all') {
            chartTitle = `Andamento Elo ${selectedTimeControl.charAt(0).toUpperCase() + selectedTimeControl.slice(1)}`;
        } else {
            chartTitle = 'Andamento Elo (tutti i tempi di gioco)';
        }

        // Crea il grafico con Chart.js
        window.eloChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Punteggio Elo',
                    data: ratingValues,
                    fill: false,
                    borderColor: borderColor,
                    tension: 0.2,
                    pointBackgroundColor: pointBackgroundColors,
                    pointRadius: 5,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: chartTitle,
                        color: '#e0e0e0',
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        labels: {
                            color: '#e0e0e0'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel: function(context) {
                                const game = sortedGames[context.dataIndex];
                                const result = game.result === 'win' ? 'Vittoria' : 
                                              (game.result === 'loss' ? 'Sconfitta' : 'Patta');
                                const color = game.user_color === 'white' ? 'Bianco' : 'Nero';
                                return [
                                    `Avversario: ${game.opponent}`,
                                    `Risultato: ${result}`,
                                    `Colore: ${color}`,
                                    `Tempo: ${game.time_class}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#e0e0e0'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#e0e0e0',
                            maxRotation: 45,
                            minRotation: 45
                        }
                    }
                }
            }
        });
    }

    // Funzioni helper
    function showElement(element) {
        if (element) element.classList.remove('d-none');
    }
    
    function hideElement(element) {
        if (element) element.classList.add('d-none');
    }
    
    // Flag per tenere traccia dell'ultimo errore mostrato per evitare duplicazioni
    let lastErrorShownTimestamp = 0;
    let lastErrorMessage = '';
    
    function showError(message) {
        // Evita di mostrare lo stesso errore ripetutamente in un breve periodo di tempo
        const now = Date.now();
        if (message === lastErrorMessage && now - lastErrorShownTimestamp < 5000) {
            return; // Ignora errori duplicati entro 5 secondi
        }
        
        // Aggiorna i dati dell'ultimo errore
        lastErrorMessage = message;
        lastErrorShownTimestamp = now;
        
        errorMessage.textContent = message;
        showElement(errorAlert);
        
        // Nascondi automaticamente l'errore dopo 5 secondi
        setTimeout(() => {
            hideElement(errorAlert);
        }, 5000);
    }
    
    function getSelectedMonths() {
        const checkboxes = document.querySelectorAll('.month-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }
    
    function selectAllMonths() {
        document.querySelectorAll('.month-checkbox').forEach(cb => {
            cb.checked = true;
        });
    }
    
    function unselectAllMonths() {
        document.querySelectorAll('.month-checkbox').forEach(cb => {
            cb.checked = false;
        });
    }

    // Funzione per inizializzare lo slider dell'intervallo date
    function initializeDateRangeSlider(gameData) {
        // Estrai le date delle partite
        gameDates = gameData.map(game => new Date(game.date));
        
        // Ordina le date in ordine crescente
        gameDates.sort((a, b) => a - b);
        
        // Imposta i valori iniziali dello slider
        dateRangeStart = 0;
        dateRangeEnd = gameDates.length - 1;
        
        // Aggiorna le etichette delle date
        updateDateRangeLabels();
        
        // Configura gli eventi per lo slider
        dateRangeStartSlider.addEventListener('input', handleDateRangeChange);
        dateRangeEndSlider.addEventListener('input', handleDateRangeChange);
        resetDateRangeBtn.addEventListener('click', resetDateRange);
        
        // Imposta i valori massimi per gli slider
        dateRangeStartSlider.max = gameDates.length - 1;
        dateRangeEndSlider.max = gameDates.length - 1;
        
        // Imposta i valori iniziali per gli slider
        dateRangeStartSlider.value = dateRangeStart;
        dateRangeEndSlider.value = dateRangeEnd;
    }

    // Funzione per gestire il cambiamento dell'intervallo date
    function handleDateRangeChange() {
        // Ottieni i valori degli slider
        const startValue = parseInt(dateRangeStartSlider.value, 10);
        const endValue = parseInt(dateRangeEndSlider.value, 10);
        
        // Assicurati che l'intervallo sia valido
        if (startValue <= endValue) {
            dateRangeStart = startValue;
            dateRangeEnd = endValue;
            
            // Aggiorna le etichette delle date
            updateDateRangeLabels();
            
            // Filtra i dati delle partite in base all'intervallo selezionato
            const filteredGameData = allGameData.slice(dateRangeStart, dateRangeEnd + 1);
            
            // Aggiorna i grafici con i dati filtrati
            createEloChart(filteredGameData);
            if (lastHeatmapData) {
                renderHeatmap(lastHeatmapData);
            }
        }
    }

    // Funzione per aggiornare le etichette delle date
    function updateDateRangeLabels() {
        const startDate = gameDates[dateRangeStart];
        const endDate = gameDates[dateRangeEnd];
        
        dateRangeStartLabel.textContent = startDate.toLocaleDateString();
        dateRangeEndLabel.textContent = endDate.toLocaleDateString();
    }

    // Funzione per resettare l'intervallo date
    function resetDateRange() {
        dateRangeStart = 0;
        dateRangeEnd = gameDates.length - 1;
        
        dateRangeStartSlider.value = dateRangeStart;
        dateRangeEndSlider.value = dateRangeEnd;
        
        updateDateRangeLabels();
        
        // Aggiorna i grafici con tutti i dati
        createEloChart(allGameData);
        if (lastHeatmapData) {
            renderHeatmap(lastHeatmapData);
        }
    }
});