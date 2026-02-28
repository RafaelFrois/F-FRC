function TeamCard({ team }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      marginBottom: "10px"
    }}>
      <span>
        {team.nickname} #{team.team_number}
      </span>

      <span>
        {team.price} ◈
      </span>
    </div>
  );
}

export default TeamCard;