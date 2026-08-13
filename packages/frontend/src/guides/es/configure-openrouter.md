# Módulo OpenRouter

## Descripción general

El módulo **OpenRouter** traduce con [OpenRouter](https://openrouter.ai) — una única API que enruta hacia modelos de muchos proveedores (Anthropic, OpenAI, Google, Meta y más). Necesita una clave de API de OpenRouter, almacenada en la bóveda de credenciales bajo la clave `OPENROUTER_API_KEY`.

## Añade tu clave a la bóveda de credenciales

Las credenciales de los proveedores viven en una **bóveda de credenciales** cifrada, no en la configuración en texto plano. Desbloqueas la bóveda una vez por sesión con una contraseña.

1. Abre **Configuración global** desde la barra lateral.
2. Si aún no has configurado la bóveda, créala: elige una contraseña de la bóveda (la reutilizarás en cada sesión) y desbloquéala.
3. En **Habilitar un módulo**, selecciona **OpenRouter**. Cuando falta una clave necesaria, el editor de la bóveda se abre directamente en la clave correspondiente — si no, haz clic en **Administrar bóveda de credenciales**.
4. En el editor de la bóveda, añade una credencial: elige la clave `OPENROUTER_API_KEY`, pega tu clave como valor, introduce tu **contraseña de la bóveda** y haz clic en **Guardar**.

Si una tarjeta muestra después *Bóveda bloqueada*, haz clic en **Desbloquear bóveda** antes de traducir.

## Elige un modelo

En la pestaña **Configuración** de un proyecto, elige un modelo del catálogo de OpenRouter en vivo — cada entrada muestra su precio por token y su longitud de contexto, y solo se listan modelos de generación de texto. Los id de modelo llevan el prefijo del proveedor (por ejemplo, `anthropic/claude-sonnet-4.5` u `openai/gpt-4o-mini`); también puedes escribir un slug nuevo directamente. Las **reglas de enrutamiento** de la pestaña Enrutamiento deciden qué módulo gestiona cada idioma.

## Consigue una clave de API de OpenRouter

1. Visita [openrouter.ai](https://openrouter.ai).
2. Regístrate o inicia sesión.
3. Abre **Keys** desde el menú de tu cuenta.
4. Crea una nueva clave de API y cópiala.
5. Pégala en el valor de `OPENROUTER_API_KEY` en el editor de la bóveda.

Nota: tu texto se envía a OpenRouter y se enruta hacia el proveedor del modelo que elijas, según los términos de OpenRouter y la política de datos de ese proveedor.
