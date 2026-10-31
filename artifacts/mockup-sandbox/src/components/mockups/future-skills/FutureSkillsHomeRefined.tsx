import { useState } from "react";

const sectors = [
  { name: "Information and communication", short: "ICT", change: 18.6, roles: 42 },
  { name: "Professional, scientific and technical activities", short: "PRO", change: 12.4, roles: 58 },
  { name: "Financial and insurance activities", short: "FIN", change: 8.7, roles: 31 },
  { name: "Education and human health services", short: "EDU", change: 6.2, roles: 26 },
];

const steps = [
  { n: "01", title: "Your profile", copy: "Start with skills you already use.", mark: "P" },
  { n: "02", title: "The radar", copy: "See what is shifting across roles.", mark: "R" },
  { n: "03", title: "Your matches", copy: "Compare evidence, strengths and gaps.", mark: "M" },
  { n: "04", title: "A pathway", copy: "Turn a direction into next steps.", mark: "→" },
];

function Arrow() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 10h12m-5-5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function FutureSkillsHomeRefined() {
  const [activeSector, setActiveSector] = useState(0);
  const [scenario, setScenario] = useState("Baseline");
  const [started, setStarted] = useState(false);
  const chosen = sectors[activeSector];

  return (
    <div className="fs-variant">
      <style>{`
        .fs-variant {
          --paper:#f5f3eb; --ink:#202126; --blue:#14569b; --blue2:#2f83d1; --sky:#dcebf8;
          --muted:#66717e; --line:#d6dce0; --yellow:#f4bd43; --white:#fffefa;
          min-height:100vh; color:var(--ink); background-color:var(--paper);
          background-image:radial-gradient(rgba(20,86,155,.13) .85px,transparent .95px);
          background-size:19px 19px; font-family:'Plus Jakarta Sans',ui-sans-serif,system-ui,sans-serif;
          overflow:hidden;
        }
        .fs-variant * { box-sizing:border-box; }
        .fs-shell { width:min(1160px, calc(100% - 56px)); margin:0 auto; }
        .fs-top { display:flex; align-items:center; min-height:74px; gap:32px; border-bottom:1px solid rgba(20,86,155,.12); }
        .fs-brand { display:flex; align-items:center; gap:11px; color:inherit; text-decoration:none; }
        .fs-logo { display:grid; place-items:center; width:34px; height:34px; border-radius:11px 11px 11px 4px; background:#14569b; color:white; box-shadow:inset 0 -7px 0 #2f83d1; }
        .fs-logo svg { width:18px; height:18px; }
        .fs-brand strong { display:block; font:800 17px/1 'Outfit',sans-serif; letter-spacing:-.04em; }
        .fs-brand small { display:block; margin-top:5px; font:600 8px/1 'JetBrains Mono',monospace; letter-spacing:.19em; text-transform:uppercase; color:var(--muted); }
        .fs-nav { display:flex; align-items:center; gap:6px; margin-left:auto; }
        .fs-nav button { border:0; border-radius:999px; padding:9px 13px; background:transparent; color:#414b56; font:650 11px inherit; cursor:pointer; transition:background .18s,color .18s,transform .18s; }
        .fs-nav button:hover { background:#e2edf6; color:var(--blue); transform:translateY(-1px); }
        .fs-nav .fs-login { border:1px solid rgba(20,86,155,.22); color:var(--blue); }
        .fs-health { display:flex; align-items:center; gap:7px; color:#63717e; font:500 9px 'JetBrains Mono',monospace; white-space:nowrap; }
        .fs-health i { width:7px; height:7px; border-radius:50%; background:#3d9675; box-shadow:0 0 0 3px rgba(61,150,117,.12); }
        .fs-hero { display:grid; grid-template-columns:1.12fr .88fr; align-items:center; gap:66px; padding:77px 0 90px; }
        .fs-eyebrow { display:inline-flex; align-items:center; gap:9px; border:1px solid rgba(20,86,155,.17); border-radius:99px; padding:8px 13px; color:var(--blue); background:rgba(255,254,250,.62); font:600 9px 'JetBrains Mono',monospace; letter-spacing:.085em; text-transform:uppercase; }
        .fs-eyebrow b { width:6px;height:6px;border-radius:50%;background:var(--yellow); }
        .fs-hero h1 { max-width:650px; margin:24px 0 0; font:800 clamp(46px,6vw,76px)/.94 'Outfit',sans-serif; letter-spacing:-.065em; }
        .fs-hero h1 span { color:var(--blue2); }
        .fs-intro { max-width:490px; margin:22px 0 0; color:#626c75; font-size:14px; line-height:1.8; }
        .fs-actions { display:flex; flex-wrap:wrap; gap:11px; margin-top:27px; }
        .fs-button { display:inline-flex; align-items:center; justify-content:center; gap:11px; min-height:45px; border:0; border-radius:8px; padding:0 18px; text-decoration:none; font-size:11px; font-weight:750; cursor:pointer; transition:transform .2s,box-shadow .2s,background .2s; }
        .fs-button svg { width:16px; height:16px; }
        .fs-button:hover { transform:translateY(-2px); }
        .fs-primary { color:white; background:var(--blue); box-shadow:0 8px 18px rgba(20,86,155,.2); }
        .fs-primary:hover { background:#0f467f; box-shadow:0 11px 22px rgba(20,86,155,.26); }
        .fs-secondary { color:var(--blue); border:1px solid rgba(20,86,155,.22); background:rgba(255,254,250,.62); }
        .fs-note { margin-top:17px; color:#7b8289; font-size:9px; }
        .fs-note span { color:#4b5968; font-weight:700; }
        .fs-dataset { position:relative; padding:23px 23px 21px; border-radius:18px; background:var(--white); box-shadow:0 24px 65px rgba(24,62,95,.13),0 2px 5px rgba(24,62,95,.06); transform:rotate(1.1deg); }
        .fs-dataset::before { position:absolute; z-index:-1; content:""; inset:12px -10px -10px 12px; border:1px solid rgba(20,86,155,.2); border-radius:18px; background:#2f83d1; transform:rotate(-2.7deg); }
        .fs-card-head { display:flex; justify-content:space-between; align-items:center; padding-bottom:14px; border-bottom:1px solid #e8ebec; }
        .fs-card-head strong { font:750 14px 'Outfit',sans-serif; letter-spacing:-.02em; }
        .fs-card-head small { color:#78818a; font:500 8px 'JetBrains Mono',monospace; }
        .fs-live { display:flex; align-items:center; gap:6px; color:#438268; font:600 8px 'JetBrains Mono',monospace; text-transform:uppercase; letter-spacing:.08em; }
        .fs-live i { width:5px;height:5px;border-radius:50%;background:#55a47f; }
        .fs-stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-top:14px; }
        .fs-stat { min-height:78px; padding:12px 13px; border-radius:9px; background:#eaf2f8; }
        .fs-stat:nth-child(2) { background:#f7f2e4; }
        .fs-stat:nth-child(3) { background:#edf1ed; }
        .fs-stat:nth-child(4) { background:#f0eef5; }
        .fs-stat strong { display:block; font:750 24px/.95 'Outfit',sans-serif; letter-spacing:-.05em; }
        .fs-stat span { display:block; margin-top:7px; color:#66717b; font-size:9px; }
        .fs-dataset-foot { display:flex; justify-content:space-between; gap:12px; padding-top:14px; color:#737c85; font:500 8px 'JetBrains Mono',monospace; }
        .fs-dataset-foot b { color:#343d47; font-weight:600; }
        .fs-stamp { position:absolute; right:-10px; bottom:-18px; padding:11px 13px; border-radius:7px; color:#fff; background:#202126; font:600 8px/1.7 'JetBrains Mono',monospace; transform:rotate(-3deg); box-shadow:0 8px 20px #182b3b33; }
        .fs-stamp span { display:block; color:#a9d3f3; }
        .fs-section { padding:48px 0 53px; border-top:1px solid rgba(20,86,155,.13); }
        .fs-section-heading { display:flex; align-items:end; justify-content:space-between; gap:20px; margin-bottom:23px; }
        .fs-kicker { color:var(--blue); font:600 9px 'JetBrains Mono',monospace; letter-spacing:.12em; text-transform:uppercase; }
        .fs-section h2 { margin:8px 0 0; font:750 clamp(27px,3.5vw,39px)/1 'Outfit',sans-serif; letter-spacing:-.045em; }
        .fs-section-heading p { max-width:310px; margin:0; color:#727a82; font-size:10px; line-height:1.7; }
        .fs-steps { display:grid; grid-template-columns:repeat(4,1fr); gap:11px; }
        .fs-step { position:relative; min-height:144px; padding:19px 18px; overflow:hidden; border-radius:12px; background:#14569b; color:white; transition:transform .2s; }
        .fs-step:hover { transform:translateY(-4px); }
        .fs-step:nth-child(2) { background:#2f83d1; }
        .fs-step:nth-child(3) { background:#e4b745; color:#202126; }
        .fs-step:nth-child(4) { background:#27282b; }
        .fs-step-no { position:absolute; top:14px; right:15px; color:rgba(255,255,255,.57); font:500 9px 'JetBrains Mono',monospace; }
        .fs-step:nth-child(3) .fs-step-no { color:rgba(32,33,38,.5); }
        .fs-step-mark { display:grid; place-items:center; width:24px; height:24px; border:1px solid rgba(255,255,255,.4); border-radius:7px; font:700 11px 'JetBrains Mono',monospace; }
        .fs-step:nth-child(3) .fs-step-mark { border-color:rgba(32,33,38,.4); }
        .fs-step h3 { margin:20px 0 5px; font:700 16px 'Outfit',sans-serif; letter-spacing:-.02em; }
        .fs-step p { margin:0; max-width:200px; color:rgba(255,255,255,.78); font-size:9px; line-height:1.55; }
        .fs-step:nth-child(3) p { color:rgba(32,33,38,.75); }
        .fs-sector-panel { display:grid; grid-template-columns:minmax(0,1.3fr) minmax(250px,.7fr); gap:24px; padding:25px; border:1px solid rgba(20,86,155,.12); border-radius:15px; background:rgba(255,254,250,.88); }
        .fs-sector-main h2 { margin:0; font:750 25px 'Outfit',sans-serif; letter-spacing:-.04em; }
        .fs-sector-main > p { max-width:540px; margin:7px 0 19px; color:#707983; font-size:10px; line-height:1.7; }
        .fs-scenario { display:flex; gap:4px; padding:3px; border-radius:8px; background:#edf1f3; }
        .fs-scenario button { border:0; border-radius:6px; padding:7px 10px; color:#65717a; background:transparent; font:600 8px 'JetBrains Mono',monospace; cursor:pointer; }
        .fs-scenario button[aria-pressed=true] { color:var(--blue); background:#fff; box-shadow:0 1px 4px #142c4014; }
        .fs-sector-list { display:grid; gap:7px; margin-top:14px; }
        .fs-sector-row { display:grid; grid-template-columns:minmax(0,1fr) 98px 49px; align-items:center; gap:12px; width:100%; border:1px solid transparent; border-radius:8px; padding:10px 11px; text-align:left; color:var(--ink); background:transparent; cursor:pointer; transition:background .18s,border .18s; }
        .fs-sector-row:hover,.fs-sector-row[aria-pressed=true] { border-color:#d6e4ef; background:#f0f6fb; }
        .fs-sector-name { font-size:10px; line-height:1.35; font-weight:650; }
        .fs-sector-name small { display:block; margin-top:3px; color:#87909a; font:500 8px 'JetBrains Mono',monospace; }
        .fs-bar { height:5px; overflow:hidden; border-radius:99px; background:#e5e9ec; }
        .fs-bar i { display:block; height:100%; border-radius:inherit; background:#2f83d1; transition:width .25s; }
        .fs-percent { color:var(--blue); text-align:right; font:600 9px 'JetBrains Mono',monospace; }
        .fs-role-card { display:flex; flex-direction:column; justify-content:space-between; min-height:315px; padding:21px; overflow:hidden; border-radius:12px; color:white; background:#14569b; }
        .fs-role-top { display:flex; justify-content:space-between; align-items:center; color:#bad7f0; font:500 8px 'JetBrains Mono',monospace; letter-spacing:.1em; text-transform:uppercase; }
        .fs-role-icon { display:grid; place-items:center; width:37px; height:37px; border:1px solid #ffffff55; border-radius:11px; color:#fff; font:700 16px 'Outfit',sans-serif; }
        .fs-role-card h3 { max-width:245px; margin:19px 0 8px; font:750 28px/.98 'Outfit',sans-serif; letter-spacing:-.045em; }
        .fs-role-card p { margin:0; color:#c1daf0; font-size:9px; line-height:1.65; }
        .fs-role-foot { display:flex; justify-content:space-between; align-items:end; padding-top:16px; border-top:1px solid #ffffff35; }
        .fs-role-foot small { color:#bbd6ef; font:500 8px 'JetBrains Mono',monospace; }
        .fs-role-foot strong { display:block; margin-top:4px; font:700 24px 'Outfit',sans-serif; }
        .fs-role-foot button { display:grid; place-items:center; width:34px;height:34px;border:0;border-radius:50%; color:var(--blue);background:#fff;cursor:pointer; }
        .fs-role-foot button svg { width:16px;height:16px; }
        .fs-foot { display:flex; justify-content:space-between; align-items:center; gap:20px; padding:24px 0 32px; color:#7c838a; font-size:9px; }
        .fs-foot strong { border-radius:99px; padding:7px 11px; color:#14569b; background:#e3edf4; font:600 8px 'JetBrains Mono',monospace; }
        .fs-toast { position:fixed; z-index:5; right:22px; bottom:22px; max-width:calc(100vw - 44px); padding:13px 17px; border:1px solid #cbd9e4; border-radius:10px; color:#24465e; background:#fffefa; box-shadow:0 8px 28px #172c3b20; font-size:11px; animation:fs-in .25s ease both; }
        @keyframes fs-in { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @media (max-width:800px) {
          .fs-shell { width:min(100% - 36px,620px); }
          .fs-top { min-height:66px; gap:12px; flex-wrap:wrap; padding:12px 0; }
          .fs-nav { order:3; width:100%; justify-content:space-between; margin:0; }
          .fs-nav button { padding:8px 9px; font-size:10px; }
          .fs-health { margin-left:auto; }
          .fs-hero { grid-template-columns:1fr; gap:47px; padding:55px 0 69px; }
          .fs-hero h1 { font-size:clamp(48px,12vw,72px); }
          .fs-dataset { width:min(100% - 18px,440px); margin:0 auto; }
          .fs-steps { grid-template-columns:repeat(2,1fr); }
          .fs-sector-panel { grid-template-columns:1fr; gap:20px; padding:18px; }
          .fs-role-card { min-height:250px; }
        }
        @media (max-width:440px) {
          .fs-shell { width:calc(100% - 28px); }
          .fs-brand strong { font-size:15px; }
          .fs-nav button { padding:7px 6px; font-size:9px; }
          .fs-hero { padding-top:43px; }
          .fs-intro { font-size:12px; }
          .fs-stat { min-height:70px; padding:10px; }
          .fs-stat strong { font-size:22px; }
          .fs-section { padding:38px 0; }
          .fs-section-heading { align-items:start; flex-direction:column; }
          .fs-steps { gap:8px; }
          .fs-step { min-height:133px; padding:15px; }
          .fs-step h3 { margin-top:17px; font-size:15px; }
          .fs-sector-row { grid-template-columns:minmax(0,1fr) 55px 42px; gap:8px; padding:9px 7px; }
          .fs-sector-name { font-size:9px; }
          .fs-foot { align-items:flex-start; flex-direction:column; }
        }
        @media (prefers-reduced-motion:reduce) { .fs-variant *, .fs-variant *::before { animation-duration:.01ms!important; transition-duration:.01ms!important; } }
      `}</style>
      <header className="fs-shell fs-top">
        <a className="fs-brand" href="#top" aria-label="Aiversecity home">
          <span className="fs-logo"><svg viewBox="0 0 24 24" fill="none"><path d="m12 3 2.3 6.7L21 12l-6.7 2.3L12 21l-2.3-6.7L3 12l6.7-2.3L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg></span>
          <span><strong>Aiversecity</strong><small>Future skills · Malaysia</small></span>
        </a>
        <nav className="fs-nav" aria-label="Main navigation">
          <button onClick={() => setStarted(true)}>CV check</button>
          <button onClick={() => setStarted(true)}>SDGs</button>
          <button onClick={() => setStarted(true)}>Sources</button>
          <button className="fs-login" onClick={() => setStarted(true)}>Reviewer log in</button>
        </nav>
        <span className="fs-health"><i /> DATA LIVE</span>
      </header>

      <main id="top" className="fs-shell">
        <section className="fs-hero">
          <div>
            <div className="fs-eyebrow"><b /> A career compass for Malaysia’s AI era</div>
            <h1>Wondering how AI may change your work? <span>Look at the evidence.</span></h1>
            <p className="fs-intro">From who you are today to where you can be next. Explore the skills behind tomorrow’s roles—with sources, dates and uncertainty in view.</p>
            <div className="fs-actions">
              <button className="fs-button fs-primary" onClick={() => setStarted(true)}>Start with my profile <Arrow /></button>
              <button className="fs-button fs-secondary" onClick={() => document.getElementById("sectors")?.scrollIntoView({ behavior: "smooth" })}>Explore the radar</button>
            </div>
            <p className="fs-note"><span>Your direction, your decision.</span> No predictions about your individual future.</p>
          </div>
          <div className="fs-dataset" aria-label="Dataset overview">
            <div className="fs-card-head"><div><strong>Inside the dataset</strong><br /><small>Malaysia · 2026 edition</small></div><span className="fs-live"><i /> Updated</span></div>
            <div className="fs-stat-grid">
              <div className="fs-stat"><strong>684</strong><span>future-facing roles</span></div>
              <div className="fs-stat"><strong>1,248</strong><span>canonical skills</span></div>
              <div className="fs-stat"><strong>3,912</strong><span>trend observations</span></div>
              <div className="fs-stat"><strong>126</strong><span>cited sources</span></div>
            </div>
            <div className="fs-dataset-foot"><span>Forecast horizon <b>2026—2030</b></span><span>Evidence-led</span></div>
            <div className="fs-stamp">BUILT FOR REAL CHOICES<span>SDG 4 · SDG 8</span></div>
          </div>
        </section>

        <section className="fs-section" aria-labelledby="steps-title">
          <div className="fs-section-heading">
            <div><div className="fs-kicker">A clear way forward</div><h2 id="steps-title">Four steps. A few minutes.</h2></div>
            <p>Start wherever you are. Explore at your own pace; every forecast is an estimate, not a verdict.</p>
          </div>
          <ol className="fs-steps">
            {steps.map((step) => <li className="fs-step" key={step.n}><span className="fs-step-no">{step.n}</span><span className="fs-step-mark">{step.mark}</span><h3>{step.title}</h3><p>{step.copy}</p></li>)}
          </ol>
        </section>

        <section className="fs-section" id="sectors" aria-label="Sector demand overview">
          <div className="fs-sector-panel">
            <div className="fs-sector-main">
              <div className="fs-section-heading" style={{ marginBottom: 0 }}>
                <div><div className="fs-kicker">Signals, not promises</div><h2>Sectors at a glance</h2></div>
                <div className="fs-scenario" role="group" aria-label="Forecast scenario">
                  {["Baseline", "Faster AI", "Slower AI"].map((item) => <button key={item} aria-pressed={scenario === item} onClick={() => setScenario(item)}>{item}</button>)}
                </div>
              </div>
              <p>Average projected demand change by industry. Select a sector to see a sample role and its outlook.</p>
              <div className="fs-sector-list">
                {sectors.map((sector, index) => <button className="fs-sector-row" key={sector.name} aria-pressed={activeSector === index} onClick={() => setActiveSector(index)}>
                  <span className="fs-sector-name">{sector.name}<small>{sector.roles} occupations · {sector.short}</small></span>
                  <span className="fs-bar"><i style={{ width: `${Math.max(10, sector.change * 4)}%` }} /></span>
                  <span className="fs-percent">+{sector.change.toFixed(1)}%</span>
                </button>)}
              </div>
            </div>
            <aside className="fs-role-card" aria-live="polite">
              <div className="fs-role-top"><span>Sample role · {chosen.short}</span><span className="fs-role-icon">↗</span></div>
              <div><h3>{activeSector === 0 ? "Data security analyst" : activeSector === 1 ? "Sustainability consultant" : activeSector === 2 ? "Financial risk analyst" : "Learning experience designer"}</h3><p>One of {chosen.roles} occupations in {chosen.name.toLowerCase()}.</p></div>
              <div className="fs-role-foot"><div><small>PROJECTED DEMAND</small><strong>+{chosen.change.toFixed(1)}%</strong></div><button aria-label="Explore this role" onClick={() => setStarted(true)}><Arrow /></button></div>
            </aside>
          </div>
        </section>
        <footer className="fs-foot"><span>Estimates, not guarantees. A tool to support your decision—not make it for you.</span><strong>UN SDG 4 · SDG 8 · MALAYSIA</strong></footer>
      </main>
      {started && <div className="fs-toast" role="status">Your next step is ready — start with a profile to see roles matched to your skills.</div>}
    </div>
  );
}
