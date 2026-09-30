import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validate,escapeHTML,sourceHref,hasReviewedEvent,implemented,timelineEvents,filterCases,dateLabel,corpusMetadata,handoff,safeURL} from '../site/model.mjs';
const data=validate(JSON.parse(await readFile(new URL('../site/data/cases.json',import.meta.url),'utf8')));
test('three source-backed end-to-end cases and one explicitly unresolved case',()=>{
 assert.equal(data.cases.length,4); assert.equal(data.cases.filter(implemented).length,3);
 for(const c of data.cases.filter(implemented)) {
  for(const type of ['decision','agency_action','implementation']) assert.ok(timelineEvents(c).some(e=>e.type===type && e.source_ids.length && e.reviewed));
  assert.ok(c.match.length>20); assert.ok(c.limits.length);
 }
 const unresolved=data.cases.find(c=>c.id==='st-marks-place');assert.ok(unresolved);assert.equal(implemented(unresolved),false);
});
test('one canonical decision record drives timeline and export',()=>{
 for(const c of data.cases) {
  assert.equal(c.events.some(e=>e.type==='decision'),false);
  const decisions=timelineEvents(c).filter(e=>e.type==='decision');assert.equal(decisions.length,1);assert.equal(decisions[0].title,c.decision.title);assert.equal(decisions[0].summary,c.decision.summary);assert.deepEqual(decisions[0].source_ids,c.decision.source_ids);
  assert.equal(handoff(c,data.sources).split(c.decision.title).length-1,1);
 }
 const duplicate=structuredClone(data);duplicate.cases[0].events.push({...duplicate.cases[0].decision,id:'second-decision',type:'decision'});assert.throws(()=>validate(duplicate),/event semantics/);
});
test('a proposal and board vote cannot produce a completed outcome',()=>{
 const c=structuredClone(data.cases[0]);c.events=c.events.filter(e=>e.type!=='implementation');assert.equal(implemented(c),false);
 c.events.push({type:'implementation',reviewed:false,source_ids:['dot-2016-completion']});assert.equal(implemented(c),false);
});
test('only reviewed events establish evidence-chain stages',()=>{
 const corpus=structuredClone(data);const c=corpus.cases[0];const agency=c.events.find(e=>e.type==='agency_action');
 assert.equal(hasReviewedEvent(c,'agency_action'),true);agency.reviewed=false;assert.throws(()=>validate(corpus),/event semantics/);assert.equal(hasReviewedEvent(c,'agency_action'),false);
 assert.equal(hasReviewedEvent(c,'implementation'),true);c.events.find(e=>e.type==='implementation').reviewed=false;assert.equal(implemented(c),false);
});
test('filtering is case insensitive, combined and explicit about empty results',()=>{
 assert.equal(filterCases(data.cases,'CB3').length,2);assert.equal(filterCases(data.cases,'  amsterdam ','documented').length,1);assert.equal(filterCases(data.cases,'Amsterdam','unknown').length,0);assert.equal(filterCases(data.cases,'','unknown').length,1);assert.equal(filterCases(data.cases,'nonexistent').length,0);
});
test('handoff retains source URLs, limits and segregated draft notes',()=>{
 const before=JSON.stringify(data);const text=handoff(data.cases[0],data.sources,'Unverified candidate https://example.org/');assert.match(text,/LOCAL DRAFT — UNREVIEWED/);assert.match(text,/https:\/\/www.nyc.gov/);assert.match(text,/LIMITS/);assert.match(text,/Unverified candidate/);assert.equal(JSON.stringify(data),before);
 const direct=structuredClone(data.cases[0]);const event=direct.events.find(e=>e.type==='implementation');event.reviewed=false;const directText=handoff(direct,data.sources);const row=directText.split('\n').find(line=>line.includes(event.title));assert.equal(row,`UNREVIEWED · ${dateLabel(event.date)} — ${event.title}`);assert.match(directText,/Status: Outcome unknown in this corpus/);
});
test('handoff preserves chronological evidence, decision context and request unknowns',()=>{
 const chrystie=data.cases.find(c=>c.id==='chrystie-street');const chrystieText=handoff(chrystie,data.sources);const request=chrystie.events.find(e=>e.id==='ch-request');const decision=chrystie.decision;
 const decisionSource=data.sources.find(source=>source.id==='chrystie-vote');assert.ok(chrystieText.indexOf(request.title)<chrystieText.indexOf(decision.title));assert.match(chrystieText,new RegExp(`Evidence basis: ${request.basis}`));assert.match(chrystieText,new RegExp(`Vote: ${decision.vote}`));assert.match(chrystieText,new RegExp(`Vote context: ${decision.vote_basis}`));assert.match(chrystieText,/Sources: \[chrystie-vote\]/);assert.ok(chrystieText.includes(`[${decisionSource.id}] ${decisionSource.title}\n${decisionSource.locator}`));
 for(const [caseId,requestText,sourceId] of [
  ['amsterdam-avenue','Establish the proposed neighborhood evaluation task force','amsterdam-resolution'],
  ['columbus-avenue','Evaluate after six months and publish results to CB7 and the community','columbus-evaluation']
 ]) {
  const c=data.cases.find(row=>row.id===caseId);const request=c.requests.find(row=>row.text===requestText);const text=handoff(c,data.sources);assert.match(text,new RegExp(`UNKNOWN — ${request.text}\\n${request.note}\\nSources: .*\\[${sourceId}\\]`));
 }
});
test('source URLs reject executable schemes and data references fail closed',()=>{
 for(const value of ['javascript:alert(1)','data:text/html,test','http://example.org','garbage'])assert.equal(safeURL(value),null);
 assert.equal(safeURL('https://www.nyc.gov/'),'https://www.nyc.gov/');
 const invalid=structuredClone(data);invalid.cases[0].events[0].source_ids=['absent'];assert.throws(()=>validate(invalid),/source reference/);
 const bad=structuredClone(data);bad.sources[0].url='javascript:alert(1)';assert.throws(()=>validate(bad),/source record/);
 assert.throws(()=>validate({}),/Unsupported/);
});
test('render formatters encode hostile values and compose source fragments safely',()=>{
 assert.equal(escapeHTML('x" onclick="alert(1)<script>'), 'x&quot; onclick=&quot;alert(1)&lt;script&gt;');
 assert.equal(sourceHref({url:'https://example.org/source',page:9}),'https://example.org/source#page=9');
 assert.equal(sourceHref({url:'https://example.org/source',page:'9" onclick="alert(1)'}),null);
});
test('case and source identifiers and source pages are constrained',()=>{
 for(const [mutate,message] of [
  [d=>d.cases[0].id='x" onclick="alert(1)',/casefile/],
  [d=>d.cases[0].id=123,/casefile/],
  [d=>d.sources[0].id='x<script>',/source record/],
  [d=>d.sources[0].id=null,/source record/],
  [d=>delete d.cases[0].decision.id,/decision record/],
  [d=>delete d.cases[0].events[0].id,/event record/],
  [d=>d.sources[0].page=0,/source record/],
  [d=>d.sources[0].page=1.5,/source record/],
  [d=>d.sources[0].page='1" onclick="alert(1)',/source record/]
 ]) {
  const invalid=structuredClone(data);mutate(invalid);assert.throws(()=>validate(invalid),message);
 }
});
test('static corpus claim fields are complete nonempty strings',()=>{
 for(const [select,fields,message] of [
  [d=>d.sources[0],['title','publisher','url','locator','excerpt','review_method'],/source record/],
  [d=>d.cases[0],['title','number','board','agency','corridor','period','subtitle','summary','match','next_action'],/casefile/],
  [d=>d.cases[0].decision,['title','summary','basis','vote','vote_basis'],/decision record/],
  [d=>d.cases[0].events[0],['title','summary','basis'],/event record/],
  [d=>d.cases[0].requests[0],['text','note'],/request record/]
 ]) for(const field of fields) {
  const invalid=structuredClone(data);select(invalid)[field]='   ';assert.throws(()=>validate(invalid),message);
 }
 const badLimit=structuredClone(data);badLimit.cases[0].limits[0]='';assert.throws(()=>validate(badLimit),/casefile/);
});
test('top-level arrays, review date and optional source fields are typed',()=>{
 for(const [mutate,message] of [
  [d=>d.scope='',/Unsupported/],
  [d=>d.reviewed_on='2026-02-31',/Unsupported/],
  [d=>d.sources=[],/Unsupported/],
  [d=>d.cases=[],/Unsupported/],
  [d=>d.cases[0].events=null,/casefile/],
  [d=>d.cases[0].requests=[],/casefile/],
  [d=>d.cases[0].limits=[],/casefile/],
  [d=>d.sources[0].access_note=7,/source record/],
  [d=>d.sources[0].upstream={},/source record/],
  [d=>d.sources[0].page=undefined,/source record/]
 ]) {
  const invalid=structuredClone(data);mutate(invalid);assert.throws(()=>validate(invalid),message);
 }
});
test('every evidence row requires at least one source reference',()=>{
 for(const select of [d=>d.cases[0].decision,d=>d.cases[0].events[0],d=>d.cases[0].requests[0]]) {
  const invalid=structuredClone(data);select(invalid).source_ids=[];assert.throws(()=>validate(invalid),/source reference/);
 }
});
test('dates are real and event precision matches the date shape',()=>{
 for(const mutate of [
  d=>d.cases[0].decision.date='2026-02-29',
  d=>d.cases[0].events[0].date='2026-02-31',
  d=>d.cases[0].events[0].date='2016-13',
  d=>delete d.cases[0].events[0].date_precision,
  d=>d.cases[0].events[0].date_precision='month',
  d=>{d.cases[0].events[0].date='2016-02';d.cases[0].events[0].date_precision='day';}
 ]) {
  const invalid=structuredClone(data);mutate(invalid);assert.throws(()=>validate(invalid),/date/);
 }
 const missingDecisionPrecision=structuredClone(data);delete missingDecisionPrecision.cases[0].decision.date_precision;assert.throws(()=>validate(missingDecisionPrecision),/decision record/);
 const leapDay=structuredClone(data);leapDay.cases[0].decision.date='2024-02-29';leapDay.cases[0].events[0].date='2016-02-29';assert.doesNotThrow(()=>validate(leapDay));
 const month=structuredClone(data);month.cases[0].events[0].date='2016-02';month.cases[0].events[0].date_precision='month';assert.doesNotThrow(()=>validate(month));
});
test('event and request semantics reject unsupported values',()=>{
 for(const [mutate,message] of [
  [d=>d.cases[0].events[0].type='implementaton',/event semantics/],
  [d=>d.cases[0].events[0].reviewed='true',/event semantics/],
  [d=>d.cases[0].requests[0].state='documented ',/request state/]
 ]) {
  const invalid=structuredClone(data);mutate(invalid);assert.throws(()=>validate(invalid),message);
 }
 const unreviewed=structuredClone(data);unreviewed.cases[0].events[0].reviewed=false;assert.throws(()=>validate(unreviewed),/event semantics/);
});
test('date precision and retrospective confirmation are preserved',()=>{
 assert.equal(dateLabel('2015-02'),'Feb 2015');assert.equal(dateLabel('2016-12-21'),'Dec 21, 2016');
 const columbus=data.cases.find(c=>c.id==='columbus-avenue');assert.equal(columbus.events.find(e=>e.type==='implementation').date,'2012-12-11');
});
test('corpus metadata reflects validated review date and record counts',()=>{
 const changed=structuredClone(data);changed.reviewed_on='2025-01-02';changed.sources.push({...changed.sources[0],id:'extra-source'});changed.cases.push({...structuredClone(changed.cases[0]),id:'extra-case'});
 const meta=corpusMetadata(validate(changed));
 assert.deepEqual(meta,{reviewDate:'Jan 2, 2025',sourceCount:11,caseCount:5,sourceSummary:'11 public documents behind 5 casefiles.'});
});
