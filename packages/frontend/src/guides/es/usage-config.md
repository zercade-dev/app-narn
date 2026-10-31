# Pestaña Configuración

## Descripción general

La pestaña **Configuración** contiene la política de traducción del proyecto seleccionado: la elección de modelo por módulo, la reutilización de la memoria de traducción, la agrupación de lotes, las comprobaciones de calidad (LQA) y la gestión del proyecto. Sus **idiomas** y la **importación/exportación de CSV** viven ahora en la pestaña **Datos**, aparte. Las credenciales de los proveedores no se configuran aquí — viven en la **bóveda de credenciales** (consulta las guías *Configurar módulo* y **Configuración global**).

## Idiomas (en la pestaña Datos)

Define el **idioma de origen** y los **idiomas de destino** a los que traducir en la pestaña **Datos**. El conjunto de idiomas de destino activos rige todas las demás pestañas — las columnas de entradas, las reglas de enrutamiento y las comprobaciones de calidad lo siguen.

## Importar y exportar CSV (en la pestaña Datos)

La importación y exportación de CSV también viven en la pestaña **Datos**:

* **Importar CSV** carga las entradas de origen y las traducciones que ya tuviera el archivo. Se toma automáticamente una instantánea de seguridad justo antes de cada importación, así que puedes retroceder desde la pestaña **Copia de seguridad**.
* Las filas que no se pueden analizar correctamente (una comilla seguida inmediatamente de una coma) se descartan y se notifican, en lugar de escribirse con las columnas desplazadas.
* **Exportar CSV** descarga el proyecto; puedes elegir los idiomas y si incluir la columna de contexto del traductor.
* Las exportaciones escriben el texto tal como está guardado, sin añadir un apóstrofo delante de las celdas que empiezan por = + - o @. Activa **Proteger para hojas de cálculo** solo en archivos que vayas a abrir en una hoja de cálculo, porque el editor de Miliastra conserva ese apóstrofo como texto. Las ejecuciones de traducción omiten las filas cuyo valor de Need translation? es FALSE. Un archivo de script de cliente protegido no debe volver a importarse ni enviarse al editor.

### Archivos de script de cliente

Un CSV con una columna **Text Mapping ID** es un archivo de script de cliente. Se importa a su propia colección, **Texto de script de cliente**, separada de tu **Texto principal**: la hoja de importación indica cuál detectó.

* Cada cadena de cliente se identifica por su Text Mapping ID, de modo que el mismo inglés puede aparecer en ambas colecciones, y en varias filas de cliente, sin fusionarse.
* Importar un archivo de cliente nunca cambia el texto principal, e importar un archivo principal nunca cambia el texto de cliente.
* Cuando cambia el inglés de una clave existente, en cualquiera de los dos modos de importación, la fila anterior pasa a la pestaña **Huérfanas** y la nueva conserva las traducciones del archivo; solo sus celdas vacías quedan sin traducir. Usa **Reasignar** para trasladar las traducciones: primero se sugiere la fila con la misma clave, y el modo de sobrescritura decide si las celdas ya rellenas se conservan o se reemplazan.
* Cuando un proyecto tiene cadenas de cliente, **Exportar CSV** permite elegir qué colección descargar, y una exportación de cliente mantiene su columna Text Mapping ID.

## Módulos y modelos

Habilita los proveedores una sola vez en **Configuración global**. Aquí, en Configuración, eliges, por proyecto, el **modelo** y el **esfuerzo de razonamiento** de cada módulo habilitado — o los dejas en *Heredar de la configuración global*. Qué módulo se ejecuta realmente para una entrada dada lo deciden las **reglas de enrutamiento** (consulta la guía *Enrutamiento*).

## Comprobaciones LQA

El panel **Comprobaciones LQA** configura la puerta de calidad que se ejecuta en cada traducción: activa o desactiva comprobaciones concretas (igualdad de etiquetas, límite de longitud, desbordamiento, cumplimiento del glosario, términos prohibidos, aserciones regex y más) y define cada una como **Bloqueante** o **Advertencia**. Los problemas bloqueantes hacen fallar la puerta y pueden provocar un reintento automático; las advertencias solo se notifican.

## Agrupación de lotes

La **agrupación de lotes** mantiene juntas las entradas relacionadas (por categoría y/o glosario) en la misma solicitud para que el modelo las vea en contexto. Puedes definir un valor predeterminado para el proyecto y anularlo por ejecución.

## Gestión del proyecto

La **Zona de peligro** te permite **Duplicar** el proyecto (configuración y entradas, nunca secretos) o **Eliminarlo** permanentemente.
