# Guía de uso — AutoParty

Actualizada el 22 de octubre de 2026. Describe los controles disponibles en esta versión.

## Para montar una fiesta

1. Abrí **Modo Fiesta** en la cabecera.
2. Elegí **Agregar música** e importá al menos dos archivos de audio locales.
3. Pulsá **Iniciar fiesta**. La consola prepara una lista y pasa las canciones automáticamente.
4. Ajustá **Volumen de la fiesta**; **Próxima canción** inicia el pase cuando el automático está disponible.
5. **Pausar fiesta** detiene ambos decks y desactiva el automático. Al iniciar de nuevo se prepara otra sesión desde la canción cargada.
6. **Consola manual** permite intervenir. Cambiar de vista conserva los decks y la reproducción.

El automático local ordena canciones por BPM estimado. Para planificar con Groq, el administrador configura la clave en el servidor y el invitado abre **View AI connection**, ingresa el código de acceso y pulsa **Connect and test**. La web nunca pide la clave de Groq. También se puede elegir **Use local Auto-DJ**.

**Groq connected · plan received** identifica una planificación remota exitosa; **Local Auto-DJ · sorted by BPM** identifica el modo local y muestra el motivo cuando falló la consulta. Configurado no significa conectado: se comprueba la respuesta del proveedor. La música se procesa en el navegador; Groq recibe metadatos para ordenar el set, no archivos de audio. Ver [CONFIGURACION-IA.md](CONFIGURACION-IA.md) para claves, límites y publicación.

El motor ejecuta fundidos y cortes. No detecta frases musicales ni sincroniza la fase de los beats. La lista es finita: al llegar al final, la sesión termina. Cancelar el análisis mantiene la canción que ya estaba sonando.

## Biblioteca y análisis

- **Library** abre o cierra la biblioteca. Importá tus propios archivos y cargalos en A o B.
- **Reanalizar BPM** vuelve a analizar los archivos guardados sin borrar música, cues, loops ni videos. Recargá los decks para que reciban el BPM actualizado.
- Un BPM desconocido se muestra como **—**. Las estimaciones pueden necesitar revisión, especialmente con música de ritmo variable.
- Las ondas muestran los peaks del archivo real y avanzan con el reloj del audio. La rejilla por BPM es aproximada. Se guardan una vista general de hasta 800 puntos y otra detallada de 100 puntos por segundo (máximo 120.000). Las canciones antiguas actualizan su onda al cargarse sin perder cues ni loops.

## Consola manual

En escritorio, platos y faders se ajustan al ancho y alto disponibles sin scroll dentro del área de instrumentos. Cuando la ventana es demasiado baja, se desplaza la consola completa para mantener todos los controles accesibles. La biblioteca puede seguir abierta al reducir la ventana.

| Control | Acción real |
|---|---|
| PLAY / PAUSE | Reproduce o pausa el deck. |
| GUARDAR CUE | Guarda la posición actual como CUE y pausa. |
| CUE | Vuelve al CUE y pausa; vuelve al inicio si no hay CUE. |
| BPM = | Intenta igualar el BPM del otro deck dentro del rango de tempo. No alinea los golpes. |
| TEMPO | Cambia velocidad y tonalidad, hasta ±16 %. |
| Plato | Permite ajustar temporalmente la velocidad; al soltar recupera el tempo elegido. |
| HOT CUE | Guarda o recupera posiciones; Shift + pad borra el punto. |
| LOOP | Repite 0.5, 1, 2, 4, 8, 16 o 32 beats. El último pad sale del loop. |
| SAMPLER | Dispara los efectos de sonido disponibles. |
| GAIN / CH A / CH B | Ajustan entrada y volumen de cada canal. |
| HI / MID / LOW | Ecualizan agudos, medios y graves. |
| FILTER | Corta agudos a la izquierda, graves a la derecha; centro desactivado. |
| MST | Ajusta el volumen general del público. |
| CROSSFADER | Mezcla entre A y B. |
| AUTO A / AUTO B | Programa un fundido hacia ese deck en el reloj del audio. Hay que cargar e iniciar la canción de destino. |
| 2s / 4s / 8s / 16s | Ajusta la duración nominal del pase completo. |
| SMART EQ | Automatiza EQ durante el pase. Desactivado, conserva el EQ manual. |
| CUT / LIN / CRV | Selecciona la curva del crossfader. |
| CUE A / CUE B, PFL, CUE VOL | Seleccionan y ajustan la escucha previa. Requiere una salida de auriculares elegida en Ajustes. |
| BOOTH | Ajusta el retorno cuando se selecciona una salida física independiente. |
| REC | Graba la mezcla y descarga WAV al detenerla. |

