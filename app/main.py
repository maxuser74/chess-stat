from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import pandas as pd
import requests
import json
from datetime import datetime, timedelta
import os
from pathlib import Path
import shutil

app = FastAPI(title="Chess.com Stats Downloader")

# Configurazione dei percorsi per file statici e template
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Directory per lo storage dei dati utenti
DATA_DIR = Path("downloads/users")
DATA_DIR.mkdir(exist_ok=True, parents=True)

# Definizione degli headers standard per le richieste all'API di Chess.com
CHESS_COM_HEADERS = {
    "User-Agent": "Chess.com Stats Downloader/1.0 (Python/FastAPI; Contact: your-email@example.com)",
    "Accept": "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive"
}

# Funzione per ottenere il nome del mese in italiano
def get_month_name(month):
    month_names = {
        "1": "Gennaio", "2": "Febbraio", "3": "Marzo", "4": "Aprile", 
        "5": "Maggio", "6": "Giugno", "7": "Luglio", "8": "Agosto",
        "9": "Settembre", "10": "Ottobre", "11": "Novembre", "12": "Dicembre",
        # Per supportare anche i valori con zero iniziale
        "01": "Gennaio", "02": "Febbraio", "03": "Marzo", "04": "Aprile", 
        "05": "Maggio", "06": "Giugno", "07": "Luglio", "08": "Agosto",
        "09": "Settembre"
    }
    return month_names.get(str(month), str(month))

# Funzione per ottenere la rappresentazione numerica del mese dal nome
def get_month_number(month_name):
    month_numbers = {
        "Gennaio": "01", "Febbraio": "02", "Marzo": "03", "Aprile": "04", 
        "Maggio": "05", "Giugno": "06", "Luglio": "07", "Agosto": "08",
        "Settembre": "09", "Ottobre": "10", "Novembre": "11", "Dicembre": "12"
    }
    return month_numbers.get(month_name, "01")

# Funzione per ottenere il percorso dove salvare i dati di un mese specifico
def get_user_month_path(username, year, month):
    month_str = str(month).zfill(2)
    user_dir = DATA_DIR / username.lower()
    user_dir.mkdir(exist_ok=True, parents=True)
    return user_dir / f"{year}_{month_str}.json"

# Funzione per verificare se un mese specifico esiste già localmente
def month_exists_locally(username, year, month):
    file_path = get_user_month_path(username, year, month)
    return file_path.exists()

# Funzione per salvare i dati di un mese specifico
def save_month_data(username, year, month, data):
    file_path = get_user_month_path(username, year, month)
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f)

# Funzione per caricare i dati di un mese specifico
def load_month_data(username, year, month):
    file_path = get_user_month_path(username, year, month)
    if file_path.exists():
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None

# Funzione per ottenere l'anno e mese correnti
def get_current_year_month():
    now = datetime.now()
    return now.year, now.month

# Funzione per verificare se un mese è il mese corrente
def is_current_month(year, month):
    current_year, current_month = get_current_year_month()
    return int(year) == current_year and int(month) == current_month

# Funzione per recuperare i dettagli del profilo di un giocatore
def get_player_profile(username):
    try:
        response = requests.get(
            f"https://api.chess.com/pub/player/{username}",
            headers=CHESS_COM_HEADERS,
            timeout=10
        )
        
        if response.status_code == 200:
            profile_data = response.json()
            
            # Aggiungiamo altre API di Chess.com per recuperare informazioni aggiuntive
            # Stats
            try:
                stats_response = requests.get(
                    f"https://api.chess.com/pub/player/{username}/stats",
                    headers=CHESS_COM_HEADERS,
                    timeout=10
                )
                if stats_response.status_code == 200:
                    profile_data["stats"] = stats_response.json()
            except Exception as e:
                print(f"Errore nel recupero delle statistiche: {str(e)}")
                profile_data["stats"] = {}
            
            return profile_data
        else:
            print(f"Errore nel recupero del profilo: Status {response.status_code}")
            return None
    except Exception as e:
        print(f"Eccezione durante il recupero del profilo: {str(e)}")
        return None

