export function safeURL(value) { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch { return null; } }
export function validate(data) {
 if (data?.schema_version !== 1 || !Array.isArray(data.cases) || !Array.isArray(data.sources)) throw Error('Unsupported casefile data.');
 const ids = new Set(); const sources = new Set();
 for (const s of data.sources) { if (!s.id || sources.has(s.id) || !safeURL(s.url) || !s.title || !s.locator) throw Error('Invalid source record.'); sources.add(s.id); }
 for (const c of data.cases) {
  if (!c.id || ids.has(c.id) || !c.title || !c.decision || !Array.isArray(c.events) || !Array.isArray(c.requests)) throw Error('Invalid casefile.'); ids.add(c.id);
  for (const row of [c.decision, ...c.events, ...c.requests]) if (!Array.isArray(row.source_ids) || row.source_ids.some(id => !sources.has(id))) throw Error('Unresolved source reference.');
  for (const e of c.events) if (!e.source_ids.length || !/^\d{4}-\d{2}(-\d{2})?$/.test(e.date)) throw Error('Event needs dated evidence.');
 }
 return data;
}
export const implemented = c => c.events.some(e => e.type === 'implementation' && e.reviewed === true && e.source_ids.length);
export function filterCases(cases, query = '', status = 'all') { const q = query.trim().toLowerCase(); return cases.filter(c => (status === 'all' || implemented(c) === (status === 'documented')) && [c.title,c.board,c.corridor,c.summary,c.agency].join(' ').toLowerCase().includes(q)); }
export function dateLabel(value) { return new Intl.DateTimeFormat('en-US', {month:'short', ...(value.length > 7 ? {day:'numeric'} : {}), year:'numeric', timeZone:'UTC'}).format(new Date(value.length === 7 ? value+'-01T12:00:00Z' : value+'T12:00:00Z')); }
export function handoff(c, sources, note = '') { const ids = new Set([...c.decision.source_ids,...c.events.flatMap(e => e.source_ids),...c.requests.flatMap(r => r.source_ids)]); return `${c.title} — ${c.board}\n${c.corridor}\nStatus: ${implemented(c) ? 'Implementation documented' : 'Outcome unknown in this corpus'}\n\n${c.summary}\n\n${c.events.map(e => `${dateLabel(e.date)} — ${e.title}\n${e.summary}`).join('\n\n')}\n\nLIMITS\n${c.limits.join('\n')}\n\nSOURCES\n${sources.filter(s => ids.has(s.id)).map(s => `${s.title}\n${s.locator}\n${s.url}\n${s.review_method}`).join('\n\n')}\n\nLOCAL DRAFT — UNREVIEWED\n${note || '(No draft)'}\n`; }
