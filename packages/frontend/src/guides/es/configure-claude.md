# Módulo Anthropic (Claude)

## Descripción general

El módulo **Claude** traduce con los modelos Claude de Anthropic. Necesita una clave de API de Anthropic, almacenada en la bóveda de credenciales bajo la clave `ANTHROPIC_API_KEY`.

## Añade tu clave a la bóveda de credenciales

Las credenciales de los proveedores viven en una **bóveda de credenciales** cifrada, no en la configuración en texto plano. Desbloqueas la bóveda una vez por sesión con una contraseña.

1. Abre **Configuración global** desde la barra lateral.
2. Si aún no has configurado la bóveda, créala: elige una contraseña de la bóveda (la reutilizarás en cada sesión) y desbloquéala.
3. En **Habilitar un módulo**, selecciona **Anthropic (Claude)**. Cuando falta una clave necesaria, el editor de la bóveda se abre directamente en la clave correspondiente — si no, haz clic en **Administrar bóveda de credenciales**.
4. En el editor de la bóveda, añade una credencial: elige la clave `ANTHROPIC_API_KEY`, pega tu clave como valor, introduce tu **contraseña de la bóveda** y haz clic en **Guardar**. Al guardar se vuelve a cifrar la bóveda.

Si una tarjeta muestra después *Bóveda bloqueada*, haz clic en **Desbloquear bóveda** antes de traducir.

## Elige un modelo

En la pestaña **Configuración** de un proyecto, elige un modelo de Claude (y, opcionalmente, un esfuerzo de razonamiento), o déjalo heredar el valor predeterminado global. Las **reglas de enrutamiento** de la pestaña Enrutamiento deciden qué módulo gestiona cada idioma.

## Consigue una clave de API de Anthropic

1. Visita [console.anthropic.com](https://console.anthropic.com).
2. Regístrate o inicia sesión.
3. Abre la sección **API keys**.
4. Haz clic en **Create Key** y cópiala.
5. Pégala en el valor de `ANTHROPIC_API_KEY` en el editor de la bóveda.
