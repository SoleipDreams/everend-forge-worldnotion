# Revisión de transición visual — WorldNotion

## Inventario previo (2026-10-09)

| Superficie | Controles/estado a preservar | Estado previo |
| --- | --- | --- |
| Inicio/navegación | recientes, abrir/crear, logo, menú desktop, comandos, preferencias de host | Adaptación parcial; etiquetas inglesas en ES |
| Docking | presets, pestañas/grupos, mover/dividir, ratio, selección, cierre dirty | Base adaptada; controles/títulos auxiliares sin uniformar |
| Explorador | árbol, expansión, multiselección, favoritos, filtros, Lista/Galería, documentos visuales, creación | Base adaptada; traducciones y controles estrechos inconsistentes |
| Documento | portada/título, Fuente/Escribir/Leer, formato, fuentes personales, búsqueda, imágenes | Base adaptada; búsqueda y menús con estilos específicos |
| Inspector | propiedades, variantes, presentación, esquema, campos desconocidos, portales | Adaptación parcial; diálogos genéricos omitidos por forgeUi |
| Paneles auxiliares | esquema, enlaces/backlinks, grafo, asesor y proveedores existentes | Pendiente de uniformar superficies y estados vacíos |
| Timeline/relaciones | calendario/presets, filtros, vistas, variantes, herramientas, posiciones, Fuente/diagnósticos | Tokens adaptados; inspector compacto conserva varias cajas específicas |
| Ajustes/diálogos | apariencia/editor/workspace, propiedades, preview/aplicar migraciones, ayuda, licencia/update según host | Adaptación parcial; dimensiones, controles y menús específicos |

El portal de creación de propiedades y FloatingPortal del editor ya se anclan a su raíz `.forge-worldnotion`. Se conservará esa pertenencia y se verificará con las pruebas existentes.

Limitación anterior detectada: SearchPanel tiene opciones de búsqueda y botones de reemplazo sin implementación. Esta entrega los identificará como no disponibles; no ampliará búsqueda/reemplazo.

Las evidencias previas están en `output/playwright/transition-before.*`. No se modifican documentos ni preferencias durante el inventario.

## Cambios realizados

- Base común interna `forgeTransition.css`, aislada por `.forge-worldnotion`: diálogos, menús, controles, avisos, buscadores, inspector y paneles auxiliares con los tokens existentes. Se conservan las fuentes configurables de escritura y código.
- Ajustes y diálogos limitados al viewport; controles distribuidos por ancho disponible. Los submenús conservan su salida del contenedor para evitar recortes.
- Barras de documento adaptadas a grupos estrechos. Se preservan los nombres de contenedor del editor y el inspector para que sus reglas anteriores sigan funcionando.
- Navegación, docking, explorador, creación de propiedades y superficies comunes reciben las etiquetas ES/EN de la instancia que los abrió. Los diálogos del proveedor comparten ahora ese idioma.
- Foco de diálogos: entrada, ciclo Tab/Shift+Tab, Escape según el comportamiento existente y restauración del control de apertura. Una aplicación inactiva no toma el foco.
- Inspectores de cronologías y relaciones con superficies flotantes y controles compactos; no se cambia el contenido de sus documentos.
- Las opciones y acciones de SearchPanel sin implementación anterior aparecen deshabilitadas. La búsqueda implementada se conserva.

### Regresión funcional corregida: propiedad de pestañas por universo

En la prueba nativa se encontró que cambiar de universo y abrir un archivo con el mismo nombre podía reutilizar una pestaña con la ruta absoluta del universo anterior. La transición ahora descarta la sesión saliente antes de abrir documentos del universo entrante; la selección heredada sólo se conserva dentro del mismo universo. El editor también se identifica por raíz y archivo.

Dos pruebas verifican que no se heredan pestañas de otro universo y que una sesión restaurada utiliza el contenido, ruta y baseline del universo entrante. La prueba nativa con una tercera copia del universo mostró cero pestañas documentales heredadas y un fallo de guardado dirigido al archivo correcto. La nota sintética original fue restaurada y su SHA256 se comprobó antes y después de reabrir:

`0751417A20817222F3E5AEBFD15BED745A4D7A9528F2AFE0051A4D1217CFAE39`

## Matriz después de la adaptación

| Superficie | Resultado | Evidencia y límite |
| --- | --- | --- |
| Inicio/navegación | Adaptado; comprobación parcial | Barra, menú de paneles y etiquetas revisados en escritorio; biblioteca inicial y todos los comandos no tienen aceptación exhaustiva |
| Docking | Adaptado y comprobado | Dos documentos, división, arrastre entre grupos y retorno; captura a 900 px. Pruebas de layout pasan; resta cierre dirty del vecino en todas las combinaciones |
| Explorador | Adaptado y comprobado | Árbol, selección y Lista/Galería; creación de plantilla abre el diálogo y cancela sin crear archivo. Rendimiento de árbol grande pendiente |
| Documento | Adaptado y comprobado | Fuente/Procesado, editar/guardar/reabrir, undo/redo en el editor montado; conflicto externo conserva el borrador |
| Inspector | Adaptado y comprobado parcialmente | Portal de añadir propiedad pertenece a la raíz y tema correctos; Escape devuelve foco. Variantes y propiedades cubiertas por pruebas; falta recorrido nativo exhaustivo de campos avanzados |
| Paneles auxiliares | Adaptado; comprobación parcial | Enlaces, enlaces entrantes y grafo abiertos, capturados y cerrados conservando el layout. Asesor y esquema dependen de los plugins activos |
| Cronologías/relaciones | Adaptado y comprobado parcialmente | Ambos documentos abiertos en los cuatro tamaños; controles e inspectores conservados. No se repitió toda la aceptación funcional de sus motores y ediciones |
| Ajustes/diálogos | Adaptado y comprobado parcialmente | Siete secciones visibles recorridas: Resumen, Etiquetas, Herramientas, Apariencia, Plugins, Asesor IA y Ayuda. Foco/Escape comprobados; migraciones se conservaron sin aplicarlas |

