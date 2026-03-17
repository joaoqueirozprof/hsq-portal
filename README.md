# HSQ Portal - Sistema de Rastreamento GPS

Portal de rastreamento GPS integrado com Traccar. Sistema próprio de autenticação com usuários armazenados em banco de dados PostgreSQL separado.

## 🚀 Quick Start

```bash
# Clone o projeto
git clone https://github.com/joaoqueirozprof/hsq-portal.git
cd hsq-portal

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o arquivo .env com suas configurações

# Inicie os containers
docker compose up -d
```

## 📋 Pré-requisitos

- Docker
- Docker Compose
- Servidor Traccar rodando (para integração)

## ⚙️ Configuração

### Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `TRACCAR_URL` | URL do servidor Traccar | http://traccar:8082 |
| `TRACCAR_TOKEN` | Token de acesso Bearer do Traccar | (obrigatório) |
| `JWT_SECRET` | Chave secreta para JWT | (mude em produção!) |

## 🐳 Containers

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| hsq-db | 5432 | PostgreSQL (usuários e logs) |
| hsq-api | 4080 | API Backend Express |
| hsq-web | 3080 | Frontend React (build) |
| nginx | 80 | Proxy reverso |

## 🌐 Acesso

- **URL**: http://localhost (via nginx)
- **API**: http://localhost:4080/api

## 📁 Estrutura

```
hsq-portal/
├── api/                 # Backend Express.js
│   ├── src/
│   │   ├── index.js    # Servidor principal
│   │   ├── routes/    # Rotas da API
│   │   ├── services/  # Serviços (Traccar, User)
│   │   └── middleware/# Middleware autenticação
│   └── Dockerfile
├── web/                # Frontend React
│   ├── src/
│   │   ├── pages/    # Páginas do sistema
│   │   ├── components/# Componentes
│   │   ├── services/ # API client
│   │   └── context/  # React Context
│   └── Dockerfile
├── nginx/             # Configuração Nginx
└── docker-compose.yml
```

## 🔐 Autenticação

O sistema usa seu próprio banco de dados para usuários. Para criar o primeiro usuário admin:

```bash
# O banco cria automaticamente na primeira inicialização
# Use a rota POST /api/auth/register para criar usuários
```

## 📄 Licença

MIT