KEY LOCK, Quantize, Beat FX, ROLL, SLICER y BEAT JUMP no se ofrecen como funciones terminadas. Los cambios de tempo alteran la tonalidad.

## Visuales

- El láser de la consola responde a la energía de la salida real; se apaga gradualmente con silencio o master a cero. Las ráfagas de transición son efectos adicionales.
- Importá videos en la biblioteca VJ y elegí el activo. **Abrir TV / proyector** abre la pantalla audiovisual; **FLOAT PIP** depende del soporte del navegador y de un video cargado.
- El proyector toma la selección actual y se actualiza al eliminar videos. Los láseres del proyector todavía son animaciones decorativas.

## Límites de la verificación

Se probaron archivos sintéticos y navegadores aislados. Queda pendiente escuchar música real, interfaces de audio, proyector físico, Safari/iOS y sesiones largas. La grabación aún usa ScriptProcessor y memoria. No se realizó un despliegue.

## Bloques y cola compartida

En Party mode, Musical block permite crear y guardar bloques con nombre y canciones elegidas manualmente. Una canción puede estar en varios bloques. All music utiliza todo el catálogo; buscar en Library no cambia el catálogo del Auto-DJ. La pertenencia al bloque es explícita: no hay detección automática de género o energía. Cambiar un bloque conserva el tema actual y los pedidos del DJ; Groq reordena las canciones elegibles sin detener la reproducción. Si falla o la respuesta queda obsoleta, se conserva el orden local seguro. Los bloques no cambian solos ni repiten automáticamente los temas ya escuchados.

Con Auto-DJ activo, Play next y Add to queue están en cada canción de Library. Los pedidos se identifican en Up next; Next los pone primero y × los retira. Un pedido puede salir del bloque elegido. La canción actual no se reinicia y no se duplica una canción en la cola pendiente. Durante una transición ya iniciada, la edición espera a que termine.

Intervenir en un deck, buscar una posición o mover el crossfader suspende la automatización. Resume Auto-DJ adopta el tema audible; para evitar saltos de volumen, primero se termina la mezcla manual llevando el crossfader al extremo del tema que se quiere conservar. Detener Auto-DJ no detiene la música.

Las transiciones usan el final audible y preparan el siguiente archivo sin reproducirlo. El análisis detecta únicamente silencios sostenidos en los extremos y verifica todos los canales: no detecta voces, estribillos, frases ni beatgrid. Tempos cercanos usan un fundido de hasta 8 segundos; diferencias grandes o tempos desconocidos usan uno breve. Drops queda apagado por defecto. Los loops guardados no se activan al cargar automáticamente el siguiente tema.

## Acceso inferior a la biblioteca

Media library permanece visible abajo. Se abre con un clic, teclado o arrastre hacia arriba. El botón Library del encabezado sigue disponible. La pestaña ocupa su propio espacio para no cubrir controles ni pads; al cerrar, el foco regresa al acceso que la abrió.

## Efectos de transición

Party mode → Transition effects (o Settings → Auto-DJ) permite elegir Auto, Off, Next · Filter sweep o Next · Echo out. Auto acepta únicamente propuestas validadas de Groq y deja al menos tres transiciones y 45 segundos entre efectos. En modo local, Auto conserva fundidos simples; el DJ puede pedir un preset manual. Off se guarda como preferencia y se restaura con Reset preferences. Los presets Next se consumen una vez y vuelven a la preferencia Auto/Off anterior.

Filter sweep aplica un pasa-altos suave en la salida de la canción y recupera el valor neutro. Echo out usa una salida breve y un delay de medio beat calculado con BPM estimado; requiere un tempo válido de 60–200 BPM y no implica cuantización ni beatgrid. El motor limita send, volumen y feedback, y desvanece la cola. Un dato inválido o un efecto no disponible conserva el fundido simple. Cancel effect permite quitar el efecto sin parar la música.

Intervenir en transporte, crossfader, EQ, filtro, ganancia o volumen cancela los efectos automatizados. Los medidores VU no los cancelan. La IA solo propone identificadores de acciones permitidas: la app valida y el motor ejecuta con AudioContext. Playwright no participa de la fiesta; se utiliza para verificar la interfaz y el audio en pruebas.
