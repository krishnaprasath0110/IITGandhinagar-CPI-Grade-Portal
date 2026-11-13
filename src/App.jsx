import { useState, useMemo, useEffect } from 'react';
import { STUDENTS } from './data.js';
import {
  EVENTS, EXAMS, TOTAL_CREDITS, CPI_MAX, SUBJECTS, SCALE, GRADE_COLOR,
  round, gradeFor, PLACEMENT, DIPLOMA, mean, quantile, pctBelow, rankOf,
  eventResult, creditState, sumMarks, partialMarks, compute,
  pctColor, pctPillCls, DEFAULT_CFG, statusOf, statusCls, evColor
} from './model.js';

/* ---------- small UI ---------- */
const Chip=({g})=> g? <span className="chip" style={{background:GRADE_COLOR[g]}}>{g}</span> : <span className="notfilled">—</span>;

function StatCard({label,value,unit,color,meta,badge,badgeCls}){
  return (
    <div className="card pad">
      <div className="lbl">{label}</div>
      <div className={"statnum "+(color||"")}>{value}{unit&&<small> {unit}</small>}</div>
      <div className="statmeta">{meta}</div>
      {badge && <span className={"badge "+badgeCls}>{badge}</span>}
    </div>
  );
}

/* ---------- beeswarm ---------- */
function Swarm({values, selKey, maxVal=100, onPick}){
  const W=1000,H=250, padL=28,padR=28, base=192, R=7, GAP=2.5;
  const x=v=>padL+(v/maxVal)*(W-padL-padR);
  const vals=values.map(d=>({...d})).filter(d=>d.v!=null);
  const q={p25:quantile(vals.map(d=>d.v),.25),p50:quantile(vals.map(d=>d.v),.5),p75:quantile(vals.map(d=>d.v),.75),p90:quantile(vals.map(d=>d.v),.9)};
  const sorted=[...vals].sort((a,b)=>a.v-b.v); const placed=[];
  const minDx=R*2+GAP;
  sorted.forEach(d=>{let lvl=0;while(placed.some(p=>p.level===lvl&&Math.abs(x(p.v)-x(d.v))<minDx)){lvl++;if(lvl>80)break;} d.level=lvl; placed.push(d);});
  const sel=vals.find(d=>d.key===selKey);
  const ticks=[0,.2,.4,.6,.8,1].map(f=>round(f*maxVal,0));
  const lines=[{v:q.p25,l:"P25"},{v:q.p50,l:"median"},{v:q.p75,l:"P75"},{v:q.p90,l:"P90"}];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}} role="img" aria-label="Class distribution for the selected event">
      {lines.map((ln,i)=>(
        <g key={i}>
          <line x1={x(ln.v)} x2={x(ln.v)} y1={28} y2={base} stroke="var(--border)" strokeWidth={ln.l==="median"?2:1.4} strokeDasharray={ln.l==="median"?"":"5 5"}/>
          <text x={x(ln.v)} y={ln.l==="median"?base+22:22} textAnchor="middle" fontSize="13" fill="var(--muted)">{ln.l==="median"?"median":ln.l}</text>
          {ln.l!=="median" && <text x={x(ln.v)} y={38} textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--ink)">{round(ln.v,1)}</text>}
        </g>
      ))}
      <line x1={padL} x2={W-padR} y1={base} y2={base} stroke="var(--faint)" strokeWidth="1"/>
      {ticks.map(t=><text key={t} x={x(t)} y={base+22} textAnchor="middle" fontSize="13" fill="var(--faint)">{t}</text>)}
      <text x={W-padR} y={base+22} textAnchor="end" fontSize="12" fill="var(--faint)">out of {maxVal}</text>
      {placed.map((d,i)=> d.key!==selKey && (
        <circle key={i} cx={x(d.v)} cy={base-R-d.level*(R*2+GAP)} r={R} fill="var(--green)" opacity="0.3"
          style={{cursor:onPick?"pointer":"default"}} onClick={onPick?()=>onPick(d.key):undefined}><title>{d.name||""}</title></circle>
      ))}
      {sel && <circle cx={x(sel.v)} cy={base-R-sel.level*(R*2+GAP)} r={R+4} fill="var(--purple)"
        style={{cursor:onPick?"pointer":"default"}} onClick={onPick?()=>onPick(sel.key):undefined}><title>{sel.name||""}</title></circle>}
    </svg>
  );
}

function Sparkline({pts, color}){
  const vals=pts.filter(v=>v!=null); if(vals.length<1) return <span className="notfilled">—</span>;
  const W=70,H=22,pad=3; const lo=Math.min(...vals), hi=Math.max(...vals), span=hi-lo||1;
  const xs=pts.map((v,i)=>pad+(pts.length>1?i/(pts.length-1):0)*(W-2*pad));
  const y=v=>H-pad-((v-lo)/span)*(H-2*pad);
  let d="",started=false,lastX=0,lastY=0;
  pts.forEach((v,i)=>{ if(v==null) return; const px=xs[i],py=y(v); d+=(started?" L":"M")+px+" "+py; started=true; lastX=px; lastY=py; });
  return (<svg width={W} height={H} style={{overflow:"visible"}}>{started&&<path d={d} fill="none" stroke={color||"var(--green)"} strokeWidth="1.8"/>}{started&&<circle cx={lastX} cy={lastY} r="2.6" fill={color||"var(--green)"}/>}</svg>);
}

