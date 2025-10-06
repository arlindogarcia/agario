# 🎮 Agar.io Clone - Multiplayer Game

Jogo multiplayer em tempo real inspirado no Agar.io, desenvolvido com Node.js, Socket.io e HTML5 Canvas.

## 🚀 Características

- ✅ Multiplayer em tempo real
- ✅ Upload de avatar personalizado
- ✅ Sistema de física e colisões realista
- ✅ Split (divisão de células) com ESPAÇO
- ✅ Eject (ejetar massa) com tecla W
- ✅ Leaderboard ao vivo
- ✅ Sistema de câmera suave com zoom
- ✅ Grid e bordas do mundo
- ✅ Regeneração automática de comida
- ✅ Recombinação de células após 30 segundos

## 📋 Pré-requisitos

- Node.js 14+ instalado
- Navegador moderno (Chrome, Firefox, Safari, Edge)

## 🔧 Instalação

1. As dependências já foram instaladas
2. Estrutura do projeto:

```
agario/
├── server/
│   ├── game/
│   │   └── Game.js          # Lógica principal do jogo
│   ├── entities/
│   │   ├── Cell.js          # Classe de célula
│   │   ├── Player.js        # Classe de jogador
│   │   └── Food.js          # Classe de comida
│   └── index.js             # Servidor Express + Socket.io
├── public/
│   ├── index.html           # Tela de entrada
│   ├── game.html            # Tela do jogo
│   ├── css/
│   │   └── style.css        # Estilos
│   ├── js/
│   │   ├── lobby.js         # Lógica da tela de entrada
│   │   └── game.js          # Cliente do jogo
│   └── uploads/             # Avatares enviados
└── package.json
```

## 🎯 Como Rodar

### Modo Desenvolvimento (com auto-restart)

```bash
cd agario
npm run dev
```

### Modo Produção

```bash
cd agario
npm start
```

O servidor irá rodar em `http://0.0.0.0:3000`

## 🌐 Acessar pela Internet (IP Público)

Para jogar pela internet usando seu IP público:

1. Inicie o servidor:
   ```bash
   cd agario
   npm start
   ```

2. Descubra seu IP público:
   - Google: "meu ip"
   - Ou use: `curl ifconfig.me`

3. Configure o roteador:
   - Abra o painel do seu roteador
   - Configure **Port Forwarding** da porta **3000** para o IP local da sua máquina
   - Protocolo: TCP

4. Compartilhe o link:
   ```
   http://SEU_IP_PUBLICO:3000
   ```

### Dica: Usar Ngrok (sem configurar roteador)

Alternativa mais fácil para testar:

```bash
# Instalar ngrok
npm install -g ngrok

# Em um terminal, rode o servidor
npm start

# Em outro terminal, rode o ngrok
ngrok http 3000
```

O ngrok vai te dar uma URL pública temporária (ex: `https://abc123.ngrok.io`)

## 🎮 Como Jogar

1. Acesse o jogo pelo navegador
2. Digite seu nome
3. (Opcional) Faça upload de uma foto para seu avatar
4. Clique em **JOGAR**

### Controles:

- **Mouse**: Mover sua célula
- **ESPAÇO**: Dividir célula (split)
- **W**: Ejetar massa

### Objetivo:

- Coma células menores que você
- Coma comida para crescer
- Evite ser comido por células maiores
- Chegue ao topo do ranking!

## 🛠️ Tecnologias Utilizadas

- **Backend**:
  - Node.js
  - Express.js
  - Socket.io (WebSocket em tempo real)
  - Multer (upload de arquivos)

- **Frontend**:
  - HTML5 Canvas
  - JavaScript Vanilla
  - CSS3 (Grid, Flexbox, Animations)
  - Socket.io Client

## 📊 Configurações do Jogo

Você pode ajustar as configurações editando os arquivos:

### `server/game/Game.js`:
- `width` / `height`: Tamanho do mundo (padrão: 10000x10000)
- `generateFood()`: Quantidade de comida inicial e regeneração

### `server/entities/Player.js`:
- `spawnCell()`: Tamanho inicial da célula (raio: 20)
- `split()`: Cooldown e limite de células (16 max)

### `server/entities/Cell.js`:
- `getSpeed()`: Velocidade das células baseado no tamanho

## 🐛 Solução de Problemas

### Porta 3000 já está em uso:
```bash
# Mudar a porta (adicione antes de npm start):
PORT=8080 npm start
```

### Erro de upload de imagem:
- Verifique se a pasta `public/uploads` existe
- Tamanho máximo: 5MB
- Formatos: JPG, PNG, GIF

### Lag ou latência:
- Use servidor com melhor conexão
- Reduza quantidade de comida no `Game.js`
- Otimize a taxa de atualização no `server/index.js` (TICK_RATE)

## 📝 Melhorias Futuras

- [ ] Sistema de skins customizáveis
- [ ] Modo de jogo com equipes
- [ ] Power-ups especiais
- [ ] Persistência de estatísticas (banco de dados)
- [ ] Múltiplas salas/regiões
- [ ] Chat in-game
- [ ] Mobile touch controls
- [ ] Replay system

## 📄 Licença

MIT - Sinta-se livre para usar e modificar!

## 🤝 Contribuindo

Pull requests são bem-vindos! Para mudanças grandes, abra uma issue primeiro.

---

**Divirta-se jogando! 🎮🔥**
