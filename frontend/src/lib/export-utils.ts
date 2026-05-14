/**
 * Export utilities for converting editor content to PDF and Word formats
 */

import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

/**
 * Converts markdown text to plain text (removes markdown syntax)
 */
function markdownToPlainText(markdown: string): string {
  return markdown
    // Remove headers
    .replace(/^#{1,6}\s+(.+)$/gm, "$1")
    // Remove bold/italic
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    // Remove links
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    // Remove blockquotes
    .replace(/^>\s+(.+)$/gm, "$1")
    // Remove horizontal rules
    .replace(/^[-*_]{3,}$/gm, "")
    // Clean up extra whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Parses markdown into docx paragraphs
 */
function markdownToDocxParagraphs(markdown: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = markdown.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i++;
      continue;
    }

    // Headings
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match) {
      paragraphs.push(
        new Paragraph({
          text: h1Match[1],
          heading: HeadingLevel.HEADING_1,
        })
      );
      i++;
      continue;
    }

    const h2Match = line.match(/^##\s+(.+)$/);
    if (h2Match) {
      paragraphs.push(
        new Paragraph({
          text: h2Match[1],
          heading: HeadingLevel.HEADING_2,
        })
      );
      i++;
      continue;
    }

    const h3Match = line.match(/^###\s+(.+)$/);
    if (h3Match) {
      paragraphs.push(
        new Paragraph({
          text: h3Match[1],
          heading: HeadingLevel.HEADING_3,
        })
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const text = line.substring(1).trim();
      paragraphs.push(
        new Paragraph({
          text: text,
          spacing: { after: 200 },
        })
      );
      i++;
      continue;
    }

    // Lists
    if (line.match(/^[\-\*]\s+/)) {
      const items: Paragraph[] = [];
      while (i < lines.length && lines[i].trim().match(/^[\-\*]\s+/)) {
        const itemText = lines[i].trim().replace(/^[\-\*]\s+/, "");
        items.push(
          new Paragraph({
            text: itemText,
            bullet: { level: 0 },
          })
        );
        i++;
      }
      paragraphs.push(...items);
      continue;
    }

    // Ordered lists - simplified to use regular paragraphs with numbers
    if (line.match(/^\d+\.\s+/)) {
      const items: Paragraph[] = [];
      while (i < lines.length && lines[i].trim().match(/^\d+\.\s+/)) {
        const itemText = lines[i].trim().replace(/^\d+\.\s+/, "");
        items.push(
          new Paragraph({
            text: itemText,
            spacing: { after: 100 },
          })
        );
        i++;
      }
      paragraphs.push(...items);
      continue;
    }

    // Regular paragraph
    // Parse inline formatting (bold, italic, links)
    const runs: TextRun[] = [];
    let text = line;
    
    // Handle bold
    text = text.replace(/\*\*(.+?)\*\*/g, (match, content) => {
      runs.push(new TextRun({ text: content, bold: true }));
      return "";
    });
    
    // Handle italic
    text = text.replace(/\*(.+?)\*/g, (match, content) => {
      runs.push(new TextRun({ text: content, italics: true }));
      return "";
    });

    // Add remaining text
    if (text) {
      runs.push(new TextRun(text));
    }

    paragraphs.push(
      new Paragraph({
        children: runs.length > 0 ? runs : [new TextRun(line)],
        spacing: { after: 200 },
      })
    );
    i++;
  }

  return paragraphs;
}

/**
 * Exports markdown content to PDF
 */
export async function exportToPDF(markdown: string, filename: string): Promise<void> {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    let yPosition = margin;
    const lineHeight = 7;

    // Convert markdown to plain text for PDF
    const plainText = markdownToPlainText(markdown);
    const lines = doc.splitTextToSize(plainText, maxWidth);

    lines.forEach((line: string) => {
      // Check if we need a new page
      if (yPosition > pageHeight - margin - lineHeight) {
        doc.addPage();
        yPosition = margin;
      }

      // Detect headers and format accordingly
      if (line.match(/^[A-Z][^.!?]*$/)) {
        // Might be a header
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
      } else {
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
      }

      doc.text(line, margin, yPosition);
      yPosition += lineHeight;
    });

    // Save the PDF
    doc.save(`${filename}.pdf`);
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    throw new Error("Failed to export to PDF");
  }
}

/**
 * Exports markdown content to Word document (.docx)
 */
export async function exportToWord(markdown: string, filename: string): Promise<void> {
  try {
    const paragraphs = markdownToDocxParagraphs(markdown);

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting to Word:", error);
    throw new Error("Failed to export to Word");
  }
}

/**
 * Exports markdown content to Markdown file
 */
export function exportToMarkdown(markdown: string, filename: string): void {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports HTML content to HTML file
 */
export function exportToHTML(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Extracts filename from markdown content (first heading or generates default)
 */
export function extractFilename(markdown: string): string {
  const firstLine = markdown.split("\n")[0];
  if (firstLine.startsWith("#")) {
    const filename = firstLine
      .replace(/^#+\s*/, "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .substring(0, 50);
    return filename || `article-${Date.now()}`;
  }
  return `article-${Date.now()}`;
}

