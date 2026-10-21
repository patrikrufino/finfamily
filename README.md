# FinFamily

Controle financeiro da família (PWA): contas, orçamento por categoria, cartões e faturas, parcelamentos, dívidas, recorrentes, dashboard com previsão.
Roda **no computador de casa**, com SQLite, e é usado pelos celulares na rede local. Sem login.

> React 19 · Ark UI · Panda CSS · Hono · SQLite (better-sqlite3 + Drizzle) · TypeScript · MVVM, TDD e SDD (`specs/`).

## Rodar em casa (uso diário)

Requisitos: Node 22+ e pnpm 10.

```bash
pnpm install
pnpm build      # gera o app web (apps/web/dist)
pnpm start      # API + app na mesma porta (3333)
```

O terminal mostra os endereços, por exemplo `Open on your phone: http://192.168.0.10:3333`. Abra esse endereço no celular
(mesma rede Wi-Fi) e, se não abrir, libere a porta 3333 no firewall do computador.

Os dados ficam em `apps/api/finfamily.db`. Para guardar em outro lugar, defina `DATABASE_PATH` (veja a tabela abaixo).

### Variáveis de ambiente

| Variável | Padrão | Para que serve |
|---|---|---|
| `PORT` | `3333` | Porta do servidor. |
| `DATABASE_PATH` | `finfamily.db` | Arquivo do banco SQLite. |
| `WEB_DIST` | `apps/web/dist` | Pasta do app web já compilado. |
| `BACKUP_DIR` | `backups` ao lado do banco | Onde ficam os backups. |
| `BACKUP_KEEP` | `14` | Quantos backups manter (os mais novos). |
| `BACKUP_INTERVAL_HOURS` | `24` | Intervalo do backup automático; `0` desliga. |
| `TLS_CERT` / `TLS_KEY` | – | Caminhos do certificado e da chave para servir em HTTPS. |

## Instalar no celular (PWA)

A instalação e o modo offline do app exigem uma conexão **segura** (HTTPS) ou `localhost`. Em `http://192.168.x.x` o app abre no navegador,
mas o botão "Instalar" não aparece. Escolha uma das opções de HTTPS abaixo e depois:

- **Android (Chrome):** Ajustes do app → *Instalar*, ou menu ⋮ → *Instalar app*.
- **iPhone/iPad (Safari):** botão Compartilhar → *Adicionar à Tela de Início*.

O ícone ganha atalhos (pressione e segure): **Novo lançamento**, **Orçamento** e **Cartões**.

> **"Não aparece como PWA / não oferece instalar"** quase sempre é porque o endereço aberto no celular começa com `http://` e é um IP
> (`http://192.168…`). Nesse caso o Chrome nem permite service worker nem instalação (`not-from-secure-origin`). Em *Ajustes → Instalar o app*
> o próprio app mostra isso e um diagnóstico (endereço, conexão segura, service worker). Em `http://localhost` (no próprio computador) já funciona.

### Opções de HTTPS

1. **Tailscale (recomendado, também funciona fora de casa).** Instale o Tailscale no computador e nos celulares e rode
   `tailscale serve --bg --https=443 http://localhost:3333`. O endereço `https://<computador>.<rede>.ts.net` tem certificado válido,
   sem configurar nada no celular.
2. **mkcert (só na rede de casa).** `mkcert -install && mkcert 192.168.0.10 localhost` e inicie com
   `TLS_CERT=./192.168.0.10+1.pem TLS_KEY=./192.168.0.10+1-key.pem pnpm start`. É preciso instalar a CA do mkcert no celular
   (no iPhone: instalar o perfil e ativar a confiança total em *Ajustes → Geral → Sobre → Configurações de certificado*).
3. **Caddy/nginx** na frente do app, com o certificado que você preferir.
4. **Só para testar em casa no Android (sem HTTPS):** no Chrome do celular abra `chrome://flags/#unsafely-treat-insecure-origin-as-secure`,
   ative a opção, escreva `http://IP-DO-COMPUTADOR:3333` na caixa, toque em *Relaunch* e abra o app de novo. Não existe equivalente no iPhone
   (lá, *Adicionar à Tela de Início* funciona mesmo por HTTP, mas sem o modo offline).

Passo a passo com Tailscale: (1) crie a conta e instale o Tailscale no computador e nos celulares; (2) no computador rode
`pnpm build && pnpm start` e, em outro terminal, `tailscale serve --bg --https=443 http://localhost:3333`; (3) abra no celular o endereço
`https://<nome-do-computador>.<sua-rede>.ts.net` que o comando mostra; (4) *Ajustes → Instalar o app*.

## Backups

- **Automático:** o servidor faz um backup ao iniciar e a cada 24 h (`BACKUP_INTERVAL_HOURS`), mantém os 14 mais recentes e **verifica**
  cada cópia (`PRAGMA integrity_check`) antes de guardá-la. A tela *Ajustes* mostra a lista e tem o botão **Fazer backup agora**.
- **Pela linha de comando:** `pnpm backup`.
- **Restaurar (com o servidor parado):**
  ```bash
  pnpm restore            # lista os backups disponíveis
  pnpm restore latest     # ou: pnpm restore caminho/finfamily-20261021-080000.db
  ```
  O banco atual é guardado como `finfamily.db.before-restore-<data>` antes de ser substituído, e arquivos que não passam na verificação são recusados.
- **Fora do computador:** copie a pasta `backups/` para um HD externo ou serviço de nuvem (Syncthing, rsync, Drive…) — um backup no mesmo disco
  não protege contra falha do disco.

## Iniciar junto com o computador

Modelos prontos em `docs/service/`:

- **Linux (systemd):** `docs/service/finfamily.service` → copie para `~/.config/systemd/user/`, ajuste os caminhos e rode
  `systemctl --user enable --now finfamily`.
- **macOS (launchd):** `docs/service/com.finfamily.plist` → copie para `~/Library/LaunchAgents/` e rode
  `launchctl load ~/Library/LaunchAgents/com.finfamily.plist`.
- **Windows:** crie uma tarefa no *Agendador de Tarefas* ("Ao fazer logon") que execute `pnpm start` na pasta do projeto.

## Desenvolvimento

```bash
pnpm dev                 # API (:3333) e web (:5173) com recarga automática
pnpm typecheck
pnpm test                # unidade + integração
pnpm --filter @finfamily/web test:e2e   # E2E (CHROMIUM_PATH se o Playwright não tiver navegador)
pnpm icons               # regera os ícones PNG do PWA a partir dos SVGs
```

Convenções (código e commits em inglês, textos da interface em `locales`, MVVM, TDD/SDD) estão em [`CLAUDE.md`](CLAUDE.md);
as especificações, em [`specs/`](specs).

## Problemas comuns

- **O celular não abre o endereço:** confira se está na mesma rede, se o computador não está em repouso e se a porta 3333 está liberada.
- **Aparece "Sem conexão com o servidor":** o computador de casa está desligado, em repouso, ou o app não está rodando. O app volta sozinho quando o servidor responde.
- **Não aparece "Instalar":** falta HTTPS (veja acima) ou o app já está instalado.
- **Atualizei o app e o celular mostra a versão antiga:** feche e abra o app; o service worker se atualiza sozinho na próxima abertura.
