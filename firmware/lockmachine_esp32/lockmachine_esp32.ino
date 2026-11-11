/*
  LockMachine · leitora RFID de bancada (ESP32 + MFRC522 + torre de sinalização)
  -------------------------------------------------------------------------------
  Lê o cartão, pergunta ao servidor do LockMachine se o operador pode usar a máquina e mostra a
  resposta na torre de sinalização. O servidor confere cadastro, máquina e capacitações e REGISTRA
  cada tentativa: é isso que aparece no histórico e no dashboard do painel e do app.

  A "máquina" da bancada (o martelo da prensa de demonstração e a luz verde) só é acionada quando o
  servidor responde "autorizado". Qualquer falha (Wi-Fi, servidor, banco, resposta inválida) nega o
  acesso e mantém tudo parado (seção 4.8 do TCC).

  Protótipo acadêmico: NÃO ligue as saídas a uma máquina real. Elas representam "liberar" ou
  "manter bloqueado" na bancada de demonstração.

  Base: o teste de leitura do Caue (pinos e SPI que funcionaram na placa), com o Wi-Fi, a API,
  a torre de sinalização nos relés e o servo do martelo.

  Arduino IDE
    Placa ......... ESP32 Dev Module (pacote "esp32" da Espressif)
    Bibliotecas ... MFRC522 (GithubCommunity / miguelbalboa)
                    ArduinoJson 7.x (Benoit Blanchon)
                    ESP32Servo (Kevin Harrington)

  Ligações (MFRC522 -> ESP32)
    SDA/SS -> GPIO 5      SCK  -> GPIO 18
    MOSI   -> GPIO 23     MISO -> GPIO 19
    RST    -> GPIO 22     3.3V -> 3V3 (NÃO use 5 V)     GND -> GND
  Módulo de 4 relés -> ESP32
    IN1 (luz verde)     -> GPIO 27
    IN2 (luz amarela)   -> GPIO 26
    IN3 (luz vermelha)  -> GPIO 25
    IN4 (buzzer)        -> GPIO 33
    VCC -> VIN (5 V do USB)        GND -> GND
  Torre de sinalização HDL-T50L-3C-J (12/24 V DC) nos contatos dos relés, com fonte de 12 V própria:
    + da fonte de 12 V -> COM1, COM2, COM3 e COM4 (emendados)
    NO1 -> fio verde   NO2 -> fio amarelo   NO3 -> fio vermelho   NO4 -> fio roxo (buzzer)
    fio preto da torre -> − da fonte de 12 V
    Os 12 V ficam só nos contatos dos relés: nunca ligue a fonte de 12 V nos pinos do ESP32.
  Servo SG90 do martelo da prensa (firmware/caixa-3d):
    laranja (sinal) -> GPIO 13
    vermelho (5 V)  -> VIN (5 V do USB), com um capacitor de 470 µF entre 5 V e GND
    marrom (GND)    -> GND
    Se o ESP32 reiniciar quando o servo mexe, alimente o servo por uma fonte de 5 V
    separada, ligando o GND dela ao GND do ESP32.

  O que a torre mostra
    amarelo aceso ........ pronto, esperando um cartão
    amarelo piscando ..... conectando ao Wi-Fi
    vermelho piscando .... sem Wi-Fi (todo cartão é negado até a rede voltar)
    verde ................ o servidor liberou (o martelo desce e sobe)
    vermelho ............. o servidor negou, ou não deu para perguntar a ele
    vermelho fixo no início: o leitor RFID não respondeu (confira os fios dele)

  Antes de gravar:
    1. No app LockMachine, entre como administrador, abra "Leitoras RFID", cadastre esta leitora
       e copie o token (ele aparece uma vez só).
    2. Copie segredos.exemplo.h para segredos.h e preencha o Wi-Fi e o token. A rede precisa ter
       internet (o servidor está no site) e ser de 2,4 GHz.
    3. Grave, abra o Monitor Serial em 115200 e aproxime o cartão: o número aparece lá
       (ex.: "00 52 C2 80"). Cadastre esse número no funcionário, no app, para ele poder ser liberado.
*/

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

// ================== CONFIGURE AQUI ==================
// Nome e senha do Wi-Fi e token da leitora ficam em segredos.h (o Git ignora esse arquivo).
// Na primeira vez, copie segredos.exemplo.h para segredos.h e preencha.
#include "segredos.h"
const char* API_URL        = "https://somoslinkwave.com.br/api/acessos/validar.php";
const char* MAQUINA_CODIGO = "P-01";   // ignorado se a leitora estiver vinculada a uma máquina no app
// true: LEDs ligados direto nos pinos (o teste enquanto a fonte de 12 V não chega).
// false: módulo de relés da torre (a maioria liga o relé quando o pino vai para LOW).
// TROQUE PARA false QUANDO LIGAR O MÓDULO DE RELÉS, senão a torre acende ao contrário.
const bool  SAIDAS_ATIVAS_EM_ALTO = true;
// O buzzer da torre é bem alto: mude para false para testar em silêncio na sala.
const bool  BUZZER_LIGADO = true;
// Servo do martelo: ângulos com o martelo em cima e embaixo. Se o servo não chegar até o fim
// ou ficar zumbindo parado, aproxime os dois valores de 90 (por exemplo, 15 e 165).
const int   SERVO_ANGULO_CIMA  = 5;
const int   SERVO_ANGULO_BAIXO = 175;
// ====================================================

