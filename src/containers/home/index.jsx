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
  font-size: 28px;
  color: #4a4a4a;
  font-weight: 400;
  letter-spacing: 0.3px;

  @media (max-width: 768px) {
    font-size: 22px;
  }
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
    (async () => {
      try {
        const u = await getMe();
        if (mounted) setUser(u);
      } catch (e) {
        console.warn('Could not load current user', e);
      }
    })();
    return () => { mounted = false };
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
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
                        isCaptain: a.isCaptain
                      }))}
                      totalScore={user.regionals[index].totalRegionalPoints || selectedAlliance.totalScore}
                      regionName={user.regionals[index].regionalName}
                      eventStartDate={user.regionals[index].event_start_date}
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
            <TopWeekGrid>
              {[0, 1, 2].map((index) => {
                const team = topWeekTeams[index];

                return (
                  <TeamTopCard key={team?.key || `placeholder-${index}`}>
                    <TeamTopName>{team?.teamName || 'NOME DA EQUIPE'}</TeamTopName>
                    <TeamTopLogo src="/Logo-Principal-NoBG.png" alt="Team logo" />
                    <TeamTopNumber>{team ? `#${team.teamNumber}` : '---'}</TeamTopNumber>
                    <TeamTopPoints>{team ? Number(team.points).toFixed(2) : '---'}</TeamTopPoints>
                    <TeamTopEvent>{team?.eventName || 'Evento indisponível'}</TeamTopEvent>
                  </TeamTopCard>
                );
              })}
            </TopWeekGrid>
          </TopWeekPanel>
        </CenterColumn>
        </MainContent>
      </Container>
    </FullPage>
  );
}