# Funzione per verificare se un utente esiste su Chess.com
def check_user_exists(username):
    try:
        response = requests.get(
            f"https://api.chess.com/pub/player/{username}", 
            headers=CHESS_COM_HEADERS,
            timeout=10
        )
        print(f"Verifica utente {username}: Status code {response.status_code}")
        
        if response.status_code == 200:
            # Verifichiamo se il profilo è attivo
            try:
                user_data = response.json()
                print(f"Dati utente: {user_data}")
                # Se il profilo è stato trovato, consideriamo l'utente esistente
                return True
            except Exception as e:
                print(f"Errore nella decodifica JSON: {str(e)}")
                return False
        elif response.status_code == 403:
            # In caso di errore 403 (Forbidden), potrebbe essere un problema di rate limiting
            print(f"Accesso negato dall'API di Chess.com (403 Forbidden)")
            # Proviamo un approccio alternativo: verificare se esistono archivi per questo utente
            try:
                archives_response = requests.get(
                    f"https://api.chess.com/pub/player/{username}/games/archives",
                    headers=CHESS_COM_HEADERS,
                    timeout=10
                )
                if archives_response.status_code == 200:
                    print(f"Utente verificato tramite endpoint archives: {username}")
                    return True
                else:
                    print(f"Anche l'endpoint archives ha risposto con errore: {archives_response.status_code}")
                    return False
            except Exception as e:
                print(f"Errore durante il tentativo alternativo: {str(e)}")
                return False
        else:
            print(f"Utente non trovato o errore API. Status code: {response.status_code}")
            return False
    except Exception as e:
        print(f"Eccezione durante la verifica dell'utente: {str(e)}")
        return False

