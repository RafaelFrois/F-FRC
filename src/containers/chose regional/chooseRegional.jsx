import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../../services/api";
import AppHeader from "../../components/AppHeader";
import "../../styles/Regional-Teams.css";

function ChooseRegional() {
  const [regionals, setRegionals] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [filteredRegionals, setFilteredRegionals] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [userRegionalKeys, setUserRegionalKeys] = useState([]);
  const navigate = useNavigate();
  const seasonYear = new Date().getFullYear();

  // Calcular a weekde um evento baseado na sua data de início
  function calculateEventWeek(eventStartDate) {
    try {
      let eventDate;
      
      // Parse mais robusto da data
      if (typeof eventStartDate === 'string') {
        // Se for string "2026-03-01", criar date sem fuso horário
        eventDate = new Date(eventStartDate.split('T')[0] + 'T00:00:00');
      } else {
        eventDate = new Date(eventStartDate);
      }
      
      const week1Start = new Date(seasonYear, 2, 1);
      
      console.log(`    Parse: "${eventStartDate}" -> ${eventDate.toLocaleDateString('pt-BR')}`);
      
      // Se a data do evento é antes de 08/03, é week 1
      if (eventDate < new Date(seasonYear, 2, 8)) {
        return 1;
      }
      
      // Calcular numero da semana baseado no dia desde 01/03
      const daysSinceWeek1 = Math.floor((eventDate - week1Start) / (1000 * 60 * 60 * 24));
      const week = Math.floor(daysSinceWeek1 / 7) + 1;
      return Math.max(1, week);
    } catch (e) {
      console.error("Erro ao calcular week:", e);
      return 1;
    }
  }

  // Calcular a week atual baseado nas datas FRC 2026
  // Week 1: 01/03 - 08/03 (disponível a partir de 14/02 - 2 semanas antes)
  // Week 2: 08/03 - 15/03, etc
  function calculateCurrentWeek() {
    const today = new Date();
    const week1Start = new Date(seasonYear, 2, 1);
    const week1End = new Date(seasonYear, 2, 8);
    const week1AvailableFrom = new Date(week1Start.getTime() - 14 * 24 * 60 * 60 * 1000); // 2 semanas antes
    
    // Se estamos 2 semanas antes ou durante a week 1, retorna week 1
    if (today >= week1AvailableFrom && today <= week1End) {
      return 1;
    }
    
    // Se for após week 1, calcular qual week está ativa
    if (today > week1End) {
      const daysSinceWeek1Start = Math.floor((today - week1Start) / (1000 * 60 * 60 * 24));
      const week = Math.floor(daysSinceWeek1Start / 7) + 1;
      return Math.max(1, week);
    }
    
    // Se for bem antes de week 1 ficar disponível
    return 1; // Ainda mostra week 1, mas sem regionais disponíveis
  }

  // Retorna o status do regional
  function getStatus(regional) {
    const today = new Date();
    const start = new Date(regional.start_date);
    const end = new Date(regional.end_date);

    if (today > end) return "finished"; // Encerrado
    if (today >= start) return "locked";  // Bloqueado (começou)
    return "open";                         // Aberto
  }

  // Inicializar a week
  useEffect(() => {
    const week = calculateCurrentWeek();
    console.log("🔍 Week Calculada:", week);
    setCurrentWeek(week);
  }, []);

  // Buscar regionais já escalados pelo usuário
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const user = await getMe();
        if (!mounted) return;

        const normalizedKeys = (user?.regionals || []).map((regionalEntry) =>
          String(regionalEntry?.eventKey || "").trim().toLowerCase()
        ).filter(Boolean);

        setUserRegionalKeys(normalizedKeys);
      } catch (error) {
        console.warn("Não foi possível carregar regionais do usuário", error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Buscar regionais
  useEffect(() => {
    console.log("📡 Buscando regionais para week:", currentWeek);
    fetch(`/api/regionals?week=${currentWeek}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        console.log("📥 Regionais recebidos da API:", data);
        
        // Backend já filtrou por week, basta exibir
        const filteredData = data.filter(r => {
          const status = getStatus(r);
          // Mostrar apenas regionais não encerrados
          if (status === "finished") return false;
          return true;
        });
        
        console.log("✅ Regionais filtrados:", filteredData);
        setRegionals(filteredData);
        setFilteredRegionals(filteredData);
      })
      .catch(err => {
        console.log("❌ Erro ao buscar regionais:", err);
      });
  }, [currentWeek]);

  function handleSelect(regional) {
    const status = getStatus(regional);
    
    // REGRA 1: Verificar status antes de selecionar
    if (status === "locked") {
      alert("Este regional já foi iniciado e não permite mais seleções.");
      return;
    }
    
    if (status === "finished") {
      alert("Este regional já foi encerrado.");
      return;
    }
    
    const eventKey = regional.key || regional.event_key;
    const normalizedEventKey = String(eventKey || "").trim().toLowerCase();

    if (userRegionalKeys.includes(normalizedEventKey)) {
      alert("Você já escalou neste regional.");
      return;
    }

    if (eventKey) {
      navigate(`/choose-alliance/${eventKey}`);
    }
  }

  function handleHeaderClick() {
    const confirmed = window.confirm(
      "Tem certeza que deseja retornar? A aliança não será salva."
    );
    if (confirmed) {
      navigate("/dashboard");
    }
  }

  function handleSearch(e) {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);
    const filtered = regionals.filter(r =>
      r.name.toLowerCase().includes(term)
    );
    setFilteredRegionals(filtered);
  }

  function formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      month: "2-digit",
      day: "2-digit"
    });
  }

  return (
    <>
      <AppHeader
        title="FANTASY - FRC"
        onTitleClick={handleHeaderClick}
        rightText="ESCOLHA DE ALIANÇA"
        maxWidth={1200}
      />

      <div className="title-week">
        WEEK {currentWeek} – {seasonYear} REBUILT
      </div>

      <div className="container">
        <div className="card" style={{ flex: "1 1 280px", minWidth: "260px" }}>
          <h3>PESQUISAR / FILTRAR</h3>
          <input
            placeholder="Nome"
            value={searchTerm}
            onChange={handleSearch}
          />
          <button className="button-red">FILTRAR</button>
        </div>

        <div className="card list" style={{ flex: "2 1 520px", minWidth: "280px" }}>
          <h3>ESCOLHA UM EVENTO</h3>

          {filteredRegionals.length === 0 ? (
            <p style={{ color: "#999", textAlign: "center" }}>
              Nenhum evento disponível esta semana
            </p>
          ) : (
            filteredRegionals.map(regional => {
              const status = getStatus(regional);
              return (
                <div
                  key={regional.event_key || regional.key}
                  className="event-item"
                >
                  <div className="event-info" style={{ flex: 1 }}>
                    <div className="event-name">
                      {regional.name} - Week {regional.week}
                    </div>
                    <div className="event-date">
                      {formatDate(regional.start_date)} - {formatDate(regional.end_date)}
                    </div>
                  </div>
                  
                  {/* REGRA 5: Status Visual */}
                  {status === "open" && (
                    <button
                      className="button-green"
                      onClick={() => handleSelect(regional)}
                      style={{ width: "auto", padding: "8px 16px", marginLeft: "10px", maxWidth: "180px" }}
                    >
                      ESCOLHER
                    </button>
                  )}
                  
                  {status === "locked" && (
                    <span className="lock" style={{ fontSize: "16px", marginLeft: "10px" }}>
                      🔒 Iniciado
                    </span>
                  )}
                  
                  {status === "finished" && (
                    <span style={{ fontSize: "14px", color: "#999", marginLeft: "10px" }}>
                      Encerrado
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

export default ChooseRegional;