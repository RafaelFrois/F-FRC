import React from 'react';
import styled from 'styled-components';
import AppHeader from '../../components/AppHeader';

const FullPage = styled.div`
  background: #ffffff;
  min-height: 100vh;
  width: 100%;
  color: #222;
`;


const Container = styled.div`
  max-width: 1100px;
  margin: 24px auto;
  padding: 0 24px 40px;

  @media (max-width: 768px) {
    margin: 16px auto;
    padding: 0 12px 24px;
  }
`;

const Panel = styled.article`
  background:#fff;
  border-radius:10px;
  padding:28px 32px;
  color:#222;
  box-shadow: 0 8px 30px rgba(0,0,0,0.06);

  @media (max-width: 768px) {
    padding: 18px 14px;
  }
`;

const PageTitle = styled.h1`
  margin:0 0 12px 0;
  font-size:26px;
  color:#6f7a0b;
`;

const SectionTitle = styled.h2`
  font-size:18px;
  margin-top:20px;
  margin-bottom:8px;
  color:#1b4f8a;
`;

const SubTitle = styled.h3`
  font-size:16px;
  margin-top:16px;
  margin-bottom:8px;
  color:#235a9a;
`;

const Paragraph = styled.p`
  line-height:1.6;
  color:#333;
  margin:8px 0;
`;

const List = styled.ul`
  margin:8px 0 12px 18px;
  color:#333;
`;

export default function HelpPage(){
  return (
    <FullPage>
      <AppHeader
        title="FANTASY - FRC"
        titleTo="/dashboard"
        rightText="Voltar"
        rightTo="/dashboard"
        maxWidth={1200}
      />

      <Container>
        <Panel>
          <PageTitle>Entenda o Jogo – Fantasy FRC</PageTitle>

          <SectionTitle>O que é o Fantasy FRC?</SectionTitle>
          <Paragraph>
            O Fantasy FRC é um jogo estratégico inspirado nos tradicionais fantasy sports, mas totalmente adaptado ao universo da FIRST Robotics Competition.
          </Paragraph>

          <Paragraph>
            Aqui, você não controla um robô. Você controla decisões.
          </Paragraph>

          <Paragraph>
            A cada Week da temporada, você monta sua própria aliança virtual escolhendo equipes reais da FRC. O desempenho dessas equipes nos eventos oficiais se transforma diretamente em pontos dentro do jogo.
          </Paragraph>

          <Paragraph>
            Você deixa de ser apenas espectador e passa a atuar como manager estratégico:
          </Paragraph>
          <List>
            <li>Analisa estatísticas</li>
            <li>Estuda tendências</li>
            <li>Escolhe capitão</li>
            <li>Administra patrimônio</li>
            <li>Compete no ranking mundial</li>
          </List>

          <SectionTitle>Como Funciona</SectionTitle>
          <SubTitle>Seleção por Weeks e Regionais</SubTitle>
          <Paragraph>
            O jogo acompanha o calendário oficial da FRC. A cada Week, a Seleção de Alianças é aberta às 00:00 do primeiro dia competitivo. Você pode escolher até quatro regionais por Week. Em cada regional, monta uma aliança com 3 equipes reais. Quando o evento começa (00:00 do dia inicial do regional), o mercado daquele regional é travado. Nada mais pode ser alterado.
          </Paragraph>

          <Paragraph>Isso exige planejamento. Quem estuda antes, sai na frente.</Paragraph>

          <SubTitle>Minha Aliança</SubTitle>
          <Paragraph>
            Sua aliança é o coração da sua estratégia. Em cada regional: Você escolhe 3 equipes, Define 1 Capitão, Confirma e salva a escalação.
          </Paragraph>

          <SubTitle>Capitão (1.5x)</SubTitle>
          <Paragraph>
            O Capitão recebe multiplicador de 1.5x na pontuação final. Se ele performa bem → você dispara no ranking. Se ele vai mal → o prejuízo também é multiplicado. Isso cria risco real. E risco bem calculado gera vantagem competitiva.
          </Paragraph>

          <SubTitle>Sistema de Pontuação</SubTitle>
          <Paragraph>
            A pontuação é baseada em métricas reais dos eventos:
          </Paragraph>
          <Paragraph><strong>Pontos Positivos</strong>: Auto EPA, Teleop EPA, Endgame EPA, Vitórias e Empates, Melhor desempenho do evento (bônus)</Paragraph>
          <Paragraph><strong>Pontos Negativos</strong>: Derrotas, Penalidades, Yellow Card, Red Card</Paragraph>

          <SubTitle>Patrimônio: o Motor do Jogo</SubTitle>
          <Paragraph>
            O patrimônio é seu orçamento. Ele determina quais equipes você pode escalar. E ele muda toda semana.
          </Paragraph>

          <Paragraph>
            Após cada Week: Variação = Pontuação Total × base_rate × MarketMultiplier. Se sua aliança pontua bem → seu patrimônio cresce. Se pontua mal → você perde poder de escalação. (Em Desenvolvimento)
          </Paragraph>

          <SubTitle>Mercado Inteligente (Risk & Reward)</SubTitle>
          <Paragraph>
            O sistema aplica um multiplicador baseado no valor de mercado da equipe. Equipes baratas: se performam bem → valorização maior. Equipes caras: se vão mal → prejuízo pesado. Isso cria um mercado vivo. (Em Desenvolvimento)
          </Paragraph>

          <SubTitle>Longo Prazo: Efeito Bola de Neve</SubTitle>
          <Paragraph>
            Boas decisões no início geram mais patrimônio, mais liberdade e mais potencial de pontuação. Más decisões reduzem orçamento e limitam opções. (Em Desenvolvimento)
          </Paragraph>

          <SubTitle>O Objetivo Final</SubTitle>
          <Paragraph>
            Subir no Ranking Mundial. Construir patrimônio forte. Fazer leituras melhores que os outros jogadores. Dominar as Weeks.
          </Paragraph>

          <Paragraph>
            Você não está só acompanhando a FRC. Você está competindo dentro dela — de outra forma. Se quiser, posso deixar o texto mais institucional (formal), mais agressivo competitivo ou mais explicativo didático. (Em Desenvolvimento)
          </Paragraph>

        </Panel>
      </Container>
    </FullPage>
  );
}
