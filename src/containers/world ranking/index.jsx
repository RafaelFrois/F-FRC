import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import { getMe, getWorldRanking } from "../../services/api";

const FullPage = styled.div`
  background: #f4f6f8;
  min-height: 100vh;
  width: 100%;
  color: #222;
`;

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;

  @media (max-width: 900px) {
    padding: 12px;
  }
`;

const MainGrid = styled.div`
  display: grid;
  grid-template-columns: 260px 1fr 260px;
  gap: 20px;
  align-items: start;

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const Card = styled.div`
  background: #fff;
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
`;

const CardTitle = styled.h2`
  margin: 0 0 12px;
  font-size: 20px;
  letter-spacing: 0.4px;
  text-transform: uppercase;
`;

const SearchInput = styled.input`
  width: 100%;
  margin-bottom: 10px;
  padding: 10px;
  border: 1px solid #d5d9df;
  border-radius: 8px;
`;

const SearchButton = styled.button`
  width: 100%;
  margin-top: 8px;
  background: #ef1c24;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 12px;
  font-weight: 700;
  cursor: pointer;
`;

const RankingTable = styled.div`
  display: grid;
  grid-template-columns: 90px 1fr 160px 120px;
  gap: 10px;
  align-items: center;

  @media (max-width: 760px) {
    grid-template-columns: 56px 1fr;
    row-gap: 8px;
  }
`;

const TableHeader = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: #555;
  text-transform: uppercase;
  padding-bottom: 8px;
  border-bottom: 1px solid #ececec;
`;

const RowCell = styled.div`
  font-size: 15px;
  color: #222;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;

  @media (max-width: 760px) {
    border-bottom: none;
    padding: 2px 0;
  }
`;

const RowPoints = styled(RowCell)`
  font-weight: 700;
`;

const ActionCell = styled(RowCell)`
  display: flex;
  justify-content: flex-end;

  @media (max-width: 760px) {
    grid-column: 2;
    justify-content: flex-end;
    border-bottom: 1px solid #f0f0f0;
    padding-bottom: 10px;
    margin-bottom: 2px;
  }
`;

const ViewProfileButton = styled.button`
  background: #17b838;
  color: #fff;
  border: none;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
`;

const MobileMeta = styled.div`
  display: none;

  @media (max-width: 760px) {
    display: block;
    font-size: 12px;
    color: #666;
    margin-top: 2px;
  }
`;

const SideAvatar = styled.div`
  width: 110px;
  height: 110px;
  border-radius: 50%;
  margin: 0 auto 10px;
  background: #f2bf02;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  background-size: cover;
  background-position: center;
`;

const SideName = styled.div`
  text-align: center;
  font-size: 24px;
  margin: 8px 0 14px;
  font-weight: 700;
`;

const SideLabel = styled.div`
  text-align: center;
  color: #5b5b5b;
  font-size: 14px;
  text-transform: uppercase;
`;

const SideValue = styled.div`
  text-align: center;
  color: #222;
  font-size: 28px;
  font-weight: 700;
  margin: 6px 0 12px;
`;

const EmptyState = styled.div`
  padding: 18px 0;
  text-align: center;
  color: #777;
`;

export default function WorldRankingPage() {
  const navigate = useNavigate();
  const [nameInput, setNameInput] = useState("");
  const [teamNumberInput, setTeamNumberInput] = useState("");
  const [filters, setFilters] = useState({ name: "", teamNumber: "" });
  const [ranking, setRanking] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentUserRankInfo, setCurrentUserRankInfo] = useState({ position: null, totalPointsSeason: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters({ name: nameInput, teamNumber: teamNumberInput });
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [nameInput, teamNumberInput]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const [me, rankingData] = await Promise.all([
          getMe(),
          getWorldRanking({
            name: filters.name,
            teamNumber: filters.teamNumber
          })
        ]);
        if (!mounted) return;

        setCurrentUser(me);
        setRanking(Array.isArray(rankingData?.ranking) ? rankingData.ranking : []);
        setCurrentUserRankInfo({
          position: rankingData?.currentUser?.position || null,
          totalPointsSeason: Number(rankingData?.currentUser?.totalPointsSeason || 0)
        });
      } catch (error) {
        if (mounted) {
          setRanking([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [filters]);

  const initials = useMemo(() => {
    const username = String(currentUser?.username || "").trim();
    if (!username) return "U";
    return username
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }, [currentUser]);

  return (
    <FullPage>
      <AppHeader
        title="FANTASY - FRC"
        titleTo="/dashboard"
        rightText="WORLD RANKING"
        maxWidth={1200}
      />

      <Container>
        <MainGrid>
          <Card>
            <CardTitle>Pesquisar</CardTitle>
            <SearchInput
              placeholder="Nome"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
            />
            <SearchInput
              placeholder="Team Number"
              value={teamNumberInput}
              onChange={(event) => setTeamNumberInput(event.target.value)}
            />
            <SearchButton
              onClick={() => setFilters({ name: nameInput, teamNumber: teamNumberInput })}
            >
              Pesquisar
            </SearchButton>
          </Card>

          <Card>
            <CardTitle>Ranking Mundial</CardTitle>
            <RankingTable>
              <TableHeader>Posição</TableHeader>
              <TableHeader>Nome</TableHeader>
              <TableHeader>Pontuação Total</TableHeader>
              <TableHeader />

              {loading && <EmptyState style={{ gridColumn: "1 / -1" }}>Carregando ranking...</EmptyState>}

              {!loading && ranking.length === 0 && (
                <EmptyState style={{ gridColumn: "1 / -1" }}>Nenhum usuário encontrado para o filtro informado.</EmptyState>
              )}

              {!loading && ranking.map((entry) => (
                <React.Fragment key={entry.id}>
                  <RowCell>{entry.position}</RowCell>
                  <RowCell>
                    {entry.username}
                    <MobileMeta>Team #{entry.frcTeamNumber || "---"}</MobileMeta>
                  </RowCell>
                  <RowPoints>{Number(entry.totalPointsSeason || 0).toFixed(2)}</RowPoints>
                  <ActionCell>
                    <ViewProfileButton onClick={() => navigate(`/ranking/profile/${entry.id}`)}>
                      VER PERFIL
                    </ViewProfileButton>
                  </ActionCell>
                </React.Fragment>
              ))}
            </RankingTable>
          </Card>

          <Card>
            <CardTitle>Seu Perfil</CardTitle>
            <SideAvatar style={currentUser?.profilePhoto ? { backgroundImage: `url(${currentUser.profilePhoto})` } : {}}>
              {!currentUser?.profilePhoto && initials}
            </SideAvatar>
            <SideName>{currentUser?.username || "Usuário"}</SideName>
            <SideLabel>World Ranking Position</SideLabel>
            <SideValue>{currentUserRankInfo?.position || "-"}</SideValue>
            <SideLabel>Pontuação Total</SideLabel>
            <SideValue>{Number(currentUserRankInfo?.totalPointsSeason || 0).toFixed(2)}</SideValue>
          </Card>
        </MainGrid>
      </Container>
    </FullPage>
  );
}
