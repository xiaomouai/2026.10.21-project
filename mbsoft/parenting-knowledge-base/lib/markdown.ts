// 简易 markdown -> HTML 转换（避免额外依赖）
// 支持：# ## ### 标题、段落、**加粗**、- 列表、> 引用、|表格|、```代码块、水平线

export function mdToHtml(md: string): string {
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  let inTable = false;
  let tableRows: string[] = [];

  function flushList() {
    if (inList) { html += "</ul>"; inList = false; }
  }
  function flushTable() {
    if (inTable) {
      html += renderTable(tableRows);
      tableRows = [];
      inTable = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // 代码块
    if (line.trim().startsWith("```")) {
      flushList(); flushTable();
      html += "<pre><code>";
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        html += escapeHtml(lines[i]) + "\n";
        i++;
      }
      html += "</code></pre>";
      continue;
    }

    // 表格行
    if (line.trim().startsWith("|") && i + 1 < lines.length && lines[i + 1].includes("|---")) {
      flushList();
      inTable = true;
      tableRows = [line];
      i++; // 跳过分隔行
      continue;
    }
    if (inTable && line.trim().startsWith("|")) {
      tableRows.push(line);
      continue;
    }
    flushTable();

    // 标题
    if (line.startsWith("### ")) { flushList(); html += `<h3>${inline(line.slice(4))}</h3>`; continue; }
    if (line.startsWith("## ")) { flushList(); html += `<h2>${inline(line.slice(3))}</h2>`; continue; }
    if (line.startsWith("# ")) { flushList(); html += `<h1>${inline(line.slice(2))}</h1>`; continue; }

    // 引用
    if (line.startsWith("> ")) { flushList(); html += `<blockquote>${inline(line.slice(2))}</blockquote>`; continue; }

    // 水平线
    if (line.trim() === "---") { flushList(); html += "<hr/>"; continue; }

    // 列表
    if (line.match(/^[-*]\s/)) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${inline(line.replace(/^[-*]\s/, ""))}</li>`;
      continue;
    }

    // 空行
    if (line.trim() === "") { flushList(); continue; }

    // 段落
    flushList();
    html += `<p>${inline(line)}</p>`;
  }
  flushList();
  flushTable();
  return html;
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderTable(rows: string[]): string {
  const cells = rows.map((r) =>
    r.trim().slice(1, -1).split("|").map((c) => c.trim())
  );
  let out = '<table><thead><tr>';
  cells[0].forEach((c) => (out += `<th>${inline(c)}</th>`));
  out += "</tr></thead><tbody>";
  for (let i = 1; i < cells.length; i++) {
    out += "<tr>";
    cells[i].forEach((c) => (out += `<td>${inline(c)}</td>`));
    out += "</tr>";
  }
  out += "</tbody></table>";
  return out;
}
