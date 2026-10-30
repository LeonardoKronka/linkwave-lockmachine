# Roteiro de fala · apresentação de andamento (30/10/2026)

Tirado das anotações de cada slide de `LockMachine_Andamento_Canva.pptx`. Os slides levam cerca de 8 minutos; depois vem a demonstração do site e do app (10 a 12 minutos) e as perguntas, dentro dos 25 minutos.

| Quem | Slides | Na demonstração |
|---|---|---|
| Leonardo | 1, 2, 11, 12 | opera o app do administrador |
| Gabriel | 3, 9 | mostra o site e o simulador |
| Evelyn | 4, 5 | mostra o app do funcionário no celular |
| Cauê | 6, 8 | explica a regra durante a simulação |
| João Victor | 7, 10 | mostra o histórico e o banco |

Cada um fala a sua parte, mas todos devem conseguir explicar qualquer slide: treinem trocando as partes pelo menos uma vez.

## Slide 1 · Abertura

QUEM FALA: Leonardo. Tempo: 30 s.

- Somos a LinkWave, Turma B. Cada um diz o nome e a sua frente.
- Nosso TCC é o LockMachine: só libera a máquina para quem tem as capacitações em dia.
- Primeiro um resumo rápido nos slides; depois mostramos o site e o app funcionando.
- É um MVP em desenvolvimento.

## Slide 2 · 01 Visão geral do projeto

QUEM FALA: Leonardo. Tempo: 50 s.

- Em uma frase: o cartão só diz quem é a pessoa; quem decide é o sistema.
- O operador aproxima o crachá, o sistema confere cadastro, máquina e validade dos treinamentos, e libera ou bloqueia.
- Toda tentativa fica no histórico, com o motivo.

## Slide 3 · 02 Problema e justificativa

QUEM FALA: Gabriel. Tempo: 50 s.

- Para liberar alguém numa máquina, as informações ficam espalhadas: planilha, gaveta, certificado em papel, anotação à mão. E o resultado não fica registrado.
- Por que fazer: segurança (a NR-12 exige operador capacitado), rastreabilidade (tudo registrado) e padronização (a mesma regra para todos).
- Deixe claro: é apoio administrativo, não substitui NR-12 nem proteções físicas.
- Se perguntarem: esse cenário ainda vai ser confirmado com entrevistas (o roteiro está pronto).

## Slide 4 · 03 Objetivos

QUEM FALA: Evelyn. Tempo: 40 s.

- Objetivo geral: um protótipo que libera ou bloqueia o acesso conferindo as capacitações e registra cada tentativa.
- Os específicos já mostram o andamento: banco e regra prontos; o app está pronto na web e falta gerar o APK; a leitora tem o programa escrito e falta montar; os testes formais são a próxima etapa.
- ANTES DE SEXTA: confiram se o objetivo geral está igual ao do documento do TCC.

## Slide 5 · 04 Público-alvo e requisitos

QUEM FALA: Evelyn. Tempo: 40 s.

- Três perfis: o administrador (quem libera e cadastra), o funcionário (quem opera) e a leitora RFID na máquina.
- Levantamos 12 requisitos funcionais e 7 não funcionais, cada um com um critério de aceitação para conferir no teste.
- Essenciais: login por perfil, capacitações com validade, liberação pelo cartão e histórico.

## Slide 6 · 05 Metodologia e tecnologias

QUEM FALA: Cauê. Tempo: 50 s.

- Trabalhamos com Scrum adaptado: o Leonardo é o PO, eu sou o Scrum Master, e cada um tem uma frente, mas todos conhecem o projeto inteiro.
- Entregas pequenas, revisadas pela equipe, com o código no GitHub.
- Tecnologias: site e app em HTML, CSS e JavaScript; servidor em PHP; banco MySQL; leitora com ESP32 e RFID.
- Escolhemos assim porque tudo roda na hospedagem da escola (cPanel). (Se usaram Trello ou outro quadro, citem aqui.)

