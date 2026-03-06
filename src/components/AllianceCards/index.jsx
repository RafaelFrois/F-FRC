import React, { useMemo, useState } from 'react';
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

const DetailsOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 3200;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
`;

const DetailsModal = styled.div`
  width: min(900px, 100%);
  max-height: calc(100vh - 10px);
  overflow: auto;
  background: #ececec;
  border-radius: 8px;
  border: 1px solid #d4d4d4;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.25);
  padding: 10px 12px 14px;

  @media (max-width: 900px) {
    width: min(720px, 100%);
  }

  @media (max-width: 600px) {
    padding: 8px 8px 10px;
    max-height: calc(100vh - 6px);
  }
`;

const DetailsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
`;

const DetailsTitle = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: #333;
  text-transform: uppercase;
  letter-spacing: 0.03em;
`;

const DetailsClose = styled.button`
  border: none;
  background: transparent;
  color: #333;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
`;

const DetailsTeamsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  align-items: start;

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
    gap: 10px;
  }
`;

const DetailsTeamCard = styled.div`
  text-align: center;
  padding: 6px 4px;
`;

const DetailsTeamLogo = styled.div`
  width: 78px;
  height: 78px;
  border-radius: 50%;
  margin: 0 auto 6px;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
  font-weight: 800;
`;

const DetailsTeamName = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: #111;
  text-transform: uppercase;
  min-height: 24px;
`;

const DetailsTeamNumber = styled.div`
  font-size: 11px;
  color: #222;
  margin-top: 2px;
`;

const CaptainChip = styled.span`
  display: inline-block;
  margin-top: 6px;
  padding: 3px 8px;
  border-radius: 999px;
  background: #ff5b00;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
`;

const DetailsScoreGrid = styled.div`
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
    gap: 10px;
  }
`;

const DetailsScoreItem = styled.div`
  text-align: center;
  min-height: 50px;
`;

const DetailsScoreLabel = styled.div`
  font-size: 11px;
  color: #222;
  text-transform: uppercase;
`;

const DetailsScoreBase = styled.div`
  font-size: 20px;
  color: #00b81f;
  font-weight: 700;
  line-height: 1.1;
`;

const DetailsScoreBoosted = styled.div`
  font-size: 18px;
  color: #ff5b00;
  font-weight: 700;
  line-height: 1.1;
`;

const DetailsDivider = styled.hr`
  border: none;
  border-top: 1px solid #cfcfcf;
  margin: 8px 0 8px;
`;

const DetailsTotalLabel = styled.div`
  text-align: center;
  font-size: 24px;
  color: #111;
  text-transform: uppercase;
`;

const DetailsTotalValue = styled.div`
  text-align: center;
  font-size: 28px;
  color: #00b81f;
  font-weight: 800;
  line-height: 1;
