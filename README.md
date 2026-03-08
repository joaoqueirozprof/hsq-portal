# HSQ Rastreamento — Portal de Acesso

<div align="center">

**Portal web para gerenciamento de clientes e acesso ao sistema de rastreamento veicular HSQ.**

🌐 [hsqrastreamento.com.br](https://hsqrastreamento.com.br) · 🗺️ [traccar.hsqrastreamento.com.br](https://traccar.hsqrastreamento.com.br)

</div>

---

## Sobre o Projeto

O HSQ Rastreamento é um sistema completo de rastreamento veicular que combina:

- **Portal Web** — Interface moderna para login de clientes e painel administrativo
- **Traccar** — Servidor GPS open-source para rastreamento em tempo real
- **API REST** — Backend Node.js que integra o portal com o Traccar

### Funcionalidades

**Para Clientes:**
- Login com CPF/CNPJ
- Redirecionamento automático para o painel de rastreamento (Traccar)
- Onboarding de primeiro acesso com troca de senha obrigatória
- Visualização de veículos e posições em tempo real no mapa

**Para Administradores:**
- Dashboard com métricas (total de clientes, ativos, logins recentes)
- Cadastro e gerenciamento de clientes
- Ativação/desativação de contas
- Reset de senhas
- Acesso direto ao Traccar admin

---

## Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                    INTERNET                         │
└──────────────┬──────────────────┬───────────────────┘
               │                  │
         HTTPS (443)        HTTPS (443)
               │                  │
┌──────────────▼──────────────────▼───────────────────┐
│              NGINX (Host)                           │
│  hsqrastreamento.com.br → :3080 (Portal)            │
│  traccar.hsqrastreamento.com.br → :8082 (Traccar)   │
│  SSL: Let's Encrypt (auto-renew)                    │
└──────────────┬──────────────────┬───────────────────┘
               │                  │
    ┌──────────▼──────┐   ┌──────▼──────┐
    │   Docker Stack  │   │   Traccar   │
    │                 │   │  (systemd)  │
    │  ┌───────────┐  │   │  Port 8082  │
    │  │  hsq-web  │  │   └─────────────┘
    │  │  (nginx)  │  │
    │  │  :3080    │  │
    │  └─────┬─────┘  │
    │        │ /api/  │
    │  ┌─────▼─────┐  │
    │  │  hsq-api  │  │
    │  │ (Node.js) │  │
    │  │  :4080    │  │
    │  └─────┬─────┘  │
    │        │        │
    │  ┌─────▼─────┐  │
    │  │  hsq-db   │  │
    │  │(Postgres) │  │
    │  │  :5432    │  │
    │  └───────────┘  │
    └─────────────────┘
```

---

## Stack Tecnológico

| Componente | Tecnologia | Versão |
|---|---|---|
| Frontend | HTML/CSS/JS (SPA) | - |
| Backend | Node.js + Express | 20-alpine |
| Banco de Dados | PostgreSQL | 16-alpine |
| Web Server | Nginx | alpine |
| Rastreamento | Traccar | 6.x |
| Containerização | Docker + Docker Compose | v3.8 |
| Reverse Proxy | Nginx (host) | 1.24 |
| SSL | Let's Encrypt (Certbot) | - |

---

## Estrutura do Projeto

```
hsq-portal/
├── api/                        # Backend Node.js
│   ├── Dockerfile              # Imagem Node 20 Alpine
│   ├── package.json            # Dependências npm
│   └── src/
│       ├── index.js            # Entry point do Express
│       ├── seed.js             # Seed do banco (admin + cliente inicial)
│       ├── middleware/
│       │   └── auth.js         # JWT authentication middleware
│       ├── routes/
│       │   ├── auth.js         # Login cliente/admin, troca de senha
│       │   ├── admin.js        # CRUD clientes, dashboard, métricas
│       │   └── clients.js      # Perfil do cliente, dispositivos
│       └── services/
│           └── traccar.js      # Integração com API do Traccar
├── db/
│   └── init.sql                # Schema do banco (PostgreSQL)
├── web/
│   ├── Dockerfile              # Imagem Nginx Alpine
│   ├── nginx.conf              # Config nginx interno (proxy API)
│   └── index.html              # Frontend SPA completo
├── docker-compose.yml          # Orquestração dos containers
├── .env.example                # Template de variáveis de ambiente
├── .gitignore                  # Arquivos ignorados pelo git
└── docs/
    └── INFRASTRUCTURE.md       # Documentação de infraestrutura
```

---

## API Endpoints

### Autenticação (`/api/auth`)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/auth/login` | Login de cliente (CPF/CNPJ + senha) |
| `POST` | `/api/auth/admin-login` | Login de administrador (email + senha) |
| `POST` | `/api/auth/change-password` | Trocar senha (requer JWT) |

### Clientes (`/api/clients`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/clients/me` | Perfil do cliente logado |
| `GET` | `/api/clients/devices` | Dispositivos do cliente no Traccar |
| `GET` | `/api/clients/traccar-redirect` | URL do Traccar para redirect |

### Administração (`/api/admin`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/admin/clients` | Listar clientes (com busca e paginação) |
| `GET` | `/api/admin/clients/:id` | Detalhes do cliente |
| `POST` | `/api/admin/clients` | Cadastrar novo cliente |
| `PUT` | `/api/admin/clients/:id` | Atualizar cliente |
| `POST` | `/api/admin/clients/:id/toggle` | Ativar/desativar cliente |
| `POST` | `/api/admin/clients/:id/reset-password` | Resetar senha |
| `GET` | `/api/admin/dashboard` | Métricas do dashboard |

### Saúde (`/api/health`)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/health` | Health check (testa conexão com DB) |

---

## Banco de Dados

### Tabelas

**`admin_users`** — Administradores do portal
- `id` (UUID, PK), `email`, `password_hash`, `name`, `is_active`, `created_at`

**`clients`** — Clientes cadastrados
- `id` (UUID, PK), `traccar_user_id`, `document` (CPF/CNPJ), `document_type`, `name`, `trade_name`, `phone`, `email`, `address`, `city`, `state`, `contact_person`, `is_active`, `is_first_login`, `must_change_password`, `onboarding_completed`, `created_at`, `updated_at`

**`audit_log`** — Log de auditoria
- `id` (UUID, PK), `user_type`, `user_id`, `action`, `details` (JSONB), `ip_address`, `created_at`

---

## Instalação e Deploy

### Pré-requisitos

- Docker e Docker Compose
- Servidor Traccar instalado e rodando
- Domínio apontando para o IP do servidor (opcional, mas recomendado)

### 1. Clonar o repositório

```bash
git clone https://github.com/joaoqueirozprof/hsq-portal.git
cd hsq-portal
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
nano .env  # Edite com suas credenciais
```

### 3. Subir os containers

```bash
docker compose up -d --build
```

### 4. Verificar se está rodando

```bash
docker compose ps
curl http://localhost:3080/api/health
```

O portal estará acessível em `http://localhost:3080`.

---

## Configuração de Domínio e SSL

Para configurar um domínio com HTTPS, veja a documentação completa em [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md).

Resumo rápido:

1. Apontar DNS do domínio para o IP do servidor
2. Instalar Nginx e Certbot no host
3. Configurar virtual hosts (proxy reverso)
4. Gerar certificados SSL com Let's Encrypt

---

## Segurança

- **JWT** para autenticação de sessões
- **bcrypt** para hash de senhas
- **Helmet** para headers de segurança HTTP
- **Rate limiting** no endpoint de login (100 req/15min)
- **CORS** configurável
- **Validação** de CPF/CNPJ no backend
- **Audit log** para rastreamento de ações

---

## Fluxo de Login do Cliente

```
Cliente acessa hsqrastreamento.com.br
        │
        ▼
Digita CPF/CNPJ + Senha
        │
        ▼
API valida no PostgreSQL
        │
        ├── Primeiro acesso? → Onboarding (troca de senha)
        │
        ▼
API faz login no Traccar via iframe (cria sessão)
        │
        ▼
Redirect para traccar.hsqrastreamento.com.br
        │
        ▼
Cliente vê seus veículos no mapa em tempo real
```

---

## Desenvolvimento

### Rodar localmente

```bash
# Subir banco e API
docker compose up -d hsq-db
npm install --prefix api
cd api && npm run dev
```

### Estrutura de um novo endpoint

```javascript
// api/src/routes/exemplo.js
const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.get('/rota', authMiddleware, async (req, res) => {
  // sua lógica aqui
});
module.exports = router;
```

---

## Licença

Projeto privado — HSQ Rastreamento © 2026
