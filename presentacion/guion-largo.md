# GUIÓN DEFENSA TFG — TELARIA
# Tempo total obxectivo: 20:00 (16 diapositivas)

---

## Diapo 1 · PORTADA (0:00–0:30)

Ola, bos días. Son Jorge Otero Pailos, e veño presentar o meu Traballo de Fin
de Grao: Telaria, unha aplicación móbil colaborativa para a xestión integral
de viaxes en grupo, tutorizado por Víctor José Gallego Fontenla e Pedro
Gamallo Fernández.

---

## Diapo 2 · MOTIVACIÓN E PROBLEMA (0:30–1:45)

Telaria xurde dunha necesidade moi natural: a de organizar mellor as viaxes
en grupo. Cando se fan estas viaxes, eu mesmo, e seguro que vós tamén,
atopámonos a miúdo cun problema: ninguén sabe onde está nada, porque cada
cousa está nun sitio distinto. Ao principio mércanse os billetes, resérvase o
aloxamento, decídese que se quere visitar... pero co paso do tempo xorden as
preguntas de sempre, as que tedes aí á esquerda: quen pagou a comida de
todos? A quen lle debo cartos? Onde están os billetes de avión? É hoxe este
plan ou o outro? Pásasme as fotos que fixeches?

A raíz do problema é que cada parte da viaxe se organiza por separado, ao non
dispor dun bo mecanismo unificador. E entón a información acaba dispersa
—como se ve á dereita— entre un grupo de WhatsApp no que é imposíbel atopar
nada, o calendario de Google, o Tricount dos gastos e un SharePoint cos
documentos. No peor dos casos, pérdense datos de forma irrecuperábel.

---

## Diapo 3 · SOLUCIÓN E DIFERENCIACIÓN (1:45–3:20) [Fig. 1.1]

Telaria nace como solución: unha aplicación que integra nun só lugar todo o
que precisa unha viaxe en grupo, aforrando esforzo e previndo erros. Como se
ve no esquema da esquerda, artéllase arredor da viaxe como unidade central, e
ao seu redor despréganse sete módulos que combinan o que normalmente
usariamos en aplicacións distintas: a xestión do ciclo de vida da viaxe, os
gastos e liquidacións con cálculo automático de débedas, os eventos e o
calendario, os documentos compartidos, o chat de grupo, o asistente de
intelixencia artificial —que xa conta con todo o contexto da viaxe— e a rede
de amizades como funcionalidade complementaria.

Que a fai diferente? Xa existen ferramentas que cobren parte disto —Tricount
para os gastos, Google Calendar para as datas, WhatsApp para a comunicación—
pero ningunha o fai de xeito conxunto nin pensado especificamente para unha
viaxe en grupo. E, ademais, en Telaria non hai un "organizador": todos os
membros teñen exactamente as mesmas capacidades, o que evita atrancos e a
dependencia dunha soa persoa disposta a cargar con toda a xestión.

O obxectivo do traballo foi, polo tanto, deseñar e desenvolver unha
aplicación móbil multiplataforma que resolva esta fragmentación nun único
espazo colaborativo.

---

## Diapo 4 · REQUISITOS (3:20–4:30)

Antes de entrar no deseño, resumo os requisitos, porque son os que o
condicionan.

Recolléronse dezasete requisitos funcionais, agrupados en sete áreas: 
autenticación e conta, viaxes e membros, gastos e liquidacións, eventos, 
documentos compartidos, chat e asistente de IA, e amizades. A cada un
asignóuselle unha prioridade —alta, media ou baixa—, e esa prioridade foi a
que guiou a orde de implementación: primeiro o núcleo da viaxe e os gastos,
e xa despois os engadidos como as amizades ou o asistente.

Os non funcionais agrúpanse en sete categorías, pero quero destacar as dúas
que máis condicionaron o deseño: seguridade e privacidade. Ao ser unha
aplicación colaborativa, varios usuarios comparten datos sensibles dentro
dunha viaxe, así que o control de acceso por pertenza, o borrado real dos
datos ao eliminar a conta e a retención limitada das mensaxes non son
detalles: son requisitos que atravesan toda a arquitectura.

O resto —rendemento, usabilidade e accesibilidade, mantibilidade,
portabilidade, interoperabilidade e fiabilidade— tamén deixaron pegada, e
iranse vendo nas decisións técnicas que veñen a continuación.

---

## Diapo 5 · ARQUITECTURA XERAL (4:30–6:10) [Fig. 3.1]

