# Configuración rápida

## Descripción general

¿Eres nuevo en NARN? El camino corto de abajo te lleva de cero a una traducción exportada en cinco pasos. La configuración guiada de la app te acompaña por los mismos pasos, y puedes saltártela y retomarla más tarde — **Continuar la configuración** en la barra lateral retoma donde lo dejaste, y puedes reiniciarla desde esta guía. Todo lo que sigue al camino corto es para cuando quieras más control.

## El camino corto

1. **Crea la contraseña de tu bóveda.** Tus claves de proveedor se cifran con ella — consulta la guía [Bóveda de credenciales](guide:usage-vault). En la versión en la nube, los pasos 1 y 2 se hacen juntos en la página de la bóveda.
2. **Añade una clave gratuita.** Una clave de Google AI es la forma más fácil de empezar — consíguela en [aistudio.google.com/apikey](https://aistudio.google.com/apikey), o elige **Usar mi propio proveedor**. [NARN Freeway](guide:usage-freeway) elige entonces modelos gratuitos por ti.
3. **Crea un proyecto e importa tu texto.** Crea un proyecto, luego en la pestaña **Datos** elige el idioma de origen y los idiomas a los que traducir, y usa **Importar CSV**.
4. **Traduce.** En **Traducciones**, selecciona todas las entradas y haz clic en **Traducir**. NARN Freeway elige modelos gratuitos por ti; sigue el progreso en **Actividad**.
5. **Exporta.** Descarga el archivo traducido desde el proyecto.

Los usuarios nuevos empiezan en el **modo Simple**, que solo muestra Configuración, Datos, Traducciones y Actividad (más Guía, Ajustes y **Claves de proveedores**). Cambia entre **Simple** y **Avanzado** desde la barra superior o en Ajustes cuando quieras.

## Cuando quieras más

Estos pasos están en el **modo Avanzado** y mejoran la calidad o te dan un control más fino. Los pasos marcados *(Optional)* no son necesarios para una primera traducción — sáltatelos y vuelve más tarde. La primera vez que abras Enrutamiento, Glosario, Calidad, Comparar o Revisión IA de traducción en modo Avanzado se ofrece un recorrido breve; puedes iniciar cualquier recorrido de nuevo desde esta guía, o desactivar las ofertas en Ajustes.

## Añade más proveedores y credenciales

1. Abre **Configuración global** y **habilita un módulo** por cada proveedor que quieras (Anthropic, OpenAI, DeepL, y así sucesivamente) desde la lista **Habilitar un módulo** — DeepL aparece con su nombre, mientras que los proveedores de IA aparecen como **Añadir otra instancia de …**, que crea la primera instancia del proveedor. Un módulo puede tener varias **instancias con nombre** — útil para tener dos configuraciones del mismo proveedor con claves o valores predeterminados distintos.
2. Las credenciales de los proveedores se guardan en la **bóveda de credenciales** cifrada — configúrala la primera vez que la uses y desbloquéala una vez por sesión. Consulta la guía *Bóveda de credenciales* para saber cómo funciona.
3. Elige un **modelo** (y, opcionalmente, un **esfuerzo de razonamiento**) por módulo o instancia. Los modelos más baratos traducen peor, así que espera algo de prueba y error hasta encontrar tu punto óptimo. Vigila el **esfuerzo de razonamiento** — en los modelos de razonamiento puede multiplicar el gasto rápidamente.

## *(Optional)* Revisa primero tu texto de origen

Ejecuta **Revisión IA del original** sobre el idioma de origen antes de traducir — corregir erratas y frases poco claras aquí beneficia a cada traducción que se haga después. Si una corrección cambia una entrada que ya tenía traducciones, las traducciones antiguas van a parar a la pestaña **Huérfanas** — **reasígnalas**, con retraducción opcional.

## *(Optional)* Habilita glosarios

En la pestaña **Glosario**, habilita los glosarios que apliquen a tu proyecto. La aplicación automática busca coincidencias de términos como **palabras completas, sin distinguir mayúsculas de minúsculas** — las formas flexionadas (plurales, conjugaciones) no se detectan. ¿Traduces con **DeepL**? Envía los glosarios con **Enviar a DeepL** (arriba a la derecha), y vuelve a enviarlos después de editarlos.

## Configura el enrutamiento

Abre la pestaña **Enrutamiento** y elige tu proveedor en el selector con el que se abre — eso envía cada entrada del proyecto a ese proveedor, que es todo lo que necesita una configuración de un solo proveedor. ¿Quieres proveedores distintos por idioma, categoría o longitud de entrada? Cambia a **Avanzado** y añade **reglas de enrutamiento** ahí. Tu elección se guarda sola en ambos casos. Un proyecto sin ninguna regla envía todo por NARN Freeway, así que este paso es opcional al empezar. Cuando el proyecto tiene reglas, una entrada que no coincide con ninguna falla la traducción con un error de *"no route"*.

## *(Optional)* Construye glosarios a partir de tu propio contenido

Haz crecer tus glosarios antes de una traducción masiva: añade términos a mano, ejecuta **Generar glosarios** sobre todo el origen o — más dirigido — selecciona buenas entradas candidatas en **Traducciones** y usa **Generar glosario desde la selección** (incluyendo las traducciones existentes). Usa aquí un modelo capaz; la calidad del glosario se multiplica en todo lo que se traduzca después.

## *(Optional)* Itera la calidad primero en Comparar

Antes de una ejecución de traducción completa, usa la pestaña **Comparar** para afinar un idioma que puedas juzgar tú mismo:

- Refina el **contexto** de cada entrada (personaje, tono, notas) y sus glosarios hasta que la traducción suene bien. El contexto se guarda por entrada, no por idioma, así que ese trabajo se traslada automáticamente a todos los demás idiomas.
- Como estás iterando entrada por entrada, aquí sirve un modelo barato o gratuito — por ejemplo, una clave gratuita de Gemini (consulta la guía *Google AI (Gemini)*), añadida como su propia **instancia de módulo** con el enrutamiento apuntado temporalmente a ella. El nivel gratuito tiene un límite diario, así que prefiere solicitudes agrupadas.
- ¿Contento con los resultados? Traduce el lote completo una vez con los mismos ajustes para confirmar que se sostiene a gran escala.

## Traduce en bloque

Dos formas de ejecutar la traducción real:

- **Traducciones** — selecciona entradas y usa **Traducir seleccionadas** para cubrir todos los idiomas de destino a la vez.
- **Comparar** — un idioma a la vez, opcionalmente con un idioma ya revisado como contexto de **referencia**.

Para un proyecto completo, suele funcionar mejor ir idioma por idioma con un idioma de referencia ya revisado: así la revisión IA posterior se mantiene centrada en un solo idioma. Vigila el progreso en la pestaña **Actividad**.

El agrupamiento por lotes es automático por defecto; para un proyecto pequeño con muchas entradas cortas, un tamaño de lote personalizado de **0** (todo el idioma en una sola solicitud) puede funcionar mejor con un modelo capaz.

## Revisa la ejecución

Elige una opción:

- Activa una **revisión IA** para la ejecución completada desde la pestaña **Actividad**.
- Revisa a mano en **Revisión manual** o **Comparar**.
- Aprueba todo tal cual y revisa más tarde.
