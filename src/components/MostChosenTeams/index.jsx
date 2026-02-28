import React from 'react';

export const MostChosenTeams = ({ teams = [] }) => {
  return (
    <div className="most-chosen-card">
      <h3>Mais Escolhidas</h3>
      <ul>
        {teams.map((t, i) => (
          <li key={i}>
            <span className="position">{t.position}</span>
            <span className="team-name">{t.name}</span>
            <span className="votes">{t.votes}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
