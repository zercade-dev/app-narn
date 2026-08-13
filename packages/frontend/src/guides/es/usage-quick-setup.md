# Configuración rápida

## Descripción general

El recorrido completo para un proyecto nuevo: habilita proveedores, importa tus entradas, configura glosarios y enrutamiento, traduce y revisa. Los pasos marcados *(Optional)* mejoran la calidad pero no son necesarios para una primera traducción — sáltatelos en una primera pasada y vuelve a ellos más tarde.

## 1. Habilita proveedores y guarda las credenciales

1. Abre **Configuración global** y **habilita un módulo** por cada proveedor que quieras (Anthropic, OpenAI, DeepL, y así sucesivamente). Un módulo puede tener varias **instancias con nombre** — útil para tener dos configuraciones del mismo proveedor con claves o valores predeterminados distintos.
2. Las credenciales de los proveedores se guardan en la **bóveda de credenciales** cifrada — configúrala la primera vez que la uses y desbloquéala una vez por sesión. Consulta la guía *Bóveda de credenciales* para saber cómo funciona.
3. Elige un **modelo** (y, opcionalmente, un **esfuerzo de razonamiento**) por módulo o instancia. Los modelos más baratos traducen peor, así que espera algo de prueba y error hasta encontrar tu punto óptimo. Vigila el **esfuerzo de razonamiento** — en los modelos de razonamiento puede multiplicar el gasto rápidamente.

## 2. Crea el proyecto e importa las entradas

Crea un proyecto, define su **idioma de origen**, y luego usa **Importar CSV** en la pestaña **Datos** para cargar tus entradas de origen (y cualquier traducción que ya traiga el archivo).

## 3. *(Optional)* Revisa primero tu texto de origen

Ejecuta **Revisión IA del original** sobre el idioma de origen antes de traducir — corregir erratas y frases poco claras aquí beneficia a cada traducción que se haga después. Si una corrección cambia una entrada que ya tenía traducciones, las traducciones antiguas van a parar a la pestaña **Huérfanas** — **reasígnalas**, con retraducción opcional.

## 4. *(Optional)* Habilita glosarios

En la pestaña **Glosario**, habilita los glosarios que apliquen a tu proyecto. La aplicación automática busca coincidencias de términos como **palabras completas, sin distinguir mayúsculas de minúsculas** — las formas flexionadas (plurales, conjugaciones) no se detectan. ¿Traduces con **DeepL**? Envía los glosarios con **Enviar a DeepL** (arriba a la derecha), y vuelve a enviarlos después de editarlos.

## 5. Configura el enrutamiento

Abre la pestaña **Enrutamiento** y elige tu proveedor en el selector con el que se abre — eso envía cada entrada del proyecto a ese proveedor, que es todo lo que necesita una configuración de un solo proveedor. ¿Quieres proveedores distintos por idioma, categoría o longitud de entrada? Cambia a **Avanzado** y añade **reglas de enrutamiento** ahí. Tu elección se guarda sola en ambos casos. Este paso es obligatorio: una entrada sin ninguna regla que coincida falla la traducción con un error de *"no route"*.

## 6. *(Optional)* Construye glosarios a partir de tu propio contenido

Haz crecer tus glosarios antes de una traducción masiva: añade términos a mano, ejecuta **Generar glosarios** sobre todo el origen o — más dirigido — selecciona buenas entradas candidatas en **Traducciones** y usa **Generar glosario desde la selección** (incluyendo las traducciones existentes). Usa aquí un modelo capaz; la calidad del glosario se multiplica en todo lo que se traduzca después.

## 7. *(Optional)* Itera la calidad primero en Comparar

Antes de una ejecución de traducción completa, usa la pestaña **Comparar** para afinar un idioma que puedas juzgar tú mismo:

- Refina el **contexto** de cada entrada (personaje, tono, notas) y sus glosarios hasta que la traducción suene bien. El contexto se guarda por entrada, no por idioma, así que ese trabajo se traslada automáticamente a todos los demás idiomas.
- Como estás iterando entrada por entrada, aquí sirve un modelo barato o gratuito — por ejemplo, una clave gratuita de Gemini (consulta la guía *Google AI (Gemini)*), añadida como su propia **instancia de módulo** con el enrutamiento apuntado temporalmente a ella. El nivel gratuito tiene un límite diario, así que prefiere solicitudes agrupadas.
- ¿Contento con los resultados? Traduce el lote completo una vez con los mismos ajustes para confirmar que se sostiene a gran escala.

## 8. Traduce

Dos formas de ejecutar la traducción real:

- **Traducciones** — selecciona entradas y usa **Traducir seleccionadas** para cubrir todos los idiomas de destino a la vez.
- **Comparar** — un idioma a la vez, opcionalmente con un idioma ya revisado como contexto de **referencia**.

Para un proyecto completo, suele funcionar mejor ir idioma por idioma con un idioma de referencia ya revisado: así la revisión IA posterior se mantiene centrada en un solo idioma. Vigila el progreso en la pestaña **Actividad**.

El agrupamiento por lotes es automático por defecto; para un proyecto pequeño con muchas entradas cortas, un tamaño de lote personalizado de **0** (todo el idioma en una sola solicitud) puede funcionar mejor con un modelo capaz.

## 9. Revisa la ejecución

Elige una opción:

- Activa una **revisión IA** para la ejecución completada desde la pestaña **Actividad**.
- Revisa a mano en **Revisión manual** o **Comparar**.
- Aprueba todo tal cual y revisa más tarde.
