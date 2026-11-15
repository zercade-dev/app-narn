# Pestaña Glosario

## Descripción general

La pestaña **Glosario** mantiene la terminología coherente. Un proyecto puede tener varios glosarios; cada uno es una lista de términos de origen con una traducción por idioma de destino. Los glosarios se comparan automáticamente con las entradas, y los términos coincidentes se envían al modelo durante la traducción.

## Glosarios y términos

* Crea un glosario con **Nuevo glosario**; puedes renombrarlo o eliminarlo después.
* **Habilita** o **deshabilita** un glosario — un glosario deshabilitado se ignora durante la importación y la traducción.
* Añade términos con un **origen**, una **traducción por idioma** y **notas** opcionales.
* Marca un término como **constante** cuando deba salir exactamente como está escrito en el glosario, como el nombre de un personaje o una marca; consulta *Términos constantes* más abajo.
* Un glosario tiene dos pestañas: **Términos** muestra sus términos y **Coincidencias** muestra las entradas que los contienen, donde puedes asignar el glosario a las entradas o quitarlo.

Algunos glosarios son de **solo lectura** (gestionados de forma global) y aportan términos sin poder editarse aquí.

## Términos constantes

* Un término constante **nunca se envía al motor de traducción**. NARN lo sustituye por un marcador antes de traducir y después pone en su lugar la traducción del glosario, así que un nombre de personaje como *Diluc* siempre sale tal como está escrito en el glosario.
* **Las mayúsculas importan.** Solo se protege el texto escrito exactamente como el término: *Razor* (el personaje) sí, *a razor* no. Cualquier otra forma se envía al motor como una pista normal del glosario, marcada como nombre, para que distinga el nombre de la palabra corriente.
* **El motor no puede cambiar la palabra.** Como nunca ve el término, no puede declinarlo ni hacer concordar otras palabras con él: en idiomas como el ruso, el coreano o el turco, un nombre constante aparece siempre en su forma base. Reserva constante para nombres y códigos que deben quedar fijos.
* Deja como términos normales los nombres que también son palabras corrientes, porque los títulos y las etiquetas suelen ponerlos en mayúscula (*Gaming Settings*). En el glosario incluido **Genshin Characters**, todos los nombres son constantes salvo Gaming, Amber, Razor, Sucrose y Prune.

## Importar y exportar

Importa términos desde **CSV** o **TBX** — una vista previa muestra cuántos términos se añaden, se actualizan o entran en conflicto antes de aplicar. Exporta el glosario de vuelta a **CSV** o **TBX**.

## Generar con IA

* **Generar glosarios** analiza el texto de origen y propone glosarios de nombres recurrentes y términos personalizados. Se ejecuta en segundo plano — síguelo en la pestaña **Actividad** y revisa las sugerencias antes de crearlos. Puedes pasar glosarios existentes como «ya conocidos» para que el modelo no los repita.
* **Generar traducciones** completa las traducciones de destino de los términos a los que todavía les falten.

## DeepL

Si traduces con DeepL, usa **Enviar a DeepL** para subir los términos del glosario. Después de editar un glosario ya enviado, la pestaña muestra *Reenvío necesario* — vuelve a enviarlo para actualizar DeepL.

## Control por entrada

Desde la pestaña Traducciones puedes elegir qué glosarios están **habilitados** para una entrada concreta.