## Slide 7 · 06 Como a solução funciona

QUEM FALA: João Victor. Tempo: 50 s.

- Siga as setas: o cartão é lido pela leitora da máquina, que pergunta ao servidor.
- O servidor confere a regra no banco e responde: libera ou bloqueia. A leitora não decide nada.
- O app, do administrador e do funcionário, usa o mesmo servidor.
- Regra de ouro: na dúvida, bloqueia. Se cair a rede ou o servidor, a máquina não libera.
- Tudo fica registrado no banco, com o motivo. Na demonstração mostramos isso funcionando.

## Slide 8 · 07 Testes e resultados

QUEM FALA: Cauê. Tempo: 40 s.

- De 9 módulos, 6 estão prontos e funcionando juntos: site, simulador, banco, servidor e os dois apps.
- Em preparação: o APK (o site já está publicado com HTTPS, então já dá para gerar) e a leitora (o programa está escrito, falta montar).
- Testes: testamos durante o desenvolvimento; os testes formais, com evidências, são a próxima etapa. Por isso ainda é um MVP em desenvolvimento.

## Slide 9 · 08 Limitações e próximos passos

QUEM FALA: Gabriel. Tempo: 40 s.

- O primeiro passo já foi feito: o site e o app estão no ar em somoslinkwave.com.br, com HTTPS. Agora, em ordem: gerar o APK, montar a bancada da leitora, executar os testes, registrar as evidências e preparar a apresentação final.
- Limites, sem medo de falar: é apoio administrativo, não substitui NR-12 nem proteções físicas, e a leitora é de bancada, não liga numa máquina real.

## Slide 10 · 09 Considerações finais

QUEM FALA: João Victor. Tempo: 30 s.

- O problema: capacitações conferidas no papel e sem registro. A solução: o cartão identifica, o servidor decide e tudo fica registrado.
- Aprendizado: é uma sugestão; combinem o aprendizado real da equipe e falem com as suas palavras.
- Feche com a frase: "Sem capacitação válida, sem acesso." e passe para a demonstração.

## Slide 11 · 10 Demonstração ao vivo

QUEM PUXA: Leonardo. Neste slide, só anunciem e troquem para o navegador (10 a 12 minutos de demonstração).

Divisão sugerida da demonstração:
- Site (Gabriel): página da LinkWave e página do LockMachine; use o simulador com a Ana (liberada) e o Bruno (bloqueado, NR-12 vencida). Diga que os nomes são fictícios.
- App do administrador (Leonardo opera; Cauê explica a regra e João mostra o banco/histórico): painel, cadastro de um funcionário com capacitação, "Simular leitura" e o resultado no histórico com o motivo.
- App do funcionário (Evelyn, no celular): entrar com a matrícula, capacitações com validade e máquinas liberadas.

ANTES DE SEXTA: deixem tudo aberto e logado no site publicado (https://somoslinkwave.com.br e https://somoslinkwave.com.br/app/). Treinem a demonstração inteira pelo menos duas vezes.
Plano B: se a rede ou o servidor falharem, usem os prints da versão completa da apresentação (pasta completa).
Depois da demonstração, voltem para o último slide (Obrigado / Perguntas).

## Slide 12 · Encerramento e referências

QUEM FALA: Leonardo agradece; todos respondem às perguntas. Tempo: 20 s.

- Agradeçam ao coordenador e aos professores Ricardo e Tom.
- As referências principais estão aqui; a lista completa está no documento do TCC.
- Perguntas: quem responde é quem cuida da frente (banco: João; servidor e regra: Cauê; telas: Evelyn; documentação e testes: Gabriel; visão geral e cronograma: Leonardo).
- Perguntas prováveis: "e se a internet cair?" (na dúvida, bloqueia); "isso substitui a NR-12?" (não, é apoio administrativo); "quando fica pronto?" (próximos passos do slide 9).
