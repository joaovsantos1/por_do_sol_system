# PDV Sistema — Comandas para loja única

Sistema de Ponto de Venda com controle de comandas, estoque, vendas,
usuários/permissões, dashboard, metas e relatórios, para uma única loja.

Backend em **C# / ASP.NET Core Web API + EF Core + PostgreSQL**.
Frontend em **Angular (standalone) + Angular Material**, como **PWA**.

## Status atual do projeto (o que já está implementado)

- ✅ Fase 1 — Estrutura do projeto, Docker Compose, configurações
- ✅ Fase 2 (parcial) — Usuários, perfis (enum), autenticação JWT, autorização por perfil nos controllers
- ✅ Fase 3 (parcial) — Produtos, Categorias, Estoque com movimentações e alerta de estoque baixo
- ✅ Fase 4 — Comandas, itens de comanda, abrir/alterar/remover/cancelar, **controle de concorrência no estoque**, QR Code (gerado no backend com QRCoder) e código de barras (renderizado no frontend com JsBarcode a partir do identificador da comanda), leitura por câmera no PDV (ngx-scanner-qrcode)
- ✅ Fase 5 — Fechamento de comanda com pagamento único ou misto, geração de Venda, **cancelamento/estorno de venda com devolução de estoque**
- ✅ Fase 6 — Dashboard completo com gráficos (Chart.js/ng2-charts: vendas por dia, formas de pagamento, produtos mais vendidos) e cards; Metas com criação via modal e progresso visual; Relatórios (vendas, estoque/movimentações, comandas, financeiro) no backend
- ✅ Fase 2 (completa) — CRUD de usuários (criar, editar, trocar senha, ativar/inativar) restrito a Administrador, backend e frontend
- ✅ Fase 3 (completa) — CRUD completo de produtos no frontend (criar/editar via modal, ativar/inativar)
- ✅ Fase 7 (parcial) — SignalR plugado no fluxo de comandas; PWA configurado; responsividade básica no PDV
- 🚧 Fase 8 — **Testes automatizados criados**: regras de negócio de comanda/fechamento (xUnit + EF InMemory + fake de estoque) e o teste real de concorrência contra PostgreSQL via Testcontainers (`StockServiceConcurrencyTests`); auditoria básica já existe; segurança (JWT/BCrypt/CORS) já implementada

## Como o controle de concorrência de estoque funciona

Veja o comentário completo em `backend/src/Infrastructure/Services/StockService.cs`.
Resumo: cada baixa/devolução de estoque roda dentro de uma transação que
executa `SELECT ... FOR UPDATE` na linha do produto no PostgreSQL —isso
bloqueia qualquer outra transação concorrente sobre o MESMO produto até a
primeira terminar. Assim, dois usuários nunca conseguem "ver" o mesmo
estoque desatualizado e vender a mesma unidade duas vezes. Estoque negativo
nunca é permitido (`EstoqueInsuficienteException` é lançada e a operação
inteira é revertida).

## Como rodar os testes

```bash
cd backend
dotnet test
```

A maioria dos testes usa EF Core InMemory (rápidos, sem dependências). O
teste `StockServiceConcurrencyTests` — que prova de verdade a regra de
concorrência — precisa de **Docker instalado** porque sobe um PostgreSQL
real via Testcontainers (o InMemory não suporta `SELECT ... FOR UPDATE`).
Para rodar só esse: `dotnet test --filter FullyQualifiedName~Concorrencia`.

## Requisitos

- Docker e Docker Compose (forma recomendada de rodar tudo de uma vez)
- Alternativamente, para rodar sem Docker: .NET 8 SDK, Node.js 20+, PostgreSQL 16

## Como rodar com Docker (recomendado)

```bash
cp .env.example .env
# edite o .env e troque JWT_SECRET e ADMIN_PASSWORD antes de usar em produção
docker compose up --build
```

- Backend: http://localhost:5000/swagger
- Frontend: http://localhost:4200
- PostgreSQL: localhost:5432

