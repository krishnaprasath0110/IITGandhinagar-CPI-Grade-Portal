// IITGN Cohort 2 — CPI model: event schedule, grade scale, and the engine.
// Pure JS, no React. Every number the UI shows is computed here.

const EVENTS=[
  {key:"build1",name:"Build 1",week:3,credits:3,type:"build",feeds:["M1"],lmsBy:"Mon 26 Oct 2026"},
  {key:"exam1",name:"Exam 1",week:5,credits:2,type:"exam",max:70,feeds:["M2"],lmsBy:"Tue 10 Nov 2026"},
  {key:"build2",name:"Build 2",week:6,credits:2,type:"build",feeds:["M2"],lmsBy:"Mon 16 Nov 2026"},
  {key:"build3",name:"Build 3",week:9,credits:4,type:"build",feeds:["M3"],lmsBy:"Mon 07 Dec 2026"},
  {key:"exam2",name:"Exam 2",week:10,credits:6,type:"exam",max:100,feeds:["M4","M5"],lmsBy:"Mon 14 Dec 2026"},
  {key:"build4",name:"Build 4",week:12,credits:3,type:"build",feeds:["M6"],lmsBy:"Mon 28 Dec 2026"},
  {key:"build5",name:"Build 5",week:15,credits:4,type:"build",feeds:["M9"],lmsBy:"Mon 18 Jan 2027"},
  {key:"exam3",name:"Exam 3",week:16,credits:6,type:"exam",max:130,feeds:["M7","M8"],lmsBy:"Mon 25 Jan 2027"},
  {key:"capstone",name:"Capstone",week:20,credits:3,type:"capstone",max:200,feeds:["M10"],lmsBy:"Sat 20 Feb 2027"},
];
const EXAMS=[{key:"exam1",name:"Exam 1",week:5},{key:"exam2",name:"Exam 2",week:10},{key:"exam3",name:"Exam 3",week:16},{key:"capstone",name:"Capstone",week:20}];
const TOTAL_CREDITS=33, CPI_MAX=11;
const SUBJECTS={M1:"Foundations of AI and Data",M2:"Applied Machine Learning",M3:"Deep Learning and Neural Networks",M4:"Natural Language Processing",M5:"Generative AI Foundations",M6:"Applied Generative AI",M7:"Production AI for Real-World Applications",M8:"Foundations of Agentic AI",M9:"Advanced Agentic AI and Multi-Agent Systems",M10:"Capstone Project"};
const SCALE=[{from:90,grade:"A+",point:11},{from:80,grade:"A",point:10},{from:75,grade:"A-",point:9},{from:70,grade:"B",point:8},{from:65,grade:"B-",point:7},{from:60,grade:"C",point:6},{from:55,grade:"C-",point:5},{from:50,grade:"D",point:4},{from:40,grade:"E",point:2},{from:0,grade:"F",point:0}];
const GRADE_COLOR={"A+":"#15724A","A":"#1C7D50","A-":"#2A8A5C","B":"#2D7E86","B-":"#3C8A8F","C":"#8C6410","C-":"#9C7416","D":"#B5641C","E":"#B23A32","F":"#9B2D28"};

const round=(x,n=2)=>Math.round(x*10**n)/10**n;
const gradeFor=p=>SCALE.find(r=>p>=r.from)||SCALE[SCALE.length-1];
const PLACEMENT=round(7/CPI_MAX*100,2), DIPLOMA=round(6/CPI_MAX*100,2);
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const quantile=(arr,q)=>{if(!arr.length)return 0;const a=[...arr].sort((x,y)=>x-y);const pos=(a.length-1)*q;const b=Math.floor(pos);const r=pos-b;return a[b+1]!==undefined?a[b]+r*(a[b+1]-a[b]):a[b];};
const pctBelow=(v,arr)=>arr.length?Math.round(100*arr.filter(x=>x<v).length/arr.length):0;
const rankOf=(v,arr)=>1+arr.filter(x=>x>v).length;

