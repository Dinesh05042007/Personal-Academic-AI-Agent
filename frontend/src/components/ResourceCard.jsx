function ResourceCard({ resource }) {
  let status = "⚪ Unknown";
  let badgeClass = "badge-unknown";

  if (resource.processing_status === "processing") {
    status = "🟡 Processing...";
    badgeClass = "badge-processing";
  } else if (resource.processing_status === "completed") {
    status = "🟢 Ready for AI";
    badgeClass = "badge-completed";
  } else if (resource.processing_status === "failed") {
    status = "🔴 Failed";
    badgeClass = "badge-failed";
  }

  return (
    <div className="resource-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: "0 0 6px 0", fontSize: "16px" }}>📄 {resource.name}</h3>
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
            {resource.unit ? `${resource.unit} • ` : ""}
            {resource.file_type?.toUpperCase() || "PDF"}
          </p>
        </div>
        <div>
          <span className={`status-badge ${badgeClass}`}>{status}</span>
        </div>
      </div>
      {resource.processing_error && (
        <p style={{ color: "#dc2626", fontSize: "12px", marginTop: "8px" }}>
          Error: {resource.processing_error}
        </p>
      )}
    </div>
  );
}

export default ResourceCard;
