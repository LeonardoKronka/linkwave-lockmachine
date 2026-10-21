/*
  LockMachine · leitora RFID de bancada (ESP32 + MFRC522)
  -------------------------------------------------------
  Lê o UID do cartão, pede a validação para a API e aciona a saída de bancada
  SOMENTE quando o servidor responde "autorizado". Qualquer falha (Wi-Fi, servidor,
  banco, resposta inválida) mantém a saída desenergizada (seção 4.8 do TCC).

  Protótipo acadêmico: NÃO ligue a saída a uma máquina real. Ela representa
  "liberar" ou "manter bloqueado" na bancada de demonstração.

  Arduino IDE
    Placa ......... ESP32 Dev Module (pacote "esp32" da Espressif)
    Bibliotecas ... MFRC522 (GithubCommunity / miguelbalboa)
                    ArduinoJson 7.x (Benoit Blanchon)

  Ligações (MFRC522 -> ESP32)
    SDA/SS -> GPIO 5      SCK  -> GPIO 18
    MOSI   -> GPIO 23     MISO -> GPIO 19
    RST    -> GPIO 22     3.3V -> 3V3 (NÃO use 5 V)     GND -> GND
  Saídas
    Relé IN      -> GPIO 26   (módulo de bancada)
    LED verde    -> GPIO 25   (com resistor de 220 Ω)
    LED vermelho -> GPIO 33   (com resistor de 220 Ω)
    LED amarelo  -> GPIO 32   (com resistor de 220 Ω)
    Buzzer       -> GPIO 27

  Antes de gravar: no app LockMachine, entre como administrador,
  abra "Leitoras RFID", cadastre esta leitora e copie a URL e o token abaixo.
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

// ================== CONFIGURE AQUI ==================
const char* WIFI_SSID      = "NOME_DA_REDE";
const char* WIFI_SENHA     = "SENHA_DA_REDE";
const char* API_URL        = "https://SEU-DOMINIO/api/acessos/validar.php";
const char* DEVICE_TOKEN   = "lm_COLE_AQUI_O_TOKEN_GERADO_NO_APP";
const char* MAQUINA_CODIGO = "P-01";   // ignorado se a leitora estiver vinculada a uma máquina no app
const bool  RELE_ATIVO_EM_ALTO = true; // mude para false se o seu módulo relé liga com LOW
// ====================================================

const int PIN_SS = 5;
const int PIN_RST = 22;
const int PIN_RELE = 26;
const int PIN_LED_VERDE = 25;
const int PIN_LED_VERMELHO = 33;
const int PIN_LED_AMARELO = 32;
const int PIN_BUZZER = 27;

const unsigned long INTERVALO_MESMO_CARTAO_MS = 3000;  // ignora leitura repetida do mesmo cartão
const unsigned long TEMPO_MAXIMO_HTTP_MS = 6000;
const unsigned long TEMPO_CONEXAO_WIFI_MS = 15000;

MFRC522 rfid(PIN_SS, PIN_RST);
String ultimoUid = "";
unsigned long ultimaLeitura = 0;

void rele(bool energizar) {
  digitalWrite(PIN_RELE, (energizar == RELE_ATIVO_EM_ALTO) ? HIGH : LOW);
}

void leds(bool verde, bool vermelho, bool amarelo) {
  digitalWrite(PIN_LED_VERDE, verde ? HIGH : LOW);
  digitalWrite(PIN_LED_VERMELHO, vermelho ? HIGH : LOW);
  digitalWrite(PIN_LED_AMARELO, amarelo ? HIGH : LOW);
}

void bip(int vezes, int duracaoMs) {
  for (int i = 0; i < vezes; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(duracaoMs);
    digitalWrite(PIN_BUZZER, LOW);
    delay(duracaoMs);
  }
}

// Autoteste básico: o MFRC522 responde pelo SPI?
bool leitorOk() {
  byte versao = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  return versao != 0x00 && versao != 0xFF;
}

bool conectarWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  Serial.printf("Conectando ao Wi-Fi %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_SENHA);
  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < TEMPO_CONEXAO_WIFI_MS) {
    leds(false, false, (millis() / 250) % 2);
    delay(100);
    Serial.print(".");
  }
  leds(false, false, false);
  Serial.println(WiFi.status() == WL_CONNECTED ? " conectado." : " sem conexão.");
  if (WiFi.status() == WL_CONNECTED) Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());
  return WiFi.status() == WL_CONNECTED;
}

String lerUid() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

// Pergunta ao servidor. Retorna true só se o servidor respondeu e autorizou.
bool validar(const String& uid, String& motivo, int& segundos) {
  motivo = "SERVICO_INDISPONIVEL";
  segundos = 0;

  HTTPClient http;
  WiFiClientSecure clienteSeguro;
  WiFiClient clienteSimples;
  bool https = String(API_URL).startsWith("https");
  if (https) {
    // Bancada de demonstração: aceita o certificado sem conferir a cadeia.
    // Para uso real, troque por clienteSeguro.setCACert(...) com o certificado do domínio.
    clienteSeguro.setInsecure();
    http.begin(clienteSeguro, API_URL);
  } else {
    http.begin(clienteSimples, API_URL);
  }
  http.setTimeout(TEMPO_MAXIMO_HTTP_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Token", DEVICE_TOKEN);

  String corpo = String("{\"rfid_uid\":\"") + uid + "\",\"maquina_codigo\":\"" + MAQUINA_CODIGO + "\"}";
  int status = http.POST(corpo);
  if (status != 200) {
    Serial.printf("API respondeu %d: acesso negado por falta de decisão confiável.\n", status);
    http.end();
    return false;
  }
  String resposta = http.getString();
  http.end();

  JsonDocument doc;
  if (deserializeJson(doc, resposta)) {
    Serial.println("Resposta inválida da API: acesso negado.");
    return false;
  }
  bool sucesso = doc["sucesso"] | false;
  bool autorizado = doc["dados"]["autorizado"] | false;
  motivo = String((const char*)(doc["dados"]["motivo_codigo"] | "SERVICO_INDISPONIVEL"));
  segundos = doc["dados"]["liberar_segundos"] | 0;
  Serial.printf("Decisão: %s (%s), acesso #%d\n", autorizado ? "LIBERADO" : "BLOQUEADO", motivo.c_str(), (int)(doc["dados"]["acesso_id"] | 0));
  return sucesso && autorizado;
}

void setup() {
  // Estado seguro antes de qualquer outra coisa: saída desenergizada.
  pinMode(PIN_RELE, OUTPUT);
  rele(false);
  pinMode(PIN_LED_VERDE, OUTPUT);
  pinMode(PIN_LED_VERMELHO, OUTPUT);
  pinMode(PIN_LED_AMARELO, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  leds(false, false, false);

  Serial.begin(115200);
  delay(200);
  Serial.println("\nLockMachine · leitora de bancada");

  SPI.begin();
  rfid.PCD_Init();
  while (!leitorOk()) {
    Serial.println("Autoteste: MFRC522 não respondeu. Confira as ligações.");
    leds(false, true, false);
    bip(1, 300);
    delay(1500);
    rfid.PCD_Init();
  }
  Serial.println("Autoteste: leitor OK.");
  leds(true, true, true);
  bip(1, 80);
  delay(300);
  leds(false, false, false);

  conectarWiFi();
  Serial.println("Pronto. Aproxime um cartão.");
}

void loop() {
  // Sem rede: nega tudo e tenta reconectar (saída continua desenergizada).
  if (WiFi.status() != WL_CONNECTED) {
    rele(false);
    leds(false, (millis() / 500) % 2, false);
    if (!conectarWiFi()) {
      delay(2000);
      return;
    }
  }

  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    delay(40);
    return;
  }
  String uid = lerUid();
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  if (uid == ultimoUid && millis() - ultimaLeitura < INTERVALO_MESMO_CARTAO_MS) return;
  ultimoUid = uid;
  ultimaLeitura = millis();

  Serial.printf("Cartão lido: %s\n", uid.c_str());
  leds(false, false, true);
  bip(1, 50);

  String motivo;
  int segundos;
  if (validar(uid, motivo, segundos)) {
    leds(true, false, false);
    bip(1, 180);
    rele(true);
    delay((segundos > 0 ? segundos : 5) * 1000UL);
    rele(false);
  } else {
    leds(false, true, false);
    bip(3, 90);
    delay(1500);
  }
  leds(false, false, false);
}
