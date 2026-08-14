# Cofre de credenciais

## Visão geral

As chaves de API dos provedores nunca ficam em arquivos de configuração em
texto simples nem em variáveis de ambiente. Elas vivem no **cofre de
credenciais** — um armazenamento criptografado que precisa ser desbloqueado
antes que qualquer tradução ou revisão por IA possa usar uma credencial. Você
desbloqueia uma vez por sessão do navegador; as credenciais são
descriptografadas apenas em memória.

<!-- local-only -->
## Cofre de senha (self-hosted)

Em uma instalação self-hosted, o cofre é um arquivo local criptografado. O
primeiro desbloqueio o cria: a senha que você escolhe se torna a senha do
cofre, e toda credencial que você salva recriptografa o arquivo. A senha em
si nunca é armazenada — sem ela, o arquivo não pode ser descriptografado.
Desbloqueie pela **Configuração global**, ou por qualquer cartão *Cofre
bloqueado*.
<!-- /local-only -->

## Cofre vinculado ao dispositivo (nuvem)

Na versão em nuvem, o cofre é armazenado **criptografado no servidor**, e
descriptografá-lo exige dois fatores:

- Sua **senha** — nunca armazenada em nenhum lugar, nem no servidor, nem no
  dispositivo.
- Uma **chave por dispositivo** — gerada no seu navegador quando você
  registra um dispositivo, e mantida somente nele.

Quando você desbloqueia, os dois fatores trafegam pela conexão criptografada
e são combinados no lado do servidor para derivar a chave de
descriptografia **em memória, só durante a sua sessão**. Nem os fatores nem
a chave derivada são jamais gravados no armazenamento do servidor — o que
fica armazenado é só o cofre criptografado em si. Assim, os dados
armazenados no servidor sozinhos não conseguem revelar suas credenciais, e
uma senha vazada sozinha também não basta: desbloquear também exige um dos
seus dispositivos registrados.

Se a Configuração global mostrar um botão **Ir para a página do cofre** em
vez de um campo de senha, você está no cofre vinculado ao dispositivo — a
página do Cofre cuida da configuração, do registro de dispositivos, do
desbloqueio, da edição de credenciais e das trocas de senha.

## Bom saber

- Um dispositivo nunca usado antes precisa ser **registrado** na página do
  Cofre antes de conseguir desbloquear.
- Se você perder sua senha (ou, na nuvem, todos os dispositivos
  registrados), o conteúdo do cofre não pode ser recuperado — você vai
  precisar configurar o cofre de novo e reinserir suas chaves dos provedores.
- Qualquer coisa que o app registra em log passa por um filtro que remove
  dados sensíveis, então valores de credenciais nunca aparecem nos logs.
