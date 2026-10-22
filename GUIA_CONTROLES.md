# Guía de uso — AutoParty

Actualizada el 22 de octubre de 2026. Describe los controles disponibles en esta versión.

## Para montar una fiesta

1. Abrí **Modo Fiesta** en la cabecera.
2. Elegí **Agregar música** e importá al menos dos archivos de audio locales.
3. Pulsá **Iniciar fiesta**. La consola prepara una lista y pasa las canciones automáticamente.
4. Ajustá **Volumen de la fiesta**; **Próxima canción** inicia el pase cuando el automático está disponible.
5. **Pausar fiesta** detiene ambos decks y desactiva el automático. Al iniciar de nuevo se prepara otra sesión desde la canción cargada.
6. **Consola manual** permite intervenir. Cambiar de vista conserva los decks y la reproducción.

El automático local ordena canciones por BPM estimado. Para planificar con Gemini, el administrador configura la clave en el servidor y el invitado abre **Ver conexión IA**, ingresa el código de acceso y pulsa **Conectar y probar**. La web nunca pide la clave de Google. También se puede elegir **Usar automático local**.

**Gemini conectado · plan recibido** identifica una planificación remota exitosa; **Automático local · orden por BPM** identifica el modo local y muestra el motivo cuando falló la consulta. Configurado no significa conectado: se comprueba la respuesta del proveedor. La música se procesa en el navegador; Google recibe metadatos para ordenar el set, no archivos de audio. Ver [CONFIGURACION-IA.md](CONFIGURACION-IA.md) para claves, límites y publicación.

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

## Visuales y locutor

- El láser de la consola responde a la energía de la salida real; se apaga gradualmente con silencio o master a cero. Las ráfagas de transición son efectos adicionales.
- Importá videos en la biblioteca VJ y elegí el activo. **Abrir TV / proyector** abre la pantalla audiovisual; **FLOAT PIP** depende del soporte del navegador y de un video cargado.
- El proyector toma la selección actual y se actualiza al eliminar videos. Los láseres del proyector todavía son animaciones decorativas.
- **DJ MC** usa Google TTS para frases y texto de hasta 400 caracteres. Requiere el código de acceso de IA; funciona también con la fiesta en AUTO LOCAL. Elegí Charon, Fenrir o Kore y estilo asistente, radio o fiesta. **Probar voz de Google** reproduce un saludo.
- El panel distingue generación y reproducción; **Detener anuncio** cancela la solicitud o detiene la voz. Cerrar el panel también la detiene. Un fallo se muestra sin sustituir la voz por Web Speech. Se reutilizan las últimas ocho frases en memoria de la pestaña (máximo 8 MB); una recarga borra esa caché.
- La música se atenúa solo al comenzar la voz, recupera su nivel al terminar y conserva los cambios manuales del master. Un anuncio en curso bloquea otro anuncio simultáneo.
- La voz de Google pasa por el master y forma parte de la grabación WAV del motor. El módulo previo de Voicebox/Web Speech se conserva en código, pero DJ MC no lo usa automáticamente.

## Límites de la verificación

Se probaron archivos sintéticos y navegadores aislados. Queda pendiente escuchar música real, validar Voicebox instalado, interfaces de audio, proyector físico, Safari/iOS y sesiones largas. La grabación aún usa ScriptProcessor y memoria. No se realizó un despliegue.
