# Módulo Google AI (Gemini)

## Descripción general

El módulo **Google AI** traduce con los modelos Gemini de Google. Necesita una clave de API de Google AI Studio, almacenada en la bóveda de credenciales bajo la clave `GOOGLE_API_KEY`.

## Añade tu clave a la bóveda de credenciales

Las credenciales de los proveedores viven en una **bóveda de credenciales** cifrada, no en la configuración en texto plano. Desbloqueas la bóveda una vez por sesión con una contraseña.

1. Abre **Configuración global** desde la barra lateral.
2. Si aún no has configurado la bóveda, créala: elige una contraseña de la bóveda (la reutilizarás en cada sesión) y desbloquéala.
3. En **Habilitar un módulo**, selecciona **Google AI (Gemini)**. Cuando falta una clave necesaria, el editor de la bóveda se abre directamente en la clave correspondiente — si no, haz clic en **Administrar bóveda de credenciales**.
4. En el editor de la bóveda, añade una credencial: elige la clave `GOOGLE_API_KEY`, pega tu clave como valor, introduce tu **contraseña de la bóveda** y haz clic en **Guardar**.

Si una tarjeta muestra después *Bóveda bloqueada*, haz clic en **Desbloquear bóveda** antes de traducir.

## Elige un modelo

En la pestaña **Configuración** de un proyecto, elige un modelo de Gemini (y, opcionalmente, un esfuerzo de razonamiento), o hereda el valor predeterminado global. Las **reglas de enrutamiento** de la pestaña Enrutamiento deciden qué módulo gestiona cada idioma. Los modelos de razonamiento («thinking») reportan recuentos de tokens grandes en relación con los caracteres, así que las estimaciones de coste pueden parecer altas.

## Consigue una clave de API de Google

1. Visita [ai.google.dev](https://ai.google.dev) y haz clic en **Get API key**, o ve directamente a [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Haz clic en **Create API key** y selecciona tu proyecto.
3. Copia la clave generada.
4. Pégala en el valor de `GOOGLE_API_KEY` en el editor de la bóveda.
