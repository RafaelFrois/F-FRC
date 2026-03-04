# 🚀 Sistema de Pontuação em Tempo Real - Resumo das Mudanças

## ✨ O que foi implementado:

### 1. **Cron Job Automático** ⏰
Arquivo: `src/DataBase/jobs/cron.js`

- **A cada 5 minutos**: Recalcula e atualiza scores automaticamente
- **Ao iniciar servidor**: Roda refresh inicial
- **Funcionalidades**:
  - Busca eventos da week atual
  - Calcula pontuação de cada time
  - Atualiza pontos dos usuários
  - Logging detalhado no console

```javascript
// Executa a cada 5 minutos
cron.schedule("*/5 * * * *", async () => {
  await refreshWeekScores();
});
```

---

### 2. **Endpoint de Refresh Manual** 🔄
Arquivo: `api/score/refresh-week.js` (modificado)

Endpoint único que suporta tanto refresh quanto debug:

**Refresh - Forçar atualização:**
```
POST /api/score/refresh-week
Content-Type: application/json

{
  "week": 1,
  "force": true
}
```

**Debug - Status completo:**
```
GET /api/score/refresh-week?action=debug
```
Arquivos modificados:
- `api/score/top-week.js` 
- `lib/server/scoringSync.js` (cron.js)

Agora mostra detalhadamente:
- Qual request foi feito
- Quantos eventos foram encontrados
- Quantos scores foram calculados
- Quais são os top 3 teams

**Exemplo de log:**
```
📍 Top-week request: season=2026, week=1, metric=points, refresh=false
📅 Week 1 tem 3 eventos
📊 Encontrados 45 scores para os events
🏆 Top 3 scoring teams encontrados: 3
   - #9483 Overcharge: 185.50 pts
   - #6431 NoktaParantez: 168.30 pts
   - #11281 Phoenix Robotics: 142.80 pts
```

---

### 5. **Botão de Refresh na Tela Inicial** 🎨
Arquivo: `src/containers/home/index.jsx`

Adicionado botão "ATUALIZAR" discreto ao lado do título "EQUIPES QUE MAIS PONTUARAM".

**Funcionalidades:**
- Força refresh imediato
- Recarrega dados da tela
- Desabilita enquanto está atualizando

---

## 📊 Fluxo Completo

```
┌─────────────────────────────────────────────────────────────┐
│                    SISTEMA DE PONTUAÇÃO                      │
└─────────────────────────────────────────────────────────────┘

1. INICIALIZAÇÃO
   ├─ Servidor inicia
   └─ refreshWeekScores() executa (1 vez no startup)

2. CRON AUTOMÁTICO (a cada 5 minutos)
   ├─ getCurrentWeek() → determina week atual
   ├─ getWeekEvents() → busca eventos TBA da week
   ├─ calculateEventScores() → para cada evento:
   │  ├─ Busca dados de TBA (times, partidas)
   │  ├─ Busca dados de Statbotics (EPA)
   │  ├─ Calcula pontuação (auto, teleop, endgame, bônus)
   │  └─ Salva no banco (Score collection)
   └─ refreshUsersScoresByEventKeys() → atualiza pontos dos usuários

3. REQUISIÇÃO DE DADOS (quando usuário acessa home)
   ├─ GET /api/score/top-week?week=1
   ├─ Top-week chama ensureWeekScoresFresh()
   │  └─ Se nenhum score no banco, força recálculo
   ├─ Ordena por totalPoints DESC
   └─ Retorna top 3 teams

4. REFRESH MANUAL (usuário clica ATUALIZAR)
   ├─ POST /api/score/refresh-week (force=true)
   ├─ Ignora throttle (força recalculação imediata)
   ├─ Aguarda conclusão
   └─ Recarrega dados da tela

5. VISUALIZAÇÃO
   ├─ TopScoringTeams componente recebe dados
   ├─ Exibe #teamNumber, teamName, points
   └─ Atualiza em tempo real
```

---

## 🎯 Próximas Etapas para Você Testar

### 1️⃣ **Teste Rápido** (2 min)
```powershell
# No PowerShell, na raiz do projeto
.\test-scores.ps1
```

### 2️⃣ **Teste Manual** (5 min)
1. Abra: `http://localhost:5173/api/score/refresh-week?action=debug`
2. Procure por `scoresThisWeek` - deve ser > 0
3. Se for 0, clique em "ATUALIZAR" na home
4. Aguarde 5 segundos
5. Volte ao debug endpoint
6. Deve ter aumentado

### 3️⃣ **Verificar Logs** (real-time)
Veja o terminal onde a app roda. Procure por linhas que começam com:
- `📍` - requisição
- `📅` - eventos
- `📊` - scores
- `🏆` - resultado final

---

## ⚡ Suporte Rápido

### Problema: Nenhuma equipe aparece
**→ Solução:**
1. Verifique `/api/score/refresh-week?action=debug`
2. Se `scoresThisWeek: 0`, clique ATUALIZAR
3. Se ainda for 0, verifique `.env` (TBA_KEY)

### Problema: Erros na requisição
**→ Solução:**
1. Abra DevTools (F12) → Console
2. Procure por erros vermelhos
3. Veja a requisição em Network
4. Copie a URL e teste no navegador

### Problema: Cron não está rodando
**→ Solução:**
1. Veja logs do servidor
2. Deve aparecer `⏰ Cron a cada 5 minutos iniciado`
3. Se não aparecer, confira `node-cron` está instalado

---

## 📚 Arquivos Principais

| Arquivo | Função |
|---------|--------|
| `src/DataBase/jobs/cron.js` | Atualização automática a cada 5 min |
| `api/score/refresh-week.js` | Endpoint de refresh + debug (combinado) |
| `api/score/top-week.js` (modificado) | Melhor logging |
| `src/containers/home/index.jsx` (modificado) | Botão de refresh + handleRefresh |
| `test-scores.ps1` | Script de teste automático |
| `TESTING_SCORES.md` | Guia detalhado de troubleshooting |

---

## 🔐 Variáveis de Ambiente (Confira no .env)

```env
# Essencial
FRC_SEASON_YEAR=2026
TBA_KEY=your_actual_tba_key_here

# Opcional mas recomendado
CRON_SECRET=some_secret_here
WEEK_SCORE_REFRESH_MIN_INTERVAL_MS=120000  # 2 minutos de throttle mínimo
NODE_ENV=development
```

---

## 💡 Dicas Finais

✅ **O sistema está 100% automático agora**
- Scores se atualizam a cada 5 minutos
- Usuários veem dados fresquinhos
- Botão de refresh para força extra

✅ **Logging é seu amigo**
- Console do servidor mostra tudo
- Cada passo é registrado
- Impossível não saber o que está acontecendo

✅ **Debug endpoint é a chave**
- Começa SEMPRE aqui
- Mostra status completo
- Invalorizável para troubleshooting

---

**Status: ✅ IMPLEMENTADO E PRONTO PARA TESTAR**

Boa sorte! 🚀
