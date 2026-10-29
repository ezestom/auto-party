# AutoParty — Brief para mejorar la web de bienvenida

Fecha de revisión: 25 de octubre de 2026.

Este documento es autocontenido: se puede copiar completo y pegar en la IA del proyecto de la web. Las instrucciones siguientes expresan el trabajo propuesto para ese proyecto; no implican que ya se hayan implementado cambios.

## 0. Cómo usar este brief en el otro proyecto

Abrí el proyecto de la web de presentación y adjuntá este archivo o pegá su contenido completo. No alcanza con indicar su ruta si esa IA no tiene acceso a esta carpeta. Adjuntá también la captura de referencia si está disponible: este Markdown no contiene la imagen.

Mensaje de inicio sugerido para esa IA:

> Trabajá sobre la web de presentación existente siguiendo el brief adjunto. Primero inspeccioná el proyecto y reproducí el error de scroll. Después implementá la corrección, actualizá contenido y navegación con las funciones reales de AutoParty y conservá el estilo y los efectos existentes. Todo el contenido visible debe estar en inglés. La aplicación del mixer está en https://freeautoparty.vercel.app/ y pertenece a otro proyecto. Usá la guía escrita de primeros pasos hasta que haya videos reales. Comprobá el resultado en escritorio y móvil, y entregá los cambios realizados con evidencia y las limitaciones encontradas.

Este es un brief de producto e implementación: reúne funciones, límites, contenido propuesto y criterios de aceptación. El diagnóstico técnico del scroll y los cambios de la landing se realizan en el proyecto que contiene esa web.

## 1. Encargo para la IA del proyecto web

Mejorá la web existente que presenta AutoParty. Debe ser la bienvenida a la aplicación: explicar qué hace, ayudar a empezar y ofrecer un acceso claro al mixer. Conservá el estilo visual de la web actual y de la captura de referencia: fondo oscuro, trama hexagonal, iluminación de colores, profundidad, efectos gráficos y protagonismo de la consola.

La aplicación en prueba está en https://freeautoparty.vercel.app/ . La web de presentación pertenece a otro proyecto. No cambies la aplicación del mixer como parte de este encargo.

Todo el texto visible del producto debe estar en inglés, incluidos navegación, botones, ayudas, accesibilidad, errores y estados vacíos. Este brief está en español para facilitar el trabajo.

Antes de editar, revisá la implementación existente, sus instrucciones y sus dependencias. Si usa Next.js y tiene documentación local en `node_modules/next/dist/docs/`, leé las guías relevantes de la versión instalada.

Objetivos, en orden:

1. Corregir el error de scroll reportado en la web y verificarlo en escritorio y móvil.
2. Reemplazar promesas no respaldadas por contenido real de AutoParty.
3. Ordenar la página como un recorrido de bienvenida y primeros pasos.
4. Hacer funcionales sus enlaces, navegación y preguntas frecuentes.
5. Dejar una estructura preparada para incorporar videos y explicaciones reales posteriormente.

## 2. Qué es AutoParty

AutoParty es una aplicación web para reproducir y mezclar archivos de música del usuario. Combina una consola manual de dos decks con un modo fiesta que organiza la reproducción y realiza transiciones automáticas. Permite crear temáticas, planificar etapas de una fiesta y acompañarla con videos en una ventana de TV o proyector.

La propuesta recomendada es: **tu música, una fiesta que fluye y la posibilidad de tomar el control cuando quieras**.

El recorrido principal debe hablarle primero a quien quiere poner música en una reunión sin operar constantemente una consola. Después puede mostrar las herramientas para quien quiere mezclar manualmente. Esta prioridad es una propuesta editorial, no una conclusión de investigación con usuarios.

Identidad verificada:

- Nombre actual: **AutoParty**.
- Lema existente: **Your music. Party on.**
- La app muestra **FREE**; no se encontró un sistema de planes o cobros en el código revisado. No convertir esto en una garantía de gratuidad permanente ni de IA ilimitada.
- Colores reconocibles de la consola: naranja para el deck A y cian para el B, con fondo casi negro.
- La captura de la landing usa **DJ Pulse AI**, un nombre que no coincide con la app actual. Unificar la web bajo AutoParty.

