import React from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';

const Card = styled.div`
  background: #fff;
  color: #333;
  border-radius: 8px;
  padding: 18px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.12);
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:12px;
`;

const Title = styled.h3`
  margin:0;
  font-size:14px;
  color:#222;
`;

const Region = styled.p`
  margin:0;
  font-size:12px;
  color:#777;
`;

const TeamsList = styled.div`
  display: flex;
  flex-direction: row;
  gap: 12px;
  margin: 12px 0;
  justify-content: center;
`;

const Team = styled.div`
  background: #f5f5f5;
  padding: 8px 12px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
`;

const TeamLogo = styled.div`
  width: 45px;
  height: 45px;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 15px;
  flex-shrink: 0;
`;

const TeamNumber = styled.span`
  font-weight: bold;
  color: #222;
  font-size: 13px;
  word-break: break-word;
`;

const TeamNickname = styled.p`
  margin: 4px 0 0;
  font-size: 11px;
  color: #999;
`;

const CaptainBadge = styled.span`
  color: #ff6b35;
  font-size: 12px;
  font-weight: bold;
`;

const ScoreRow = styled.div`
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  margin-top:10px;
`;

const ScoreValue = styled.span`
  color: ${({ $score }) => {
    const value = Number($score || 0);
    if (value > 0) return '#1f9d48';
    if (value < 0) return '#d33b3b';
    return '#7a7a7a';
  }};
  font-size: 20px;
  line-height: 1;
  font-weight:700;
`;

const PriceTag = styled.span`
  font-size: 13px;
  color: #555;
  font-weight: 600;
`;

const ActionsWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const ScoreWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const DetailsButton = styled.button`
  background: #fff;
  color: #333;
  border: 1px solid #777;
  padding: 8px 14px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
`;

const EditButton = styled.button`
  background: #ff9800;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
  
  &:hover {
    background: #f57c00;
  }
`;

const DeleteButton = styled.button`
  background: #fff;
  color: #333;
  border: 1px solid #777;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
`;

const getTeamColor = (teamNumber) => {
  const colors = ["#667eea", "#764ba2", "#f093fb", "#4facfe", "#0b5fa5", "#2ecc71"];
  return colors[teamNumber % colors.length];
};

export const AllianceCard = ({ 
  teams = [], 
  totalScore = 0, 
  isSelected = false, 
  regionName = '', 
  eventKey = '',
  eventStartDate = null,
  totalPrice = 0,
  onDelete = null
}) => {
  const navigate = useNavigate();
  
  // Verificar se o evento começou
  const hasStarted = eventStartDate ? new Date() >= new Date(eventStartDate) : false;
  
  const handleEdit = () => {
    navigate(`/choose-alliance/${eventKey}`, {
      state: {
        isEditing: true,
        alliance: teams
      }
    });
  };

  const handleDelete = () => {
    if (typeof onDelete === 'function') {
      onDelete(eventKey, regionName);
    }
  };

  const handleDetails = () => {
    alert('Esse recurso ainda esta em desenvolvimento');
  };
  
  return (
    <Card $selected={isSelected}>
      <Header>
        <div>
          <Title>ALIANÇAS</Title>
          <Region>{regionName || 'Regional não definido'}</Region>
        </div>
        <div />
      </Header>

      <TeamsList>
        {teams.map((team, i) => (
          <Team key={i}>
            <TeamLogo 
              style={{
                background: getTeamColor(team.teamNumber)
              }}
            >
              {team.teamNumber?.toString().slice(-2)}
            </TeamLogo>
            <div style={{textAlign: 'center'}}>
              <TeamNumber>
                #{team.teamNumber} {team.isCaptain && '⭐'}
              </TeamNumber>
              {team.isCaptain && <CaptainBadge>CAPITÃO</CaptainBadge>}
              {team.nickname && <TeamNickname>{team.nickname}</TeamNickname>}
            </div>
          </Team>
        ))}
      </TeamsList>

      <ScoreRow>
        {hasStarted ? (
          <ScoreWrap>
            <ScoreValue $score={totalScore}>{Number(totalScore).toFixed(2)}</ScoreValue>
            <DetailsButton onClick={handleDetails}>VER DETALHES</DetailsButton>
          </ScoreWrap>
        ) : (
          <ActionsWrap>
            <EditButton onClick={handleEdit}>EDITAR</EditButton>
            <DeleteButton onClick={handleDelete}>EXCLUIR</DeleteButton>
            <PriceTag>{Number(totalPrice || 0).toFixed(2)} ◈</PriceTag>
          </ActionsWrap>
        )}
      </ScoreRow>
    </Card>
  );
};