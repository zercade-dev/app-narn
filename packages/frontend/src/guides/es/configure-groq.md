# Módulo Groq

## Descripción general

El módulo **Groq** traduce con [Groq](https://groq.com) — inferencia rápida para modelos abiertos como Llama, Qwen y GPT-OSS, con un nivel gratuito que se ajusta al trabajo de traducción cotidiano. Necesita una clave de API de Groq, almacenada en la bóveda de credenciales bajo la clave `GROQ_API_KEY`.

## Añade tu clave a la bóveda de credenciales

Las credenciales de los proveedores viven en una **bóveda de credenciales** cifrada, no en la configuración en texto plano. Desbloqueas la bóveda una vez por sesión con una contraseña.

1. Abre **Configuración global** desde la barra lateral.
2. Si aún no has configurado la bóveda, créala: elige una contraseña de la bóveda (la reutilizarás en cada sesión) y desbloquéala.
3. En **Habilitar un módulo**, selecciona **Groq**. Cuando falta una clave necesaria, el editor de la bóveda se abre directamente en la clave correspondiente — si no, haz clic en **Administrar bóveda de credenciales**.
4. En el editor de la bóveda, añade una credencial: elige la clave `GROQ_API_KEY`, pega tu clave como valor, introduce tu **contraseña de la bóveda** y haz clic en **Guardar**.

Si una tarjeta muestra después *Bóveda bloqueada*, haz clic en **Desbloquear bóveda** antes de traducir.

## Elige un modelo

En la pestaña **Configuración** de un proyecto, elige un modelo del catálogo de Groq en vivo, o hereda el valor global predeterminado. `llama-3.3-70b-versatile` es una buena opción predeterminada para la calidad de traducción; modelos más pequeños como `llama-3.1-8b-instant` sacrifican algo de calidad por velocidad. Las **reglas de enrutamiento** de la pestaña Enrutamiento deciden qué módulo gestiona cada idioma.

## Consigue una clave de API de Groq

1. Visita [console.groq.com](https://console.groq.com).
2. Regístrate o inicia sesión.
3. Abre **API Keys** desde el menú de la consola.
4. Crea una nueva clave de API y cópiala — empieza con `gsk_`.
5. Pégala en el valor de `GROQ_API_KEY` en el editor de la bóveda.

El nivel gratuito de Groq aplica límites diarios por modelo (sin cifras fijas aquí — consulta tu consola para ver los límites actuales), y según los términos de Groq, los datos de la API no se usan para entrenar modelos. Una vez añadida tu clave, **NARN Freeway** incluye automáticamente el plan gratuito de Groq al repartir el trabajo de traducción entre las cuotas gratuitas de tus proveedores conectados — sin configuración adicional.
