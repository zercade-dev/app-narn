# Memoria de traducción

## Descripción general

La **Memoria de traducción** (MT) es un almacén de traducciones conocidas para todo el espacio de trabajo. Cuando el texto de origen de una cadena coincide con uno ya presente en la memoria, la traducción guardada se reutiliza automáticamente en lugar de llamar a un módulo de pago — ahorrando tiempo y coste y manteniendo el texto idéntico coherente entre proyectos. Abre la vista **Memoria de traducción** desde la barra lateral para explorar y buscar los segmentos guardados.

> **La memoria de traducción está desactivada por defecto** en todos los proyectos. Mientras esté desactivada, nada de lo que traduzca un proyecto se escribe en la memoria y ninguna traducción guardada se aplica automáticamente. Para activarla, abre la pestaña **Configuración** del proyecto y elige una política de reutilización en la sección **Memoria de traducción** (cualquier valor distinto de *Desactivada*).

## Cómo entran entradas en la memoria

* **Aprobar a memoria** — en la pestaña **Traducciones**, selecciona traducciones y apruébalas; quedan registradas como segmentos fiables.
* Las traducciones completadas también se registran, para que un texto de origen idéntico pueda reutilizarlas más adelante.

## Política de reutilización

La política de reutilización (en la pestaña **Configuración** del proyecto, sección **Memoria de traducción**) controla *si* y *cuándo* se reutiliza una traducción guardada para un texto de origen idéntico. Por defecto es **Desactivada** (MT apagada); otras opciones — por ejemplo **Estricta (coincidencia de contexto completa)**, que solo reutiliza cuando el contexto circundante también coincide — la activan. Endurecer la política evita reutilizar una traducción que era correcta en un lugar pero no en otro.

## Controlar la reutilización por ejecución

Cuando inicias una traducción desde el cuadro de diálogo *Traducir…* de la pestaña **Comparar**, un aviso te indica cuántas entradas se completarían desde la memoria, y puedes **desactivar la memoria para esta ejecución** para forzar que cada entrada se traduzca desde cero — útil cuando quieres que el modelo reconsidere un texto ya memorizado.
