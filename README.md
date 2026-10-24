# AutoParty — Free AI DJ Mixer Online

**Your music. Party on.**

Consola de dos decks con Next.js 16, React y Web Audio. La música y la biblioteca IndexedDB se procesan en el navegador. La planificación opcional con Groq pasa por una API privada del servidor; la clave de Groq no se envía al cliente.

## Iniciar

Usar una versión de Node compatible con el Next.js instalado. Desde esta carpeta:

```sh
npm install
npm run setup:ai
npm run dev
```

Abrir [la consola](http://localhost:3000). El automático local funciona sin API. Para activar Groq, completar `GROQ_API_KEY` en `.env.local`, reiniciar el servidor e ingresar el `AI_ACCESS_CODE` generado en **View AI connection**. La prueba de conexión requiere una respuesta válida de Groq.

La [guía de configuración](CONFIGURACION-IA.md) detalla las variables y la publicación con Node, HTTPS y Redis para límites compartidos. Una exportación estática no ejecuta esta API. El acceso a IA es una beta con código compartido.

## Funciones y límites

- Dos decks, EQ, filtros, tempo, CUE, hot cues, loops, sampler y crossfader con curvas. El jog permite variar temporalmente la velocidad.
- Biblioteca local, BPM estimado y ondas de amplitud real con dos resoluciones. Tonalidades desconocidas se muestran como tales.
- Biblioteca de canciones y videos en un único panel inferior: su cabecera permanece visible y sube con el contenido hasta media pantalla. Se abre desde **Library**, la cabecera o arrastrando; se cierra con Escape, un clic fuera o arrastrando hacia abajo. Queda por delante del láser y conserva espacio para los controles.
- **Import files** permite elegir canciones y videos desde un único selector. La biblioteca informa importados, archivos omitidos y fallos; la reproducción depende de los códecs que admita el navegador. La interfaz del producto usa inglés.
- En notebook (desde 1024 px) y mobile horizontal se ven ambos decks y el mixer; en mobile vertical hay pestañas A/Mixer/B. La lista de canciones mobile conserva título, BPM y carga A/B visibles.
- Pestañas de temáticas creadas por el DJ en **Media library**: crear, renombrar, asignar canciones existentes e importar directamente a la pestaña seleccionada. Mirar una pestaña no cambia lo que suena; **Play this theme next** prepara el cambio para el final del tema actual.
- **Party mode → Party programme** permite ordenar temáticas con minutos aproximados, repetir canciones para cubrir cada tramo y saltar manualmente a otra etapa sin cortar la música. Se guarda localmente. El último tramo continúa con su temática; las pausas y el control manual no consumen tiempo del programa.
- Modo Fiesta con cola, reproducción automática, próximo tema y fundidos/cortes. El plan identifica Groq o el orden local por BPM; los fallos de IA conservan el modo local.
- Auriculares y booth con dispositivos independientes cuando el navegador los admite, grabación WAV, videos y proyector.
- **Visuals** abre una única ventana de TV/proyector y una vista del DJ de 280 px, arrastrable desde su barra. Ambas comparten video y reloj de reproducción. Cerrar la X del flotante no detiene la proyección; **Visuals** vuelve a mostrarlo sin abrir otra TV. El navegador debe permitir la ventana emergente.
- La manito **AI** muestra la preparación del próximo tema y se acerca a **Play**: la pulsación visual coincide con el arranque real del deck. Se aparta al intervenir el DJ y puede ocultarse en **Settings → Auto-DJ → AI hand**; la reproducción no depende de su animación.
- El indicador **Audio Engine** se ilumina en verde cuando el contexto de audio está activo y algún deck está reproduciendo; con ambos decks pausados deja de marcar reproducción.
- **Settings** comparte el mismo tamaño entre General, Audio, Auto-DJ y Help: altura máxima de 680 px, limitada por la pantalla, con scroll interno y botones de cierre siempre visibles. General muestra tres preferencias esenciales; las salidas adicionales son opcionales y avanzadas. La curva del crossfader queda en el mixer, y el formato de grabación se explica en Help. No se muestran el bloque técnico de Voicebox ni parámetros sin implementación. Restablecer preferencias conserva el modal abierto.
- Groq propone el orden y transiciones; el motor local ejecuta el audio. No hay beatgrid/fase real, detección de frases, stems ni Key Lock terminado. Cambiar tempo también cambia tonalidad.

Ver [guía de controles](GUIA_CONTROLES.md), [estado y pendientes](MEJORAS-ESTADO.md) y [especificación de la API](SPEC-SERVER-AI.md). Las pruebas automatizadas no sustituyen la escucha con música y equipos reales.

## Verificación

```sh
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
npx playwright test --workers=1
```

Playwright inicia su servidor con credenciales ficticias y una biblioteca aislada. Las pruebas de proveedor simulan Groq; no confirman una clave real ni consumen su cuota. Para usar Chrome instalado, definir `PLAYWRIGHT_CHANNEL=chrome` antes de ejecutar Playwright.