## 3. Qué se verificó y con qué alcance

La versión recibida de este brief registra una revisión del código local y de la interfaz publicada: consola de dos decks, Library, Party mode, AI DJ, Visuals, REC y Settings. También registra que Party mode mostró **AI not configured**, biblioteca vacía y las secciones de temáticas, programa y efectos. Estas son observaciones de esa revisión previa, no una nueva comprobación del despliegue.

En la revisión de traspaso se contrastaron README, componentes de consola y biblioteca, almacenamiento y flujo de planificación con Groq. La herramienta de consulta web no pudo acceder a la URL pública; esto no demuestra que la app esté caída. Volver a comprobar el estado de la IA y la interfaz publicada antes de usarlos como evidencia actual.

La presencia y lógica de las capacidades detalladas abajo se sustentan en el código. Esta revisión no incluyó importar canciones, escuchar mezclas, grabar audio, probar dispositivos físicos ni conectar Groq. Tampoco demuestra que el despliegue coincida en todos los detalles con el checkout local.

El brief recibido describe una captura como referencia visual de la web existente. Esa imagen no está adjunta a este documento ni fue aportada en este traspaso. No se proporcionó el código ni la URL de esa landing, por lo que el error de scroll está reportado por el usuario y todavía no tiene una causa diagnosticada. Las referencias a hexágonos, perspectiva y textos de la captura provienen del brief previo y deben cotejarse con la imagen o la web real.

## 4. Capacidades reales que se pueden comunicar

| Capacidad | Qué hace | Límite para el contenido |
| --- | --- | --- |
| Música propia | Importa archivos locales; biblioteca con búsqueda y ordenamiento. | No incluye un catálogo de canciones ni una integración verificada con Spotify o YouTube. |
| Biblioteca local | Guarda audio, videos y datos asociados en almacenamiento del navegador. | No prometer sincronización entre dispositivos ni copias de seguridad en la nube. Borrar datos del sitio puede eliminar la biblioteca. |
| Auto-DJ local | Ordena por BPM estimado y ejecuta transiciones automáticamente. | Funciona sin cuenta ni configuración de IA; no equivale a una IA que escucha y comprende la música. |
| Temáticas | El usuario crea grupos, asigna canciones e importa a la temática elegida. | No detecta automáticamente géneros, estados de ánimo ni energía. |
| Cambio de temática | Puede preparar otra temática para después de la canción actual. | Navegar una pestaña de la biblioteca no cambia por sí solo lo que está sonando. |
| Party programme | Ordena etapas por temática y minutos aproximados; puede repetir canciones para cubrir cada etapa. | Los cambios respetan el final de canción; no es una programación al segundo. La última temática continúa. |
| Cola del DJ | Permite agregar pedidos desde la biblioteca, priorizar el próximo tema y retirar pendientes. | Son acciones del operador; no hay una sala pública de pedidos de invitados verificada. |
| Control manual | Dos decks, crossfader, curvas, EQ de tres bandas, filtros, ganancia, volumen, tempo, CUE, hot cues, loops y sampler. | No prometer scratch terminado ni herramientas profesionales que no estén implementadas. |
| Intervención del DJ | La automatización cede ante ciertos controles manuales y ofrece reanudación. | No describirla como un sistema autónomo infalible. |
| BPM y ondas | Estima BPM y dibuja formas de onda a partir del audio real. | BPM aproximado; no hay detección completa de tonalidad, beatgrid preciso o sincronía de fase. |
| Transiciones y efectos | Fundidos; Smart EQ en pases; presets limitados Filter sweep y Echo out. | No vender una suite general de Beat FX. Los efectos automáticos de Groq dependen de validaciones; el modo local conserva fundidos simples salvo preset manual. |
| Grabación | REC permite detener y descargar una mezcla en WAV estéreo. | No prometer MP3, almacenamiento en la nube o duración ilimitada. |
| Visuals | Videos locales, vista previa del DJ y ventana de TV/proyector con reproducción compartida. | No equivale a emitir una fiesta por Internet. Requiere permitir la ventana emergente. |
| Salidas de audio | Monitoreo de auriculares y booth con dispositivos separados cuando el navegador lo admite. | Compatibilidad y hardware condicionan la función; no afirmar soporte universal. |
| Diseño adaptable | Consola completa en pantallas amplias y pestañas A/Mixer/B en móvil vertical. | No afirmar compatibilidad probada con todos los móviles o navegadores. |
| Planificación con Groq | Puede proponer orden y transiciones mediante una API del servidor. | Opcional; requiere configuración del administrador y código de acceso de beta. En la revisión pública figuró sin configurar. |