/* ---------- percentile standing bar ---------- */
function PBar({name, value, arr}){
  if(value==null) return (
    <div className="ps-row">
      <div className="ps-head"><span className="ps-name">{name}</span><span className="notfilled">—</span></div>
      <div className="ps-bar"></div>
      <div className="ps-grad" style={{opacity:.4}}></div>
      <div className="ps-glabels">{[["P25",.25],["P50",.5],["P75",.75],["P90",.9]].map(([l],i)=><span key={i} className="ps-glabel" style={{left:(25+i*25)+"%"}}><b>—</b>{l}</span>)}</div>
    </div>
  );
  const p=pctBelow(value,arr);
  const col=pctColor(p);
  const q=[["P25",quantile(arr,.25)],["P50",quantile(arr,.5)],["P75",quantile(arr,.75)],["P90",quantile(arr,.9)]];
  return (
    <div className="ps-row">
      <div className="ps-head">
        <span className="ps-name">{name}</span>
        <span><span className="ps-val tnum" style={{color:col}}>{value.toFixed(1)}%</span><span className={"ps-pill "+pctPillCls(p)}>{"P"+p}</span></span>
      </div>
      <div className="ps-bar">
        <div className="ps-fill" style={{width:Math.min(100,value)+"%",background:col}}/>
        <div className="ps-ticks">{q.map(([l,v],i)=><div key={i} className="ps-tick" style={{left:Math.min(100,v)+"%"}}/>)}</div>
        <div className="ps-knob" style={{left:Math.min(100,value)+"%",color:col}}/>
      </div>
      <div className="ps-grad">{q.map(([l,v],i)=><div key={i} className="ps-gtick" style={{left:Math.min(100,v)+"%"}}/>)}</div>
      <div className="ps-glabels">{q.map(([l,v],i)=><span key={i} className="ps-glabel" style={{left:Math.min(100,v)+"%"}}><b className="tnum">{round(v,1)}</b>{l}</span>)}</div>
    </div>
  );
}

