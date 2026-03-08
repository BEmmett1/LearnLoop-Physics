type Props = {
  id: string;
  name: string;
  order: number;
  unlocked: boolean;
  progressPct: number; // 0..100
  prereqIds: string[];
};

export function TopicCard({ id, name, order, unlocked, progressPct, prereqIds }: Props) {
  const statusText = unlocked ? "Unlocked" : "Locked";
  const statusColor = unlocked ? "#0a7" : "#888";

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 14,
        display: "grid",
        gap: 10
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "#666" }}>Topic {order}</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{name}</div>
          <div style={{ fontSize: 12, color: statusColor, marginTop: 4 }}>{statusText}</div>
        </div>

        <div style={{ textAlign: "right", minWidth: 90 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Progress</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{Math.round(progressPct)}%</div>
        </div>
      </div>

      <div style={{ background: "#eee", height: 10, borderRadius: 999 }}>
        <div
          style={{
            width: `${Math.min(100, Math.max(0, progressPct))}%`,
            height: 10,
            borderRadius: 999,
            background: unlocked ? "#222" : "#aaa"
          }}
        />
      </div>

      {!unlocked && prereqIds.length > 0 && (
        <div style={{ fontSize: 12, color: "#666" }}>
          Prereqs: {prereqIds.join(", ")}
        </div>
      )}

      {unlocked && (
        <a
          href={`/learn/${id}`}
          style={{
            display: "inline-block",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            textDecoration: "none",
            color: "#111",
            width: "fit-content"
          }}
        >
          Start or continue
        </a>
      )}
    </div>
  );
}
