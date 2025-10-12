#!/bin/sh

# Dispositivo seriale (modifica se necessario)
SERIAL_DEV="/dev/ttyUSB0"
BAUD=9600

# Invia il comando 't' per richiedere la temperatura e legge la risposta
{
  # Imposta i parametri seriali
  stty -F "$SERIAL_DEV" $BAUD cs8 -cstopb -parenb -ixon -ixoff -crtscts raw

  # Svuota eventuali dati residui
  cat < "$SERIAL_DEV" & CAT_PID=$!
  sleep 0.5
  kill $CAT_PID
  wait $CAT_PID 2>/dev/null

  # Invia il comando per leggere la temperatura
  echo -n "t" > "$SERIAL_DEV"

  # Leggi la risposta (timeout 2 secondi)
  TEMP=$(timeout 2 cat < "$SERIAL_DEV" | tr -d '\r\n' | head -n 1)

  echo "Temperatura SHT31: $TEMP °C"
} || {
  echo "Errore nella comunicazione seriale"
  exit 1
}
