import { Fragment, type ReactNode } from 'react';

/**
 * Tiny markdown renderer (no dependencies) for the plan notes. Supports:
 * "## " headings, paragraphs, **bold**, GitHub pipe tables, and "- " list
 * items. Render the output inside a `.notes-md` container so the table
 * picks up the reference styling.
 */

function renderInline(text: string): ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>,
  );
}

function splitRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((cell) => cell.trim());
}

function isSeparatorRow(line: string): boolean {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      blocks.push(<h3 key={key++}>{renderInline(trimmed.slice(3))}</h3>);
      i++;
      continue;
    }

    // Only "- " marks a list item: the plan notes use leading "*"/"**" as
    // literal footnote markers ("* Upper daily limit…"), which must stay text.
    if (trimmed.startsWith('- ')) {
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const itemLine = lines[i].trim();
        if (!itemLine.startsWith('- ')) break;
        items.push(<li key={items.length}>{renderInline(itemLine.slice(2))}</li>);
        i++;
      }
      blocks.push(
        <ul key={key++} className="m-0 grid list-disc gap-1 pl-5">
          {items}
        </ul>,
      );
      continue;
    }

    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      lines[i + 1].trim().startsWith('|') &&
      isSeparatorRow(lines[i + 1])
    ) {
      const header = splitRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push(
        <table key={key++}>
          <thead>
            <tr>
              {header.map((cell, ci) => (
                <th key={ci} scope="col">
                  {renderInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>{renderInline(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>,
      );
      continue;
    }

    // Paragraph: gather consecutive plain lines.
    const para: string[] = [trimmed];
    i++;
    while (i < lines.length) {
      const next = lines[i].trim();
      if (
        !next ||
        next.startsWith('## ') ||
        next.startsWith('- ') ||
        next.startsWith('|')
      ) {
        break;
      }
      para.push(next);
      i++;
    }
    blocks.push(<p key={key++}>{renderInline(para.join(' '))}</p>);
  }

  return <div className="grid gap-3">{blocks}</div>;
}