Para enseñar transiciones en primeros pasos, recomendar importar al menos dos canciones. No presentar ese número como una restricción universal de importación.

### Música local y planificación remota

El motor de mezcla procesa el audio en el navegador. Cuando se utiliza Groq, se envían metadatos de canciones —como título, artista, BPM, tonalidad disponible y duración— para preparar un plan; no se envían archivos de audio en ese flujo. La tonalidad desconocida no debe presentarse como detectada.

La web puede decir **“Your audio is processed in your browser.”** No debe decir **“Nothing ever leaves your device”**, porque el modo remoto sí utiliza metadatos. Tampoco prometer funcionamiento offline completo: no fue verificado.

## 5. Promesas que hay que retirar o corregir

En la captura aparecen mensajes que no representan la versión revisada:

| Texto o elemento | Acción recomendada |
| --- | --- |
| DJ Pulse AI | Cambiar por AutoParty. |
| Real-time stem isolation / AI Stems | Retirar: no hay separación de voces e instrumentos implementada. |
| Intelligent harmonic beatmatching | Reemplazar por automatic transitions y estimated BPM. Igualar BPM no alinea la fase; cambiar tempo también cambia tonalidad. |
| Live party streaming / Party Rooms | Retirar: Visuals abre otra pantalla local, no una sala de streaming. |
| Sign in | Retirar como acceso general: no hay cuentas de usuario verificadas. El código de beta de Groq es un flujo diferente. |
| Pricing | Retirar mientras no existan planes reales definidos. |
| Create your party | Evitar si sugiere crear una sala o sesión compartida. Usar Open AutoParty. |
| AI voice host / DJ MC | No anunciar: la función de voz está retirada de la interfaz y su endpoint tiene una prueba que espera 404. |

El `app/layout.tsx` local todavía menciona un **AI voice host** en la descripción SEO. Es un texto desactualizado, no evidencia de una función vigente. Hay documentos históricos con otros nombres y estados anteriores; no copiarlos como estado actual.

No inventar testimonios, usuarios activos, partners, premios, rendimiento, garantías de mezcla perfecta, estadísticas, detección de género ni planes comerciales.

## 6. Estructura recomendada y copy inicial en inglés

### Navegación

**AutoParty** · **How it works** · **Features** · **FAQ** · **Open AutoParty**

Las secciones deben tener anclas reales. No mostrar un enlace Tutorials vacío; incorporarlo cuando exista contenido útil.

### Hero

Eyebrow: **Your music. Party on.**

Headline: **Your music. Automatically mixed.**

Description: **Bring your own tracks, organize your party into themes, and let AutoParty handle the transitions. Take control with the two-deck mixer whenever you want.**

Primary CTA: **Open AutoParty** → `https://freeautoparty.vercel.app/`

Secondary CTA: **See how it works** → sección de primeros pasos.

Supporting line: **Runs in your browser · Bring your own music · No account needed for local Auto-DJ**

Usar una captura actual y legible de la app como pieza principal. Si se mantiene la perspectiva inclinada, dejar otra imagen frontal en una sección posterior. Una captura es una vista previa estática: no dibujar controles que parezcan interactivos sin serlo.

### How it works

1. **Add your music** — Import songs from your device into your local library.
2. **Choose your themes** — Group your tracks and optionally build a party programme.
3. **Start the party** — Open Party mode, press Start party, and let AutoParty handle the transitions.

Nota breve: **Bring at least two songs to try automatic transitions.**

### Dos maneras de usar la app

**Let the party flow** — Start local Auto-DJ, manage what plays next, and move between your music themes.

**Take the decks** — Mix manually with two decks, EQ, filters, loops, hot cues, and a crossfader.

Mostrar ambas como formas de uso dentro de la misma app, sin crear dos productos o enlaces a rutas inexistentes.

