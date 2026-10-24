> ARCHIVADO: funcionalidad retirada por decisión del usuario el 24/10/2026. Este documento describe el diseño anterior; no es configuración vigente.

# DJ MC con Groq en inglés

POST /api/ai/speech recibe texto de 1 a 180 caracteres, voz troy/hannah/austin y estilo assistant/radio/party. Genera WAV mediante canopylabs/orpheus-v1-english, usando Authorization en el servidor. Añade una dirección vocal breve; el total no supera 200 caracteres. Respuesta binaria limitada durante la lectura a 3 MB y validada como PCM WAV de hasta 45 segundos. Timeout de 40 segundos.

Comparte sesión, origen y cuotas con Auto-DJ. La clave GROQ_API_KEY queda en el servidor. No hay reemplazo silencioso por voz del navegador. La música baja solo durante la reproducción y se restaura al terminar, fallar o cancelar. La caché de ocho frases / 8 MB vive en memoria. Frases rápidas e interfaz en inglés; funciona con Auto-DJ local.

Fuentes: https://console.groq.com/docs/text-to-speech/orpheus. Configuración: CONFIGURACION-IA.md.