`;

const getTeamColor = (teamNumber) => {
  const colors = ["#667eea", "#764ba2", "#f093fb", "#4facfe", "#0b5fa5", "#2ecc71"];
  return colors[teamNumber % colors.length];
};

const getDisplayTeamName = (team) => {
  const nickname = String(team?.nickname || team?.teamName || "").trim();
  if (nickname) return nickname;
  return "Nome da equipe";
};

const parseEventStartDate = (dateInput) => {
  if (!dateInput) return null;

  if (typeof dateInput === 'string') {
    const normalized = dateInput.includes('T')
      ? dateInput
      : `${dateInput}T00:00:00`;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(dateInput);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Verificar se o evento começou
  const parsedEventStartDate = parseEventStartDate(eventStartDate);
  const hasStarted = parsedEventStartDate ? new Date() >= parsedEventStartDate : false;

  // Sempre prioriza a soma dos 3 robôs quando os pontos individuais estão disponíveis.
  const summedAllianceScore = Array.isArray(teams)
    ? teams.reduce((sum, team) => sum + Number(team?.points || 0), 0)
    : 0;
  const hasTeamPoints = Array.isArray(teams) && teams.some((team) => team?.points !== undefined && team?.points !== null);
  const displayScore = hasTeamPoints ? summedAllianceScore : Number(totalScore || 0);

  const allianceDetails = useMemo(() => {
    const rows = (Array.isArray(teams) ? teams : []).map((team) => {
      const basePoints = Number(team?.points || 0);
      const isCaptain = Boolean(team?.isCaptain);
      const multiplier = isCaptain ? 1.5 : 1;
      const finalPoints = basePoints * multiplier;

      return {
        teamNumber: Number(team?.teamNumber || 0),
        nickname: getDisplayTeamName(team),
        isCaptain,
        basePoints,
        multiplier,
        finalPoints
      };
    });

    const total = rows.reduce((sum, row) => sum + Number(row.finalPoints || 0), 0);
    return { rows, total };
  }, [teams]);
  
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
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
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
              <TeamNickname>{getDisplayTeamName(team)}</TeamNickname>
            </div>
          </Team>
        ))}
      </TeamsList>

      <ScoreRow>
        {hasStarted ? (
          <ScoreWrap>
            <DetailsButton onClick={handleDetails}>VER DETALHES</DetailsButton>
            <ScoreValue $score={displayScore}>{Number(displayScore).toFixed(2)}</ScoreValue>
          </ScoreWrap>
        ) : (
          <ActionsWrap>
            <EditButton onClick={handleEdit}>EDITAR</EditButton>
            <DeleteButton onClick={handleDelete}>EXCLUIR</DeleteButton>
            <PriceTag>{Number(totalPrice || 0).toFixed(2)} ◈</PriceTag>
          </ActionsWrap>
        )}
      </ScoreRow>

      {showDetailsModal && (
        <DetailsOverlay onClick={closeDetailsModal}>
          <DetailsModal onClick={(e) => e.stopPropagation()}>
            <DetailsHeader>
              <DetailsTitle>Detalhes da Alianca</DetailsTitle>
              <DetailsClose onClick={closeDetailsModal} aria-label="Fechar detalhes">x</DetailsClose>
            </DetailsHeader>

            <DetailsTeamsGrid>
              {allianceDetails.rows.map((team, index) => (
                <DetailsTeamCard key={`${team.teamNumber}-${index}`}>
                  <DetailsTeamLogo style={{ background: getTeamColor(team.teamNumber) }}>
                    {String(team.teamNumber || '').slice(-2)}
                  </DetailsTeamLogo>
                  <DetailsTeamName>{team.nickname}</DetailsTeamName>
                  <DetailsTeamNumber>{`#${team.teamNumber || '---'}`}</DetailsTeamNumber>
                  {team.isCaptain && <CaptainChip>1.5x</CaptainChip>}
                </DetailsTeamCard>
              ))}
            </DetailsTeamsGrid>

            <DetailsScoreGrid>
              {allianceDetails.rows.map((team, index) => {
                const showBoosted = team.isCaptain && team.multiplier > 1;

                return (
                  <DetailsScoreItem key={`score-${team.teamNumber}-${index}`}>
                    <DetailsScoreLabel>Pontuacao</DetailsScoreLabel>
                    <DetailsScoreBase>{Number(team.basePoints || 0).toFixed(2)}</DetailsScoreBase>
                    {showBoosted && (
                      <DetailsScoreBoosted>{Number(team.finalPoints || 0).toFixed(2)}</DetailsScoreBoosted>
                    )}
                  </DetailsScoreItem>
                );
              })}
            </DetailsScoreGrid>

            <DetailsDivider />
            <DetailsTotalLabel>Total</DetailsTotalLabel>
            <DetailsTotalValue>{Number(allianceDetails.total || 0).toFixed(2)}</DetailsTotalValue>
          </DetailsModal>
        </DetailsOverlay>
      )}
    </Card>
  );
};