### Función destacada: el recorrido musical

Heading: **Give every part of your party its own sound.**

Body: **Create your own themes and arrange them into a party programme. Set approximate durations, let songs finish naturally, and switch themes when you are ready.**

Se puede usar un ejemplo visual: **Warm-up → Dance floor → Late night**. Etiquetarlo como ejemplo de temáticas creadas por el usuario, no como presets o detección automática de género. Si se agregan minutos, deben ser ilustrativos.

### Funciones complementarias

- **Shape the next song** — Add tracks to the queue and choose what plays next.
- **Bring visuals to a bigger screen** — Import videos and open the TV / projector window while keeping a DJ preview.
- **Save your mix** — Record your session and download a stereo WAV file.
- **Optional AI planning** — Groq can suggest track order and transitions when configured. Local Auto-DJ works without it.

La IA opcional debe ser secundaria mientras no esté configurada en el despliegue. No usar un indicador ficticio de AI connected en la landing.

### FAQ con respuestas reales

**Do I need an account?**
No account is needed for local Auto-DJ. Optional Groq planning requires a beta access code and server configuration.

**Does AutoParty include music?**
No. Import your own music files from your device.

**Where is my library stored?**
Your library is stored in this browser on this device. It does not automatically sync across devices, and clearing site data can remove it.

**What does the AI do?**
When configured, Groq suggests track order and transitions using song metadata. The browser handles audio playback and mixing. Local Auto-DJ can organize tracks by estimated BPM without Groq.

**Can I mix manually?**
Yes. Use the two-deck console and its mixer controls. Auto-DJ can be resumed after manual control.

**Can I use a TV or projector?**
Yes. Import videos and use Visuals to open the TV / projector window. Allow the popup when prompted.

**Which files can I import?**
Import local audio and video files. Playback depends on the formats and codecs supported by your browser.

**Does it separate vocals or stream party rooms?**
No. Stem separation and online party rooms are not available in the current version.

### Cierre

Heading: **Your next party starts with your own music.**

CTA: **Open AutoParty**.

Footer sencillo con marca y enlaces existentes. No inventar contacto, redes, términos legales o políticas publicadas.

## 7. Funcionalidades de la web de bienvenida

Implementar primero:

- Un CTA principal consistente y repetido en puntos útiles.
- Navegación por anclas y menú móvil accesible.
- FAQ con teclado, estados abiertos/cerrados y foco visible.
- Sección de primeros pasos útil antes de disponer de videos.
- Capturas reales con textos alternativos; confirmar los assets disponibles en el otro proyecto.
- Metadatos SEO y Open Graph coherentes con las capacidades actuales. No reutilizar la promesa de voz del metadata antiguo.

Preparar para después:

- Una colección de tutoriales que admita título, descripción, duración real, poster, fuente y subtítulos/transcripción.
- Temas sugeridos: importar música; crear temáticas y programa; iniciar Auto-DJ; intervenir manualmente; abrir proyector; grabar una mezcla.
- No renderizar botones Play sin video, duraciones inventadas, reproductores vacíos o videos ajenos como si fueran del producto. Hasta tener material, mantener la guía escrita.

No es necesario integrar una consola funcional dentro de la landing. Eso duplicaría audio, estado y almacenamiento; una captura y un acceso claro cumplen el objetivo de bienvenida.

## 8. Estilo, efectos y corrección del scroll

Conservar el diseño existente. La referencia tiene una buena base visual para el producto: superficie oscura, hexágonos, halos de color, tipografía de gran tamaño y una consola naranja/cian. Mejorar jerarquía, legibilidad y contenido sin reemplazarla por una plantilla genérica.

El usuario menciona efectos de “canva ui”; verificar en el proyecto si se trata de Canvas, WebGL o una biblioteca concreta antes de cambiar tecnología. La captura sola no permite identificar la implementación.

El bug de scroll debe reproducirse antes de corregirlo. Inspeccionar como posibles causas, sin darlas por confirmadas:

