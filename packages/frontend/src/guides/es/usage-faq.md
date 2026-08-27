# Preguntas y respuestas

## Descripción general

Respuestas breves a las dudas que surgen con más frecuencia, cada una con un enlace a la guía que trata el tema a fondo. Esta lista va creciendo con las preguntas que llegan, así que si la tuya todavía no está, la lista de temas de la izquierda entra en mucho más detalle.

## Qué se traduce

### ¿Qué entradas traduce una ejecución y cuáles se salta?

Solo las que aún lo necesitan. Para cada entrada y cada idioma de destino que hayas seleccionado, la ejecución traduce ese par cuando todavía no tiene traducción — o cuando has pedido explícitamente **retraducir**. Un par que ya tiene texto se deja intacto, así que volver a lanzar una traducción nunca sobrescribe el trabajo que ya has hecho o revisado.

Una entrada, o un par concreto de entrada e idioma, queda fuera cuando se cumple cualquiera de estas condiciones:

* **Ya está traducida**, y no has pedido retraducir.
* **La has marcado como Ignorada.** Eso la saca de *todas* las operaciones con IA — traducción, revisión con IA, revisión de origen y generación de glosarios o categorías. Las entradas ignoradas siguen visibles en la tabla con una etiqueta, así que la decisión siempre se ve y siempre se puede deshacer.
* **Está huérfana** — desapareció en tu última importación de CSV y espera en la pestaña [Huérfanos](guide:usage-orphans).
* **Se importó con `Traducción requerida = FALSE`.**
* **El destino es el idioma de origen.** Una entrada nunca se traduce a su propio idioma de origen, aunque selecciones ese idioma como destino.
* **No hay nada que traducir.** El texto vacío, un número como `3.14` o `100%`, un color hexadecimal como `#ff8800` o una cadena que solo son etiquetas y marcadores de posición como `<b>{count}</b>` se copian sin cambios, sin llamar a ningún proveedor.

Una entrada que se rellena desde la [Memoria de traducción](guide:usage-translation-memory) tampoco llega nunca a un proveedor — se reutiliza la traducción almacenada. Aun así cuenta como traducida.

### ¿Puedo retraducir algo que ya está traducido?

Sí, pero tienes que pedirlo, porque las ejecuciones se saltan por defecto los pares terminados. Marca **retraducir** en el diálogo *Traducir…* para un lote, o usa **Retraducir** en una fila concreta de la pestaña [Comparación](guide:usage-compare) o de la cola de revisión manual.

### ¿Por qué una entrada ha vuelto con su texto de origen sin cambios?

Casi siempre porque no había nada que traducir — el último punto de la lista de arriba. Los números, los colores y el marcado puro se reconocen y se copian tal cual, porque un modelo solo puede repetirlos o estropearlos. No se envió nada a ningún proveedor y no se cobró nada por esas entradas.

## Proveedores, modelos y enrutamiento

### ¿Cómo cambio el modelo que se usa para traducir?

Hay tres niveles, y el que te interesa depende de a cuánto quieras que afecte el cambio:

1. **A un proveedor en todas partes** — abre **Configuración global**, busca el módulo y elige ahí su **modelo**. Todos los proyectos puestos en *Heredar de la configuración global* lo siguen.
2. **A un solo proyecto** — abre la pestaña [Configuración](guide:usage-config) de ese proyecto y fija el **modelo** (y el **esfuerzo de razonamiento**) del módulo, en lugar de heredarlo.
3. **A algunas entradas** — abre la pestaña [Enrutamiento](guide:usage-routing), cambia a **Avanzado** y fija un **modelo personalizado** en una regla de enrutamiento. Solo las entradas que coincidan con esa regla usan ese modelo.

La vista simple de la pestaña Enrutamiento elige un **proveedor**, no un modelo: deliberadamente ejecuta el modelo que ya tenga configurado ese módulo.

### ¿Pueden distintos idiomas usar distintos proveedores?

Sí. Cambia la pestaña [Enrutamiento](guide:usage-routing) a **Avanzado** y añade una regla por idioma — o por categoría, o por longitud de entrada. Las reglas se evalúan por orden de prioridad y gana la primera que coincide con una entrada. Si prefieres no elegir en absoluto, apunta una única regla a [NARN Freeway](guide:usage-freeway) y deja que escoja un modelo gratuito para cada lote.

### La traducción no arranca y dice que no hay ninguna regla de enrutamiento. ¿Qué hago?

Una ejecución solo arranca cuando todos los idiomas que incluye tienen a dónde ir. Si un idioma de destino no coincide con ninguna regla, la ejecución se rechaza antes de enviar nada y el mensaje nombra el idioma. Abre la pestaña [Enrutamiento](guide:usage-routing) y añade una regla que lo cubra — el selector simple de proveedor cubre todos los idiomas de una vez — y vuelve a lanzar la ejecución.

## Ejecuciones, fallos y recuperación

### Han fallado algunas cadenas. ¿Tengo que ejecutarlo todo otra vez?

No. Usa **Reintentar fallidas** en la ejecución, dentro de la pestaña [Actividad](guide:usage-activity): vuelve a ejecutar solo los pares de entrada e idioma que dieron error y deja intacto todo lo que salió bien.

### ¿Por qué tengo que volver a desbloquear la bóveda?

La [bóveda de credenciales](guide:usage-vault) se desbloquea por sesión, no de forma permanente, y además se vuelve a bloquear sola tras un rato de inactividad. Desbloquéala y sigue. Si había una ejecución en marcha cuando se bloqueó, usa después **Reintentar fallidas** en esa ejecución.

### He vuelto a importar mi CSV y han desaparecido algunas traducciones. ¿Se han perdido?

No. Cuando una reimportación ya no contiene una entrada, sus traducciones se guardan en la pestaña [Huérfanos](guide:usage-orphans) en lugar de borrarse. **Revincula** una entrada huérfana con la entrada que la sustituyó para trasladar las traducciones; solo se rellenan los idiomas vacíos del destino, así que no se sobrescribe nada. Además se toma una instantánea automáticamente justo antes de cada importación, así que puedes revertir el proyecto entero desde la pestaña [Copia de seguridad](guide:usage-backup).