Escollemos unha arquitectura cliente-servidor porque Telaria xestiona datos
compartidos entre varios usuarios en tempo real —gastos, eventos, chat— que
deben estar sempre sincronizados e consistentes para todos os membros da
viaxe. Un modelo local ou peer-to-peer complicaría moito garantir que todos
vexan a mesma información actualizada, ademais de dificultar a autorización
—verificar que só os membros da viaxe acceden aos seus datos— e a
persistencia fiábel dos documentos.

O cliente é unha aplicación móbil multiplataforma feita con React Native e
Expo. O servidor é un backend en Spring Boot apoiado en tres servizos
contenedorizados: PostgreSQL para a persistencia, MinIO como almacén de
obxectos compatible con S3 para os documentos, e Ollama como motor de
inferencia local para o asistente de intelixencia artificial. Cada un corre
no seu propio contedor, o que dá illamento entre servizos e un despregamento
reproducíbel cun só ficheiro compose.

E todo o desenvolvemento parte dun enfoque API-first: a especificación
OpenAPI é o contrato que se escribe primeiro, antes de calquera
implementación, e vincula explicitamente o frontend co backend. Precisamente
por aí empezo as decisións técnicas.

---

## Diapo 6 · DECISIÓNS TÉCNICAS 1/5 — ELECCIÓN DE TECNOLOXÍAS (6:10–7:05)

Antes de nada, vexamos a razón pola que foi escollida cada 
tecnoloxía empregada no traballo

No cliente, React Native con Expo: React é un framework moderno que permite o desenvolvemento pra iOS e Android a partir dun mesmo  código en TypeScript, e Expo simplifica moito o desenvolvemento, a
compilación e o acceso ás APIs nativas do dispositivo.

No servidor, Spring Boot, por ser un ecosistema Java maduro que nos dá
inxección de dependencias, seguridade e unha integración moi natural coa
xeración de código a partir de OpenAPI. Ademais, como pasa con Postgre, emprégase na carreira polo que xa dispoñía de coñecemento previo.

Os documentos gárdanse en MinIO, un almacén de obxectos compatible con S3 e
autohospedable, o que nos permite sacalos da base de datos e, chegado o caso,
migrar a S3 sen tocar código. E para o asistente, Ollama, que executa o modelo
de linguaxe en local: preserva a privacidade, evita custos de APIs externas e permite cambiar o modelo de maneira sinxela.

---

## Diapo 7 · DECISIÓNS TÉCNICAS 2/5 — API-FIRST CON OPENAPI (7:05–7:55)

Dende o principio o proxecto foi plantexado cun enfoque API-first, é dicir, escribindo de maneira declarativa un ficheiro de definición a partir do cal se xerarán os controladores e os DTOs. 

Conseguimos así unha única fonte de verdade entre o back e o frontend, aforramos tempo de desenvolvemento e posíbeis erros que poderían aparecer
de escribir o código a man, ademáis de documentación sempre actualizada.

---

## Diapo 8 · DECISIÓNS TÉCNICAS 3/5 — AUTENTICACIÓN (7:55–9:05)

Para a autenticación empregamos dous tokens de natureza distinta, e a
distinción non é caprichosa.

O access token, arriba, viaxa en cada petición á API: úsase constantemente.
Por iso interésanos validalo sen consultar a base de datos, e faise cun JWT
que o backend asina cunha clave privada RSA e verifica só coa sinatura. É
rápido e escalable, pero ten unha contrapartida: un JWT asinado non se pode
revocar antes de que caduque.

O refresh token, abaixo, úsase moi poucas veces —só cando caduca o access—,
así que o custo de ir á base de datos é irrelevante. Aproveitamos iso para
facelo opaco: unha cadea aleatoria gardada no servidor. E, precisamente por
estar gardada, pódese invalidar: no peche de sesión, nun cambio de contrasinal ou mesmo tras calquera uso, xerando así rotación e dificultando ataques mediante o roubo deste token.

---

## Diapo 9 · DECISIÓNS TÉCNICAS 4/5 — TEMPO REAL CON SSE: CHAT E IA (9:05–10:00)

No diagrama vese o fluxo do chat de grupo: un membro envía a mensaxe ao
servidor por unha petición normal, e o servidor difúndea ao instante ao resto
de subscritores.

Esa difusión é unidireccional, do servidor ao cliente. Por iso optamos por
Server-Sent Events en vez de WebSockets: unha conexión bidireccional aquí
sobra, e SSE simplifica moito a implementación.

