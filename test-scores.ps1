# Script para testar o sistema de pontuação em tempo real
# Execute no PowerShell: .\test-scores.ps1

param(
    [string]$BaseUrl = "http://localhost:5173",
    [int]$Week = 1
)

Write-Host "🚀 Testando Sistema de Pontuação - F-FRC" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Gray
Write-Host "Week: $Week`n" -ForegroundColor Gray

# Teste 1: Debug
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "📊 TESTE 1: Verificando Status do Sistema (Debug)" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Blue

try {
    $debugUrl = "$BaseUrl/api/score/debug"
    Write-Host "GET $debugUrl" -ForegroundColor Gray
    
    $debugResponse = Invoke-WebRequest -Uri $debugUrl -Method GET -ContentType "application/json" -ErrorAction Stop
    $debugData = $debugResponse.Content | ConvertFrom-Json
    
    if ($debugData.success) {
        Write-Host "✅ Debug endpoint respondeu com sucesso`n" -ForegroundColor Green
        
        $tba = $debugData.tba
        $db = $debugData.database
        
        Write-Host "  TBA (The Blue Alliance):" -ForegroundColor Yellow
        Write-Host "    - Total eventos no ano: $($tba.totalEventsYear)" -ForegroundColor Gray
        Write-Host "    - Eventos na week $Week`: $($tba.eventsThisWeek)" -ForegroundColor Gray
        
        if ($tba.eventsThisWeek -eq 0) {
            Write-Host "    ⚠️ AVISO: Nenhum evento encontrado para week $Week!" -ForegroundColor Red
        } else {
            Write-Host "    Evento keys: $($tba.eventKeys -join ', ')" -ForegroundColor Gray
        }
        
        Write-Host "`n  Banco de Dados:" -ForegroundColor Yellow
        Write-Host "    - Total scores (todos eventos): $($db.totalScoresAllEvents)" -ForegroundColor Gray
        Write-Host "    - Scores na week $Week`: $($db.scoresThisWeek)" -ForegroundColor Gray
        
        if ($db.scoresThisWeek -gt 0) {
            Write-Host "    - Scores por evento: " -ForegroundColor Gray
            foreach ($key in $db.scoresPerEvent.PSObject.Properties) {
                Write-Host "      • $($key.Name): $($key.Value) scores" -ForegroundColor Gray
            }
            
            Write-Host "`n    Top 5 Teams:" -ForegroundColor Yellow
            foreach ($score in $db.topScores) {
                Write-Host "      • $($score.teamKey) in $($score.eventKey): $($score.totalPoints) pts" -ForegroundColor Gray
            }
        } else {
            Write-Host "    ⚠️ AVISO: Nenhum score encontrado no banco!" -ForegroundColor Red
        }
    }
}
catch {
    Write-Host "❌ Erro ao chamar debug: $($_.Exception.Message)" -ForegroundColor Red
}

# Teste 2: Top-Week (antes do refresh)
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "🏆 TESTE 2: Top Scoring Teams (Antes do Refresh)" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Blue

