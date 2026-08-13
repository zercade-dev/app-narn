# Módulo GitHub Copilot

## Descripción general

El módulo **Copilot** traduce a través de GitHub Copilot. Se autentica con un token de GitHub de una cuenta con una **suscripción activa a Copilot**, almacenado en la bóveda de credenciales bajo la clave `GITHUB_TOKEN`.

## Añade tu token a la bóveda de credenciales

Las credenciales de los proveedores viven en una **bóveda de credenciales** cifrada, no en la configuración en texto plano. Desbloqueas la bóveda una vez por sesión con una contraseña.

1. Abre **Configuración global** desde la barra lateral.
2. Si aún no has configurado la bóveda, créala: elige una contraseña de la bóveda (la reutilizarás en cada sesión) y desbloquéala.
3. En **Habilitar un módulo**, selecciona **GitHub Copilot**. Cuando falta una clave necesaria, el editor de la bóveda se abre directamente en la clave correspondiente — si no, haz clic en **Administrar bóveda de credenciales**.
4. En el editor de la bóveda, añade una credencial: elige la clave `GITHUB_TOKEN`, pega tu token como valor, introduce tu **contraseña de la bóveda** y haz clic en **Guardar**.

Si la lista de modelos muestra *No hay modelos disponibles*, el token falta, no es válido o la bóveda está bloqueada — desbloquea la bóveda o revisa tu token de GitHub, y vuelve a abrir la tarjeta.

## Consigue un token de GitHub

Usa un token de acceso personal **de grano fino** (*fine-grained*) para que conceda solo acceso a Copilot y nada más.

1. Visita [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).
2. Haz clic en **Generate new token** (los tokens de grano fino son la opción predeterminada).
3. Ponle un nombre (por ejemplo, «Translator-Copilot») y define una **Expiration**.
4. En **Permissions → Account permissions**, busca **Copilot Requests** y ponlo en **Read-only**. No se necesitan más permisos.
5. Haz clic en **Generate token** y cópialo de inmediato — GitHub lo muestra una sola vez.
6. Pégalo en el valor de `GITHUB_TOKEN` en el editor de la bóveda.

La cuenta a la que pertenece el token debe tener una suscripción activa a Copilot para que las traducciones funcionen.
