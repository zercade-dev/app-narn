# Bóveda de credenciales

## Descripción general

Las claves de API de los proveedores nunca se guardan en archivos de configuración en texto plano ni en variables de entorno. Viven en la **bóveda de credenciales** — un almacén cifrado que debe desbloquearse antes de que cualquier traducción o revisión IA pueda usar una credencial. Desbloqueas una vez por sesión de navegador; las credenciales se descifran solo en memoria.

<!-- local-only -->
## Bóveda con contraseña (autoalojado)

En una instalación autoalojada, la bóveda es un archivo local cifrado. El primer desbloqueo la crea: la contraseña que elijas se convierte en la contraseña de la bóveda, y cada credencial que guardes vuelve a cifrar el archivo. La contraseña en sí nunca se almacena — sin ella, el archivo no se puede descifrar. Desbloquéala desde **Configuración global**, o desde cualquier tarjeta que muestre *Bóveda bloqueada*.
<!-- /local-only -->

## Bóveda vinculada al dispositivo (nube)

En la versión en la nube, la bóveda se guarda **cifrada en el servidor**, y descifrarla requiere dos factores:

- Tu **contraseña** — nunca se almacena en ningún sitio, ni en el servidor ni en el dispositivo.
- Una **clave por dispositivo** — generada en tu navegador cuando inscribes un dispositivo, y que se guarda solo en ese dispositivo.

Cuando desbloqueas, ambos factores viajan por la conexión cifrada y se combinan en el servidor para derivar la clave de descifrado **en memoria, solo para tu sesión**. Ni los factores ni la clave derivada se escriben nunca en el almacenamiento del servidor — lo único que se guarda es la bóveda cifrada en sí. Así que los datos guardados en el servidor por sí solos no pueden revelar tus credenciales, y una contraseña filtrada tampoco basta por sí sola: desbloquearla también requiere uno de tus dispositivos inscritos.

Si Configuración global muestra un botón **Ir a la página de credenciales** en lugar de un aviso de contraseña, estás en la bóveda vinculada al dispositivo — la página de la bóveda gestiona la configuración inicial, la inscripción de dispositivos, el desbloqueo, la edición de credenciales y los cambios de contraseña.

## Bueno saberlo

- Un dispositivo que nunca hayas usado debe **inscribirse** en la página de la bóveda antes de poder desbloquearla.
- Si pierdes tu contraseña (o, en la nube, todos tus dispositivos inscritos), el contenido de la bóveda no se puede recuperar — tendrás que configurar la bóveda de nuevo y volver a introducir las claves de tus proveedores.
- Todo lo que registra la aplicación pasa por un proceso de redacción, así que los valores de las credenciales nunca aparecen en los registros.
