#!/bin/bash

# Script per salvare la configurazione ISO di gphoto2 in formato JSON

OUTPUT_FILE="${1:-iso_config.json}"

RAW_OUTPUT=$(gphoto2 --get-config /main/imgsettings/iso 2>/dev/null)

# Parsing dell'output e conversione in JSON
echo "$RAW_OUTPUT" | awk '
BEGIN {
    print "["
    first_choice = 1
}

# Parse delle righe Choice
/^Choice:/ {
    # Estrai il numero e la descrizione
    match($0, /^Choice: ([0-9]+) (.+)$/, arr)
    if (arr[1] != "" && arr[2] != "") {
        if (!first_choice) print ","
        
        # Formatta il label
        label = arr[2]
        if (label != "Auto" && label ~ /^[0-9]+$/) {
            label = "ISO " label
        }
        
        printf "  {\"value\": \"%s\", \"label\": \"%s\"}", arr[1], label
        first_choice = 0
    }
}

END {
    if (!first_choice) print ""
    print "]"
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
