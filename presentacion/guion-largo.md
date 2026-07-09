# GUIÓN DEFENSA TFG — TELARIA
# Tempo total obxectivo: 20:00

---

## 1. PRESENTACIÓN (0:00–0:30) · Diapo 1

Ola, bos días. Son Jorge Otero Pailos, e veño presentar o meu Traballo de Fin
de Grao: Telaria, unha aplicación de planificación colaborativa de viaxes,
tutorizado por Víctor José Gallego Fontenla e Pedro Gamallo Fernández.

---

## 2. MOTIVACIÓN E PROBLEMA (0:30–2:00) · Diapo 2

Telaria xurde dunha necesidade moi natural: a de organizar mellor as viaxes
en grupo. Cando se fan estas viaxes, eu mesmo, e seguro que vós tamén,
atopámonos a miúdo cun problema: ninguén sabe onde está nada, porque cada
cousa está nun sitio distinto. Explícome: ao principio mércanse os billetes,
resérvase o aloxamento, decídese que se quere visitar... pero co paso do
tempo xorden dúbidas inevitábeis: quen pagou a comida de todos? A quen lle
debo cartos? Onde están os billetes de avión? É hoxe o día deste plan ou
deste outro? Pásasme as fotos que fixeches?

A raíz do problema é que organizamos cada parte da viaxe de xeito diferente,
ao non dispor dun bo mecanismo unificador. No mellor dos casos, todo remata
nun monolítico grupo de WhatsApp no que é imposíbel atopar nada; e no peor,
pérdense datos irrecuperabelmente entre o calendario de Google, o Tricount e
un SharePoint.

---

## 3. SOLUCIÓN E DIFERENCIACIÓN (2:00–3:30) · Diapo 3

Telaria nace como solución a este problema: unha aplicación que integra
todos os servizos necesarios para a planificación dunha viaxe nun mesmo
lugar, aforrando esforzo e previndo erros. As súas funcionalidades combinan
as de todas as aplicacións que normalmente usariamos na organización: un
xestor de gastos con calculadora automática de débedas, un calendario
compartido, unha nube de documentos e un chat, ademais dun asistente de
intelixencia artificial que xa conta con todo o contexto da viaxe.

Xa existen ferramentas que cobren parte disto — Tricount para os gastos,
Google Calendar para as datas, WhatsApp para a comunicación — pero ningunha
o fai de xeito conxunto nin pensado especificamente para unha viaxe en
grupo.

Ademais, a diferenza doutras ferramentas, en Telaria todos os membros teñen as mesmas
capacidades, non hai un "organizador" do que dependan os demais, evitando así cuellos de botella 
ou a necesidade de atopar alguén disposto a cargar con toda a xestión.

O obxectivo deste traballo foi, polo tanto, deseñar e desenvolver Telaria
como unha aplicación móbil multiplataforma que resolva esta fragmentación
nun único espazo colaborativo.

---

## 4. FUNCIONALIDADES PRINCIPAIS (3:30–4:30) · Diapo 4 [Fig. 1.1]

Como se pode ver neste esquema, Telaria artéllase arredor da viaxe como
unidade central, e a partir de aí despréganse sete módulos: a xestión do
ciclo de vida da viaxe, os gastos e liquidacións, os eventos e calendario,
os documentos compartidos, o chat de grupo, o asistente de intelixencia
artificial, e a rede de amizades como funcionalidade complementaria.

---

## 5. ARQUITECTURA XERAL (4:30–6:30) · Diapo 5 [Fig. 3.1]

Escollemos unha arquitectura cliente-servidor porque Telaria xestiona datos
compartidos entre varios usuarios en tempo real — gastos, eventos, chat —
que deben estar sempre sincronizados e consistentes para todos os membros
da viaxe. Un modelo local ou peer-to-peer complicaría moito garantir que
todos vexan a mesma información actualizada, ademais de dificultar aspectos
como a autorización, verificar que só os membros da viaxe acceden aos seus
datos, ou a persistencia fiable dos documentos.

O cliente é unha aplicación móbil multiplataforma feita con React Native e
Expo. O servidor agrupa, en contedores Podman, un backend en Spring Boot e
tres servizos de apoio: PostgreSQL para a persistencia, MinIO como almacén
de obxectos compatible con S3 para os documentos, e Ollama como motor de
inferencia local para o asistente de intelixencia artificial.

Todo o desenvolvemento parte dun enfoque API-first: a especificación
OpenAPI é o contrato que se escribe primeiro, antes de calquera
implementación, e vincula explicitamente o frontend co backend.

---

## 6. DECISIÓNS TÉCNICAS CLAVE (6:30–10:00) · Diapos 6, 7, 8

*(Tres diapositivas, ~55 segundos por punto)*

