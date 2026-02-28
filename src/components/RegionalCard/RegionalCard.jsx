function RegionalCard({ regional, onSelect }) {
  const isLocked = new Date() >= new Date(regional.start_date);

  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      marginBottom: "10px"
    }}>
      <span>
        {regional.name} - Week {regional.week}
      </span>

      {isLocked ? (
        <span className="lock">🔒</span>
      ) : (
        <button
          className="button-green"
          onClick={() => onSelect(regional)}
        >
          Selecionar
        </button>
      )}
    </div>
  );
}

export default RegionalCard;