E o mesmo mecanismo resólvenos a segunda necesidade de tempo real do
proxecto —a do asistente de intelixencia artificial— sen ter que introducir
unha tecnoloxía distinta. Grazas a SSE, a resposta da IA chega token a token,
a medida que o modelo a vai xerando, en vez de agardar pola resposta completa.
Iso produce o efecto de escritura progresiva ao que xa están afeitos os
usuarios de chatbots como ChatGPT, e fai que a resposta se perciba como
inmediata.

---

## Diapo 10 · DECISIÓNS TÉCNICAS 5/5 — URLS PREFIRMADAS (10:00–10:55)

Cos documentos seguimos un principio parecido: que o backend faga só o que
lle corresponde.

Cando o usuario quere subir un ficheiro, o cliente pídello ao backend, e este
devólvelle unha URL temporal e asinada contra MinIO. Coa URL na man, o
cliente sobe —ou descarga— o ficheiro directamente contra o almacén.

O importante é o que non ocorre: os bytes non pasan nunca polo backend. Iso
descarga o servidor de aplicación da transferencia e mellora notablemente a
escalabilidade.

---

## Diapo 11 · DESEÑO UI/UX E ACCESIBILIDADE (10:55–12:00) [Fig. 3.8]

No plano visual, Telaria emprega unha paleta monocromática centrada no
violeta —téndela abaixo á esquerda—, reservando o vermello exclusivamente
para as accións destrutivas: eliminar a conta, saír da viaxe. Hai tema claro
e escuro seleccionábeis polo usuario, e tipografía nativa do sistema, para
manter unha aparencia coidada sen penalizar o rendemento.

En canto á accesibilidade, a interface cumpre o limiar de contraste WCAG AA,
incorpora etiquetas e roles de accesibilidade para lectores de pantalla,
respecta a preferencia de movemento reducido do sistema operativo e amplía a
área de pulsación dos controis ao mínimo recomendado.

---

## Diapo 12 · DEMOSTRACIÓN (12:00–15:00)

*(Premer o botón e reproducir o vídeo silenciado; narrar en directo por riba)*

Aquí podedes ver un percorrido rápido pola aplicación. Primeiro, unímonos a
unha viaxe escaneando un código QR. A continuación, rexistramos un gasto e
vemos como se recalculan automaticamente os balances e a liquidación suxerida
entre membros. Despois, creamos un evento no calendario seleccionando a
localización directamente nun mapa interactivo. E por último, o asistente de
intelixencia artificial, que responde en streaming tendo en conta o contexto
da propia viaxe.

---

## Diapo 13 · PROBAS E RESULTADOS (15:00–16:45)

O proxecto conta con 677 probas automatizadas: 410 no backend con JUnit 5,
incluíndo probas de integración contra PostgreSQL e MinIO reais mediante
Testcontainers, e 267 no frontend con Jest. A cobertura do backend supera o
90% de liñas sobre o código propio.

Pero as probas automatizadas non din nada sobre se a aplicación se entende.
Por iso fixemos tamén unha avaliación heurística segundo as dez heurísticas
de Nielsen, e unha avaliación de usabilidade con 15 usuarios reais mediante o
protocolo de pensar en voz alta. As sesións continuaron ata acadar a
saturación, é dicir, ata que deixaron de xurdir problemas novos
significativos.

Desta última saíron melloras concretas que xa están incorporadas na
aplicación: o acceso directo aos documentos do día seleccionado dende o
calendario, a ordenación das viaxes por data de creación, e o mapa
interactivo para escoller a localización dun evento que acabades de ver na
demostración.

---

## Diapo 14 · CONCLUSIÓNS (16:45–17:45)

Os obxectivos formulados ao inicio do traballo cumpríronse na súa totalidade.
Telaria centraliza nunha única aplicación a xestión integral dunha viaxe en
grupo. A arquitectura API-first demostrou ser un acerto ao manter
sincronizados frontend e backend ao longo de todo o desenvolvemento. E a
execución local do modelo de linguaxe evita a dependencia de servizos
externos de pago e preserva a privacidade dos usuarios.

A principal dificultade técnica foi a integración de Testcontainers cun
entorno de contedores sen daemon como Podman.

---

## Diapo 15 · AMPLIACIÓNS FUTURAS (17:45–18:40)

Como liñas de mellora futuras destacan: a incorporación de notificacións
push; a preparación do sistema para un entorno de produción real,
externalizando segredos e habilitando HTTPS; a integración das probas do
frontend no pipeline de integración continua; e un modo sen conexión con
sincronización posterior, para mellorar a experiencia en destinos con
conectividade limitada.

---

## Diapo 16 · PECHE (18:40–19:10)

Isto é todo pola miña parte. Moitas grazas pola vosa atención, e quedo á vosa
disposición para calquera pregunta.