/* ---------- Student Overview ---------- */
function StudentOverview({all, sel, setSel, cutoff, setCutoff, cfg}){
  const me=all.find(a=>a.raw.roll===sel);
  const graded=all.filter(a=>a.complete);
  const n=graded.length;
  const arr={
    cpi:graded.map(a=>a.cpiEarned), share:graded.map(a=>a.share), marks:graded.map(a=>a.marksPct),
    build:graded.map(a=>a.buildPct).filter(v=>v!=null), credits:graded.map(a=>a.creditsEarned),
    mock:graded.map(a=>a.compPct.mock), gd:graded.map(a=>a.compPct.gd), mini:graded.map(a=>a.compPct.mini),
    b1pct:graded.map(a=>a.rows[0].pct),
  };
  const avg={cpi:round(mean(arr.cpi),2),share:round(mean(arr.share),2),marks:round(mean(arr.marks),1),credits:round(mean(arr.credits),1),
    mock:round(mean(arr.mock),1),gd:round(mean(arr.gd),1),mini:round(mean(arr.mini),1),build:round(mean(arr.build),1)};
  const cutEv=EVENTS[cutoff];

  if(!me.complete){
    return (
      <>
        <Pickers all={all} sel={sel} setSel={setSel} cutoff={cutoff} setCutoff={setCutoff}/>
        <div className="card pad" style={{marginTop:16}}>
          <h2 className="panel-title">Build 1 isn’t complete for {me.raw.name}</h2>
          <p className="section-note" style={{marginTop:8}}>The mock interview mark hasn’t been recorded, so this learner can’t be placed against the class yet.
          Group discussion ({me.raw.gd}/30) and project presentation ({me.raw.mini}/40) are in — add the mock interview to complete the event.</p>
        </div>
      </>
    );
  }
  const cpiP=pctBelow(me.cpiEarned,arr.cpi), marksP=pctBelow(me.marksPct,arr.marks), b1P=pctBelow(me.rows[0].pct,arr.b1pct);
  const cpiRank=rankOf(me.cpiEarned,arr.cpi), marksRank=rankOf(me.marksPct,arr.marks), b1Rank=rankOf(me.rows[0].pct,arr.b1pct);

  return (
    <>
      <Pickers all={all} sel={sel} setSel={setSel} cutoff={cutoff} setCutoff={setCutoff}/>

      <div className="statrow">
        <StatCard label="CPI earned" value={me.cpiEarned.toFixed(2)} unit={"/ "+me.cpiUnlocked.toFixed(2)} color="c-purple"
          meta={"possible so far · class avg "+avg.cpi.toFixed(2)} badge={"P"+cpiP+" · rank "+cpiRank+"/"+n} badgeCls={pctPillCls(cpiP)}/>
        <StatCard label="Share of unlocked CPI" value={me.share.toFixed(2)+"%"} color="c-ink"
          meta={"class avg "+avg.share.toFixed(2)+"% · lines "+cfg.placement+" / "+cfg.diploma}
          badge={statusOf(me.share,cfg)} badgeCls={statusCls(statusOf(me.share,cfg))}/>
        <StatCard label="Credits earned" value={me.creditsEarned} unit={"/ "+me.creditsUnlocked} color="c-green"
          meta={"possible so far · "+TOTAL_CREDITS+" in all · class avg "+avg.credits.toFixed(1)}
          badge={me.creditsEarned>=me.creditsUnlocked?"No backlog":"Backlog"} badgeCls={me.creditsEarned>=me.creditsUnlocked?"b-green":"b-red"}/>
        <StatCard label="Marks so far" value={me.marksPct.toFixed(1)+"%"} color="c-blue"
          meta={me.marksEarned+" of "+me.marksAvail+" marks · class avg "+avg.marks.toFixed(1)+"%"}
          badge={"P"+marksP+" · rank "+marksRank+"/"+n} badgeCls={pctPillCls(marksP)}/>
        <StatCard label="Pending events" value={me.pending} color="c-ink" meta={me.pending===0?"all marks in":"awaiting marks"}/>
      </div>

      <div className="card pad">
        <h2 className="panel-title">Where {me.raw.name.split(" ")[0]} stands — {cutEv.name}</h2>
        <p className="panel-sub">Position in the class on this event, out of 100. Dashed lines are the class percentiles.</p>
        <div className="swarm-wrap">
          <Swarm values={graded.map(a=>({key:a.raw.roll,v:a.rows[0].pct}))} selKey={sel}/>
        </div>
        <div className="swarm-foot">
          <div>
            <div style={{fontWeight:600,color:"var(--head)"}}>{me.raw.name}</div>
            <div className="statmeta" style={{marginTop:3}}>
              <b className="tnum">{me.rows[0].earned}/100</b> · {me.rows[0].pct.toFixed(1)}% · <Chip g={me.rows[0].grade}/> &nbsp;
              <span className="badge b-amber" style={{marginTop:0}}>{"P"+b1P}</span> &nbsp; scored above {b1P}% of the class
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div className="big tnum">{b1Rank}<span style={{fontSize:14,color:"var(--muted)"}}> / {n}</span></div>
            <div className="statmeta">position on {cutEv.name}</div>
          </div>
        </div>
      </div>

      <div className="pgrid">
        {/* percentile standing */}
        <div className="card pad">
          <h3 className="panel-title">Percentile standing</h3>
          <p className="panel-sub">Share of unlocked CPI · marks so far · build work · major exams — against the class.</p>
          <div className="pstand">
            <PBar name="Share of unlocked CPI" value={me.share} arr={arr.share}/>
            <PBar name="Marks so far" value={me.marksPct} arr={arr.marks}/>
            <PBar name="Build work: mock, GD, mini-project" value={me.buildPct} arr={arr.build}/>
            <PBar name="Major exams: ME1 to ME3" value={me.examPct} arr={arr.build.length?graded.map(a=>a.examPct).filter(v=>v!=null):[]}/>
          </div>
        </div>

        {/* major exam scores */}
        <div className="card pad">
          <h3 className="panel-title">Major exam scores</h3>
          <div className="examgrid">
            {EXAMS.map(ex=>{
              const r=me.rows.find(x=>x.ev.key===ex.key);
              return (
                <div className="examc" key={ex.key}>
                  <div className="en">{ex.name}</div>
                  <div className="ev">{r&&r.entered? r.pct.toFixed(0)+"%":"—"}</div>
                  <div className="es">{r&&r.entered? r.earned+" / "+r.ev.max : "not yet · wk "+ex.week}</div>
                </div>
              );
            })}
          </div>

          <h3 className="panel-title" style={{marginTop:22}}>Component trend</h3>
          <p className="panel-sub">Each component in %, event by event. Up or Down once there are enough events to compare.</p>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Component</th><th className="n">This event</th><th className="n">vs last</th><th className="n">vs last 3</th><th>Direction</th></tr></thead>
              <tbody>
                {[["Mock interview",me.compPct.mock],["Group discussion",me.compPct.gd],["Mini-project",me.compPct.mini],["Major exams",me.examPct]].map(([lab,v],i)=>(
                  <tr key={i}><td style={{fontWeight:600,color:"var(--head)"}}>{lab}</td>
                    <td className="n tnum">{v!=null? v.toFixed(1):"—"}</td><td className="n">—</td><td className="n">—</td><td className="notfilled">—</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="section-note" style={{marginTop:8}}>Trend needs at least two graded events; it fills in from Exam 1 onward.</p>
        </div>

        {/* component comparison */}
        <div className="card pad">
          <h3 className="panel-title">Component comparison</h3>
          <p className="panel-sub">Percent so far in each component, against the class average.</p>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Component</th><th className="n">Learner %</th><th className="n">Class</th><th>Gap</th><th className="n">Percentile</th></tr></thead>
              <tbody>
                {[["Mock interview",me.compPct.mock,avg.mock,arr.mock],["Group discussion",me.compPct.gd,avg.gd,arr.gd],["Mini-project",me.compPct.mini,avg.mini,arr.mini]].map(([lab,v,cl,ar],i)=>{
                  const gap=round(v-cl,1), p=pctBelow(v,ar);
                  return (<tr key={i}>
                    <td style={{fontWeight:600,color:"var(--head)"}}>{lab}</td>
                    <td className="n tnum" style={{fontWeight:700}}>{v.toFixed(1)}</td>
                    <td className="n tnum" style={{color:"var(--muted)"}}>{cl.toFixed(1)}</td>
                    <td><span className={gap>=0?"gap-pos":"gap-neg"}>{gap>=0?"+":""}{gap.toFixed(1)}</span></td>
                    <td className="n ppill">{"P"+p}</td>
                  </tr>);
                })}
                {[["Exam 1"],["Exam 2"],["Exam 3"]].map((x,i)=>(
                  <tr key={"e"+i} className="off"><td>{x[0]}</td><td className="n notfilled" colSpan="4">not yet</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* event by event */}
        <div className="card pad">
          <h3 className="panel-title">Event by event</h3>
          <p className="panel-sub">Grade, class average and running credits/CPI after each event. The highlighted row is the event you picked.</p>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Event</th><th className="n">Marks</th><th>Grade</th><th className="n">Class %</th><th>Gap</th><th className="n">Credits</th><th className="n">CPI</th></tr></thead>
              <tbody>
                {me.rows.map((r,i)=>{
                  if(!r.entered) return (<tr key={i} className="off"><td><span className="rowdot"/>{r.ev.name}</td><td className="n notfilled" colSpan="6">not yet</td></tr>);
                  const classAvg=round(mean(graded.map(a=>a.rows[i].pct)),1);
                  const gap=round(r.pct-classAvg,1);
                  const cs=creditState(r.ev.key==="build1"?me.raw:me.raw,i);
                  return (<tr key={i} className={i===cutoff?"sel":""}>
                    <td><span className={"rowdot"+(i===cutoff?" on":"")}/><b style={{color:"var(--head)"}}>{r.ev.name}</b></td>
                    <td className="n tnum">{r.earned}/{r.available}</td>
                    <td><Chip g={r.grade}/></td>
                    <td className="n tnum" style={{color:"var(--muted)"}}>{classAvg.toFixed(1)}</td>
                    <td><span className={gap>=0?"gap-pos":"gap-neg"}>{gap>=0?"+":""}{gap.toFixed(1)}</span></td>
                    <td className="n tnum">{cs.earned}/{cs.unlocked}</td>
                    <td className="n tnum c-purple" style={{fontWeight:700}}>{round(cs.cp/TOTAL_CREDITS,2).toFixed(2)}</td>
                  </tr>);
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}


function Pickers({all, sel, setSel, cutoff, setCutoff}){
  return (
    <div className="controls">
      <select value={sel} onChange={e=>setSel(Number(e.target.value))} aria-label="Learner">
        {all.map(a=><option key={a.raw.roll} value={a.raw.roll}>{a.raw.name}</option>)}
      </select>
      <select value={cutoff} onChange={e=>setCutoff(Number(e.target.value))} aria-label="Event">
        {EVENTS.map((ev,i)=><option key={ev.key} value={i} disabled={ev.key!=="build1"}>{ev.name} · Week {ev.week}{ev.key!=="build1"?" (no marks yet)":""}</option>)}
      </select>
    </div>
  );
}


/* ---------- Class Overview ---------- */
function ClassOverview({all, cutoff, setCutoff, openStudent, cfg}){
  const [sort,setSort]=useState("cpi-desc");
  const [stat,setStat]=useState("All");
  const [showComp,setShowComp]=useState(false);
  const graded=all.filter(a=>a.complete), n=graded.length;
  const incomplete=all.filter(a=>!a.complete);
  const cutEv=EVENTS[cutoff];
  const cpis=graded.map(a=>a.cpiEarned), shares=graded.map(a=>a.share), marks=graded.map(a=>a.marksPct);
  const count={Comfortable:0,"Near the 7.00 line":0,"Below the 7.00 line":0,"Below the 6.00 line":0};
  graded.forEach(a=>count[statusOf(a.share,cfg)]++);
  const below6backlog=graded.filter(a=>statusOf(a.share,cfg)==="Below the 6.00 line"&&a.creditsEarned<a.creditsUnlocked).length;
  const maxV=cutEv.type==="build"?100:cutEv.max;
  const evRows=graded.map(a=>a.selEvent).filter(r=>r&&r.entered);
  const evPcts=evRows.map(r=>r.pct), evN=evRows.length;

  const sorters={"cpi-desc":(a,b)=>b.cpiEarned-a.cpiEarned,"cpi-asc":(a,b)=>a.cpiEarned-b.cpiEarned,
    "share-desc":(a,b)=>b.share-a.share,"marks-desc":(a,b)=>b.marksPct-a.marksPct,"name":(a,b)=>a.raw.name.localeCompare(b.raw.name)};
  let rows=[...graded];
  if(stat!=="All") rows=rows.filter(a=>statusOf(a.share,cfg)===stat);
  rows.sort(sorters[sort]);

  const buildWeeks=[["build1",3],["build2",6],["build3",9],["build4",12],["build5",15]];
  const examWeeks=[["exam1",5],["exam2",10],["exam3",16],["capstone",20]];
  const weekCols=[3,5,6,9,10,12,15,16,20];
  const compMean=(key)=> { const a=graded.map(x=>x.compPct[key]).filter(v=>v!=null); return a.length?round(mean(a),1):null; };
  // component value per week (only Build 1 / W3 has component data in this dataset)
  const compByWeek=(key)=> weekCols.map(w=> w===3 ? compMean(key) : null);
  const examByWeek=()=> weekCols.map(()=>null); // no exam data yet
  const trendRows=[["Mock interview",compByWeek("mock"),"#2D7E86"],["Group discussion",compByWeek("gd"),"#2D7E86"],
    ["Mini-project",compByWeek("mini"),"#2D7E86"],["Major exams",examByWeek(),"#7C3AED"]];
  const vsLast=(pts)=>{const v=pts.filter(x=>x!=null); if(v.length<2) return null; return round(v[v.length-1]-v[v.length-2],1);};

  return (
    <>
      <div className="pagehead"><h1>Class <em>overview</em></h1><p>Full roster · CPI and share of unlocked CPI · status against the 7.00 and 6.00 lines · event results · component trends.</p></div>
      <div className="controls">
        <label className="lbl" style={{alignSelf:"center"}}>Up to event</label>
        <select value={cutoff} onChange={e=>setCutoff(Number(e.target.value))} aria-label="Up to event">
          {EVENTS.map((ev,i)=><option key={ev.key} value={i} disabled={ev.key!=="build1"}>{ev.name} · Week {ev.week}{ev.key==="build1"?" (latest)":" (no marks yet)"}</option>)}
        </select>
      </div>

      <div className="statrow">
        <StatCard label="Avg CPI earned" value={round(mean(cpis),2).toFixed(2)} color="c-purple"
          meta={"of "+graded[0].cpiUnlocked.toFixed(2)+" unlocked · high "+Math.max(...cpis).toFixed(2)+" · low "+Math.min(...cpis).toFixed(2)}/>
        <StatCard label="Avg share" value={round(mean(shares),2)+"%"} color="c-ink" meta={"median "+round(quantile(shares,.5),2)+"%"}/>
        <StatCard label="Avg marks so far" value={round(mean(marks),1)+"%"} color="c-blue"
          meta={round(mean(graded.map(a=>a.marksEarned)))+" of "+round(mean(graded.map(a=>a.marksAvail)))+" · credits "+round(mean(graded.map(a=>a.creditsEarned)),1)+"/"+TOTAL_CREDITS}/>
        <StatCard label="Comfortable" value={count.Comfortable} color="c-green"
          meta={"near 7.00: "+count["Near the 7.00 line"]+" · below 7.00: "+count["Below the 7.00 line"]}/>
        <StatCard label="Below 6.00 line" value={count["Below the 6.00 line"]} color="c-red"
          meta={"with a backlog: "+below6backlog}/>
      </div>

      <div className="card pad">
        <div className="controls" style={{margin:"0 0 6px",alignItems:"center"}}>
          <label className="lbl" style={{alignSelf:"center"}}>Sort</label>
          <select value={sort} onChange={e=>setSort(e.target.value)} style={{minWidth:170}}>
            <option value="cpi-desc">CPI high → low</option><option value="cpi-asc">CPI low → high</option>
            <option value="share-desc">Share high → low</option><option value="marks-desc">Marks high → low</option><option value="name">Name A → Z</option>
          </select>
          <label className="lbl" style={{alignSelf:"center",marginLeft:8}}>Status</label>
          <select value={stat} onChange={e=>setStat(e.target.value)} style={{minWidth:170}}>
            <option>All</option><option>Comfortable</option><option>Near the 7.00 line</option><option>Below the 7.00 line</option><option>Below the 6.00 line</option>
          </select>
          <label style={{display:"flex",gap:7,alignItems:"center",fontSize:13,color:"var(--ink)",marginLeft:8,cursor:"pointer"}}>
            <input type="checkbox" checked={showComp} onChange={e=>setShowComp(e.target.checked)}/> Show components
          </label>
          <span style={{marginLeft:"auto",color:"var(--muted)",fontSize:13}}>{rows.length} of {n} graded{incomplete.length?" · "+incomplete.length+" incomplete":""}</span>
        </div>
        <div className="tbl-wrap">
          <table style={{minWidth:showComp?900:720}}>
            <thead><tr>
              <th>#</th><th>Name</th><th className="n">CPI</th><th className="n">Share %</th><th>Status</th><th className="n">Credits</th>
              <th className="n">Marks %</th><th className="n">{cutEv.name} %</th>
              {showComp && <><th className="n">Mock</th><th className="n">GD</th><th className="n">Mini</th></>}
              <th className="n">Δ Share</th><th className="n">Pct</th>
            </tr></thead>
            <tbody>
              {rows.map((a,i)=>{
                const st=statusOf(a.share,cfg); const d=a.prevShare!=null?round(a.share-a.prevShare,2):null;
                return (
                  <tr key={a.raw.roll} onClick={()=>openStudent(a.raw.roll)} style={{cursor:"pointer"}}>
                    <td className="tnum" style={{color:"var(--muted)"}}>{i+1}</td>
                    <td style={{fontWeight:600,color:"var(--head)"}}>{a.raw.name}</td>
                    <td className="n tnum c-purple" style={{fontWeight:700}}>{a.cpiEarned.toFixed(2)}</td>
                    <td className="n tnum">{a.share.toFixed(2)}</td>
                    <td><span className={"badge "+statusCls(st)} style={{marginTop:0}}>{st}</span></td>
                    <td className="n tnum" style={{color:a.creditsEarned<a.creditsUnlocked?"var(--amber)":"var(--green-ink)",fontWeight:600}}>{a.creditsEarned}/{a.creditsUnlocked}</td>
                    <td className="n tnum">{a.marksPct.toFixed(1)}</td>
                    <td className="n tnum">{a.selEvent&&a.selEvent.entered?a.selEvent.pct.toFixed(1):"—"}</td>
                    {showComp && <><td className="n tnum">{a.compPct.mock!=null?a.compPct.mock.toFixed(0):"—"}</td><td className="n tnum">{a.compPct.gd!=null?a.compPct.gd.toFixed(0):"—"}</td><td className="n tnum">{a.compPct.mini!=null?a.compPct.mini.toFixed(0):"—"}</td></>}
                    <td className="n">{d==null?<span className="notfilled">—</span>:<span className={d>=0?"gap-pos":"gap-neg"}>{d>=0?"+":""}{d.toFixed(2)}</span>}</td>
                    <td className="n ppill">{"P"+pctBelow(a.cpiEarned,cpis)}</td>
                  </tr>
                );
              })}
              {stat==="All" && incomplete.map(a=>(
                <tr key={a.raw.roll} className="off"><td>—</td><td>{a.raw.name}</td><td className="notfilled" colSpan={showComp?11:8}>Build 1 incomplete — mock interview not recorded</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="section-note" style={{marginTop:10}}>Select a learner to open their Student Overview at the same event. Percentile is on CPI earned.</p>
      </div>

      <div className="pgrid">
        <div className="card pad">
          <h3 className="panel-title">Where everyone stands — after {cutEv.name}</h3>
          <p className="panel-sub">Each dot is a learner on {cutEv.name}, out of {maxV}. Dashed lines are the class percentiles. Tap a dot to open that learner.</p>
          <Swarm values={graded.map(a=>({key:a.raw.roll,v:a.selEvent&&a.selEvent.entered?a.selEvent.earned:null,name:a.raw.name}))} selKey={null} maxVal={maxV} onPick={openStudent}/>
        </div>
        <div className="card pad">
          <h3 className="panel-title">{cutEv.name}: the class result</h3>
          <p className="panel-sub">Week {cutEv.week} · out of {maxV} · {cutEv.credits} credits · {evN} learners with marks.</p>
          <div className="examgrid" style={{gridTemplateColumns:"1fr 1fr"}}>
            <div className="examc"><div className="en">Average</div><div className="ev">{evN?round(mean(evPcts),1)+"%":"—"}</div></div>
            <div className="examc"><div className="en">Median</div><div className="ev">{evN?round(quantile(evPcts,.5),1)+"%":"—"}</div></div>
            <div className="examc"><div className="en">Highest · lowest</div><div className="ev" style={{fontSize:18}}>{evN?Math.max(...evPcts).toFixed(1)+" · "+Math.min(...evPcts).toFixed(1):"—"}</div></div>
            <div className="examc"><div className="en">Below 50%</div><div className="ev">{evN?evPcts.filter(p=>p<50).length+" of "+evN:"—"}</div></div>
          </div>
        </div>
      </div>

      <div className="card pad" style={{marginTop:16}}>
        <h3 className="panel-title">Each event so far — class or learner?</h3>
        <p className="panel-sub">A low class average means the whole class struggled with that event.</p>
        <div className="tbl-wrap">
          <table style={{minWidth:760}}>
            <thead><tr><th>Event</th><th className="n">Week</th><th className="n">Out of</th><th className="n">Credits</th><th className="n">Class avg %</th><th className="n">Median %</th><th className="n">Highest %</th><th className="n">Lowest %</th><th className="n">Below 50%</th></tr></thead>
            <tbody>
              {EVENTS.map((ev,i)=>{
                const vals=graded.map(a=>a.rows[i]).filter(r=>r&&r.entered).map(r=>r.pct);
                const has=vals.length>0, mx=ev.type==="build"?100:ev.max;
                return (
                  <tr key={ev.key} className={has?"":"off"}>
                    <td><span className="rowdot" style={{background:evColor(ev)}}/><b style={{color:has?"var(--head)":"inherit"}}>{ev.name}</b></td>
                    <td className="n tnum">{ev.week}</td><td className="n tnum">{mx}</td><td className="n tnum">{ev.credits}</td>
                    {has?<>
                      <td className="n tnum" style={{fontWeight:700}}>{round(mean(vals),1)}</td>
                      <td className="n tnum">{round(quantile(vals,.5),1)}</td>
                      <td className="n tnum">{Math.max(...vals).toFixed(1)}</td>
                      <td className="n tnum">{Math.min(...vals).toFixed(1)}</td>
                      <td className="n tnum" style={{color:vals.filter(p=>p<50).length?"var(--red)":"var(--muted)"}}>{vals.filter(p=>p<50).length}</td>
                    </>:<td className="notfilled" colSpan="5">not yet</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card pad" style={{marginTop:16}}>
        <h3 className="panel-title">Class averages by component</h3>
        <p className="panel-sub">Class average % per component at each event. Up/Down when the latest is ≥ 3 points from the one before; otherwise Steady.</p>
        <div className="tbl-wrap">
          <table style={{minWidth:900}}>
            <thead><tr><th>Component</th>{weekCols.map(w=><th key={w} className="n">W{w}</th>)}<th>Trend</th><th className="n">vs last</th><th>Direction</th></tr></thead>
            <tbody>
              {trendRows.map(([lab,pts,col],i)=>{
                const d=vsLast(pts); const dir=d==null?null:(Math.abs(d)>=cfg.trend?(d>0?"Up":"Down"):"Steady");
                return (
                  <tr key={i}>
                    <td style={{fontWeight:600,color:"var(--head)"}}>{lab}</td>
                    {pts.map((v,j)=><td key={j} className="n tnum" style={{color:v==null?"var(--faint)":"var(--ink)"}}>{v==null?"":v.toFixed(1)}</td>)}
                    <td><Sparkline pts={pts} color={col}/></td>
                    <td className="n">{d==null?<span className="notfilled">—</span>:<span className={d>=0?"gap-pos":"gap-neg"}>{d>=0?"+":""}{d.toFixed(1)}</span>}</td>
                    <td>{dir==null?<span className="notfilled">—</span>:<span className="ppill">{dir}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="section-note" style={{marginTop:8}}>Only Build 1 (Week 3) has component marks so far, so the trend fills in from Build 2 and the exams onward.</p>
      </div>
    </>
  );
}


/* ---------- Settings ---------- */
function Settings({cfg, setCfg, cutoff, setCutoff, total, graded}){
  const [draft,setDraft]=useState(cfg);
  const [saved,setSaved]=useState(false);
  useEffect(()=>setDraft(cfg),[cfg]);
  const cutEv=EVENTS[cutoff];
  const num=(k,v)=>{setDraft(d=>({...d,[k]:v})); setSaved(false);};
  const save=()=>{ const c={placement:+draft.placement||PLACEMENT,diploma:+draft.diploma||DIPLOMA,comfort:+draft.comfort||70,trend:+draft.trend||3};
    setCfg(c); setSaved(true); setTimeout(()=>setSaved(false),1800); };
  // cumulative credits + max CPI per event
  let cum=0; const evRows=EVENTS.map(ev=>{ cum+=ev.credits; return {ev,cum,maxCpi:round(CPI_MAX*cum/TOTAL_CREDITS,2)}; });
  return (
    <>
      <div className="pagehead"><h1>Settings <em>&amp; definitions</em></h1><p>The lines, the trend band, and what students see — plus the event schedule this panel grades against.</p></div>
      <div className="settings-grid">
        <div>
          <div className="card pad">
            <div className="lbl">Data source</div>
            <div style={{marginTop:10}}>
              <div className="kv"><span className="k">Data source</span><span className="v">Live data · LMS Wk 0–3</span></div>
              <div className="kv"><span className="k">Publish mode</span><span className="v">Manual: set below</span></div>
            </div>
          </div>

          <div className="card pad" style={{marginTop:16}}>
            <div className="lbl">Currently published</div>
            <div className="bignow">{cutEv.name} · Week {cutEv.week}</div>
            <div className="statmeta">{cutoff+1} of {EVENTS.length} events · students see results up to this event</div>
          </div>

          <div className="card pad" style={{marginTop:16}}>
            <div className="lbl">Lines and trend band</div>
            <p className="panel-sub" style={{marginTop:8}}>The 7.00 and 6.00 lines are CPI 7 and 6 as a share of the CPI unlocked (7 ÷ 11, 6 ÷ 11). Changing a value updates every status and direction.</p>
            <div className="field2" style={{marginTop:14}}>
              <div><label>7.00 line (placement), %</label><input type="number" step="0.01" value={draft.placement} onChange={e=>num("placement",e.target.value)}/><div className="hint">Default {PLACEMENT}</div></div>
              <div><label>6.00 line (diploma), %</label><input type="number" step="0.01" value={draft.diploma} onChange={e=>num("diploma",e.target.value)}/><div className="hint">Default {DIPLOMA}</div></div>
            </div>
            <div className="field2">
              <div><label>Comfort buffer, %</label><input type="number" step="1" value={draft.comfort} onChange={e=>num("comfort",e.target.value)}/><div className="hint">Proposed 70 · early warning only</div></div>
              <div><label>Trend band, ± points</label><input type="number" step="1" value={draft.trend} onChange={e=>num("trend",e.target.value)}/><div className="hint">Proposed 3 · smaller moves are Steady</div></div>
            </div>
            <div className="field">
              <label>Published events</label>
              <select value={cutoff} onChange={e=>setCutoff(Number(e.target.value))} style={{minWidth:0}}>
                {EVENTS.map((ev,i)=><option key={ev.key} value={i} disabled={ev.key!=="build1"}>Up to {ev.name} (Week {ev.week}){ev.key!=="build1"?" — no marks yet":""}</option>)}
              </select>
              <div className="hint">On live data this comes from the LMS. Only Build 1 has marks so far.</div>
            </div>
            <button className={"savebtn"+(saved?" ok":"")} onClick={save}>{saved?"Saved":"Save settings"}</button>
            <div className="saved-note">Changes take effect immediately for all admin views.</div>
          </div>
        </div>

        <div className="card pad">
          <div className="tbl-wrap">
            <table style={{minWidth:720}}>
              <thead><tr><th>Event</th><th className="n">Week</th><th className="n">Marks</th><th className="n">Credits</th><th className="n">Credits possible</th><th className="n">Max CPI possible</th><th className="n">On the LMS by</th></tr></thead>
              <tbody>
                {evRows.map(({ev,cum,maxCpi})=>(
                  <tr key={ev.key}>
                    <td><span className="rowdot" style={{background:evColor(ev)}}/><b style={{color:"var(--head)"}}>{ev.name}</b></td>
                    <td className="n tnum">{ev.week}</td>
                    <td className="n tnum">{ev.type==="build"?100:ev.max}</td>
                    <td className="n tnum">{ev.credits}</td>
                    <td className="n tnum">{cum}</td>
                    <td className="n tnum c-purple" style={{fontWeight:700}}>{maxCpi.toFixed(2)}</td>
                    <td className="n" style={{color:"var(--muted)"}}>{ev.lmsBy}</td>
                  </tr>
                ))}
                <tr><td><b>Total</b></td><td></td><td className="n tnum"><b>1000</b></td><td className="n tnum"><b>33</b></td><td className="n tnum"><b>33</b></td><td className="n tnum c-purple"><b>11.00</b></td><td></td></tr>
              </tbody>
            </table>
          </div>

          <h3 className="panel-title" style={{marginTop:22}}>IITGN 11-point scale</h3>
          <p className="panel-sub">A floor counts the moment it’s reached, with no rounding up. D is the minimum pass; E and F earn no credits.</p>
          <div className="tbl-wrap"><table style={{minWidth:420}}>
            <thead><tr><th>Grade</th><th className="n">From %</th><th className="n">Point</th><th>Result</th></tr></thead>
            <tbody>{SCALE.map(r=><tr key={r.grade}><td><Chip g={r.grade}/></td><td className="n tnum">{r.from}</td><td className="n tnum">{r.point}</td><td style={{color:"var(--muted)"}}>{r.point>=4?"Pass":"Backlog"}</td></tr>)}</tbody>
          </table></div>

          <h3 className="panel-title" style={{marginTop:22}}>Data &amp; definitions</h3>
          <p className="section-note" style={{marginTop:8}}>
            Marks: Cohort 2 LMS exports, Weeks 0–3 — group discussion from Week 2 (/30), mock interview and project presentation from Week 3 (converted to mock /30 and mini-project /40). Dummy “Student 14” excluded, leaving {total} students, {graded} graded on Build 1.
            <b> CPI earned</b> = credit points ÷ 33; <b>CPI unlocked</b> = 11 × credits unlocked ÷ 33; <b>share of unlocked CPI</b> = credit points ÷ (11 × credits unlocked). The engine is ready for Exam 1 onward, including the Module 2 regrade on Exam 1 + Build 2.
          </p>
        </div>
      </div>
    </>
  );
}


/* ---------- App ---------- */
function App(){
  const [tab,setTab]=useState("student");
  const [sel,setSel]=useState(22);     // Rohit Pandey — a complete, representative record
  const [cutoff,setCutoff]=useState(0); // Build 1
  const [cfg,setCfg]=useState(DEFAULT_CFG);
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem("cpi-adm-theme")||"auto"}catch(e){return "auto"}});
  useEffect(()=>{const r=document.documentElement; theme==="auto"?r.removeAttribute("data-theme"):r.setAttribute("data-theme",theme); try{localStorage.setItem("cpi-adm-theme",theme)}catch(e){}},[theme]);
  const all=useMemo(()=>STUDENTS.map(s=>compute(s,cutoff)),[cutoff]);
  const gradedN=all.filter(a=>a.complete).length;
  const cycle=()=>setTheme(t=>t==="auto"?"light":t==="light"?"dark":"auto");
  const openStudent=(roll)=>{setSel(roll);setTab("student");window.scrollTo({top:0,behavior:"smooth"});};

  return (
    <>
      <header className="topbar"><div className="topbar-in">
        <div className="logo">Admin Panel<small>· Cohort 2</small></div>
        <nav className="nav-tabs">
          {[["student","Student Overview"],["class","Class Overview"],["settings","Settings"]].map(([k,l])=>(
            <button key={k} className="ntab" aria-current={tab===k} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </nav>
        <div className="nav-right">
          <button className="btn iconbtn" onClick={cycle} title={"Theme: "+theme} aria-label="Switch theme">{theme==="dark"?"◐":theme==="light"?"○":"◑"}</button>
          <span>Admin</span>
          <button className="btn">Sign out</button>
        </div>
      </div></header>

      <div className="banner"><div className="banner-in">
        <span className="dot-live"></span>
        <span><b>Live data · Cohort 2</b> — 39 students, marks through Week 3. Build 1 (subject M1) is graded; later events fill in as their marks arrive.</span>
      </div></div>

      <main className="wrap">
        {tab==="student" && <>
          <div className="pagehead"><h1>Student <em>overview</em></h1><p>Credits, CPI and event results up to the event you pick, against the class of 39.</p></div>
          <StudentOverview all={all} sel={sel} setSel={setSel} cutoff={cutoff} setCutoff={setCutoff} cfg={cfg}/>
        </>}
        {tab==="class" && <ClassOverview all={all} cutoff={cutoff} setCutoff={setCutoff} openStudent={openStudent} cfg={cfg}/>}
        {tab==="settings" && <Settings cfg={cfg} setCfg={setCfg} cutoff={cutoff} setCutoff={setCutoff} total={STUDENTS.length} graded={gradedN}/>}
      </main>
    </>
  );
}

export default App;
