# Pestaña Huérfanas

## Descripción general

La pestaña **Huérfanas** lista las entradas que ya no están en el CSV importado más recientemente. Suelen aparecer tras una nueva importación en la que se quitó una fila, se renombró o cambió su texto de origen — las traducciones anteriores se conservan aquí para que no pierdas ese trabajo.

## Qué puedes hacer

* **Eliminar** una huérfana para quitar de forma permanente el registro y sus traducciones (esto no se puede deshacer).
* **Reasignar** una huérfana para mover sus traducciones a otra entrada. Busca el destino por su texto de origen; las traducciones existentes en el destino se conservan y solo se completan sus idiomas vacíos.
* Selecciona varias huérfanas y usa **Eliminar seleccionadas** en bloque, o **Actualizar** la lista.

## Flujo de trabajo

1. Vuelve a importar tu CSV de origen desde la pestaña **Configuración**.
2. Abre **Huérfanas** y revisa qué se quedó fuera.
3. **Reasigna** cualquier entrada cuyo id o texto de origen cambió pero cuyas traducciones siguen siendo válidas.
4. **Elimina** las entradas que realmente ya no existen.

Cuando la lista está vacía, todas las entradas importadas coinciden con el proyecto actual — no hay ninguna huérfana.
