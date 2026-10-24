# Configuración de Groq

Auto-DJ usa Groq para ordenar canciones y sugerir transiciones. La música se procesa localmente. La clave nunca se envía al navegador.

1. Seleccionar el proyecto correcto en https://console.groq.com/keys y crear una clave con Create API Key. Copiarla al crearla; no compartirla en el chat.
2. En permisos del proyecto permitir openai/gpt-oss-20b.
3. Ejecutar npm run setup:ai y completar GROQ_API_KEY en .env.local. El script conserva una clave Groq existente y elimina variables Gemini antiguas y claves públicas. No imprime secretos.
4. Defaults: GROQ_MODEL=openai/gpt-oss-20b. Mantener AI_ACCESS_CODE y AI_SESSION_SECRET privados. Reiniciar npm run dev.
5. En Party mode → View AI connection ingresar el AI_ACCESS_CODE de .env.local y pulsar Connect and test. Esta prueba realiza una llamada de texto real.

El plan Free tiene cuotas del proveedor; permitir un modelo no cambia el plan. La app no puede verificar la facturación de la cuenta. No activar Upgrade si se desea continuar en Free. Una cuota agotada produce un error visible y el Auto-DJ conserva la alternativa local.

## Protección y publicación

AI_ALLOWED_ORIGINS debe incluir los orígenes exactos permitidos, separados por comas. Desarrollo permite localhost. Producción requiere HTTPS y UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN válidos. Sin estos valores la IA falla cerrada. AI_DAILY_REQUEST_LIMIT y AI_SESSION_HOURLY_LIMIT son límites compartidos para planificación y prueba. Son límites de peticiones, no de importe monetario.

Se usan cookies HttpOnly firmadas, verificación de origen, límites de cuerpo y de respuesta, tiempos máximos y errores sin detalles privados del proveedor.

Si una credencial fue expuesta en una captura, revocarla en su proveedor y renovar también los secretos de acceso expuestos.

Fuentes: https://console.groq.com/docs/structured-outputs (consultadas el 24/10/2026).

La función de voz DJ MC está retirada por ahora. No requiere configurar TTS ni aceptar términos de Orpheus.
