import React from 'react';
import styled from 'styled-components';

const Card = styled.div`
  background:#fff;
  color:#333;
  border-radius:8px;
  padding:16px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.08);
  display:flex;
  flex-direction:column;
  gap:8px;
`;

const Label = styled.span`
  font-size:12px;
  color:#777;
`;

const Value = styled.span`
  font-size:20px;
  font-weight:700;
`;

const Divider = styled.div`
  height:1px;
  background:#eee;
  margin:6px 0;
`;

const Help = styled.a`
  display:inline-block;
  margin-top:6px;
  color:#2b7be4;
  text-decoration:none;
`;

export const PatrimonyCard = ({ value, totalScore = "---", onHelp }) => {
  return (
    <Card>
      <div>
        <Label>PATRIMÔNIO</Label>
        <div><Value>{value}</Value></div>
      </div>

      <Divider />

      <div>
        <Label>PONTUAÇÃO TOTAL</Label>
        <div><Value>{totalScore}</Value></div>
      </div>

      <Help as="button" onClick={onHelp} style={{cursor:'pointer', background:'transparent', border:'none', padding:0}}>{'ENTENDA O JOGO'}</Help>
    </Card>
  );
};