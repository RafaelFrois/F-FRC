import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  color: #333;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
`;

const Title = styled.h3`
  font-size: 1.2rem;
  color: #666;
  margin-bottom: 15px;
`;

const EmptyList = styled.div`
  margin-bottom: 15px;
`;

const EmptyItem = styled.div`
  padding: 8px 0;
  border-bottom: 1px solid #eee;
  color: #999;
  font-style: italic;

  &:last-child {
    border-bottom: none;
  }
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
  color: #999;
`;

const ChooseButton = styled.button`
  background: #4CAF50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.3s;

  &:hover {
    background: #45a049;
  }
`;