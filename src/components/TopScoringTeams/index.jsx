import React from 'react';

export const TopScoringTeams = ({ teams = [] }) => {
  return (
    <div className="top-scoring-card">
      <h3>Top Pontuação</h3>
      <ul>
        {teams.map((t, i) => (
          <li key={i}>{t.name}</li>
        ))}
      </ul>
    </div>
  );
};
