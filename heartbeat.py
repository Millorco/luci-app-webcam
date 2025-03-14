#
#Invia un segnale tramite la porta seriale ogni tot minuti per resettare umn timer di Arduino, se arduino non riceve il segnale effettua un reset hardware del pc
#
import serial
import time

ser = serial.Serial('/dev/ttyACM0', 9600)  # Porta seriale di Arduino
heartbeat_interval = 600  # 10 minuti in secondi

while True:
    try:
        ser.write(b'H\n')  # Invia il segnale di heartbeat 'H'
        print("Heartbeat inviato.")
        time.sleep(heartbeat_interval)
    except serial.SerialException:
        print("Errore di comunicazione seriale. Riprovo in 10 secondi...")
        time.sleep(10) #attesa per riconnessione
    except Exception as e:
        print(f"Altro errore: {e}")
        break
