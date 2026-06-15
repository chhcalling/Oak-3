import { useState, useEffect } from "react";

// ─── SHARED DESIGN TOKENS ────────────────────────────────────────────────────
const GOLD  = "#c9a84c";
const INK   = "#1a1814";
const NAVY  = "#022351";   // matched from Oak Insight logo background
const PAPER = "#f9f6f0";
const MONO  = "'DM Mono', monospace";
const SERIF = "'EB Garamond', Georgia, serif";

// ─── PERSISTENT STORAGE HELPERS ──────────────────────────────────────────────
async function storageGet(key) {
  try {
    const result = await window.storage.get(key, true);
    return result ? JSON.parse(result.value) : null;
  } catch { return null; }
}
async function storageSet(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), true);
    return true;
  } catch { return false; }
}

const s = {
  label:   { display:"block", fontFamily:MONO, fontSize:"10px", letterSpacing:"0.12em", color:"#8a8780", marginBottom:"6px" },
  input:   { width:"100%", background:"white", border:"1px solid #ddd8ce", borderRadius:"2px", padding:"11px 14px", fontSize:"16px", fontFamily:SERIF, color:INK },
  textarea:{ width:"100%", background:"white", border:"1px solid #ddd8ce", borderRadius:"2px", padding:"11px 14px", fontSize:"15px", fontFamily:SERIF, color:INK, resize:"vertical", lineHeight:1.65 },
  select:  { width:"100%", background:"white", border:"1px solid #ddd8ce", borderRadius:"2px", padding:"11px 14px", fontSize:"15px", fontFamily:SERIF, color:INK, appearance:"none" },
  goldBtn: { background:GOLD, border:"none", color:INK, fontFamily:MONO, fontSize:"12px", letterSpacing:"0.12em", padding:"13px 28px", cursor:"pointer", borderRadius:"2px", fontWeight:500 },
  darkBtn: { background:INK, border:"none", color:"#f5f2eb", fontFamily:MONO, fontSize:"11px", letterSpacing:"0.1em", padding:"11px 22px", cursor:"pointer", borderRadius:"2px" },
  outline: { background:"transparent", border:`1px solid ${GOLD}`, color:GOLD, fontFamily:MONO, fontSize:"11px", letterSpacing:"0.1em", padding:"11px 22px", cursor:"pointer", borderRadius:"2px" },
  ghost:   { background:"transparent", border:"1px solid #ddd8ce", color:"#8a8780", fontFamily:MONO, fontSize:"11px", letterSpacing:"0.1em", padding:"11px 22px", cursor:"pointer", borderRadius:"2px" },
};

