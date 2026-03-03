import React from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";

const HeaderBar = styled.header`
  width: 100%;
  background: linear-gradient(90deg, #0b66c3, #0a5bb0);
  color: #fff;
`;

const HeaderInner = styled.div`
  max-width: ${({ $maxWidth }) => $maxWidth}px;
  margin: 0 auto;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  @media (max-width: 768px) {
    padding: 12px 16px;
    gap: 10px;
    align-items: flex-start;
  }
`;

const LeftGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TitleLink = styled(Link)`
  color: #fff;
  text-decoration: none;
  font-weight: 700;
  font-size: 20px;
  letter-spacing: 0.5px;

  @media (max-width: 768px) {
    font-size: 18px;
  }
`;

const TitleButton = styled.button`
  color: #fff;
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  text-align: left;
  font-weight: 700;
  font-size: 20px;
  letter-spacing: 0.5px;
  cursor: pointer;

  @media (max-width: 768px) {
    font-size: 18px;
  }
`;

const Subtitle = styled.span`
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 600;

  @media (max-width: 768px) {
    font-size: 12px;
  }
`;

const RightText = styled.span`
  color: rgba(255, 255, 255, 0.95);
  font-size: 15px;
  font-weight: 700;
  text-align: right;

  @media (max-width: 768px) {
    font-size: 13px;
  }
`;

const RightLink = styled(Link)`
  color: rgba(255, 255, 255, 0.95);
  text-decoration: none;
  font-size: 15px;
  font-weight: 700;
  text-align: right;

  @media (max-width: 768px) {
    font-size: 13px;
  }
`;

export default function AppHeader({
  title = "FANTASY - FRC",
  subtitle,
  titleTo,
  onTitleClick,
  rightText,
  rightTo,
  maxWidth = 1200
}) {
  const titleNode = titleTo ? (
    <TitleLink to={titleTo}>{title}</TitleLink>
  ) : (
    <TitleButton type="button" onClick={onTitleClick} style={{ cursor: onTitleClick ? "pointer" : "default" }}>
      {title}
    </TitleButton>
  );

  return (
    <HeaderBar>
      <HeaderInner $maxWidth={maxWidth}>
        <LeftGroup>
          {titleNode}
          {subtitle ? <Subtitle>{subtitle}</Subtitle> : null}
        </LeftGroup>
        {rightTo ? <RightLink to={rightTo}>{rightText}</RightLink> : <RightText>{rightText}</RightText>}
      </HeaderInner>
    </HeaderBar>
  );
}