# Dota 2 GC Service

Microserviço em Go para interação com o Game Coordinator do Dota 2, permitindo criação e gerenciamento de lobbies customizadas.

## Pré-requisitos

- Go 1.22+
- Protocol Buffers compiler (`protoc`)
- Uma conta Steam **separada** para o bot (não use sua conta pessoal!)

## Setup

### 1. Criar conta Steam para o bot

1. Crie uma nova conta Steam em https://store.steampowered.com/join/
2. Adicione o Dota 2 (grátis) à biblioteca
3. Inicie o Dota 2 pelo menos uma vez para ativar a conta
4. Habilite o Steam Guard (recomendado)

> ⚠️ **AVISO**: Use uma conta dedicada para o bot. A Valve pode detectar e banir contas usando o Game Coordinator programaticamente.

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Edite .env com as credenciais do bot
```

### 3. Instalar dependências

```bash
go mod download
```

### 4. Gerar código protobuf

```bash
# Instalar plugins (apenas uma vez)
go install google.golang.org/protobuf/cmd/protoc-gen-go@latest
go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Gerar
make proto
```

### 5. Build e execução

```bash
# Build
make build

# Executar
./dota-gc

# Ou com debug
DEBUG=true ./dota-gc
```

## Arquitetura

```
cmd/server/           - Entry point
internal/
  bot/
    client.go        - Steam/Dota2 client wrapper
    lobby.go         - Operações de lobby
  api/
    grpc/            - Servidor gRPC
    http/            - Servidor HTTP (health checks)
  config/            - Configuração
proto/               - Definições protobuf
```

## API gRPC

O serviço expõe os seguintes métodos via gRPC:

| Método | Descrição |
|--------|-----------|
| `CreateLobby` | Cria uma nova lobby |
| `InvitePlayers` | Convida jogadores para a lobby |
| `ConfigureLobby` | Atualiza configurações da lobby |
| `LaunchLobby` | Inicia o jogo |
| `LeaveLobby` | Sai da lobby |
| `DestroyLobby` | Destroi a lobby |
| `GetLobbyState` | Retorna estado atual |
| `ShuffleTeams` | Embaralha times |
| `FlipTeams` | Troca times |
| `KickPlayer` | Expulsa jogador |
| `StreamLobbyUpdates` | Stream de atualizações em tempo real |
| `GetBotStatus` | Status de conexão do bot |

## API HTTP

Endpoints disponíveis em `http://localhost:8080`:

- `GET /health` - Health check
- `GET /ready` - Readiness check
- `GET /status` - Status detalhado do bot
- `GET /lobby` - Estado atual da lobby

## Docker

```bash
# Build
docker build -t dota-gc:latest .

# Run
docker run -it --rm \
  -p 50051:50051 \
  -p 8080:8080 \
  -e STEAM_BOT_USERNAME=your_username \
  -e STEAM_BOT_PASSWORD=your_password \
  dota-gc:latest
```

## Regiões de Servidor

| ID | Região |
|----|--------|
| 1 | US West |
| 2 | US East |
| 3 | Europe |
| 10 | Brazil |
| 15 | Peru |
| 14 | Chile |

## Modos de Jogo

| ID | Modo |
|----|------|
| 1 | All Pick |
| 2 | Captain's Mode |
| 3 | Random Draft |
| 4 | Single Draft |
| 5 | All Random |

## Integração com NestJS

O serviço foi projetado para ser consumido pelo backend NestJS via gRPC. Configure `NESTJS_WEBHOOK_URL` para receber notificações de mudança de estado da lobby.

## Referências

- [go-dota2](https://github.com/paralin/go-dota2) - Cliente Dota 2 GC em Go
- [go-steam](https://github.com/paralin/go-steam) - Cliente Steam em Go
