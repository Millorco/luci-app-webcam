#include <Wire.h>
#include "Adafruit_SHT31.h"

// Crea un'istanza del sensore SHT31
Adafruit_SHT31 sht31 = Adafruit_SHT31();

void setup() {
  Serial.begin(9600);
  while (!Serial) {
    ; // Attendi che la porta seriale sia connessa. Necessario solo per schede native USB.
  }

  Serial.println("Adafruit SHT31/SHT35 Test con 1 cifra decimale!");

  if (! sht31.begin(0x44)) {   // Imposta l'indirizzo I2C del sensore. 0x44 è l'indirizzo predefinito.
     Serial.println("Non e' stato possibile trovare il sensore SHT31/SHT35. Controlla i collegamenti!");
     while (1) delay(1);
  }
  Serial.println("SHT31/SHT35 Trovato!");
}

void loop() {
  float t_celsius = sht31.readTemperature();
  float h_percent = sht31.readHumidity();

  // Calcola la temperatura in Fahrenheit
  float t_fahrenheit = (t_celsius * 9 / 5) + 32;

  if (! isnan(t_celsius)) {  // Controlla se la lettura e' valida
    Serial.print("Temperatura: ");
    Serial.print(t_celsius, 1); // Stampa Celsius con 1 cifra decimale
    Serial.print(" *C  |  ");
    Serial.print(t_fahrenheit, 1); // Stampa Fahrenheit con 1 cifra decimale
    Serial.println(" *F");
  } else {
    Serial.println("Errore di lettura della temperatura!");
  }

  if (! isnan(h_percent)) {  // Controlla se la lettura e' valida
    Serial.print("Umidita': ");
    Serial.print(h_percent, 1); // Stampa Umidita' con 1 cifra decimale
    Serial.println(" %");
  } else {
    Serial.println("Errore di lettura dell'umidita'!");
  }

  Serial.println("--------------------"); // Separatore per chiarezza
  delay(2000); // Leggi ogni 2 secondi
}
