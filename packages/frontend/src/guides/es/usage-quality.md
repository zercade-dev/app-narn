# Pestaña Calidad

## Descripción general

La pestaña **Calidad** es un panel que agrega los resultados de LQA (Language Quality Assurance, control de calidad lingüística) producidos cada vez que se traducen entradas. Muestra tu tasa de aprobación general y dónde se concentran los problemas, para que puedas encontrar rápido las zonas problemáticas. Se va llenando a medida que traduces — si está vacío, ejecuta primero una traducción.

## Qué muestra

* **Tasa de aprobación general** en todos los resultados de LQA y las entradas que cubren.
* **Tasa de aprobación por idioma** — calidad por idioma de destino.
* **Problemas por origen** — recuentos por tipo de problema agrupados por etiqueta de origen.
* **Calidad por módulo** — tasa de aprobación y problemas agrupados por el módulo que produjo cada traducción.

## Profundizar

Haz clic en cualquier celda para saltar a las entradas correspondientes — el panel filtra la tabla de **Traducciones** hasta las entradas afectadas para que puedas corregirlas.

## De dónde vienen las comprobaciones

Cada traducción pasa por la puerta LQA, que ejecuta las comprobaciones que habilitaste en el panel *Comprobaciones LQA* de la pestaña **Configuración** (igualdad de etiquetas, límite de longitud, desbordamiento, cumplimiento del glosario, términos prohibidos, aserciones regex y más). Las comprobaciones **bloqueantes** hacen fallar la puerta y pueden provocar un reintento automático; las comprobaciones de **advertencia** se notifican aquí sin bloquear. Ajusta qué comprobaciones se ejecutan, y su severidad, en Configuración.