O container do backend aplica as migrations automaticamente ao subir
(`dotnet ef database update`) e roda o seed inicial (usuário admin, algumas
categorias e produtos de exemplo — marcados `[EXEMPLO]`, para nunca serem
confundidos com dados reais da loja).

Login inicial: usuário e senha vêm de `ADMIN_LOGIN` / `ADMIN_PASSWORD` no `.env`.

## Como rodar sem Docker

### PostgreSQL
Suba um PostgreSQL local e crie o banco `pdv_db` (ou ajuste a connection string).

### Backend
```bash
cd backend
dotnet restore
dotnet tool install --global dotnet-ef   # se ainda não tiver
export ConnectionStrings__Default="Host=localhost;Port=5432;Database=pdv_db;Username=pdv_user;Password=changeme"
export Jwt__Secret="troque-esta-chave-em-producao-min-32-chars"
export Admin__Password="changeme123"
dotnet ef migrations add InitialCreate --project src/Infrastructure --startup-project src/Api
dotnet ef database update --project src/Infrastructure --startup-project src/Api
dotnet run --project src/Api
```

> **Importante:** as *migrations* ainda não foram geradas neste ambiente de
> desenvolvimento porque criá-las exige o .NET SDK com acesso ao NuGet
> (`dotnet restore`), que não está disponível aqui. Rode o comando
> `dotnet ef migrations add InitialCreate ...` acima na sua máquina/CI antes
> do primeiro `docker compose up` — ou deixe o próprio container rodar
> (ele tenta `dotnet ef database update`, mas a migration inicial precisa
> existir no repositório primeiro).

### Frontend
```bash
cd frontend
npm install
npm start
```
Acesse http://localhost:4200.

## Variáveis de ambiente

Ver `.env.example` na raiz. Principais:

| Variável | Descrição |
|---|---|
| `POSTGRES_DB/USER/PASSWORD` | Credenciais do PostgreSQL |
| `JWT_SECRET` | Chave usada para assinar os tokens JWT (mín. 32 caracteres) |
| `JWT_EXPIRATION_MINUTES` | Validade do token |
| `ADMIN_LOGIN` / `ADMIN_PASSWORD` | Credenciais do usuário administrador criado no seed |
| `API_URL` | URL da API usada pelo frontend |

## Como instalar como PWA

Com o frontend rodando em produção (`ng build` + servido via HTTPS ou
`localhost`), o navegador (Chrome/Edge/Safari no celular) oferece
"Instalar aplicativo" / "Adicionar à tela inicial". Os ícones ficam em
`frontend/src/assets/icons/` — **você precisa gerá-los a partir da logo real**
da loja (ver `frontend/src/assets/logo/LEIA-ME.txt`).

## Arquitetura do backend

```
backend/src/
  Domain/          entidades e enums, sem dependências externas
  Infrastructure/  EF Core, PostgreSQL, StockService (concorrência)
  Application/     casos de uso: ComandaService, FechamentoService, AuthService
  Api/             controllers, Program.cs, SignalR hubs, seed
```

## Estrutura do frontend

```
frontend/src/app/
  core/            services (Auth, Comandas, Produtos, Realtime), guards, interceptors
  shared/          shell (sidebar/header)
  features/
    auth/          tela de login
    pos/           tela principal do PDV
    commands/      comandas abertas + modal de fechamento/pagamento
    dashboard/      products/ stock/  (dashboard, produtos, estoque — em evolução)
```

## Próximos passos sugeridos

1. Gerar a migration inicial (`dotnet ef migrations add InitialCreate`) e commitar
2. Adicionar a logo real da loja e gerar os ícones do PWA
3. Completar CRUD de produtos/categorias no frontend (formulários de criar/editar)
4. Implementar QR Code / leitura de código de barras via câmera no PDV
5. Construir dashboard completo com gráficos (vendas por dia, formas de pagamento, produtos mais vendidos) e metas
6. Relatórios com filtro por período e exportação futura (CSV/PDF)
7. Testes automatizados das regras críticas (concorrência de estoque, pagamento misto, cancelamento)
