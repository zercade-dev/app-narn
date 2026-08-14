# Pestaña Enrutamiento

## Descripción general

La pestaña **Enrutamiento** decide qué módulo y modelo gestiona cada entrada. Se abre con un selector de un único proveedor: elige un proveedor y cada entrada del proyecto va a él. Eso es todo lo que necesita la mayoría de los proyectos.

¿Necesitas más de un destino? Cambia la pestaña a **Avanzado** y aparece el generador de reglas completo, donde el enrutamiento puede variar según el idioma de destino, la categoría o la longitud de la entrada, y donde puedes mantener varios **grupos de reglas** con nombre. La pestaña recuerda cuál de los dos modos usaste por última vez. Un proyecto cuyo enrutamiento es más complejo que un solo proveedor siempre muestra el generador, sea cual sea el modo que elijas — una configuración ya existente nunca se te oculta.

En cualquier caso, esta pestaña solo decide *cómo* se despachan las entradas. Las traducciones se inician desde la pestaña **Traducciones** o **Comparar**.

## Reglas de enrutamiento

Las reglas viven en la vista **Avanzado**. Se evalúan en orden de prioridad; gana la primera que coincide con una entrada. Cada regla puede coincidir según:

* **Orígenes** — las etiquetas de origen/procedencia de las entradas importadas.
* **Límite de longitud de entrada** — se aplica solo a entradas con un número de caracteres igual o menor.
* **Idioma destino** y **categorías**.

Para las entradas que coinciden, la regla fija el **módulo** (y, opcionalmente, un **modelo** y un **esfuerzo de razonamiento** personalizados) más indicaciones de prompt opcionales (personaje, tono, género, notas). Añade reglas con **Añadir regla**; cada cambio se guarda solo, así que no hay ningún botón **Guardar** que recordar. Puedes mantener varios **grupos de reglas** con nombre y cambiar entre ellos (el cambio se bloquea mientras hay una ejecución en curso).

## Agrupación de lotes

La pestaña Enrutamiento también tiene un control de **Agrupación de lotes** — el mismo valor predeterminado del proyecto que se muestra en la pestaña Configuración, con un interruptor **Ignorar el límite de tamaño de lote** a juego. Mantiene juntas las entradas relacionadas en la misma solicitud al proveedor en las ejecuciones de traducción, evaluación y revisión de origen.

## Iniciar una traducción

1. Selecciona entradas en la pestaña **Traducciones** o **Comparar**.
2. Abre el cuadro de diálogo **Traducir…** desde ahí — ofrece opciones de retraducción, memoria y agrupación por ejecución, y luego inicia la ejecución.
3. Sigue el progreso, los reintentos y los fallos en la pestaña **Actividad**.