// RFID (SPI) — iguais ao teste do Caue
const int PIN_SCK = 18;
const int PIN_MISO = 19;
const int PIN_MOSI = 23;
const int PIN_SS = 5;
const int PIN_RST = 22;
// Torre de sinalização (entradas IN1 a IN4 do módulo de relés). As cores usam os mesmos pinos
// dos LEDs do teste do Caue.
const int PIN_TORRE_VERDE = 27;     // IN1
const int PIN_TORRE_AMARELO = 26;   // IN2
const int PIN_TORRE_VERMELHO = 25;  // IN3
const int PIN_TORRE_BUZZER = 33;    // IN4
// Martelo da prensa de demonstração
const int PIN_SERVO = 13;

const unsigned long INTERVALO_MESMO_CARTAO_MS = 3000;  // ignora leitura repetida do mesmo cartão
const unsigned long TEMPO_MAXIMO_HTTP_MS = 6000;
const unsigned long TEMPO_CONEXAO_WIFI_MS = 15000;
const unsigned long TEMPO_RESPOSTA_NEGADA_MS = 2000;

MFRC522 rfid(PIN_SS, PIN_RST);
Servo martelo;
String ultimoUid = "";
unsigned long ultimaLeitura = 0;

// Liga ou desliga uma saída da torre, respeitando o tipo do módulo de relés.
void saida(int pino, bool ligar) {
  digitalWrite(pino, (ligar == SAIDAS_ATIVAS_EM_ALTO) ? HIGH : LOW);
}

// Prepara a saída já desligada (escreve o nível antes de virar saída, para o relé não estalar no boot).
void prepararSaida(int pino) {
  saida(pino, false);
  pinMode(pino, OUTPUT);
  saida(pino, false);
}

void torre(bool verde, bool vermelho, bool amarelo) {
  saida(PIN_TORRE_VERDE, verde);
  saida(PIN_TORRE_VERMELHO, vermelho);
  saida(PIN_TORRE_AMARELO, amarelo);
}

// Estado de espera: só o amarelo aceso.
void aguardando() {
  torre(false, false, true);
}

// Um apito. Com o buzzer ligado direto no pino (teste com LEDs), manda uma onda de ~2,7 kHz: assim apita
// tanto o buzzer ativo quanto o passivo (o passivo só estala com o pino parado em HIGH). Pelo relé (torre),
// liga e desliga uma vez só, porque o buzzer da torre é ativo e o relé não aguenta chavear rápido.
void apito(int duracaoMs) {
  if (!BUZZER_LIGADO) {
    delay(duracaoMs);
    return;
  }
  if (SAIDAS_ATIVAS_EM_ALTO) {
    unsigned long fim = millis() + duracaoMs;
    while (millis() < fim) {
      digitalWrite(PIN_TORRE_BUZZER, HIGH);
      delayMicroseconds(185);
      digitalWrite(PIN_TORRE_BUZZER, LOW);
      delayMicroseconds(185);
    }
  } else {
    saida(PIN_TORRE_BUZZER, true);
    delay(duracaoMs);
    saida(PIN_TORRE_BUZZER, false);
  }
}

void bip(int vezes, int duracaoMs) {
  for (int i = 0; i < vezes; i++) {
    apito(duracaoMs);
    delay(duracaoMs);
  }
}

// Leva o martelo devagar até o ângulo pedido (passos de 2°), para o servo não puxar um pico de corrente.
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

// Ciclo da prensa de demonstração: desce, segura um instante e sobe.
// Só é chamado depois que o servidor autoriza o cartão.
void cicloPrensa() {
  moverMartelo(SERVO_ANGULO_BAIXO);
  delay(500);
  moverMartelo(SERVO_ANGULO_CIMA);
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
    torre(false, false, (millis() / 500) % 2);   // pisca devagar: cada piscada é um estalo do relé
    delay(100);
    Serial.print(".");
  }
  bool conectado = WiFi.status() == WL_CONNECTED;
  Serial.println(conectado ? " conectado." : " sem conexão.");
  if (conectado) {
    Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());
    aguardando();
  } else {
    torre(false, false, false);
    Serial.println("Confira o nome e a senha da rede. Redes 5 GHz não funcionam no ESP32: use uma de 2,4 GHz.");
  }
  return conectado;
}

// Número do cartão no formato do teste do Caue: "00 52 C2 80". A API aceita com ou sem espaços.
String lerUid() {
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
    if (i < rfid.uid.size - 1) uid += " ";
  }
  uid.toUpperCase();
  return uid;
}

