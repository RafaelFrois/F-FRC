import React from 'react';
import styled from 'styled-components';

const Container = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  color: #333;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Label = styled.span`
  font-size: 0.9rem;
  color: #666;
`;

const Value = styled.span`
  font-size: 2rem;
  font-weight: bold;
  color: #4CAF50;
`;

const Divider = styled.div`
  height: 2px;
  background: #eee;
  margin: 10px 0;
`;

const TotalScore = styled.span`
  font-size: 1.5rem;
  font-weight: bold;
  color: #333;
`;

const HelpLink = styled.a`
  color: #667eea;
  text-decoration: none;
  font-size: 0.9rem;
  margin-top: 10px;
  display: inline-block;

  &:hover {
    text-decoration: underline;
  }
`;
