import SourceCard from "./SourceCard";
import MarkdownView from "./MarkdownView";

function MessageBubble({ message }) {
  const isStudent = message.role === "user" || message.role === "student";

  return (
    <div className={`message-row ${isStudent ? "user-row" : "assistant-row"}`}>
      <div className={`message-bubble ${isStudent ? "user-bubble" : "assistant-bubble"}`}>
        <div className="message-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <strong>{isStudent ? "👤 You" : "🤖 Academic AI"}</strong>
          {!isStudent && message.intent && (
            <span className="badge-intent" style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "12px", background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", fontWeight: "500" }}>
              🎯 Intent: {message.intent.toUpperCase()}{message.detected_unit ? ` (${message.detected_unit})` : ""}
            </span>
          )}
        </div>
        <div className="message-text">
          {isStudent ? (
            <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
          ) : (
            <MarkdownView content={message.content} />
          )}
        </div>
        {!isStudent && message.sources && message.sources.length > 0 && (
          <div className="sources-container">
            <div className="sources-title">📚 Verified Course Sources:</div>
            <div className="sources-list" style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
              {message.sources.map((src, sIdx) => (
                <SourceCard key={sIdx} source={src} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;
