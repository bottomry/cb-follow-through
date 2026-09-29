import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validate,implemented,filterCases,dateLabel,handoff,safeURL} from '../site/model.mjs';
const data=validate(JSON.parse(await readFile(new URL('../site/data/cases.json',import.meta.url),'utf8')));
test('three source-backed end-to-end cases and one explicitly unresolved case',()=>{
 assert.equal(data.cases.length,4); assert.equal(data.cases.filter(implemented).length,3);
 for(const c of data.cases.filter(implemented)) {
  for(const type of ['decision','agency_action','implementation']) assert.ok(c.events.some(e=>e.type===type && e.source_ids.length && e.reviewed));
  assert.ok(c.match.length>20); assert.ok(c.limits.length);
 }
 const unresolved=data.cases.find(c=>c.id==='st-marks-place');assert.ok(unresolved);assert.equal(implemented(unresolved),false);
});
test('a proposal and board vote cannot produce a completed outcome',()=>{
 const c=structuredClone(data.cases[0]);c.events=c.events.filter(e=>e.type!=='implementation');assert.equal(implemented(c),false);
 c.events.push({type:'implementation',reviewed:false,source_ids:['dot-2016-completion']});assert.equal(implemented(c),false);
});
test('filtering is case insensitive, combined and explicit about empty results',()=>{
 assert.equal(filterCases(data.cases,'CB3').length,2);assert.equal(filterCases(data.cases,'  amsterdam ','documented').length,1);assert.equal(filterCases(data.cases,'Amsterdam','unknown').length,0);assert.equal(filterCases(data.cases,'','unknown').length,1);assert.equal(filterCases(data.cases,'nonexistent').length,0);
});
test('handoff retains source URLs, limits and segregated draft notes',()=>{
 const before=JSON.stringify(data);const text=handoff(data.cases[0],data.sources,'Unverified candidate https://example.org/');assert.match(text,/LOCAL DRAFT — UNREVIEWED/);assert.match(text,/https:\/\/www.nyc.gov/);assert.match(text,/LIMITS/);assert.match(text,/Unverified candidate/);assert.equal(JSON.stringify(data),before);
});
test('source URLs reject executable schemes and data references fail closed',()=>{
 for(const value of ['javascript:alert(1)','data:text/html,test','http://example.org','garbage'])assert.equal(safeURL(value),null);
 assert.equal(safeURL('https://www.nyc.gov/'),'https://www.nyc.gov/');
 const invalid=structuredClone(data);invalid.cases[0].events[0].source_ids=['absent'];assert.throws(()=>validate(invalid),/source reference/);
 const bad=structuredClone(data);bad.sources[0].url='javascript:alert(1)';assert.throws(()=>validate(bad),/source record/);
 assert.throws(()=>validate({}),/Unsupported/);
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
 const unreviewed=structuredClone(data);unreviewed.cases[0].events[0].reviewed=false;assert.doesNotThrow(()=>validate(unreviewed));
});
test('date precision and retrospective confirmation are preserved',()=>{
 assert.equal(dateLabel('2015-02'),'Feb 2015');assert.equal(dateLabel('2016-12-21'),'Dec 21, 2016');
 const columbus=data.cases.find(c=>c.id==='columbus-avenue');assert.equal(columbus.events.find(e=>e.type==='implementation').date,'2012-12-11');
});