## Verificación automática

- `npm run test:run`: **97 archivos, 571 pruebas aprobadas**, después de la corrección de propiedad de universos.
- `npm run test:run -- src/components/DialogProvider.test.tsx`: **8 pruebas aprobadas**, después del último ajuste de Tab desde el contenedor inicial del diálogo.
- `npm run build`: typecheck y build de WorldNotion aprobados después del último ajuste.
- `cargo check --manifest-path src-tauri/Cargo.toml`: aprobado; esta adaptación no cambia código Rust.
- `npm run build:sources` en Suite: incluye typecheck de fuentes independientes y build. Aprobado después del último ajuste de foco: 379 archivos independientes y 415 imports remapeados.

Los builds muestran avisos de tamaño de chunks e importaciones dinámicas que también se importan estáticamente. No impiden el build y no se han tratado como fallos de esta renovación.

## Comprobación en Tauri real

Playwright CLI conectado al WebView2 de WorldNotion independiente, puerto 9224, sesión `worldnotion`. Universo sintético en `../everend-forge-suite/output/playwright/visual-tools-vault`; no se editaron universos reales del usuario.

- 16 capturas de Ajustes: ES/EN, claro/oscuro y 1440×900, 1280×720, 1100×720, 900×700; límites del diálogo dentro del viewport y sin desbordamiento horizontal.
- 12 capturas de nota, cronología y relaciones en esos tamaños, esperando la carga del documento.
- Dos documentos simultáneos, división y traslado de pestañas; control del editor compacto accesible a 900 px.
- Guardado/reapertura de nota y restauración byte a byte; undo con Ctrl+Z y redo con Ctrl+Y en el mismo editor montado.
- Conflicto externo rechazado con aviso y borrador conservado; disco sin sobreescritura.
- Portal de propiedades: tema de la raíz, Escape y foco restaurado.
- Ajustes: navegación de sus siete secciones; Shift+Tab contenido y foco de apertura restaurado al cerrar.
- Consola después de la última recarga limpia: sin errores ni warnings. Durante HMR se observaron warnings transitorios de contexto y limpieza de listeners; no se usa esa fase como evidencia de aceptación.

Los tamaños son viewports emulados por CDP **dentro del WebView2 real**. No equivalen a cuatro redimensionados físicos del marco de Windows. Movimiento reducido se activó en las comprobaciones de 900 px.

### Evidencias locales

Las capturas y scripts están en `output/playwright/`:

- `transition-before.*`, `transition-final-note.png` y `transition-settings-after.png`.
- `transition-settings-{es|en}-{forge-mono-dark|forge-mono-light}-{1440|1280|1100|900}.png`.
- `transition-{note|timeline|relationships}-{1440|1280|1100|900}.png`.
- `transition-two-documents*.png`, `transition-property-dialog.png`, `transition-input-dialog.png`.
- `transition-ecosystem-{list|gallery}.png` y `transition-auxiliary-{links|backlinks|graph}.png`.
- `transition-settings-section-{0..6}.png`, `transition-external-conflict.yml`, `transition-final-reopen.js`.

Antes de la indicación de continuar exclusivamente con WorldNotion independiente, se comprobó una instancia **exclusiva** de Suite en CDP 9227: 48 combinaciones de documento/idioma/tema/tamaño; formulario preservado al alternar herramientas; guard de borrador de propiedades; cambio de universo y fallo de guardado por archivo de prueba de sólo lectura. Las capturas `wn-transition-*` están en el output de Suite. Esa instancia se cerró, se retiró el atributo de sólo lectura del archivo de prueba y no se continuó interactuando con Suite. La ventana del otro chat no forma parte de esta aceptación.

## Limitaciones anteriores y aceptación pendiente

- SearchPanel aún no implementa reemplazo ni todas las opciones que muestra; quedan deshabilitadas explícitamente.
- Persisten etiquetas de interfaz inglesas en ES, como Source y controles avanzados del grafo. Los nombres y opciones del esquema definidos por el usuario se conservan deliberadamente.
- El editor nativo rehace con Ctrl+Y; el menú anuncia Ctrl+Shift+Z. Esa discrepancia previa no se presenta como verificada.
- La historia de undo de CodeMirror no sobrevive al desmontaje al alternar documentos. Se comprobó undo/redo dentro de un editor montado; no se afirma continuidad de historial entre pestañas.
- Falta comprobar físicamente el marco en los cuatro tamaños y realizar el recorrido nativo completo de plantillas, imágenes, comandos, variantes avanzadas, árbol grande y todas las combinaciones de cierre/foco con documentos simultáneos.
- La recuperación mediante Retry después de retirar sólo lectura quedó pendiente al dejar Suite; el rechazo de guardado y la conservación del borrador sí se comprobaron.
- La aceptación funcional exhaustiva de cronologías/relaciones, normalizaciones y migraciones no se vuelve a certificar con esta revisión estética.

**Estado:** adaptación implementada y verificaciones indicadas aprobadas; la aceptación exhaustiva de todas las superficies sigue abierta por los puntos anteriores. No se declara cerrada la transición completa únicamente por los checks automáticos.

Los cambios permanecen sin commit junto al trabajo local anterior. No se sincronizaron vendors, no se alteraron formatos Markdown/YAML, contratos públicos ni capacidades de publicación/integración.

