import React from 'react';
import styled from 'styled-components';

const Box = styled.div`
  background:#fff;
  color:#333;
  border-radius:8px;
  padding:14px;
  display:flex;
  flex-direction:column;
  gap:10px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.08);
`;

const Items = styled.div`
  display:flex;
  gap:8px;
`;

const Item = styled.div`
  width:56px;
  height:56px;
  background:#f2f2f2;
  border-radius:8px;
  display:flex;
  align-items:center;
  justify-content:center;
  color:#999;
`;

const ScoreRow = styled.div`
  display:flex;
  justify-content:space-between;
  align-items:center;
`;

const ChooseButton = styled.button`
  background:#c82333;
  color:white;
  border:none;
  padding:8px 12px;
  border-radius:6px;
  cursor:pointer;
`;

export const EmptySelection = ({ onChoose }) => {
  return (
    <Box>
      <h3 style={{margin:0,fontSize:14}}>Não selecionado</h3>
      <Items>
        <Item>VAZIO</Item>
        <Item>VAZIO</Item>
        <Item>VAZIO</Item>
      </Items>
      <ScoreRow>
        <div style={{color:'#777'}}>00.00</div>
        <ChooseButton onClick={onChoose}>ESCOLHER</ChooseButton>
      </ScoreRow>
    </Box>
  );
};