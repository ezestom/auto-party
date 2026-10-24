# IA de Modo Fiesta: conexión de servidor

## Objetivo y alcance autorizado

Sacar la credencial de Groq del navegador, autenticar el uso de IA, limitar consumo, probar la conexión y distinguir Groq de la mezcla local. La música permanece en el navegador; se envían solo metadatos al planificar. El usuario añadirá las credenciales después. Sin despliegue ni proveedores contratados automáticamente.

## Módulos y orden

1. `ai-contract`: validar metadatos y planes, con acciones limitadas a smooth/cut. Los nombres de archivos son datos no confiables.
2. `ai-server`: Groq por HTTPS con clave solo en header; sesión firmada en cookie HttpOnly, origen explícito, JSON acotado y cuotas atómicas en Redis compartido. Memoria únicamente en desarrollo. Producción sin Redis/configuración válida mantiene IA deshabilitada.
3. `ai-client`: estado real, acceso por código, prueba manual, cancelación y fallback explícito. No hay formulario para claves Groq ni almacenamiento de credenciales.

## Contrato HTTP

- `GET /api/ai/status`: configuración disponible y sesión autorizada; no prueba al proveedor ni consume créditos.
- `POST /api/ai/session`: código de acceso; cookie de 8 horas, Secure en producción, HttpOnly, SameSite=Strict. `DELETE` cierra sesión.
- `POST /api/ai/test`: prueba mínima de Groq, autorizada y limitada igual que la planificación.
- `POST /api/ai/setlist`: `{tracks:[{id,title,artist,bpm,key,duration}]}`, 2–200 canciones, hasta 64 KiB. Respuesta validada con fuente `groq`; errores con código y mensaje fijo sin datos del proveedor.
- El cliente recurre al plan local con `source:local` y motivo visible. Un fallo remoto no detiene la música.

## Seguridad y límites

Activos: claves, cuota y continuidad de reproducción. Amenazas: llamadas anónimas, fuerza bruta del acceso, evasión entre instancias, cuerpos enormes, respuesta malformada de IA, metadatos que contienen instrucciones, fuga por errores o bundles. Validar sesión/origen antes de llamar Groq; validar planes por whitelist de canciones y acciones; cancelar con timeout. No usar herramientas de IA, URLs de usuario ni ejecución de texto.

Código compartido para beta, no cuentas individuales. Almacenamiento Redis REST compatible con Upstash, configurable y sin dependencia nueva; se guardan identificadores aleatorios, contadores y expiraciones, no audios ni títulos. Cuota diaria global y por sesión/hora; intentos de acceso limitados globalmente. Las cuotas cuentan peticiones, no garantizan un importe monetario. Para producción se requiere HTTPS y configurar cuotas de Groq también.

## Aceptación y comandos

- Sin `NEXT_PUBLIC_GROQ_API_KEY`, envío directo a Groq o clave en localStorage en fuentes cliente. Borrar el antiguo dato del navegador al montar.
- Configuración ausente, contraseña incorrecta, cookie manipulada/expirada, origen ajeno, cuotas, Redis caído, timeout y JSON inválido tienen regresiones.
- JSON del proveedor validado antes de mezclar; únicamente transiciones implementadas, sin prometer echo/beatmatching/fase reales.
- Pruebas de acceso, éxito remoto simulado y fallback en navegador, responsive preservado.
- `.env.example` y guía de `.env.local`/hosting con campos exactos y sin secretos reales.
- `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`; Chrome: `$env:PLAYWRIGHT_CHANNEL='chrome'; npm exec playwright test -- --workers=1`.

Las mejoras futuras de beatgrid, frases musicales y time stretching no forman parte de esta conexión: el indicador describe el planificador utilizado, sin atribuir capacidades nuevas al motor.