function eventResult(s,ev){
  if(ev.key==="build1"){
    if(s.mock==null||s.gd==null||s.mini==null) return {entered:false};
    const earned=s.mock+s.gd+s.mini, pct=round(earned/100*100,2), g=gradeFor(pct);
    return {entered:true,earned,available:100,pct,grade:g.grade,point:g.point};
  }
  if(ev.type==="build") return {entered:false};
  const v=s[ev.key]; if(v==null) return {entered:false};
  const pct=round(v/ev.max*100,2), g=gradeFor(pct);
  return {entered:true,earned:v,available:ev.max,pct,grade:g.grade,point:g.point};
}
function creditState(s,uptoIdx){
  const ent={}; let unlocked=0;
  for(let i=0;i<=uptoIdx;i++){const r=eventResult(s,EVENTS[i]); if(r.entered){ent[EVENTS[i].key]=r; unlocked+=EVENTS[i].credits;}}
  let cp=0,earned=0;
  Object.keys(ent).forEach(k=>{const ev=EVENTS.find(e=>e.key===k),r=ent[k]; cp+=r.point*ev.credits; if(r.point>=4) earned+=ev.credits;});
  return {cp,earned,unlocked};
}
function sumMarks(s,uptoIdx){let e=0,a=0;for(let i=0;i<=uptoIdx;i++){const r=eventResult(s,EVENTS[i]);if(r.entered){e+=r.earned;a+=r.available;}}return{e,a};}
// cumulative build-only and exam-only marks up to idx
function partialMarks(s,uptoIdx,kind){let e=0,a=0;for(let i=0;i<=uptoIdx;i++){const ev=EVENTS[i];const r=eventResult(s,ev);if(!r.entered)continue;if(kind==="build"&&ev.type==="build"){e+=r.earned;a+=r.available;}if(kind==="exam"&&(ev.type==="exam"||ev.type==="capstone")){e+=r.earned;a+=r.available;}}return a?round(e/a*100,1):null;}

function compute(s,cutoff){
  const rows=EVENTS.map((ev,i)=>{const r=eventResult(s,ev);return {ev,i,...r};});
  const upto=cutoff;
  const st=creditState(s,upto);
  const m=sumMarks(s,upto);
  const b1=eventResult(s,EVENTS[0]);
  // measures
  const share=st.unlocked?round(st.cp/(CPI_MAX*st.unlocked)*100,2):null;
  const marksPct=m.a?round(m.e/m.a*100,1):null;
  const buildPct=partialMarks(s,upto,"build");
  const examPct=partialMarks(s,upto,"exam");
  // pending = events <= cutoff lacking a grade
  let pending=0; for(let i=0;i<=upto;i++){ if(!eventResult(s,EVENTS[i]).entered) pending++; }
  // share at the previous entered event (for delta)
  let prevShare=null;
  for(let i=upto-1;i>=0;i--){ if(eventResult(s,EVENTS[i]).entered){ const ps=creditState(s,i); prevShare=ps.unlocked?round(ps.cp/(CPI_MAX*ps.unlocked)*100,2):null; break; } }
  return {
    raw:s, rows, cutoff:upto, complete:b1.entered, selEvent:rows[upto], prevShare,
    cpiEarned: round(st.cp/TOTAL_CREDITS,2),
    cpiUnlocked: round(CPI_MAX*st.unlocked/TOTAL_CREDITS,2),
    creditsEarned: st.earned, creditsUnlocked: st.unlocked, creditPoints: st.cp,
    marksEarned: m.e, marksAvail: m.a, share, marksPct, buildPct, examPct, pending,
    compPct:{mock:s.mock!=null?round(s.mock/30*100,1):null, gd:s.gd!=null?round(s.gd/30*100,1):null, mini:s.mini!=null?round(s.mini/40*100,1):null},
  };
}

// status / colour helpers
const pctColor=p=> p==null?"var(--muted)": p<40?"var(--red)": p<70?"var(--amber)":"var(--green)";
const pctPillCls=p=> p==null?"":p<40?"b-red":p<70?"b-amber":"b-green";
const DEFAULT_CFG={placement:PLACEMENT, diploma:DIPLOMA, comfort:70, trend:3};
function statusOf(share, cfg){ const c=cfg||DEFAULT_CFG; if(share==null) return null;
  if(share>=c.comfort) return "Comfortable"; if(share>=c.placement) return "Near the 7.00 line";
  if(share>=c.diploma) return "Below the 7.00 line"; return "Below the 6.00 line"; }
function statusCls(st){ return st==="Comfortable"?"b-green": st==="Below the 6.00 line"?"b-red":"b-amber"; }
const evColor=ev=> ev.type==="exam"?"#7C3AED": ev.type==="capstone"?"#16A34A":"#2D7E86";

export {
  EVENTS, EXAMS, TOTAL_CREDITS, CPI_MAX, SUBJECTS, SCALE, GRADE_COLOR,
  round, gradeFor, PLACEMENT, DIPLOMA, mean, quantile, pctBelow, rankOf,
  eventResult, creditState, sumMarks, partialMarks, compute,
  pctColor, pctPillCls, DEFAULT_CFG, statusOf, statusCls, evColor
};
