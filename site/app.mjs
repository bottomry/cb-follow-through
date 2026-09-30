import {validateJournal,projectJournal,caseSteps,escapeHTML,sourceHref,hasReviewedEvent,outcomeDocumented,
 timelineEvents,filterCases,dateLabel,corpusMetadata,handoff} from './journal.mjs';
const $=selector=>document.querySelector(selector),esc=escapeHTML;
let journal,data,meta,currentId,replayIndex=0,opener,currentSources=[];
const dialog=$('#dialog');
function openDialog(html) {opener=document.activeElement;$('#dialog-content').innerHTML=html;dialog.showModal();$('#close').focus();}
$('#close').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>opener?.focus());
$('.skip').addEventListener('click',event=>{event.preventDefault();$('#case').focus({preventScroll:true});$('#case').scrollIntoView({block:'start'});});
function sourceButtons(ids) {
 return ids.map(id=>{const source=currentSources.find(s=>s.id===id);
  return '<button class="source" data-source="'+esc(id)+'">↗ '+esc(source.title)+'</button>';}).join('');
}
function sourceHTML(source) {
 return '<article class="source-detail"><p class="eyebrow">'+esc(source.publisher)+'</p><h2>'+esc(source.title)+
  '</h2><p>'+esc(source.locator)+'</p><blockquote>“'+esc(source.excerpt)+'”</blockquote><p>'+esc(source.access_note||'')+
  '</p><p class="muted">'+esc(source.review_method)+'</p><a class="primary link" href="'+esc(sourceHref(source))+
  '" target="_blank" rel="noopener noreferrer">Open original source ↗</a></article>';
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-source]');
 if(button)openDialog(sourceHTML(currentSources.find(s=>s.id===button.dataset.source)));
});
function renderList() {
 const found=filterCases(data.cases,$('#search').value,$('#status').value);
 $('#count').textContent=found.length+' of '+data.cases.length+' casefiles';
 $('#list').innerHTML=found.map(c=>
  '<a class="case-link '+(currentId===c.id?'selected':'')+'" href="#'+esc(c.id)+'" '+
  (currentId===c.id?'aria-current="true"':'')+'><span class="case-number">'+esc(c.number)+' / '+esc(c.domain)+
  '</span><strong>'+esc(c.title)+' <span>↗</span></strong><small>'+esc(c.decision_maker)+' · '+esc(c.subject)+
  '</small><span class="badge '+(outcomeDocumented(c)?'green':'amber')+'">'+
  (outcomeDocumented(c)?'● Outcome documented':'◌ Outcome unknown')+'</span></a>').join('')||
  '<p class="empty">No matching casefiles. Try another subject or choose all statuses.</p>';
}
function readDraft(id) {try{return localStorage.getItem('follow-through:'+id)||'';}catch{return '';}}
function entryDescription(entry,casefile) {
 const payload=entry.payload;
 const action={
  case_opened:'Case opened',evidence_added:'Evidence added',evidence_corrected:'Evidence corrected',
  requirement_added:'Requirement recorded',requirement_assessed:'Requirement assessed',case_updated:'Case description updated'
 }[entry.kind]||entry.kind;
 const requirement=casefile.requirements.find(r=>r.id===payload.requirement_id);
 return action+': '+(payload.title||payload.text||payload.replacement?.title||requirement?.text||payload.reason||payload.id);
}
function renderCase() {
 const base=data.cases.find(c=>c.id===currentId)||data.cases[0];
 currentId=base.id;
 const steps=caseSteps(journal,currentId);
 replayIndex=Math.max(0,Math.min(replayIndex,steps.length-1));
 const sequence=steps[replayIndex],latest=replayIndex===steps.length-1;
 const view=projectJournal(journal,sequence),c=view.cases.find(row=>row.id===currentId);
 currentSources=view.sources;
 const entry=journal.entries[sequence-1],events=timelineEvents(c);
 const done=outcomeDocumented(c),action=hasReviewedEvent(c,'action');
 document.title=c.title+' · Follow-through';
 const chains=[
  ['01','Decision',c.decision?'Recorded public decision':'Evidence not yet reached',!!c.decision],
  ['02','Public action',action?'Dated public record':'Evidence still needed',action],
  ['03','Outcome',done?'Documented result':'Not established',done]
 ];
 const chain='<div class="chain" aria-label="Evidence chain">'+chains.map((stage,index)=>
  (index?'<i>→</i>':'')+'<div class="'+(stage[3]?'':'missing')+'"><b>'+stage[0]+
  '</b><strong>'+stage[1]+'</strong><span>'+stage[2]+'</span></div>').join('')+'</div>';
 const decision=c.decision?
  '<div class="vote"><span class="eyebrow">THE DECISION · '+esc(dateLabel(c.decision.date))+
  ' · LEDGER '+c.decision.ledger_seq+'</span><strong>'+esc(c.decision.result)+'</strong><p>'+
  esc(c.decision.result_basis)+'</p>'+sourceButtons(c.decision.source_ids)+'</div>':
  '<div class="vote"><strong>The decision is not yet in this replay step.</strong></div>';
 const timeline=events.map(e=>'<article class="event"><div class="event-date">'+esc(dateLabel(e.date))+
  '<span>'+esc(e.type)+' · ledger '+e.ledger_seq+'</span></div><div><h4>'+esc(e.title)+'</h4><p>'+
  esc(e.summary)+'</p>'+(e.basis!=='Direct published record'?'<p class="qualification">'+esc(e.basis)+'</p>':'')+
  '<div class="source-row">'+sourceButtons(e.source_ids)+'</div></div></article>').join('')||
  '<p class="empty">No public decision or action is included at this step.</p>';
 const requirements=c.requirements.map(r=>'<article class="request"><span class="badge '+
  (r.state==='documented'?'green':'amber')+'">'+(r.state==='documented'?'Documented':'Not established')+
  '</span><div><h4>'+esc(r.text)+'</h4><p>'+esc(r.note)+'</p>'+
  sourceButtons([...new Set([...r.source_ids,...r.assessment_source_ids])])+'</div></article>').join('')||
  '<p class="empty">No requirements are included at this step.</p>';
 const trail=latest?
  '<p class="lead">'+esc(c.summary)+'</p>':
  '<p class="lead">This replay includes the journal through entry '+sequence+
  '. Later evidence and assessments are hidden; “unknown” here means they have not entered this view.</p>';
 const context=latest?'<section class="reasoning"><p class="eyebrow">WHY THESE RECORDS CONNECT</p><p>'+
  esc(c.match)+'</p><h4>What this does not establish</h4><ul>'+c.limits.map(limit=>'<li>'+esc(limit)+'</li>').join('')+
  '</ul></section>':'';
 $('#case').innerHTML='<div class="case-heading"><p class="eyebrow">CASEFILE '+esc(c.number)+
  ' <span> / '+esc(c.domain)+' / '+esc(c.period)+'</span></p><div class="title-row"><h2>'+
  esc(c.title)+'</h2><button id="export">↓ Export brief</button></div><p class="subtitle">'+esc(latest?c.subtitle:c.subject)+
  '</p><div class="tags"><span>'+esc(c.decision_maker)+'</span><span>'+esc(c.implementer)+
  '</span><span>'+esc(c.subject)+'</span><span class="badge '+(done?'green':'amber')+'">'+
  (done?'Outcome documented':'Outcome unknown in this corpus')+'</span></div></div>'+
  '<section class="replay"><div class="replay-title"><div><p class="eyebrow">REPLAY THE EVIDENCE LEDGER</p><h3>'+
  'What changed in the record?</h3></div><span id="replay-count" aria-live="polite">Step '+
  (replayIndex+1)+' of '+steps.length+'</span></div><div class="replay-controls"><button id="previous" '+
  (replayIndex===0?'disabled':'')+' aria-label="Previous ledger entry">← Previous</button>'+
  '<input id="replay-range" type="range" min="0" max="'+(steps.length-1)+'" value="'+replayIndex+
  '" aria-label="Replay case evidence ledger"><button id="next" '+(latest?'disabled':'')+
  ' aria-label="Next ledger entry">Next →</button></div><p class="replay-entry"><strong>'+
  esc(entryDescription(entry,c))+'</strong><br>Recorded in this dataset '+esc(dateLabel(entry.recorded_on))+
  ' · Entry '+sequence+(entry.payload.reason?' · '+esc(entry.payload.reason):'')+
  '</p><p class="replay-note">Replay follows additions to this dataset, not what residents knew on each historical date. '+
  '<a href="./data/journal.json">Inspect the complete journal</a>.</p></section>'+
  chain+trail+decision+
  '<section><div class="section-title"><h3>The evidence trail</h3><span>'+events.length+
  ' linked records</span></div><div class="timeline">'+timeline+'</div></section>'+
  '<section><div class="section-title"><h3>What was asked. What is known.</h3></div>'+requirements+'</section>'+
  context+'<section class="draft"><p class="eyebrow">TAKE THE NEXT STEP</p><h3>A useful question, ready to pursue.</h3><p>'+
  esc(latest?c.next_action:'Continue the ledger before choosing a follow-up question.')+'</p><label for="note">Your follow-up notes or candidate source URLs</label>'+
  '<textarea id="note" rows="4" placeholder="What would close the remaining evidence gap?"></textarea>'+
  '<div class="draft-bottom"><span id="saved" role="status">Private to this browser. Unreviewed notes never change the case status.</span>'+
  '<button id="clear">Clear notes</button></div></section>';
 $('#replay-range').onchange=event=>{replayIndex=Number(event.target.value);renderCase();$('#replay-range').focus();};
 $('#previous').onclick=()=>{replayIndex--;renderCase();$('#previous').focus();};
 $('#next').onclick=()=>{replayIndex++;renderCase();$('#next').focus();};
 $('#note').value=readDraft(c.id);
 $('#note').oninput=()=>{try{localStorage.setItem('follow-through:'+c.id,$('#note').value);
  $('#saved').textContent='Saved in this browser only · unreviewed draft';}
  catch{$('#saved').textContent='Browser storage unavailable. Export your brief to keep these notes.';}};
 $('#clear').onclick=()=>{$('#note').value='';$('#note').oninput();};
 $('#export').onclick=()=>{const blob=new Blob([handoff(c,view.sources,$('#note').value,sequence)],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=c.id+'-brief.txt';
  link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 renderList();
}
$('#search').oninput=renderList;$('#status').onchange=renderList;
$('#method').onclick=()=>openDialog('<h2>An evidence ledger for public decisions.</h2>'+
 '<p>Every reviewed addition is appended to the journal. Casefiles, statuses, search results and exports are rebuilt from those entries. '+
 'A later correction adds another entry and preserves the earlier interpretation for replay.</p>'+
 '<h3>Three separate questions</h3><ol><li>Was there a recorded decision?</li><li>Is there a dated public action?</li>'+
 '<li>Does a later source establish an outcome?</li></ol><p>A plan or decision cannot prove completion. A documented main outcome '+
 'does not close every requirement. Unknown means this corpus lacks sufficient evidence.</p>'+
 '<p>The current collection is '+esc(data.collection_label)+'. The model also supports other subjects, decision makers, '+
 'implementers and non-vote decisions. These examples do not claim that a decision caused an outcome.</p>'+
 '<p>Dates on evidence describe source records. Ledger dates describe when this dataset recorded them. '+
 'Replay is a view of the dataset sequence, not a reconstruction of public knowledge at the time.</p>'+
 '<p>Sources remain the authority. Notes stay in your browser and cannot change reviewed status. '+
 'This static collection was reviewed '+esc(meta.reviewDate)+'.</p>');
$('#sources').onclick=()=>openDialog('<h2>The source register</h2><p>'+esc(meta.sourceSummary)+
 ' Open any original to inspect the full context.</p>'+data.sources.map(sourceHTML).join(''));
try {
 const response=await fetch(new URL('./data/journal.json',import.meta.url));
 if(!response.ok)throw Error('Evidence journal unavailable.');
 journal=validateJournal(await response.json());
 data=projectJournal(journal);currentSources=data.sources;meta=corpusMetadata(data);
 $('#reviewed-on').textContent='Evidence reviewed '+meta.reviewDate;
 $('#collection-label').textContent=data.collection_label;
 $('#stats').innerHTML='<div><strong>'+meta.caseCount+'</strong><span>casefiles</span></div><div><strong>'+
 data.cases.filter(outcomeDocumented).length+'</strong><span>documented outcomes</span></div><div><strong>'+
 new Set(data.cases.map(c=>c.decision_maker)).size+'</strong><span>decision makers</span></div>';
 currentId=data.cases.find(c=>c.id===location.hash.slice(1))?.id||data.cases[0].id;
 replayIndex=caseSteps(journal,currentId).length-1;renderCase();
 window.addEventListener('hashchange',()=>{const next=data.cases.find(c=>c.id===location.hash.slice(1))?.id;
  if(next&&next!==currentId){currentId=next;replayIndex=caseSteps(journal,next).length-1;renderCase();}});
} catch(error) {
 $('#case').textContent='The evidence journal could not be loaded. Please reload or check the local server. '+error.message;
 for(const element of document.querySelectorAll('button,input,select'))element.disabled=true;
}
