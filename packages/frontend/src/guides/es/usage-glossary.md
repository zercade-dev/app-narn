# Pestaña Glosario

## Descripción general

La pestaña **Glosario** mantiene la terminología coherente. Un proyecto puede tener varios glosarios; cada uno es una lista de términos de origen con una traducción por idioma de destino. Los glosarios se comparan automáticamente con las entradas, y los términos coincidentes se envían al modelo durante la traducción.

## Glosarios y términos

* Crea un glosario con **Nuevo glosario**; puedes renombrarlo o eliminarlo después.
* **Habilita** o **deshabilita** un glosario — un glosario deshabilitado se ignora durante la importación y la traducción.
* Añade términos con un **origen**, una **traducción por idioma** y **notas** opcionales.
* Marca un término como **constante** cuando nunca deba traducirse (nombres de marca, códigos). Los términos constantes se enmascaran durante la traducción para que pasen intactos.

Algunos glosarios son de **solo lectura** (gestionados de forma global) y aportan términos sin poder editarse aquí.

## Importar y exportar

Importa términos desde **CSV** o **TBX** — una vista previa muestra cuántos términos se añaden, se actualizan o entran en conflicto antes de aplicar. Exporta el glosario de vuelta a **CSV** o **TBX**.

## Generar con IA

* **Generar glosarios** analiza el texto de origen y propone glosarios de nombres recurrentes y términos personalizados. Se ejecuta en segundo plano — síguelo en la pestaña **Actividad** y revisa las sugerencias antes de crearlos. Puedes pasar glosarios existentes como «ya conocidos» para que el modelo no los repita.
* **Generar traducciones** completa las traducciones de destino de los términos a los que todavía les falten.

## DeepL

Si traduces con DeepL, usa **Enviar a DeepL** para subir los términos del glosario. Después de editar un glosario ya enviado, la pestaña muestra *Reenvío necesario* — vuelve a enviarlo para actualizar DeepL.

## Control por entrada

Desde la pestaña Traducciones puedes elegir qué glosarios están **habilitados** para una entrada concreta.
