# Pestaña Copia de seguridad

## Descripción general

La pestaña **Copia de seguridad** empaqueta un proyecto — su configuración, sus entradas y su glosario — en un archivo `.zip` verificable. Cada archivo lleva su suma de verificación, y las sumas se comprueban antes de escribir nada al restaurar.

## Crear una copia de seguridad

1. Selecciona un proyecto.
2. Abre la pestaña **Copia de seguridad**.
3. Haz clic en **Crear copia de seguridad**.
4. El nuevo archivo aparece en **Copias guardadas**, donde puedes **Descargar** el archivo.

## Copias de seguridad automáticas

La aplicación también toma instantáneas de seguridad por ti, listadas junto a las copias manuales:

* **Antes de una importación CSV** — un punto de restauración justo antes de la importación.
* **Antes de una retraducción** — un punto de restauración justo antes de que se sobrescriban las entradas.

Configuración global fija **Máx. copias de seguridad por proyecto** (10 por defecto); las copias más antiguas se eliminan al superar ese número.

## Restaurar

1. En **Restaurar desde copia**, selecciona un `.zip` (o elige una de las copias guardadas).
2. La aplicación comprueba las sumas de verificación y muestra una vista previa (proyecto, archivos, fecha de creación).
3. Confirma. Restaurar sobrescribe la configuración, las entradas y el glosario actuales del proyecto — esto no se puede deshacer, así que crea una copia de seguridad reciente primero si tienes dudas.

## Eliminar

Usa **Eliminar** en cualquier copia guardada para quitar ese archivo del servidor de forma permanente.
