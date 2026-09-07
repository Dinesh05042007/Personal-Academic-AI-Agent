import React from "react";

function renderInline(text) {
  if (!text) return null;
  const parts = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(<strong key={lastIndex}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(<code key={lastIndex} className="inline-code">{token.slice(1, -1)}</code>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

export function MarkdownView({ content }) {
  if (!content) return null;

  const blocks = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="markdown-view">
      {blocks.map((block, bIdx) => {
        if (block.startsWith("```") && block.endsWith("```")) {
          const lines = block.slice(3, -3).split("\n");
          const firstLine = lines[0].trim();
          const codeBody = lines.slice(1).join("\n").trim() || lines.join("\n").trim();
          return (
            <pre key={bIdx} className="code-block">
              {firstLine && !firstLine.includes(" ") && <div className="code-lang">{firstLine}</div>}
              <code>{codeBody}</code>
            </pre>
          );
        }

        const lines = block.split("\n");
        const renderedElements = [];
        let currentList = null;

        lines.forEach((line, lIdx) => {
          const trimmed = line.trim();

          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            const itemText = trimmed.slice(2);
            if (!currentList || currentList.type !== "ul") {
              currentList = { type: "ul", items: [] };
              renderedElements.push(currentList);
            }
            currentList.items.push(itemText);
            return;
          }

          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (numMatch) {
            const itemText = numMatch[2];
            if (!currentList || currentList.type !== "ol") {
              currentList = { type: "ol", items: [] };
              renderedElements.push(currentList);
            }
            currentList.items.push(itemText);
            return;
          }

          currentList = null;

          if (!trimmed) {
            return;
          }

          if (trimmed.startsWith("### ")) {
            renderedElements.push(<h4 key={`h-${lIdx}`} className="md-h4">{renderInline(trimmed.slice(4))}</h4>);
          } else if (trimmed.startsWith("## ")) {
            renderedElements.push(<h3 key={`h-${lIdx}`} className="md-h3">{renderInline(trimmed.slice(3))}</h3>);
          } else if (trimmed.startsWith("# ")) {
            renderedElements.push(<h2 key={`h-${lIdx}`} className="md-h2">{renderInline(trimmed.slice(2))}</h2>);
          } else {
            renderedElements.push(<p key={`p-${lIdx}`} className="md-p">{renderInline(trimmed)}</p>);
          }
        });

        return (
          <React.Fragment key={bIdx}>
            {renderedElements.map((el, eIdx) => {
              if (el.type === "ul") {
                return (
                  <ul key={`ul-${eIdx}`} className="md-ul">
                    {el.items.map((item, iIdx) => (
                      <li key={iIdx}>{renderInline(item)}</li>
                    ))}
                  </ul>
                );
              }
              if (el.type === "ol") {
                return (
                  <ol key={`ol-${eIdx}`} className="md-ol">
                    {el.items.map((item, iIdx) => (
                      <li key={iIdx}>{renderInline(item)}</li>
                    ))}
                  </ol>
                );
              }
              return el;
            })}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default MarkdownView;
