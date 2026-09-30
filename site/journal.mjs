export function safeURL(value) {
 try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; }
 catch { return null; }
}
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function sourceHref(source) {
 const value = safeURL(source?.url);
 if (!value) return null;
 if (!Object.hasOwn(source,'page')) return value;
 if (!Number.isSafeInteger(source.page) || source.page < 1) return null;
 const url = new URL(value); url.hash = 'page=' + source.page; return url.href;
}

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const evidenceTypes = new Set(['decision','request','action','assessment','outcome']);
const states = new Set(['documented','unknown']);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hasText = value => typeof value === 'string' && value.trim().length > 0;
const fields = (value,names) => isRecord(value) && names.every(name => hasText(value[name]));
const hasSlug = value => typeof value === 'string' && slug.test(value);
function validDate(value,precision='day') {
 const match = typeof value === 'string' && value.match(precision === 'month' ? /^(\d{4})-(\d{2})$/ : precision === 'day' ? /^(\d{4})-(\d{2})-(\d{2})$/ : /$a/);
 if (!match) return false;
 const year=+match[1], month=+match[2]; if(year<1 || month<1 || month>12)return false;
 if(precision==='month')return true;
 const leap=year%4===0 && (year%100!==0 || year%400===0);
 return +match[3]>=1 && +match[3]<=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
}
const sourceRefs = (ids,sources) => Array.isArray(ids) && ids.length>0 && ids.every(id=>hasSlug(id)&&sources.has(id));
function validEvidence(value,sources) {
 return hasSlug(value?.id) && fields(value,['title','summary','basis']) &&
 evidenceTypes.has(value.type) && value.reviewed===true &&
 (value.date_precision==='day'||value.date_precision==='month') &&
 validDate(value.date,value.date_precision) && sourceRefs(value.source_ids,sources) &&
 (value.type!=='decision' || fields(value,['result','result_basis']));
}
function validSource(value) {
 return hasSlug(value?.id) && fields(value,['title','publisher','url','locator','excerpt','review_method']) &&
  !!sourceHref(value) && (!Object.hasOwn(value,'checked_on')||validDate(value.checked_on)) &&
  ['upstream','access_note'].every(k=>!Object.hasOwn(value,k)||typeof value[k]==='string');
}
const caseFields=['title','number','decision_maker','implementer','subject','period','domain','subtitle','summary','match','next_action'];
const mutableFields=new Set([...caseFields,'place','limits']);
function validCase(value) {
 return hasSlug(value?.id) && fields(value,caseFields) &&
 (!Object.hasOwn(value,'place') || typeof value.place==='string') &&
 Array.isArray(value.limits) && value.limits.length>0 && value.limits.every(hasText);
}

