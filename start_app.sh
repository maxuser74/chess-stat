#!/bin/bash

# Colori per output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PORT=8000

echo -e "${YELLOW}Verifico se ci sono processi attivi sulla porta ${PORT}...${NC}"

# Determina il sistema operativo
OS="$(uname -s)"

# Funzione per identificare i processi sulla porta specificata
get_processes_on_port() {
    case "${OS}" in
        Darwin|Linux) # macOS o Linux
            lsof -i tcp:${PORT} -t
            ;;
        MINGW*|MSYS*|CYGWIN*) # Windows con Git Bash o simili
            netstat -ano | grep ":${PORT}" | awk '{print $5}'
            ;;
        *)
            echo -e "${RED}Sistema operativo non supportato: ${OS}${NC}"
            exit 1
            ;;
    esac
}

# Ottieni i PID dei processi sulla porta
PIDS=$(get_processes_on_port)

if [ -z "$PIDS" ]; then
    echo -e "${GREEN}Nessun processo trovato sulla porta ${PORT}${NC}"
else
    echo -e "${YELLOW}Trovati processi in esecuzione sulla porta ${PORT}${NC}"
    
    # Termina i processi individuati
    for PID in $PIDS; do
        echo -e "${YELLOW}Terminazione del processo ${PID}...${NC}"
        case "${OS}" in
            Darwin|Linux)
                kill -15 ${PID} 2>/dev/null  # SIGTERM per una terminazione pulita
                sleep 0.5
                # Verifica se il processo esiste ancora
                if kill -0 ${PID} 2>/dev/null; then
                    # Se il processo è ancora vivo, forza la terminazione
                    kill -9 ${PID} 2>/dev/null
                fi
                ;;
            MINGW*|MSYS*|CYGWIN*)
                taskkill //F //PID ${PID}
                ;;
        esac
        echo -e "${GREEN}Processo con PID ${PID} terminato.${NC}"
    done
fi

# Attendi un momento per assicurarti che la porta sia libera
sleep 1

echo -e "\n${GREEN}Avvio dell'applicazione sulla porta ${PORT}...${NC}"

# Avvia l'applicazione
uv run -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --reload