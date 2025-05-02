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

app = FastAPI(title="Chess.com Stats Downloader")

# Configurazione dei percorsi per file statici e template
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Definizione degli headers standard per le richieste all'API di Chess.com
CHESS_COM_HEADERS = {
    "User-Agent": "Chess.com Stats Downloader/1.0 (Python/FastAPI; Contact: your-email@example.com)",
    "Accept": "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive"
}

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
    
    month_names = {
        "1": "Gennaio", "2": "Febbraio", "3": "Marzo", "4": "Aprile", 
        "5": "Maggio", "6": "Giugno", "7": "Luglio", "8": "Agosto",
        "9": "Settembre", "10": "Ottobre", "11": "Novembre", "12": "Dicembre"
    }
    
    return f"{month_names.get(month, month)} {year}"

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
        "start": f"{period_info[0]['year']}-{period_info[0]['month']}",
        "end": f"{period_info[-1]['year']}-{period_info[-1]['month']}",
        "months": len(period_info)
    }
    
    for month_url in selected_months_list:
        try:
            response = requests.get(month_url, headers=CHESS_COM_HEADERS, timeout=10)
            if response.status_code == 200:
                month_data = response.json()
                all_games.extend(month_data.get("games", []))
        except Exception as e:
            print(f"Errore nel recupero delle partite per {month_url}: {str(e)}")
    
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
            "period": period
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
    
    for month_url in selected_months_list:
        try:
            response = requests.get(month_url, headers=CHESS_COM_HEADERS, timeout=10)
            if response.status_code == 200:
                month_data = response.json()
                all_games.extend(month_data.get("games", []))
        except Exception as e:
            print(f"Errore nel recupero delle partite per {month_url}: {str(e)}")
    
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
        ]
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