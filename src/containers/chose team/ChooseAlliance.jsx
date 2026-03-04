import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { getMe } from "../../services/api";
import AppHeader from "../../components/AppHeader";
import "../../styles/Regional-Teams.css";

function ChooseAlliance() {
  const { eventKey } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isEditing = location.state?.isEditing || false;
  const currentAlliance = Array.isArray(location.state?.alliance) ? location.state.alliance : null;
  
  const [teams, setTeams] = useState([]);
  const [selected, setSelected] = useState([]); // {team, isCaptain}
  const [hasChanges, setHasChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredTeams, setFilteredTeams] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userPatrimony, setUserPatrimony] = useState(0);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth <= 1024 : false);

  const editingCredit = (isEditing && Array.isArray(currentAlliance))
    ? currentAlliance.reduce((sum, team) => sum + Number(team?.marketValue || 0), 0)
    : 0;
  const availablePatrimony = Number(userPatrimony || 0) + editingCredit;
  const selectedCost = selected.reduce(
    (sum, selectedTeam) => sum + Number(selectedTeam?.team?.price ?? selectedTeam?.team?.marketValue ?? 0),
    0
  );
  const remainingPatrimony = Math.max(0, availablePatrimony - selectedCost);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const user = await getMe();
        if (mounted) {
          setUserPatrimony(Number(user?.patrimonio || 0));
        }
      } catch {
        if (mounted) {
          setUserPatrimony(0);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    let didTimeout = false;
    let isActive = true;
    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, 45000);

    fetch(`/api/regionals/teams?eventKey=${encodeURIComponent(eventKey || "")}`, {
      credentials: 'include',
      signal: controller.signal
    })
      .then(res => {
        if (res.status === 403) {
          throw new Error('Este regional foi iniciado e não permite mais seleções.');
        }
        if (!res.ok) {
          throw new Error('Não foi possível carregar as equipes deste regional.');
        }
        return res.json();
      })
      .then(data => {
        console.log("✅ Times carregados:", data.length);
        setTeams(data);
        setFilteredTeams(data);
        setIsLocked(false);
        
        if (isEditing && currentAlliance && currentAlliance.length > 0) {
          const prefilledSelected = currentAlliance.map(allianceTeam => {
            const fullTeamData = data.find(t => t.team_number === allianceTeam.teamNumber);
            if (!fullTeamData) return null;
            return {
              team: fullTeamData,
              isCaptain: allianceTeam.isCaptain
            };
          }).filter(Boolean);
          setSelected(prefilledSelected);
          setHasChanges(false);
        }
      })
      .catch(err => {
        if (!isActive) return;

        if (err.name === 'AbortError' && !didTimeout) {
          return;
        }

        console.error("❌ Erro ao carregar times:", err);
        const message = err.name === 'AbortError'
          ? 'Tempo esgotado ao carregar equipes. Tente novamente.'
          : (err.message || 'Erro ao carregar times do regional.');
        alert(message);
        navigate(isEditing ? '/dashboard' : '/choose-regional');
      })
      .finally(() => {
        if (!isActive) return;
        clearTimeout(timeoutId);
        setLoading(false);
      });

    return () => {
      isActive = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [eventKey, navigate, isEditing, currentAlliance]);

  function handleSearch(e) {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    const filtered = teams.filter(t =>
      (t.nickname && t.nickname.toLowerCase().includes(term)) ||
      t.team_number.toString().includes(term)
    );
    setFilteredTeams(filtered);
  }

  function toggleTeam(team) {
    setSelected(curr => {
      const idx = curr.findIndex(s => s.team.team_number === team.team_number);
      if (idx !== -1) {
        // remove
        const copy = [...curr];
        copy.splice(idx, 1);
        setHasChanges(true);
        return copy;
      }
      if (curr.length >= 3) return curr;

      const currentCost = curr.reduce(
        (sum, selectedTeam) => sum + Number(selectedTeam?.team?.price ?? selectedTeam?.team?.marketValue ?? 0),
        0
      );
      const nextTeamCost = Number(team?.price ?? team?.marketValue ?? 0);
      if (currentCost + nextTeamCost > availablePatrimony) {
        alert("Patrimônio insuficiente para selecionar este time.");
        return curr;
      }

      setHasChanges(true);
      return [...curr, { team, isCaptain: false }];
    });
  }

  function markCaptain(teamNumber) {
    setSelected(curr => curr.map(s => ({
      ...s,
      isCaptain: s.team.team_number === teamNumber
    })));
  }

  const canSave = selected.length === 3 && selected.some(s => s.isCaptain);

  async function handleSave() {
    if (!canSave) return;
    try {
      const alliance = selected.map(s => ({
        teamNumber: s.team.team_number,
        nickname: s.team.nickname || s.team.name || `Team ${s.team.team_number}`,
        isCaptain: s.isCaptain,
        marketValue: Number(s.team?.price ?? s.team?.marketValue ?? 0)
      }));
      
      const response = await fetch('/api/me/alliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ eventKey, alliance, isEditing })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 409) {
          alert(data.message || 'Você já escalou neste regional.');
          navigate('/choose-regional');
          return;
        }
        if (response.status === 403) {
          alert('Este regional foi iniciado e não permite mais seleções.');
          navigate('/dashboard');
          return;
        }
        throw new Error(data.error || 'Erro ao salvar aliança');
      }
      
      alert('Aliança salva com sucesso!');
      navigate('/dashboard');
    } catch (err) {
      console.error("❌ Erro ao salvar aliança:", err);
      alert(err.message || 'Erro ao salvar aliança');
    }
  }

  function handleHeaderClick() {
    if (hasChanges) {
      const confirmed = window.confirm(
        "Tem certeza que deseja retornar? As mudanças não serão salvas."
      );
      if (!confirmed) return;
    }
    navigate(isEditing ? '/dashboard' : '/choose-regional');
  }

  const getTeamLogo = (teamNumber) => {
    const colors = ["#667eea", "#764ba2", "#f093fb", "#4facfe", "#0b5fa5", "#2ecc71"];
    return colors[teamNumber % colors.length];
  };

  return (
    <>
      <AppHeader
        title="FANTASY - FRC"
        onTitleClick={handleHeaderClick}
        rightText="ESCOLHA SUA ALIANÇA"
        maxWidth={1200}
      />

      <div className="container">
        
        {/* LEFT COLUMN: Pesquisar + Sua Aliança */}
        <div style={{ flex: "1 1 340px", minWidth: isMobile ? "100%" : "320px", display: "flex", flexDirection: "column", gap: "20px" }}>
          
          <div className="card">
            <h3>PESQUISAR / FILTRAR</h3>
            <input
              placeholder="Nome ou Número"
              value={searchTerm}
              onChange={handleSearch}
            />
            <button className="button-red">FILTRAR</button>
          </div>

          <div className="card">
            <h3>SUA ALIANÇA</h3>
            <p style={{ margin: "0 0 12px 0", color: "#666", fontSize: "13px" }}>
              Patrimônio disponível: <strong>{remainingPatrimony.toFixed(2)} ◈</strong>
            </p>
            
            {/* Preview em 3 slots como o figma */}
            <div style={{
              display: "flex",
              flexWrap: isMobile ? "wrap" : "nowrap",
              gap: "15px",
              marginBottom: "20px",
              justifyContent: "space-around"
            }}>
              {[0, 1, 2].map((idx) => {
                const selectedTeam = selected[idx];
                const isCaptain = selectedTeam?.isCaptain;
                
                return (
                  <div
                    key={idx}
                    style={{
                      flex: isMobile ? "1 1 100%" : 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gaps: "10px",
                      padding: "15px",
                      backgroundColor: selectedTeam ? "#f0f8ff" : "#f5f5f5",
                      borderRadius: "8px",
                      border: isCaptain ? "2px solid #e53935" : "1px solid #ddd"
                    }}
                  >
                    {selectedTeam ? (
                      <>
                        <div
                          style={{
                            width: "60px",
                            height: "60px",
                            borderRadius: "50%",
                            background: getTeamLogo(selectedTeam.team.team_number),
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: "24px",
                            fontWeight: "bold",
                            marginBottom: "8px"
                          }}
                        >
                          {selectedTeam.team.team_number.toString().slice(-2)}
                        </div>
                        <div style={{
                          textAlign: "center",
                          fontSize: "12px",
                          fontWeight: "bold",
                          color: "#222",
                          maxWidth: "100%",
                          wordBreak: "break-word"
                        }}>
                          {selectedTeam.team.nickname || `T${selectedTeam.team.team_number}`}
                        </div>
                        <div style={{
                          textAlign: "center",
                          fontSize: "11px",
                          color: "#999"
                        }}>
                          #{selectedTeam.team.team_number}
                        </div>
                        {isCaptain && (
                          <div style={{
                            marginTop: "6px",
                            fontSize: "11px",
                            color: "#e53935",
                            fontWeight: "bold"
                          }}>
                            ⭐ CAPITÃO
                          </div>
                        )}
                        <button
                          style={{
                            marginTop: "8px",
                            padding: "4px 8px",
                            backgroundColor: "#e53935",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "11px",
                            fontWeight: "bold"
                          }}
                          onClick={() => toggleTeam(selectedTeam.team)}
                        >
                          REMOVER
                        </button>
                      </>
                    ) : (
                      <>
                        <div
                          style={{
                            width: "60px",
                            height: "60px",
                            borderRadius: "50%",
                            backgroundColor: "#e0e0e0",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: "8px",
                            fontSize: "24px",
                            color: "#999"
                          }}
                        >
                          ?
                        </div>
                        <div style={{
                          textAlign: "center",
                          fontSize: "12px",
                          color: "#999",
                          fontWeight: "bold"
                        }}>
                          NÃO SELECIONADO
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Info text */}
            {selected.length > 0 && (
              <p style={{ 
                color: "#999", 
                fontSize: "12px", 
                marginTop: "12px", 
                textAlign: "center",
                marginBottom: "12px"
              }}>
                {selected.length < 3
                  ? `${3 - selected.length} time(s) restante(s)`
                  : selected.some(s => s.isCaptain)
                    ? '✅ Pronto para salvar'
                    : '⚠️ Marque um capitão antes de salvar'}
              </p>
            )}

            {canSave && (
              <button className="button-green" onClick={handleSave} style={{ marginTop: "15px" }}>
                SALVAR
              </button>
            )}

            {!canSave && selected.length > 0 && (
              <button 
                className="button-red" 
                style={{ marginTop: "15px", opacity: 0.6, cursor: "not-allowed" }}
                disabled
              >
                SALVAR
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Escolha sua Aliança */}
        <div className="card list" style={{ flex: "2 1 560px", minWidth: isMobile ? "100%" : "340px" }}>
          <h3>ESCOLHA SUA ALIANÇA</h3>

          {loading ? (
            <p style={{ color: "#999", textAlign: "center", padding: "20px" }}>
              Carregando equipes...
            </p>
          ) : filteredTeams.length === 0 ? (
            <p style={{ color: "#999", textAlign: "center" }}>
              {teams.length === 0 ? "Nenhuma equipe disponível" : "Nenhuma equipe encontrada"}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              <div style={{
                display: isMobile ? "none" : "flex",
                padding: "10px 0",
                borderBottom: "2px solid #0b5fa5",
                marginBottom: "10px",
                fontWeight: "bold",
                color: "#0b5fa5",
                fontSize: "12px"
              }}>
                <div style={{ flex: 1 }}>NOME</div>
                <div style={{ width: "80px" }}>NÚMERO</div>
                <div style={{ width: "80px" }}>PREÇO</div>
              </div>

              {filteredTeams.map(team => {
                const isSelected = selected.some(s => s.team.team_number === team.team_number);
                const isCaptain = selected.find(s => s.team.team_number === team.team_number)?.isCaptain;
                
                return (
                  <div
                    key={team.team_number}
                    onClick={() => {
                      if (isSelected) {
                        markCaptain(team.team_number);
                      } else {
                        toggleTeam(team);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "12px 0",
                      borderBottom: "1px solid #f0f0f0",
                      cursor: "pointer",
                      transition: "background-color 0.2s, border-left 0.2s",
                      backgroundColor: isSelected ? "#e3f2fd" : "transparent",
                      borderLeft: isCaptain ? "4px solid #e53935" : "4px solid transparent",
                      paddingLeft: "8px",
                      gap: isMobile ? "8px" : 0
                    }}
                    onMouseOver={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = "#f9f9f9";
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = isSelected ? "#e3f2fd" : "transparent";
                    }}
                  >
                  <div
                    style={{
                      width: "35px",
                      height: "35px",
                      borderRadius: "50%",
                      background: getTeamLogo(team.team_number),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "white",
                      fontWeight: "bold",
                      fontSize: "12px",
                      marginRight: "12px",
                      flexShrink: 0
                    }}
                  >
                    {team.team_number.toString().slice(-2)}
                  </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold", color: "#222" }}>
                        {team.nickname || `TEAM ${team.team_number}`}
                        {isCaptain && ' ⭐'}
                      </div>
                      <div style={{ fontSize: "12px", color: "#999" }}>
                        {team.locality || "---"}
                      </div>
                    </div>
                    <div style={{ width: isMobile ? "70px" : "80px", textAlign: "center", fontWeight: "bold", color: "#555", fontSize: isMobile ? "12px" : "14px" }}>
                      #{team.team_number}
                    </div>
                    <div style={{ width: isMobile ? "70px" : "80px", textAlign: "right", fontWeight: "bold", color: "#0b5fa5", fontSize: isMobile ? "12px" : "14px" }}>
                      {(team.price ?? 100)} ◈
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </>
  );
}

export default ChooseAlliance;