try {
    $topUrl = "$BaseUrl/api/score/top-week?week=$Week"
    Write-Host "GET $topUrl" -ForegroundColor Gray
    
    $topResponse = Invoke-WebRequest -Uri $topUrl -Method GET -ContentType "application/json" -ErrorAction Stop
    $topData = $topResponse.Content | ConvertFrom-Json
    
    Write-Host "✅ Top-week endpoint respondeu com sucesso`n" -ForegroundColor Green
    
    if ($topData.teams.Count -gt 0) {
        Write-Host "  Teams encontrados: $($topData.teams.Count)" -ForegroundColor Yellow
        foreach ($team in $topData.teams) {
            Write-Host "    • #$($team.teamNumber) $($team.teamName): $($team.points) pts ($($team.eventName))" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ⚠️ Nenhum team encontrado!" -ForegroundColor Red
    }
}
catch {
    Write-Host "❌ Erro ao chamar top-week: $($_.Exception.Message)" -ForegroundColor Red
}

# Teste 3: Refresh Manual
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "🔄 TESTE 3: Forçar Refresh de Pontuações" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Blue

try {
    $refreshUrl = "$BaseUrl/api/score/refresh-week"
    $refreshBody = @{week=$Week; force=$true} | ConvertTo-Json
    
    Write-Host "POST $refreshUrl" -ForegroundColor Gray
    Write-Host "Body: $refreshBody`n" -ForegroundColor Gray
    
    $refreshResponse = Invoke-WebRequest -Uri $refreshUrl `
        -Method POST `
        -Headers @{"Content-Type"="application/json"} `
        -Body $refreshBody `
        -ErrorAction Stop
    
    $refreshData = $refreshResponse.Content | ConvertFrom-Json
    
    if ($refreshData.success) {
        Write-Host "✅ Refresh executado com sucesso`n" -ForegroundColor Green
        
        Write-Host "  Resultado:" -ForegroundColor Yellow
        Write-Host "    - Eventos processados: $($refreshData.eventsCount)" -ForegroundColor Gray
        Write-Host "    - Eventos calculados: $($refreshData.result.scoreSummary.calculatedEvents)" -ForegroundColor Gray
        Write-Host "    - Eventos falhados: $($refreshData.result.scoreSummary.failedEvents)" -ForegroundColor Gray
        Write-Host "    - Usuários atualizados: $($refreshData.result.userSummary.updatedUsers)" -ForegroundColor Gray
    } else {
        Write-Host "⚠️ Refresh retornou sem sucesso" -ForegroundColor Yellow
        Write-Host "  Mensagem: $($refreshData.message)" -ForegroundColor Gray
    }
}
catch {
    Write-Host "❌ Erro ao fazer refresh: $($_.Exception.Message)" -ForegroundColor Red
}

# Teste 4: Top-Week (depois do refresh)
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "🏆 TESTE 4: Top Scoring Teams (Depois do Refresh)" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Blue

try {
    $topUrl2 = "$BaseUrl/api/score/top-week?week=$Week"
    Write-Host "GET $topUrl2" -ForegroundColor Gray
    
    $topResponse2 = Invoke-WebRequest -Uri $topUrl2 -Method GET -ContentType "application/json" -ErrorAction Stop
    $topData2 = $topResponse2.Content | ConvertFrom-Json
    
    Write-Host "✅ Top-week endpoint respondeu com sucesso`n" -ForegroundColor Green
    
    if ($topData2.teams.Count -gt 0) {
        Write-Host "  Teams encontrados: $($topData2.teams.Count)" -ForegroundColor Yellow
        foreach ($team in $topData2.teams) {
            Write-Host "    • #$($team.teamNumber) $($team.teamName): $($team.points) pts ($($team.eventName))" -ForegroundColor Green
        }
    } else {
        Write-Host "  ⚠️ Ainda nenhum team encontrado!" -ForegroundColor Red
    }
}
catch {
    Write-Host "❌ Erro ao chamar top-week: $($_.Exception.Message)" -ForegroundColor Red
}

# Resumo Final
Write-Host "`n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "📋 RESUMO DO TESTE" -ForegroundColor Blue
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`n" -ForegroundColor Blue

Write-Host "✅ Todos os testes foram executados!" -ForegroundColor Green
Write-Host "`nPróximos passos se algo estiver errado:" -ForegroundColor Yellow
Write-Host "  1. Verifique .env - TBA_KEY, FRC_SEASON_YEAR, etc" -ForegroundColor Gray
Write-Host "  2. Verifique logs do servidor" -ForegroundColor Gray
Write-Host "  3. Confirme data/hora está correta" -ForegroundColor Gray
Write-Host "  4. Leia TESTING_SCORES.md para troubleshooting detalhado`n" -ForegroundColor Gray
