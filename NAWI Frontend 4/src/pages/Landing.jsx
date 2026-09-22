import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import "../landing.css";

function Reveal({children,className=""}){const ref=useRef(null),[visible,setVisible]=useState(false);useEffect(()=>{const n=ref.current;if(!n||!("IntersectionObserver" in window)){setVisible(true);return}const f=setTimeout(()=>setVisible(true),900),o=new IntersectionObserver(([e])=>{if(e.isIntersecting){setVisible(true);clearTimeout(f);o.disconnect()}},{threshold:.12});o.observe(n);return()=>{clearTimeout(f);o.disconnect()}},[]);return <div ref={ref} className={`lp-reveal ${visible?"lp-is-visible":""} ${className}`}>{children}</div>}

function Icon({name}){const p={scale:<><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5M8 17h8"/></>,shield:<><path d="M12 3 19 6v5c0 4.5-3 7.5-7 10-4-2.5-7-5.5-7-10V6z"/><path d="m9 12 2 2 4-4"/></>,offline:<><rect x="4" y="5" width="16" height="14" rx="2"/><path d="m7 8 10 8M17 8 7 16"/></>,report:<><path d="M7 3.5h7l4 4V20.5H7z"/><path d="M14 3.5v4h4M10 12h5M10 15h5"/></>,audit:<><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></>,verify:<><circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.3 2.3 4.7-5"/></>};return <svg className="lp-line-icon" viewBox="0 0 24 24" aria-hidden="true">{p[name]}</svg>}

const challenges=[
["scale","Structured instrument records","Register instruments with validated capacity, interval, accuracy class, and measurement parameters before an evaluation begins."],
["shield","Authoritative evaluation","Server-side Decimal-safe calculations keep the committed verdict separate from provisional browser feedback."],
["offline","Offline-ready inspection","Capture observations locally and synchronize them when connectivity returns, without losing the inspection workflow."],
["audit","Traceable evidence","Append-only observations, audit records, report seals, and verification provide a traceable compliance record."]
];
const steps=[
["01","Register","Create or select the instrument record and validate its technical specification."],
["02","Evaluate","Run the required inspection modules and capture observations with immediate provisional feedback."],
["03","Verify","The backend evaluates committed observations using the authoritative calculation engine."],
["04","Report","Finalize the session into sealed PDF/DOCX artifacts that can be independently verified."]
];
const modules=["Zero check","Weighing performance","Eccentricity","Repeatability","Tare","Creep"];

