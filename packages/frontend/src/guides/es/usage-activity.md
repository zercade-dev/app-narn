# Pestaña Actividad

## Descripción general

La pestaña **Actividad** es el centro de control de las tareas en segundo plano. Aquí aparece cada tarea de larga duración: las ejecuciones de **traducción**, la **revisión IA** (de traducción y de original), la **generación de glosarios** y la **generación de categorías**. Las ejecuciones se ponen en cola y se ejecutan una a una por proyecto, así que puedes encolar varias y ver cómo se van resolviendo.

## Leer una ejecución

Cada ejecución muestra su **tipo**, **estado** (En cola, En curso, Pausada, Completada, Fallida o Cancelada), su progreso y un **coste** estimado. Los costes son estimaciones reportadas por los módulos, derivadas del precio de cada modelo por millón de tokens, por lo que los modelos de razonamiento pueden mostrar totales de tokens grandes en relación con los caracteres. Usa **Ver detalles** para ver exactamente qué tradujo una ejecución, sus reintentos y el uso de caracteres y tokens. Puedes copiar el id de una ejecución como referencia.

## Gestionar la cola

* **Pausar** / **Reanudar** una ejecución, o **Iniciar ahora** para adelantar una ejecución en cola.
* **Subir en la cola** / **Bajar en la cola** para reordenarla.
* **Cancelar** una ejecución que esté en cola o en curso.

## Recuperar y revisar

* Si algunas cadenas fallaron, **Reintentar fallidos** vuelve a ejecutar solo esos.
* En una ejecución de traducción completada, inicia una **revisión IA** directamente desde la ejecución — elige el módulo y el modelo (por defecto se usan los mismos que la traducción) y luego abre los veredictos en la pestaña **Revisión IA de traducción**.