// Entries are the authority. Casefiles are disposable projections at a journal sequence.
// A correction replaces only the projected value; it never edits or removes an earlier entry.
function fold(journal,through=Infinity) {
 if(journal?.schema_version!==2 || !Array.isArray(journal.entries) || !journal.entries.length)throw Error('Unsupported evidence journal.');
 const cases=new Map(),sources=new Map(),evidenceIds=new Map(),requirementIds=new Map();
 let scope='',collectionLabel='',reviewedOn='',lastRecorded='';
 for(let index=0;index<journal.entries.length;index++) {
  const entry=journal.entries[index];
  if(!isRecord(entry) || entry.seq!==index+1 || !validDate(entry.recorded_on) ||
     entry.recorded_on<lastRecorded || !hasText(entry.kind))throw Error('Invalid journal entry or sequence.');
  lastRecorded=entry.recorded_on;
  if(entry.seq>through)continue;
  const payload=entry.payload;
  if(entry.kind==='collection_opened') {
   if(scope || !fields(payload,['scope','collection_label','reviewed_on']) ||
      !validDate(payload.reviewed_on) || payload.reviewed_on>entry.recorded_on)throw Error('Invalid collection entry.');
   scope=payload.scope;collectionLabel=payload.collection_label;reviewedOn=payload.reviewed_on;
  } else if(entry.kind==='collection_updated') {
   if(!scope || !fields(payload,['reason']) || !isRecord(payload.changes) || !Object.keys(payload.changes).length ||
      Object.keys(payload.changes).some(k=>!['scope','collection_label','reviewed_on'].includes(k)) ||
      ('scope' in payload.changes && !hasText(payload.changes.scope)) ||
      ('collection_label' in payload.changes && !hasText(payload.changes.collection_label)) ||
      ('reviewed_on' in payload.changes && (!validDate(payload.changes.reviewed_on) ||
       payload.changes.reviewed_on<reviewedOn || payload.changes.reviewed_on>entry.recorded_on)))
    throw Error('Invalid collection update.');
   scope=payload.changes.scope??scope;collectionLabel=payload.changes.collection_label??collectionLabel;
   reviewedOn=payload.changes.reviewed_on??reviewedOn;
  } else if(entry.kind==='source_added') {
   if(!validSource(payload) || sources.has(payload.id))throw Error('Invalid source entry.');
   sources.set(payload.id,structuredClone(payload));
  } else if(entry.kind==='source_corrected') {
   if(!fields(payload,['target_id','reason']) || !sources.has(payload.target_id) ||
      !validSource(payload.replacement) || payload.replacement.id!==payload.target_id)throw Error('Invalid source correction.');
   sources.set(payload.target_id,structuredClone(payload.replacement));
  } else {
   if(!hasSlug(entry.case_id))throw Error('Journal case reference missing.');
   if(entry.kind==='case_opened') {
    if(cases.has(entry.case_id) || !validCase(payload) || payload.id!==entry.case_id)throw Error('Invalid case opening.');
    cases.set(entry.case_id,{...structuredClone(payload),decision:null,events:[],requirements:[],history:[],withdrawn:false});
    evidenceIds.set(entry.case_id,new Set());requirementIds.set(entry.case_id,new Set());
    continue;
   }
   const c=cases.get(entry.case_id);if(!c)throw Error('Journal refers to unopened case.');
   if(c.withdrawn)throw Error('Journal refers to withdrawn case.');
   if(entry.kind==='evidence_added') {
    if(!validEvidence(payload,sources) || evidenceIds.get(entry.case_id).has(payload.id))throw Error('Invalid evidence entry.');
    evidenceIds.get(entry.case_id).add(payload.id);
    const evidence={...structuredClone(payload),ledger_seq:entry.seq};
    if(evidence.type==='decision') {
     if(c.decision)c.events.push(c.decision);
     c.decision=evidence;
    } else c.events.push(evidence);
   } else if(entry.kind==='evidence_corrected') {
    if(!fields(payload,['target_id','reason']) || !sourceRefs(payload.source_ids,sources) ||
       !validEvidence(payload.replacement,sources) || payload.replacement.id!==payload.target_id)throw Error('Invalid evidence correction.');
    const old=c.decision?.id===payload.target_id?c.decision:c.events.find(e=>e.id===payload.target_id);
    if(!old || (old.type==='decision')!==(payload.replacement.type==='decision'))throw Error('Invalid evidence reclassification.');
    const replacement={...structuredClone(payload.replacement),ledger_seq:entry.seq,
     correction_reason:payload.reason,correction_source_ids:[...payload.source_ids]};
    if(c.decision?.id===payload.target_id)c.decision=replacement;
    else c.events[c.events.findIndex(e=>e.id===payload.target_id)]=replacement;
   } else if(entry.kind==='evidence_retracted') {
    if(!fields(payload,['target_id','reason']) || !sourceRefs(payload.source_ids,sources))throw Error('Invalid evidence retraction.');
    const target=c.decision?.id===payload.target_id?c.decision:c.events.find(e=>e.id===payload.target_id);
    if(!target || target.type==='decision')throw Error('Invalid evidence retraction target.');
    c.events.splice(c.events.findIndex(e=>e.id===payload.target_id),1);
   } else if(entry.kind==='requirement_added') {
    if(!hasSlug(payload?.id) || requirementIds.get(entry.case_id).has(payload.id) ||
       !fields(payload,['text']) || !sourceRefs(payload.source_ids,sources))throw Error('Invalid requirement entry.');
    requirementIds.get(entry.case_id).add(payload.id);
    c.requirements.push({...structuredClone(payload),state:'unknown',note:'No reviewed fulfillment assessment recorded.',
      assessment_source_ids:[],ledger_seq:entry.seq});
   } else if(entry.kind==='requirement_assessed') {
    if(!fields(payload,['requirement_id','note']) || !states.has(payload.state) ||
       payload.reviewed!==true || !sourceRefs(payload.source_ids,sources))throw Error('Invalid requirement assessment.');
    const requirement=c.requirements.find(r=>r.id===payload.requirement_id);
    if(!requirement)throw Error('Assessment target missing.');
    requirement.state=payload.state;requirement.note=payload.note;
    requirement.assessment_source_ids=[...payload.source_ids];requirement.ledger_seq=entry.seq;
   } else if(entry.kind==='requirement_corrected') {
    if(!fields(payload,['target_id','reason']) || !sourceRefs(payload.source_ids,sources) ||
       !hasSlug(payload.replacement?.id) || payload.replacement.id!==payload.target_id ||
       !fields(payload.replacement,['text']) || !sourceRefs(payload.replacement.source_ids,sources))
     throw Error('Invalid requirement correction.');
    const index=c.requirements.findIndex(r=>r.id===payload.target_id);
    if(index<0)throw Error('Requirement correction target missing.');
    c.requirements[index]={...structuredClone(payload.replacement),state:'unknown',
     note:'No reviewed fulfillment assessment recorded.',assessment_source_ids:[],ledger_seq:entry.seq,
     correction_reason:payload.reason,correction_source_ids:[...payload.source_ids]};
   } else if(entry.kind==='requirement_retracted') {
    if(!fields(payload,['target_id','reason']) || !sourceRefs(payload.source_ids,sources))throw Error('Invalid requirement retraction.');
    const index=c.requirements.findIndex(r=>r.id===payload.target_id);
    if(index<0)throw Error('Requirement retraction target missing.');
    c.requirements.splice(index,1);
   } else if(entry.kind==='case_retracted') {
    if(!fields(payload,['reason']) || !sourceRefs(payload.source_ids,sources))throw Error('Invalid case retraction.');
    c.withdrawn=true;c.withdrawal_reason=payload.reason;c.withdrawal_source_ids=[...payload.source_ids];
    c.withdrawal_ledger_seq=entry.seq;
   } else if(entry.kind==='case_updated') {
    if(!fields(payload,['reason']) || !isRecord(payload.changes) || !Object.keys(payload.changes).length ||
       Object.keys(payload.changes).some(k=>!mutableFields.has(k)))throw Error('Invalid case update.');
    const next={...c,...payload.changes};if(!validCase(next))throw Error('Invalid case update.');
    Object.assign(c,structuredClone(payload.changes));
   } else throw Error('Unknown journal entry kind.');
   c.history.push({seq:entry.seq,recorded_on:entry.recorded_on,kind:entry.kind,
     reason:payload.reason||'',source_ids:[...(payload.source_ids||[])],target_id:payload.target_id||'',
     title:payload.title||payload.text||payload.replacement?.title||payload.replacement?.text||payload.requirement_id||''});
  }
 }
 return {schema_version:2,scope,collection_label:collectionLabel,reviewed_on:reviewedOn,
   sources:[...sources.values()],cases:[...cases.values()]};
}
export function validateJournal(journal) {
 const data=fold(journal);
 if(!data.scope || !data.cases.length || !data.sources.length ||
    data.cases.some(c=>!c.decision&&!c.withdrawn))throw Error('Incomplete evidence journal.');
 return journal;
}
export function projectJournal(journal,through=Infinity) {validateJournal(journal);return fold(journal,through);}
function caseSourceRefs(c) {
 if(!c)return new Set();
 const evidence=[...(c.decision?[c.decision]:[]),...c.events];
 return new Set([...evidence.flatMap(e=>[...e.source_ids,...(e.correction_source_ids||[])]),
  ...c.requirements.flatMap(r=>[...r.source_ids,...r.assessment_source_ids,...(r.correction_source_ids||[])]),
  ...c.history.filter(row=>row.kind.endsWith('_corrected')||row.kind.endsWith('_retracted')).flatMap(row=>row.source_ids)]);
}
export function caseSteps(journal,id) {
 const c=projectJournal(journal).cases.find(row=>row.id===id);
 if(!c)return [];
 const opened=journal.entries.find(entry=>entry.kind==='case_opened'&&entry.case_id===id).seq;
 const steps=[];
 for(const entry of journal.entries) {
  if(entry.seq<opened)continue;
  if(entry.case_id===id || entry.kind==='collection_updated')steps.push(entry.seq);
  else if(entry.kind==='source_corrected') {
   const before=fold(journal,entry.seq-1).cases.find(row=>row.id===id);
   if(caseSourceRefs(before).has(entry.payload.target_id))steps.push(entry.seq);
  }
 }
 return steps;
}
export const timelineEvents=c=>[...(c.decision?[c.decision]:[]),...c.events].sort((a,b)=>a.date.localeCompare(b.date)||a.ledger_seq-b.ledger_seq);
export const hasReviewedEvent=(c,type)=>!c.withdrawn&&c.events.some(e=>e.type===type&&e.reviewed===true&&e.source_ids.length);
export const outcomeDocumented=c=>hasReviewedEvent(c,'outcome');
export function filterCases(cases,query='',status='all') {
 const q=query.trim().toLowerCase();
 return cases.filter(c=>(status==='all'||(!c.withdrawn&&
  (status==='documented'?outcomeDocumented(c):status==='unknown'&&!outcomeDocumented(c)))) &&
 [c.title,c.decision_maker,c.implementer,c.subject,c.domain,c.place||'',c.summary].join(' ').toLowerCase().includes(q));
}
export function dateLabel(value) {
 return new Intl.DateTimeFormat('en-US',{month:'short',...(value.length>7?{day:'numeric'}:{}),
  year:'numeric',timeZone:'UTC'}).format(new Date(value.length===7?value+'-01T12:00:00Z':value+'T12:00:00Z'));
}
export function corpusMetadata(data) {
 const sourceCount=data.sources.length,caseCount=data.cases.length;
 return {reviewDate:dateLabel(data.reviewed_on),sourceCount,caseCount,
  sourceSummary:sourceCount+' public document'+(sourceCount===1?'':'s')+' behind '+caseCount+' casefile'+(caseCount===1?'':'s')+'.'};
}
export function handoff(c,sources,note='',sequence=null,latest=sequence===null) {
 const ids=caseSourceRefs(c);
 const cite=sourceIds=>sourceIds.map(id=>'['+id+']').join(' ');
 const eventRows=timelineEvents(c).map(e=>dateLabel(e.date)+' — '+e.title+' [ledger '+e.ledger_seq+']\n'+e.summary+'\n'+
  (e.type==='decision'?'Decision: '+e.result+'\nDecision context: '+e.result_basis+'\n':'')+
  'Evidence basis: '+e.basis+'\nSources: '+cite(e.source_ids)+
  (e.correction_reason?'\nCorrection: '+e.correction_reason+'\nCorrection sources: '+cite(e.correction_source_ids):'')).join('\n\n');
 const requirements=c.requirements.map(r=>r.state.toUpperCase()+' — '+r.text+'\n'+r.note+
  '\nSources: '+cite([...new Set([...r.source_ids,...r.assessment_source_ids])])+
  (r.correction_reason?'\nCorrection: '+r.correction_reason+'\nCorrection sources: '+cite(r.correction_source_ids):'')).join('\n\n');
 const repairs=c.history.filter(row=>row.kind.endsWith('_corrected')||row.kind.endsWith('_retracted')).map(row=>
  row.kind.replaceAll('_',' ').toUpperCase()+' — '+(row.target_id||c.id)+' [ledger '+row.seq+']\n'+row.reason+
  '\nSources: '+cite(row.source_ids)).join('\n\n');
 const limits=latest?c.limits.join('\n'):'Latest casefile limits are omitted from this partial replay.';
 const sourceRows=sources.filter(s=>ids.has(s.id)).map(s=>'['+s.id+'] '+s.title+'\n'+s.locator+'\n'+s.url+'\n'+s.review_method).join('\n\n');
 return c.title+' — '+c.decision_maker+'\n'+c.subject+'\nLedger: '+(sequence??'latest')+
  '\nStatus: '+(c.withdrawn?'Case withdrawn':outcomeDocumented(c)?'Outcome documented':'Outcome unknown in this corpus')+
  '\n\nEVIDENCE TRAIL\n'+(eventRows||'(No decision or action in this replay step.)')+
  '\n\nREQUIREMENTS\n'+(requirements||'(No requirements recorded at this replay step.)')+
  '\n\nCORRECTIONS AND RETRACTIONS\n'+(repairs||'(No repairs recorded at this replay step.)')+
  '\n\n'+(latest?'LIMITS':'LIMITS — PARTIAL REPLAY')+'\n'+limits+
  '\n\nSOURCES\n'+sourceRows+'\n\nLOCAL DRAFT — UNREVIEWED\n'+(note||'(No draft)')+'\n';
}
