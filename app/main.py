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

# Funzione per verificare se un utente esiste su Chess.com
def check_user_exists(username):
    try:
        response = requests.get(f"https://api.chess.com/pub/player/{username}")
        return response.status_code == 200
    except:
        return False

# Ottenere l'elenco dei mesi disponibili per un utente
def get_available_months(username):
    try:
        response = requests.get(f"https://api.chess.com/pub/player/{username}/games/archives")
        if response.status_code == 200:
            data = response.json()
            return data.get("archives", [])
        return []
    except:
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
    if exists:
        months = get_available_months(username)
        formatted_months = [(url, format_month_name(url)) for url in months]
        return {"exists": True, "months": formatted_months}
    else:
        return {"exists": False, "error": "Utente non trovato su Chess.com"}

@app.post("/api/download-games")
async def download_games(username: str = Form(...), selected_months: str = Form(...)):
    if not check_user_exists(username):
        raise HTTPException(status_code=404, detail="Utente non trovato su Chess.com")
    
    selected_months_list = json.loads(selected_months)
    all_games = []
    
    for month_url in selected_months_list:
        try:
            response = requests.get(month_url)
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
            "user_color": user_color,
            "opponent": opponent,
            "result": result,
            "time_control": time_control,
            "time_class": time_class,
            "variant": variant,
            "pgn": game.get("pgn", ""),
            "url": game.get("url", "")
        }
        processed_games.append(processed_game)
    
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
            "json_path": json_path
        }
        
        return {"success": True, "summary": summary, "data": processed_games[:10]}  # Ritorna solo 10 partite per anteprima
    else:
        return {"success": False, "error": "Nessuna partita trovata per il periodo selezionato"}

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