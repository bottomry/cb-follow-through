import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateJournal,projectJournal,caseSteps,timelineEvents,outcomeDocumented,hasReviewedEvent,
 filterCases,corpusMetadata,handoff,dateLabel,sourceHref,escapeHTML} from '../site/journal.mjs';
const journal=validateJournal(JSON.parse(await readFile(new URL('../site/data/journal.json',import.meta.url),'utf8')));
const latest=projectJournal(journal);
const copy=()=>structuredClone(journal);
const caseBy=(data,id)=>data.cases.find(c=>c.id===id);
function add(data,kind,caseId,payload,recordedOn='2026-09-30') {
 const entry={seq:data.entries.length+1,recorded_on:recordedOn,kind,case_id:caseId,payload};
 data.entries.push(entry);return entry.seq;
}

test('the journal alone reconstructs the four reviewed casefiles',()=>{
 assert.equal(journal.entries.length,44);
 assert.equal(latest.sources.length,10);
 assert.equal(latest.cases.length,4);
 assert.equal(latest.cases.filter(outcomeDocumented).length,3);
 for(const c of latest.cases.filter(outcomeDocumented)) {
  assert.ok(c.decision?.source_ids.length);
  assert.ok(hasReviewedEvent(c,'action'));
  assert.ok(hasReviewedEvent(c,'outcome'));
 }
 assert.equal(outcomeDocumented(caseBy(latest,'st-marks-place')),false);
 assert.equal(JSON.stringify(journal).includes('"cases"'),false);
});
test('replay derives status at each sequence and never mutates the log',()=>{
 const before=JSON.stringify(journal),id='amsterdam-avenue',steps=caseSteps(journal,id);
 const opened=caseBy(projectJournal(journal,steps[0]),id);
 assert.equal(opened.decision,null);assert.equal(outcomeDocumented(opened),false);
 const decision=caseBy(projectJournal(journal,steps[1]),id);
 assert.ok(decision.decision);assert.equal(outcomeDocumented(decision),false);
 const outcome=caseBy(projectJournal(journal,steps[3]),id);
 assert.equal(outcomeDocumented(outcome),true);
 const final=caseBy(projectJournal(journal,steps.at(-1)),id);
 assert.equal(final.requirements.find(r=>r.text.includes('task force')).state,'unknown');
 assert.equal(JSON.stringify(journal),before);
});
test('later corrections are visible as a new ledger entry and earlier views survive',()=>{
 const changed=copy(),id='st-marks-place',original=caseBy(projectJournal(changed),id).decision;
 const replacement={...original,summary:'Corrected reading with the same outcome and original source.'};
 delete replacement.ledger_seq;
 const sequence=add(changed,'evidence_corrected',id,{
  target_id:original.id,reason:'A second review clarified the wording.',
  source_ids:[original.source_ids[0]],replacement
 });
 validateJournal(changed);
 assert.equal(caseBy(projectJournal(changed,sequence-1),id).decision.summary,original.summary);
 assert.equal(caseBy(projectJournal(changed),id).decision.summary,replacement.summary);
 assert.equal(changed.entries[sequence-1].kind,'evidence_corrected');
 assert.equal(changed.entries.find(e=>e.kind==='evidence_added'&&e.payload.id===original.id).payload.summary,original.summary);
});
test('evidence corrections preserve distinct correction provenance',()=>{
 const changed=copy(),id='st-marks-place',original=caseBy(projectJournal(changed),id).decision;
 const correctionSource=latest.sources.find(source=>!original.source_ids.includes(source.id));
 const replacement={...original,summary:'Corrected with separate supporting provenance.'};
 delete replacement.ledger_seq;
 add(changed,'evidence_corrected',id,{target_id:original.id,reason:'A separate record required this correction.',
  source_ids:[correctionSource.id],replacement});
 const corrected=caseBy(projectJournal(changed),id).decision;
 assert.deepEqual(corrected.source_ids,original.source_ids);
 assert.deepEqual(corrected.correction_source_ids,[correctionSource.id]);
 assert.equal(corrected.correction_reason,'A separate record required this correction.');
 const correctedSource=add(changed,'source_corrected',null,{target_id:correctionSource.id,
  reason:'Correction source locator clarified.',replacement:{...correctionSource,locator:'Clarified correction locator.'}});
 assert.equal(caseSteps(changed,id).includes(correctedSource),true);
 const brief=handoff(caseBy(projectJournal(changed),id),projectJournal(changed).sources);
 assert.match(brief,new RegExp('Sources: \\['+original.source_ids[0]+'\\]'));
 assert.match(brief,new RegExp('Correction sources: \\['+correctionSource.id+'\\]'));
 assert.match(brief,new RegExp('\\['+correctionSource.id+'\\] '+correctionSource.title));
});
test('source and collection corrections preserve earlier projections',()=>{
 const changed=copy(),source=latest.sources[0];
 const earlier=journal.entries.length;
 add(changed,'source_corrected',null,{target_id:source.id,reason:'Locator clarified in a later review.',
  replacement:{...source,locator:'Corrected locator in this test only.'}});
 add(changed,'collection_updated',null,{reason:'New review pass.',changes:{reviewed_on:'2026-09-30'}});
 const before=projectJournal(changed,earlier),after=projectJournal(changed);
 assert.equal(before.sources[0].locator,source.locator);
 assert.equal(after.sources[0].locator,'Corrected locator in this test only.');
 assert.equal(before.reviewed_on,'2026-09-29');assert.equal(after.reviewed_on,'2026-09-30');
 assert.deepEqual(caseSteps(changed,'amsterdam-avenue').slice(-2),[earlier+1,earlier+2]);
});
test('replay includes source corrections only after the case cites the source',()=>{
 const changed=copy(),sourceId='replay-correction-source',caseId='replay-correction-case';
 const source={id:sourceId,title:'Replay correction fixture',publisher:'Fixture publisher',
  url:'https://example.org/replay',locator:'Original locator',excerpt:'Fixture decision.',
  review_method:'Fictional test fixture; never published.'};
 add(changed,'source_added',null,source);
 add(changed,'case_opened',caseId,{id:caseId,number:'T2',title:'Replay correction timing',
  subtitle:'Fictional test case',decision_maker:'Fixture board',implementer:'Fixture office',
  subject:'Fixture subject',period:'2026',domain:'Testing',summary:'A replay timing fixture.',
  match:'The fixture identifiers match.',next_action:'No action.',limits:['No real-world claim is made.']});
 const beforeCitation=add(changed,'source_corrected',null,{target_id:sourceId,reason:'Before citation.',
  replacement:{...source,locator:'Corrected before citation'}});
 add(changed,'evidence_added',caseId,{id:'replay-decision',type:'decision',date:'2026-09-30',
  date_precision:'day',title:'Fixture decision',summary:'Fixture decision recorded.',result:'Recorded',
  result_basis:'Fictional fixture.',basis:'Fictional fixture.',reviewed:true,source_ids:[sourceId]});
 const afterCitation=add(changed,'source_corrected',null,{target_id:sourceId,reason:'After citation.',
  replacement:{...source,locator:'Corrected after citation'}});
 const steps=caseSteps(changed,caseId);
 assert.equal(steps.includes(beforeCitation),false);
 assert.equal(steps.includes(afterCitation),true);
});
test('later decisions retain prior decisions in the evidence trail',()=>{
 const changed=copy(),id='st-marks-place';
 const second={id:'later-decision-test',type:'decision',date:'2026-09-30',date_precision:'day',
  title:'Later fictional reconsideration',summary:'Test-only reconsideration.',
  result:'Reconsidered',result_basis:'Fictional test entry.',basis:'Fictional test fixture',
  source_ids:['stmarks-vote'],reviewed:true};
 add(changed,'evidence_added',id,second);
 const c=caseBy(projectJournal(changed),id);
 assert.equal(c.decision.id,second.id);
 assert.equal(timelineEvents(c).filter(e=>e.type==='decision').length,2);
 assert.equal(caseBy(projectJournal(changed,changed.entries.length-1),id).decision.id,'sm-vote');
});
test('requirements are assessed separately from the main outcome',()=>{
 const c=caseBy(latest,'columbus-avenue'),evaluation=c.requirements.find(r=>r.text.includes('six months'));
 assert.equal(outcomeDocumented(c),true);assert.equal(evaluation.state,'unknown');
 const changed=copy();
 add(changed,'requirement_assessed',c.id,{
  requirement_id:evaluation.id,state:'documented',note:'A later reviewed record closes this requirement in this test only.',
  source_ids:evaluation.source_ids,reviewed:true
 });
 assert.equal(caseBy(projectJournal(changed),c.id).requirements.find(r=>r.id===evaluation.id).state,'documented');
 assert.equal(caseBy(latest,c.id).requirements.find(r=>r.id===evaluation.id).state,'unknown');
});
test('a different domain and a decision without a vote use the same model',()=>{
 const j=copy(),source='fictional-library-source',id='fictional-library-hours';
 add(j,'source_added',null,{id:source,title:'Fictional library decision',publisher:'Fixture Council',
  url:'https://example.org/library',locator:'Test fixture paragraph 1',excerpt:'Weekend hours approved.',
  review_method:'Fictional test fixture; never published.'});
 add(j,'case_opened',id,{id,number:'T1',title:'Weekend library hours',subtitle:'Fictional test case',
  decision_maker:'Library trustees',implementer:'Library service',subject:'Weekend opening hours',
  period:'2026',domain:'Public services',summary:'A fictional library decision and later opening.',
  match:'The same fictional branch and hours appear throughout the fixture.',
  next_action:'Check the next schedule.',limits:['No real-world claim is made.']});
 add(j,'evidence_added',id,{id:'library-decision',type:'decision',date:'2026-01-02',date_precision:'day',
  title:'Trustees approve hours',summary:'Decision signed.',result:'Approved by trustees',
  result_basis:'Written approval; no vote tally applies.',basis:'Fictional fixture',
  reviewed:true,source_ids:[source]});
 add(j,'evidence_added',id,{id:'library-action',type:'action',date:'2026-01-03',date_precision:'day',
  title:'Schedule posted',summary:'Library publishes planned hours.',basis:'Fictional fixture',
  reviewed:true,source_ids:[source]});
 add(j,'evidence_added',id,{id:'library-outcome',type:'outcome',date:'2026-01-10',date_precision:'day',
  title:'Weekend opening recorded',summary:'A later fictional record confirms opening.',
  basis:'Fictional fixture',reviewed:true,source_ids:[source]});
 add(j,'requirement_added',id,{id:'weekend-hours',text:'Open on Saturdays',source_ids:[source]});
 add(j,'requirement_assessed',id,{requirement_id:'weekend-hours',state:'documented',
  note:'Fictional outcome source.',source_ids:[source],reviewed:true});
 const c=caseBy(projectJournal(j),id);
 assert.ok(c);assert.equal(c.place,undefined);assert.equal(c.decision.result,'Approved by trustees');
 assert.equal(outcomeDocumented(c),true);assert.equal(filterCases([c],'Library trustees').length,1);
 assert.equal(handoff(c,projectJournal(j).sources).includes('Decision: Approved by trustees'),true);
});
test('source links, chronological order and exported unknowns remain traceable',()=>{
 const chrystie=caseBy(latest,'chrystie-street');
 assert.equal(timelineEvents(chrystie)[0].date,'2015-02');
 const brief=handoff(chrystie,latest.sources,'Candidate only',caseSteps(journal,chrystie.id).at(-1));
 assert.ok(brief.indexOf('Feb 2015')<brief.indexOf('May 24, 2016'));
 assert.match(brief,/Decision context:/);assert.match(brief,/LOCAL DRAFT — UNREVIEWED/);
 const columbus=handoff(caseBy(latest,'columbus-avenue'),latest.sources);
 assert.match(columbus,/UNKNOWN — Evaluate after six months/);
 assert.match(columbus,/https:\/\/www.nyc.gov/);
 assert.equal(dateLabel('2015-02'),'Feb 2015');
});
test('seed exports preserve limits without leaking them into partial replay',()=>{
 const expected={
  'amsterdam-avenue':[
   'The documented result is installation, not proof that every requested condition was met.',
   'No independent field inspection or current-condition survey is included.'
  ],
  'chrystie-street':[
   'The original February 2015 resolution is represented only through the May 2016 retrospective account.',
   'Construction completion is documented; causal impact and fulfillment of every design detail are not evaluated.'
  ],
  'columbus-avenue':[
   '2012 is the date of confirmation in the selected DOT document, not the year construction finished.',
   'The accepted six-month evaluation and publication condition is distinct from the rejected amendment that would have required CB7 participation in decisions to revisit, end, expand, modify or make the lane permanent.',
   'The October 2011 return presentation does not by itself establish timely compliance with the accepted six-month condition or publication to the community.'
  ],
  'st-marks-place':[
   'This is not a claim that DOT did nothing. It is a gap in the selected evidence.',
   'The source was inherited from a reviewed public CityScroll pilot; the original PDF could not be fetched again.'
  ]
 };
 for(const [id,limits] of Object.entries(expected)) {
  const c=caseBy(latest,id),brief=handoff(c,latest.sources);
  assert.deepEqual(c.limits,limits);
  for(const limit of limits)assert.equal(brief.includes(limit),true);
 }
 const id='st-marks-place',step=caseSteps(journal,id)[0],view=projectJournal(journal,step);
 const partial=handoff(caseBy(view,id),view.sources,'',step,false);
 assert.match(partial,/LIMITS — PARTIAL REPLAY\nLatest casefile limits are omitted/);
 for(const limit of expected[id])assert.equal(partial.includes(limit),false);
});
test('invalid ordering, missing references and false completion claims fail closed',()=>{
 for(const mutate of [
  d=>d.entries[3].seq=2,
  d=>d.entries[0].recorded_on='2026-02-31',
  d=>d.entries.find(e=>e.kind==='evidence_added').payload.source_ids=['absent'],
  d=>d.entries.find(e=>e.kind==='evidence_added').payload.reviewed=false,
  d=>d.entries.find(e=>e.kind==='evidence_added').payload.type='implementaton',
  d=>d.entries.find(e=>e.kind==='requirement_assessed').payload.state='documented ',
  d=>d.entries.find(e=>e.kind==='evidence_added').payload.date='2026-02-29',
  d=>d.entries.find(e=>e.kind==='case_opened').payload.decision_maker='',
  d=>d.entries.find(e=>e.kind==='source_added').payload.url='javascript:alert(1)'
 ]){const invalid=copy();mutate(invalid);assert.throws(()=>validateJournal(invalid));}
 const decisionOnly=caseBy(projectJournal(journal,caseSteps(journal,'st-marks-place')[1]),'st-marks-place');
 assert.equal(outcomeDocumented(decisionOnly),false);
});
test('metadata and safe formatters reflect the projected corpus',()=>{
 assert.deepEqual(corpusMetadata(latest),{
  reviewDate:'Sep 29, 2026',sourceCount:10,caseCount:4,
  sourceSummary:'10 public documents behind 4 casefiles.'
 });
 assert.equal(sourceHref({url:'https://example.org/source',page:9}),'https://example.org/source#page=9');
 assert.equal(sourceHref({url:'https://example.org/source',page:'9" onclick="alert(1)'}),null);
 assert.equal(escapeHTML('x" onclick="alert(1)<script>'),'x&quot; onclick=&quot;alert(1)&lt;script&gt;');
});
