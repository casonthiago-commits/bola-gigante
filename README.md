# BOLA GIGANTE — multiplayer

Jogo web multiplayer para até **60 alunos (30 por equipe)**, com controle individual por celular.

## O que já está implementado
- Professor cria sala e compartilha um código de 4 dígitos.
- Alunos entram com nome e código.
- Distribuição automática e equilibrada entre Azul e Vermelho.
- Joystick de toque no celular.
- Movimento sincronizado pelo servidor.
- Bola gigante com colisões e gols.
- Placar, cronômetro de 3 minutos, iniciar, pausar e reiniciar.
- Lista de participantes no painel.

## Executar no computador para testar
É necessário Node.js 18 ou superior.

```bash
npm install
npm start
```
Abra `http://localhost:3000`.

Para testar com celulares na mesma rede Wi-Fi, abra no navegador do celular:
`http://IP-DO-COMPUTADOR:3000` (substitua pelo IP local do computador).

## Publicar na internet
O projeto precisa ser hospedado em um serviço que execute Node.js e mantenha conexões WebSocket, por exemplo Render ou Railway.

1. Crie um repositório GitHub e envie todos os arquivos desta pasta.
2. No serviço de hospedagem, crie um novo serviço Web (Node).
3. Configure o comando de build como `npm install` e o comando de início como `npm start`.
4. Após publicar, copie o endereço HTTPS gerado.
5. O professor abre o endereço, cria a sala e compartilha o código com os alunos.

**Importante:** este ZIP contém o projeto-fonte. Ele ainda não é um link público hospedado. As salas ficam em memória no servidor; se o serviço reiniciar, as partidas ativas são encerradas. Para uso com uma turma, mantenha o serviço ativo durante a aula.
