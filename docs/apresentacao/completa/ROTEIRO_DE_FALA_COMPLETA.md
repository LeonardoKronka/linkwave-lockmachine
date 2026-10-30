# Roteiro de fala · apresentação de andamento (30/10/2026)

Tirado das anotações de cada slide de `LockMachine_Andamento_Canva.pptx`. Tempo total previsto: cerca de 21 minutos, sobrando uns 4 para perguntas (máximo de 25).
Cada um fala a sua parte, mas todos devem conseguir explicar qualquer slide: treinem trocando as partes pelo menos uma vez.

## Slide 1 · Abertura

QUEM FALA: Leonardo (abre). Tempo: 40 s.

- Bom dia/boa tarde. Somos a LinkWave, da Turma B do Técnico em Desenvolvimento de Sistemas.
- Apresentem-se rapidamente: cada um fala o nome e a sua frente (PO, Scrum Master, front-end, banco, documentação).
- Nosso TCC é o LockMachine: controle de acesso a máquinas conferindo se o operador tem as capacitações em dia.
- Hoje mostramos o andamento: o que já está pronto, o que estamos fazendo agora e o que falta até a apresentação final.
- Deixe claro desde o início: é um MVP em desenvolvimento, um protótipo acadêmico.

## Slide 2 · 01 Visão geral do projeto

QUEM FALA: Leonardo. Tempo: 1 min.

- Em uma frase: o cartão só diz QUEM é a pessoa; quem decide se ela pode usar a máquina é o servidor.
- Passo 1: o operador aproxima o cartão na leitora (ESP32 + leitor MFRC522), que manda o código do cartão (UID) pelo Wi-Fi.
- Passo 2: a API em PHP confere no banco se o cadastro está ativo, se a máquina está disponível e se cada treinamento exigido está dentro da validade.
- Passo 3: a resposta volta para a leitora (verde ou vermelho) e a tentativa vai para o histórico, com o motivo.
- Se perguntarem "por que não gravar a permissão no cartão?": porque o cartão pode ser copiado e a validade muda com o tempo; a decisão precisa estar num lugar só, o servidor.

## Slide 3 · 02 Problema identificado

QUEM FALA: Gabriel. Tempo: 1 min.

- Para liberar alguém numa máquina, o responsável precisa de seis informações: cadastro, cartão, treinamento, validade, máquina e o resultado.
- Hoje elas ficam espalhadas: planilha, gaveta, certificado em papel, anotação à mão, pedido verbal. E o resultado nem é registrado.
- Quem sofre: o supervisor (perde tempo conferindo), o operador (depende de alguém achar o papel) e a escola/empresa (não tem histórico numa auditoria).
- Seja honesto: esse cenário está descrito no TCC, mas ainda vamos confirmar com entrevistas reais (instrutores das oficinas e técnicos de segurança). O roteiro está em docs/VALIDACAO_ENTREVISTAS.md.

## Slide 4 · 03 Justificativa

QUEM FALA: Gabriel. Tempo: 50 s.

- Por que importa: a NR-12 pede que só pessoas capacitadas operem máquinas. Conferir isso no papel é lento e falha.
- Três ganhos: segurança (confere antes de cada uso), rastreabilidade (tudo fica registrado com motivo) e padronização (a mesma regra para todo mundo).
- Benefícios esperados: ver o que vai vencer antes de vencer, ter histórico para auditoria, e serve tanto para escolas técnicas como o SENAI quanto para empresas.
- IMPORTANTE (o professor exige): o LockMachine é apoio administrativo. Não substitui NR-12, análise de risco, proteções físicas nem intertravamentos. Falem isso com segurança.

## Slide 5 · 04 Objetivos

QUEM FALA: Leonardo. Tempo: 1 min.

- Objetivo geral: um protótipo que libera ou bloqueia o acesso conferindo, no servidor, o cadastro e a validade das capacitações, e registra cada tentativa.
- Os específicos já mostram o andamento: banco e API prontos; app pronto na web (o APK sai depois da publicação); leitora com firmware escrito, falta montar a bancada; testes formais ainda pendentes.
- ATENÇÃO, ANTES DE SEXTA: confiram se o texto do objetivo geral e dos específicos está igual ao do documento do TCC. Se estiver diferente, usem o texto do documento.

