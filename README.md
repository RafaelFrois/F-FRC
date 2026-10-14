# F-FRC (Vite + Vercel Serverless API)

Este projeto roda frontend em Vite e backend em Vercel Serverless Functions (pasta `api/`).

## Rodando localmente

```bash
npm install
cp .env.example .env      # preencha MONGO_URI, JWT_SECRET e TBA_KEY
npm run dev:api           # API local em http://localhost:3000 (executa as funções de api/)
npm run dev               # frontend em http://localhost:5173 (faz proxy de /api para a API local)
```

Sem `npm run dev:api`, o Vite não tem para onde mandar `/api` e o login e o cadastro falham com erro 500.

## Testes

```bash
npm test
```

Os testes usam um MongoDB isolado: `MONGO_TEST_URI` se estiver definido, ou um MongoDB em memória
(`mongodb-memory-server`, que baixa o binário na primeira execução). Eles nunca usam o `MONGO_URI` do `.env`.

## Auditoria do banco (somente leitura)

```bash
npm run audit:db
```

Mostra coleções, índices e contagens de inconsistências (e-mails repetidos ignorando maiúsculas, senhas fora do
padrão bcrypt, alianças sem 3 equipes ou sem 1 capitão etc.). Não altera documentos e não imprime dados pessoais.

## Autenticação

- `POST /api/register`: valida no servidor e-mail (normalizado para minúsculas), nome de usuário (3 a 30 caracteres,
  único), senha (8 a 72 caracteres) e a confirmação, se enviada; número da equipe e ano rookie são opcionais.
  Retorna `409` para e-mail ou nome já usados.
- `POST /api/login`: busca o e-mail sem diferenciar maiúsculas (compatível com contas antigas), compara a senha com
  bcrypt e grava um JWT de 7 dias em cookie `HttpOnly`, `SameSite=Lax` (`Secure` em produção).
- `POST /api/logout`: remove o cookie. O JWT não tem estado, então um token copiado continua válido até expirar.
- Rotas privadas respondem `401` sem sessão válida; o frontend volta para o login.
- `JWT_SECRET` é obrigatório em produção (sem ele, o login responde 500 com `JWT_SECRET_MISSING`).

## Estrutura final (backend serverless)

```text
api/
	_lib/
		auth.js
		http.js
		userSeason.js
	login.js
	register.js
	me.js
	regionals.js
	regionals/
		week/
			[week].js
		[eventKey]/
			teams.js
config/
	mongo.js
src/DataBase/
	models/
	services/
```

## Endpoints

- `POST /api/login`
- `POST /api/register`
- `POST /api/logout`
- `GET /api/regionals?week=1`
- `GET /api/regionals/week/:week`
- `GET /api/regionals/:eventKey/teams`
- `GET /api/me` (JWT via cookie)
- `PUT /api/me` (JWT via cookie)
- `POST /api/score/calculate/:event_key`
- `GET /api/market-price/:season/:week/:teamNumber`
- `GET /api/market-price/debug/:season/:week/:teamNumber`

## Conversão auth.routes.js → serverless

- `routes/auth.routes.js` (login/register) foi separado em:
	- `api/login.js`
	- `api/register.js`

Cada função exporta:

```js
export default async function handler(req, res) {}
```

## MongoDB Atlas com cache global (serverless)

Arquivo: `config/mongo.js`

- Usa `globalThis.__mongooseCache` para reaproveitar conexão.
- Evita múltiplas conexões por invocação fria/quente.

## Variáveis de ambiente (Vercel)

No painel da Vercel (Project → Settings → Environment Variables), configure:

- `MONGO_URI`
- `JWT_SECRET`
- `TBA_KEY`
- `FRC_SEASON_YEAR`
- `CORS_ORIGINS` (ex: `https://seu-frontend.vercel.app,http://localhost:5173`)

Depois faça redeploy.

## Exemplo de fetch no frontend

```js
export async function login(email, password) {
	const response = await fetch("/api/login", {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password })
	});

	const data = await response.json();
	if (!response.ok) throw new Error(data.message || "Erro ao logar");
	return data;
}
```

## Deploy

- `vercel.json` já está configurado para runtime Node nas funções `api/**/*.js`.
- O frontend continua sendo buildado pelo Vite normalmente.
