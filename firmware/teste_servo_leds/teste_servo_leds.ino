/*
  LockMachine · teste da bancada: LEDs + servo do martelo (sem leitor, sem Wi-Fi)
  ------------------------------------------------------------------------------
  Serve para conferir as ligações antes do sketch principal (lockmachine_esp32.ino):
  repete a sequência da leitora sem precisar de cartão nem de servidor.

    amarelo (esperando) -> verde + martelo desce e sobe ("liberado") -> amarelo -> vermelho ("negado")

  Ligações (as mesmas do sketch principal; os LEDs ficam onde depois entram os relés da torre)
    LED verde    -> GPIO 27   (perna longa no pino, pelo resistor; perna curta no GND)
    LED amarelo  -> GPIO 26
    LED vermelho -> GPIO 25
    Buzzer       -> GPIO 33   (opcional; o + no pino, o − no GND)
    Servo SG90: laranja -> GPIO 13   vermelho -> VIN (5 V)   marrom -> GND

  Arduino IDE: placa "ESP32 Dev Module", biblioteca ESP32Servo. Monitor Serial em 115200.
*/

#include <ESP32Servo.h>

const int PIN_VERDE = 27;
const int PIN_AMARELO = 26;
const int PIN_VERMELHO = 25;
const int PIN_BUZZER = 33;
const int PIN_SERVO = 13;

// Mesmos ângulos do sketch principal. Se o servo zumbir parado num dos lados, aproxime de 90 (ex.: 15 e 165).
const int SERVO_ANGULO_CIMA = 5;
const int SERVO_ANGULO_BAIXO = 175;
const bool BUZZER_LIGADO = true;

Servo martelo;

void luzes(bool verde, bool amarelo, bool vermelho) {
  digitalWrite(PIN_VERDE, verde ? HIGH : LOW);
  digitalWrite(PIN_AMARELO, amarelo ? HIGH : LOW);
  digitalWrite(PIN_VERMELHO, vermelho ? HIGH : LOW);
}

// Onda de ~2,7 kHz: apita tanto o buzzer ativo quanto o passivo (o passivo só estala com o pino parado em HIGH).
void bip(int vezes, int duracaoMs) {
  for (int i = 0; i < vezes; i++) {
    unsigned long fim = millis() + duracaoMs;
    while (BUZZER_LIGADO && millis() < fim) {
      digitalWrite(PIN_BUZZER, HIGH);
      delayMicroseconds(185);
      digitalWrite(PIN_BUZZER, LOW);
      delayMicroseconds(185);
    }
    delay(duracaoMs);
  }
}

// Leva o martelo devagar até o ângulo pedido (passos de 2°), como no sketch principal.
void moverMartelo(int destino) {
  int atual = martelo.read();
  int passo = destino > atual ? 2 : -2;
  while (abs(destino - atual) > 2) {
    atual += passo;
    martelo.write(atual);
    delay(8);
  }
  martelo.write(destino);
}

void setup() {
  pinMode(PIN_VERDE, OUTPUT);
  pinMode(PIN_AMARELO, OUTPUT);
  pinMode(PIN_VERMELHO, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  luzes(false, false, false);
  martelo.setPeriodHertz(50);
  martelo.attach(PIN_SERVO, 500, 2400);
  martelo.write(SERVO_ANGULO_CIMA);

  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("LockMachine · teste de LEDs e servo");
  Serial.println("Acendendo os 3 LEDs juntos por 1 segundo...");
  luzes(true, true, true);
  bip(1, 80);
  delay(1000);
  luzes(false, false, false);
}

void loop() {
  Serial.println("Amarelo: esperando um cartão");
  luzes(false, true, false);
  delay(2000);

  Serial.println("Verde: LIBERADO. O martelo desce e sobe.");
  luzes(true, false, false);
  bip(1, 180);
  moverMartelo(SERVO_ANGULO_BAIXO);
  delay(500);
  moverMartelo(SERVO_ANGULO_CIMA);
  delay(1500);

  Serial.println("Amarelo: esperando um cartão");
  luzes(false, true, false);
  delay(2000);

  Serial.println("Vermelho: NEGADO. O martelo não se mexe.");
  luzes(false, false, true);
  bip(3, 90);
  delay(2000);
}
