#!/bin/bash
OUTPUT_FILE="${1:-iso_config.json}"

# Ottieni l'output di gphoto2
RAW_OUTPUT=$(gphoto2 --get-config /main/imgsettings/iso 2>/dev/null)

# Parsing dell'output e conversione in JSON
echo "$RAW_OUTPUT" | awk '
BEGIN {
    print "{"
    first = 1
}

# Parse delle righe del tipo "Label: value" o "Current: value"
/^[A-Za-z]+:/ {
    # Estrai il campo e il valore
    field = $1
    gsub(/:/, "", field)  # Rimuovi i due punti
    
    # Il valore è tutto ciò che segue il primo spazio
    value = substr($0, index($0, " ") + 1)
    
    # Gestione speciale per alcuni campi
    if (field == "Choice") {
        # Per le scelte, estrai il numero e la descrizione
        match(value, /^([0-9]+) (.+)$/, arr)
        if (arr[1] != "" && arr[2] != "") {
            if (!choices_started) {
                if (!first) print ","
                print "  \"choices\": ["
                choices_started = 1
                first_choice = 1
            }
            
            if (!first_choice) print ","
            printf "    {\"index\": %s, \"value\": \"%s\"}", arr[1], arr[2]
            first_choice = 0
        }
    } else {
        # Chiudi l'\''array delle scelte se necessario
        if (choices_started && field != "Choice") {
            print ""
            print "  ],"
            choices_started = 0
        }
        
        if (!first) print ","
        
        # Converti il nome del campo in formato JSON
        json_field = tolower(field)
        
        # Gestione dei valori numerici
        if (value ~ /^[0-9]+$/) {
            printf "  \"%s\": %s", json_field, value
        } else {
            printf "  \"%s\": \"%s\"", json_field, value
        }
        first = 0
    }
}

END {
    # Chiudi l'\''array delle scelte se ancora aperto
    if (choices_started) {
        print ""
        print "  ]"
    }
    print ""
    print "}"
}
' > "$OUTPUT_FILE"

if [ $? -eq 0 ]; then
    echo "Configurazione ISO salvata in: $OUTPUT_FILE"
    echo "Contenuto del file JSON:"
    echo "========================"
    cat "$OUTPUT_FILE"
else
    echo "Errore durante la creazione del file JSON" >&2
    exit 1
fi
