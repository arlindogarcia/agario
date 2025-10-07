# 🎮 Gotar Games - Portal de Jogos

Portal de jogos multiplayer e casual desenvolvido com Node.js, Socket.io e HTML5 Canvas.

Atualmente contém:
- **Gotargario**: Clone do Agar.io com multiplayer em tempo real
- **Gotardino**: Jogo do dinossauro (em breve)

## 🚀 Características do Gotargario

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
gotar-games/
├── index.html               # Portal principal com lista de jogos
├── games/
│   ├── gotargario/          # Jogo Gotargario (Agar.io clone)
│   │   ├── index.html       # Tela de entrada
│   │   ├── game.html        # Tela do jogo
│   │   ├── css/
│   │   │   └── style.css
│   │   ├── js/
│   │   │   ├── lobby.js
│   │   │   └── game.js
│   │   ├── avatars/
│   │   ├── backgrounds/
│   │   └── uploads/
│   └── gotardino/           # Jogo Gotardino (em breve)
│       └── index.html
├── server/
│   ├── game/
│   │   └── Game.js          # Lógica principal do jogo
│   ├── entities/
│   │   ├── Cell.js          # Classe de célula
│   │   ├── Player.js        # Classe de jogador
│   │   └── Food.js          # Classe de comida
│   └── index.js             # Servidor Express + Socket.io
├── public/                  # Legacy (manter para compatibilidade)
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

Para acessar o portal de jogos, abra `http://localhost:3000` ou simplesmente abra o arquivo `index.html` no navegador.

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

## ➕ Como Adicionar Novos Jogos

Para adicionar um novo jogo ao portal:

1. Crie uma pasta dentro de `games/` com o nome do jogo:
   ```bash
   mkdir games/seu-jogo
   ```

2. Adicione os arquivos do jogo (HTML, JS, CSS, assets) dentro dessa pasta

3. Edite o arquivo `index.html` na raiz e adicione um novo card para o jogo:
   ```html
   <div class="game-card bg-white rounded-2xl shadow-2xl overflow-hidden cursor-pointer"
        onclick="window.location.href='games/seu-jogo/index.html'">
       <!-- Personalize o card com ícone, título, descrição e tags -->
   </div>
   ```

4. Pronto! O novo jogo aparecerá no portal.

## 📝 Melhorias Futuras

### Gotargario:
- [ ] Sistema de skins customizáveis
- [ ] Modo de jogo com equipes
- [ ] Power-ups especiais
- [ ] Persistência de estatísticas (banco de dados)
- [ ] Múltiplas salas/regiões
- [ ] Chat in-game
- [ ] Mobile touch controls
- [ ] Replay system

### Portal:
- [ ] Sistema de busca de jogos
- [ ] Categorias/filtros
- [ ] Sistema de favoritos
- [ ] Estatísticas de jogo (tempo jogado, high scores)

## 📄 Licença

MIT - Sinta-se livre para usar e modificar!

## 🤝 Contribuindo

Pull requests são bem-vindos! Para mudanças grandes, abra uma issue primeiro.

---

**Divirta-se jogando! 🎮🔥**
