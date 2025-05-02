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

    // Nasconde elementi all'avvio
    hideElement(downloadForm);
    hideElement(resultSection);
    hideElement(loadingSpinner);
    hideElement(errorAlert);
    hideElement(playerBadgeContainer);

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
                <div class="player-badge-username">
                    ${title ? `<span class="player-badge-title">${title}</span>` : ''}
                    ${username}
                </div>
                
                ${name ? `<div class="player-badge-name">${name}</div>` : ''}
                
                <div class="player-badge-status">
                    ${country ? `<i class="fas fa-globe me-1"></i> ${country} · ` : ''}
                    <i class="fas fa-circle ${status === 'online' ? 'text-success' : 'text-muted'} me-1"></i> 
                    ${status === 'online' ? 'Online' : `Ultimo accesso: ${lastOnline}`}
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
        
        // Popola il sommario
        resultSummary.innerHTML = `
            <p><strong>Giocatore:</strong> ${username}</p>
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
        
        // Popola la tabella delle partite
        const tableBody = resultTable.querySelector('tbody');
        tableBody.innerHTML = '';
        
        gameData.forEach(game => {
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
                <td>${game.variant}</td>
                <td>
                    <a href="${game.url}" target="_blank" class="btn btn-sm btn-outline-primary">
                        Visualizza
                    </a>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    }

    // Funzioni helper
    function showElement(element) {
        if (element) element.classList.remove('d-none');
    }
    
    function hideElement(element) {
        if (element) element.classList.add('d-none');
    }
    
    function showError(message) {
        errorMessage.textContent = message;
        showElement(errorAlert);
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
});