- `overflow: hidden` global o bloqueos de scroll que no se restauran al cerrar menús.
- Un wrapper limitado a `100vh` con contenido mayor y sin desplazamiento.
- Canvas o capas fijas que capturan eventos de rueda o táctiles.
- `preventDefault`, listeners de wheel/touch y librerías de smooth scroll.
- Anchos y transformaciones 3D que generan desbordamiento horizontal.
- Scroll interno innecesario en contenedores de la landing.

Preferir desplazamiento vertical nativo del documento salvo una necesidad concreta. Las capas decorativas no deben bloquear controles ni gestos. Mantener el fondo dentro del viewport sin limitar artificialmente la altura del contenido.

Respetar `prefers-reduced-motion`, reducir el trabajo gráfico en móvil y pausar animaciones innecesarias cuando la pestaña no sea visible. Los efectos no deben retrasar el acceso al CTA o la lectura.

Verificar al menos en 390×844, 844×390, 1024×768 y 1440×900: llegar al footer, volver arriba, usar anclas, abrir/cerrar el menú y FAQ, navegar con teclado y confirmar que no haya desbordamiento horizontal. Comprobar además la página con zoom y movimiento reducido. Registrar navegador y resultado real; no declarar soporte universal.

## 9. Criterios de aceptación

- La marca visible y el contenido usan AutoParty.
- Un visitante entiende qué hace, que necesita sus archivos y cómo empezar.
- Todos los CTA abren la app o una sección real; no existen botones simulados ni rutas inventadas para Party mode.
- La landing presenta funciones implementadas con sus condiciones relevantes.
- No quedan promesas de stems, beatmatching armónico preciso, voz, salas online o streaming.
- La planificación remota aparece como opcional y condicionada a configuración.
- El estilo de la referencia y los efectos se conservan con buena legibilidad.
- El scroll funciona de principio a fin y después de cerrar menús en las pantallas verificadas.
- La guía escrita funciona hoy; los videos solo aparecen cuando existen assets reales.
- Todo el contenido del producto, incluidos nombres accesibles, está en inglés.

Al terminar, entregar resumen de cambios, evidencia visual y resultados reales de las verificaciones. Señalar cualquier bloqueo o información pendiente sin sustituirlo por contenido inventado.

## 10. Fuentes de la revisión, para trazabilidad

Las rutas siguientes pertenecen al proyecto de la app, no necesariamente al proyecto de la landing:

- `README.md`: panorama actual y límites.
- `components/console/DJConsole.tsx`: cabecera, modos, grabación e integración general.
- `components/console/PartyPanel.tsx`: primeros pasos, estado de IA, cola y modo fiesta.
- `components/console/PartyProgram.tsx`, `stores/partyProgramStore.ts`, `lib/ai/partyProgram.ts`: programa y persistencia local.
- `components/library/ThemeTabs.tsx`, `stores/partyBlockStore.ts`: temáticas y cambio posterior a la canción.
- `stores/libraryStore.ts`, `lib/db/dexie.ts`, `lib/library/mediaFiles.ts`: importación, almacenamiento y análisis.
- `stores/aiDJStore.ts`, `lib/ai/contract.ts`, `lib/ai/transitionEffects.ts`: automatización, orden local y efectos permitidos.
- `components/ai/APIKeyModal.tsx`, `lib/ai/aiClient.ts`, `lib/server/ai/provider.ts`: conexión opcional y planificación remota.
- `components/settings/SettingsModal.tsx`, `components/settings/AudioOutputs.tsx`: ajustes y salidas condicionadas al navegador.
- `components/vj/VJMiniPlayer.tsx`, `components/vj/VJDisplay.tsx`, `app/vj/page.tsx`: visuales y pantalla adicional.
- `e2e/voice-retired.spec.ts`: retirada de voz; archivo revisado, prueba no ejecutada en este encargo.
- `app/layout.tsx`: nombre actual y metadata con referencia desactualizada a voz.
- Interfaz pública: https://freeautoparty.vercel.app/ . El brief recibido registra una consulta el 25 de octubre de 2026; el nuevo intento de consulta durante el traspaso no permitió acceder mediante la herramienta web.

`GUIA_CONTROLES.md`, `MEJORAS-ESTADO.md` y las especificaciones históricas aportan contexto, pero contienen estados anteriores. Si discrepan con la implementación vigente, revisar el código y comprobar el comportamiento antes de publicar una afirmación.
