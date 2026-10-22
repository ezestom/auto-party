# Configurar la IA de AutoParty

## En tu computadora

1. Ejecutar `npm run setup:ai` una vez. Prepara `.env.local`, genera un código de acceso y un secreto de sesión si faltan y quita la antigua variable pública. No imprime claves ni cambia secretos privados ya completados.
2. Abrir `.env.local` en la raíz de la consola y completar **GEMINI_API_KEY** con una clave nueva de Google AI Studio. No usar `NEXT_PUBLIC_` ni colocar claves en componentes, navegador o chat. Una clave de tipo `AQ.` se admite sin modificarla.
3. El archivo ya contiene **AI_ACCESS_CODE** y **AI_SESSION_SECRET** generados. El primero es el código que se ingresa en la web; el segundo no se comparte. Si copiás manualmente `.env.example`, generarlos con `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` y elegir un código de acceso largo.
4. Mantener `AI_ALLOWED_ORIGINS=http://localhost:3000` para desarrollo. Iniciar o reiniciar con `npm run dev`. Si usás `npm start`, es producción: aplican sus requisitos completos, incluido HTTPS/Redis; para probar localmente sin Redis usá `npm run dev`.
5. En **Modo Fiesta → Ver conexión IA**, ingresar el código de acceso y pulsar **Conectar y probar**. Solo una respuesta válida de Google muestra **Gemini conectado**. La prueba consume una petición del cupo y una pequeña generación de Google.
6. Agregar al menos dos canciones e iniciar fiesta. **Gemini conectado · plan recibido** confirma planificación remota. Si falla, aparece **Automático local · orden por BPM** junto al motivo. El audio no se interrumpe.

`.env.local` tiene precedencia sobre `.env`: pegá la clave en el archivo indicado. Cambiar variables requiere reiniciar el servidor. `.env.example` es una plantilla sin secretos.

## Publicación en internet

El hosting debe ejecutar Next.js con Node, por ejemplo `next build` y `next start`, o un adaptador compatible que admita Route Handlers. Una exportación HTML estática no ejecuta esta API. La landing y la consola son carpetas distintas: configurar estas variables en el despliegue de la consola.

Configurar como secretos del hosting, sin prefijo público:

| Variable | Valor |
|---|---|
| `GEMINI_API_KEY` | Clave nueva de Google AI Studio |
| `GEMINI_MODEL` | Modelo habilitado para tu proyecto; default `gemini-3.8-flash` |
| `GEMINI_TTS_MODEL` | Modelo del locutor; default `gemini-3.8-flash-tts`. También admite `gemini-3.8-flash-lite-tts` |
| `AI_ACCESS_CODE` | Código largo para invitados de la beta |
| `AI_SESSION_SECRET` | Secreto aleatorio de al menos 32 caracteres, igual en todas las instancias |
| `AI_ALLOWED_ORIGINS` | Origen HTTPS exacto: `https://tu-dominio.com`, sin ruta ni barra final. Separar varios por comas |
| `AI_DAILY_REQUEST_LIMIT` | Máximo global de peticiones a Gemini por día UTC, default 100 |
| `AI_SESSION_HOURLY_LIMIT` | Máximo por sesión y hora UTC, default 6 |
| `UPSTASH_REDIS_REST_URL` | Endpoint REST HTTPS de tu base Redis Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Token de escritura de esa base |

No se creó ninguna cuenta Redis ni se contrató un servicio. Crear/configurar la base con el proveedor antes de publicar IA. Sin Redis o con configuración incompleta, producción rechaza las llamadas a Google y conserva el automático local. No hay bypass de memoria en producción.

Usar una base dedicada para esta aplicación. Todos los despliegues que compartan esa base compartirán la cuota global. Las operaciones de Redis también tienen cuotas propias del proveedor; revisar el plan elegido. Los contadores guardan identificadores aleatorios, cantidades y expiraciones, no música, títulos ni claves.

La cuota de esta aplicación limita solicitudes, no dinero. Cada prueba/generación fallida que llegó al proveedor consume una solicitud local. Ajustar también los límites/cuotas de Google y su facturación. El límite global diario impide que abrir sesiones nuevas evada ese máximo. El acceso tiene un máximo global de 30 intentos por ventana de 15 minutos; su agotamiento puede bloquear temporalmente a otros invitados.

