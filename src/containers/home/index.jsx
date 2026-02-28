import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { AllianceCard } from '../../components/AllianceCards';
import { EmptySelection } from '../../components/EmptySelection';
import { PatrimonyCard } from '../../components/PatrimonyCard';
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
`;

const HeaderBar = styled.header`
  width: 100%;
  background: linear-gradient(90deg,#0b66c3,#0a5bb0);
  color: white;
`;

const HeaderInner = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 14px 24px;
  display:flex;
  align-items:center;
  justify-content:space-between;
`;

const MainTitle = styled.h1`
  font-size: 28px;
  margin: 0 0 6px 0;
  color: #222;
`;

const Subtitle = styled.h2`
  font-size: 16px;
  margin: 0;
  color: #666;
`;

const WeekTitle = styled.h3`
  font-size: 14px;
  margin: 8px 0 0 0;
  color: #888;
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
`;

const Grid2 = styled.div`
  display:grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap:12px;
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
      const response = await fetch(`http://localhost:3000/api/me/alliance/${eventKey}`, {
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
      <HeaderBar>
        <HeaderInner>
          <div>
            <MainTitle style={{color:'#fff'}}>FANTASY - FRC</MainTitle>
            <WeekTitle style={{color:'rgba(255,255,255,0.9)'}}>WEEK 1 – 2026 REBUILT</WeekTitle>
          </div>
          <div>
            <Subtitle style={{color:'rgba(255,255,255,0.95)'}}>PÁGINA INICIAL</Subtitle>
          </div>
        </HeaderInner>
      </HeaderBar>

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
            value={`${Number(user?.patrimonio ?? 800).toFixed(2)} ◈`}
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
        </CenterColumn>
        </MainContent>
      </Container>
    </FullPage>
  );
}