## Slide 6 · 05 Público-alvo e requisitos

QUEM FALA: Evelyn. Tempo: 1 min.

- Três perfis: o administrador (quem libera e cadastra), o funcionário (quem opera) e a própria leitora RFID, que também "usa" o sistema.
- O que cada um precisa está nos cards. Exemplo: o funcionário quer saber antes de ir para a máquina se o treinamento dele está vencendo.
- Levantamos 12 requisitos funcionais e 7 não funcionais, e cada um tem um critério de aceitação que dá para verificar no teste.
- Essenciais: login por perfil, capacitações com validade, validação pelo cartão com o motivo e o histórico.
- Se perguntarem um requisito não funcional: segurança (senha com hash, sessão protegida), funcionar no celular, rodar na hospedagem da escola, "na dúvida, bloqueia".

## Slide 7 · 06 Metodologia e planejamento

QUEM FALA: Cauê (Scrum Master). Tempo: 1 min.

- Usamos Scrum adaptado à escola: o Leonardo, como PO, cuida do backlog e dos critérios de aceitação; eu acompanho o andamento; cada um pega entregas pequenas que dá para revisar.
- As seis etapas: problema e usuários, requisitos, modelo de dados, back-end, integração e testes.
- As quatro primeiras estão concluídas. A integração está em andamento: telas, API e banco já funcionam juntos, falta ligar a leitora física. Os testes formais são a próxima etapa.
- Divisão: cada um tem uma frente (mostre os crachás), mas todos conhecem o projeto inteiro.
- Se perguntarem a ferramenta de organização: GitHub para o código e o histórico. (Se usaram Trello ou outro quadro, falem aqui.)

## Slide 8 · 07 Tecnologias utilizadas

QUEM FALA: João Victor. Tempo: 1 min.

- Quatro camadas. Interface: HTML, CSS e JavaScript puros; o app é um PWA, que funciona no navegador e vira APK para Android.
- Servidor: PHP com PDO, respondendo em JSON. Usamos só GET e POST porque hospedagem compartilhada costuma bloquear PUT e DELETE.
- Banco: MySQL (funciona também em MariaDB). A estrutura está em scripts versionados, então qualquer integrante recria o banco.
- Leitora: ESP32 com Wi-Fi e o leitor MFRC522, programados em C++ na Arduino IDE.
- Por que: tudo roda na hospedagem que a escola já tem (cPanel), não precisa compilar nada para o site funcionar, e um app só atende web e Android.

## Slide 9 · 08 Arquitetura da solução

QUEM FALA: Cauê. Tempo: 1 min.

- Siga as setas da esquerda para a direita: o cartão é lido pela leitora; a leitora manda o UID e o código da máquina para a API, junto com um token que identifica aquela leitora.
- A API aplica a regra consultando o banco e devolve "liberado" ou "bloqueado". A leitora só acende o LED; ela não decide nada.
- O app (administrador e funcionário) conversa com a mesma API, com login em sessão (cookie HttpOnly, que o JavaScript não consegue ler).
- Vantagem: a regra fica num lugar só. Se a capacitação vence hoje, amanhã o mesmo cartão já é bloqueado, sem mexer na leitora.

## Slide 10 · 09 Modelo de dados

QUEM FALA: João Victor. Tempo: 1 min.

- Oito tabelas em três grupos. Pessoas: usuarios (quem faz login) e operadores (quem opera; o UID do cartão fica aqui).
- Capacitações: treinamentos (com validade em meses), operador_treinamento (o que cada um concluiu e até quando vale) e maquina_treinamento (o que cada máquina exige). São as duas tabelas de ligação N:N.
- Máquinas: maquinas (com status: ativa, manutenção, bloqueada, inativa) e dispositivos (as leitoras).
- Tudo desemboca em acessos: cada tentativa, liberada ou bloqueada, com o motivo.
- Detalhes que mostram cuidado: ninguém é apagado (desativação lógica, para não perder histórico), matrícula/UID/código são únicos, e senha e token nunca ficam em texto.
- Se pedirem o diagrama completo: está no Workbench (Database > Reverse Engineer).

## Slide 11 · 10 Desenvolvimento: a regra de acesso

