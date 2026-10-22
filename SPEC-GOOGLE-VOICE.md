# Voz de Google para DJ MC

Usar la clave privada existente y un modelo TTS independiente (default gemini-3.8-flash-tts). Acceso, origen y cuotas compartidos con la planificación. POST /api/ai/speech recibe texto de 1 a 400 caracteres, voz de una lista y estilo fijo; devuelve WAV validado, máximo 45 segundos y 3 MB, o los errores seguros existentes. El texto se envía a Google; la música no. Timeout 40 segundos, respuesta JSON acotada a 4 MB.

DJ MC permite probar Charon/Fenrir/Kore, estilos asistente/radio/fiesta, frases rápidas y anuncios personalizados. Preparar AudioContext en el gesto inicial, distinguir generación/reproducción, atenuar música solo durante la voz, restaurar en éxito/error/cancelación y permitir detener. Sin sustitución silenciosa por voz nativa. Caché en memoria de las últimas ocho frases (máximo 8 MB); repetir no consume API. Selección independiente del plan local/Gemini. Mantener Voicebox como módulo previo sin usarlo automáticamente en este panel.

Validación: acceso/origen/cuota, payload, audio real y inválido, errores sin secretos, cancelación y restauración del volumen, caché, UI móvil y prueba real con la clave existente. No activar facturación ni crear servicios. El nivel gratuito depende de cuotas del proyecto; no prometer servicio ilimitado. No desplegar.

Fuentes: https://ai.google.dev/gemini-api/docs/generate-content/speech-generation y https://ai.google.dev/gemini-api/docs/pricing (consultadas el 22/10/2026). Guía local de Route Handlers de Next.js leída antes de los cambios.
