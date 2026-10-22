# AutoParty — Free AI DJ Mixer Online

**Your music. Party on.**

Consola de dos decks con Next.js 16, React y Web Audio. La música y la biblioteca IndexedDB se procesan en el navegador. La planificación opcional con Gemini pasa por una API privada del servidor; la clave de Google no se envía al cliente.

## Iniciar

Usar una versión de Node compatible con el Next.js instalado. Desde esta carpeta:

```sh
npm install
npm run setup:ai
npm run dev
```

Abrir [la consola](http://localhost:3000). El automático local funciona sin API. Para activar Gemini, completar `GEMINI_API_KEY` en `.env.local`, reiniciar el servidor e ingresar el `AI_ACCESS_CODE` generado en **Ver conexión IA**. La prueba de conexión requiere una respuesta válida de Google.

La [guía de configuración](CONFIGURACION-IA.md) detalla las variables y la publicación con Node, HTTPS y Redis para límites compartidos. Una exportación estática no ejecuta esta API. El acceso a IA es una beta con código compartido.

## Funciones y límites

- Dos decks, EQ, filtros, tempo, CUE, hot cues, loops, sampler y crossfader con curvas. El jog permite variar temporalmente la velocidad.
- Biblioteca local, BPM estimado y ondas de amplitud real con dos resoluciones. Tonalidades desconocidas se muestran como tales.
- Modo Fiesta con cola, reproducción automática, próximo tema y fundidos/cortes. El plan identifica Gemini o el orden local por BPM; los fallos de IA conservan el modo local.
- Auriculares y booth con dispositivos independientes cuando el navegador los admite, grabación WAV, videos y proyector.
- DJ MC con Google TTS: tres voces, estilos de locución, anuncios personalizados, cancelación y caché de frases recientes. Comparte acceso y cuota con la planificación, y funciona también con AUTO LOCAL.
- Gemini propone el orden y transiciones; el motor local ejecuta el audio. No hay beatgrid/fase real, detección de frases, stems ni Key Lock terminado. Cambiar tempo también cambia tonalidad.

Ver [guía de controles](GUIA_CONTROLES.md), [estado y pendientes](MEJORAS-ESTADO.md) y [especificación de la API](SPEC-SERVER-AI.md). Las pruebas automatizadas no sustituyen la escucha con música y equipos reales.

## Verificación

```sh
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
npx playwright test --workers=1
```

Playwright inicia su servidor con credenciales ficticias y una biblioteca aislada. Las pruebas de proveedor simulan Google; no confirman una clave real ni consumen su cuota. Para usar Chrome instalado, definir `PLAYWRIGHT_CHANNEL=chrome` antes de ejecutar Playwright.
