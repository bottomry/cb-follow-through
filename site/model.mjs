export function safeURL(value) { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch { return null; } }
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function sourceHref(source) { const value=safeURL(source?.url); if (!value) return null; if (!Object.hasOwn(source,'page')) return value; if (!Number.isSafeInteger(source.page) || source.page < 1) return null; const url=new URL(value); url.hash=`page=${source.page}`; return url.href; }
const eventTypes=new Set(['request','agency_action','evaluation','implementation']);
const requestStates=new Set(['documented','unknown']);
const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isRecord=value=>value !== null && typeof value === 'object' && !Array.isArray(value);
const hasText=value=>typeof value === 'string' && value.trim().length > 0;
const hasTexts=(value,fields)=>isRecord(value) && fields.every(field=>hasText(value[field]));
const hasSlug=value=>typeof value === 'string' && slug.test(value);
const optionalStrings=(value,fields)=>fields.every(field=>!Object.hasOwn(value,field) || typeof value[field] === 'string');
function validDate(value, precision) {
 const match = typeof value === 'string' && value.match(precision === 'month' ? /^(\d{4})-(\d{2})$/ : precision === 'day' ? /^(\d{4})-(\d{2})-(\d{2})$/ : /$a/);
 if (!match) return false;
 const year=Number(match[1]), month=Number(match[2]);
 if (month < 1 || month > 12) return false;
 if (precision === 'month') return true;
 const leap=year%4===0 && (year%100!==0 || year%400===0);
 const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
 const day=Number(match[3]); return day >= 1 && day <= days[month-1];
}
export function validate(data) {
 if (data?.schema_version !== 1 || !hasText(data.scope) || !validDate(data.reviewed_on,'day') || !Array.isArray(data.cases) || !data.cases.length || !Array.isArray(data.sources) || !data.sources.length) throw Error('Unsupported casefile data.');
 const ids = new Set(); const sources = new Set();
 for (const s of data.sources) {
  if (!hasSlug(s?.id) || sources.has(s.id) || !hasTexts(s,['title','publisher','url','locator','excerpt','review_method']) || !sourceHref(s) || !optionalStrings(s,['upstream','access_note'])) throw Error('Invalid source record.');
  sources.add(s.id);
 }
 for (const c of data.cases) {
  if (!hasSlug(c?.id) || ids.has(c.id) || !hasTexts(c,['title','number','board','agency','corridor','period','subtitle','summary','match','next_action']) || !Array.isArray(c.limits) || !c.limits.length || !c.limits.every(hasText) || !Array.isArray(c.events) || !Array.isArray(c.requests) || !c.requests.length) throw Error('Invalid casefile.');
  ids.add(c.id);
  if (!hasSlug(c.decision?.id) || !hasTexts(c.decision,['title','summary','basis','vote','vote_basis']) || c.decision.date_precision !== 'day' || c.decision.reviewed !== true) throw Error('Invalid decision record.');
  if (!validDate(c.decision.date,c.decision.date_precision)) throw Error('Decision needs a real day-precision date.');
  const eventIds=new Set([c.decision.id]);
  for (const e of c.events) {
   if (!hasSlug(e?.id) || eventIds.has(e.id) || !hasTexts(e,['title','summary','basis'])) throw Error('Invalid event record.');
   eventIds.add(e.id);
   if (!eventTypes.has(e.type) || e.reviewed !== true) throw Error('Invalid event semantics.');
   if (!validDate(e.date,e.date_precision)) throw Error('Event needs a real date matching its declared precision.');
  }
  for (const r of c.requests) {
   if (!hasTexts(r,['text','note'])) throw Error('Invalid request record.');
   if (!requestStates.has(r.state)) throw Error('Invalid request state.');
  }
  for (const row of [c.decision,...c.events,...c.requests]) {
   if (!Array.isArray(row.source_ids) || !row.source_ids.length) throw Error('Evidence record needs source references.');
   if (row.source_ids.some(id => typeof id !== 'string' || !sources.has(id))) throw Error('Unresolved source reference.');
  }
 }
 return data;
}
export const hasReviewedEvent = (c,type) => c.events.some(e => e.type === type && e.reviewed === true && e.source_ids.length);
export const implemented = c => hasReviewedEvent(c,'implementation');
export const timelineEvents = c => [{...c.decision,type:'decision'},...c.events];
export function filterCases(cases, query = '', status = 'all') { const q = query.trim().toLowerCase(); return cases.filter(c => (status === 'all' || implemented(c) === (status === 'documented')) && [c.title,c.board,c.corridor,c.summary,c.agency].join(' ').toLowerCase().includes(q)); }
export function dateLabel(value) { return new Intl.DateTimeFormat('en-US', {month:'short', ...(value.length > 7 ? {day:'numeric'} : {}), year:'numeric', timeZone:'UTC'}).format(new Date(value.length === 7 ? value+'-01T12:00:00Z' : value+'T12:00:00Z')); }
export function corpusMetadata(data) {
 const sourceCount=data.sources.length, caseCount=data.cases.length;
 return {
  reviewDate:dateLabel(data.reviewed_on),
  sourceCount,
  caseCount,
  sourceSummary:`${sourceCount} public document${sourceCount===1?'':'s'} behind ${caseCount} casefile${caseCount===1?'':'s'}.`
 };
}
export function handoff(c, sources, note = '') { const ids = new Set([...c.decision.source_ids,...c.events.flatMap(e => e.source_ids),...c.requests.flatMap(r => r.source_ids)]); return `${c.title} — ${c.board}\n${c.corridor}\nStatus: ${implemented(c) ? 'Implementation documented' : 'Outcome unknown in this corpus'}\n\n${c.summary}\n\n${timelineEvents(c).map(e => `${e.reviewed === true ? '' : 'UNREVIEWED · '}${dateLabel(e.date)} — ${e.title}\n${e.summary}`).join('\n\n')}\n\nLIMITS\n${c.limits.join('\n')}\n\nSOURCES\n${sources.filter(s => ids.has(s.id)).map(s => `${s.title}\n${s.locator}\n${s.url}\n${s.review_method}`).join('\n\n')}\n\nLOCAL DRAFT — UNREVIEWED\n${note || '(No draft)'}\n`; }
