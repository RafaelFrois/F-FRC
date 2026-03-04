# 🚀 Instruções para Testar o Sistema de Pontuação em Tempo Real

Você implementou com sucesso o sistema automático de atualização de scores! Aqui está como testar e debugar:

## 📍 Endpoints Disponíveis

### 1. **Debug - Visualizar Status Completo** (mais importante!)
```
GET /api/score/refresh-week?action=debug
```
Este endpoint mostra:
- Total de eventos do ano/semana
- Quais eventos estão na week atual
- Quantos scores estão no banco
- Top 5 scores classificados

**Como usar no navegador:**
```
http://localhost:5173/api/score/refresh-week?action=debug
```

Este é o **primeiro lugar para investigar** se não há equipes aparecendo.

---

### 2. **Refresh Manual - Forçar Atualização**
```
POST /api/score/refresh-week
```

**No terminal (PowerShell):**
```powershell
$body = @{week=1; force=$true} | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:5173/api/score/refresh-week" `
  -Method POST `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

**No navegador (usando DevTools Console):**
```javascript
fetch('/api/score/refresh-week', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({week: 1, force: true})
}).then(r => r.json()).then(d => console.log(d))
```

---

### 3. **Top Scoring - Pega Top 3 Equipes**
```
GET /api/score/top-week?week=1
```

**No navegador:**
```
http://localhost:5173/api/score/top-week?week=1
```

---

## 🔄 O Fluxo Automático Agora Funciona Assim:

1. **Ao iniciar o servidor** → Roda `refreshWeekScores()` uma vez
2. **A cada 5 minutos** → Roda `refreshWeekScores()` automaticamente (cron)
3. **A cada 2 minutos** → (throttle mínimo) para evitar sobrecarga
4. **Manual** → Você pode clicar em "ATUALIZAR" na tela inicial

---

## 🐛 Debugar Problemas (Step-by-Step)

### Passo 1: Verifica se há eventos
```
Acesse: /api/score/refresh-week?action=debug
Procure por: "eventsThisWeek" e "events"
```
**❌ Se disser 0 eventos:**
- Confira se a data está correta (deve estar entre início março e fim de maio)
- Verifique se TBA_KEY está configurada no .env
- Os eventos só aparecem se estiverem na semana correta

### Passo 2: Verifica se há scores no banco
```
No /api/score/refresh-week?action=debug procure por: "scoresThisWeek" e "topScores"
```
**❌ Se disser 0 scores:**
- Clique em "ATUALIZAR" na home
- Aguarde 5-10 segundos
- Volte ao /api/score/refresh-week?action=debug
- Se ainda for 0, veja o passo 3

### Passo 3: Verifica os logs do servidor
No terminal onde a app está rodando, procure por:
```
📍 Top-week request: season=2026, week=1, metric=points, refresh=false
📅 Week 1 tem X eventos
📊 Encontrados Y scores para os events
🏆 Top 3 scoring teams encontrados: Z
   - #TEAMNUM TEAMNAME: POINTS pts
```

**Se aparecer "Nenhum score encontrado" ou "eventos 0":**
1. Confira TBA_KEY
2. Confira se os eventos estão realmente acontecendo agora (data/hora)
3. Tente `/api/score/refresh-week` com force=true

### Passo 4: Verifica console do navegador
Abra DevTools (F12) → Console
- Procure por erros vermelhos
- Veja se a requisição está retornando dados

---

## 📊 Checklist de Verificação

- [ ] Acessei `/api/score/refresh-week?action=debug` e vi eventos
- [ ] Vi scores no database (scoresThisWeek > 0)
- [ ] Cliquei em "ATUALIZAR" na home
- [ ] Equipas aparecem agora?
- [ ] Se não, rodei em força com refresh-week com force=true
- [ ] Checei os logs do servidor
- [ ] Verifiquei se TBA_KEY está no .env

---

## 🎯 O que foi Implementado

✅ **Cron job automático** - A cada 5 minutos recalcula scores
✅ **Refresh manual** - Endpoint `/api/score/refresh-week` 
✅ **Logging detalhado** - Console mostra exatamente o que está acontecendo
✅ **Botão de atualização** - Na home para usuário forçar refresh
✅ **Debug endpoint** - `/api/score/debug` mostra status completo do sistema

---

## 🔧 Variáveis de Ambiente Importantes

No seu `.env`, confirme que tem:

```env
FRC_SEASON_YEAR=2026
TBA_KEY=YOUR_TBA_AUTH_KEY_HERE
CRON_SECRET=your_secret_here
WEEK_SCORE_REFRESH_MIN_INTERVAL_MS=120000
```

---

## 💡 Dicas

1. Os scores começam a aparecer **apenas depois** que o `calculateEventScores()` roda
2. Se não há eventos, `calculateEventScores()` **nunca roda**
3. Sempre comece verificando `/api/score/debug`
4. Os logs no console do servidor são o seu melhor amigo

---

**Tudo pronto? Teste agora! 🚀**
