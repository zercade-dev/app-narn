# Módulo DeepL

## Descripción general

El módulo **DeepL** ofrece traducción automática neuronal profesional. A diferencia de los módulos LLM, es traducción automática clásica, y puede enviar los glosarios del proyecto a DeepL para mantener la terminología coherente. Su clave se almacena en la bóveda de credenciales bajo `DEEPL_API_KEY`.

## Añade tu clave a la bóveda de credenciales

Las credenciales de los proveedores viven en una **bóveda de credenciales** cifrada, no en la configuración en texto plano. Desbloqueas la bóveda una vez por sesión con una contraseña.

1. Abre **Configuración global** desde la barra lateral.
2. Si aún no has configurado la bóveda, créala: elige una contraseña de la bóveda (la reutilizarás en cada sesión) y desbloquéala.
3. En **Habilitar un módulo**, selecciona **DeepL**. Cuando falta una clave necesaria, el editor de la bóveda se abre directamente en la clave correspondiente — si no, haz clic en **Administrar bóveda de credenciales**.
4. En el editor de la bóveda, añade una credencial: elige la clave `DEEPL_API_KEY`, pega tu clave de autenticación como valor, introduce tu **contraseña de la bóveda** y haz clic en **Guardar**.

DeepL no admite instancias con nombre — solo existe un único módulo DeepL.

## Usar glosarios

DeepL puede aplicar un glosario durante la traducción. Crea términos en la pestaña **Glosario** y luego usa **Enviar a DeepL** para subirlos. Si un glosario cambia después de un envío, la pestaña muestra *Reenvío necesario* — vuelve a enviarlo para actualizar DeepL.

## Consigue una clave de API de DeepL

1. Visita [deepl.com/account](https://www.deepl.com/account).
2. Regístrate para una cuenta de API gratuita o Pro.
3. Abre **Account Settings** y busca la sección **API Key**.
4. Copia tu clave de autenticación.
5. Pégala en el valor de `DEEPL_API_KEY` en el editor de la bóveda.
