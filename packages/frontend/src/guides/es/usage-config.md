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

## Módulos y modelos

Habilita los proveedores una sola vez en **Configuración global**. Aquí, en Configuración, eliges, por proyecto, el **modelo** y el **esfuerzo de razonamiento** de cada módulo habilitado — o los dejas en *Heredar de la configuración global*. Qué módulo se ejecuta realmente para una entrada dada lo deciden las **reglas de enrutamiento** (consulta la guía *Enrutamiento*).

## Comprobaciones LQA

El panel **Comprobaciones LQA** configura la puerta de calidad que se ejecuta en cada traducción: activa o desactiva comprobaciones concretas (igualdad de etiquetas, límite de longitud, desbordamiento, cumplimiento del glosario, términos prohibidos, aserciones regex y más) y define cada una como **Bloqueante** o **Advertencia**. Los problemas bloqueantes hacen fallar la puerta y pueden provocar un reintento automático; las advertencias solo se notifican.

## Agrupación de lotes

La **agrupación de lotes** mantiene juntas las entradas relacionadas (por categoría y/o glosario) en la misma solicitud para que el modelo las vea en contexto. Puedes definir un valor predeterminado para el proyecto y anularlo por ejecución.

## Gestión del proyecto

La **Zona de peligro** te permite **Duplicar** el proyecto (configuración y entradas, nunca secretos) o **Eliminarlo** permanentemente.
