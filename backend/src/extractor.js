const fs = require("fs");
const { PDFParse } = require("pdf-parse");

/**
 * Clean extracted text:
 * - Normalize multiple blank lines into standard paragraph breaks
 * - Strip out non-printable ASCII noise while preserving punctuation & casing
 * - Preserve section headings and page tags
 */
function cleanText(text) {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extract pages/sections from a file or buffer
 * Returns array of { pageNumber: number, text: string }
 */
async function extractDocument(filePathOrBuffer, mimeOrExt = "text/plain") {
  const pages = [];

  if (mimeOrExt === "application/pdf" || (typeof filePathOrBuffer === "string" && filePathOrBuffer.endsWith(".pdf"))) {
    const dataBuffer = Buffer.isBuffer(filePathOrBuffer)
      ? filePathOrBuffer
      : fs.readFileSync(filePathOrBuffer);

    const parser = new PDFParse({ data: dataBuffer });
    await parser.load();
    const parsed = await parser.getText();

    if (parsed.pages && parsed.pages.length > 0) {
      for (let i = 0; i < parsed.pages.length; i++) {
        const pageText = cleanText(parsed.pages[i].text);
        if (pageText.length > 0) {
          pages.push({
            pageNumber: i + 1,
            totalPdfPages: parsed.pages.length,
            text: pageText
          });
        }
      }
    } else {
      pages.push({
        pageNumber: 1,
        totalPdfPages: 1,
        text: cleanText(parsed.text || "")
      });
    }
  } else {
    // Text / Markdown format
    let content = "";
    if (Buffer.isBuffer(filePathOrBuffer)) {
      content = filePathOrBuffer.toString("utf-8");
    } else if (typeof filePathOrBuffer === "string") {
      if (filePathOrBuffer.length < 500 && fs.existsSync(filePathOrBuffer)) {
        content = fs.readFileSync(filePathOrBuffer, "utf-8");
      } else {
        content = filePathOrBuffer;
      }
    }

    // Check if text has PAGE markers like "--- PAGE 1: ..."
    const pageSplitRegex = /---\s*PAGE\s*(\d+)[:\s-]*([^\n]*)/gi;
    const rawPages = content.split(/---\s*PAGE\s*\d+[:\s-]*/i);

    if (rawPages.length > 1) {
      let match;
      let pageNum = 1;
      // Start after index 0 (which is header metadata before PAGE 1)
      const headerMeta = cleanText(rawPages[0]);
      for (let i = 1; i < rawPages.length; i++) {
        const pageContent = cleanText(rawPages[i]);
        pages.push({
          pageNumber: i,
          text: pageContent,
          contextHeader: headerMeta
        });
      }
    } else {
      pages.push({
        pageNumber: 1,
        text: cleanText(content)
      });
    }
  }

  return pages;
}

module.exports = {
  cleanText,
  extractDocument
};
