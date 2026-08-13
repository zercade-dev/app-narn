# Revisión con IA

## Descripción general

Además de las comprobaciones automáticas de LQA, la aplicación puede usar un modelo de IA para revisar tu contenido. Hay dos pestañas de revisión IA más una cola de revisión manual. Toda revisión IA necesita un módulo LLM habilitado en **Configuración global** y la bóveda de credenciales desbloqueada.

## Revisión IA de traducción

La pestaña **Revisión IA de traducción** hace que una IA evaluadora puntúe las traducciones completadas por **precisión, fluidez, terminología y tono**.

* Haz clic en **Revisar la última ejecución** para evaluar la última ejecución de traducción completada (o inicia una revisión desde una ejecución concreta en la pestaña **Actividad**).
* Recorre los resultados marcados; cada veredicto muestra el original, la traducción, una **puntuación** y, a menudo, una **sugerencia**.
* **Aplicar** una sugerencia para reemplazar la traducción, o **Aplicar todas las sugerencias** para aplicarlas todas de una vez. Aparece una advertencia si una sugerencia eliminaría etiquetas, marcadores o saltos de línea.

## Revisión IA del original

La pestaña **Revisión IA del original** comprueba el **propio texto de origen** — es solo informativa y nunca cambia las traducciones.

1. Elige las comprobaciones que se ejecutarán: **errata**, **gramática**, **terminología**, **claridad** y contenido **inseguro**.
2. Elige el **módulo** y el **modelo**, y opcionalmente el **idioma de respuesta** de los hallazgos.
3. Haz clic en **Iniciar revisión**. Se ejecuta en segundo plano — sigue el progreso en la pestaña **Actividad**.
4. Revisa cada hallazgo y **Apruébalo** o **Ignóralo**; una reescritura sugerida del original se puede copiar.

## Revisión manual

La pestaña **Revisión manual** es una cola de revisión humana. Las traducciones marcadas como **Necesita revisión** (o **Marcadas**) aparecen aquí, donde puedes **Aprobar**, **Editar**, **Marcar**, **Retraducir** o pedir una **traducción inversa** al original como referencia. Los atajos de teclado lo agilizan: `↑`/`↓` para moverte, `a` para aprobar, `e` para editar.