// Explica no Monitor Serial por que a API não respondeu com uma decisão.
void explicarFalha(int status, const String& resposta) {
  if (status < 0) {
    Serial.printf("Sem resposta do servidor (%s). Confira a internet da rede e o API_URL.\n", HTTPClient::errorToString(status).c_str());
  } else if (status == 401) {
    Serial.println("Servidor recusou a leitora: o DEVICE_TOKEN está errado ou a leitora está desativada no app.");
  } else if (status == 400) {
    Serial.printf("Servidor recusou os dados: %s\n", resposta.c_str());
  } else if (status == 429) {
    Serial.println("Leituras demais em pouco tempo: espere um minuto.");
  } else {
    Serial.printf("API respondeu %d: %s\n", status, resposta.c_str());
  }
  Serial.println("Acesso NEGADO por falta de decisão confiável do servidor.");
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

  JsonDocument pedido;
  pedido["rfid_uid"] = uid;
  pedido["maquina_codigo"] = MAQUINA_CODIGO;
  String corpo;
  serializeJson(pedido, corpo);

  int status = http.POST(corpo);
  String resposta = status > 0 ? http.getString() : "";
  http.end();
  if (status != 200) {
    explicarFalha(status, resposta);
    return false;
  }

  JsonDocument doc;
  if (deserializeJson(doc, resposta)) {
    Serial.println("Resposta inválida da API: acesso negado.");
    return false;
  }
  bool sucesso = doc["sucesso"] | false;
  bool autorizado = doc["dados"]["autorizado"] | false;
  motivo = String((const char*)(doc["dados"]["motivo_codigo"] | "SERVICO_INDISPONIVEL"));
  segundos = doc["dados"]["liberar_segundos"] | 0;
  const char* nome = doc["dados"]["operador"]["nome"] | "cartão sem cadastro";
  const char* mensagem = doc["mensagem"] | "";
  Serial.printf("Decisão: %s · %s · %s (%s)\n", autorizado ? "LIBERADO" : "NEGADO", nome, mensagem, motivo.c_str());
  Serial.printf("Registrado no painel como acesso #%d\n", (int)(doc["dados"]["acesso_id"] | 0));
  return sucesso && autorizado;
}

void setup() {
  // Estado seguro antes de qualquer outra coisa: torre e buzzer desligados, martelo em cima.
  prepararSaida(PIN_TORRE_VERDE);
  prepararSaida(PIN_TORRE_AMARELO);
  prepararSaida(PIN_TORRE_VERMELHO);
  prepararSaida(PIN_TORRE_BUZZER);
  martelo.setPeriodHertz(50);
  martelo.attach(PIN_SERVO, 500, 2400);
  martelo.write(SERVO_ANGULO_CIMA);   // é a posição em que o braço do servo é encaixado na montagem

  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("==============================");
  Serial.println("       LOCKMACHINE RFID       ");
  Serial.println("==============================");

  SPI.begin(PIN_SCK, PIN_MISO, PIN_MOSI, PIN_SS);
  rfid.PCD_Init();
  rfid.PCD_DumpVersionToSerial();   // mostra a versão do MFRC522: confirma que o SPI está ok
  bool avisou = false;
  while (!leitorOk()) {
    Serial.println("Autoteste: MFRC522 não respondeu. Confira as ligações.");
    torre(false, true, false);      // vermelho fixo
    if (!avisou) bip(1, 300);       // o buzzer da torre é alto: avisa uma vez só
    avisou = true;
    delay(2000);
    rfid.PCD_Init();
  }
  Serial.println("Autoteste: leitor OK.");
  torre(true, true, true);          // testa as três luzes da torre
  bip(1, 80);
  delay(500);
  torre(false, false, false);

  conectarWiFi();
  Serial.println("Pronto. Aproxime seu cartão RFID...");
}

void loop() {
  // Sem rede: nega tudo e tenta reconectar (martelo parado).
  if (WiFi.status() != WL_CONNECTED) {
    torre(false, (millis() / 500) % 2, false);
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

  Serial.println();
  Serial.printf("Cartão identificado: %s\n", uid.c_str());
  Serial.println("Consultando o servidor...");
  torre(false, false, true);
  bip(1, 50);

  String motivo;
  int segundos;
  if (validar(uid, motivo, segundos)) {
    Serial.println("ACESSO PERMITIDO!");
    torre(true, false, false);
    bip(1, 180);
    unsigned long liberadoDesde = millis();
    cicloPrensa();
    unsigned long liberarMs = (segundos > 0 ? segundos : 5) * 1000UL;
    unsigned long passou = millis() - liberadoDesde;
    if (passou < liberarMs) delay(liberarMs - passou);
  } else {
    Serial.println("ACESSO NEGADO!");
    torre(false, true, false);
    bip(3, 90);
    delay(TEMPO_RESPOSTA_NEGADA_MS);
  }
  aguardando();
}