# Ottenere l'elenco dei mesi disponibili per un utente
def get_available_months(username):
    try:
        response = requests.get(
            f"https://api.chess.com/pub/player/{username}/games/archives",
            headers=CHESS_COM_HEADERS,
            timeout=10
        )
        print(f"Ricerca archivi per {username}: Status code {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                archives = data.get("archives", [])
                print(f"Archivi trovati: {len(archives)}")
                return archives
            except Exception as e:
                print(f"Errore nella decodifica JSON degli archivi: {str(e)}")
                return []
        elif response.status_code == 404:
            # L'utente esiste ma non ha partite
            print(f"Nessun archivio trovato per l'utente {username}")
            return []
        else:
            print(f"Errore nel recupero degli archivi: {response.status_code}")
            return []
    except Exception as e:
        print(f"Eccezione durante il recupero degli archivi: {str(e)}")
        return []

# Formattazione dei mesi in un formato più user-friendly
def format_month_name(archive_url):
    # Estrae l'anno e il mese dall'URL, ad es. ".../games/2023/10" -> "Ottobre 2023"
    parts = archive_url.split("/")
    year = parts[-2]
    month = parts[-1]
    
    return f"{get_month_name(month)} {year}"

@app.get("/", response_class=HTMLResponse)
async def get_home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/api/check-username/{username}")
async def check_username(username: str):
    exists = check_user_exists(username)
    if (exists):
        months = get_available_months(username)
        formatted_months = [(url, format_month_name(url)) for url in months]
        
        # Recupera i dati del profilo del giocatore
        profile_data = get_player_profile(username)
        
        return {
            "exists": True, 
            "months": formatted_months, 
            "profile": profile_data
        }
    else:
        # Cerca di ottenere un messaggio di errore più specifico
        try:
            response = requests.get(f"https://api.chess.com/pub/player/{username}", headers=CHESS_COM_HEADERS)
            if response.status_code == 403:
                return {"exists": False, "error": "Accesso limitato dall'API di Chess.com. Potresti aver superato il limite di richieste. Attendi qualche minuto e riprova."}
            elif response.status_code == 404:
                return {"exists": False, "error": "Utente non trovato su Chess.com"}
            else:
                return {"exists": False, "error": f"Errore nel contattare Chess.com (Codice: {response.status_code})"}
        except Exception:
            return {"exists": False, "error": "Utente non trovato o errore di connessione all'API di Chess.com"}

@app.post("/api/download-games")
async def download_games(username: str = Form(...), selected_months: str = Form(...)):
    if not check_user_exists(username):
        raise HTTPException(status_code=404, detail="Utente non trovato su Chess.com")
    
    selected_months_list = json.loads(selected_months)
    all_games = []
    
    # Estrai informazioni dai mesi selezionati per il periodo di tempo
    period_info = []
    for month_url in selected_months_list:
        parts = month_url.split("/")
        year = parts[-2]
        month = parts[-1]
        period_info.append({"year": year, "month": month, "url": month_url})
    
    # Ordina per data per trovare il primo e l'ultimo mese
    period_info.sort(key=lambda x: (int(x["year"]), int(x["month"])))
    
    # Prepara le informazioni sul periodo selezionato
    period = {
        "start": f"{period_info[0]['year']}-{get_month_name(period_info[0]['month'])}",
        "end": f"{period_info[-1]['year']}-{get_month_name(period_info[-1]['month'])}",
        "months": len(period_info)
    }
    
    # Log per monitorare i mesi che verranno scaricati vs quelli dalla cache
    cache_used = 0
    api_requests = 0
    
    current_year, current_month = get_current_year_month()
    
    for month_info in period_info:
        year = month_info["year"]
        month = month_info["month"]
        month_url = month_info["url"]
        
        month_games = None
        
        # Verifica se si tratta del mese corrente (da riscaricari sempre) o se dobbiamo usare i dati salvati
        if is_current_month(year, month) or not month_exists_locally(username, year, month):
            # È il mese corrente o il mese non è disponibile localmente: scarica dall'API
            try:
                api_requests += 1
                response = requests.get(month_url, headers=CHESS_COM_HEADERS, timeout=10)
                if response.status_code == 200:
                    month_data = response.json()
                    month_games = month_data.get("games", [])
                    
                    # Salva i dati per uso futuro
                    save_month_data(username, year, month, month_data)
                    print(f"Scaricato e salvato mese {year}/{month} per {username} dall'API")
                else:
                    print(f"Errore nel recupero delle partite per {month_url}: Status {response.status_code}")
            except Exception as e:
                print(f"Errore nel recupero delle partite per {month_url}: {str(e)}")
        else:
            # Il mese è disponibile localmente: carica dalla cache
            try:
                cache_used += 1
                month_data = load_month_data(username, year, month)
                if month_data:
                    month_games = month_data.get("games", [])
                    print(f"Caricato mese {year}/{month} per {username} dalla cache")
                else:
                    print(f"File cache trovato ma con errori per il mese {year}/{month}")
            except Exception as e:
                print(f"Errore nel caricamento della cache per {year}/{month}: {str(e)}")
        
        # Aggiungi le partite del mese all'elenco completo
        if month_games:
            all_games.extend(month_games)
    
    print(f"Statistiche cache per {username}: {cache_used} mesi dalla cache, {api_requests} mesi dall'API")
    
    # Creazione di un DataFrame con pandas
    processed_games = []
    for game in all_games:
        white_player = game.get("white", {}).get("username", "unknown").lower()
        black_player = game.get("black", {}).get("username", "unknown").lower()
        
        # Determina se il giocatore richiesto era bianco o nero
        is_white = (username.lower() == white_player)
        user_color = "white" if is_white else "black"
        opponent = black_player if is_white else white_player
        
        # Estrae dettagli della partita
        time_control = game.get("time_control", "")
        time_class = game.get("time_class", "")
        variant = game.get("rules", "")
        
        # Estrai i dati Elo
        white_rating = game.get("white", {}).get("rating", 0)
        black_rating = game.get("black", {}).get("rating", 0)
        user_rating = white_rating if is_white else black_rating
        opponent_rating = black_rating if is_white else white_rating
       
        # Determina il risultato dal punto di vista dell'utente
        result = ""
        if game.get("white", {}).get("result", "") == "win":
            result = "win" if is_white else "loss"
        elif game.get("black", {}).get("result", "") == "win":
            result = "win" if not is_white else "loss"
        else:
            result = "draw"
            
        # Converte il timestamp Unix in data e ora
        date_played = datetime.fromtimestamp(game.get("end_time", 0))
        date_str = date_played.strftime("%Y-%m-%d %H:%M:%S")
        
        processed_game = {
            "date": date_str,
            "timestamp": game.get("end_time", 0),  # Aggiungiamo il timestamp raw per ordinare cronologicamente
            "user_color": user_color,
            "opponent": opponent,
            "result": result,
            "time_control": time_control,
            "time_class": time_class,
            "variant": variant,
            "user_rating": user_rating,
            "opponent_rating": opponent_rating,
            "pgn": game.get("pgn", ""),
            "url": game.get("url", "")
        }
        processed_games.append(processed_game)
    
    # Ordina le partite per data decrescente (dal più recente al meno recente)
    processed_games.sort(key=lambda x: x['timestamp'], reverse=True)

    # Crea un DataFrame con pandas
    if processed_games:
        df = pd.DataFrame(processed_games)
        
        # Crea la cartella downloads se non esiste
        downloads_dir = Path("downloads")
        downloads_dir.mkdir(exist_ok=True)
        
        # Salva il DataFrame in formato CSV e JSON
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        csv_path = f"downloads/{username}_games_{timestamp}.csv"
        json_path = f"downloads/{username}_games_{timestamp}.json"
        
        df.to_csv(csv_path, index=False)
        df.to_json(json_path, orient="records")
        
        summary = {
            "total_games": len(df),
            "wins": len(df[df["result"] == "win"]),
            "losses": len(df[df["result"] == "loss"]),
            "draws": len(df[df["result"] == "draw"]),
            "as_white": len(df[df["user_color"] == "white"]),
            "as_black": len(df[df["user_color"] == "black"]),
            "csv_path": csv_path,
            "json_path": json_path,
            "period": period,
            "cache_info": {
                "months_from_cache": cache_used,
                "months_from_api": api_requests
            }
        }
        
        # Invia tutti i dati delle partite al frontend
        return {"success": True, "summary": summary, "data": processed_games}
    else:
        return {"success": False, "error": "Nessuna partita trovata per il periodo selezionato"}

@app.post("/api/heatmap-data")
async def get_heatmap_data(username: str = Form(...), selected_months: str = Form(...)):
    if not check_user_exists(username):
        raise HTTPException(status_code=404, detail="Utente non trovato su Chess.com")
    
    selected_months_list = json.loads(selected_months)
    all_games = []
    
    # Log per monitorare i mesi che verranno scaricati vs quelli dalla cache
    cache_used = 0
    api_requests = 0
    
    current_year, current_month = get_current_year_month()
    
    for month_url in selected_months_list:
        parts = month_url.split("/")
        year = parts[-2]
        month = parts[-1]
        
        month_games = None
        
        # Verifica se si tratta del mese corrente o se dobbiamo usare i dati salvati
        if is_current_month(year, month) or not month_exists_locally(username, year, month):
            # È il mese corrente o il mese non è disponibile localmente: scarica dall'API
            try:
                api_requests += 1
                response = requests.get(month_url, headers=CHESS_COM_HEADERS, timeout=10)
                if response.status_code == 200:
                    month_data = response.json()
                    month_games = month_data.get("games", [])
                    
                    # Salva i dati per uso futuro
                    save_month_data(username, year, month, month_data)
                    print(f"Heatmap: Scaricato e salvato mese {year}/{month} per {username} dall'API")
                else:
                    print(f"Heatmap: Errore nel recupero delle partite per {month_url}: Status {response.status_code}")
            except Exception as e:
                print(f"Heatmap: Errore nel recupero delle partite per {month_url}: {str(e)}")
        else:
            # Il mese è disponibile localmente: carica dalla cache
            try:
                cache_used += 1
                month_data = load_month_data(username, year, month)
                if month_data:
                    month_games = month_data.get("games", [])
                    print(f"Heatmap: Caricato mese {year}/{month} per {username} dalla cache")
                else:
                    print(f"Heatmap: File cache trovato ma con errori per il mese {year}/{month}")
            except Exception as e:
                print(f"Heatmap: Errore nel caricamento della cache per {year}/{month}: {str(e)}")
        
        # Aggiungi le partite del mese all'elenco completo
        if month_games:
            all_games.extend(month_games)
    
    print(f"Heatmap: Statistiche cache per {username}: {cache_used} mesi dalla cache, {api_requests} mesi dall'API")
    
    # Inizializza la struttura per la heatmap
    days_of_week = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"]
    hours = list(range(24))  # 0-23 ore
    
    # Inizializza i conteggi per vittorie, sconfitte e pareggi
    heatmap_wins = {day: {hour: 0 for hour in hours} for day in days_of_week}
    heatmap_losses = {day: {hour: 0 for hour in hours} for day in days_of_week}
    heatmap_draws = {day: {hour: 0 for hour in hours} for day in days_of_week}
    
    # Inizializza il conteggio totale di partite per calcolare le percentuali
    heatmap_totals = {day: {hour: 0 for hour in hours} for day in days_of_week}
    
    # Processa i dati delle partite
    for game in all_games:
        white_player = game.get("white", {}).get("username", "unknown").lower()
        black_player = game.get("black", {}).get("username", "unknown").lower()
        
        # Determina se il giocatore richiesto era bianco o nero
        is_white = (username.lower() == white_player)
        
        # Determina il risultato dal punto di vista dell'utente
        result = ""
        if game.get("white", {}).get("result", "") == "win":
            result = "win" if is_white else "loss"
        elif game.get("black", {}).get("result", "") == "win":
            result = "win" if not is_white else "loss"
        else:
            result = "draw"
            
        # Converte il timestamp Unix in data e ora
        date_played = datetime.fromtimestamp(game.get("end_time", 0))
        day_name = days_of_week[date_played.weekday()]
        hour = date_played.hour
        
        # Aggiorna i contatori appropriati
        if result == "win":
            heatmap_wins[day_name][hour] += 1
        elif result == "loss":
            heatmap_losses[day_name][hour] += 1
        else:  # draw
            heatmap_draws[day_name][hour] += 1
            
        # Aggiorna il contatore totale
        heatmap_totals[day_name][hour] += 1
    
    # Trasforma i dati in un formato adatto per il frontend
    heatmap_data = {
        "days": days_of_week,
        "hours": hours,
        "wins": [
            [heatmap_wins[day][hour] for hour in hours] 
            for day in days_of_week
        ],
        "losses": [
            [heatmap_losses[day][hour] for hour in hours] 
            for day in days_of_week
        ],
        "draws": [
            [heatmap_draws[day][hour] for hour in hours] 
            for day in days_of_week
        ],
        "totals": [
            [heatmap_totals[day][hour] for hour in hours] 
            for day in days_of_week
        ],
        "cache_info": {
            "months_from_cache": cache_used,
            "months_from_api": api_requests
        }
    }
    
    return {"success": True, "heatmap_data": heatmap_data}

@app.get("/api/download-file/{file_path}")
async def download_file(file_path: str):
    full_path = Path(f"downloads/{file_path}")
    
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File non trovato")
    
    file_content = full_path.read_bytes()
    file_name = full_path.name
    
    return JSONResponse(
        content={
            "file_name": file_name,
            "file_content_base64": file_content.hex(),
            "mime_type": "text/csv" if file_name.endswith(".csv") else "application/json"
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)