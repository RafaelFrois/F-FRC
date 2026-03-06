import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { AllianceCard } from '../../components/AllianceCards';
import { EmptySelection } from '../../components/EmptySelection';
import { PatrimonyCard } from '../../components/PatrimonyCard';
import AppHeader from '../../components/AppHeader';
import { getMe } from '../../services/api';
import { useNavigate } from 'react-router-dom';
// omitted MostChosen/TopScoring for first version

const FullPage = styled.div`
  background: #ffffff;
  min-height: 100vh;
  width: 100%;
  color: #222;
`;

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;

  @media (max-width: 768px) {
    padding: 14px 10px;
  }
`;

const Subtitle = styled.h2`
  font-size: 16px;
  margin: 0;
  color: #666;
`;

const MainContent = styled.div`
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 24px;
  align-items: start;
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const LeftColumn = styled.aside`
  display:flex;
  flex-direction:column;
  gap:16px;
  align-items:center;
`;

const CenterColumn = styled.main`
  display:flex;
  flex-direction:column;
  gap:16px;
`;

const Panel = styled.div`
  background:#fff;
  border-radius:10px;
  padding:18px;
  color:#222;
  box-shadow: 0 8px 30px rgba(0,0,0,0.12);

  @media (max-width: 768px) {
    padding: 12px;
  }
`;

