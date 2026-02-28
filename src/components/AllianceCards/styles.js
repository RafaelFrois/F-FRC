import React from 'react';
import styled from 'styled-components';

const Card = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  color: #333;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  border: ${props => props.$selected ? '3px solid #4CAF50' : 'none'};
`;

const Header = styled.div`
  margin-bottom: 15px;
`;

const Title = styled.h3`
  font-size: 1.2rem;
  color: #666;
  margin-bottom: 5px;
`;

const RegionText = styled.p`
  font-size: 1rem;
  color: #999;
`;

const TeamsList = styled.div`
  margin-bottom: 15px;
`;

const TeamItem = styled.div`
  padding: 8px 0;
  border-bottom: 1px solid #eee;
  
  &:last-child {
    border-bottom: none;
  }
`;

const TeamNumber = styled.span`
  font-size: 1.2rem;
  font-weight: bold;
  color: #333;
`;

const ScoreContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 2px solid #eee;
`;

const ScoreValue = styled.span`
  font-size: 1.5rem;
  font-weight: bold;
  color: #4CAF50;
`;

const ScoreLabel = styled.span`
  font-size: 0.9rem;
  color: #999;
`;