**Contrato OpenAPI xerado a ambos lados.**
A partir dun único documento OpenAPI xérase automaticamente código nos dous
extremos: no backend, as interfaces dos controladores e os DTO; no
frontend, os tipos de TypeScript. Isto significa que calquera cambio na API
propágase automaticamente e calquera incoherencia detéctase en tempo de
compilación, en vez de en produción.

**Autenticación con JWT e rotación de refresh tokens.**
O acceso á API protéxese cun access token JWT de vida curta, que o backend
asina cunha clave privada RSA e valida sen consultar a base de datos. Para
renovalo sen que o usuario teña que volver iniciar sesión, empregamos un
refresh token opaco gardado no servidor, que aplica rotación automática: en
cada uso invalídase o anterior e emítese un novo, de xeito que un token
roubado queda inutilizábel tras o primeiro uso lexítimo.

**Server-Sent Events para o chat e o asistente de IA.**
Tanto o chat de grupo coma a resposta do asistente de intelixencia
artificial requiren entrega en tempo real. En vez de WebSockets, optamos
por Server-Sent Events, que abondan para un fluxo unidireccional
servidor-cliente e simplifican moito a implementación fronte a unha
conexión bidireccional que aquí non necesitamos.

**URLs prefirmadas para os documentos.**
Os ficheiros que sobe o usuario nunca pasan polo backend: este limítase a
xerar unha URL temporal e asinada contra MinIO, e o cliente sobe ou
descarga o ficheiro directamente contra ese almacén. Isto descarga o
servidor de aplicación da transferencia de bytes e mellora a
escalabilidade.

---

## 7. DESEÑO UI/UX E ACCESIBILIDADE (10:00–11:30) · Diapo 9 [Fig. 3.8]

No plano visual, Telaria emprega unha paleta monocromática centrada no
violeta, con tema claro e escuro seleccionábeis polo usuario, e tipografía
nativa do sistema para manter unha aparencia coidada sen penalizar o
rendemento.

En canto á accesibilidade, a interface cumpre o limiar de contraste WCAG
AA, incorpora etiquetas e roles de accesibilidade para lectores de
pantalla, respecta a preferencia de movemento reducido do sistema operativo
e amplía a área de pulsación dos controis ao mínimo recomendado.

---

## 8. DEMOSTRACIÓN (11:30–14:30) · Diapo 10 [vídeo]

*(Reproducir vídeo silenciado, narrar en directo por riba)*

Aquí podedes ver un percorrido rápido pola aplicación. Primeiro, unímonos a
unha viaxe escaneando un código QR. A continuación, rexistramos un gasto e
vemos como se recalculan automaticamente os balances e a liquidación
suxerida entre membros. Despois, creamos un evento no calendario
seleccionando a localización directamente nun mapa interactivo. E por
último, o asistente de intelixencia artificial, que responde en streaming
tendo en conta o contexto da propia viaxe.

---

## 9. PROBAS E RESULTADOS (14:30–17:30) · Diapos 11, 12

O proxecto conta con 677 probas automatizadas: 410 no backend con JUnit 5,
incluíndo probas de integración contra PostgreSQL e MinIO reais mediante
Testcontainers, e 267 no frontend con Jest. A cobertura do backend supera o
90% de liñas sobre o código propio.

Ademais das probas automatizadas, fixemos unha avaliación heurística
segundo as dez heurísticas de Nielsen, e unha avaliación de usabilidade con
15 usuarios reais mediante o protocolo de pensar en voz alta. Desta última
saíron melloras concretas que xa están incorporadas na aplicación: por
exemplo, o acceso directo aos documentos do día seleccionado dende o
calendario, a ordenación das viaxes por data de creación, ou a
incorporación dun mapa interactivo para escoller a localización dun
evento. As sesións continuaron ata acadar a saturación, é dicir, ata que
deixaron de xurdir problemas novos significativos.

---

## 10. CONCLUSIÓNS (17:30–18:30) · Diapo 13

Os obxectivos formulados ao inicio do traballo cumpríronse na súa
totalidade: Telaria centraliza nunha única aplicación a xestión integral
dunha viaxe en grupo, cunha arquitectura API-first que demostrou ser un
acerto ao manter sincronizados frontend e backend, e cunha execución local
do modelo de linguaxe que evita a dependencia de servizos externos de pago
e preserva a privacidade dos usuarios. A principal dificultade técnica foi
a integración de Testcontainers cun entorno de contedores sen daemon como
Podman.

---

## 11. AMPLIACIÓNS FUTURAS (18:30–19:20) · Diapo 14

Como liñas de mellora futuras destacan: a incorporación de notificacións
push, a preparación do sistema para un entorno de produción real
—externalizando segredos e habilitando HTTPS—, a integración das probas do
frontend no pipeline de integración continua, e un modo sen conexión con
sincronización posterior para mellorar a experiencia en destinos con
conectividade limitada.

---

## 12. PECHE (19:20–20:00) · Diapo 15

Isto é todo pola miña parte. Moitas grazas pola vosa atención, e quedo á
vosa disposición para calquera pregunta.