const Spinner = () => (
  <div style={{display:"flex",gap:"6px",marginTop:"20px"}}>
    {[0,1,2].map(i=><div key={i} style={{width:"6px",height:"6px",borderRadius:"50%",background:GOLD,animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite`}}/>)}
  </div>
);

const CoworkTip = ({text}) => (
  <div style={{padding:"13px 16px",background:"#f0ece3",borderRadius:"2px",borderLeft:`3px solid ${GOLD}`,marginTop:"20px"}}>
    <span style={{fontFamily:MONO,fontSize:"10px",color:"#8a8780",letterSpacing:"0.1em"}}>COWORK: </span>
    <span style={{fontSize:"13px",color:"#6b6660",fontStyle:"italic"}}>{text}</span>
  </div>
);

function callClaude(systemPrompt, userPrompt, useSearch=false) {
  return fetch("/api/messages", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514",
      max_tokens:1000,
      system:systemPrompt,
      ...(useSearch ? {tools:[{type:"web_search_20250305",name:"web_search"}]} : {}),
      messages:[{role:"user",content:userPrompt}],
    }),
  })
  .then(r=>r.json())
  .then(d=>{ if(d.error) throw new Error(d.error.type+": "+d.error.message); return d.content.filter(b=>b.type==="text").map(b=>b.text).join("\n"); });
}

// ─── SYSTEM PROMPTS ──────────────────────────────────────────────────────────
const OAK_CONTEXT = `Oak Insight is a boutique public affairs consultancy founded by Gawain Towler and Chris Heaton-Harris, with Kirsty Walmsley. Chris Heaton-Harris is a former Cabinet Minister and elected Reform UK Party Board member. Gawain Towler serves on the Reform UK Party Board, was Head of Press for Reform UK, and Director of Communications for the Brexit Party. Oak Insight offers unparalleled insider intelligence on Reform UK's direction, priorities, and personnel, specialising in helping organisations navigate political risk and opportunity from Reform UK's growing influence.`;

const SP_QUALIFY = `You are the Oak Insight lead qualification engine. ${OAK_CONTEXT}

Produce a structured lead qualification brief covering:
1. COMPANY OVERVIEW — sector, size, public sector exposure, recent news
2. REFORM COUNCIL FOOTPRINT — specific councils, contracts at stake
3. PUBLIC SECTOR CONTRACT EXPOSURE — dependence, materiality of political risk
4. DECISION-MAKER IDENTIFICATION — who to approach, name and title
5. POLITICAL RISK RATING — 1 to 5 scale with one-paragraph justification
6. PROCUREMENT CYCLE & TIMING — upcoming windows, optimal contact moment
7. RECOMMENDED APPROACH ANGLE — framing, entry point, Reform policy references

TONE: Professional, direct, politically informed. Internal Oak Insight use. No hedging, no padding. Under 800 words.`;

const SP_OUTREACH = `You are the Oak Insight outreach letter drafting engine. ${OAK_CONTEXT}

Produce a bespoke outreach letter: 300–400 words. First person from the named sender. Direct, assured — one senior professional to another. Open on a specific political observation, never "I am writing to...". Establish Oak Insight's Reform UK insider advantage in one paragraph. Close with a precise low-friction ask. Add a PS where there is a sharp additional hook.

Return exactly:
SUBJECT LINE: [line]
SALUTATION: [Dear X,]
BODY:
[body]
SIGN-OFF:
[sign-off and name]
PS: [if applicable]
---
DRAFTING NOTES
[why this angle, alternatives, follow-up timing]`;

const SP_BRIEFING = `You are the Oak Insight briefing production engine. ${OAK_CONTEXT}

Produce a structured briefing document of the requested type. Always reference Reform UK's known policy positions specifically. Name councils, figures, contracts. No management consultancy language. End with concrete next steps. Mark CONFIDENTIAL — OAK INSIGHT at the top.

Types:
INTELLIGENCE BRIEFING: Executive Summary, Political Landscape, Reform UK Position, Sector Implications, Risk Assessment, Opportunities, Recommended Actions. 600–900 words.
STRATEGIC ADVISORY NOTE: Current Situation, Key Developments, Our Assessment, Recommended Next Steps, Watch Points. 500–700 words.
PUBLIC AFFAIRS CAMPAIGN BRIEF: Objective, Political Context, Key Stakeholders, Reform UK Angle, Messaging Framework, Engagement Plan, Timeline, Success Metrics. 700–1000 words.
SECTOR REPORT: Executive Summary, Sector Overview, Reform UK Policy Position, Implications, Reform Council Impact, Risks and Opportunities, Oak Insight Assessment, Next Steps. 800–1100 words.

After the briefing add: PRODUCTION NOTES — word count, suggested distribution, recommended follow-on product.`;

const SP_MONITOR = `You are the Oak Insight political monitoring engine. ${OAK_CONTEXT}

Produce a political monitoring digest covering:
REFORM UK UPDATE — internal direction, policy, personnel, electoral news. Be specific.
COUNCIL WATCH — Reform-controlled councils: procurement decisions, contract changes, notable actions.
PARLIAMENTARY MONITOR — relevant committee activity, debates, secondary legislation.
SECTOR ALERTS — one paragraph per flagged sector, only if genuinely noteworthy.
CLIENT RELEVANCE FLAGS — which digest items matter most to named clients and why.
OPPORTUNITY SIGNALS — what creates an opening for Oak Insight right now.
THIS WEEK'S WATCH POINTS — three to five things to monitor in the next seven to fourteen days.

TONE: Internal. Crisp. Politically literate. No explaining the obvious. 700–1000 words total.`;

const SP_TENDER_SCAN = `You are the Oak Insight Tender Scout engine. ${OAK_CONTEXT}

THE 24 REFORM UK COUNCILS (as of mid-2026 — update from search if needed):
Stoke-on-Trent, Hartlepool, Durham, Hull, Doncaster, Barnsley, Rotherham, Sheffield (partial), Bolton, Bury, Wigan, Oldham, Rochdale, Salford, Tameside, Trafford, Stockport, Sefton, Knowsley, Wirral, St Helens, Halton, Warrington, and any additional councils where Reform holds the executive or a controlling position following 2025/2026 local elections.

YOUR TASK — PHASE 1: TENDER SCAN
Search Find a Tender (find-a-tender.service.gov.uk) and any other relevant procurement sources for active or recently published tenders issued by these Reform UK councils. Focus on contracts over £25k. Return results in this format:

TENDER FINDINGS
---
For each tender found:
TENDER: [title]
COUNCIL: [issuing council]
VALUE: [estimated value or range]
DEADLINE: [closing date if available]
SECTOR: [e.g. waste management, facilities management, IT, social care]
SUMMARY: [2-3 sentences on what is being procured]
REFORM ANGLE: [1-2 sentences on why this tender is politically significant given Reform's known policy priorities — procurement reform, value for money, reducing quango dependency, etc.]
---

If no active tenders are found for specific councils, note which councils were checked and report any recently awarded contracts as intelligence on procurement patterns.

YOUR TASK — PHASE 2: COMPANY IDENTIFICATION
For each tender found, identify 3-5 companies that:
a) Have previously won similar contracts with local authorities, OR
b) Have the sector expertise and scale to credibly bid, OR
c) Are incumbent contractors whose contract is at risk under Reform leadership

For each company return:
COMPANY: [name]
RELEVANCE: [why they are relevant to this tender]
PRIOR CONTRACTS: [any known similar contracts, briefly]
DECISION-MAKER: [most likely contact — name and title if findable]
OAK INSIGHT ANGLE: [your assessment of whether the pitch should emphasise risk (what they stand to lose under Reform), opportunity (how Oak Insight helps them win), or insider access (Reform council relationships) — choose the most persuasive angle for THIS company given the specific tender context and their position]
EMAIL READY: YES

TONE: Intelligence-led. Specific. Name companies, name contracts, name people. This is actionable lead generation, not general research.`;

const SP_TENDER_EMAIL = `You are the Oak Insight outreach email drafting engine, writing specifically in response to a tender opportunity identified by the Tender Scout. ${OAK_CONTEXT}

CONTEXT: A Reform UK council has published a tender. The target company either holds a similar contract, is likely to bid, or is an incumbent at risk. Oak Insight's value is insider access to Reform UK decision-makers and intelligence on how Reform councils are approaching procurement.

PITCH EMAIL RULES:
- 250-320 words. Tight. Busy people do not read long emails.
- Subject line that references the specific tender or council — not generic.
- Open on the specific tender or council development. Never "I am writing to..."
- One paragraph establishing Oak Insight's Reform UK insider position. This is the differentiator: Gawain Towler on the Reform UK Party Board, Chris Heaton-Harris a former Cabinet Minister and Reform UK board member. We know how Reform councils think, what they want, and who makes the decisions.
- Make the pitch angle match the company's position: if they are an incumbent at risk, lead on risk intelligence; if they are bidding for new business, lead on winning intelligence; if the council is a new Reform administration, lead on the navigation opportunity.
- Close with a specific ask: a 20-minute call, a brief meeting. A date or timeframe if possible.
- PS: one sharp additional hook — a specific Reform council figure, a policy position, an upcoming decision that makes the timing acute.

Return exactly:
SUBJECT: [subject line]
---
[email body including salutation, body paragraphs, sign-off, and PS]
---
PITCH RATIONALE: [2-3 sentences on why this angle was chosen over alternatives]`;

// ─── RISK COLOURS ────────────────────────────────────────────────────────────
const RC = {
  1:{bg:"#e8f5e9",bd:"#43a047",tx:"#1b5e20",label:"Minimal"},
  2:{bg:"#e3f2fd",bd:"#1e88e5",tx:"#0d47a1",label:"Low"},
  3:{bg:"#fff8e1",bd:"#f9a825",tx:"#e65100",label:"Moderate"},
  4:{bg:"#fff3e0",bd:"#ef6c00",tx:"#bf360c",label:"Significant"},
  5:{bg:"#fce4ec",bd:"#c62828",tx:"#7f0000",label:"Critical"},
};

function extractRisk(text) {
  const m = text.match(/political risk rating[\s\S]*?([1-5])[\/\s]?(?:out of|\/)?5/i)
    || text.match(/rating[:\s]+([1-5])/i)
    || text.match(/\b([1-5])\s*=\s*(minimal|low|moderate|significant|critical)/i);
  if (m) { const n=parseInt(m[1]); if(n>=1&&n<=5) return n; }
  for (const line of text.split('\n')) {
    if (/political risk rating/i.test(line)) { const m2=line.match(/([1-5])/); if(m2) return parseInt(m2[1]); }
  }
  return null;
}

function parseSections(text, defs) {
  const result = {};
  for (let i=0;i<defs.length;i++) {
    const {key,pat} = defs[i];
    const nextPat = defs[i+1]?.pat;
    const start = text.search(pat);
    if (start===-1){result[key]="";continue;}
    const cs = text.indexOf('\n',start)+1;
    const end = nextPat ? text.search(nextPat) : text.length;
    result[key] = text.slice(cs, end===-1?text.length:end).trim();
  }
  return result;
}

// ─── TOOL: QUALIFIER ─────────────────────────────────────────────────────────
function Qualifier({onHandoff}) {
  const [inp,setInp] = useState({company:"",contact:"",trigger:"",notes:""});
  const [step,setStep] = useState("input");
  const [brief,setBrief] = useState(null);
  const [raw,setRaw] = useState("");
  const [copied,setCopied] = useState(false);
  const hc = f => e => setInp(p=>({...p,[f]:e.target.value}));

  const run = async () => {
    if(!inp.company.trim()) return;
    setStep("loading");
    try {
      let p=`Produce a full Oak Insight lead qualification brief.\nCOMPANY: ${inp.company}\n`;
      if(inp.contact) p+=`SPECIFIC CONTACT: ${inp.contact}\n`;
      if(inp.trigger) p+=`TRIGGER: ${inp.trigger}\n`;
      if(inp.notes) p+=`ADDITIONAL CONTEXT: ${inp.notes}\n`;
      p+="\nUse web search. Produce the full brief now.";
      const text = await callClaude(SP_QUALIFY, p, true);
      setRaw(text);
      const defs=[
        {key:"overview",pat:/1\.\s*COMPANY OVERVIEW/i},
        {key:"reform",pat:/2\.\s*REFORM COUNCIL FOOTPRINT/i},
        {key:"contracts",pat:/3\.\s*PUBLIC SECTOR CONTRACT EXPOSURE/i},
        {key:"contacts",pat:/4\.\s*DECISION-MAKER IDENTIFICATION/i},
        {key:"risk",pat:/5\.\s*POLITICAL RISK RATING/i},
        {key:"procurement",pat:/6\.\s*PROCUREMENT CYCLE/i},
        {key:"approach",pat:/7\.\s*RECOMMENDED APPROACH ANGLE/i},
      ];
      setBrief({sections:parseSections(text,defs), risk:extractRisk(text), company:inp.company, contact:inp.contact, date:new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})});
      setStep("result");
    } catch { setStep("input"); }
  };

  const SECTIONS=[
    {key:"overview",title:"Company Overview"},
    {key:"reform",title:"Reform Council Footprint"},
    {key:"contracts",title:"Public Sector Contract Exposure"},
    {key:"contacts",title:"Decision-Maker Identification"},
    {key:"risk",title:"Political Risk Rating"},
    {key:"procurement",title:"Procurement Cycle & Timing"},
    {key:"approach",title:"Recommended Approach Angle"},
  ];

  if(step==="input") return (
    <div style={{animation:"fadeIn 0.4s ease"}}>
      <p style={{color:"#6b6660",fontSize:"15px",fontStyle:"italic",lineHeight:1.6,marginBottom:"28px"}}>Enter what you know. The engine researches, scores, and returns a full qualification brief.</p>
      <div style={{marginBottom:"16px"}}><label style={s.label}>COMPANY NAME *</label><input value={inp.company} onChange={hc("company")} placeholder="e.g. Amey plc" style={s.input} onKeyDown={e=>e.key==="Enter"&&run()}/></div>
      <div style={{marginBottom:"16px"}}><label style={s.label}>SPECIFIC CONTACT (if known)</label><input value={inp.contact} onChange={hc("contact")} placeholder="e.g. Sarah Jennings, Head of Public Affairs" style={s.input}/></div>
      <div style={{marginBottom:"16px"}}><label style={s.label}>TRIGGER — NEWS ITEM, TENDER, OR EVENT</label><textarea value={inp.trigger} onChange={hc("trigger")} placeholder="e.g. Lost £40m waste contract in a Reform council last week..." rows={3} style={s.textarea}/></div>
      <div style={{marginBottom:"28px"}}><label style={s.label}>ADDITIONAL CONTEXT</label><textarea value={inp.notes} onChange={hc("notes")} placeholder="Existing relationships, network connections via Gawain or Chris..." rows={2} style={s.textarea}/></div>
      <button onClick={run} disabled={!inp.company.trim()} style={{...s.goldBtn,opacity:inp.company.trim()?1:0.5}}>QUALIFY LEAD →</button>
    </div>
  );

  if(step==="loading") return (
    <div style={{padding:"28px",background:"white",border:"1px solid #e8e4dc",borderLeft:`3px solid ${GOLD}`,borderRadius:"2px"}}>
      <div style={{fontFamily:MONO,fontSize:"11px",color:"#8a8780",marginBottom:"10px"}}>RESEARCHING</div>
      <div style={{color:"#4a4740",fontSize:"16px",fontStyle:"italic",lineHeight:1.7}}>Searching for public sector exposure, Reform council footprint, and decision-maker intelligence for {inp.company}...</div>
      <Spinner/>
    </div>
  );

  if(step==="result"&&brief) return (
    <div style={{animation:"fadeIn 0.5s ease"}}>
      <div style={{borderBottom:`2px solid ${INK}`,paddingBottom:"14px",marginBottom:"24px",display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:"12px"}}>
        <div>
          <div style={{fontFamily:MONO,fontSize:"10px",letterSpacing:"0.15em",color:"#8a8780",marginBottom:"4px"}}>CONFIDENTIAL BRIEF</div>
          <h3 style={{fontSize:"22px",fontWeight:500,color:INK,margin:0}}>{brief.company}</h3>
          {brief.contact&&<div style={{color:"#6b6660",fontSize:"13px",fontStyle:"italic",marginTop:"3px"}}>re: {brief.contact}</div>}
          <div style={{fontFamily:MONO,fontSize:"11px",color:"#b0aa9f",marginTop:"5px"}}>{brief.date}</div>
        </div>
        {brief.risk&&<div style={{background:RC[brief.risk].bg,border:`1.5px solid ${RC[brief.risk].bd}`,borderRadius:"3px",padding:"10px 16px",textAlign:"center"}}>
          <div style={{fontFamily:MONO,fontSize:"9px",letterSpacing:"0.15em",color:RC[brief.risk].tx,marginBottom:"3px"}}>RISK</div>
          <div style={{fontSize:"26px",fontWeight:600,color:RC[brief.risk].tx,lineHeight:1}}>{brief.risk}<span style={{fontSize:"13px",fontWeight:400}}>/5</span></div>
          <div style={{fontFamily:MONO,fontSize:"10px",color:RC[brief.risk].tx,marginTop:"2px"}}>{RC[brief.risk].label}</div>
        </div>}
      </div>
      {SECTIONS.map(({key,title})=>brief.sections[key]?(
        <div key={key} style={{marginBottom:"22px",paddingBottom:"22px",borderBottom:"1px solid #e8e4dc"}}>
          <div style={{fontFamily:MONO,fontSize:"10px",letterSpacing:"0.14em",color:GOLD,marginBottom:"7px"}}>{title.toUpperCase()}</div>
          <div style={{color:"#2a2620",fontSize:"15px",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{brief.sections[key]}</div>
        </div>
      ):null)}
      <div style={{display:"flex",gap:"10px",flexWrap:"wrap",marginTop:"8px"}}>
        <button onClick={()=>{navigator.clipboard.writeText(raw);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={s.darkBtn}>{copied?"COPIED ✓":"COPY BRIEF"}</button>
        <button onClick={()=>onHandoff&&onHandoff({company:brief.company,contact:brief.contact,briefSummary:raw})} style={{...s.goldBtn,padding:"11px 22px",fontSize:"11px"}}>DRAFT LETTER →</button>
        <button onClick={()=>{setStep("input");setBrief(null);}} style={s.ghost}>NEW BRIEF</button>
      </div>
      <CoworkTip text={`Save the Oak Insight brief for ${brief.company} to the Leads folder in Google Drive.`}/>
    </div>
  );
}

// ─── TOOL: OUTREACH ──────────────────────────────────────────────────────────
const SENDERS=[
  {name:"Gawain Towler",title:"Co-founder",bio:"Former Head of Press, Reform UK; Director of Communications, Brexit Party; elected Reform UK Party Board member"},
  {name:"Chris Heaton-Harris",title:"Co-founder",bio:"Former Cabinet Minister (Secretary of State for Northern Ireland); elected Reform UK Party Board member"},
  {name:"Kirsty Walmsley",title:"Director",bio:"Oak Insight operations and client management lead"},
];

function parseLetter(text) {
  return {
    subject: text.match(/SUBJECT LINE:\s*(.+)/i)?.[1]?.trim()||"",
    salutation: text.match(/SALUTATION:\s*(.+)/i)?.[1]?.trim()||"",
    body: text.match(/BODY:\s*([\s\S]*?)(?=SIGN-OFF:|$)/i)?.[1]?.trim()||"",
    signoff: text.match(/SIGN-OFF:\s*([\s\S]*?)(?=PS:|---|DRAFTING NOTES|$)/i)?.[1]?.trim()||"",
    ps: text.match(/PS:\s*([\s\S]*?)(?=---|DRAFTING NOTES|$)/i)?.[1]?.trim()||"",
    notes: text.match(/DRAFTING NOTES\s*([\s\S]*?)$/i)?.[1]?.trim()||"",
  };
}

function Outreach({prefill}) {
  const [inp,setInp] = useState({company:prefill?.company||"",contact:prefill?.contact||"",role:"",sector:"",riskRating:"",reformExposure:"",triggerContext:"",sender:"Gawain Towler",tone:"direct",briefSummary:prefill?.briefSummary||""});
  const [step,setStep] = useState("input");
  const [letter,setLetter] = useState(null);
  const [raw,setRaw] = useState("");
  const [tab,setTab] = useState("letter");
  const [copied,setCopied] = useState(false);
  const [error,setError] = useState(null);
  const hc = f => e => setInp(p=>({...p,[f]:e.target.value}));

  const run = async () => {
    if(!inp.company.trim()) return;
    setStep("loading");
    setError(null);
    const sender = SENDERS.find(s=>s.name===inp.sender);
    let p=`Draft an outreach letter from ${inp.sender} (${sender.bio}) on behalf of Oak Insight.\nTARGET COMPANY: ${inp.company}\n`;
    if(inp.contact) p+=`RECIPIENT: ${inp.contact}${inp.role?`, ${inp.role}`:""}\n`;
    if(inp.sector) p+=`SECTOR: ${inp.sector}\n`;
    if(inp.riskRating) p+=`POLITICAL RISK RATING: ${inp.riskRating}/5\n`;
    if(inp.reformExposure) p+=`REFORM EXPOSURE: ${inp.reformExposure}\n`;
    if(inp.triggerContext) p+=`TRIGGER: ${inp.triggerContext}\n`;
    if(inp.briefSummary) p+=`QUALIFICATION BRIEF SUMMARY: ${inp.briefSummary}\n`;
    p+=`TONE: ${inp.tone==="direct"?"Direct and assured — peer to peer":inp.tone==="warm"?"Warm but businesslike":"Formal — first approach to a senior figure"}\nProduce the full letter and drafting notes now.`;
    try {
      const res = await fetch("/api/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system:SP_OUTREACH,
          messages:[{role:"user",content:p}],
        }),
      });
      const data = await res.json();
      if(data.error) { setError(`API error: ${data.error.type} — ${data.error.message}`); setStep("input"); return; }
      const text = data.content.filter(b=>b.type==="text").map(b=>b.text).join("\n");
      setRaw(text); setLetter(parseLetter(text)); setStep("result"); setTab("letter");
    } catch(e) { setError(`Request failed: ${e.message}`); setStep("input"); }
  };

  const copyLetter = () => {
    const full=[letter.subject?`Subject: ${letter.subject}`:"","",letter.salutation,"",letter.body,"",letter.signoff,letter.ps?`\nPS: ${letter.ps}`:""].join("\n");
    navigator.clipboard.writeText(full).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };

  if(step==="input") return (
    <div style={{animation:"fadeIn 0.4s ease"}}>
      <p style={{color:"#6b6660",fontSize:"15px",fontStyle:"italic",lineHeight:1.6,marginBottom:"24px"}}>Paste a qualification brief or fill in the fields. The engine produces a letter ready to send.</p>
      {prefill?.briefSummary&&<div style={{marginBottom:"18px",padding:"12px 14px",background:"#f0ece3",borderLeft:`3px solid ${GOLD}`,borderRadius:"2px",fontSize:"13px",color:"#6b6660",fontStyle:"italic"}}>Qualification brief loaded from qualifier ✓</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px",marginBottom:"14px"}}>
        <div><label style={s.label}>COMPANY *</label><input value={inp.company} onChange={hc("company")} placeholder="e.g. Kier Group plc" style={s.input}/></div>
        <div><label style={s.label}>SECTOR</label><input value={inp.sector} onChange={hc("sector")} placeholder="e.g. Infrastructure & FM" style={s.input}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px",marginBottom:"14px"}}>
        <div><label style={s.label}>RECIPIENT NAME</label><input value={inp.contact} onChange={hc("contact")} placeholder="e.g. Andrew Davies" style={s.input}/></div>
        <div><label style={s.label}>RECIPIENT ROLE</label><input value={inp.role} onChange={hc("role")} placeholder="e.g. Group CEO" style={s.input}/></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px",marginBottom:"14px"}}>
        <div><label style={s.label}>RISK RATING (1–5)</label>
          <select value={inp.riskRating} onChange={hc("riskRating")} style={s.select}>
            <option value="">Not set</option>
            {[1,2,3,4,5].map(n=><option key={n} value={n}>{n} — {RC[n].label}</option>)}
          </select>
        </div>
        <div><label style={s.label}>SEND FROM</label>
          <select value={inp.sender} onChange={hc("sender")} style={s.select}>
            {SENDERS.map(s=><option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{marginBottom:"14px"}}><label style={s.label}>REFORM EXPOSURE & COUNCILS</label><textarea value={inp.reformExposure} onChange={hc("reformExposure")} placeholder="e.g. Holds contracts in Stoke-on-Trent and Hartlepool..." rows={2} style={s.textarea}/></div>
      <div style={{marginBottom:"14px"}}><label style={s.label}>TRIGGER / HOOK</label><textarea value={inp.triggerContext} onChange={hc("triggerContext")} placeholder="e.g. Q3 results flagged local government uncertainty..." rows={2} style={s.textarea}/></div>
      <div style={{marginBottom:"20px"}}>
        <label style={s.label}>TONE</label>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {[{val:"direct",label:"Direct — peer to peer"},{val:"warm",label:"Warm — existing acquaintance"},{val:"formal",label:"Formal — senior first approach"}].map(t=>(
            <button key={t.val} onClick={()=>setInp(p=>({...p,tone:t.val}))} style={{fontFamily:MONO,fontSize:"11px",letterSpacing:"0.08em",padding:"7px 14px",cursor:"pointer",borderRadius:"2px",border:inp.tone===t.val?`1.5px solid ${GOLD}`:"1px solid #ddd8ce",background:inp.tone===t.val?"#fdf6e3":"white",color:inp.tone===t.val?INK:"#6b6660"}}>{t.label}</button>
          ))}
        </div>
      </div>
      {error&&<div style={{marginBottom:"14px",padding:"12px 14px",background:"#fce4ec",borderLeft:"3px solid #c62828",borderRadius:"2px",fontFamily:MONO,fontSize:"11px",color:"#b71c1c",lineHeight:1.6}}>{error}</div>}
      <button onClick={run} disabled={!inp.company.trim()} style={{...s.goldBtn,opacity:inp.company.trim()?1:0.5}}>DRAFT LETTER →</button>
    </div>
  );

  if(step==="loading") return (
    <div style={{padding:"28px",background:"white",border:"1px solid #e8e4dc",borderLeft:`3px solid ${GOLD}`,borderRadius:"2px"}}>
      <div style={{fontFamily:MONO,fontSize:"11px",color:"#8a8780",marginBottom:"10px"}}>DRAFTING</div>
      <div style={{color:"#4a4740",fontSize:"16px",fontStyle:"italic",lineHeight:1.7}}>Composing outreach letter from {inp.sender} to {inp.contact||inp.company}...</div>
      <Spinner/>
    </div>
  );

  if(step==="result"&&letter) return (
    <div style={{animation:"fadeIn 0.5s ease"}}>
      <div style={{borderBottom:`2px solid ${INK}`,paddingBottom:"12px",marginBottom:"20px"}}>
        <div style={{fontFamily:MONO,fontSize:"10px",letterSpacing:"0.15em",color:"#8a8780",marginBottom:"3px"}}>OUTREACH DRAFT</div>
        <h3 style={{fontSize:"20px",fontWeight:500,color:INK,margin:"0 0 3px"}}>{inp.company}</h3>
        <div style={{color:"#8a8780",fontSize:"13px",fontStyle:"italic"}}>from {inp.sender}</div>
        {letter.subject&&<div style={{marginTop:"8px",padding:"7px 11px",background:"#f0ece3",borderRadius:"2px",display:"inline-block"}}><span style={{fontFamily:MONO,fontSize:"10px",color:"#8a8780"}}>SUBJECT: </span><span style={{fontSize:"13px",color:"#2a2620"}}>{letter.subject}</span></div>}
      </div>
      <div style={{borderBottom:"1px solid #e8e4dc",marginBottom:"20px"}}>
        {["letter","notes"].map(t=><button key={t} onClick={()=>setTab(t)} style={{background:"transparent",border:"none",borderBottom:tab===t?`2px solid ${GOLD}`:"2px solid transparent",padding:"7px 0",marginRight:"22px",cursor:"pointer",fontFamily:MONO,fontSize:"11px",letterSpacing:"0.1em",color:tab===t?INK:"#8a8780"}}>{t==="letter"?"LETTER":"DRAFTING NOTES"}</button>)}
      </div>
      {tab==="letter"&&(
        <div>
          <div style={{background:"white",border:"1px solid #e8e4dc",borderRadius:"2px",padding:"28px 32px",marginBottom:"18px",fontSize:"15px",color:"#2a2620",lineHeight:1.85}}>
            <div style={{fontWeight:500,marginBottom:"18px"}}>{letter.salutation}</div>
            <div style={{whiteSpace:"pre-wrap",marginBottom:"20px"}}>{letter.body}</div>
            <div style={{whiteSpace:"pre-wrap"}}>{letter.signoff}</div>
            {letter.ps&&<div style={{marginTop:"20px",paddingTop:"16px",borderTop:"1px solid #e8e4dc",fontStyle:"italic"}}><strong style={{fontStyle:"normal",fontWeight:500}}>PS:</strong> {letter.ps}</div>}
          </div>
          <div style={{display:"flex",gap:"10px",flexWrap:"wrap",marginBottom:"16px"}}>
            <button onClick={copyLetter} style={s.darkBtn}>{copied?"COPIED ✓":"COPY LETTER"}</button>
            <button onClick={run} style={s.outline}>REDRAFT</button>
            <button onClick={()=>{setStep("input");setLetter(null);}} style={s.ghost}>NEW LETTER</button>
          </div>
          <CoworkTip text={`Save the Oak Insight outreach letter to ${inp.company} to the Outreach folder and open a Gmail draft addressed to ${inp.contact||"the contact"}.`}/>
        </div>
      )}
      {tab==="notes"&&<div style={{background:"white",border:"1px solid #e8e4dc",borderRadius:"2px",padding:"24px 28px",fontSize:"15px",color:"#2a2620",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{letter.notes}</div>}
    </div>
  );
}

// ─── TOOL: BRIEFING ──────────────────────────────────────────────────────────
const BTYPES=[
  {val:"intelligence",label:"Intelligence Briefing",desc:"Hakluyt-style. Single client. Confidential insider assessment."},
  {val:"advisory",label:"Strategic Advisory Note",desc:"Retained client update. Trusted adviser register."},
  {val:"campaign",label:"Public Affairs Campaign Brief",desc:"Frame a campaign or engagement programme."},
  {val:"sector",label:"Sector Report",desc:"Analytical. Multi-client or prospecting use."},
];

function parseBriefing(text) {
  const nm=text.match(/PRODUCTION NOTES[\s\S]*$/i);
  return {body:nm?text.slice(0,nm.index).trim():text.trim(), notes:nm?nm[0].replace(/PRODUCTION NOTES/i,"").trim():""};
}

function Briefing() {
  const [inp,setInp] = useState({briefingType:"intelligence",client:"",sector:"",subject:"",reformContext:"",keyDevelopments:"",clientExposure:"",additionalContext:"",urgency:"standard"});
  const [step,setStep] = useState("input");
  const [result,setResult] = useState(null);
  const [raw,setRaw] = useState("");
  const [tab,setTab] = useState("brief");
  const [copied,setCopied] = useState(false);
  const hc = f => e => setInp(p=>({...p,[f]:e.target.value}));

  const run = async () => {
    if(!inp.subject.trim()) return;
    setStep("loading");
    const type=BTYPES.find(t=>t.val===inp.briefingType);
    let p=`Produce a ${type.label} for Oak Insight.\n`;
    if(inp.client) p+=`CLIENT: ${inp.client}\n`;
    if(inp.sector) p+=`SECTOR: ${inp.sector}\n`;
    p+=`SUBJECT: ${inp.subject}\n`;
    if(inp.reformContext) p+=`REFORM UK CONTEXT: ${inp.reformContext}\n`;
    if(inp.keyDevelopments) p+=`KEY DEVELOPMENTS: ${inp.keyDevelopments}\n`;
    if(inp.clientExposure) p+=`CLIENT EXPOSURE: ${inp.clientExposure}\n`;
    if(inp.additionalContext) p+=`ADDITIONAL CONTEXT: ${inp.additionalContext}\n`;
    p+=`URGENCY: ${inp.urgency==="urgent"?"Urgent — needed today":"Standard"}\nProduce the full briefing now, then production notes.`;
    try {
      const text = await callClaude(SP_BRIEFING, p, true);
      setRaw(text); setResult({...parseBriefing(text),type:inp.briefingType,client:inp.client,subject:inp.subject,date:new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}); setStep("result"); setTab("brief");
    } catch { setStep("input"); }
  };

  if(step==="input") return (
    <div style={{animation:"fadeIn 0.4s ease"}}>
      <p style={{color:"#6b6660",fontSize:"15px",fontStyle:"italic",lineHeight:1.6,marginBottom:"24px"}}>Select briefing type, provide context, and the engine builds a complete client-ready document.</p>
      <div style={{marginBottom:"20px"}}>
        <label style={s.label}>BRIEFING TYPE</label>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
          {BTYPES.map(t=><div key={t.val} onClick={()=>setInp(p=>({...p,briefingType:t.val}))} style={{border:inp.briefingType===t.val?`1.5px solid ${GOLD}`:"1px solid #ddd8ce",borderRadius:"2px",padding:"12px 14px",cursor:"pointer",background:inp.briefingType===t.val?"#fdf6e3":"white"}}>
            <div style={{fontFamily:MONO,fontSize:"11px",fontWeight:500,color:inp.briefingType===t.val?INK:"#4a4740",marginBottom:"3px"}}>{t.label}</div>
            <div style={{fontSize:"12px",color:"#8a8780",fontStyle:"italic",lineHeight:1.4}}>{t.desc}</div>
          </div>)}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px",marginBottom:"14px"}}>
        <div><label style={s.label}>CLIENT NAME</label><input value={inp.client} onChange={hc("client")} placeholder="e.g. Sodexo UK" style={s.input}/></div>
        <div><label style={s.label}>SECTOR</label><input value={inp.sector} onChange={hc("sector")} placeholder="e.g. Facilities Management" style={s.input}/></div>
      </div>
      <div style={{marginBottom:"14px"}}><label style={s.label}>SUBJECT / FOCUS *</label><input value={inp.subject} onChange={hc("subject")} placeholder="e.g. Reform UK's procurement policy and implications for FM contractors" style={s.input}/></div>
      <div style={{marginBottom:"14px"}}><label style={s.label}>REFORM UK CONTEXT</label><textarea value={inp.reformContext} onChange={hc("reformContext")} placeholder="Relevant Reform UK policy positions, statements, council actions..." rows={2} style={s.textarea}/></div>
      <div style={{marginBottom:"14px"}}><label style={s.label}>KEY RECENT DEVELOPMENTS</label><textarea value={inp.keyDevelopments} onChange={hc("keyDevelopments")} placeholder="News items, parliamentary activity, tender notices..." rows={2} style={s.textarea}/></div>
      <div style={{marginBottom:"14px"}}><label style={s.label}>CLIENT EXPOSURE & STAKE</label><textarea value={inp.clientExposure} onChange={hc("clientExposure")} placeholder="Contract values, council relationships, regulatory exposure..." rows={2} style={s.textarea}/></div>
      <div style={{marginBottom:"20px"}}>
        <label style={s.label}>URGENCY</label>
        <div style={{display:"flex",gap:"8px"}}>
          {[{val:"standard",label:"Standard"},{val:"urgent",label:"Urgent — needed today"}].map(u=><button key={u.val} onClick={()=>setInp(p=>({...p,urgency:u.val}))} style={{fontFamily:MONO,fontSize:"11px",padding:"7px 14px",cursor:"pointer",borderRadius:"2px",border:inp.urgency===u.val?`1.5px solid ${GOLD}`:"1px solid #ddd8ce",background:inp.urgency===u.val?"#fdf6e3":"white",color:inp.urgency===u.val?INK:"#6b6660",letterSpacing:"0.08em"}}>{u.label}</button>)}
        </div>
      </div>
      <button onClick={run} disabled={!inp.subject.trim()} style={{...s.goldBtn,opacity:inp.subject.trim()?1:0.5}}>BUILD BRIEFING →</button>
    </div>
  );

  if(step==="loading") return (
    <div style={{padding:"28px",background:"white",border:"1px solid #e8e4dc",borderLeft:`3px solid ${GOLD}`,borderRadius:"2px"}}>
      <div style={{fontFamily:MONO,fontSize:"11px",color:"#8a8780",marginBottom:"10px"}}>COMPOSING</div>
      <div style={{color:"#4a4740",fontSize:"16px",fontStyle:"italic",lineHeight:1.7}}>Building {BTYPES.find(t=>t.val===inp.briefingType)?.label} on {inp.subject}...</div>
      <Spinner/>
    </div>
  );

  if(step==="result"&&result) return (
    <div style={{animation:"fadeIn 0.5s ease"}}>
      <div style={{borderBottom:`2px solid ${INK}`,paddingBottom:"12px",marginBottom:"20px"}}>
        <div style={{fontFamily:MONO,fontSize:"10px",letterSpacing:"0.15em",color:"#8a8780",marginBottom:"3px"}}>CONFIDENTIAL — {BTYPES.find(t=>t.val===result.type)?.label.toUpperCase()}</div>
        <h3 style={{fontSize:"20px",fontWeight:500,color:INK,margin:"0 0 3px"}}>{result.subject}</h3>
        {result.client&&<div style={{color:"#6b6660",fontSize:"13px",fontStyle:"italic"}}>Prepared for {result.client}</div>}
        <div style={{fontFamily:MONO,fontSize:"11px",color:"#b0aa9f",marginTop:"5px"}}>{result.date}</div>
      </div>
      <div style={{borderBottom:"1px solid #e8e4dc",marginBottom:"20px"}}>
        {["brief","notes"].map(t=><button key={t} onClick={()=>setTab(t)} style={{background:"transparent",border:"none",borderBottom:tab===t?`2px solid ${GOLD}`:"2px solid transparent",padding:"7px 0",marginRight:"22px",cursor:"pointer",fontFamily:MONO,fontSize:"11px",letterSpacing:"0.1em",color:tab===t?INK:"#8a8780"}}>{t==="brief"?"BRIEFING":"PRODUCTION NOTES"}</button>)}
      </div>
      {tab==="brief"&&<div>
        <div style={{background:"white",border:"1px solid #e8e4dc",borderRadius:"2px",padding:"28px 32px",marginBottom:"18px",fontSize:"15px",color:"#2a2620",lineHeight:1.85,whiteSpace:"pre-wrap"}}>{result.body}</div>
        <div style={{display:"flex",gap:"10px",flexWrap:"wrap",marginBottom:"16px"}}>
          <button onClick={()=>{navigator.clipboard.writeText(raw);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={s.darkBtn}>{copied?"COPIED ✓":"COPY BRIEFING"}</button>
          <button onClick={run} style={s.outline}>REDRAFT</button>
          <button onClick={()=>{setStep("input");setResult(null);}} style={s.ghost}>NEW BRIEF</button>
        </div>
        <CoworkTip text={`Save this Oak Insight briefing on ${result.subject} to the ${result.client||"Client"} folder in Google Drive as a formatted confidential document.`}/>
      </div>}
      {tab==="notes"&&<div style={{background:"white",border:"1px solid #e8e4dc",borderRadius:"2px",padding:"24px 28px",fontSize:"15px",color:"#2a2620",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result.notes}</div>}
    </div>
  );
}

// ─── TOOL: MONITOR ───────────────────────────────────────────────────────────
const ALL_SECTORS=["Public sector contracting","Facilities management","Infrastructure","Water","Energy & net zero","Digital & tech government","Legal & compliance","Education","Health & social care","Housing"];
const DIGEST_SECTIONS=[
  {key:"reform",label:"Reform UK Update",icon:"⬡",accent:GOLD},
  {key:"councils",label:"Council Watch",icon:"◈",accent:"#5a8f6a"},
  {key:"parliament",label:"Parliamentary Monitor",icon:"◇",accent:"#6b7db3"},
  {key:"sectors",label:"Sector Alerts",icon:"△",accent:"#b36b5a"},
  {key:"clients",label:"Client Relevance",icon:"◉",accent:"#7a6bb3"},
  {key:"opportunities",label:"Opportunity Signals",icon:"★",accent:GOLD},
  {key:"watchpoints",label:"Watch Points",icon:"◎",accent:"#5a8a8f"},
];

function parseDigest(text) {
  const defs=[
    {key:"reform",pat:/REFORM UK UPDATE/i},
    {key:"councils",pat:/COUNCIL WATCH/i},
    {key:"parliament",pat:/PARLIAMENTARY MONITOR/i},
    {key:"sectors",pat:/SECTOR ALERTS/i},
    {key:"clients",pat:/CLIENT RELEVANCE FLAGS/i},
    {key:"opportunities",pat:/OPPORTUNITY SIGNALS/i},
    {key:"watchpoints",pat:/THIS WEEK'S WATCH POINTS/i},
  ];
  return parseSections(text,defs);
}

function Monitor() {
  const [inp,setInp] = useState({sectors:["Public sector contracting","Facilities management"],clients:"",focusAreas:"",additionalContext:""});
  const [step,setStep] = useState("input");
  const [digest,setDigest] = useState(null);
  const [raw,setRaw] = useState("");
  const [active,setActive] = useState("reform");
  const [lastRun,setLastRun] = useState(null);
  const [copied,setCopied] = useState(false);
  const hc = f => e => setInp(p=>({...p,[f]:e.target.value}));
  const toggle = sec => setInp(p=>({...p,sectors:p.sectors.includes(sec)?p.sectors.filter(x=>x!==sec):[...p.sectors,sec]}));

  const run = async () => {
    setStep("loading");
    let p=`Produce today's Oak Insight Political Monitoring Digest.\nDATE: ${new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}\n`;
    if(inp.sectors.length) p+=`SECTORS: ${inp.sectors.join(", ")}\n`;
    if(inp.clients) p+=`CLIENTS / PROSPECTS: ${inp.clients}\n`;
    if(inp.focusAreas) p+=`SPECIFIC FOCUS: ${inp.focusAreas}\n`;
    if(inp.additionalContext) p+=`CONTEXT: ${inp.additionalContext}\n`;
    p+="\nSearch the web for current developments. Be specific, name figures and councils. Flag genuine Oak Insight opportunities.";
    try {
      const text = await callClaude(SP_MONITOR, p, true);
      setRaw(text); setDigest(parseDigest(text)); setLastRun(new Date()); setStep("result"); setActive("reform");
    } catch { setStep("input"); }
  };

  if(step==="input") return (
    <div style={{animation:"fadeIn 0.4s ease"}}>
      <p style={{color:"#6b6660",fontSize:"15px",fontStyle:"italic",lineHeight:1.6,marginBottom:"24px"}}>Configure monitoring parameters. The engine searches for current developments and returns a structured digest.</p>
      <div style={{marginBottom:"20px"}}>
        <label style={s.label}>SECTORS TO MONITOR</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:"7px"}}>
          {ALL_SECTORS.map(sec=><button key={sec} onClick={()=>toggle(sec)} style={{border:inp.sectors.includes(sec)?"none":"1px solid #ddd8ce",borderRadius:"20px",padding:"5px 12px",cursor:"pointer",fontFamily:MONO,fontSize:"11px",background:inp.sectors.includes(sec)?INK:"white",color:inp.sectors.includes(sec)?"#f5f2eb":"#6b6660",letterSpacing:"0.06em"}}>{sec}</button>)}
        </div>
      </div>
      <div style={{marginBottom:"14px"}}><label style={s.label}>CLIENTS & PROSPECTS TO CONSIDER</label><textarea value={inp.clients} onChange={hc("clients")} placeholder="e.g. Sodexo, Kier, Amey — flag digest items relevant to these organisations" rows={2} style={s.textarea}/></div>
      <div style={{marginBottom:"14px"}}><label style={s.label}>SPECIFIC FOCUS AREAS THIS WEEK</label><textarea value={inp.focusAreas} onChange={hc("focusAreas")} placeholder="e.g. Reform's net zero position ahead of the energy bill vote..." rows={2} style={s.textarea}/></div>
      <div style={{marginBottom:"24px"}}><label style={s.label}>ADDITIONAL CONTEXT</label><textarea value={inp.additionalContext} onChange={hc("additionalContext")} placeholder="Any other context..." rows={2} style={s.textarea}/></div>
      <button onClick={run} style={s.goldBtn}>RUN DIGEST →</button>
    </div>
  );

  if(step==="loading") return (
    <div style={{padding:"28px",background:"white",border:"1px solid #e8e4dc",borderLeft:`3px solid ${GOLD}`,borderRadius:"2px"}}>
      <div style={{fontFamily:MONO,fontSize:"11px",color:"#8a8780",marginBottom:"10px"}}>MONITORING</div>
      <div style={{color:"#4a4740",fontSize:"16px",fontStyle:"italic",lineHeight:1.7}}>Scanning for Reform UK developments, council activity, parliamentary business, and sector intelligence...</div>
      <Spinner/>
    </div>
  );

  if(step==="result"&&digest) return (
    <div style={{animation:"fadeIn 0.5s ease"}}>
      <div style={{borderBottom:`2px solid ${INK}`,paddingBottom:"12px",marginBottom:"20px",display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:"10px"}}>
        <div>
          <div style={{fontFamily:MONO,fontSize:"10px",letterSpacing:"0.15em",color:"#8a8780",marginBottom:"3px"}}>INTERNAL — POLITICAL MONITORING DIGEST</div>
          <h3 style={{fontSize:"18px",fontWeight:400,color:INK,margin:"0 0 3px"}}>{new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</h3>
          {lastRun&&<div style={{fontFamily:MONO,fontSize:"11px",color:"#b0aa9f"}}>Run at {lastRun.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</div>}
        </div>
        <div style={{display:"flex",gap:"8px"}}>
          <button onClick={run} style={s.goldBtn}>REFRESH ↺</button>
          <button onClick={()=>{setStep("input");setDigest(null);}} style={s.ghost}>SETTINGS</button>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"160px 1fr",gap:"20px",alignItems:"start"}}>
        <div style={{background:"white",border:"1px solid #e8e4dc",borderRadius:"2px",overflow:"hidden"}}>
          {DIGEST_SECTIONS.map(sec=>(
            <button key={sec.key} onClick={()=>setActive(sec.key)} style={{display:"block",width:"100%",background:"transparent",border:"none",borderLeft:active===sec.key?`2px solid ${GOLD}`:"2px solid transparent",padding:"10px 12px",cursor:"pointer",fontFamily:MONO,fontSize:"10px",letterSpacing:"0.08em",color:active===sec.key?INK:"#8a8780",textAlign:"left",background:active===sec.key?"#fdf6e3":"transparent",transition:"all 0.15s"}}>
              <span style={{color:sec.accent,marginRight:"6px"}}>{sec.icon}</span>{sec.label}
            </button>
          ))}
        </div>
        <div>
          {DIGEST_SECTIONS.map(sec=>active===sec.key&&(
            <div key={sec.key} style={{animation:"fadeIn 0.3s ease"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px"}}>
                <span style={{fontSize:"18px",color:sec.accent}}>{sec.icon}</span>
                <div style={{fontFamily:MONO,fontSize:"11px",letterSpacing:"0.14em",color:sec.accent}}>{sec.label.toUpperCase()}</div>
              </div>
              <div style={{background:"white",border:"1px solid #e8e4dc",borderRadius:"2px",padding:"22px 26px",fontSize:"15px",color:"#2a2620",lineHeight:1.85,whiteSpace:"pre-wrap",minHeight:"100px",marginBottom:"16px"}}>
                {digest[sec.key]||<span style={{color:"#b0aa9f",fontStyle:"italic"}}>Nothing significant this week.</span>}
              </div>
              <div style={{display:"flex",gap:"8px"}}>
                {DIGEST_SECTIONS.findIndex(m=>m.key===sec.key)>0&&<button onClick={()=>setActive(DIGEST_SECTIONS[DIGEST_SECTIONS.findIndex(m=>m.key===sec.key)-1].key)} style={{...s.ghost,padding:"7px 14px",fontSize:"10px"}}>← PREV</button>}
                {DIGEST_SECTIONS.findIndex(m=>m.key===sec.key)<DIGEST_SECTIONS.length-1&&<button onClick={()=>setActive(DIGEST_SECTIONS[DIGEST_SECTIONS.findIndex(m=>m.key===sec.key)+1].key)} style={{...s.darkBtn,padding:"7px 14px",fontSize:"10px"}}>NEXT →</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"flex",gap:"10px",marginTop:"24px",flexWrap:"wrap"}}>
        <button onClick={()=>{navigator.clipboard.writeText(raw);setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={s.darkBtn}>{copied?"COPIED ✓":"COPY FULL DIGEST"}</button>
      </div>
      <CoworkTip text="Save today's Oak Insight Political Monitoring Digest to the Intelligence folder in Google Drive and share it with Chris and Kirsty."/>
    </div>
  );
}

// ─── TOOL: TENDER SCOUT ──────────────────────────────────────────────────────
const REFORM_COUNCILS = [
  "Stoke-on-Trent","Hartlepool","Durham","Hull","Doncaster","Barnsley",
  "Rotherham","Bolton","Bury","Wigan","Oldham","Rochdale","Salford",
  "Tameside","Trafford","Stockport","Sefton","Knowsley","Wirral",
  "St Helens","Halton","Warrington","Sheffield","Middlesbrough",
];

function parseTenders(text) {
  const blocks = [];
  const tenderRe = /TENDER:\s*(.+?)(?=TENDER:|COMPANY:|$)/gis;
  const parts = text.split(/(?=TENDER:)/i).filter(p => /TENDER:/i.test(p));
  for (const part of parts) {
    const t = {
      title:    part.match(/TENDER:\s*(.+)/i)?.[1]?.trim() || "",
      council:  part.match(/COUNCIL:\s*(.+)/i)?.[1]?.trim() || "",
      value:    part.match(/VALUE:\s*(.+)/i)?.[1]?.trim() || "",
      deadline: part.match(/DEADLINE:\s*(.+)/i)?.[1]?.trim() || "",
      sector:   part.match(/SECTOR:\s*(.+)/i)?.[1]?.trim() || "",
      summary:  part.match(/SUMMARY:\s*([\s\S]+?)(?=REFORM ANGLE:|COMPANY:|TENDER:|$)/i)?.[1]?.trim() || "",
      reformAngle: part.match(/REFORM ANGLE:\s*([\s\S]+?)(?=COMPANY:|TENDER:|$)/i)?.[1]?.trim() || "",
      companies: [],
    };
    const compParts = part.split(/(?=COMPANY:)/i).filter(p => /COMPANY:/i.test(p));
    for (const cp of compParts) {
      t.companies.push({
        name:       cp.match(/COMPANY:\s*(.+)/i)?.[1]?.trim() || "",
        relevance:  cp.match(/RELEVANCE:\s*([\s\S]+?)(?=PRIOR CONTRACTS:|DECISION-MAKER:|OAK INSIGHT ANGLE:|EMAIL READY:|$)/i)?.[1]?.trim() || "",
        priorContracts: cp.match(/PRIOR CONTRACTS:\s*([\s\S]+?)(?=DECISION-MAKER:|OAK INSIGHT ANGLE:|EMAIL READY:|$)/i)?.[1]?.trim() || "",
        decisionMaker:  cp.match(/DECISION-MAKER:\s*(.+)/i)?.[1]?.trim() || "",
        angle:      cp.match(/OAK INSIGHT ANGLE:\s*([\s\S]+?)(?=EMAIL READY:|$)/i)?.[1]?.trim() || "",
      });
    }
    if (t.title) blocks.push(t);
  }
  return blocks;
}

function parseEmail(text) {
  return {
    subject:   text.match(/SUBJECT:\s*(.+)/i)?.[1]?.trim() || "",
    body:      text.match(/---\s*([\s\S]+?)---/)?.[1]?.trim() || text,
    rationale: text.match(/PITCH RATIONALE:\s*([\s\S]+?)$/i)?.[1]?.trim() || "",
  };
}

function TenderScout() {
  const [step, setStep]         = useState("input");
  const [sectors, setSectors]   = useState(["Facilities management","Infrastructure","Waste management"]);
  const [councils, setCouncils] = useState([]);
  const [focusText, setFocusText] = useState("");
  const [tenders, setTenders]   = useState([]);
  const [rawScan, setRawScan]   = useState("");
  const [selected, setSelected] = useState(null); // {tender, company}
  const [email, setEmail]       = useState(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [copied, setCopied]     = useState(false);
  const [sender, setSender]     = useState("Gawain Towler");

  const SCOUT_SECTORS = [
    "Facilities management","Infrastructure","Waste management","IT & digital",
    "Social care","Housing maintenance","Transport","Energy","Security","Catering",
  ];

  const toggleCouncil = c => setCouncils(p => p.includes(c) ? p.filter(x=>x!==c) : [...p,c]);
  const toggleSector  = s => setSectors(p => p.includes(s) ? p.filter(x=>x!==s) : [...p,s]);

  const runScan = async () => {
    setStep("scanning");
    setTenders([]); setRawScan(""); setEmail(null); setSelected(null);
    const targetCouncils = councils.length ? councils : REFORM_COUNCILS;
    let p = `Search Find a Tender (find-a-tender.service.gov.uk) for active tenders published by Reform UK-controlled councils.\n`;
    p += `COUNCILS TO FOCUS ON: ${targetCouncils.slice(0,12).join(", ")} (and any others in the Reform 24)\n`;
    if (sectors.length) p += `PRIORITY SECTORS: ${sectors.join(", ")}\n`;
    if (focusText) p += `ADDITIONAL FOCUS: ${focusText}\n`;
    p += `\nSearch thoroughly. Return all active tenders found, then for each tender identify 3-5 target companies as instructed. Be specific — name real companies and real people where possible.`;
    try {
      const text = await callClaude(SP_TENDER_SCAN, p, true);
      setRawScan(text);
      const parsed = parseTenders(text);
      setTenders(parsed.length ? parsed : [{
        title: "Scan complete — see raw results",
        council: "Multiple", value: "", deadline: "", sector: "",
        summary: text.slice(0, 400),
        reformAngle: "", companies: [],
      }]);
      setStep("results");
    } catch { setStep("input"); }
  };

  const draftEmail = async (tender, company) => {
    setSelected({tender, company});
    setEmailLoading(true);
    setEmail(null);
    let p = `Draft a pitch email from ${sender} on behalf of Oak Insight.\n\n`;
    p += `TENDER: ${tender.title}\n`;
    p += `COUNCIL: ${tender.council}\n`;
    p += `SECTOR: ${tender.sector}\n`;
    p += `TENDER SUMMARY: ${tender.summary}\n`;
    p += `REFORM ANGLE ON TENDER: ${tender.reformAngle}\n\n`;
    p += `TARGET COMPANY: ${company.name}\n`;
    p += `COMPANY RELEVANCE: ${company.relevance}\n`;
    if (company.priorContracts) p += `PRIOR CONTRACTS: ${company.priorContracts}\n`;
    if (company.decisionMaker) p += `RECIPIENT: ${company.decisionMaker}\n`;
    p += `RECOMMENDED PITCH ANGLE: ${company.angle}\n\n`;
    p += `Draft the pitch email now. Let the context determine whether to lead on risk, opportunity, or insider access — use your judgement based on everything above.`;
    try {
      const text = await callClaude(SP_TENDER_EMAIL, p);
      setEmail(parseEmail(text));
    } catch {}
    setEmailLoading(false);
  };

  const copyEmail = () => {
    if (!email) return;
    navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  // ── INPUT ──
  if (step === "input") return (
    <div style={{animation:"fadeIn 0.4s ease"}}>
      <p style={{color:"#6b6660",fontSize:"15px",fontStyle:"italic",lineHeight:1.6,marginBottom:"24px"}}>
        Searches Find a Tender for active contracts published by Reform UK-controlled councils, identifies the most relevant companies to approach, and drafts a pitch email automatically.
      </p>

      <div style={{marginBottom:"20px"}}>
        <label style={s.label}>SECTORS TO SCAN (leave all unselected to scan everything)</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:"7px"}}>
          {SCOUT_SECTORS.map(sec => (
            <button key={sec} onClick={()=>toggleSector(sec)} style={{border:sectors.includes(sec)?"none":"1px solid #ddd8ce",borderRadius:"20px",padding:"5px 12px",cursor:"pointer",fontFamily:MONO,fontSize:"11px",background:sectors.includes(sec)?INK:"white",color:sectors.includes(sec)?"#f5f2eb":"#6b6660",letterSpacing:"0.06em"}}>{sec}</button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:"20px"}}>
        <label style={s.label}>FOCUS ON SPECIFIC COUNCILS (leave blank to scan all 24)</label>
        <div style={{display:"flex",flexWrap:"wrap",gap:"7px"}}>
          {REFORM_COUNCILS.map(c => (
            <button key={c} onClick={()=>toggleCouncil(c)} style={{border:councils.includes(c)?"none":"1px solid #ddd8ce",borderRadius:"20px",padding:"4px 10px",cursor:"pointer",fontFamily:MONO,fontSize:"10px",background:councils.includes(c)?"#5a8f6a":"white",color:councils.includes(c)?"white":"#6b6660",letterSpacing:"0.05em"}}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:"24px"}}>
        <label style={s.label}>ADDITIONAL FOCUS OR CONTEXT</label>
        <textarea value={focusText} onChange={e=>setFocusText(e.target.value)} placeholder="e.g. Looking specifically for waste and FM contracts over £500k, or contracts coming up for renewal in the next 6 months..." rows={2} style={s.textarea}/>
      </div>

      <div style={{marginBottom:"28px"}}>
        <label style={s.label}>PITCH EMAILS SENT FROM</label>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          {["Gawain Towler","Chris Heaton-Harris","Kirsty Walmsley"].map(n => (
            <button key={n} onClick={()=>setSender(n)} style={{fontFamily:MONO,fontSize:"11px",letterSpacing:"0.08em",padding:"7px 14px",cursor:"pointer",borderRadius:"2px",border:sender===n?`1.5px solid ${GOLD}`:"1px solid #ddd8ce",background:sender===n?"#fdf6e3":"white",color:sender===n?INK:"#6b6660"}}>{n}</button>
          ))}
        </div>
      </div>

      <button onClick={runScan} style={s.goldBtn}>SCAN TENDERS →</button>
    </div>
  );

  // ── SCANNING ──
  if (step === "scanning") return (
    <div style={{padding:"28px",background:"white",border:"1px solid #e8e4dc",borderLeft:`3px solid ${GOLD}`,borderRadius:"2px"}}>
      <div style={{fontFamily:MONO,fontSize:"11px",color:"#8a8780",marginBottom:"10px"}}>SCANNING</div>
      <div style={{color:"#4a4740",fontSize:"16px",fontStyle:"italic",lineHeight:1.7}}>
        Searching Find a Tender for active contracts from Reform UK councils, then identifying target companies...
      </div>
      <div style={{marginTop:"16px",fontFamily:MONO,fontSize:"11px",color:"#b0aa9f"}}>This takes 30–60 seconds. The engine searches the tender database, cross-references against company intelligence, and prepares pitch targets.</div>
      <Spinner/>
    </div>
  );

  // ── RESULTS ──
  if (step === "results") return (
    <div style={{animation:"fadeIn 0.5s ease"}}>
      <div style={{borderBottom:`2px solid ${INK}`,paddingBottom:"12px",marginBottom:"24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"10px"}}>
        <div>
          <div style={{fontFamily:MONO,fontSize:"10px",letterSpacing:"0.15em",color:"#8a8780",marginBottom:"3px"}}>TENDER SCOUT — RESULTS</div>
          <h3 style={{fontSize:"20px",fontWeight:400,color:INK,margin:0}}>{tenders.length} tender{tenders.length!==1?"s":""} found across Reform UK councils</h3>
        </div>
        <button onClick={()=>setStep("input")} style={s.ghost}>NEW SCAN</button>
      </div>

      {tenders.map((tender, ti) => (
        <div key={ti} style={{marginBottom:"28px",border:"1px solid #e8e4dc",borderRadius:"3px",overflow:"hidden"}}>
          {/* Tender header */}
          <div style={{background:"#1a1814",padding:"16px 22px"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",flexWrap:"wrap"}}>
              <div>
                <div style={{fontFamily:MONO,fontSize:"10px",color:GOLD,letterSpacing:"0.12em",marginBottom:"4px"}}>{tender.council.toUpperCase()}</div>
                <div style={{fontSize:"17px",fontWeight:500,color:"#f5f2eb",lineHeight:1.3}}>{tender.title}</div>
              </div>
              <div style={{display:"flex",gap:"12px",flexWrap:"wrap"}}>
                {tender.value&&<div style={{textAlign:"right"}}><div style={{fontFamily:MONO,fontSize:"9px",color:"#6b6660",marginBottom:"2px"}}>VALUE</div><div style={{fontFamily:MONO,fontSize:"13px",color:GOLD}}>{tender.value}</div></div>}
                {tender.deadline&&<div style={{textAlign:"right"}}><div style={{fontFamily:MONO,fontSize:"9px",color:"#6b6660",marginBottom:"2px"}}>DEADLINE</div><div style={{fontFamily:MONO,fontSize:"13px",color:"#f5f2eb"}}>{tender.deadline}</div></div>}
                {tender.sector&&<div style={{background:"rgba(201,168,76,0.15)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:"20px",padding:"3px 10px",fontFamily:MONO,fontSize:"10px",color:GOLD,alignSelf:"flex-start"}}>{tender.sector}</div>}
              </div>
            </div>
          </div>

          {/* Tender detail */}
          <div style={{padding:"16px 22px",background:"#fdf9f0",borderBottom:"1px solid #e8e4dc"}}>
            {tender.summary&&<p style={{fontSize:"14px",color:"#4a4740",lineHeight:1.7,margin:"0 0 10px"}}>{tender.summary}</p>}
            {tender.reformAngle&&(
              <div style={{padding:"10px 14px",background:"#fff8e1",borderLeft:`3px solid ${GOLD}`,borderRadius:"2px"}}>
                <span style={{fontFamily:MONO,fontSize:"9px",color:"#8a6a00",letterSpacing:"0.1em"}}>REFORM ANGLE: </span>
                <span style={{fontSize:"13px",color:"#4a3800",fontStyle:"italic"}}>{tender.reformAngle}</span>
              </div>
            )}
          </div>

          {/* Company targets */}
          {tender.companies.length > 0 && (
            <div style={{padding:"16px 22px"}}>
              <div style={{fontFamily:MONO,fontSize:"10px",color:"#8a8780",letterSpacing:"0.12em",marginBottom:"12px"}}>TARGET COMPANIES</div>
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                {tender.companies.map((company, ci) => (
                  <div key={ci} style={{border:"1px solid #e8e4dc",borderRadius:"2px",padding:"14px 16px",background:"white"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",flexWrap:"wrap",marginBottom:"8px"}}>
                      <div>
                        <div style={{fontSize:"15px",fontWeight:500,color:INK,marginBottom:"3px"}}>{company.name}</div>
                        {company.decisionMaker&&<div style={{fontFamily:MONO,fontSize:"10px",color:"#8a8780"}}>Contact: {company.decisionMaker}</div>}
                      </div>
                      <button
                        onClick={()=>draftEmail(tender,company)}
                        style={{...s.goldBtn,padding:"8px 16px",fontSize:"11px",flexShrink:0}}
                      >
                        DRAFT PITCH EMAIL →
                      </button>
                    </div>
                    {company.relevance&&<p style={{fontSize:"13px",color:"#4a4740",lineHeight:1.6,margin:"0 0 6px",fontStyle:"italic"}}>{company.relevance}</p>}
                    {company.angle&&(
                      <div style={{padding:"7px 12px",background:"#f0ece3",borderRadius:"2px",borderLeft:`2px solid ${GOLD}`}}>
                        <span style={{fontFamily:MONO,fontSize:"9px",color:"#8a6a00",letterSpacing:"0.1em"}}>OAK INSIGHT ANGLE: </span>
                        <span style={{fontSize:"12px",color:"#4a4740"}}>{company.angle}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Email panel */}
      {(emailLoading || email) && selected && (
        <div style={{marginTop:"8px",border:`2px solid ${GOLD}`,borderRadius:"3px",overflow:"hidden",animation:"fadeIn 0.4s ease"}}>
          <div style={{background:GOLD,padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <span style={{fontFamily:MONO,fontSize:"10px",color:INK,letterSpacing:"0.12em",fontWeight:500}}>PITCH EMAIL — </span>
              <span style={{fontFamily:MONO,fontSize:"10px",color:"rgba(26,24,20,0.7)",letterSpacing:"0.08em"}}>{selected.company.name} / {selected.tender.council}</span>
            </div>
            {email&&<span style={{fontFamily:MONO,fontSize:"10px",color:"rgba(26,24,20,0.6)"}}>from {sender}</span>}
          </div>
          <div style={{padding:"24px 28px",background:"white"}}>
            {emailLoading&&(
              <div>
                <div style={{color:"#4a4740",fontSize:"15px",fontStyle:"italic",lineHeight:1.7}}>Drafting pitch email to {selected.company.name}...</div>
                <Spinner/>
              </div>
            )}
            {email&&!emailLoading&&(
              <div>
                {email.subject&&(
                  <div style={{marginBottom:"16px",padding:"8px 12px",background:"#f0ece3",borderRadius:"2px",display:"inline-block"}}>
                    <span style={{fontFamily:MONO,fontSize:"10px",color:"#8a8780",letterSpacing:"0.1em"}}>SUBJECT: </span>
                    <span style={{fontSize:"14px",color:INK}}>{email.subject}</span>
                  </div>
                )}
                <div style={{fontSize:"15px",color:"#2a2620",lineHeight:1.85,whiteSpace:"pre-wrap",marginBottom:"20px"}}>{email.body}</div>
                {email.rationale&&(
                  <div style={{padding:"12px 16px",background:"#f9f6f0",borderRadius:"2px",borderTop:"1px solid #e8e4dc",marginTop:"16px"}}>
                    <div style={{fontFamily:MONO,fontSize:"9px",color:"#8a8780",letterSpacing:"0.12em",marginBottom:"5px"}}>PITCH RATIONALE</div>
                    <div style={{fontSize:"13px",color:"#6b6660",fontStyle:"italic",lineHeight:1.6}}>{email.rationale}</div>
                  </div>
                )}
                <div style={{display:"flex",gap:"10px",marginTop:"18px",flexWrap:"wrap"}}>
                  <button onClick={copyEmail} style={s.darkBtn}>{copied?"COPIED ✓":"COPY EMAIL"}</button>
                  <button onClick={()=>draftEmail(selected.tender,selected.company)} style={s.outline}>REDRAFT</button>
                </div>
                <CoworkTip text={`Open a Gmail draft to ${selected.company.decisionMaker||selected.company.name} with this subject line and save a copy to the Leads folder in Google Drive under "${selected.company.name} — ${selected.tender.council} tender."`}/>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{marginTop:"24px",display:"flex",gap:"10px",flexWrap:"wrap"}}>
        <button onClick={runScan} style={s.outline}>RESCAN</button>
        <button onClick={()=>setStep("input")} style={s.ghost}>NEW SCAN</button>
      </div>
    </div>
  );
}

// ─── TOOL: COUNCIL INTELLIGENCE ──────────────────────────────────────────────
const COUNCIL_DATA = {
  majority: [
    {name:"Derbyshire",type:"County",region:"East Midlands",seats:"38/64",won:2025},
    {name:"Essex",type:"County",region:"East of England",seats:"57/74",won:2026},
    {name:"Kent",type:"County",region:"South East",seats:"47/81",won:2025},
    {name:"Lancashire",type:"County",region:"North West",seats:"44/77",won:2025},
    {name:"Lincolnshire",type:"County",region:"East Midlands",seats:"40/70",won:2025},
    {name:"Nottinghamshire",type:"County",region:"East Midlands",seats:"41/67",won:2025},
    {name:"Staffordshire",type:"County",region:"West Midlands",seats:"38/62",won:2025},
    {name:"Suffolk",type:"County",region:"East of England",seats:"45/71",won:2026},
    {name:"Barnsley",type:"Metropolitan",region:"Yorkshire",seats:"51/63",won:2026},
    {name:"Calderdale",type:"Metropolitan",region:"Yorkshire",seats:"37/51",won:2026},
    {name:"Doncaster",type:"Metropolitan",region:"Yorkshire",seats:"49/55",won:2026},
    {name:"Gateshead",type:"Metropolitan",region:"North East",seats:"44/66",won:2026},
    {name:"Sandwell",type:"Metropolitan",region:"West Midlands",seats:"47/72",won:2026},
    {name:"South Tyneside",type:"Metropolitan",region:"North East",seats:"37/54",won:2026},
    {name:"St Helens",type:"Metropolitan",region:"North West",seats:"36/48",won:2026},
    {name:"Sunderland",type:"Metropolitan",region:"North East",seats:"58/75",won:2026},
    {name:"Wakefield",type:"Metropolitan",region:"Yorkshire",seats:"58/63",won:2026},
    {name:"Walsall",type:"Metropolitan",region:"West Midlands",seats:"46/60",won:2026},
    {name:"Durham",type:"Unitary",region:"North East",seats:"55/98",won:2025},
    {name:"North Northamptonshire",type:"Unitary",region:"East Midlands",seats:"31/42",won:2025},
    {name:"Thurrock",type:"Unitary",region:"East of England",seats:"36/49",won:2026},
    {name:"West Northamptonshire",type:"Unitary",region:"East Midlands",seats:"43/57",won:2025},
    {name:"Havering",type:"London Borough",region:"London",seats:"35/54",won:2026},
    {name:"Newcastle-under-Lyme",type:"District",region:"West Midlands",seats:"29/44",won:2026},
  ],
  largest: [
    {name:"East Sussex",type:"County",region:"South East",seats:"28/49",won:2025},
    {name:"Leicestershire",type:"County",region:"East Midlands",seats:"28/55",won:2026},
    {name:"Norfolk",type:"County",region:"East of England",seats:"38/84",won:2025},
    {name:"Warwickshire",type:"County",region:"West Midlands",seats:"25/57",won:2026},
    {name:"Worcestershire",type:"County",region:"West Midlands",seats:"23/57",won:2026},
    {name:"Kirklees",type:"Metropolitan",region:"Yorkshire",seats:"33/69",won:2026},
    {name:"Isle of Wight",type:"Unitary",region:"South East",seats:"21/39",won:2025},
    {name:"Cannock Chase",type:"District",region:"West Midlands",seats:"24/41",won:2026},
  ],
};

const CONTRACTS_DB = {
  "Essex":{"high":[{contractor:"Ringway Jacobs",service:"Highways term maintenance",value:"£450m",expiry:"2028"},{contractor:"Veolia",service:"Waste management & recycling",value:"£180m",expiry:"2029"},{contractor:"Capita",service:"Revenues, benefits & customer services",value:"£95m",expiry:"2027"}]},
  "Kent":{"high":[{contractor:"Amey",service:"Highways maintenance PFI",value:"£1.2bn",expiry:"2032"},{contractor:"Veolia",service:"Waste management & recycling",value:"£220m",expiry:"2028"},{contractor:"Capita",service:"Property & facilities management",value:"£85m",expiry:"2027"}]},
  "Suffolk":{"high":[{contractor:"Milestone Infrastructure",service:"Highways maintenance",value:"£220m",expiry:"2028"},{contractor:"Suez",service:"Waste management & energy recovery",value:"£140m",expiry:"2030"},{contractor:"Capita",service:"IT & customer services",value:"£62m",expiry:"2027"}]},
  "Derbyshire":{"high":[{contractor:"Kier Group",service:"Highways maintenance",value:"£120m",expiry:"2027"},{contractor:"Virgin Care / HCRG",service:"Community health services",value:"£180m",expiry:"2028"},{contractor:"Serco",service:"Waste & recycling",value:"£40m",expiry:"2027"}]},
  "Lancashire":{"high":[{contractor:"Amey",service:"Highways maintenance",value:"£340m",expiry:"2028"},{contractor:"Capita",service:"ICT & digital services",value:"£55m",expiry:"2026"},{contractor:"Serco",service:"Adult social care",value:"£75m",expiry:"2027"}]},
  "Lincolnshire":{"high":[{contractor:"Balfour Beatty",service:"Highways maintenance",value:"£280m",expiry:"2028"},{contractor:"Veolia",service:"Waste management",value:"£95m",expiry:"2027"},{contractor:"Serco",service:"Adult social care",value:"£55m",expiry:"2026"}]},
  "Nottinghamshire":{"high":[{contractor:"Amey",service:"Highways maintenance",value:"£265m",expiry:"2027"},{contractor:"Veolia",service:"Waste & recycling",value:"£88m",expiry:"2028"},{contractor:"Capita",service:"IT & digital",value:"£48m",expiry:"2026"}]},
  "Staffordshire":{"high":[{contractor:"Kier Group",service:"Highways maintenance",value:"£190m",expiry:"2027"},{contractor:"Veolia",service:"Waste management",value:"£72m",expiry:"2028"},{contractor:"Serco",service:"Adult social care",value:"£58m",expiry:"2027"}]},
  "Doncaster":{"high":[{contractor:"Suez",service:"Waste management & EfW",value:"£180m",expiry:"2029"},{contractor:"Kier Group",service:"Highways maintenance",value:"£110m",expiry:"2028"},{contractor:"Capita",service:"IT & customer services",value:"£35m",expiry:"2027"}]},
  "Durham":{"high":[{contractor:"Suez",service:"Waste management & EfW",value:"£120m",expiry:"2027"},{contractor:"Kier Group",service:"Highways maintenance",value:"£145m",expiry:"2028"},{contractor:"Serco",service:"Leisure & cultural services",value:"£48m",expiry:"2028"}]},
  "Sunderland":{"high":[{contractor:"Kier Group",service:"Highways maintenance",value:"£105m",expiry:"2028"},{contractor:"J&B Recycling / Urbaser",service:"Waste management",value:"£95m",expiry:"2031"},{contractor:"Capita",service:"Revenues & benefits",value:"£42m",expiry:"2027"}]},
  "Wakefield":{"high":[{contractor:"Kier Group",service:"Highways maintenance",value:"£125m",expiry:"2028"},{contractor:"Veolia",service:"Waste management & EfW",value:"£88m",expiry:"2029"},{contractor:"Serco",service:"Leisure management",value:"£40m",expiry:"2027"}]},
  "Thurrock":{"high":[{contractor:"Cory Group",service:"Waste management & energy recovery",value:"£165m",expiry:"2030"},{contractor:"Kier Group",service:"Highways maintenance",value:"£88m",expiry:"2027"},{contractor:"Capita",service:"Revenues, benefits & IT",value:"£48m",expiry:"2027"}]},
  "Norfolk":{"high":[{contractor:"Kier Group",service:"Highways maintenance",value:"£240m",expiry:"2028"},{contractor:"Suez",service:"Waste & energy recovery",value:"£115m",expiry:"2029"},{contractor:"Capita",service:"IT & customer services",value:"£58m",expiry:"2027"}]},
  "East Sussex":{"high":[{contractor:"Amey",service:"Highways PFI",value:"£890m",expiry:"2033"},{contractor:"Veolia",service:"Waste management",value:"£75m",expiry:"2028"},{contractor:"Capita",service:"Revenues, benefits & IT",value:"£48m",expiry:"2027"}]},
  "Havering":{"high":[{contractor:"Amey",service:"Highways maintenance",value:"£78m",expiry:"2028"},{contractor:"Veolia",service:"Waste & recycling",value:"£55m",expiry:"2028"},{contractor:"Serco",service:"Leisure management",value:"£35m",expiry:"2027"}]},
  "Sandwell":{"high":[{contractor:"Amey",service:"Highways & infrastructure",value:"£145m",expiry:"2027"},{contractor:"Serco",service:"Leisure management",value:"£45m",expiry:"2028"},{contractor:"Veolia",service:"Waste management",value:"£78m",expiry:"2028"}]},
  "Walsall":{"high":[{contractor:"Amey",service:"Highways maintenance",value:"£110m",expiry:"2027"},{contractor:"Veolia",service:"Waste & recycling",value:"£62m",expiry:"2028"},{contractor:"Serco",service:"Leisure management",value:"£32m",expiry:"2027"}]},
  "Barnsley":{"high":[{contractor:"Kier Group",service:"Highways maintenance",value:"£95m",expiry:"2027"},{contractor:"Veolia",service:"Waste & recycling",value:"£55m",expiry:"2028"},{contractor:"Serco",service:"Leisure management",value:"£35m",expiry:"2028"}]},
  "Leicestershire":{"high":[{contractor:"Balfour Beatty",service:"Highways maintenance",value:"£195m",expiry:"2028"},{contractor:"Suez",service:"Waste management",value:"£85m",expiry:"2028"},{contractor:"Capita",service:"Revenues & IT",value:"£52m",expiry:"2027"}]},
  "Kirklees":{"high":[{contractor:"Amey",service:"Highways maintenance",value:"£138m",expiry:"2028"},{contractor:"Veolia",service:"Waste & recycling",value:"£72m",expiry:"2028"},{contractor:"Serco",service:"Leisure management",value:"£38m",expiry:"2027"}]},
  "Isle of Wight":{"high":[{contractor:"Amey",service:"Highways PFI contract",value:"£185m",expiry:"2033"},{contractor:"Veolia",service:"Waste management",value:"£32m",expiry:"2028"},{contractor:"Serco",service:"Leisure & cultural",value:"£22m",expiry:"2027"}]},
};

const EXPIRY_2026_27 = [
  {council:"Lancashire",status:"Majority",contractor:"Capita",service:"ICT & digital services",value:"£55m",expiry:"2026"},
  {council:"Lincolnshire",status:"Majority",contractor:"Serco",service:"Adult social care",value:"£55m",expiry:"2026"},
  {council:"Nottinghamshire",status:"Majority",contractor:"Capita",service:"IT & digital",value:"£48m",expiry:"2026"},
  {council:"Derbyshire",status:"Majority",contractor:"Capita",service:"Adult social care brokerage",value:"£45m",expiry:"2026"},
  {council:"Derbyshire",status:"Majority",contractor:"Amey",service:"Environmental services",value:"£35m",expiry:"2026"},
  {council:"Staffordshire",status:"Majority",contractor:"Capita",service:"Revenues & benefits",value:"£38m",expiry:"2026"},
  {council:"Norfolk",status:"Largest Party",contractor:"Capita",service:"IT & customer services",value:"£58m",expiry:"2027"},
  {council:"Thurrock",status:"Majority",contractor:"Kier Group",service:"Highways maintenance",value:"£88m",expiry:"2027"},
  {council:"Derbyshire",status:"Majority",contractor:"Kier Group",service:"Highways maintenance",value:"£120m",expiry:"2027"},
  {council:"Staffordshire",status:"Majority",contractor:"Kier Group",service:"Highways maintenance",value:"£190m",expiry:"2027"},
  {council:"Lincolnshire",status:"Majority",contractor:"Veolia",service:"Waste management",value:"£95m",expiry:"2027"},
  {council:"Durham",status:"Majority",contractor:"Suez",service:"Waste management & EfW",value:"£120m",expiry:"2027"},
  {council:"Nottinghamshire",status:"Majority",contractor:"Amey",service:"Highways maintenance",value:"£265m",expiry:"2027"},
  {council:"Warwickshire",status:"Largest Party",contractor:"Balfour Beatty",service:"Highways maintenance",value:"£175m",expiry:"2027"},
  {council:"Walsall",status:"Majority",contractor:"Amey",service:"Highways maintenance",value:"£110m",expiry:"2027"},
  {council:"Sandwell",status:"Majority",contractor:"Amey",service:"Highways & infrastructure",value:"£145m",expiry:"2027"},
];

function CouncilIntel({onOutreach}) {
  const [view,setView]       = useState("map");    // map | council | expiry | contractor
  const [filter,setFilter]   = useState("all");    // all | majority | largest
  const [search,setSearch]   = useState("");
  const [selected,setSelected] = useState(null);
  const [detailLoading,setDetailLoading] = useState(false);
  const [detail,setDetail]   = useState(null);

  const allCouncils = [
    ...COUNCIL_DATA.majority.map(c=>({...c,status:"Majority"})),
    ...COUNCIL_DATA.largest.map(c=>({...c,status:"Largest Party"})),
  ];

  const filtered = allCouncils.filter(c=>{
    if(filter==="majority" && c.status!=="Majority") return false;
    if(filter==="largest" && c.status!=="Largest Party") return false;
    if(search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.region.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const TYPE_COLORS = {
    "County":"#5a7fa0","Metropolitan":"#7a5a9a","Unitary":"#5a8f6a",
    "London Borough":"#b36b5a","District":"#8a7a40"
  };

  const loadDetail = async (council) => {
    setSelected(council);
    setView("council");
    if(CONTRACTS_DB[council.name]) { setDetail({contracts:CONTRACTS_DB[council.name].high,fromDB:true}); return; }
    setDetailLoading(true);
    setDetail(null);
    try {
      const text = await callClaude(SP_QUALIFY,
        `List the top 3 highest-value contracts at ${council.name} ${council.type} Council. For each: contractor name, service description, estimated value, contract expiry year. Be specific and brief.`, true);
      setDetail({contracts:[], raw:text, fromDB:false});
    } catch { setDetail({contracts:[], raw:"Unable to load contract detail.", fromDB:false}); }
    setDetailLoading(false);
  };

  const regions = [...new Set(allCouncils.map(c=>c.region))].sort();
  const byRegion = regions.reduce((acc,r)=>{
    acc[r] = filtered.filter(c=>c.region===r);
    return acc;
  },{});

  return (
    <div style={{animation:"fadeIn 0.4s ease"}}>
      {/* Header bar */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"20px",flexWrap:"wrap",gap:"10px"}}>
        <div>
          <div style={{fontFamily:MONO,fontSize:"10px",letterSpacing:"0.15em",color:"#8a8780",marginBottom:"3px"}}>SOURCE: POLLCHECK — UPDATED 5 JUNE 2026</div>
          <h3 style={{fontSize:"18px",fontWeight:400,color:INK,margin:0}}>32 Reform UK councils — contract exposure map</h3>
        </div>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search council or region..." style={{...s.input,width:"180px",padding:"7px 12px",fontSize:"13px"}}/>
          {["all","majority","largest"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{fontFamily:MONO,fontSize:"10px",padding:"7px 12px",cursor:"pointer",borderRadius:"2px",letterSpacing:"0.08em",border:filter===f?`1.5px solid ${GOLD}`:"1px solid #ddd8ce",background:filter===f?"#fdf6e3":"white",color:filter===f?INK:"#6b6660"}}>
              {f==="all"?"ALL 32":f==="majority"?"24 MAJORITY":"8 LARGEST PARTY"}
            </button>
          ))}
        </div>
      </div>

      {/* View tabs */}
      <div style={{borderBottom:"1px solid #e8e4dc",marginBottom:"20px"}}>
        {[{id:"map",label:"COUNCIL MAP"},{id:"expiry",label:"EXPIRY WATCH 2026–27"},{id:"contractor",label:"CONTRACTOR EXPOSURE"}].map(t=>(
          <button key={t.id} onClick={()=>{setView(t.id);setSelected(null);}} style={{background:"transparent",border:"none",borderBottom:view===t.id&&t.id!=="council"?`2px solid ${GOLD}`:"2px solid transparent",padding:"8px 0",marginRight:"22px",cursor:"pointer",fontFamily:MONO,fontSize:"11px",letterSpacing:"0.1em",color:view===t.id&&t.id!=="council"?INK:"#8a8780"}}>{t.label}</button>
        ))}
        {selected&&<button onClick={()=>{setView("council");}} style={{background:"transparent",border:"none",borderBottom:view==="council"?`2px solid ${GOLD}`:"2px solid transparent",padding:"8px 0",marginRight:"22px",cursor:"pointer",fontFamily:MONO,fontSize:"11px",letterSpacing:"0.1em",color:view==="council"?INK:"#8a8780"}}>◈ {selected.name.toUpperCase()}</button>}
      </div>

      {/* COUNCIL MAP */}
      {view==="map"&&(
        <div>
          {Object.entries(byRegion).filter(([r,cs])=>cs.length>0).map(([region,councils])=>(
            <div key={region} style={{marginBottom:"24px"}}>
              <div style={{fontFamily:MONO,fontSize:"10px",letterSpacing:"0.14em",color:"#8a8780",marginBottom:"10px",paddingBottom:"6px",borderBottom:"1px solid #f0ece3"}}>{region.toUpperCase()}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
                {councils.map(c=>(
                  <div key={c.name} onClick={()=>loadDetail(c)} style={{border:`1px solid ${TYPE_COLORS[c.type]||"#ddd"}`,borderRadius:"3px",padding:"10px 14px",cursor:"pointer",background:"white",minWidth:"160px",transition:"all 0.15s",flex:"0 0 auto"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"4px"}}>
                      <span style={{width:"8px",height:"8px",borderRadius:"50%",background:c.status==="Majority"?GOLD:"#8a8780",flexShrink:0,display:"inline-block"}}/>
                      <div style={{fontFamily:MONO,fontSize:"10px",fontWeight:500,color:INK}}>{c.name}</div>
                    </div>
                    <div style={{fontFamily:MONO,fontSize:"9px",color:TYPE_COLORS[c.type]||"#8a8780"}}>{c.type.toUpperCase()}</div>
                    <div style={{fontFamily:MONO,fontSize:"9px",color:"#8a8780",marginTop:"2px"}}>{c.seats} seats · {c.won}</div>
                    {c.status==="Largest Party"&&<div style={{fontFamily:MONO,fontSize:"8px",color:"#b36b5a",marginTop:"3px",fontStyle:"italic"}}>Largest party</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{marginTop:"16px",display:"flex",gap:"16px",flexWrap:"wrap",paddingTop:"12px",borderTop:"1px solid #e8e4dc"}}>
            {Object.entries(TYPE_COLORS).map(([type,color])=>(
              <div key={type} style={{display:"flex",alignItems:"center",gap:"6px"}}>
                <div style={{width:"10px",height:"10px",borderRadius:"2px",background:color}}/>
                <span style={{fontFamily:MONO,fontSize:"10px",color:"#8a8780"}}>{type}</span>
              </div>
            ))}
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
              <div style={{width:"8px",height:"8px",borderRadius:"50%",background:GOLD}}/>
              <span style={{fontFamily:MONO,fontSize:"10px",color:"#8a8780"}}>Majority</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
              <div style={{width:"8px",height:"8px",borderRadius:"50%",background:"#8a8780"}}/>
              <span style={{fontFamily:MONO,fontSize:"10px",color:"#8a8780"}}>Largest party</span>
            </div>
          </div>
        </div>
      )}

      {/* COUNCIL DETAIL */}
      {view==="council"&&selected&&(
        <div style={{animation:"fadeIn 0.3s ease"}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"20px",flexWrap:"wrap",gap:"12px"}}>
            <div>
              <div style={{fontFamily:MONO,fontSize:"9px",letterSpacing:"0.15em",color:"#8a8780",marginBottom:"4px"}}>{selected.type.toUpperCase()} · {selected.region.toUpperCase()}</div>
              <h3 style={{fontSize:"22px",fontWeight:500,color:INK,margin:"0 0 4px"}}>{selected.name}</h3>
              <div style={{display:"flex",gap:"12px",flexWrap:"wrap"}}>
                <span style={{fontFamily:MONO,fontSize:"11px",color:selected.status==="Majority"?GOLD:"#b36b5a"}}>{selected.status}</span>
                <span style={{fontFamily:MONO,fontSize:"11px",color:"#8a8780"}}>{selected.seats} Reform seats</span>
                <span style={{fontFamily:MONO,fontSize:"11px",color:"#8a8780"}}>Won {selected.won}</span>
              </div>
            </div>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
              <button onClick={()=>onOutreach&&onOutreach({company:selected.name+" Council",sector:"Local Government",notes:`Reform UK ${selected.status} — ${selected.seats} seats — won ${selected.won}`})} style={{...s.goldBtn,padding:"9px 18px",fontSize:"11px"}}>DRAFT OUTREACH →</button>
              <button onClick={()=>setView("map")} style={s.ghost}>← BACK TO MAP</button>
            </div>
          </div>

          <div style={{fontFamily:MONO,fontSize:"10px",letterSpacing:"0.12em",color:GOLD,marginBottom:"10px"}}>MAJOR CONTRACTS AT RISK</div>

          {detailLoading&&<div style={{padding:"20px",background:"white",border:"1px solid #e8e4dc",borderRadius:"2px"}}><div style={{color:"#4a4740",fontSize:"14px",fontStyle:"italic"}}>Loading contract intelligence...</div><Spinner/></div>}

          {detail&&detail.fromDB&&(
            <div style={{display:"flex",flexDirection:"column",gap:"10px",marginBottom:"20px"}}>
              {detail.contracts.map((c,i)=>(
                <div key={i} style={{border:"1px solid #e8e4dc",borderRadius:"2px",padding:"14px 18px",background:"white",display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:"15px",fontWeight:500,color:INK,marginBottom:"3px"}}>{c.contractor}</div>
                    <div style={{fontSize:"13px",color:"#6b6660",fontStyle:"italic"}}>{c.service}</div>
                  </div>
                  <div style={{display:"flex",gap:"16px",flexShrink:0}}>
                    <div style={{textAlign:"right"}}><div style={{fontFamily:MONO,fontSize:"9px",color:"#8a8780",marginBottom:"2px"}}>VALUE</div><div style={{fontFamily:MONO,fontSize:"13px",color:INK,fontWeight:500}}>{c.value}</div></div>
                    <div style={{textAlign:"right"}}><div style={{fontFamily:MONO,fontSize:"9px",color:"#8a8780",marginBottom:"2px"}}>EXPIRY</div><div style={{fontFamily:MONO,fontSize:"13px",color:["2026","2027"].includes(c.expiry)?"#b71c1c":INK,fontWeight:["2026","2027"].includes(c.expiry)?700:400}}>{c.expiry}</div></div>
                  </div>
                </div>
              ))}
              <div style={{padding:"10px 14px",background:"#f9f6f0",borderRadius:"2px",fontFamily:MONO,fontSize:"10px",color:"#8a8780"}}>Source: council contracts registers, Find a Tender, industry sources. Values estimated where not published. See full spreadsheet for all 10 contracts.</div>
            </div>
          )}

          {detail&&!detail.fromDB&&(
            <div style={{background:"white",border:"1px solid #e8e4dc",borderRadius:"2px",padding:"20px 24px",marginBottom:"20px",fontSize:"14px",color:"#2a2620",lineHeight:1.8,whiteSpace:"pre-wrap"}}>{detail.raw}</div>
          )}

          <CoworkTip text={`Open the Oak Insight Reform Councils spreadsheet in Google Drive and filter to ${selected.name} for the full contract list.`}/>
        </div>
      )}

      {/* EXPIRY WATCH */}
      {view==="expiry"&&(
        <div style={{animation:"fadeIn 0.3s ease"}}>
          <div style={{marginBottom:"16px",padding:"12px 16px",background:"#fce4ec",borderLeft:"3px solid #b71c1c",borderRadius:"2px"}}>
            <span style={{fontFamily:MONO,fontSize:"10px",color:"#b71c1c",letterSpacing:"0.1em"}}>PRIORITY: </span>
            <span style={{fontSize:"13px",color:"#4a1814",fontStyle:"italic"}}>{EXPIRY_2026_27.length} contracts expiring in 2026 or 2027. These are at or near procurement decision point — optimal window for Oak Insight introductions now.</span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {EXPIRY_2026_27.sort((a,b)=>a.expiry.localeCompare(b.expiry)).map((c,i)=>(
              <div key={i} style={{border:"1px solid #e8e4dc",borderRadius:"2px",padding:"12px 16px",background:"white",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",flexWrap:"wrap"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:"10px",alignItems:"baseline",flexWrap:"wrap",marginBottom:"3px"}}>
                    <span style={{fontFamily:MONO,fontSize:"11px",fontWeight:500,color:INK}}>{c.council}</span>
                    <span style={{fontFamily:MONO,fontSize:"9px",color:c.status==="Majority"?GOLD:"#8a8780"}}>{c.status.toUpperCase()}</span>
                  </div>
                  <div style={{fontSize:"13px",color:"#4a4740"}}>{c.contractor} — <span style={{fontStyle:"italic",color:"#6b6660"}}>{c.service}</span></div>
                </div>
                <div style={{display:"flex",gap:"14px",flexShrink:0,alignItems:"center"}}>
                  <div style={{textAlign:"right"}}><div style={{fontFamily:MONO,fontSize:"9px",color:"#8a8780",marginBottom:"1px"}}>VALUE</div><div style={{fontFamily:MONO,fontSize:"12px",color:INK}}>{c.value}</div></div>
                  <div style={{background:c.expiry==="2026"?"#b71c1c":"#ef6c00",borderRadius:"2px",padding:"4px 10px",fontFamily:MONO,fontSize:"11px",color:"white",fontWeight:700}}>{c.expiry}</div>
                  <button onClick={()=>{const council=allCouncils.find(a=>a.name===c.council);if(council)loadDetail(council);}} style={{...s.ghost,padding:"6px 12px",fontSize:"10px"}}>VIEW →</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CONTRACTOR EXPOSURE */}
      {view==="contractor"&&(
        <div style={{animation:"fadeIn 0.3s ease"}}>
          <div style={{marginBottom:"16px",fontFamily:MONO,fontSize:"11px",color:"#6b6660"}}>How many of the 32 Reform councils does each major contractor appear in? Click a contractor to qualify them as a lead.</div>
          {[
            {name:"Kier Group",maj:14,lp:4,services:"Highways, housing, capital works"},
            {name:"Amey",maj:12,lp:5,services:"Highways (incl. PFI), infrastructure"},
            {name:"Veolia",maj:15,lp:5,services:"Waste management & recycling"},
            {name:"Capita",maj:18,lp:7,services:"IT, revenues, benefits, FM"},
            {name:"Serco",maj:16,lp:6,services:"Leisure, social care, waste"},
            {name:"Sodexo",maj:20,lp:8,services:"Catering, FM, cleaning"},
            {name:"Mitie",maj:20,lp:8,services:"FM, building management, security"},
            {name:"Suez",maj:6,lp:3,services:"Waste, energy from waste"},
            {name:"G4S",maj:20,lp:8,services:"Security, monitoring, CCTV"},
            {name:"Morgan Sindall",maj:20,lp:8,services:"Housing, construction, capital works"},
            {name:"Balfour Beatty",maj:4,lp:3,services:"Highways maintenance"},
            {name:"NEC Software",maj:18,lp:7,services:"Benefits, revenues, housing systems"},
            {name:"Civica",maj:18,lp:7,services:"IT, digital, housing"},
            {name:"Mott MacDonald",maj:6,lp:2,services:"Engineering consultancy"},
            {name:"Norse Group",maj:8,lp:3,services:"Catering, cleaning, FM"},
          ].sort((a,b)=>(b.maj+b.lp)-(a.maj+a.lp)).map((c,i)=>{
            const total=c.maj+c.lp;
            const pct = Math.round((total/32)*100);
            return (
              <div key={c.name} style={{border:"1px solid #e8e4dc",borderRadius:"2px",padding:"12px 16px",background:i%2===0?"white":"#fdf9f0",marginBottom:"6px",display:"flex",alignItems:"center",gap:"14px",flexWrap:"wrap",cursor:"pointer"}} onClick={()=>onOutreach&&onOutreach({company:c.name,sector:"Public sector contracting",notes:`Present in ${total}/32 Reform councils. ${c.services}.`})}>
                <div style={{flex:"0 0 180px"}}>
                  <div style={{fontSize:"14px",fontWeight:500,color:INK,marginBottom:"2px"}}>{c.name}</div>
                  <div style={{fontSize:"12px",color:"#6b6660",fontStyle:"italic"}}>{c.services}</div>
                </div>
                <div style={{flex:1,minWidth:"160px"}}>
                  <div style={{height:"8px",background:"#f0ece3",borderRadius:"4px",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:total>=20?"#b71c1c":total>=12?GOLD:"#5a8f6a",borderRadius:"4px",transition:"width 0.5s ease"}}/>
                  </div>
                </div>
                <div style={{fontFamily:MONO,fontSize:"11px",color:INK,fontWeight:500,flex:"0 0 60px",textAlign:"right"}}>{total}/32</div>
                <div style={{fontFamily:MONO,fontSize:"10px",color:"#8a8780",flex:"0 0 80px"}}>{c.maj} majority<br/>{c.lp} largest</div>
                <button style={{...s.goldBtn,padding:"7px 14px",fontSize:"10px",flexShrink:0}}>QUALIFY →</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── TOOL: CRM PIPELINE ──────────────────────────────────────────────────────
// Data merged from: Oak Insight CRM history (Apr–May 2026) + OakInsight_Priority_Target_List.xlsx (Chris Heaton-Harris, June 2026)
const CRM_DATA = [
  // ── WAVE 1 — Approach Now ────────────────────────────────────────────────
  {rank:1,wave:"WAVE 1",company:"Amey",sector:"Highways / Infrastructure",exposure:"£3,260m",contact:"Rayman Bains",title:"Managing Director, Local & Regional Government",email:"rayman.bains@amey.co.uk",councils:"Kent (PFI £1.2bn), Lancashire, Nottinghamshire, East Sussex (PFI £890m), Isle of Wight (PFI £185m), Walsall, Sandwell, Worcestershire, Kirklees, Newcastle-under-Lyme",status:"Not Responded",lastContact:"Apr-26",response:"",nextAction:"Follow-up — PFI exposure (Kent £1.2bn, E.Sussex £890m, IoW £185m) is the sharpest hook. Highest single-contract values in dataset.",priority:"HIGH",notes:"No response to initial letter. Amey in 12 majority + 5 largest-party councils. PFI contracts uniquely vulnerable to Reform scrutiny.",reformCouncils:17},
  {rank:2,wave:"WAVE 1",company:"Kier Group",sector:"Highways / Construction",exposure:"£1,606m",contact:"Sophie Timms",title:"Director of Public Affairs & Sustainability",email:"sophie.timms@kier.co.uk",councils:"Norfolk, Wakefield, Barnsley, Durham, Doncaster, Lancashire, Sunderland, Staffordshire, Derbyshire, Thurrock + 3 more",status:"Warm — Follow-up sent",lastContact:"May-26",response:"No response to follow-up",nextAction:"Second follow-up — Norfolk contract now live under Reform minority administration. 13 confirmed highway contracts, several expiring 2027.",priority:"HIGH",notes:"Follow-up sent May 2026. Kier in 18 Reform councils — highest highway exposure of any contractor. Pre-procurement window open now.",reformCouncils:18},
  {rank:3,wave:"WAVE 1",company:"Capita",sector:"IT / BPO / Revenues",exposure:"£1,319m",contact:"Adolfo Hernandez",title:"CEO",email:"adolfo.hernandez@capita.com",councils:"Essex, Kent, Lancashire, Lincolnshire, Nottinghamshire, Staffordshire, Suffolk, Norfolk, Sunderland, Wakefield, Thurrock, Warwickshire + 12 more",status:"Not Responded",lastContact:"Apr-26",response:"",nextAction:"Follow-up — widest Reform council exposure of any contractor. Multiple 2026–27 expiries create urgent re-procurement conversations.",priority:"HIGH",notes:"24 Reform councils — highest footprint. Govt Affairs team already tracks political risk. 2026 expiries (Lancashire, Nottinghamshire) most urgent.",reformCouncils:24},
  {rank:4,wave:"WAVE 1",company:"Morgan Sindall",sector:"Construction / Housing",exposure:"£1,132m",contact:"Pat Boyle",title:"Managing Director, Infrastructure",email:"pat.boyle@morgansindall.com",councils:"All 24 Reform-majority councils (housing & capital works)",status:"Not Responded",lastContact:"Apr-26",response:"",nextAction:"Follow-up — broadest geographic spread in dataset. Reform's pro-housebuilding agenda is a positive pitch angle as well as a risk frame.",priority:"HIGH",notes:"No response. 2026 expiries urgent. Reform pro-housebuilding agenda means Morgan Sindall has strong reason to understand new political priorities.",reformCouncils:24},
  {rank:5,wave:"WAVE 1",company:"Serco",sector:"Leisure / Social Care",exposure:"£984m",contact:"Mark Irwin",title:"CEO",email:"mark.irwin@serco.com",councils:"Durham, Sunderland, Doncaster, Wakefield, Barnsley, Lincolnshire, St Helens, South Tyneside, Gateshead, Sandwell + 12 more",status:"Not Responded",lastContact:"Apr-26",response:"",nextAction:"Follow-up — leisure management contracts are the most politically visible target for Reform efficiency reviews. Several 2026–27 renewals.",priority:"HIGH",notes:"Serco in 22 Reform councils. CEO-level approach. Leisure contracts soft targets — Reform councils want visible efficiency savings.",reformCouncils:22},
  {rank:6,wave:"WAVE 1",company:"Ringway Jacobs",sector:"Highways",exposure:"£593m",contact:"TBC — Colas MD",title:"Managing Director",email:"",councils:"Essex (£450m — largest single contract in dataset), Gateshead, South Tyneside",status:"Not Responded",lastContact:"Apr-26",response:"",nextAction:"Follow-up — Essex (£450m) is the single largest contract in the entire dataset. Reform holds 57/74 Essex seats. Verify current MD.",priority:"HIGH",notes:"Ringway operates as Colas subsidiary. Verify current MD name before re-approaching. Essex contract alone justifies urgency.",reformCouncils:3},
  {rank:7,wave:"WAVE 1",company:"HCRG Care Group",sector:"Community Health",exposure:"£325m",contact:"TBC",title:"CEO / MD",email:"",councils:"Derbyshire (£180m), Kent (£145m)",status:"Not Contacted",lastContact:"",response:"",nextAction:"Initial pitch — Derbyshire and Kent both Reform majority. Reform health policy stance makes renewals politically complex.",priority:"HIGH",notes:"Formerly Virgin Care. Highest-value care contracts in dataset. Not previously contacted — priority given scale.",reformCouncils:2},
  // ── WAVE 2 — Approach Q3 2026 ────────────────────────────────────────────
  {rank:8,wave:"WAVE 2",company:"Veolia UK",sector:"Waste Management",exposure:"£1,176m",contact:"Louis Blake",title:"CEO, Veolia UK & Ireland",email:"louis.blake@veolia.com",councils:"Essex (£180m), Kent (£220m), Lincolnshire, Wakefield, Walsall, Sandwell, Barnsley, Calderdale, Warwickshire, Worcestershire + 4 more",status:"Not Responded",lastContact:"Apr-26",response:"",nextAction:"Follow-up — Essex (£180m) and Kent (£220m) now Reform majority. Waste policy is a Reform flashpoint.",priority:"HIGH",notes:"Previous contact Cory Reynolds left early 2025. Louis Blake is successor — verify title before sending. 14 Reform councils.",reformCouncils:14},
  {rank:9,wave:"WAVE 2",company:"Suez UK",sector:"Waste / EfW",exposure:"£747m",contact:"Dr Adam Read MBE",title:"Chief Sustainability & External Affairs Officer",email:"adam.read@suez.com",councils:"Doncaster (£180m), Durham (£120m), Norfolk, Lincolnshire, Suffolk, Sunderland, Wakefield, Barnsley, Gateshead",status:"Engaged — Gone Quiet",lastContact:"May-26",response:"Positive — meeting arranged then went quiet",nextAction:"Re-engagement — Suez now in 9 Reform councils. Sunderland, Wakefield, Barnsley, Gateshead all newly Reform-controlled since initial contact. Use expanded exposure as the hook.",priority:"HIGH",notes:"Meeting briefing (Oak_Insight_Suez_Briefing_v2.docx) and agenda already produced. EfW is politically contested — Durham Reform majority publicly scrutinised the existing arrangement.",reformCouncils:9},
  {rank:10,wave:"WAVE 2",company:"Balfour Beatty",sector:"Highways",exposure:"£735m",contact:"Leo Quinn",title:"Group CEO",email:"leo.quinn@balfourbeatty.com",councils:"Lincolnshire (£280m), Leicestershire (£195m), Warwickshire, East Sussex",status:"Not Responded",lastContact:"Apr-26",response:"",nextAction:"Follow-up — Lincolnshire (£280m) is the anchor. Infrastructure firm with clear incentive to maintain council relationships ahead of re-tender.",priority:"MEDIUM",notes:"No response. Fewer Reform exposures than Amey/Kier but Lincolnshire alone is significant.",reformCouncils:4},
  {rank:11,wave:"WAVE 2",company:"Sodexo UK",sector:"Catering / FM",exposure:"£525m",contact:"Jean Renton",title:"CEO, Sodexo UK & Ireland",email:"jean.renton@sodexo.com",councils:"21 Reform councils (catering & FM)",status:"Not Responded",lastContact:"Apr-26",response:"",nextAction:"Follow-up — school catering is politically visible. Good target for standardised offer covering multiple authorities.",priority:"MEDIUM",notes:"No response. School catering contracts politically visible. Reform administrations may wish to review publicly.",reformCouncils:21},
  {rank:12,wave:"WAVE 2",company:"Mitie",sector:"FM / Security",exposure:"£453m",contact:"Phil Bentley",title:"CEO",email:"phil.bentley@mitie.com",councils:"22 Reform councils (FM & building management)",status:"Not Responded",lastContact:"Apr-26",response:"",nextAction:"Follow-up — Reform councils reviewing outsourcing gives Mitie strong reason to engage early. 2026 expiries most urgent.",priority:"MEDIUM",notes:"Consider approaching via Public Affairs Director. FM contracts renew quietly but Reform scrutiny changes that.",reformCouncils:22},
  {rank:13,wave:"WAVE 2",company:"G4S",sector:"Security",exposure:"£281m",contact:"Tim Kendall",title:"Managing Director, G4S UK",email:"tim.kendall@g4s.com",councils:"25 Reform councils — widest footprint of any contractor",status:"Not Responded",lastContact:"Apr-26",response:"",nextAction:"Follow-up — widest council breadth of any contractor. Security & CCTV politically sensitive under Reform. 2026 expiries.",priority:"MEDIUM",notes:"Lower individual values but cumulative exposure and breadth is the pitch. Good framework agreement target.",reformCouncils:25},
  {rank:14,wave:"WAVE 2",company:"Milestone Infrastructure",sector:"Highways",exposure:"£220m",contact:"TBC",title:"Managing Director",email:"",councils:"Suffolk (£220m)",status:"Not Contacted",lastContact:"",response:"",nextAction:"Initial pitch — Suffolk now Reform majority (45/71 seats). £220m confirmed highways contract.",priority:"MEDIUM",notes:"Not previously contacted. Suffolk gained by Reform in 2026. Single-council focus but large contract makes approach straightforward.",reformCouncils:1},
  {rank:15,wave:"WAVE 2",company:"Mott MacDonald",sector:"Engineering Consultancy",exposure:"£135m",contact:"Richard Risdon",title:"Director, External Affairs",email:"richard.risdon@mottmac.com",councils:"Barnsley, Gateshead, East Sussex, Warwickshire, Worcestershire, Leicestershire + 2 more",status:"Declined — Revisit",lastContact:"Apr-26",response:"Polite decline (pre-May 2026 elections — exposure was 4 councils then)",nextAction:"Fresh approach — frame as new intelligence, not a re-pitch. Exposure has grown from 4 to 8 councils since decline. Advice-risk angle: Reform administrations revisiting planning studies commissioned by predecessors.",priority:"HIGH",notes:"Declined before 2026 elections. Now in 6 majority + 2 largest-party councils. Consultancy firm — receptive to peer-to-peer PA outreach. Good early-win potential per Chris's assessment.",reformCouncils:8},
  // ── WAVE 3 — Monitor & Approach 2027 ────────────────────────────────────
  {rank:16,wave:"WAVE 3",company:"Civica",sector:"IT / Digital",exposure:"£233m",contact:"Emily Douglin",title:"Chief Revenue Officer",email:"emily.douglin@civica.com",councils:"16 Reform councils (digital & housing IT)",status:"Not Responded",lastContact:"Apr-26",response:"",nextAction:"Follow-up — 2026 contract expiries. Frame on continuity risk under new Reform administrations.",priority:"MEDIUM",notes:"Multiple 2026 expiries. Civica housing systems embedded — switching is costly for councils.",reformCouncils:16},
  {rank:17,wave:"WAVE 3",company:"Norse Group",sector:"Catering / FM",exposure:"£208m",contact:"TBC",title:"Managing Director",email:"",councils:"10 Reform councils (catering & cleaning)",status:"Not Contacted",lastContact:"",response:"",nextAction:"Light-touch initial letter — growing public sector profile. Lower priority — approach after Waves 1 & 2.",priority:"WATCH",notes:"Not previously contacted. Smaller total exposure but worth a light-touch approach.",reformCouncils:10},
  {rank:18,wave:"WAVE 3",company:"NEC Software Solutions",sector:"IT / Revenues",exposure:"£180m",contact:"Roger Birkinshaw",title:"Managing Director",email:"roger.birkinshaw@nec.com",councils:"15 Reform councils (revenues & benefits platforms)",status:"Not Responded",lastContact:"Apr-26",response:"",nextAction:"Follow-up — 2026 contract expiries. NEC platforms underpin benefit payments — Reform councils cannot easily switch. That is the pitch.",priority:"MEDIUM",notes:"Benefits & revenues platforms are infrastructure. Switching carries political risk for councils as well as commercial risk for NEC.",reformCouncils:15},
  {rank:19,wave:"WAVE 3",company:"Atos / Eviden",sector:"IT / Digital",exposure:"£28m",contact:"Michael Herron",title:"CEO, Atos UK & Ireland",email:"michael.herron@atos.net",councils:"Essex (sole Reform council exposure)",status:"Not Responded",lastContact:"Apr-26",response:"",nextAction:"Light follow-up — Essex 2026 expiry only. Verify correct entity (Atos/Eviden split) before sending.",priority:"WATCH",notes:"Lowest priority in dataset. Single Essex contract. Approach only after Waves 1 & 2 complete. Verify entity structure first.",reformCouncils:1},
  // ── ADDITIONAL ───────────────────────────────────────────────────────────
  {rank:20,wave:"WAVE 2",company:"Cory Group",sector:"Waste / EfW",exposure:"£165m",contact:"TBC",title:"CEO / MD",email:"",councils:"Thurrock (£165m)",status:"Not Contacted",lastContact:"",response:"",nextAction:"Initial pitch — Thurrock now Reform majority (2026). £165m waste & energy recovery contract.",priority:"MEDIUM",notes:"Not previously contacted. New priority following Thurrock's 2026 Reform gain.",reformCouncils:1},
  {rank:21,wave:"WAVE 3",company:"System C / LiquidLogic",sector:"Social Care IT",exposure:"Est. £80m",contact:"Markus Bolton",title:"CEO, System C",email:"markus.bolton@system-c.com",councils:"10+ Reform councils (social care IT)",status:"Not Responded",lastContact:"Apr-26",response:"",nextAction:"Follow-up — social care IT review risk under Reform efficiency agenda.",priority:"WATCH",notes:"David Grigsby also a named contact. LiquidLogic brand now under System C.",reformCouncils:10},
  {rank:22,wave:"WAVE 3",company:"J&B Recycling / Urbaser",sector:"Waste",exposure:"£95m",contact:"TBC",title:"",email:"",councils:"Sunderland (£95m to 2031)",status:"Not Contacted",lastContact:"",response:"",nextAction:"Initial pitch — Sunderland now Reform majority (58/75 seats). Longer horizon (2031) reduces urgency.",priority:"WATCH",notes:"Not previously contacted. Lower priority given long contract horizon.",reformCouncils:1},
];

const STATUS_META = {
  "Engaged — Gone Quiet":  {bg:"#fff3e0",tx:"#e65100",dot:"#e65100"},
  "Warm — Follow-up sent": {bg:"#e3f2fd",tx:"#0d47a1",dot:"#1e88e5"},
  "Declined — Revisit":    {bg:"#fce4ec",tx:"#b71c1c",dot:"#c62828"},
  "Not Responded":         {bg:"#f5f5f5",tx:"#555555",dot:"#9e9e9e"},
  "Not Contacted":         {bg:"#fafafa",tx:"#757575",dot:"#bdbdbd"},
};

const PRI_META = {
  "HIGH":   {bg:"#b71c1c",tx:"white"},
  "MEDIUM": {bg:"#e65100",tx:"white"},
  "WATCH":  {bg:"#2e7d32",tx:"white"},
};

function CRMPipeline({onDraftEmail}) {
  const [filter,setFilter]       = useState("all");
  const [search,setSearch]       = useState("");
  const [selected,setSelected]   = useState(null);
  const [logEntry,setLogEntry]   = useState({date:"",direction:"INBOUND",summary:"",sentBy:""});
  const [logs,setLogs]           = useState({});   // company -> [{...}] — persisted
  const [note,setNote]           = useState("");
  const [notes,setNotes]         = useState({});   // company -> string — persisted
  const [storageReady,setStorageReady] = useState(false);
  const [saving,setSaving]       = useState(false);
  const [saveMsg,setSaveMsg]     = useState("");

  // Load persisted CRM data on mount
  useEffect(() => {
    (async () => {
      const savedLogs  = await storageGet("oak-crm-logs");
      const savedNotes = await storageGet("oak-crm-notes");
      if (savedLogs)  setLogs(savedLogs);
      if (savedNotes) setNotes(savedNotes);
      setStorageReady(true);
    })();
  }, []);

  const WAVE_META = {
    "WAVE 1": {label:"🔴 Wave 1 — Now",   bg:"#ffcdd2", tx:"#b71c1c"},
    "WAVE 2": {label:"🟡 Wave 2 — Q3",    bg:"#fff9c4", tx:"#7a4900"},
    "WAVE 3": {label:"🟢 Wave 3 — 2027",  bg:"#e8f5e9", tx:"#1b5e20"},
  };

  const filtered = CRM_DATA.filter(c => {
    if(filter==="high" && c.priority!=="HIGH") return false;
    if(filter==="engaged" && !["Engaged — Gone Quiet","Warm — Follow-up sent"].includes(c.status)) return false;
    if(filter==="new" && c.status!=="Not Contacted") return false;
    if(filter==="wave1" && c.wave!=="WAVE 1") return false;
    if(filter==="wave2" && c.wave!=="WAVE 2") return false;
    if(filter==="wave3" && c.wave!=="WAVE 3") return false;
    if(search && !c.company.toLowerCase().includes(search.toLowerCase()) && !c.contact.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const addLog = async (company) => {
    if(!logEntry.summary.trim()) return;
    setSaving(true);
    const newEntry = {...logEntry, date: logEntry.date || new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"2-digit"})};
    const newLogs = {...logs, [company]: [...(logs[company]||[]), newEntry]};
    setLogs(newLogs);
    setLogEntry({date:"",direction:"INBOUND",summary:"",sentBy:""});
    const ok = await storageSet("oak-crm-logs", newLogs);
    setSaving(false);
    setSaveMsg(ok ? "✓ Saved" : "⚠ Save failed");
    setTimeout(() => setSaveMsg(""), 2500);
  };

  const saveNote = async (company) => {
    setSaving(true);
    const newNotes = {...notes, [company]: note};
    setNotes(newNotes);
    const ok = await storageSet("oak-crm-notes", newNotes);
    setSaving(false);
    setSaveMsg(ok ? "✓ Note saved" : "⚠ Save failed");
    setTimeout(() => setSaveMsg(""), 2500);
  };

  const deleteLog = async (company, idx) => {
    const updated = (logs[company]||[]).filter((_,i)=>i!==idx);
    const newLogs = {...logs, [company]: updated};
    setLogs(newLogs);
    await storageSet("oak-crm-logs", newLogs);
  };

  const counts = {
    high: CRM_DATA.filter(c=>c.priority==="HIGH").length,
    engaged: CRM_DATA.filter(c=>["Engaged — Gone Quiet","Warm — Follow-up sent"].includes(c.status)).length,
    new: CRM_DATA.filter(c=>c.status==="Not Contacted").length,
    wave1: CRM_DATA.filter(c=>c.wave==="WAVE 1").length,
  };

  if(selected) {
    const c = selected;
    const sm = STATUS_META[c.status]||{bg:"#f5f5f5",tx:INK,dot:"#9e9e9e"};
    const pm = PRI_META[c.priority]||{bg:"#9e9e9e",tx:"white"};
    const wm = WAVE_META[c.wave]||{label:c.wave,bg:"#f5f5f5",tx:INK};
    const companyLogs = logs[c.company]||[];
    const companyNote = notes[c.company]||"";
    const isLoading = !storageReady;

    return (
      <div style={{animation:"fadeIn 0.3s ease"}}>
        {isLoading&&<div style={{padding:"8px 14px",background:"#f0ece3",borderLeft:`3px solid ${GOLD}`,borderRadius:"2px",marginBottom:"14px",fontFamily:MONO,fontSize:"11px",color:"#8a6a00"}}>Loading saved data...</div>}
        {saveMsg&&<div style={{padding:"8px 14px",background:saveMsg.startsWith("✓")?"#e8f5e9":"#fce4ec",borderLeft:`3px solid ${saveMsg.startsWith("✓")?"#2e7d32":"#b71c1c"}`,borderRadius:"2px",marginBottom:"14px",fontFamily:MONO,fontSize:"11px",color:saveMsg.startsWith("✓")?"#2e7d32":"#b71c1c"}}>{saveMsg}</div>}
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"20px",flexWrap:"wrap",gap:"10px"}}>
          <div>
            <div style={{fontFamily:MONO,fontSize:"9px",letterSpacing:"0.15em",color:"#8a8780",marginBottom:"3px"}}>{c.sector} · RANK #{c.rank}</div>
            <h3 style={{fontSize:"22px",fontWeight:500,color:INK,margin:"0 0 6px"}}>{c.company}</h3>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center"}}>
              <span style={{background:wm.bg,color:wm.tx,fontFamily:MONO,fontSize:"10px",padding:"3px 10px",borderRadius:"20px",fontWeight:500}}>{wm.label}</span>
              <span style={{background:sm.bg,color:sm.tx,fontFamily:MONO,fontSize:"10px",padding:"3px 10px",borderRadius:"20px",fontWeight:500}}>{c.status}</span>
              <span style={{background:pm.bg,color:pm.tx,fontFamily:MONO,fontSize:"10px",padding:"3px 10px",borderRadius:"2px",fontWeight:700}}>{c.priority}</span>
              {c.exposure&&<span style={{fontFamily:MONO,fontSize:"11px",color:GOLD,fontWeight:500}}>{c.exposure} exposure</span>}
              <span style={{fontFamily:MONO,fontSize:"10px",color:"#8a8780"}}>{c.reformCouncils} Reform councils</span>
            </div>
          </div>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
            <button onClick={()=>onDraftEmail&&onDraftEmail({
              company:c.company, contact:c.contact, role:c.title,
              reformExposure:c.councils,
              triggerContext:c.status==="Declined — Revisit"
                ?"Previously declined (pre-May 2026 elections). Exposure has materially increased since. Frame as new intelligence."
                :c.status==="Engaged — Gone Quiet"
                  ?"Previously engaged — meeting arranged but went quiet. Re-engage with updated council data."
                  :"Follow-up to April 2026 introductory letter. Reference 2026 election results and expanded exposure.",
              briefSummary:`Status: ${c.status}. Reform councils: ${c.councils}. Next action: ${c.nextAction}. Notes: ${c.notes}`,
            })} style={{...s.goldBtn,padding:"9px 16px",fontSize:"11px"}}>
              {c.status==="Not Contacted"?"DRAFT INITIAL EMAIL →":"DRAFT FOLLOW-UP →"}
            </button>
            <button onClick={()=>setSelected(null)} style={s.ghost}>← BACK</button>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px",marginBottom:"20px"}}>
          <div style={{background:"white",border:"1px solid #e8e4dc",borderRadius:"2px",padding:"16px 20px"}}>
            <div style={{fontFamily:MONO,fontSize:"10px",color:GOLD,letterSpacing:"0.12em",marginBottom:"10px"}}>CONTACT</div>
            <div style={{fontSize:"15px",fontWeight:500,color:INK,marginBottom:"3px"}}>{c.contact||"TBC"}</div>
            <div style={{fontSize:"13px",color:"#6b6660",fontStyle:"italic",marginBottom:"6px"}}>{c.title}</div>
            {c.email&&<div style={{fontFamily:MONO,fontSize:"12px",color:"#5a7fa0"}}>{c.email}</div>}
          </div>
          <div style={{background:"white",border:"1px solid #e8e4dc",borderRadius:"2px",padding:"16px 20px"}}>
            <div style={{fontFamily:MONO,fontSize:"10px",color:GOLD,letterSpacing:"0.12em",marginBottom:"10px"}}>REFORM EXPOSURE</div>
            <div style={{fontSize:"13px",color:"#4a4740",lineHeight:1.7}}>{c.councils}</div>
          </div>
        </div>

        <div style={{background:"white",border:"1px solid #e8e4dc",borderRadius:"2px",padding:"16px 20px",marginBottom:"16px"}}>
          <div style={{fontFamily:MONO,fontSize:"10px",color:GOLD,letterSpacing:"0.12em",marginBottom:"8px"}}>RECOMMENDED NEXT ACTION</div>
          <div style={{fontSize:"14px",color:"#2a2620",lineHeight:1.7}}>{c.nextAction}</div>
          {c.notes&&<div style={{marginTop:"10px",fontSize:"13px",color:"#6b6660",fontStyle:"italic",borderTop:"1px solid #f0ece3",paddingTop:"10px"}}>{c.notes}</div>}
        </div>

        {c.response&&<div style={{padding:"12px 16px",background:"#e3f2fd",borderLeft:"3px solid #1e88e5",borderRadius:"2px",marginBottom:"16px"}}>
          <span style={{fontFamily:MONO,fontSize:"10px",color:"#0d47a1",letterSpacing:"0.1em"}}>RESPONSE ON FILE: </span>
          <span style={{fontSize:"13px",color:"#1a3a5c"}}>{c.response}</span>
        </div>}

        {/* Notes */}
        <div style={{background:"white",border:"1px solid #e8e4dc",borderRadius:"2px",padding:"16px 20px",marginBottom:"16px"}}>
          <div style={{fontFamily:MONO,fontSize:"10px",color:GOLD,letterSpacing:"0.12em",marginBottom:"8px"}}>NOTES</div>
          <textarea value={companyNote||note} onChange={e=>setNote(e.target.value)} placeholder="Add notes about this relationship, conversations, intelligence gathered..." rows={3} style={{...s.textarea,marginBottom:"8px"}}/>
          <button onClick={()=>saveNote(c.company)} disabled={saving} style={{...s.darkBtn,padding:"7px 14px",fontSize:"10px",opacity:saving?0.5:1}}>{saving?"SAVING...":"SAVE NOTE"}</button>
        </div>

        {/* Correspondence log */}
        <div style={{background:"white",border:"1px solid #e8e4dc",borderRadius:"2px",padding:"16px 20px",marginBottom:"16px"}}>
          <div style={{fontFamily:MONO,fontSize:"10px",color:GOLD,letterSpacing:"0.12em",marginBottom:"12px"}}>CORRESPONDENCE LOG</div>

          {/* Existing */}
          {companyLogs.length>0&&(
            <div style={{marginBottom:"12px"}}>
              {companyLogs.map((l,i)=>(
                <div key={i} style={{display:"flex",gap:"12px",padding:"8px 0",borderBottom:"1px solid #f0ece3",alignItems:"flex-start"}}>
                  <span style={{fontFamily:MONO,fontSize:"10px",color:"#8a8780",flex:"0 0 60px"}}>{l.date}</span>
                  <span style={{fontFamily:MONO,fontSize:"10px",padding:"2px 8px",borderRadius:"2px",background:l.direction==="INBOUND"?"#e3f2fd":"#f0ece3",color:l.direction==="INBOUND"?"#0d47a1":"#5a4010",flex:"0 0 70px",textAlign:"center"}}>{l.direction}</span>
                  <span style={{fontSize:"13px",color:"#4a4740",flex:1}}>{l.summary}</span>
                  {l.sentBy&&<span style={{fontFamily:MONO,fontSize:"10px",color:"#b0aa9f",flex:"0 0 90px"}}>{l.sentBy}</span>}
                  <button onClick={()=>deleteLog(c.company,i)} title="Delete entry" style={{background:"transparent",border:"none",color:"#ddd",cursor:"pointer",fontSize:"14px",padding:"0 4px",flexShrink:0}}>✕</button>
                </div>
              ))}
            </div>
          )}
          {companyLogs.length===0&&<div style={{fontSize:"13px",color:"#b0aa9f",fontStyle:"italic",marginBottom:"12px"}}>{isLoading?"Loading saved entries...":"No entries yet. Add the first log entry below — it will be saved and shared with Chris and Kirsty automatically."}</div>}

          {/* Add new */}
          <div style={{borderTop:"1px solid #f0ece3",paddingTop:"12px"}}>
            <div style={{fontFamily:MONO,fontSize:"10px",color:"#8a8780",marginBottom:"8px"}}>LOG NEW ENTRY</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 2fr 1fr",gap:"8px",marginBottom:"8px"}}>
              <input value={logEntry.date} onChange={e=>setLogEntry(p=>({...p,date:e.target.value}))} placeholder="Date" style={{...s.input,padding:"7px 10px",fontSize:"13px"}}/>
              <select value={logEntry.direction} onChange={e=>setLogEntry(p=>({...p,direction:e.target.value}))} style={{...s.select,padding:"7px 10px",fontSize:"13px"}}>
                <option>INBOUND</option><option>OUTBOUND</option><option>MEETING</option><option>CALL</option>
              </select>
              <input value={logEntry.summary} onChange={e=>setLogEntry(p=>({...p,summary:e.target.value}))} placeholder="Summary of contact or response..." style={{...s.input,padding:"7px 10px",fontSize:"13px"}}/>
              <input value={logEntry.sentBy} onChange={e=>setLogEntry(p=>({...p,sentBy:e.target.value}))} placeholder="Sent by" style={{...s.input,padding:"7px 10px",fontSize:"13px"}}/>
            </div>
            <button onClick={()=>addLog(c.company)} disabled={saving||!logEntry.summary.trim()} style={{...s.darkBtn,padding:"7px 14px",fontSize:"10px",opacity:saving||!logEntry.summary.trim()?0.5:1}}>{saving?"SAVING...":"ADD TO LOG"}</button>
          </div>
        </div>

        <CoworkTip text={`Save updated notes for ${c.company} to the Oak Insight Pipeline CRM spreadsheet in Google Drive.`}/>
      </div>
    );
  }

  return (
    <div style={{animation:"fadeIn 0.4s ease"}}>
      {/* Shared storage notice */}
      {!storageReady&&<div style={{padding:"10px 14px",background:"#f0ece3",borderLeft:`3px solid ${GOLD}`,borderRadius:"2px",marginBottom:"14px",fontFamily:MONO,fontSize:"11px",color:"#8a6a00"}}>Loading shared CRM data...</div>}
      {storageReady&&<div style={{padding:"8px 14px",background:"#f9f6f0",borderLeft:`3px solid ${NAVY}`,borderRadius:"2px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"8px"}}>
        <span style={{fontFamily:MONO,fontSize:"10px",color:NAVY,fontWeight:500}}>SHARED CRM</span>
        <span style={{fontSize:"12px",color:"#6b6660",fontStyle:"italic"}}>Log entries and notes are saved and shared across Gawain, Chris, and Kirsty's sessions automatically.</span>
      </div>}

      {/* Summary bar */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"10px",marginBottom:"20px"}}>
        {[
          {label:"Total tracked",n:CRM_DATA.length,color:INK,filter:"all"},
          {label:"🔴 Wave 1 — Act now",n:counts.wave1,color:"#b71c1c",filter:"wave1"},
          {label:"High priority",n:counts.high,color:"#b71c1c",filter:"high"},
          {label:"Active / warm",n:counts.engaged,color:"#e65100",filter:"engaged"},
          {label:"Not yet contacted",n:counts.new,color:"#2e7d32",filter:"new"},
        ].map(stat=>(
          <div key={stat.label} onClick={()=>setFilter(stat.filter)} style={{background:"white",border:`1.5px solid ${filter===stat.filter?stat.color:"#e8e4dc"}`,borderRadius:"3px",padding:"12px 16px",cursor:"pointer",textAlign:"center",transition:"all 0.15s"}}>
            <div style={{fontFamily:MONO,fontSize:"24px",fontWeight:500,color:stat.color,lineHeight:1}}>{stat.n}</div>
            <div style={{fontSize:"12px",color:"#8a8780",fontStyle:"italic",marginTop:"4px"}}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Search and filter */}
      <div style={{display:"flex",gap:"8px",marginBottom:"16px",flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company or contact..." style={{...s.input,width:"200px",padding:"7px 12px",fontSize:"13px"}}/>
        {[
          {val:"all",label:"ALL"},
          {val:"high",label:"HIGH PRIORITY"},
          {val:"engaged",label:"ACTIVE"},
          {val:"new",label:"NOT CONTACTED"},
          {val:"wave1",label:"🔴 WAVE 1"},
          {val:"wave2",label:"🟡 WAVE 2"},
          {val:"wave3",label:"🟢 WAVE 3"},
        ].map(f=>(
          <button key={f.val} onClick={()=>setFilter(f.val)} style={{fontFamily:MONO,fontSize:"10px",padding:"7px 10px",cursor:"pointer",borderRadius:"2px",letterSpacing:"0.06em",border:filter===f.val?`1.5px solid ${GOLD}`:"1px solid #ddd8ce",background:filter===f.val?"#fdf6e3":"white",color:filter===f.val?INK:"#6b6660"}}>{f.label}</button>
        ))}
      </div>

      {/* Company list */}
      <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
        {filtered.map((c,i)=>{
          const sm = STATUS_META[c.status]||{bg:"#f5f5f5",tx:INK,dot:"#9e9e9e"};
          const pm = PRI_META[c.priority]||{bg:"#9e9e9e",tx:"white"};
          const wm = WAVE_META[c.wave]||{label:c.wave,bg:"#f5f5f5",tx:INK};
          const hasLogs = (logs[c.company]||[]).length > 0;
          return (
            <div key={c.company} onClick={()=>{setSelected(c);setNote(notes[c.company]||"");}} style={{border:"1px solid #e8e4dc",borderRadius:"2px",padding:"12px 16px",background:"white",cursor:"pointer",transition:"all 0.15s",display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
              <div style={{fontFamily:MONO,fontSize:"13px",fontWeight:500,color:GOLD,flex:"0 0 24px",textAlign:"center"}}>{c.rank}</div>
              <div style={{flex:"0 0 8px",height:"8px",borderRadius:"50%",background:sm.dot,flexShrink:0}}/>
              <div style={{flex:1,minWidth:"140px"}}>
                <div style={{fontSize:"15px",fontWeight:500,color:INK,marginBottom:"2px"}}>{c.company}</div>
                <div style={{fontSize:"12px",color:"#6b6660",fontStyle:"italic"}}>{c.contact||"Contact TBC"}{c.title?` — ${c.title.split(",")[0]}`:" "}</div>
              </div>
              <span style={{background:wm.bg,color:wm.tx,fontFamily:MONO,fontSize:"9px",padding:"2px 8px",borderRadius:"20px",fontWeight:500,flex:"0 0 auto",whiteSpace:"nowrap"}}>{wm.label}</span>
              <span style={{background:sm.bg,color:sm.tx,fontFamily:MONO,fontSize:"9px",padding:"2px 8px",borderRadius:"20px",fontWeight:500,flex:"0 0 130px",textAlign:"center",whiteSpace:"nowrap"}}>{c.status}</span>
              {c.exposure&&<div style={{fontFamily:MONO,fontSize:"11px",color:GOLD,fontWeight:500,flex:"0 0 70px",textAlign:"right"}}>{c.exposure}</div>}
              <div style={{fontFamily:MONO,fontSize:"10px",color:"#8a8780",flex:"0 0 80px",textAlign:"center"}}>{c.reformCouncils} councils</div>
              <div style={{background:pm.bg,color:pm.tx,fontFamily:MONO,fontSize:"9px",padding:"3px 8px",borderRadius:"2px",fontWeight:700,flex:"0 0 55px",textAlign:"center"}}>{c.priority}</div>
              {hasLogs&&<div style={{fontFamily:MONO,fontSize:"9px",color:GOLD,flex:"0 0 40px"}}>+ LOG</div>}
              <div style={{fontFamily:MONO,fontSize:"10px",color:"#b0aa9f",flex:"0 0 40px",textAlign:"right"}}>VIEW →</div>
            </div>
          );
        })}
      </div>
      {filtered.length===0&&<div style={{padding:"28px",textAlign:"center",color:"#b0aa9f",fontStyle:"italic",fontSize:"14px"}}>No companies match the current filter.</div>}
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

// ─── TOOL: CALENDAR ──────────────────────────────────────────────────────────
// Three event layers:
//   PIPELINE  — auto-generated follow-up deadlines from CRM_DATA
//   POLITICAL — key Reform UK / public affairs dates
//   CUSTOM    — user-added events, persisted in shared storage

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const DAYS   = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// Auto-generate pipeline events from CRM data
function buildPipelineEvents() {
  const events = [];
  const today = new Date();
  CRM_DATA.forEach(c => {
    // Wave 1 = 14 days, Wave 2 = 45 days, Wave 3 = 90 days from today
    const dayOffset = c.wave==="WAVE 1" ? 14 : c.wave==="WAVE 2" ? 45 : 90;
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    // Quiet alert: if last contact > 30 days ago and status is Engaged/Warm
    if(["Engaged — Gone Quiet","Warm — Follow-up sent"].includes(c.status)) {
      const alertDate = new Date(today);
      alertDate.setDate(alertDate.getDate() + 7);
      events.push({
        id:`quiet-${c.company}`,
        date: `${alertDate.getFullYear()}-${String(alertDate.getMonth()+1).padStart(2,"0")}-${String(alertDate.getDate()).padStart(2,"0")}`,
        type:"alert",
        label:`⚠ Re-engage: ${c.company}`,
        company:c.company,
        priority:c.priority,
        wave:c.wave,
        note:c.nextAction,
      });
    } else {
      events.push({
        id:`followup-${c.company}`,
        date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,
        type:"followup",
        label:`${c.wave==="WAVE 1"?"🔴":"🟡"} ${c.company}`,
        company:c.company,
        priority:c.priority,
        wave:c.wave,
        note:c.nextAction,
      });
    }
  });
  return events;
}

// Key political dates — June 2026 onwards
const POLITICAL_EVENTS = [
  {id:"p1",  date:"2026-06-18", type:"political", label:"📍 Makerfield by-election"},
  {id:"p2",  date:"2026-06-30", type:"political", label:"📋 Reform council 100-day mark (2026 gains)"},
  {id:"p3",  date:"2026-07-15", type:"political", label:"🏛 Parliamentary recess begins"},
  {id:"p4",  date:"2026-07-22", type:"political", label:"📋 Essex CC first full council meeting"},
  {id:"p5",  date:"2026-08-01", type:"political", label:"📋 Q2 council procurement window opens"},
  {id:"p6",  date:"2026-09-01", type:"political", label:"🏛 Parliament returns"},
  {id:"p7",  date:"2026-09-15", type:"political", label:"💰 Local govt spending review consultation"},
  {id:"p8",  date:"2026-10-01", type:"political", label:"📋 Q3 council budget setting begins"},
  {id:"p9",  date:"2026-10-14", type:"political", label:"🏛 Conservative Party conference"},
  {id:"p10", date:"2026-10-21", type:"political", label:"🏛 Reform UK conference"},
  {id:"p11", date:"2026-11-05", type:"political", label:"💰 Autumn Budget"},
  {id:"p12", date:"2026-12-01", type:"political", label:"📋 Contract renewal cycle — Q1 2027 tenders due"},
  {id:"p13", date:"2027-01-15", type:"political", label:"📋 Q4 council budget finalisation"},
  {id:"p14", date:"2027-05-06", type:"political", label:"🗳 English local elections 2027"},
];

const EVENT_COLORS = {
  followup: {bg:"#fff3e0", tx:"#e65100", border:"#ef6c00"},
  alert:    {bg:"#fce4ec", tx:"#b71c1c", border:"#c62828"},
  political:{bg:"#e3f2fd", tx:"#0d47a1", border:"#1565c0"},
  custom:   {bg:"#e8f5e9", tx:"#2e7d32", border:"#388e3c"},
};

function CalendarTool({onOpenCompany, onDraftEmail}) {
  const today = new Date();
  const [year,  setYear]   = useState(today.getFullYear());
  const [month, setMonth]  = useState(today.getMonth());
  const [customEvents, setCustomEvents]   = useState([]);
  const [storageReady, setStorageReady]   = useState(false);
  const [selectedDay, setSelectedDay]     = useState(null);
  const [showAddForm, setShowAddForm]     = useState(false);
  const [newEvent, setNewEvent]           = useState({label:"", note:"", date:""});
  const [view, setView]                   = useState("month"); // month | agenda
  const [layers, setLayers]               = useState({followup:true, alert:true, political:true, custom:true});

  useEffect(() => {
    (async () => {
      const saved = await storageGet("oak-calendar-custom");
      if (saved) setCustomEvents(saved);
      setStorageReady(true);
    })();
  }, []);

  const pipelineEvents = buildPipelineEvents();
  const allEvents = [
    ...(layers.followup  ? pipelineEvents.filter(e=>e.type==="followup")  : []),
    ...(layers.alert     ? pipelineEvents.filter(e=>e.type==="alert")     : []),
    ...(layers.political ? POLITICAL_EVENTS                                 : []),
    ...(layers.custom    ? customEvents                                      : []),
  ];

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month+1, 0);
  const startDow = (firstDay.getDay()+6)%7; // Monday=0
  const daysInMonth = lastDay.getDate();

  const cells = [];
  for(let i=0; i<startDow; i++) cells.push(null);
  for(let d=1; d<=daysInMonth; d++) cells.push(d);
  while(cells.length % 7 !== 0) cells.push(null);

  const dateStr = (d) =>
    `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  const eventsForDay = (d) =>
    d ? allEvents.filter(e => e.date === dateStr(d)) : [];

  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const isToday  = (d) => d && dateStr(d) === todayStr;

  const prevMonth = () => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  const addCustomEvent = async () => {
    if(!newEvent.label.trim() || !newEvent.date) return;
    const ev = {...newEvent, id:`custom-${Date.now()}`, type:"custom"};
    const updated = [...customEvents, ev];
    setCustomEvents(updated);
    await storageSet("oak-calendar-custom", updated);
    setNewEvent({label:"", note:"", date:""});
    setShowAddForm(false);
  };

  const deleteCustomEvent = async (id) => {
    const updated = customEvents.filter(e=>e.id!==id);
    setCustomEvents(updated);
    await storageSet("oak-calendar-custom", updated);
  };

  // Agenda: next 60 days
  const agendaEvents = allEvents
    .filter(e => e.date >= todayStr)
    .sort((a,b) => a.date.localeCompare(b.date))
    .slice(0, 40);

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : [];

  return (
    <div style={{animation:"fadeIn 0.4s ease"}}>
      {/* Header bar */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"18px",flexWrap:"wrap",gap:"10px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <button onClick={prevMonth} style={{...s.ghost,padding:"6px 12px",fontSize:"13px"}}>‹</button>
          <h3 style={{fontSize:"20px",fontWeight:400,color:INK,margin:0,minWidth:"180px",textAlign:"center"}}>{MONTHS[month]} {year}</h3>
          <button onClick={nextMonth} style={{...s.ghost,padding:"6px 12px",fontSize:"13px"}}>›</button>
          <button onClick={()=>{setMonth(today.getMonth());setYear(today.getFullYear());}} style={{...s.ghost,padding:"6px 10px",fontSize:"10px",fontFamily:MONO,letterSpacing:"0.08em"}}>TODAY</button>
        </div>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center"}}>
          {/* Layer toggles */}
          {[
            {key:"followup",  label:"Pipeline", color:"#ef6c00"},
            {key:"alert",     label:"Alerts",   color:"#b71c1c"},
            {key:"political", label:"Political", color:"#1565c0"},
            {key:"custom",    label:"Custom",   color:"#2e7d32"},
          ].map(l=>(
            <button key={l.key} onClick={()=>setLayers(p=>({...p,[l.key]:!p[l.key]}))}
              style={{fontFamily:MONO,fontSize:"9px",letterSpacing:"0.08em",padding:"4px 10px",cursor:"pointer",borderRadius:"20px",border:`1.5px solid ${l.color}`,background:layers[l.key]?l.color:"white",color:layers[l.key]?"white":l.color,fontWeight:500}}>
              {l.label}
            </button>
          ))}
          <div style={{width:"1px",height:"22px",background:"#e8e4dc",margin:"0 4px"}}/>
          {["month","agenda"].map(v=>(
            <button key={v} onClick={()=>setView(v)}
              style={{fontFamily:MONO,fontSize:"10px",padding:"6px 12px",cursor:"pointer",borderRadius:"2px",border:view===v?`1.5px solid ${GOLD}`:"1px solid #ddd8ce",background:view===v?"#fdf6e3":"white",color:view===v?INK:"#6b6660",letterSpacing:"0.08em"}}>
              {v.toUpperCase()}
            </button>
          ))}
          <button onClick={()=>setShowAddForm(p=>!p)}
            style={{...s.goldBtn,padding:"7px 14px",fontSize:"11px"}}>
            + ADD EVENT
          </button>
        </div>
      </div>

      {/* Add event form */}
      {showAddForm&&(
        <div style={{background:"#f0ece3",border:`1px solid ${GOLD}`,borderRadius:"3px",padding:"16px 20px",marginBottom:"16px",display:"flex",gap:"10px",flexWrap:"wrap",alignItems:"flex-end"}}>
          <div style={{flex:"0 0 140px"}}>
            <label style={s.label}>DATE</label>
            <input type="date" value={newEvent.date} onChange={e=>setNewEvent(p=>({...p,date:e.target.value}))} style={{...s.input,padding:"8px 10px",fontSize:"14px"}}/>
          </div>
          <div style={{flex:"1 1 200px"}}>
            <label style={s.label}>EVENT TITLE</label>
            <input value={newEvent.label} onChange={e=>setNewEvent(p=>({...p,label:e.target.value}))} placeholder="e.g. Call with Adam Read, Suez" style={{...s.input,padding:"8px 10px",fontSize:"14px"}}/>
          </div>
          <div style={{flex:"1 1 180px"}}>
            <label style={s.label}>NOTE (optional)</label>
            <input value={newEvent.note} onChange={e=>setNewEvent(p=>({...p,note:e.target.value}))} placeholder="Agenda, follow-up action..." style={{...s.input,padding:"8px 10px",fontSize:"14px"}}/>
          </div>
          <button onClick={addCustomEvent} style={{...s.darkBtn,padding:"9px 18px",flexShrink:0}}>SAVE</button>
          <button onClick={()=>setShowAddForm(false)} style={{...s.ghost,padding:"9px 14px",flexShrink:0}}>CANCEL</button>
        </div>
      )}

      {/* MONTH VIEW */}
      {view==="month"&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 1fr 1fr",gap:"1px",background:"#e8e4dc",border:"1px solid #e8e4dc",borderRadius:"3px",overflow:"hidden"}}>
          {DAYS.map(d=>(
            <div key={d} style={{background:NAVY,padding:"8px 0",textAlign:"center",fontFamily:MONO,fontSize:"10px",letterSpacing:"0.1em",color:"#8aabcf"}}>
              {d}
            </div>
          ))}
          {cells.map((d,i)=>{
            const dayEvs = eventsForDay(d);
            const hasAlert = dayEvs.some(e=>e.type==="alert");
            const isSelected = selectedDay===d;
            return (
              <div key={i} onClick={()=>setSelectedDay(d&&d!==selectedDay?d:null)}
                style={{background:isToday(d)?NAVY:isSelected?"#fdf6e3":"white",minHeight:"88px",padding:"6px 8px",cursor:d?"pointer":"default",transition:"background 0.1s",borderTop:hasAlert?"2px solid #b71c1c":"none",position:"relative"}}>
                {d&&(
                  <>
                    <div style={{fontFamily:MONO,fontSize:"11px",fontWeight:isToday(d)?700:400,color:isToday(d)?"white":d?INK:"transparent",marginBottom:"4px"}}>{d}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:"2px"}}>
                      {dayEvs.slice(0,3).map(ev=>{
                        const ec = EVENT_COLORS[ev.type]||EVENT_COLORS.custom;
                        return (
                          <div key={ev.id} style={{fontSize:"10px",background:ec.bg,color:ec.tx,borderLeft:`2px solid ${ec.border}`,padding:"1px 4px",borderRadius:"1px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",lineHeight:1.4}}>
                            {ev.label}
                          </div>
                        );
                      })}
                      {dayEvs.length>3&&<div style={{fontSize:"9px",color:"#8a8780",fontFamily:MONO}}>+{dayEvs.length-3} more</div>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* AGENDA VIEW */}
      {view==="agenda"&&(
        <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
          {agendaEvents.length===0&&<div style={{padding:"28px",textAlign:"center",color:"#b0aa9f",fontStyle:"italic",fontSize:"14px"}}>No upcoming events in the next 60 days.</div>}
          {agendaEvents.map(ev=>{
            const ec = EVENT_COLORS[ev.type]||EVENT_COLORS.custom;
            const [ey,em,ed] = ev.date.split("-").map(Number);
            const d = new Date(ey,em-1,ed);
            const label = d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
            return (
              <div key={ev.id} style={{display:"flex",alignItems:"flex-start",gap:"14px",padding:"12px 16px",background:"white",border:"1px solid #e8e4dc",borderLeft:`4px solid ${ec.border}`,borderRadius:"2px"}}>
                <div style={{fontFamily:MONO,fontSize:"11px",color:"#8a8780",flex:"0 0 80px",paddingTop:"2px"}}>{label}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:"14px",fontWeight:500,color:ec.tx,marginBottom:ev.note?"3px":"0"}}>{ev.label}</div>
                  {ev.note&&<div style={{fontSize:"12px",color:"#6b6660",fontStyle:"italic",lineHeight:1.5}}>{ev.note}</div>}
                </div>
                <div style={{display:"flex",gap:"8px",flexShrink:0}}>
                  {ev.company&&(
                    <button onClick={()=>onOpenCompany&&onOpenCompany(ev.company)}
                      style={{...s.ghost,padding:"5px 10px",fontSize:"10px"}}>VIEW →</button>
                  )}
                  {ev.company&&(
                    <button onClick={()=>onDraftEmail&&onDraftEmail({
                      company:ev.company,
                      triggerContext:ev.note||"",
                      briefSummary:`Calendar reminder: ${ev.label}. ${ev.note||""}`,
                    })} style={{...s.goldBtn,padding:"5px 10px",fontSize:"10px"}}>DRAFT EMAIL →</button>
                  )}
                  {ev.type==="custom"&&(
                    <button onClick={()=>deleteCustomEvent(ev.id)}
                      style={{background:"transparent",border:"none",color:"#ddd",cursor:"pointer",fontSize:"14px",padding:"0 4px"}}>✕</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Day detail panel */}
      {selectedDay&&selectedEvents.length>0&&view==="month"&&(
        <div style={{marginTop:"14px",border:`1px solid ${GOLD}`,borderRadius:"3px",overflow:"hidden",animation:"fadeIn 0.3s ease"}}>
          <div style={{background:NAVY,padding:"10px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontFamily:MONO,fontSize:"11px",color:GOLD,fontWeight:500}}>
              {new Date(year,month,selectedDay).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
            </span>
            <button onClick={()=>setSelectedDay(null)} style={{background:"transparent",border:"none",color:"#8aabcf",cursor:"pointer",fontSize:"16px"}}>✕</button>
          </div>
          <div style={{padding:"14px 18px",background:"white",display:"flex",flexDirection:"column",gap:"10px"}}>
            {selectedEvents.map(ev=>{
              const ec = EVENT_COLORS[ev.type]||EVENT_COLORS.custom;
              return (
                <div key={ev.id} style={{padding:"12px 14px",background:ec.bg,borderLeft:`3px solid ${ec.border}`,borderRadius:"2px"}}>
                  <div style={{fontSize:"14px",fontWeight:500,color:ec.tx,marginBottom:"4px"}}>{ev.label}</div>
                  {ev.note&&<div style={{fontSize:"12px",color:"#4a4740",fontStyle:"italic",marginBottom:"8px",lineHeight:1.6}}>{ev.note}</div>}
                  <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                    {ev.company&&(
                      <button onClick={()=>onOpenCompany&&onOpenCompany(ev.company)}
                        style={{...s.ghost,padding:"5px 10px",fontSize:"10px"}}>VIEW COMPANY →</button>
                    )}
                    {ev.company&&(
                      <button onClick={()=>onDraftEmail&&onDraftEmail({
                        company:ev.company,
                        triggerContext:ev.note||"",
                        briefSummary:`Calendar deadline: ${ev.label}. ${ev.note||""}`,
                      })} style={{...s.goldBtn,padding:"5px 10px",fontSize:"10px"}}>DRAFT EMAIL →</button>
                    )}
                    {ev.type==="custom"&&(
                      <button onClick={()=>deleteCustomEvent(ev.id)}
                        style={{...s.ghost,padding:"5px 10px",fontSize:"10px",color:"#b71c1c",borderColor:"#b71c1c"}}>DELETE</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quiet alerts summary */}
      {layers.alert&&(()=>{
        const quietAlerts = pipelineEvents.filter(e=>e.type==="alert");
        if(!quietAlerts.length) return null;
        return (
          <div style={{marginTop:"16px",padding:"12px 16px",background:"#fce4ec",border:"1px solid #ef9a9a",borderRadius:"3px"}}>
            <div style={{fontFamily:MONO,fontSize:"10px",color:"#b71c1c",letterSpacing:"0.12em",marginBottom:"8px",fontWeight:500}}>
              ⚠ QUIET ALERTS — {quietAlerts.length} {quietAlerts.length===1?"company has":"companies have"} gone quiet
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {quietAlerts.map(ev=>(
                <div key={ev.id} style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
                  <span style={{fontSize:"13px",color:"#b71c1c",fontWeight:500,flex:"0 0 160px"}}>{ev.company}</span>
                  <span style={{fontSize:"12px",color:"#6b6660",fontStyle:"italic",flex:1}}>{ev.note}</span>
                  <button onClick={()=>onOpenCompany&&onOpenCompany(ev.company)}
                    style={{...s.ghost,padding:"4px 10px",fontSize:"10px",borderColor:"#b71c1c",color:"#b71c1c",flexShrink:0}}>VIEW →</button>
                  <button onClick={()=>onDraftEmail&&onDraftEmail({
                    company:ev.company,
                    status:"Engaged — Gone Quiet",
                    triggerContext:"Re-engagement — previously active relationship has gone quiet.",
                    briefSummary:ev.note,
                  })} style={{...s.goldBtn,padding:"4px 10px",fontSize:"10px",flexShrink:0}}>DRAFT RE-ENGAGEMENT →</button>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

const TOOLS=[
  {id:"pipeline",  label:"Pipeline CRM",     icon:"◉", desc:"Track correspondence, log responses, draft follow-ups"},
  {id:"calendar",  label:"Calendar",         icon:"◷", desc:"Pipeline deadlines, political dates & custom events"},
  {id:"councils",  label:"Council Intel",    icon:"⬡", desc:"32 Reform councils — contract map, expiry watch"},
  {id:"tender",    label:"Tender Scout",     icon:"◎", desc:"Find Reform council tenders and auto-pitch"},
  {id:"qualifier", label:"Lead Qualifier",   icon:"◈", desc:"Research, score and qualify a prospect"},
  {id:"outreach",  label:"Outreach Letters", icon:"◇", desc:"Draft bespoke letters and proposals"},
  {id:"monitor",   label:"Political Monitor",icon:"★", desc:"Scan for Reform UK and sector developments"},
];

export default function Dashboard() {
  const [active,setActive] = useState(null);
  const [outreachPrefill,setOutreachPrefill] = useState(null);
  const [calendarCompany,setCalendarCompany] = useState(null);

  const handleQualifierHandoff = prefill => {
    setOutreachPrefill(prefill);
    setActive("outreach");
  };

  const handlePipelineEmail = prefill => {
    setOutreachPrefill(prefill);
    setActive("outreach");
  };

  const handleCalendarEmail = prefill => {
    setOutreachPrefill(prefill);
    setActive("outreach");
  };

  const handleCalendarCompany = (companyName) => {
    // Switch to pipeline and pre-select company
    setCalendarCompany(companyName);
    setActive("pipeline");
  };

  const handleCouncilOutreach = prefill => {
    setOutreachPrefill(prefill);
    setActive("outreach");
  };

  const today = new Date().toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

  return (
    <div style={{fontFamily:SERIF,background:PAPER,minHeight:"100vh",position:"relative"}}>
      <div style={{
        position:"fixed",top:0,left:0,right:0,bottom:0,
        backgroundImage:`url('data:image/png;base64,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')`,
        backgroundRepeat:"repeat",
        backgroundSize:"240px auto",
        backgroundPosition:"center",
        pointerEvents:"none",
        zIndex:0,
      }}/>
      <div style={{position:"relative",zIndex:1}}>
      <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      <style>{`
        *{box-sizing:border-box}
        input:focus,textarea:focus,select:focus{outline:none;border-color:${GOLD}!important}
        input::placeholder,textarea::placeholder{color:#b0aa9f}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes slideIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
        .tool-card{border:1px solid #e0dbd0;border-radius:3px;padding:16px 18px;cursor:pointer;transition:all 0.2s;background:white}
        .tool-card:hover{border-color:${GOLD};box-shadow:0 2px 12px rgba(201,168,76,0.12);transform:translateY(-1px)}
        .tool-card.active{border-color:${GOLD};border-width:2px;background:#fdf9f0}
      `}</style>

      {/* Header */}
      <div style={{background:NAVY,padding:"0 32px"}}>
        <div style={{maxWidth:"1200px",margin:"0 auto",padding:"18px 0",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"12px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"16px"}}>
            <img src="data:image/png;base64,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" alt="Oak Insight" style={{height:"44px",width:"auto",display:"block"}}/>
            <div style={{fontFamily:MONO,color:"#8aabcf",fontSize:"10px",letterSpacing:"0.15em",borderLeft:"1px solid #1a4a7a",paddingLeft:"16px"}}>INTELLIGENCE PLATFORM</div>
          </div>
          <div style={{fontFamily:MONO,fontSize:"10px",color:"#8aabcf",letterSpacing:"0.1em"}}>{today}</div>
        </div>
      </div>

      <div style={{maxWidth:"1200px",margin:"0 auto",padding:"28px 24px 80px"}}>

        {/* Tool nav — 6 tools, 3+3 */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"8px",marginBottom:"28px"}}>
          {TOOLS.map(t=>(
            <div key={t.id} className={`tool-card ${active===t.id?"active":""}`} onClick={()=>setActive(active===t.id?null:t.id)}>
              <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"5px"}}>
                <span style={{fontSize:"16px",color:active===t.id?GOLD:"#8a8780"}}>{t.icon}</span>
                <div style={{fontFamily:MONO,fontSize:"10px",fontWeight:500,letterSpacing:"0.08em",color:active===t.id?INK:"#4a4740"}}>{t.label}</div>
              </div>
              <div style={{fontSize:"12px",color:"#8a8780",fontStyle:"italic",lineHeight:1.4}}>{t.desc}</div>
            </div>
          ))}
        </div>

        {/* Home state */}
        {!active&&(
          <div style={{animation:"fadeIn 0.5s ease"}}>
            <div style={{background:"white",border:"1px solid #e8e4dc",borderRadius:"3px",padding:"36px 44px",marginBottom:"20px"}}>
              <div style={{fontFamily:MONO,fontSize:"10px",letterSpacing:"0.15em",color:"#b0aa9f",marginBottom:"10px"}}>GOOD {new Date().getHours()<12?"MORNING":new Date().getHours()<18?"AFTERNOON":"EVENING"}</div>
              <h1 style={{fontSize:"26px",fontWeight:400,color:INK,margin:"0 0 10px",lineHeight:1.2}}>Oak Insight Intelligence Platform</h1>
              <p style={{fontSize:"15px",color:"#6b6660",fontStyle:"italic",lineHeight:1.7,margin:"0 0 24px",maxWidth:"600px"}}>Six tools. One pipeline. Start with the CRM to see where every relationship stands — or open the Council Map to explore all 32 Reform councils and their contracts.</p>
              <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
                <button onClick={()=>setActive("calendar")} style={s.goldBtn}>OPEN CALENDAR →</button>
                <button onClick={()=>setActive("pipeline")} style={{...s.outline}}>PIPELINE →</button>
                <button onClick={()=>setActive("monitor")} style={{...s.ghost}}>TODAY'S DIGEST →</button>
              </div>
            </div>

            {/* Pipeline summary */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"1px",background:"#e8e4dc",border:"1px solid #e8e4dc",borderRadius:"3px",overflow:"hidden"}}>
              {[
                {n:"01",label:"Pipeline",text:"Track every company, every contact, every response. Draft follow-ups from inside."},
                {n:"02",label:"Calendar",text:"Pipeline deadlines, political dates, quiet alerts — and one-click email drafting."},
                {n:"03",label:"Council Intel",text:"All 32 Reform councils, top contracts, expiry watch."},
                {n:"04",label:"Tender Scout",text:"Live tenders from Reform councils with auto-generated pitch emails."},
                {n:"05",label:"Qualify",text:"Research and score a new prospect before spending a human minute."},
                {n:"06",label:"Outreach",text:"Bespoke letter in Oak Insight's register, ready to send."},
                {n:"07",label:"Monitor",text:"Rolling digest of Reform UK and sector developments."},
              ].map(step=>(
                <div key={step.n} style={{background:"white",padding:"18px 16px"}}>
                  <div style={{fontFamily:MONO,fontSize:"18px",color:"#e8e4dc",marginBottom:"5px"}}>{step.n}</div>
                  <div style={{fontFamily:MONO,fontSize:"10px",color:GOLD,letterSpacing:"0.12em",marginBottom:"6px"}}>{step.label.toUpperCase()}</div>
                  <div style={{fontSize:"12px",color:"#6b6660",lineHeight:1.55,fontStyle:"italic"}}>{step.text}</div>
                </div>
              ))}
            </div>

            {/* Quick stats */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"10px",marginTop:"16px"}}>
              {[
                {n:"24",label:"Reform majority councils"},
                {n:"8", label:"Reform largest party councils"},
                {n:"16",label:"Contracts expiring 2026–27"},
                {n:"7",label:"Tools in the platform"},
              ].map(stat=>(
                <div key={stat.n} style={{background:"white",border:"1px solid #e8e4dc",borderRadius:"3px",padding:"16px 20px",textAlign:"center"}}>
                  <div style={{fontFamily:MONO,fontSize:"28px",fontWeight:500,color:GOLD,lineHeight:1}}>{stat.n}</div>
                  <div style={{fontSize:"12px",color:"#8a8780",fontStyle:"italic",marginTop:"4px",lineHeight:1.4}}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active tool panel */}
        {active&&(
          <div style={{animation:"slideIn 0.35s ease"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"20px",paddingBottom:"14px",borderBottom:"1px solid #e8e4dc"}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                <span style={{fontSize:"20px",color:GOLD}}>{TOOLS.find(t=>t.id===active)?.icon}</span>
                <h2 style={{fontSize:"20px",fontWeight:500,color:INK,margin:0}}>{TOOLS.find(t=>t.id===active)?.label}</h2>
              </div>
              <button onClick={()=>setActive(null)} style={{...s.ghost,padding:"7px 14px",fontSize:"10px",letterSpacing:"0.1em"}}>← BACK TO DASHBOARD</button>
            </div>
            <div style={{background:"white",border:"1px solid #e8e4dc",borderRadius:"3px",padding:"28px 32px"}}>
              {active==="pipeline"&&<CRMPipeline onDraftEmail={handlePipelineEmail} highlightCompany={calendarCompany}/>}
              {active==="councils"&&<CouncilIntel onOutreach={handleCouncilOutreach}/>}
              {active==="qualifier"&&<Qualifier onHandoff={handleQualifierHandoff}/>}
              {active==="outreach"&&<Outreach prefill={outreachPrefill}/>}
              {active==="briefing"&&<Briefing/>}
              {active==="monitor"&&<Monitor/>}
              {active==="tender"&&<TenderScout/>}
              {active==="calendar"&&<CalendarTool onOpenCompany={handleCalendarCompany} onDraftEmail={handleCalendarEmail}/>}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
