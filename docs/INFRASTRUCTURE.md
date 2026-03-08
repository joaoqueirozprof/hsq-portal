# Infraestrutura — HSQ Rastreamento

Documentação completa da infraestrutura de produção do HSQ Rastreamento.

---

## Servidor (VPS)

| Item | Valor |
|---|---|
| Provedor | Hostinger (KVM 2) |
| IP | `72.61.129.78` |
| OS | Ubuntu 24.04 LTS |
| Docker | Instalado via Hostinger |

---

## Domínio

| Domínio | Tipo | Destino |
|---|---|---|
| `hsqrastreamento.com.br` | A | 72.61.129.78 |
| `www.hsqrastreamento.com.br` | CNAME | hsqrastreamento.com.br |
| `traccar.hsqrastreamento.com.br` | A | 72.61.129.78 |

**Registrador:** Registro.br via Hostinger

---

## Nginx — Reverse Proxy (Host)

O Nginx roda diretamente no host (não em container) e roteia o tráfego:

```
hsqrastreamento.com.br        → 127.0.0.1:3080 (HSQ Portal)
traccar.hsqrastreamento.com.br → 127.0.0.1:8082 (Traccar)
Acesso por IP                  → 127.0.0.1:8180 (Outros projetos)
```

### Arquivo de configuração

**Localização:** `/etc/nginx/sites-available/hsq-rastreamento.conf`

```nginx
# HSQ Rastreamento Portal
server {
    server_name hsqrastreamento.com.br www.hsqrastreamento.com.br;
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/hsqrastreamento.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hsqrastreamento.com.br/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

# Traccar subdomain com WebSocket
server {
    server_name traccar.hsqrastreamento.com.br;
    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8082;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/hsqrastreamento.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hsqrastreamento.com.br/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}
```

### Comandos úteis

```bash
# Testar configuração
sudo nginx -t

# Recarregar configuração
sudo systemctl reload nginx

# Ver status
sudo systemctl status nginx

# Ver logs de erro
sudo tail -f /var/log/nginx/error.log
```

---

## SSL — Let's Encrypt

| Item | Valor |
|---|---|
| Ferramenta | Certbot com plugin Nginx |
| Certificado | Wildcard para `hsqrastreamento.com.br` |
| Renovação | Automática via cron/systemd timer |
| Validade | 90 dias (renova automaticamente) |

### Renovar manualmente

```bash
sudo certbot renew
```

### Verificar certificados

```bash
sudo certbot certificates
```

---

## Docker — Containers do Portal

### Serviços

| Container | Imagem | Porta | Função |
|---|---|---|---|
| `hsq-web` | nginx:alpine | 3080:80 | Frontend + proxy API |
| `hsq-api` | node:20-alpine (build) | 4080 (interno) | Backend REST API |
| `hsq-db` | postgres:16-alpine | 5432 (interno) | Banco de dados |

### Comandos de operação

```bash
cd /docker/hsq-portal

# Ver status
docker compose ps

# Ver logs
docker compose logs -f hsq-api

# Restart
docker compose restart

# Rebuild após mudanças
docker compose up -d --build

# Rebuild de um serviço específico
docker compose up -d --build hsq-api
```

### Volumes persistentes

- `hsq-pgdata` — Dados do PostgreSQL (não é perdido no rebuild)

---

## Traccar — Servidor GPS

| Item | Valor |
|---|---|
| Tipo | Instalação nativa (Java) |
| Diretório | `/opt/traccar` |
| Porta | 8082 |
| Gerenciamento | systemd (`traccar.service`) |
| Banco | H2 (interno do Traccar) |

### Comandos

```bash
# Status
sudo systemctl status traccar

# Restart
sudo systemctl restart traccar

# Logs
sudo journalctl -u traccar -f
```

### Portas GPS (dispositivos rastreadores)

O Traccar aceita dados de rastreadores em diversas portas (5001-5200+). Consulte a documentação do Traccar para a porta do seu modelo de rastreador.

---

## Mapa de Portas do Servidor

| Porta | Serviço | Acesso |
|---|---|---|
| 80 | Nginx (redirect HTTPS) | Público |
| 443 | Nginx (HTTPS) | Público |
| 3080 | HSQ Portal (Docker) | Interno (via Nginx) |
| 4080 | HSQ API (Docker) | Interno |
| 5432 | PostgreSQL (Docker) | Interno |
| 8082 | Traccar | Interno (via Nginx) |
| 8180 | Outros projetos | Interno (via Nginx) |
| 5001-5200 | Traccar GPS protocols | Público |

---

## Backup e Recuperação

### Backup do banco de dados

```bash
# Dump completo
docker exec hsq-db pg_dump -U hsq_admin hsq_portal > backup_$(date +%Y%m%d).sql

# Restaurar
cat backup.sql | docker exec -i hsq-db psql -U hsq_admin hsq_portal
```

### Backup dos arquivos do projeto

```bash
# O código está versionado no GitHub
git clone https://github.com/joaoqueirozprof/hsq-portal.git

# Para restaurar, basta clonar e rodar docker compose
cd hsq-portal
cp .env.example .env  # Editar com credenciais
docker compose up -d --build
```

---

## Troubleshooting

### Portal não carrega
1. Verificar se os containers estão rodando: `docker compose ps`
2. Verificar logs: `docker compose logs hsq-web`
3. Verificar nginx host: `sudo nginx -t && sudo systemctl status nginx`

### API retorna erro 500
1. Ver logs da API: `docker compose logs -f hsq-api`
2. Verificar conexão com banco: `curl http://localhost:3080/api/health`

### Traccar não abre
1. Verificar se o serviço está rodando: `sudo systemctl status traccar`
2. Verificar porta: `ss -tlnp | grep 8082`
3. Reiniciar: `sudo systemctl restart traccar`

### Certificado SSL expirado
```bash
sudo certbot renew --force-renewal
sudo systemctl reload nginx
```
