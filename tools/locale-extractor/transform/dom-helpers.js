// Tiny string-based DOM builders matching DA's real authored-table shape:
// a block is `<div class="name variant"><row><cell>...</cell></row></div>`,
// confirmed against real pages and Library docs under
// artifacts/mcp-snapshots/da/. String-based, not a real DOM, because this
// tool runs in plain Node (no jsdom), and the output only ever needs to be
// written to a file, not manipulated further.
export const cell = (...html) => `<div>${html.join('')}</div>`;

export const row = (...cells) => `<div>${cells.join('')}</div>`;

export const block = (className, ...rows) => `<div class="${className}">${rows.join('')}</div>`;