QUEM FALA: Cauê. Tempo: 1 min 10 s.

- Este é o coração do sistema (seção 4.7 do TCC, arquivo api/lib/regras.php).
- O servidor faz cinco perguntas, sempre nesta ordem: o cartão está cadastrado? o operador está ativo? a máquina está disponível? ele tem todas as capacitações que a máquina exige? elas estão dentro da validade?
- A primeira resposta "não" bloqueia e vira o motivo: CARTAO_DESCONHECIDO, OPERADOR_INATIVO, MAQUINA_INDISPONIVEL, TREINAMENTO_AUSENTE ou TREINAMENTO_VENCIDO. Se tudo for "sim": AUTORIZADO. São os 6 resultados possíveis.
- Exemplo: o Bruno (fictício) tem a NR-12 vencida, então na prensa ele é bloqueado com o motivo TREINAMENTO_VENCIDO.
- Por que a ordem importa: o motivo gravado precisa ser um só e sempre o mesmo para a mesma situação, senão o histórico perde valor.

## Slide 12 · 11 Desafios técnicos e soluções

QUEM FALA: João Victor. Tempo: 1 min.

- Três desafios reais que resolvemos:
  1) Hospedagens compartilhadas bloqueiam PUT e DELETE, então toda alteração usa POST e a ação vai na URL (?id= e &acao=).
  2) O cartão não pode carregar a permissão, então ele só identifica e a decisão fica no servidor.
  3) Não sabíamos a versão do servidor da escola, então o código é compatível com PHP 7.4 e funciona em MariaDB e em MySQL. Já rodamos em MariaDB 10.11 e no MySQL 8.4 do SENAI.
- À direita, a regra de ouro: "na dúvida, bloqueia". Se cair a rede, o servidor ou o banco, nega. Cartão desconhecido, bloqueia. Se acabar a energia, a leitora volta bloqueada.
- Isso é segurança por padrão (fail-safe): o erro nunca libera a máquina.

## Slide 13 · 12 Segurança e LGPD

QUEM FALA: João Victor. Tempo: 40 s (se o tempo apertar, resuma em uma frase).

- Segurança não ficou para o final: senhas só como hash, conta travada depois de 5 erros, sessão em cookie que o JavaScript não lê, consultas preparadas (sem SQL injection) e cada leitora com um token próprio.
- LGPD: o site tem Política de Privacidade e Termos de Uso, e o histórico mostra o UID do cartão mascarado.
- Se perguntarem o que é hash: é uma "impressão digital" da senha; dá para conferir se a senha está certa, mas não dá para voltar à senha original.

## Slide 14 · 13 Demonstração: painel do administrador

QUEM FALA: Evelyn narra e Leonardo opera o app. Tempo: 3 min.