const Grid2 = styled.div`
  display:grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap:12px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const SidebarAvatar = styled.div`
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:12px;
`;

const AvatarCircle = styled.div`
  width:88px;
  height:88px;
  border-radius:50%;
  background:linear-gradient(180deg,#ffd966,#f39c12);
  display:flex;
  align-items:center;
  justify-content:center;
  color:#fff;
  font-weight:700;
  background-size: cover;
  background-position: center;
`;

const UsernameText = styled.div`
  font-size:16px;
  font-weight:700;
  color:#222;
  margin-top:4px;
`;

const ProfileButton = styled.button`
  background:#ffffff;
  border-radius:12px;
  padding:10px 14px;
  border:1px solid rgba(0,0,0,0.06);
  cursor:pointer;
  font-weight:600;
  color:#0b3f7a;
  box-shadow: 0 6px 18px rgba(11,63,122,0.06);
`;

const HelpButton = styled.button`
  background:#e9f5ff;
  border:none;
  color:#2b7be4;
  padding:10px 12px;
  border-radius:8px;
  cursor:pointer;
`;

const TopWeekPanel = styled(Panel)`
  margin-top: 8px;
  border: 1px solid #e3e3e3;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

const TopWeekTitle = styled.h3`
  margin: 0 0 12px 0;
  font-size: 32px;
  color: #222;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: uppercase;

  @media (max-width: 768px) {
    font-size: 26px;
  }
`;

const TopWeekStatus = styled.div`
  margin: -6px 0 12px;
  font-size: 13px;
  color: #6b6b6b;
`;

const TopWeekGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const TeamTopCard = styled.div`
  border: none;
  border-radius: 8px;
  padding: 8px 12px 10px;
  text-align: center;
  background: #fff;
`;

const TeamTopName = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: #222;
  margin-bottom: 8px;
  text-transform: uppercase;
`;

const TeamTopLogo = styled.img`
  width: 84px;
  height: 56px;
  object-fit: contain;
  opacity: 0.7;
  margin: 0 auto 8px;

  @media (max-width: 768px) {
    width: 74px;
    height: 50px;
  }
`;

const TeamTopNumber = styled.div`
  font-size: 13px;
  color: #777;
  margin-bottom: 6px;
`;

const TeamTopPoints = styled.div`
  font-size: 26px;
  font-weight: 800;
  color: #19b64f;
  line-height: 1;

  @media (max-width: 768px) {
    font-size: 22px;
  }
`;

const TeamTopEvent = styled.div`
  font-size: 12px;
  color: #4d4d4d;
  margin-top: 8px;
  min-height: 32px;
`;

const TeamTopDetailsButton = styled.button`
  margin-top: 10px;
  padding: 8px 12px;
  border: 1px solid #dbe7ff;
  border-radius: 8px;
  background: #f3f8ff;
  color: #1a4b94;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;

  &:hover {
    background: #e9f2ff;
  }
`;

const DetailsOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  z-index: 3000;
`;

const DetailsCard = styled.div`
  width: min(720px, 100%);
  max-height: calc(100vh - 24px);
  overflow: auto;
  background: #f2f2f2;
  border-radius: 10px;
  border: 1px solid #d4d4d4;
  padding: 24px 22px 20px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.25);

  @media (max-width: 768px) {
    padding: 16px 12px 14px;
    max-height: calc(100vh - 12px);
  }
`;

const DetailsTopBar = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const DetailsCloseButton = styled.button`
  background: transparent;
  border: none;
  color: #333;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
`;

const DetailsLogo = styled.img`
  width: 190px;
  height: auto;
  display: block;
  margin: 0 auto;
  object-fit: contain;
`;

const DetailsTeamName = styled.div`
  margin-top: 8px;
  text-align: center;
  font-size: 24px;
  font-weight: 800;
  color: #1f1f1f;
  text-transform: uppercase;
`;

const DetailsTeamMeta = styled.div`
  margin-top: 4px;
  text-align: center;
  font-size: 14px;
  color: #444;
  text-transform: uppercase;
`;

const DetailsList = styled.div`
  margin: 20px auto 0;
  width: min(580px, 100%);

  @media (max-width: 768px) {
    width: 100%;
    margin-top: 14px;
  }
`;

const DetailsRow = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(64px, 110px) 24px minmax(88px, 130px);
  gap: 12px;
  align-items: center;
  padding: 7px 0;

  @media (max-width: 768px) {
    grid-template-columns: minmax(0, 1fr) minmax(52px, 82px) 18px minmax(72px, 100px);
    gap: 8px;
    padding: 6px 0;
  }
`;

const DetailsLabel = styled.div`
  font-size: clamp(18px, 2.6vw, 33px);
  color: #111;
  line-height: 1.15;
`;

const DetailsAmount = styled.div`
  font-size: clamp(18px, 2.6vw, 33px);
  color: #111;
  text-align: right;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
`;

const DetailsEq = styled.div`
  font-size: clamp(18px, 2.6vw, 33px);
  color: #111;
  text-align: center;
  line-height: 1.15;
`;

const DetailsPoints = styled.div`
  font-size: clamp(18px, 2.6vw, 33px);
  color: ${(props) => (props.$negative ? '#d40000' : '#00c21a')};
  font-weight: 700;
  text-align: right;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
`;

const DetailsDivider = styled.hr`
  border: none;
  border-top: 1px solid #c8c8c8;
  margin: 16px 0;
`;

const DetailsTotalLabel = styled.div`
  text-align: center;
  font-size: clamp(24px, 4.2vw, 40px);
  color: #111;
  font-weight: 700;
`;

const DetailsTotalValue = styled.div`
  text-align: center;
  font-size: clamp(28px, 4.8vw, 44px);
  color: #00c21a;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
`;

const MostChosenPanel = styled(TopWeekPanel)`
  margin-top: 0;
`;

const MostChosenTitle = styled(TopWeekTitle)`
  text-transform: uppercase;
`;

const MostChosenGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #ececec;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const MostChosenCard = styled(TeamTopCard)`
  border-radius: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 10px;

  &:not(:last-child) {
    border-right: 1px solid #ececec;
  }

  @media (max-width: 900px) {
    &:not(:last-child) {
      border-right: none;
      border-bottom: 1px solid #ececec;
    }
  }
`;

const MostChosenLeft = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 95px;
`;

const MostChosenLogo = styled(TeamTopLogo)`
  width: 96px;
  height: 64px;
  margin: 0;
`;

const MostChosenTeamNumber = styled(TeamTopNumber)`
  margin: 4px 0 0;
  font-weight: 700;
  color: #222;
`;

const MostChosenInfo = styled.div`
  flex: 1;
  text-align: left;
  min-width: 0;
`;

const MostChosenTeamName = styled(TeamTopName)`
  margin: 0 0 4px;
  font-size: 13px;
  line-height: 1.2;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
`;

const MostChosenMetaLabel = styled.div`
  font-size: 12px;
  color: #4d4d4d;
  font-weight: 700;
`;

const MostChosenMeta = styled.div`
  font-size: 18px;
  font-weight: 700;
  color: #222;
  line-height: 1;
`;

const MostChosenCount = styled.div`
  font-size: 26px;
  font-weight: 800;
  color: #222;
  min-width: 42px;
  text-align: right;
`;

const MostChosenRank = styled.div`
  font-size: 42px;
  font-weight: 700;
  color: #111;
  line-height: 1;
  min-width: 48px;
  text-align: right;
`;

export default function Dashboard() {
  const [selectedAlliance] = useState({
    teams: [
      { number: '156' },
      { number: '9458' },
      { number: '9199' }
    ],
    totalScore: 86.35
  });

  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [topWeekTeams, setTopWeekTeams] = useState([]);
  const [isTopWeekLoading, setIsTopWeekLoading] = useState(true);
  const [mostChosenTeams, setMostChosenTeams] = useState([]);
  const [isMostChosenLoading, setIsMostChosenLoading] = useState(true);
  const [selectedTopTeam, setSelectedTopTeam] = useState(null);

  function calculateCurrentWeek() {
    const seasonYear = new Date().getFullYear();
    const today = new Date();
    const week1Start = new Date(seasonYear, 2, 1);
    const week1End = new Date(seasonYear, 2, 8);
    const week1AvailableFrom = new Date(week1Start.getTime() - 14 * 24 * 60 * 60 * 1000);

    if (today >= week1AvailableFrom && today <= week1End) {
      return 1;
    }

    if (today > week1End) {
      const daysSinceWeek1Start = Math.floor((today - week1Start) / (1000 * 60 * 60 * 24));
      return Math.max(1, Math.floor(daysSinceWeek1Start / 7) + 1);
    }

    return 1;
  }

  useEffect(() => {
    let mounted = true;
    let intervalId = null;

    const loadUser = async () => {
      try {
        const u = await getMe();
        if (mounted) setUser(u);
      } catch (e) {
        console.warn('Could not load current user', e);
      }
    };

    (async () => {
      await loadUser();
      intervalId = setInterval(loadUser, 30000);
    })();

    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (mounted) setIsMostChosenLoading(true);

      try {
        const week = calculateCurrentWeek();
        const response = await fetch(`/api/score/top-week?week=${week}&metric=chosen`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (mounted) {
          setMostChosenTeams(Array.isArray(data?.teams) ? data.teams.slice(0, 3) : []);
        }
      } catch (error) {
        if (mounted) {
          setMostChosenTeams([]);
        }
      } finally {
        if (mounted) {
          setIsMostChosenLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (mounted) setIsTopWeekLoading(true);

      try {
        const week = calculateCurrentWeek();
        const response = await fetch(`/api/score/top-week?week=${week}`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (mounted) {
          setTopWeekTeams(Array.isArray(data?.teams) ? data.teams.slice(0, 3) : []);
        }
      } catch (error) {
        if (mounted) {
          setTopWeekTeams([]);
        }
      } finally {
        if (mounted) {
          setIsTopWeekLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const initials = user && user.username
    ? user.username.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()
    : 'RF';

  const handleChooseTeam = () => {
    // redirect to regional chooser
    navigate('/choose-regional');
  };

  const handleHelp = () => {
    navigate('/entenda-o-jogo');
  };

  const handleTeamDetails = (team) => {
    if (!team) return;
    setSelectedTopTeam(team);
  };

  const closeTeamDetails = () => {
    setSelectedTopTeam(null);
  };

  const formatDetailNumber = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(2);
  };

  const formatSignedPoints = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0.00';
    if (n > 0) return `+${n.toFixed(2)}`;
    return n.toFixed(2);
  };

  const handleDeleteAlliance = async (eventKey, regionName) => {
    const confirmed = window.confirm(
      `Deseja excluir a aliança do regional ${regionName || eventKey}?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/me/alliance?eventKey=${encodeURIComponent(eventKey)}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const contentType = response.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? await response.json()
        : { message: await response.text() };

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Erro ao excluir aliança');
      }

      setUser(data.user);
      alert('Aliança excluída com sucesso!');
    } catch (error) {
      alert(error.message || 'Erro ao excluir aliança');
    }
  };

  return (
    <FullPage>
      <AppHeader
        title="FANTASY - FRC"
        subtitle="WEEK 1 – 2026 REBUILT"
        rightText="PÁGINA INICIAL"
        maxWidth={1200}
      />

      <Container>
        <MainContent>
        <LeftColumn>
          <SidebarAvatar>
            <AvatarCircle style={user?.profilePhoto ? { backgroundImage: `url(${user.profilePhoto})` } : {}}>
              {!user?.profilePhoto && initials}
            </AvatarCircle>
            <UsernameText>{user?.username || 'Usuário'}</UsernameText>
            <ProfileButton onClick={() => navigate('/user')}>VER PERFIL</ProfileButton>
          </SidebarAvatar>

          <PatrimonyCard
            value={`${Number(user?.patrimonio ?? 300).toFixed(2)} ◈`}
            totalScore={Number(user?.totalPointsSeason ?? 0).toFixed(2)}
            onHelp={handleHelp}
          />
        </LeftColumn>

        <CenterColumn>
          <Panel>
            <h2 style={{margin:0}}>ALIANÇAS</h2>
            <Grid2 style={{marginTop:12}}>
              {[0, 1, 2, 3].map((index) => (
                <div key={index}>
                  {user?.regionals && user.regionals.length > index ? (
                    <AllianceCard 
                      teams={user.regionals[index].alliance.map(a => ({ 
                        teamNumber: a.teamNumber,
                        nickname: a.nickname,
                        isCaptain: a.isCaptain,
                        points: Number(a?.points || 0)
                      }))}
                      totalScore={user.regionals[index].totalRegionalPoints || selectedAlliance.totalScore}
                      regionName={user.regionals[index].regionalName}
                      eventStartDate={user.regionals[index].eventStartDate || user.regionals[index].event_start_date}
                      totalPrice={(user.regionals[index].alliance || []).reduce((sum, entry) => {
                        return sum + Number(entry?.marketValue || 0);
                      }, 0)}
                      eventKey={user.regionals[index].eventKey}
                      isSelected={true}
                      onDelete={handleDeleteAlliance}
                    />
                  ) : (
                    <EmptySelection onChoose={handleChooseTeam} />
                  )}
                </div>
              ))}
            </Grid2>
          </Panel>

          <TopWeekPanel>
            <TopWeekTitle>EQUIPES QUE MAIS PONTUARAM</TopWeekTitle>
            {isTopWeekLoading && (
              <TopWeekStatus>Calculando pontuação da week...</TopWeekStatus>
            )}
            <TopWeekGrid>
              {[0, 1, 2].map((index) => {
                const team = topWeekTeams[index];

                return (
                  <TeamTopCard key={team?.key || `placeholder-${index}`}>
                    <TeamTopName>{team?.teamName || (isTopWeekLoading ? 'CALCULANDO...' : 'NOME DA EQUIPE')}</TeamTopName>
                    <TeamTopLogo src="/Logo-Principal-NoBG.png" alt="Team logo" />
                    <TeamTopNumber>{team ? `#${team.teamNumber}` : '---'}</TeamTopNumber>
                    <TeamTopPoints>{team ? Number(team.points).toFixed(2) : (isTopWeekLoading ? '...' : '---')}</TeamTopPoints>
                    <TeamTopEvent>{team?.eventName || (isTopWeekLoading ? 'Buscando eventos em andamento...' : 'Evento indisponível')}</TeamTopEvent>
                    <TeamTopDetailsButton onClick={() => handleTeamDetails(team)}>VER DETALHES</TeamTopDetailsButton>
                  </TeamTopCard>
                );
              })}
            </TopWeekGrid>
          </TopWeekPanel>

          <MostChosenPanel>
            <MostChosenTitle>EQUIPES MAIS ESCALADAS</MostChosenTitle>
            {isMostChosenLoading && (
              <TopWeekStatus>Buscando equipes mais escolhidas...</TopWeekStatus>
            )}
            <MostChosenGrid>
              {[0, 1, 2].map((index) => {
                const team = mostChosenTeams[index];
                const rank = index + 1;

                return (
                  <MostChosenCard key={team?.key || `chosen-placeholder-${index}`}>
                    <MostChosenLeft>
                      <MostChosenLogo src="/Logo-Principal-NoBG.png" alt="Team logo" />
                      <MostChosenTeamNumber>{team ? `#${team.teamNumber}` : '---'}</MostChosenTeamNumber>
                    </MostChosenLeft>

                    <MostChosenInfo>
                      <MostChosenTeamName>{team?.teamName || (isMostChosenLoading ? 'CARREGANDO...' : 'NOME DA EQUIPE')}</MostChosenTeamName>
                      <MostChosenMetaLabel>ESCOLHIDA POR:</MostChosenMetaLabel>
                      <MostChosenMeta>
                        {team ? `${Number(team.peopleCount).toFixed(0)} pessoas` : (isMostChosenLoading ? 'Carregando...' : 'Sem seleções')}
                      </MostChosenMeta>
                    </MostChosenInfo>

                    <MostChosenRank>{`${rank}º`}</MostChosenRank>
                  </MostChosenCard>
                );
              })}
            </MostChosenGrid>
          </MostChosenPanel>
        </CenterColumn>
        </MainContent>
      </Container>

      {selectedTopTeam && (
        <DetailsOverlay onClick={closeTeamDetails}>
          <DetailsCard onClick={(e) => e.stopPropagation()}>
            <DetailsTopBar>
              <DetailsCloseButton onClick={closeTeamDetails} aria-label="Fechar detalhes">×</DetailsCloseButton>
            </DetailsTopBar>

            <DetailsLogo src="/Logo-Principal-NoBG.png" alt="Team logo" />
            <DetailsTeamName>{selectedTopTeam.teamName}</DetailsTeamName>
            <DetailsTeamMeta>{`${selectedTopTeam.eventName} #${selectedTopTeam.teamNumber}`}</DetailsTeamMeta>

            <DetailsList>
              {(selectedTopTeam.scoreDetails?.items || []).map((item) => (
                <DetailsRow key={item.id}>
                  <DetailsLabel>{`${item.label}:`}</DetailsLabel>
                  <DetailsAmount>{formatDetailNumber(item.amount)}</DetailsAmount>
                  <DetailsEq>=</DetailsEq>
                  <DetailsPoints $negative={Number(item.points) < 0}>{formatSignedPoints(item.points)}</DetailsPoints>
                </DetailsRow>
              ))}
            </DetailsList>

            <DetailsDivider />
            <DetailsTotalLabel>TOTAL</DetailsTotalLabel>
            <DetailsTotalValue>
              {formatSignedPoints(selectedTopTeam.scoreDetails?.totalPoints ?? selectedTopTeam.points)}
            </DetailsTotalValue>
          </DetailsCard>
        </DetailsOverlay>
      )}
    </FullPage>
  );
}