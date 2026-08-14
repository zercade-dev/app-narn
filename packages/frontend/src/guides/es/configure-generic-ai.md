# Módulo Generic AI

## Descripción general

El módulo **Generic AI** se conecta a cualquier API compatible con OpenAI: un proveedor alojado o un servidor local (por ejemplo, Ollama, LM Studio, vLLM). Su clave se almacena en la bóveda de credenciales bajo `GENERIC_API_KEY`.

**La clave de API es opcional.** Solo importa para extremos que exigen autenticación (la mayoría de los proveedores de pago en la nube). Un servidor local como Ollama o LM Studio no necesita una clave real — pero la bóveda igualmente exige que el campo `GENERIC_API_KEY` no esté vacío, así que guarda cualquier valor de relleno (por ejemplo, `local`) para satisfacerlo.

## Añade tu clave a la bóveda de credenciales

Las credenciales de los proveedores viven en una **bóveda de credenciales** cifrada, no en la configuración en texto plano. Desbloqueas la bóveda una vez por sesión con una contraseña.

1. Abre **Configuración global** desde la barra lateral.
2. Si aún no has configurado la bóveda, créala: elige una contraseña de la bóveda (la reutilizarás en cada sesión) y desbloquéala.
3. En **Habilitar un módulo**, selecciona **Generic AI**. Cuando falta una clave necesaria, el editor de la bóveda se abre directamente en la clave correspondiente — si no, haz clic en **Administrar bóveda de credenciales**.
4. En el editor de la bóveda, añade una credencial: elige la clave `GENERIC_API_KEY`, introduce tu **contraseña de la bóveda** y haz clic en **Guardar**. Para un extremo de pago, pega la clave de API real como valor. Para un servidor local que no necesita autenticación, la clave es opcional — basta con guardar cualquier valor de relleno no vacío (por ejemplo, `local`).

## Ejecuta más de un extremo con instancias

Generic AI admite **instancias con nombre**, así que puedes registrar varios extremos (por ejemplo, un proveedor en la nube y un servidor local) uno junto a otro. Usa **Añadir otra instancia de Generic AI…** en Configuración global. Cada instancia obtiene su propia clave de bóveda derivada — por ejemplo, `GENERIC_API_KEY__MY-OLLAMA` — que rellenas en ese mismo editor de la bóveda.

## Elige extremo y modelo

Define la URL base y el modelo del módulo (o de cada instancia) en sus ajustes de Configuración global, y luego elige el modelo por proyecto en la pestaña **Configuración**. Las **reglas de enrutamiento** de la pestaña Enrutamiento deciden qué módulo o instancia gestiona cada idioma.

## Consigue las credenciales

Para un **servidor local** (Ollama, LM Studio, vLLM) no hace falta cuenta ni clave — solo la URL base (por ejemplo, `http://localhost:11434/v1`) y un valor de relleno en el campo `GENERIC_API_KEY`.

Para un **proveedor de pago**, los pasos dependen del proveedor: crea una cuenta, obtén la URL base y la clave de API, y confirma que el extremo habla el formato de finalización de chat de OpenAI antes de introducir la clave en la bóveda.
