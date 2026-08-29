# NARN Freeway

## Descripción general

**NARN Freeway** es un conjunto compartido de modelos de IA de plan gratuito al que la aplicación envía trabajo automáticamente — sin necesidad de tarjeta de crédito. Las claves de proveedor las sigues poniendo tú; lo que añade Freeway es la contabilidad. Lleva la cuenta de cuánta cuota gratuita le queda a cada proveedor, elige un modelo para cada lote y pasa a otro cuando uno está limitado por frecuencia o agotado por hoy.

Si apuntas el enrutamiento a Freeway, no vuelves a elegir modelo: el trabajo de Freeway no tiene ajuste de modelo ni de esfuerzo de razonamiento, porque la elección se hace en cada lote, para cada idioma, entre lo que el conjunto pueda servir en ese momento.

## Cómo activarlo

Un proyecto recién creado que aún no tiene reglas de enrutamiento ofrece un botón **Deja que NARN Freeway se encargue de todo** en la pestaña [Enrutamiento](guide:usage-routing) — un clic crea una regla general que apunta al conjunto gratuito.

Si no, elige **NARN Freeway** como cualquier otro proveedor: en el selector simple de la pestaña Enrutamiento para mandarle todo el proyecto, o como módulo de una regla concreta en **Avanzado** para usarlo en algunos idiomas y un proveedor de pago en otros.

Antes hacen falta dos cosas: al menos un proveedor gratuito con su clave guardada en la [bóveda de credenciales](guide:usage-vault), y la bóveda desbloqueada — mientras está bloqueada, todos los proveedores de Freeway aparecen como si no tuvieran clave.

## Qué proveedores usa

Freeway se apoya en los planes gratuitos de proveedores que ya hayas configurado como módulos. Hoy sabe usar:

* **Google AI (Gemini)** — la mayor asignación gratuita, y el origen de la mayoría de los modelos más potentes del conjunto.
* **Groq** — rápido, con un recuento diario de peticiones generoso.
* **OpenRouter** — los modelos gratuitos que aloja.
* **DeepL** — la asignación mensual de caracteres de su plan gratuito, para traducción automática clásica.

<!-- local-only -->

* **GitHub Copilot** — si tienes una suscripción a Copilot.

<!-- /local-only -->

Un proveedor al que no le hayas dado clave simplemente se omite. Añadir una clave más amplía el conjunto y hace menos probable que una ejecución tenga que esperar.

## Cómo vigilar el conjunto

El panel **NARN Freeway** de la pantalla de configuración muestra todo el conjunto de un vistazo: el estado de la clave de cada proveedor y, por modelo, su **Estado**, la cuota **Restante**, el **Próximo reinicio** y la **Tasa de aprobación** reciente por idioma.

Cada proveedor tiene además un desplegable al lado que controla cómo lo usa Freeway: **Automático** deja que el conjunto elija como de costumbre, una instancia con nombre fija Freeway a esa cuenta concreta, y **Desactivado** saca al proveedor del conjunto por completo — sin apagar el módulo en ningún otro sitio. Si vuelves a poner un proveedor desactivado en Automático (o en una instancia con nombre), retoma justo donde lo dejó.

El estado de un modelo es uno de estos:

* **Listo** — utilizable ahora.
* **En enfriamiento** — limitado por frecuencia un momento; vuelve solo.
* **Agotado por hoy** — la asignación diaria está gastada, y el panel indica cuándo se reinicia.
* **Módulo desactivado** — la clave está guardada pero el módulo está apagado. El panel te ofrece activarlo.
* **Desactivado para Freeway** — desactivaste este proveedor para el conjunto desde su desplegable; todo lo demás del módulo sigue igual.
* **Sin clave** — todavía no hay nada guardado en la bóveda para este proveedor.
* **Credenciales inválidas** — la clave fue rechazada. Guarda una clave válida en la bóveda para quitar la marca.

## Cuando se acaba la cuota gratuita

Una ejecución que agota el conjunto no falla. Pasa a **Esperando cuota gratuita**, conserva los pares que le faltan y se reanuda sola en cuanto se reinicia la asignación de algún proveedor — puedes dejarla y volver más tarde.

Si prefieres no esperar, abre la ejecución en la pestaña [Actividad](guide:usage-activity) y usa **Reanudar ahora con…** para terminar los pares restantes con un proveedor de pago, o **Reintentar con la cuota gratuita** para volver a intentarlo al momento.

## Niveles de calidad, y mejorar solo lo que hace falta

Los modelos gratuitos no son igual de buenos, así que cada uno lleva un **nivel de calidad** del 1 al 4, siendo el 4 el más potente. Cada traducción guarda el nivel del modelo que la produjo, lo que convierte el "traducirlo todo gratis" en un primer paso aprovechable:

1. Traduce el proyecto entero con Freeway sin coste.
2. En la pestaña **Traducciones**, filtra por **Por debajo del nivel** para ver qué resolvió un modelo más flojo.
3. Selecciona esas entradas y usa **Retraducir por debajo del nivel** para rehacer solo esas con un proveedor mejor.

Acabas pagando solo por las entradas que de verdad lo necesitaban.

## Dónde más funciona Freeway

Freeway no es solo para traducir. También está disponible como módulo para la **revisión con IA**, la **revisión de origen** y la **generación de glosarios** y **categorías** — en cada caso elige el mejor modelo gratuito para la tarea y oculta los ajustes de modelo y esfuerzo de razonamiento, porque no hay nada que elegir. Consulta [Revisión con IA](guide:usage-ai-review), [Glosario](guide:usage-glossary) y [Categoría](guide:usage-category).