export default function Landing(){
 const [menu,setMenu]=useState(false);
 const [,setLocation]=useLocation();
 const go=(id)=>{document.querySelector(id)?.scrollIntoView({behavior:"smooth"});setMenu(false)};
 return <main className="lp-site-shell">
  <nav className="lp-navbar">
   <button className="lp-brand" onClick={()=>go("#top")}><span className="lp-nawi-mark">N</span><span>NAWI <small>COMPLIANCE SUITE</small></span></button>
   <div className={`lp-nav-links ${menu?"lp-open":""}`}><a onClick={()=>go("#workflow")}>Workflow</a><a onClick={()=>go("#modules")}>Inspection</a><a onClick={()=>go("#integrity")}>Integrity</a></div>
   <div className="lp-nav-actions"><button className="lp-button lp-button-outline" onClick={()=>go("#about")}>About NAWI</button><button className="lp-menu-btn" onClick={()=>setMenu(!menu)} aria-label="Menu">☰</button></div>
  </nav>

  <section className="lp-hero" id="top">
   <Reveal className="lp-hero-copy"><span className="lp-eyebrow"><i/>DIGITAL INSPECTION WORKSPACE</span>
    <h1>Compliance, built for <span>measurement.</span></h1>
    <p>NAWI Compliance Suite brings instrument registration, structured inspections, authoritative evaluation, evidence, and sealed reporting into one inspection workflow.</p>
    <div className="lp-hero-actions"><button className="lp-button lp-button-primary" onClick={()=>go("#workflow")}>Explore the workflow <span>→</span></button><button className="lp-text-link" onClick={()=>go("#modules")}>View inspection modules <span>→</span></button></div>
    <div className="lp-hero-rule"><b>01</b><span>Designed to support — not replace — human inspection.</span></div>
   </Reveal>
   <Reveal className="lp-hero-visual"><div className="lp-tricolor lp-tricolor-top"/><div className="lp-instrument-art"><div className="lp-art-screen"><span>NAWI</span><strong>0.000000</strong><small>READY · VERIFIED INPUT</small></div><div className="lp-art-platform"/><div className="lp-art-base"/><div className="lp-art-status">● SYSTEM READY</div></div><div className="lp-visual-note"><b>Authoritative workflow</b><span>Server-side evaluation & sealed reports</span></div></Reveal>
  </section>

  <Reveal><section className="lp-context-section" id="about"><div className="lp-context-accent"/><div className="lp-context-copy"><span className="lp-eyebrow">/ THE WORKSPACE</span><h2>A structured digital layer for NAWI inspection.</h2><p>From instrument identity to final report, each stage is designed around traceability, controlled calculations, and clear human review.</p></div><div className="lp-context-authority"><span>NAWI</span><strong>Non-automatic weighing instrument workflow</strong><small>Inspection • Evaluation • Reporting</small></div></section></Reveal>

  <Reveal><section className="lp-challenge-section"><div className="lp-challenge-heading"><span className="lp-section-pill lp-orange-pill">02 / WHY IT MATTERS</span><h2>Turn a fragmented inspection into one controlled record.</h2><p>NAWI connects the practical inspection workflow with validation, persistence, synchronization, and report integrity.</p></div><div className="lp-challenge-grid">{challenges.map(([icon,title,text],i)=><article className="lp-challenge-card" key={title}><div className="lp-challenge-icon"><Icon name={icon}/></div><span className="lp-card-number">0{i+1}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section></Reveal>

  <Reveal><section className="lp-workflow-section" id="workflow"><div className="lp-workflow-intro"><div className="lp-workflow-copy"><span className="lp-section-pill lp-blue-pill">03 / WORKFLOW</span><h2>From instrument<br/><span>to verified report</span></h2><p>A single flow keeps inspection data organized from registration through observation, finalization, signing, and public verification.</p></div><div className="lp-workflow-visual"><div className="lp-visual-photo"><Icon name="scale"/></div><div className="lp-visual-arrow">→</div><div className="lp-visual-report"><div/><div/><div/><b>✓</b></div></div></div><div className="lp-workflow-grid">{steps.map(([num,title,text],i)=><article className={`lp-workflow-card workflow-card-${i+1}`} key={num}><div className="lp-workflow-icon"><Icon name={["scale","shield","verify","report"][i]}/></div><span className="lp-workflow-number">{num}</span><h3>{title}</h3><p>{text}</p></article>)}</div></section></Reveal>

  <Reveal><section className="lp-modules-section" id="modules"><div className="lp-section-heading"><div><span className="lp-eyebrow">04 / INSPECTION</span><h2>Six modules.<br/><span>One session.</span></h2></div><p>The lp-workspace organizes the required inspection areas into a single session, with completion gates before finalization.</p></div><div className="lp-module-list">{modules.map((m,i)=><div className="lp-module-row" key={m}><b>0{i+1}</b><span>{m}</span><i>↗</i></div>)}</div></section></Reveal>

  <Reveal><section className="lp-split-section" id="integrity"><div><span className="lp-eyebrow">05 / INTEGRITY</span><h2>Every committed observation has a traceable path.</h2><p>Provisional browser feedback is useful during inspection, while the backend remains authoritative for the committed calculation and stored result.</p></div><div className="lp-principles">{[["01","Decimal-safe calculations","Numeric values remain strings across the API boundary."],["02","Append-only observations","Revisions preserve inspection history instead of silently replacing it."],["03","Sealed artifacts","PDF byte hashes and verification data protect report integrity."],["04","Audit accountability","Important writes are recorded in a hash-chained audit trail."]].map(([n,t,d])=><div key={n}><b>{n}</b><span><strong>{t}</strong><small>{d}</small></span></div>)}</div></section></Reveal>

  <Reveal><section className="lp-awareness-section"><div><span className="lp-eyebrow">06 / HUMAN REVIEW</span><h2>Technology supports the inspector.</h2><p>The system is designed as a controlled inspection lp-workspace: it organizes evidence and calculations while keeping the human inspection process at the center.</p></div><div className="lp-awareness-callout"><span>RESPONSIBLE POSITIONING</span><strong>Support inspection. Preserve accountability.</strong></div></section></Reveal>

  <Reveal><section className="lp-cta-section"><div><span className="lp-eyebrow">07 / NAWI COMPLIANCE SUITE</span><h2>A clearer path from measurement to evidence.</h2><p>Explore the workflow, understand the inspection modules, and build a traceable evaluation record.</p></div><button className="lp-button lp-button-primary" onClick={()=>setLocation("/login")}>Explore NAWI <span>→</span></button></section></Reveal>

  <footer className="lp-footer"><div><div className="lp-footer-brand"><span className="lp-nawi-mark">N</span><b>NAWI</b></div><span>Digital compliance workflow for non-automatic weighing instrument inspection.</span></div><div><a onClick={()=>go("#top")}>Home</a><a onClick={()=>go("#workflow")}>Workflow</a><a onClick={()=>go("#modules")}>Inspection</a><a onClick={()=>go("#integrity")}>Integrity</a></div><small>Built for structured digital inspection workflows.</small></footer>
 </main>
}
