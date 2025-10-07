# Avatares Pré-definidos

Este diretório contém os avatares padrão que os jogadores podem selecionar.

## Como Adicionar Seus Próprios Avatares

### 1. Adicione suas imagens neste diretório

Você pode usar qualquer formato de imagem:
- **JPG/JPEG** - Recomendado para fotos
- **PNG** - Recomendado para imagens com transparência
- **SVG** - Recomendado para ícones vetoriais
- **GIF** - Suportado (mas sem animação no jogo)

**Dica:** Imagens quadradas (100x100px, 200x200px, etc.) funcionam melhor.

### 2. Edite o arquivo `avatars.json`

Abra `avatars.json` e adicione seu avatar:

```json
[
  {
    "id": "jogador1",
    "name": "Jogador 1",
    "file": "jogador1.jpg"
  },
  {
    "id": "monstro",
    "name": "Monstro",
    "file": "monstro.png"
  },
  {
    "id": "robo",
    "name": "Robô",
    "file": "robo.jpg"
  }
]
```

### 3. Campos do JSON

- **id**: Identificador único (use letras minúsculas, sem espaços)
- **name**: Nome exibido para o jogador (pode ter espaços e acentos)
- **file**: Nome do arquivo da imagem (deve estar neste diretório)

## Exemplos de Nomes

Aqui estão algumas ideias de avatares que você pode criar:

### Personagens
- Guerreiro
- Mago
- Ninja
- Pirata
- Cavaleiro

### Animais
- Leão
- Águia
- Tubarão
- Dragão
- Lobo

### Outros
- Alienígena
- Robô
- Fantasma
- Estrela
- Foguete

## Substituir os Avatares Padrão

Para substituir os avatares SVG por suas próprias imagens:

1. Delete os arquivos `avatar1.svg` até `avatar8.svg`
2. Adicione suas imagens (ex: `guerreiro.jpg`, `mago.jpg`, etc.)
3. Edite `avatars.json` com os novos nomes de arquivo
4. Reinicie o servidor

## Exemplo Completo

```bash
# Estrutura de arquivos
public/avatars/
├── avatars.json
├── guerreiro.jpg
├── mago.jpg
├── ninja.png
├── pirata.jpg
└── README.md
```

```json
// avatars.json
[
  {
    "id": "guerreiro",
    "name": "Guerreiro",
    "file": "guerreiro.jpg"
  },
  {
    "id": "mago",
    "name": "Mago",
    "file": "mago.jpg"
  },
  {
    "id": "ninja",
    "name": "Ninja",
    "file": "ninja.png"
  },
  {
    "id": "pirata",
    "name": "Pirata",
    "file": "pirata.jpg"
  }
]
```

Pronto! Seus avatares personalizados aparecerão na tela de seleção.
