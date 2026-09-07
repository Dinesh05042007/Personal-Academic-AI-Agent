function SourceCard({ source }) {
  const name = source.resource_name || source.name || "Course Notes";
  const page = source.page_number || source.page;
  const unit = source.unit;

  return (
    <div className="source-card">
      <span className="source-icon">📄</span>
      <div className="source-info">
        <strong>{name}</strong>
        <div className="source-meta">
          {unit && <span>{unit}</span>}
          {page && <span> • Page {page}</span>}
        </div>
      </div>
    </div>
  );
}

export default SourceCard;
