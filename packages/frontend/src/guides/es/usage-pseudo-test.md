# Pseudo Test

## Descripción general

**Pseudo Test** no es un idioma real. Es un idioma de control de calidad gratuito y sin conexión que reescribe tu texto de origen en una versión deliberadamente deformada, para que puedas cargarlo en tu juego y ver qué cadenas rompen la interfaz — antes de que exista una sola traducción real.

No cuesta nada, no necesita clave de API y nunca envía nada a un proveedor.

## Qué produce

`Save changes` se convierte en algo como `⟦Şàvé çhàñgéş~~~~⟧`. Ocurren tres cosas a la vez, y cada una expone un tipo distinto de error:

* **Letras acentuadas.** Cada letra se sustituye por una parecida con acento. Cualquier texto que siga apareciendo en inglés normal en tu juego nunca llegó a la tabla de cadenas — está codificado a mano, y ningún traductor podrá alcanzarlo jamás.
* **Relleno.** El texto se estira con caracteres `~` hasta aproximadamente 1,4× su longitud original, simulando idiomas como el alemán, que ocupan más espacio. Las etiquetas que desbordan sus botones, se ajustan mal o desplazan el diseño se detectan de inmediato.
* **Corchetes.** El resultado se envuelve en `⟦…⟧`. Si falta alguno de los dos corchetes en pantalla, esa cadena se está truncando.

Los marcadores y las etiquetas de formato de tu texto pasan sin alterarse, así que si alguno sale deformado, es un error que vale la pena reportar, no un problema de diseño.

## Cómo usarlo

1. En la pestaña **Datos**, marca **Pseudo Test** en *Idiomas de destino* y guarda.
2. Ejecuta una traducción como de costumbre. Las entradas de Pseudo Test siempre las gestiona el generador pseudo integrado — no hay nada que habilitar, ninguna regla de enrutamiento que escribir y ningún coste. Tus proveedores de pago nunca ven estas cadenas.
3. Tus traducciones reales están a salvo: el texto de Pseudo Test se guarda en su propia columna y nunca puede sobrescribir otro idioma.

## Llevarlo a tu juego

En la tarjeta de exportación, define **Exportar texto pseudo como** a un idioma que no estés publicando actualmente — el alemán, por ejemplo — y luego descarga el archivo y cárgalo en el juego con ese idioma seleccionado. La columna del idioma elegido se rellena con el texto de Pseudo Test solo para esa descarga; nada de lo guardado cambia, y las traducciones reales siguen ahí la próxima vez que exportes.

Cuando termines de probar, exporta de nuevo con la sustitución vuelta a **Sin sustitución**. Una exportación normal nunca contiene una columna de Pseudo Test — el texto pseudo solo llega a tu juego a través de la sustitución anterior — así que dejar Pseudo Test activado no afecta a los archivos que publicas.

## Cuándo usarlo

Haz una pasada de pseudo pronto, antes de encargar cualquier traducción. Cada error de diseño que encuentre es uno que arreglas una sola vez, en lugar de quince veces después de que lleguen quince idiomas.
