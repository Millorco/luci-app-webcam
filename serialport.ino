#include <SoftwareSerial.h>

SoftwareSerial mySerial(6, 7); // RX, TX

void setup() {

  Serial.begin(9600);
  Serial.println("Serial port OK!");

  mySerial.begin(9600);
  mySerial.println("Software port OK!");
}

void loop() { // run over and over
  if (Serial.available()) {
    Serial.write(Serial.read());
  }
  if (mySerial.available()) {
    mySerial.write(mySerial.read());
  }
}
