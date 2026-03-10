import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "../../components/AppHeader";
import { getPublicProfile } from "../../services/api";

const FullPage = styled.div`
  background: #ffffff;
  min-height: 100vh;
  width: 100%;
  color: #222;
`;

const Container = styled.div`
  max-width: 900px;
  margin: 24px auto;
  padding: 0 24px 40px;

  @media (max-width: 768px) {
    margin: 16px auto;
    padding: 0 12px 24px;
  }
`;

const Card = styled.div`
  background: #fff;
  padding: 28px;
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Avatar = styled.div`
  width: 120px;
  height: 120px;
  border-radius: 50%;
  margin: 0 auto 12px auto;
  background: #ffd966;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #fff;
  background-size: cover;
  background-position: center;
`;

const Name = styled.h2`
  margin: 6px 0 8px 0;
  font-size: 20px;
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  margin: 8px 0;

  @media (max-width: 640px) {
    flex-direction: column;
    gap: 10px;
  }
`;

const Col = styled.div`
  flex: 1;
  text-align: center;
`;

const Label = styled.div`
  color: #777;
  font-size: 12px;
`;

const Value = styled.div`
  font-weight: 700;
  margin-top: 6px;
`;

const BackButton = styled.button`
  background: #0b66c3;
  color: #fff;
  border: none;
  padding: 12px 24px;
  border-radius: 18px;
  cursor: pointer;
  font-weight: 700;
  margin-top: 18px;
`;

export default function PublicProfile() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const data = await getPublicProfile(userId);
        if (!mounted) return;

        setProfile(data?.user || null);
      } catch {
        if (mounted) {
          setProfile(null);
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
  }, [userId]);

  const initials = useMemo(() => {
    const username = String(profile?.username || "").trim();
    if (!username) return "U";

    return username
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }, [profile]);

  return (
    <FullPage>
      <AppHeader
        title="FANTASY - FRC"
        titleTo="/dashboard"
        rightText="PERFIL DO JOGADOR"
        maxWidth={1200}
      />

      <Container>
        <Card>
          {loading && <p>Carregando perfil...</p>}

          {!loading && !profile && <p>Não foi possível carregar este perfil.</p>}

          {!loading && profile && (
            <>
              <Avatar style={profile?.profilePhoto ? { backgroundImage: `url(${profile.profilePhoto})` } : {}}>
                {!profile?.profilePhoto && initials}
              </Avatar>

              <Name>{profile?.username || "Usuário"}</Name>

              <Row>
                <Col>
                  <Label>PATRIMÔNIO</Label>
                  <Value>{Number(profile?.patrimonio || 0).toFixed(2)} ◈</Value>
                </Col>
                <Col>
                  <Label>PONTUAÇÃO TOTAL</Label>
                  <Value>{Number(profile?.totalPointsSeason || 0).toFixed(2)}</Value>
                </Col>
              </Row>

              <Row>
                <Col>
                  <Label>{`PONTUAÇÃO WEEK ${Number(profile?.currentWeek || 1)}`}</Label>
                  <Value>{Number(profile?.currentWeekPoints || 0).toFixed(2)}</Value>
                </Col>
                <Col>
                  <Label>WEEK ATUAL</Label>
                  <Value>{Number(profile?.currentWeek || 1)}</Value>
                </Col>
              </Row>

              <Row>
                <Col>
                  <Label>ANO ROOKIE</Label>
                  <Value>{profile?.rookieYear ?? "---"}</Value>
                </Col>
                <Col>
                  <Label>TEAM NUMBER</Label>
                  <Value>#{profile?.frcTeamNumber ?? "---"}</Value>
                </Col>
              </Row>

              <BackButton onClick={() => navigate("/ranking")}>VOLTAR AO RANKING</BackButton>
            </>
          )}
        </Card>
      </Container>
    </FullPage>
  );
}