## Sesión y privacidad

- El sitio y el mezclador son públicos. Solo las consultas de IA requieren el código compartido; no son cuentas individuales ni un sistema de cobro.
- La cookie de IA dura 8 horas: HttpOnly, SameSite=Strict y Secure en producción. Cerrar sesión la elimina del navegador. Rotar `AI_SESSION_SECRET` invalida todas las sesiones.
- Google recibe únicamente metadatos de las canciones al planificar: título, artista, BPM, tonalidad y duración. No se suben audio, ondas, videos ni claves de bases locales. Los IDs se sustituyen por alias temporales.
- No se guarda la clave de Google en localStorage ni se entrega al cliente. La app borra la entrada antigua del navegador al montar. Reconstruir y retirar artefactos antiguos que hubieran incluido una clave pública y reemplazar esa clave antes de publicar.
- Configurado no equivale a conectado: el estado conectado exige una prueba o planificación exitosa. Si el proveedor falla, el plan local se identifica explícitamente.

## Errores visibles

### Voz de Google en DJ MC

DJ MC consulta el modelo TTS separado de la planificación. La clave y el código de acceso existentes sirven para ambos; no se necesita otra clave. Ingresar el código en **Ver conexión IA** y abrir **DJ MC**. Una falla del modelo de texto no demuestra que el modelo de voz también falle. **Probar voz de Google** genera y reproduce una muestra; no depende del botón de prueba de planificación.

Elegir Charon, Fenrir o Kore, y estilo asistente cinematográfico, radio o fiesta. La personalidad es una dirección de locución sobre voces de Google; no reproduce una voz de personaje exacta. Texto máximo 400 caracteres, audio máximo 45 segundos y 3 MB. Texto enviado a Google para síntesis, música permanece local. La voz vuelve como WAV y pasa por el master, incluida la grabación. No se cambia automáticamente a la voz del navegador.

**Detener anuncio** o cerrar el panel cancela la espera/detiene la reproducción y recupera el nivel de música. Google puede haber consumido cuota aunque se cancele. La caché es local a la pestaña: ocho frases recientes, máximo 8 MB, borrada al recargar. Cambiar texto, voz o estilo genera otra consulta. No se guarda texto/audio en Redis ni en el servidor.

Las consultas de voz comparten los límites diarios y por sesión existentes con los planes y las pruebas. El hosting debe permitir solicitudes de hasta 60 segundos; el proveedor tiene timeout de 40 segundos. Google publica un nivel gratuito para este modelo, sujeto a los límites del proyecto. Si el proyecto tiene facturación habilitada, rigen sus tarifas; el código no detecta el nivel de facturación ni activa servicios pagos. Consultar https://ai.google.dev/gemini-api/docs/pricing. No es voz ilimitada gratis.

### Mensajes de la API

`NOT_CONFIGURED`: faltan variables válidas o protección de producción. `ACCESS_REQUIRED`/`INVALID_ACCESS_CODE`: ingresar código/reabrir sesión. `PROVIDER_AUTH`: revisar clave y permisos de Google. `MODEL_UNAVAILABLE`: revisar modelo. `PROVIDER_QUOTA`: revisar cuota del proveedor. `LIMIT_REACHED`: esperar la ventana indicada. `LIMITS_UNAVAILABLE`: revisar Redis. `PROVIDER_TIMEOUT`/`PROVIDER_UNAVAILABLE`: reintentar más tarde. `INVALID_PROVIDER_RESPONSE`: Google respondió, pero su plan no pasó las validaciones.

Solo se ejecutan las acciones implementadas: smooth y cut. La IA no recibe beatgrid ni energía medida y no se presenta como un motor de beatmatching profesional. La sincronización de fase, análisis de frases y time stretching siguen siendo mejoras distintas.

## Fuentes del contrato

- Guías locales de Next.js: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` y `01-app/02-guides/environment-variables.md`.
- Google: https://ai.google.dev/api/generate-content, https://ai.google.dev/gemini-api/docs/structured-output, https://ai.google.dev/gemini-api/docs/api-key.
- Redis REST: https://upstash.com/docs/redis/features/restapi.