ANTES DE SEXTA: deixem o app aberto já logado como administrador no site publicado (https://somoslinkwave.com.br/app/). Testem a demo inteira pelo menos duas vezes.

Roteiro (entrada → processamento → resultado):
1. Mostre o Painel: tentativas do dia, liberadas, bloqueadas, vencimentos e o status das máquinas (a torrezinha de cada uma).
2. Vá em "Simular leitura", escolha o cartão do Bruno Teixeira e a máquina P-01, clique em "Aproximar cartão".
3. Explique: o servidor está fazendo as cinco perguntas da regra.
4. Resultado: bloqueado, motivo treinamento vencido (NR-12). Repita com a Ana Ribeiro na P-01: liberado.
5. Abra o Histórico: as duas tentativas aparecem com o motivo e a origem "simulador". A leitora ESP32 usa a mesma rota e a mesma regra.

Plano B: se a internet ou o servidor falharem, usem este slide e o próximo (prints reais do app) e o simulador da página do LockMachine.
Os nomes (Ana, Bruno, Carla, Diego) são dados fictícios do seed: digam isso.

## Slide 15 · 14 Demonstração: app do funcionário

QUEM FALA: Evelyn. Tempo: 1 min.

- É o mesmo app; o que muda é o perfil. O funcionário entra com a matrícula e uma senha provisória que ele troca no primeiro acesso.
- Início: o crachá digital e o resumo (quantas capacitações válidas, vencendo, vencidas, quantas máquinas liberadas).
- Capacitações: cada treinamento com a data de validade e uma barra mostrando quanto falta para vencer.
- Máquinas: em quais ele pode operar e, se não pode, por quê.
- O app é um PWA: roda no navegador e, como o site já está publicado com HTTPS, o próximo passo é gerar o APK para Android pelo PWABuilder.
- Se der tempo, mostrem ao vivo no celular (entrem com OP-1042).

## Slide 16 · 15 Testes e validação

QUEM FALA: Gabriel. Tempo: 1 min.

- Sejam transparentes: os testes FORMAIS ainda não foram executados. Por isso o produto continua "MVP em desenvolvimento".
- O plano: CT são os casos de teste funcionais (um por requisito), TNF são os testes de falha (rede, servidor, banco, energia, cartão desconhecido) e cada resultado vira uma evidência EV-XX com data.
- O que já verificamos durante o desenvolvimento: as rotas da API, o login com troca de senha e bloqueio, os seis resultados da regra pelo simulador e o app no celular e no computador.
- A fazer: executar e registrar os testes, fazer as entrevistas de validação e testar na bancada com cartões reais.

## Slide 17 · 16 Resultados até agora

QUEM FALA: Cauê. Tempo: 50 s.

- Resumo do andamento: dos 9 módulos, 6 estão implementados e funcionando juntos: site, simulador, banco, API, app do administrador e app do funcionário.
- Dois estão em preparação: o APK (o site já está publicado com HTTPS; falta gerar) e a leitora (o firmware está escrito, falta montar a bancada e testar).
- Um está pendente: os testes formais com evidências.
- Evidências que já dá para mostrar: o site e o app funcionando (a demo que vocês viram) e o código no GitHub.

## Slide 18 · 17 Limitações e próximos passos

QUEM FALA: Evelyn. Tempo: 1 min.

- O que falta: montar e testar a bancada (o firmware está escrito, mas ainda não foi compilado), gerar o APK (o site já está publicado com HTTPS), os testes formais e a validação com usuários.
- Limites do protótipo, sem medo de falar: é apoio administrativo, não certifica segurança, não substitui NR-12, proteções físicas nem intertravamentos, e o relé é de bancada, não liga numa máquina de verdade.
- Próximas etapas: a publicação já foi feita (o site está no ar em somoslinkwave.com.br). Agora, em ordem: gerar o APK, montar a bancada, executar os testes, registrar as evidências e fechar a documentação para a banca.

## Slide 19 · 18 Considerações finais

QUEM FALA: Leonardo. Tempo: 50 s.

- Retomando: o problema era a informação de capacitação espalhada e sem registro. A solução: o cartão identifica, o servidor decide e toda tentativa vira registro.
- Aprendizado: o texto do slide é uma sugestão. ANTES DE SEXTA, combinem entre vocês qual foi o principal aprendizado da equipe e falem com as suas palavras.
- Contribuição: um modelo didático de controle de acesso que pode ser usado em oficinas e laboratórios, como os do próprio SENAI.
- Feche com a frase do slide: "Sem capacitação válida, sem acesso."

## Slide 20 · 19 Referências

QUEM FALA: Gabriel. Tempo: 20 s.

- Só mostre: normas (NR-12 e LGPD), as soluções de mercado que comparamos e a documentação das tecnologias.
- A lista completa, no padrão ABNT, está no documento do TCC.
- ANTES DE SEXTA: confira se estas referências batem com as do documento e acrescente as que faltarem.

## Slide 21 · Encerramento

QUEM FALA: Leonardo agradece; todos respondem às perguntas.

- Agradeçam ao coordenador e aos professores Ricardo e Tom.
- Perguntas: quem responde é quem cuida daquela frente (banco: João; API e regra: Cauê; telas: Evelyn; documentação e testes: Gabriel; visão geral e cronograma: Leonardo). Mas todos devem saber responder o básico de qualquer parte.
- Perguntas prováveis: "e se a internet cair?" (na dúvida, bloqueia); "dá para burlar com outro cartão?" (o cartão só identifica, cada tentativa fica registrada com o UID); "quando fica pronto?" (próximas etapas do slide 18); "isso substitui a NR-12?" (não, é apoio administrativo).
