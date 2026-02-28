# F-FRC (Vite + Vercel Serverless API)

Este projeto roda frontend em Vite e backend em Vercel Serverless Functions (pasta `api/`).

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
