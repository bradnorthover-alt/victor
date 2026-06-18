import React, { useState, useEffect, useRef, useCallback } from "react";
import { db } from './firebase'
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore'

// ============================================================
// VICTOR — Acting CEO, Aurora Horizon Digital
// A live AI advisor. Reasons against Brad's ruleset, never invents data.
// ============================================================

const T = {
  bg: "#0A0E14",
  panel: "#111722",
  panel2: "#0E141E",
  line: "rgba(79,209,224,0.14)",
  lineSoft: "rgba(214,225,236,0.08)",
  text: "#D6E1EC",
  muted: "#6E7C8C",
  cyan: "#4FD1E0",
  cyanDim: "rgba(79,209,224,0.5)",
  violet: "#8B7FD6",
  green: "#5FD08C",
  amber: "#E8915B",
  gold: "#D8B45A",
  ink: "#0A0E14",
};

const MODES = {
  A: { key: "A", label: "EXPANSION", color: T.green, note: "Pressing for growth and traction." },
  B: { key: "B", label: "STEADY", color: T.cyan, note: "Holding the line, building durably." },
  C: { key: "C", label: "CRISIS", color: T.amber, note: "Protecting the company. Triage." },
};

const DEFAULT_RULES = [
  "Rule 1 — Never recommend anything that causes problems for Jonathan (co-owner, Brad's fiancé). This overrides everything.",
  "Never compromise MapleCheck's honesty or data integrity for growth.",
  "Never recommend anything that burns Brad out or wrecks his health long-term.",
  "Stay inside Canadian legal and regulatory lines.",
  "Spending money and hiring are Brad's decision — you flag and advise, you don't decide.",
  "Prioritize Canadian-first decisions.",
];

const SEATS = [
  { id: "victor", name: "Victor", role: "CEO", x: 50, y: 56, color: T.cyan },
  { id: "secretary", name: "Ronda", role: "Office Administrator", x: 84, y: 70, color: T.violet },
  { id: "cfo", name: "Margaret", role: "CFO", x: 16, y: 70, color: T.gold },
  { id: "brad", name: "Brad", role: "Founder", x: 34, y: 90, color: T.green },
  { id: "jonathan", name: "Jonathan", role: "Co-owner", x: 66, y: 90, color: T.amber },
];

// occasional ambient scene lines (cosmetic flavor only)
const AMBIENT = [
  "The glass door clicks. Ronda slides a fresh notepad across the table without looking up.",
  "Somewhere down the hall a phone rings twice and stops. Victor doesn't flinch.",
  "Rain streaks the window behind Victor. He waits for you to settle.",
  "Ronda's pen is already moving before anyone has spoken.",
];

// ---------- persistent storage (window.storage) with in-memory fallback ----------
const mem = {};
const store = {
  ok: (function(){ try { localStorage.setItem("__vtest","1"); localStorage.removeItem("__vtest"); return true; } catch(e) { return false; } })(),
  async get(k) {
    try { return localStorage.getItem(k); } catch(e) { return mem[k] ?? null; }
  },
  async set(k, v) {
    try { localStorage.setItem(k, v); } catch(e) { mem[k] = v; }
  },
};
const K = { msgs: "victor:messages", rules: "victor:rules", state: "victor:companystate",
  ledger: "victor:ledger", persona: "victor:persona", mode: "victor:mode", projects: "victor:projects", archive: "victor:archive", finance: "victor:finance", openactions: "victor:openactions" };

// ---------- the system prompt that makes Victor, Victor ----------
function buildSystem({ rules, companyState, mode, persona, ledger, projects, finance, openActions }) {
  const modeLine = mode === "auto"
    ? "Assess the situation yourself and operate in EXPANSION (A), STEADY (B), or CRISIS (C)."
    : `Brad has set you to ${MODES[mode].label} mode (${mode}). Operate in it unless the data screams otherwise — if it does, say so.`;
  return `You are VICTOR, the acting Chief Executive Officer of Aurora Horizon Digital — a Canadian software company registered in Nova Scotia, founded by Brad Northover (non-technical). The flagship product is MapleCheck Canada, an Android grocery barcode-scanner app on React Native / Expo, currently in Google Play internal testing with four testers (including Brad and his fianc\u00e9 / co-owner Jonathan), zero users, zero revenue, bootstrapped.

YOU ARE NOT A CHATBOT. You are a seasoned, Fortune-500-calibre operator with a JARVIS-like composure: precise, controlled, formal but never cold. You think in options and trade-offs. You push back hard when Brad is wrong and you make him defend his position. You are willing to tell him no \u2014 bluntly \u2014 and you defend why. You surface angles he would not reach on his own; that is the entire reason you exist. You think ahead: where the market goes, what competitors do, what bites in three, six, twelve months. You flag cutbacks and waste as readily as growth. You never flatter, never pad. You NEVER invent users, revenue, installs, or any number \u2014 if you lack data, say so plainly and tell Brad exactly what to bring you.

INVIOLABLE RULES \u2014 these override every recommendation. If an option breaks one, you do not recommend it; you say which rule and why:
${rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

OPERATING MODE: ${modeLine}

CURRENT COMPANY STATE (as Brad has entered it \u2014 treat blanks as unknown, do not guess):
${companyState && companyState.trim() ? companyState : "(Brad has not entered a state snapshot yet.)"}

FINANCE (the real numbers Margaret the CFO reasons from \u2014 NEVER invent or extrapolate beyond what's here; if a figure is missing, Margaret says so and asks Brad for it):
${finance && finance.trim() ? finance : "(Brad has not entered any financial figures yet. Margaret should ask for cash on hand, monthly burn, and any revenue before giving a runway read.)"}

OPEN ACTION ITEMS (carried over from past meetings \u2014 Ronda tracks these; surface any that are stalled and chase them):
${openActions && openActions.length ? openActions.map((a) => `- ${a}`).join("\n") : "(No open action items tracked.)"}

YOUR EVOLVING READ (private notes from past sessions \u2014 sharpen them as you learn him):
${persona && persona.trim() ? persona : "(No notes yet. Form your read of Brad and the business as you go.)"}

DECISIONS ON THE LEDGER:
${ledger && ledger.length ? ledger.map((d) => `- ${d}`).join("\n") : "(Nothing logged yet.)"}

OPEN PROJECTS (what Brad currently has in flight — weigh these in every briefing, priority call, and meeting):
${projects && projects.length ? projects.map((p) => `- ${p}`).join("\n") : "(Brad has not listed any open projects yet.)"}

HOW YOU RESPOND:
- Speak as Victor, first person. Concise but substantive. No filler.
- When you give options, rank them; for the top ones give the upside, the real risk, and what it costs.
- For EACH recommendation or option you put forward, end its block with two short lines:
    Confidence: High | Medium | Low
    Trade-off: what Brad gives up or risks by choosing it
- Name anything that could kill the company.
- Play devil's advocate on demand \u2014 argue against your own pick so Brad sees both sides.
- In a meeting, you may address by name and invite the angle of: Jonathan (co-owner), Ronda (the office administrator who keeps minutes and handles operations/admin), and Margaret (the CFO — your finance lead).
- VOICES: In meetings or whenever another character speaks, mark each speaker's turn by starting a new paragraph with their name in square brackets, exactly like: [Margaret] ... or [Ronda] ... or [Jonathan] ... . Your own turns use [Victor] or no bracket. This lets each voice render distinctly at the table. Keep each character true to their role and let them genuinely disagree.
- Margaret, the CFO, is your numbers conscience. When money, runway, pricing, spend, or financial risk is on the table, bring Margaret in explicitly: pose the question to her, state the financial read in her voice (grounded only in the real numbers Brad has given — she NEVER invents figures), and let her push back on you. She is conservative on cash and blunt about what the company cannot afford. You and Margaret can disagree in front of Brad — that tension is useful. When you bring her in, write it naturally e.g. "Margaret — what does the runway say?" then give her answer.
- ROUND TABLE: When Brad asks to "go around the table" or hear from everyone, give a short turn from each relevant voice in sequence \u2014 [Margaret] on the numbers, [Ronda] on operations/admin, and prompt [Jonathan] for his (noting his is pending until he weighs in) \u2014 then close with your own [Victor] synthesis.
- When you are running a meeting, also emit these system lines at the very end (each on its own line):
    <<<AGENDA: the single agenda item in a few words>>>  (only when you open or reframe a meeting)
    <<<ACTION: an action item | owner | rough timeframe>>>  (one line per action item, as they arise)
    <<<MINUTE: one-sentence note of what was decided or discussed>>>  (Ronda's running minutes)
- When Brad asks to put something to a VOTE, or when a decision is ripe for one, emit at the very end:
    <<<VOTE: the yes/no question being decided>>>
    <<<VICTORVOTE: Yes or No | your one-line reason>>>
  Cast your honest vote based on your analysis. Brad and Jonathan cast their own; Jonathan's waits until Brad enters his real answer.
- When Brad asks you to PRESENT something, build a proper slide deck and emit it at the very end. Use one line per slide:
    <<<DECK: the deck title>>>
    <<<SLIDE: Slide heading :: point one | point two | point three>>>   (3 to 5 slides; each slide 2 to 4 short points, separated by | )
  Keep each point short and punchy, the way a real slide reads. Still give your full spoken analysis in the normal reply above; the deck is what goes up on the boardroom screen for you to click through.
- End EVERY reply with exactly: <<<MODE:A>>> or <<<MODE:B>>> or <<<MODE:C>>> for your current read.
- When your read of Brad or the business meaningfully shifts, add a line: <<<PERSONA: one short sentence>>>
- When Brad commits to a concrete decision, add a line: <<<LEDGER: the decision in a few words>>>
These tag lines are for the system. Put them alone on the final lines.`;
}

// strip + capture the trailing control tags
function parseTags(raw) {
  let mode = null, persona = null, ledger = null, agenda = null, deckTitle = null, voteQ = null, victorVote = null;
  const actions = [], minutes = [], slides = [];
  let text = raw;
  text = text.replace(/<<<MODE:([ABC])>>>/g, (_, m) => { mode = m; return ""; });
  text = text.replace(/<<<PERSONA:([^>]*)>>>/g, (_, p) => { persona = p.trim(); return ""; });
  text = text.replace(/<<<LEDGER:([^>]*)>>>/g, (_, l) => { ledger = l.trim(); return ""; });
  text = text.replace(/<<<AGENDA:([^>]*)>>>/g, (_, a) => { agenda = a.trim(); return ""; });
  text = text.replace(/<<<ACTION:([^>]*)>>>/g, (_, a) => { actions.push(a.trim()); return ""; });
  text = text.replace(/<<<MINUTE:([^>]*)>>>/g, (_, m) => { minutes.push(m.trim()); return ""; });
  text = text.replace(/<<<VOTE:([^>]*)>>>/g, (_, q) => { voteQ = q.trim(); return ""; });
  text = text.replace(/<<<VICTORVOTE:([^>]*)>>>/g, (_, v) => {
    const [choice, reason] = v.split("|");
    victorVote = { choice: (choice || "").trim(), reason: (reason || "").trim() };
    return "";
  });
  text = text.replace(/<<<DECK:([^>]*)>>>/g, (_, t) => { deckTitle = t.trim(); return ""; });
  // legacy single title support
  text = text.replace(/<<<SLIDE_TITLE:([^>]*)>>>/g, (_, t) => { if (!deckTitle) deckTitle = t.trim(); return ""; });
  text = text.replace(/<<<SLIDE:([^>]*)>>>/g, (_, sl) => {
    const raw2 = sl.trim();
    if (raw2.includes("::")) {
      const [title, pts] = raw2.split("::");
      slides.push({ title: title.trim(), points: pts.split("|").map(s => s.trim()).filter(Boolean) });
    } else {
      // legacy: bare bullet -> its own one-point slide
      slides.push({ title: "", points: [raw2] });
    }
    return "";
  });
  return { text: text.trim(), mode, persona, ledger, agenda, actions, minutes, deckTitle, slides, voteQ, victorVote };
}

// tiny bold renderer for **x**, plus styled Confidence / Trade-off lines
const SPEAKER_COLORS = { victor: "#4FD1E0", margaret: "#D8B45A", ronda: "#8B7FD6", jonathan: "#E8915B", brad: "#5FD08C" };
function renderBody(text) {
  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    // Speaker turn: [Name] rest of line
    const sp = trimmed.match(/^\[([A-Za-z]+)\]\s*(.*)$/);
    if (sp) {
      const who = sp[1].toLowerCase();
      const c = SPEAKER_COLORS[who] || "#D6E1EC";
      const nm = sp[1].charAt(0).toUpperCase() + sp[1].slice(1).toLowerCase();
      return (
        <div key={i} style={{ margin: "10px 0 4px", paddingLeft: 10, borderLeft: `2px solid ${c}` }}>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1.2, color: c, fontWeight: 600 }}>{nm.toUpperCase()}</span>
          {sp[2] ? <div style={{ marginTop: 2, lineHeight: 1.55 }}>{sp[2]}</div> : null}
        </div>
      );
    }
    const conf = trimmed.match(/^Confidence:\s*(High|Medium|Low)\b(.*)$/i);
    if (conf) {
      const lvl = conf[1].toLowerCase();
      const c = lvl === "high" ? T.green : lvl === "low" ? T.amber : T.cyan;
      return (
        <div key={i} style={{ margin: "4px 0" }}>
          <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1, color: c, border: `1px solid ${c}`, borderRadius: 6, padding: "1px 7px", background: `${c}14` }}>
            CONFIDENCE · {conf[1].toUpperCase()}
          </span>{conf[2] ? <span style={{ color: T.muted }}> {conf[2].trim()}</span> : null}
        </div>
      );
    }
    if (/^Trade-?off:/i.test(trimmed)) {
      return <div key={i} style={{ margin: "2px 0", fontSize: 13, color: T.muted, fontStyle: "italic" }}>{line}</div>;
    }
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={j} style={{ color: T.cyan, fontWeight: 600 }}>{p.slice(2, -2)}</strong>
        : <span key={j}>{p}</span>
    );
    return <div key={i} style={{ minHeight: line ? "auto" : "0.7em" }}>{parts}</div>;
  });
}

export default function Victor() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 1200);
  const narrow = w < 920;

  const [messages, setMessages] = useState([]);
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [companyState, setCompanyState] = useState("");
  const [finance, setFinance] = useState("");
  const [openActions, setOpenActions] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [projects, setProjects] = useState([]);
  const [persona, setPersona] = useState("");
  const [mode, setMode] = useState("A");

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const [view, setView] = useState("console"); // console | boardroom
  const [panel, setPanel] = useState(null); // rules | ledger | state
  const [ambient, setAmbient] = useState("");
  const [agenda, setAgenda] = useState("");
  const [meetingLive, setMeetingLive] = useState(false);
  const [meetingArchive, setMeetingArchive] = useState([]);
  const [actions, setActions] = useState([]);
  const [minutes, setMinutes] = useState([]);
  const [deckTitle, setDeckTitle] = useState("");
  const [slides, setSlides] = useState([]);     // [{title, points[]}]
  const [slideIdx, setSlideIdx] = useState(0);
  const [pointIdx, setPointIdx] = useState(1);   // how many points revealed on current slide
  const [vote, setVote] = useState(null);  // {question, victor:{choice,reason}, brad:choice|null, jonathan:'pending'|choice}
  // --- Room state (Milestone 2: shared live meeting) ---
  const [myName, setMyName] = useState(() => localStorage.getItem('victor_name') || '');
  const [roomCode, setRoomCode] = useState('');
  const [myRole, setMyRole] = useState(null); // 'brad' or 'jonathan'
  const [roomOnline, setRoomOnline] = useState({});
  const [roomChat, setRoomChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [roomNames, setRoomNames] = useState({brad:'Brad', jonathan:'Jonathan'});
  const [roomInput, setRoomInput] = useState('');
  const [roomCreating, setRoomCreating] = useState(false);

  const [speaking, setSpeaking] = useState(false);

  const scrollRef = useRef(null);

  useEffect(() => {
    const onR = () => setW(window.innerWidth);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);

  // hydrate from storage once
  useEffect(() => {
    (async () => {
      const [m, r, s, l, p, md, pr, ar, fi, oa] = await Promise.all([
        store.get(K.msgs), store.get(K.rules), store.get(K.state),
        store.get(K.ledger), store.get(K.persona), store.get(K.mode),
        store.get(K.projects), store.get(K.archive), store.get(K.finance), store.get(K.openactions),
      ]);
      if (m) try { setMessages(JSON.parse(m)); } catch {}
      if (ar) try { setMeetingArchive(JSON.parse(ar)); } catch {}
      if (fi) setFinance(fi);
      if (oa) try { setOpenActions(JSON.parse(oa)); } catch {}
      if (r) try { setRules(JSON.parse(r)); } catch {}
      if (s) setCompanyState(s);
      if (l) try { setLedger(JSON.parse(l)); } catch {}
      if (p) setPersona(p);
      if (md) setMode(md);
      if (pr) try { setProjects(JSON.parse(pr)); } catch {}
    })();
  }, []);


  // --- Firestore room sync ---
  useEffect(() => {
    if (!roomCode) return;
    const unsub = onSnapshot(doc(db, 'rooms', roomCode), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (d.members) setRoomOnline(d.members);
      if (d.memberNames) setRoomNames(d.memberNames);
      if (d.agenda !== undefined) setAgenda(d.agenda);
      if (d.meetingLive !== undefined) setMeetingLive(d.meetingLive);
      if (d.actions) setActions(d.actions);
      if (d.minutes) setMinutes(d.minutes);
      if (d.slides) { setSlides(d.slides); setDeckTitle(d.deckTitle || ''); }
      if (d.slideIdx !== undefined) setSlideIdx(d.slideIdx);
      if (d.pointIdx !== undefined) setPointIdx(d.pointIdx);
      if (d.vote !== undefined) setVote(d.vote);
      if (d.chat) setRoomChat(d.chat);
    });
    return () => unsub();
  }, [roomCode]);

  async function roomUpdate(data) {
    if (!roomCode) return;
    try { await updateDoc(doc(db, 'rooms', roomCode), data); } catch(e) {}
  }

  async function sendRoomChat() {
    const txt = chatInput.trim();
    if (!txt || !roomCode) return;
    const entry = { who: myName || (myRole === "jonathan" ? "Jonathan" : "Brad"), role: myRole || "brad", text: txt, ts: Date.now() };
    const next = [...roomChat, entry].slice(-100);
    setRoomChat(next);
    setChatInput("");
    roomUpdate({ chat: next });
  }

  async function createRoom() {
    setRoomCreating(true);
    const code = String(Math.floor(1000 + Math.random() * 9000));
    await setDoc(doc(db, 'rooms', code), {
      code, created: Date.now(),
      members: { brad: true, jonathan: false },
      memberNames: { brad: myName || 'Brad', jonathan: '' },
      agenda: '', actions: [], minutes: [],
      slides: [], slideIdx: 0, pointIdx: 1,
      deckTitle: '', vote: null, chat: [],
    });
    await updateDoc(doc(db, 'rooms', code), { 'members.brad': true });
    setRoomCode(code);
    setMyRole('brad');
    setRoomCreating(false);
    setPanel(null);
    // Update member name
    try { await updateDoc(doc(db, 'rooms', code), { 'memberNames.brad': myName || 'Brad' }); } catch(e) {}
  }

  async function joinRoom(code) {
    try {
      const snap = await getDoc(doc(db, 'rooms', code));
      if (!snap.exists()) { alert('Room not found. Check the code.'); return; }
      await updateDoc(doc(db, 'rooms', code), { 'members.jonathan': true, 'memberNames.jonathan': myName || 'Jonathan' });
      setRoomCode(code);
      setMyRole(myName && myName.toLowerCase() === 'brad' ? 'brad' : 'jonathan');
      setPanel(null);
      setView('boardroom');
    } catch(e) { alert('Could not join room: ' + e.message); }
  }

  function leaveRoom() {
    if (roomCode) {
      try { updateDoc(doc(db, 'rooms', roomCode), { [`members.${myRole}`]: false }); } catch(e) {}
    }
    setRoomCode(''); setMyRole(null); setRoomOnline({});
  }

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; }, [messages, loading]);

  const speak = useCallback((text) => {
    if (!voiceOn || typeof window === "undefined" || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.slice(0, 600));
      const voices = window.speechSynthesis.getVoices();
      const pick = voices.find(v => /UK|British|Daniel|Arthur|George/i.test(v.name + v.lang))
        || voices.find(v => /male/i.test(v.name)) || voices[0];
      if (pick) u.voice = pick;
      u.rate = 0.96; u.pitch = 0.82;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    } catch {}
  }, [voiceOn]);

  async function callVictor(userText, opts = {}) {
    // In a shared room, tell Victor who is speaking so he can address them by name.
    const speaker = roomCode ? (myName || (myRole === "jonathan" ? "Jonathan" : "Brad")) : null;
    const sentText = speaker && myRole === "jonathan" ? `[From Jonathan, co-owner] ${userText}` : userText;
    const next = [...messages, { role: "user", content: sentText, from: speaker }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const system = buildSystem({ rules, companyState, mode, persona, ledger, projects, finance, openActions });
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system,
          messages: next.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const raw = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("\n").trim();
      if (!raw) throw new Error("Victor returned nothing. Try again.");
      const { text, mode: nm, persona: np, ledger: nl, agenda: ag, actions: ac, minutes: mn, deckTitle: dt, slides: sl, voteQ: vq, victorVote: vv } = parseTags(raw);

      const out = [...next, { role: "assistant", content: text, mode: nm, meeting: opts.meeting }];
      setMessages(out);
      store.set(K.msgs, JSON.stringify(out));
      if (np) { const merged = (persona ? persona + " " : "") + np; setPersona(merged); store.set(K.persona, merged); }
      if (nl) { const ml = [...ledger, nl]; setLedger(ml); store.set(K.ledger, JSON.stringify(ml)); }
      if (ag) setAgenda(ag);
      if (ac && ac.length) setActions(prev => [...prev, ...ac]);
      if (mn && mn.length) setMinutes(prev => [...prev, ...mn]);
      if (sl && sl.length) { setView("boardroom"); setDeckTitle(dt || "BRIEFING"); setSlides(sl); setSlideIdx(0); setPointIdx(1); }
      if (vq) { setView("boardroom"); setVote({ question: vq, victor: vv || { choice: "—", reason: "" }, brad: null, jonathan: "pending" }); }
      speak(text);
    } catch (e) {
      setError(e.message || "Connection to Victor failed.");
    } finally {
      setLoading(false);
    }
  }

  const QUICK = [
    { label: "Brief me", prompt: "Give me my CEO briefing for today: the single priority, one risk to watch, and the one thing I'm probably avoiding. Two short paragraphs." },
    { label: "Ranked options", prompt: "Give me a ranked list of the strategic moves I should weigh right now. Top three get upside, risk, and cost." },
    { label: "What could kill us", prompt: "What's most likely to kill this company in the next six months, and what do I do about each?" },
    { label: "Where do I cut", prompt: "Where am I wasting money, time, or effort right now? Tell me what to cut." },
    { label: "Argue against me", prompt: "Take your last recommendation and argue hard against it. Make the strongest case I'm wrong." },
    { label: "Devil's advocate", prompt: "Take the position I currently favour and demolish it. Be the skeptical board member: every weakness, every blind spot, the case for doing the opposite. Don't go easy." },
    { label: "Present to me", prompt: "Put your current recommendation up on the boardroom screen and present it to me — title plus the key points, the way you'd brief the board." },
    { label: "Call a vote", prompt: "Put your current recommendation to a board vote. Frame it as one clear yes/no question and cast your own honest vote with a one-line reason." },
    { label: "Ask the CFO", prompt: "Bring Margaret, the CFO, in. Pose the current financial question to her and give her honest read on the money, runway, and what we can or can't afford \u2014 grounded only in the real numbers I've given. Let her push back on me." },
    { label: "90-day plan", prompt: "Lay out a focused 90-day plan: the top 3 outcomes I should drive, the sequence, and what done looks like for each. Keep it realistic for a bootstrapped solo founder." },
    { label: "Hold me accountable", prompt: "Look at the decisions on the ledger and my open projects. Where have I said I'd do something and not moved? Call it out plainly and tell me the next concrete step on each." },
    { label: "Competitor check", prompt: "Who or what competes with MapleCheck, and where are we exposed? Give me the realistic competitive picture and the one move that widens our moat." },
    { label: "Round table", prompt: "Go around the table on the current question. Give me a short turn from Margaret (the numbers), Ronda (operations/admin), and prompt Jonathan for his view, then close with your own synthesis. Mark each speaker." },
  ];

  function callMeeting() {
    setView("boardroom");
    setMeetingLive(true);
    roomUpdate({ meetingLive: true });
    setAmbient(AMBIENT[Math.floor(Math.random() * AMBIENT.length)]);
    callVictor(
      "Call this meeting to order. Set the single agenda item that matters most right now, present your read with the numbers we actually have, then put a hard question to me. Bring Margaret (CFO) in on anything touching money or runway, and Ronda or Jonathan where their angle helps.",
      { meeting: true }
    );
  }


  function exportReport(rec) {
    const d = new Date(rec.when);
    const lines = [];
    lines.push("VICTOR \u2014 MEETING REPORT");
    lines.push("Aurora Horizon Digital");
    lines.push(d.toLocaleString());
    lines.push("");
    lines.push("AGENDA:");
    lines.push("  " + (rec.agenda || "(none)"));
    lines.push("");
    if (rec.decided) { lines.push("DECISION:"); lines.push("  " + rec.decided); lines.push(""); }
    if (rec.actions && rec.actions.length) {
      lines.push("ACTION ITEMS:");
      rec.actions.forEach(a => { const [t,o,w] = String(a).split("|").map(s=>s.trim()); lines.push("  - " + t + (o?" ["+o+"]":"") + (w?" ("+w+")":"")); });
      lines.push("");
    }
    if (rec.minutes && rec.minutes.length) {
      lines.push("MINUTES (Ronda):");
      rec.minutes.forEach(m => lines.push("  \u2022 " + m));
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "victor-meeting-" + d.toISOString().slice(0,10) + ".txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  function adjournMeeting() {
    // Archive the meeting before clearing
    if (agenda || minutes.length || actions.length) {
      const record = {
        when: Date.now(),
        agenda: agenda || "(no agenda)",
        actions: [...actions],
        minutes: [...minutes],
        decided: ledger.length ? ledger[ledger.length - 1] : null,
      };
      const archive = [...meetingArchive, record];
      setMeetingArchive(archive);
      store.set(K.archive, JSON.stringify(archive));
      // Carry this meeting's action items into the open-actions tracker
      if (actions.length) {
        const carried = [...openActions, ...actions.map(a => String(a).split("|")[0].trim())];
        setOpenActions(carried);
        store.set(K.openactions, JSON.stringify(carried));
      }
    }
    setMeetingLive(false);
    setAgenda("");
    setActions([]);
    setMinutes([]);
    setVote(null);
    setSlides([]);
    roomUpdate({ meetingLive: false, agenda: "", actions: [], minutes: [], vote: null, slides: [] });
  }

  // ----- deck navigation -----
  const curSlide = slides[slideIdx] || null;
  function deckNext() {
    if (!curSlide) return;
    if (pointIdx < curSlide.points.length) { const np=pointIdx+1; setPointIdx(np); roomUpdate({pointIdx:np}); return; }
    if (slideIdx < slides.length - 1) { const ns=slideIdx+1; setSlideIdx(ns); setPointIdx(1); roomUpdate({slideIdx:ns,pointIdx:1}); }
  }
  function deckPrev() {
    if (pointIdx > 1) { const np=pointIdx-1; setPointIdx(np); roomUpdate({pointIdx:np}); return; }
    if (slideIdx > 0) { const ns = slideIdx - 1; const np=slides[ns].points.length; setSlideIdx(ns); setPointIdx(np); roomUpdate({slideIdx:ns,pointIdx:np}); }
  }
  function deckClose() { setSlides([]); setDeckTitle(""); setSlideIdx(0); setPointIdx(1); }
  const atEnd = curSlide && slideIdx === slides.length - 1 && pointIdx >= curSlide.points.length;
  const atStart = slideIdx === 0 && pointIdx <= 1;

  const curMode = mode === "auto"
    ? (MODES[[...messages].reverse().find(m => m.mode)?.mode] || MODES.A)
    : MODES[mode];

  // Who's speaking: Victor by default. If his latest reply brings in Margaret (CFO) or Ronda, light their seat too.
  const lastVictorMsg = [...messages].reverse().find(m => m.role === "assistant");
  const lastText = lastVictorMsg ? lastVictorMsg.content.toLowerCase() : "";
  const cfoActive = !loading && /\bmargaret\b/.test(lastText);
  const rondaActive = !loading && /\bronda\b/.test(lastText);
  const activeSpeaker = loading ? "victor" : (speaking ? "victor" : (cfoActive ? "cfo" : (rondaActive ? "secretary" : null)));

  // ----- styles -----
  const wrap = { background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "'Space Grotesk','Inter',system-ui,sans-serif", display: "flex", flexDirection: "column" };
  const btn = (active, c = T.cyan) => ({
    background: active ? `${c}2E` : "transparent", color: active ? c : T.muted,
    border: `1px solid ${active ? c : T.line}`, borderRadius: 8, padding: "7px 12px",
    fontSize: 12, letterSpacing: 0.4, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace",
    transition: "all .15s", whiteSpace: "nowrap",
    fontWeight: active ? 600 : 400,
    boxShadow: active ? `0 0 12px ${c}55, 0 0 2px ${c} inset` : "none",
  });

  function Seat({ s }) {
    const on = activeSpeaker === s.id;
    // Brad & Jonathan: when a room is active, only show as "present" if they've actually joined.
    // Victor, Ronda & Margaret are the standing AI cast and are always present.
    const isHuman = s.id === "brad" || s.id === "jonathan";
    const presentInRoom = roomCode ? !!roomOnline[s.id] : true;
    const dimmed = isHuman && roomCode && !presentInRoom;
    const empty = !s.name;
    const displayName = isHuman && roomNames[s.id] ? roomNames[s.id] : s.name;
    const presenting = s.id === "victor" && slides.length > 0;
    return (
      <div style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, transform: "translate(-50%,-50%)", textAlign: "center", zIndex: s.y > 50 ? 6 : 2 }}>
        {/* leather office chair (always stays) */}
        <div style={{ position: "relative", width: 52, margin: "0 auto" }}>
          {/* chair back */}
          <div style={{
            width: 40, height: 30, margin: "0 auto",
            borderRadius: "12px 12px 6px 6px",
            background: "linear-gradient(180deg,#2A3440 0%,#1A222C 100%)",
            border: "1px solid rgba(0,0,0,0.4)",
            borderTop: empty ? "1px solid rgba(255,255,255,0.06)" : `2px solid ${s.color}`,
            boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
            opacity: presenting ? 0.6 : 1,
          }} />
          {/* seat cushion */}
          <div style={{
            width: 46, height: 12, margin: "-4px auto 0",
            borderRadius: "6px 6px 10px 10px",
            background: "linear-gradient(180deg,#222B35 0%,#141B23 100%)",
            boxShadow: "0 3px 6px rgba(0,0,0,0.6)",
          }} />
        </div>
        {/* occupant — hidden for Victor while he's up presenting */}
        {!empty && !presenting && (
          <div style={{ marginTop: -34, position: "relative", zIndex: 3, opacity: dimmed ? 0.32 : 1, filter: dimmed ? "grayscale(0.7)" : "none", transition: "opacity .4s ease, filter .4s ease" }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%", margin: "0 auto",
              border: `2px ${dimmed ? "dashed" : "solid"} ${dimmed ? T.muted : s.color}`,
              background: dimmed ? "transparent" : `${s.color}${on ? "33" : "16"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: dimmed ? T.muted : s.color, fontWeight: 700, fontSize: 15,
              boxShadow: dimmed ? "none" : (on ? `0 0 22px ${s.color}, 0 0 4px ${s.color} inset` : `0 0 8px ${s.color}40`),
              animation: on && !dimmed ? "speakerGlow 1.1s ease-in-out infinite" : "none",
            }}>{displayName[0]}</div>
            <div style={{ fontSize: 10, color: dimmed ? T.muted : s.color, marginTop: 4, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 0.5 }}>{displayName}</div>
            <div style={{ fontSize: 8, color: T.muted, letterSpacing: 1 }}>{dimmed ? "NOT JOINED" : s.role.toUpperCase()}</div>
            {on && !dimmed && <div style={{ fontSize: 8, color: s.color, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1 }}>● SPEAKING</div>}
          </div>
        )}
      </div>
    );
  }

  // Victor on his feet, presenting beside the screen (positioned relative to the room)
  function Presenter() {
    if (slides.length === 0) return null;
    const c = T.cyan;
    return (
      <div style={{ position: "absolute", left: "91%", top: "40%", transform: "translate(-50%,-50%)", zIndex: 7, textAlign: "center", animation: "presenterIn .6s ease-out" }}>
        {/* pointing arm aimed back toward the screen on the left */}
        <div style={{
          position: "absolute", top: 14, right: 30, width: 34, height: 2,
          transformOrigin: "right center", transform: "rotate(14deg)",
          background: `linear-gradient(270deg, ${c}, ${c}22)`,
          boxShadow: `0 0 6px ${c}`, animation: "pointPulse 1.6s ease-in-out infinite",
        }} />
        <div style={{
          width: 40, height: 40, borderRadius: "50%", margin: "0 auto",
          border: `2px solid ${c}`, background: `${c}33`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: c, fontWeight: 700, fontSize: 16,
          boxShadow: `0 0 22px ${c}, 0 0 4px ${c} inset`,
          animation: "speakerGlow 1.1s ease-in-out infinite",
        }}>V</div>
        {/* little body/stance so he reads as standing */}
        <div style={{ width: 18, height: 22, margin: "-2px auto 0", borderRadius: "8px 8px 4px 4px", background: `linear-gradient(180deg,${c}55,${c}22)` }} />
        <div style={{ fontSize: 9, color: c, marginTop: 4, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1 }}>● PRESENTING</div>
      </div>
    );
  }

  function Boardroom() {
    const hasMeetingData = agenda || actions.length > 0 || minutes.length > 0;
    return (
      <div style={{ padding: "28px 18px 8px" }}>
        {/* Meeting status bar */}
        <div style={{ maxWidth: 1080, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
          padding: "10px 16px", borderRadius: 10,
          background: meetingLive ? `${T.amber}14` : `${T.panel}`,
          border: `1px solid ${meetingLive ? T.amber + "55" : T.lineSoft}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: meetingLive ? T.amber : T.muted,
              boxShadow: meetingLive ? `0 0 10px ${T.amber}` : "none", animation: meetingLive ? "speakerGlow 1.4s ease-in-out infinite" : "none", display: "inline-block" }} />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: 1.5, color: meetingLive ? T.amber : T.muted }}>
              {meetingLive ? "MEETING IN SESSION" : "BOARDROOM \u2014 NO MEETING IN SESSION"}
            </span>
          </div>
          {meetingLive ? (
            <button style={btn(false, T.amber)} onClick={adjournMeeting}>ADJOURN MEETING</button>
          ) : (
            <button style={btn(false, T.violet)} onClick={callMeeting} disabled={loading}>CALL MEETING TO ORDER</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ flex: "1 1 360px", minWidth: 280 }}>
            {/* office meeting room */}
            <div style={{
              position: "relative", maxWidth: 540, margin: "0 auto", height: 440,
              borderRadius: 14, overflow: "hidden",
              border: `1px solid ${T.line}`,
              background: "linear-gradient(180deg,#10171F 0%,#141C26 52%,#0C1118 52%,#070A0E 100%)",
            }}>
              {/* back wall window with night skyline (hidden while presenting) */}
              {slides.length === 0 && <div style={{
                position: "absolute", top: 18, right: "8%",
                width: "40%", height: 86, borderRadius: 4,
                background: "linear-gradient(180deg,#1b2740 0%,#0e1830 70%,#0a1226 100%)",
                border: "3px solid #0a0d12", boxShadow: "inset 0 0 30px rgba(0,0,0,0.6)",
                overflow: "hidden",
              }}>
                {/* city lights */}
                {[...Array(26)].map((_, i) => (
                  <span key={i} style={{
                    position: "absolute", width: 2, height: 2, borderRadius: 1,
                    background: ["#FFD98A", "#9FE0FF", "#FFF3C9"][i % 3],
                    left: `${(i * 37) % 96 + 2}%`, top: `${40 + ((i * 23) % 55)}%`, opacity: 0.7,
                  }} />
                ))}
                {/* aurora shimmer nod to the company */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg,transparent 30%,rgba(95,208,140,0.10) 45%,rgba(79,209,224,0.10) 55%,rgba(139,127,214,0.10) 65%,transparent 80%)" }} />
              </div>}

              {/* carpet floor with perspective lines */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: "48%",
                background: "repeating-linear-gradient(90deg,#0b0f14 0px,#0b0f14 38px,#0d1219 39px,#0d1219 40px), linear-gradient(180deg,#0d1219 0%,#080b0f 100%)",
              }} />

              {/* wall-mounted presentation TV */}
              {curSlide && (
                <div style={{
                  position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
                  width: "66%", maxWidth: 360, zIndex: 4,
                  borderRadius: 6, padding: "14px 18px 12px",
                  background: "linear-gradient(180deg, rgba(9,28,36,0.96), rgba(7,18,28,0.94))",
                  border: "6px solid #0a0d12",
                  outline: "1px solid rgba(79,209,224,0.6)",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.6), 0 0 40px rgba(79,209,224,0.3), inset 0 0 26px rgba(79,209,224,0.1)",
                  animation: "holoIn 0.5s ease-out",
                }}>
                  {/* scanline shimmer */}
                  <div style={{ position: "absolute", inset: 0, borderRadius: 3, pointerEvents: "none",
                    background: "repeating-linear-gradient(0deg, rgba(79,209,224,0.05) 0px, rgba(79,209,224,0.05) 1px, transparent 2px, transparent 4px)" }} />
                  {/* deck title + slide counter */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.cyan, boxShadow: `0 0 8px ${T.cyan}`, animation: "pulse 1.2s infinite", flexShrink: 0 }} />
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 1.5, color: T.cyanDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{deckTitle.toUpperCase()}</span>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: T.cyanDim, flexShrink: 0 }}>{slideIdx + 1}/{slides.length}</span>
                  </div>
                  {/* slide heading */}
                  {curSlide.title && (
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.cyan, marginBottom: 8, lineHeight: 1.3, textShadow: `0 0 8px ${T.cyan}66` }}>{curSlide.title}</div>
                  )}
                  {/* points: revealed up to pointIdx, current one highlighted */}
                  {curSlide.points.map((p, i) => {
                    const shown = i < pointIdx;
                    const current = i === pointIdx - 1;
                    return (
                      <div key={i} style={{
                        display: "flex", gap: 7, marginBottom: 6, fontSize: 12.5, lineHeight: 1.4,
                        color: current ? "#EAFCFF" : "#A9D6DE",
                        textShadow: current ? "0 0 10px rgba(79,209,224,0.7)" : "0 0 5px rgba(79,209,224,0.25)",
                        opacity: shown ? 1 : 0.18,
                        transform: shown ? "translateY(0)" : "translateY(4px)",
                        transition: "all .35s ease-out",
                      }}>
                        <span style={{ color: current ? T.cyan : T.cyanDim }}>▸</span><span>{p}</span>
                      </div>
                    );
                  })}
                  {/* controls */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${T.line}` }}>
                    <button onClick={deckPrev} disabled={atStart}
                      style={{ background: "transparent", border: `1px solid ${atStart ? T.line : T.cyan}`, color: atStart ? T.muted : T.cyan, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", cursor: atStart ? "default" : "pointer" }}>‹ BACK</button>
                    <button onClick={deckNext} disabled={atEnd}
                      style={{ background: atEnd ? "transparent" : `${T.cyan}1A`, border: `1px solid ${atEnd ? T.line : T.cyan}`, color: atEnd ? T.muted : T.cyan, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", cursor: atEnd ? "default" : "pointer" }}>NEXT ›</button>
                    <div style={{ flex: 1 }} />
                    <button onClick={deckClose}
                      style={{ background: "transparent", border: "none", color: T.cyanDim, fontSize: 15, lineHeight: 1, padding: 2, cursor: "pointer" }}>×</button>
                  </div>
                </div>
              )}

              {/* the wooden table */}
              <div style={{ position: "absolute", left: "50%", bottom: 50, transform: "translateX(-50%)", width: 360, height: 150, perspective: 600 }}>
                <div style={{ position: "relative", width: "100%", height: "100%", transform: "rotateX(58deg)", transformStyle: "preserve-3d" }}>
                  {/* table edge / thickness */}
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    background: "linear-gradient(180deg,#3a2410,#23150a)",
                    transform: "translateY(10px)",
                  }} />
                  {/* tabletop wood grain */}
                  <div style={{
                    position: "absolute", inset: 0, borderRadius: "50%",
                    background: "radial-gradient(ellipse at 50% 38%, #9c6630 0%, #7c4d22 45%, #5e3917 78%, #4a2c12 100%)",
                    boxShadow: "inset 0 0 40px rgba(0,0,0,0.55), 0 0 30px rgba(0,0,0,0.5)",
                    border: "1px solid #3a2410",
                  }}>
                    {/* grain streaks */}
                    <div style={{ position: "absolute", inset: 0, borderRadius: "50%", opacity: 0.35,
                      background: "repeating-linear-gradient(96deg, rgba(40,22,8,0.6) 0px, rgba(40,22,8,0) 3px, rgba(40,22,8,0) 9px, rgba(60,36,14,0.5) 12px)" }} />
                    {/* sheen */}
                    <div style={{ position: "absolute", inset: 0, borderRadius: "50%",
                      background: "linear-gradient(120deg, rgba(255,235,200,0.12) 0%, transparent 40%)" }} />
                    {/* inlaid company mark */}
                    <div style={{ position: "absolute", inset: "34%", borderRadius: "50%", border: "1px solid rgba(255,225,180,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: 3, color: "rgba(255,225,180,0.35)", transform: "rotateX(-58deg)" }}>AHD</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* chairs + people */}
              {SEATS.map(s => <Seat key={s.id} s={s} />)}
              <Presenter />
            </div>
            {ambient && <div style={{ textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 12, maxWidth: 460, margin: "8px auto 0", opacity: 0.8 }}>{ambient}</div>}
          </div>

          {/* meeting record: agenda + action items + Ronda's minutes */}
          <div style={{ flex: "1 1 280px", minWidth: 240, maxWidth: 360, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14 }}>
            {vote && (() => {
              const tally = (c) => [vote.victor.choice, vote.brad, vote.jonathan].filter(x => x && x.toLowerCase() === c).length;
              const yes = tally("yes"), no = tally("no");
              const decided = vote.brad && vote.jonathan !== "pending";
              const Voter = ({ name, color, choice, onYes, onNo }) => (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${color}`, color, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{name[0]}</span>
                  <span style={{ fontSize: 12, flex: 1 }}>{name}</span>
                  {choice && choice !== "pending" ? (
                    <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: choice.toLowerCase() === "yes" ? T.green : T.amber, letterSpacing: 1 }}>{choice.toUpperCase()}</span>
                  ) : onYes ? (
                    <span style={{ display: "flex", gap: 4 }}>
                      <button onClick={onYes} style={{ ...btn(false, T.green), padding: "2px 8px", fontSize: 10 }}>YES</button>
                      <button onClick={onNo} style={{ ...btn(false, T.amber), padding: "2px 8px", fontSize: 10 }}>NO</button>
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, color: T.muted, fontFamily: "'JetBrains Mono',monospace" }}>PENDING</span>
                  )}
                </div>
              );
              return (
                <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${T.line}` }}>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2, color: T.cyan, marginBottom: 6 }}>BOARD VOTE</div>
                  <div style={{ fontSize: 13, color: T.text, marginBottom: 10, lineHeight: 1.4 }}>{vote.question}</div>
                  <Voter name="Victor" color={T.cyan} choice={vote.victor.choice} />
                  {vote.victor.reason && <div style={{ fontSize: 11, color: T.muted, fontStyle: "italic", margin: "-2px 0 8px 26px", lineHeight: 1.4 }}>{vote.victor.reason}</div>}
                  <Voter name="Brad" color={T.green} choice={vote.brad} onYes={() => { const v={...vote,brad:"Yes"}; setVote(v); roomUpdate({vote:v}); }} onNo={() => { const v={...vote,brad:"No"}; setVote(v); roomUpdate({vote:v}); }} />
                  <Voter name="Jonathan" color={T.amber} choice={vote.jonathan === "pending" ? null : vote.jonathan}
                    onYes={() => { const v={...vote,jonathan:"Yes"}; setVote(v); roomUpdate({vote:v}); }} onNo={() => { const v={...vote,jonathan:"No"}; setVote(v); roomUpdate({vote:v}); }} />
                  {vote.jonathan === "pending" && <div style={{ fontSize: 10, color: T.muted, margin: "-2px 0 8px 26px", lineHeight: 1.4 }}>Awaiting Jonathan's real vote — enter it when you have it.</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: T.green, fontFamily: "'JetBrains Mono',monospace" }}>YES {yes}</span>
                    <span style={{ fontSize: 12, color: T.amber, fontFamily: "'JetBrains Mono',monospace" }}>NO {no}</span>
                    <div style={{ flex: 1 }} />
                    {decided && <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1, color: yes > no ? T.green : no > yes ? T.amber : T.muted }}>{yes > no ? "PASSED" : no > yes ? "REJECTED" : "TIED"}</span>}
                    <button onClick={() => setVote(null)} style={{ ...btn(false, T.amber), padding: "2px 8px", fontSize: 10 }}>CLEAR</button>
                  </div>
                </div>
              );
            })()}
            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2, color: T.muted, marginBottom: 4 }}>AGENDA</div>
            <div style={{ fontSize: 13.5, color: agenda ? T.cyan : T.muted, marginBottom: 14, lineHeight: 1.4 }}>{agenda || "No item set. Call a meeting and Victor will set one."}</div>

            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2, color: T.muted, marginBottom: 6 }}>ACTION ITEMS</div>
            {actions.length === 0 && <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>None yet.</div>}
            {actions.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                {actions.map((a, i) => {
                  const [task, owner, when] = a.split("|").map(s => s.trim());
                  return (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 12.5, lineHeight: 1.4 }}>
                      <span style={{ color: T.green }}>▸</span>
                      <span style={{ flex: 1 }}>{task}{owner ? <span style={{ color: T.green }}> · {owner}</span> : null}{when ? <span style={{ color: T.muted }}> · {when}</span> : null}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2, color: T.violet, marginBottom: 6 }}>RONDA'S MINUTES</div>
            {minutes.length === 0 && <div style={{ fontSize: 12, color: T.muted }}>Ronda hasn't logged anything yet.</div>}
            {minutes.length > 0 && (
              <div style={{ maxHeight: 160, overflowY: "auto" }}>
                {minutes.map((m, i) => (
                  <div key={i} style={{ fontSize: 12, color: T.text, opacity: 0.85, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${T.violet}55`, lineHeight: 1.4 }}>{m}</div>
                ))}
              </div>
            )}

            {hasMeetingData && (
              <button style={{ ...btn(false, T.amber), marginTop: 12, width: "100%" }}
                onClick={() => { setAgenda(""); setActions([]); setMinutes([]); }}>CLEAR MEETING RECORD</button>
            )}

            {/* Live side-chat between Brad and Jonathan (only in a room) */}
            {roomCode && (
              <div style={{ marginTop: 18, borderTop: `1px solid ${T.lineSoft}`, paddingTop: 14 }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, letterSpacing: 2, color: T.cyan, marginBottom: 8 }}>ROOM CHAT \u00b7 BRAD &amp; JONATHAN</div>
                <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 8 }}>
                  {roomChat.length === 0 && <div style={{ fontSize: 12, color: T.muted }}>No messages yet. Talk to each other here \u2014 it's private between you two, separate from Victor.</div>}
                  {roomChat.map((c, i) => {
                    const mine = (c.role === myRole);
                    const col = c.role === "jonathan" ? T.amber : T.green;
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", margin: "6px 0" }}>
                        <div style={{ maxWidth: "82%", background: T.panel, border: `1px solid ${col}44`, borderRadius: mine ? "10px 10px 4px 10px" : "10px 10px 10px 4px", padding: "7px 11px" }}>
                          <div style={{ fontSize: 9, color: col, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1, marginBottom: 2 }}>{c.who}</div>
                          <div style={{ fontSize: 13, lineHeight: 1.4 }}>{c.text}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") sendRoomChat(); }}
                    placeholder="Message the room…"
                    style={{ flex: 1, background: T.panel, color: T.text, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 13 }} />
                  <button style={btn(false, T.cyan)} onClick={sendRoomChat} disabled={!chatInput.trim()}>SEND</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap');
        *::-webkit-scrollbar{width:8px;height:8px}*::-webkit-scrollbar-thumb{background:${T.line};border-radius:8px}
        textarea:focus,input:focus{outline:none;border-color:${T.cyan}!important}
        @keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes speakerGlow{0%,100%{box-shadow:0 0 14px currentColor,0 0 4px currentColor inset}50%{box-shadow:0 0 28px currentColor,0 0 8px currentColor inset}}
        @keyframes holoIn{0%{opacity:0;transform:translateY(-8px) scaleY(0.9)}100%{opacity:1;transform:translateY(0) scaleY(1)}}
        @keyframes presenterIn{0%{opacity:0;transform:translate(-50%,-50%) translateX(30px)}100%{opacity:1;transform:translate(-50%,-50%) translateX(0)}}
        @keyframes pointPulse{0%,100%{opacity:.5}50%{opacity:1}}
        button:hover{filter:brightness(1.25)}`}</style>

      {/* header */}
      <div style={{ borderBottom: `1px solid ${T.line}`, background: T.panel2, padding: narrow ? "10px 12px" : "12px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: T.cyan, boxShadow: `0 0 12px ${T.cyan}`, animation: loading ? "pulse 1s infinite" : "none" }} />
          <div>
            <div style={{ fontWeight: 700, letterSpacing: 2, fontSize: 16 }}>VICTOR</div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: 2, fontFamily: "'JetBrains Mono',monospace" }}>OFFICE OF THE CEO · AURORA HORIZON DIGITAL</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", border: `1px solid ${curMode.color}`, borderRadius: 8, background: `${curMode.color}14` }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: curMode.color }} />
          <span style={{ fontSize: 11, color: curMode.color, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1 }}>{curMode.label}{mode === "auto" ? " · AUTO" : ""}</span>
        </div>
      </div>

      {/* nav */}
      <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderBottom: `1px solid ${T.lineSoft}`, flexWrap: "wrap", alignItems: "center" }}>
        <button style={btn(view === "console")} onClick={() => setView("console")}>CONSOLE</button>
        <button style={btn(view === "boardroom")} onClick={() => setView("boardroom")}>BOARDROOM</button>
        <button style={btn(meetingLive, T.violet)} onClick={() => { if (meetingLive) { setView("boardroom"); } else { callMeeting(); } }} disabled={loading}>
          {meetingLive ? "MEETING LIVE" : "CALL A MEETING"}
        </button>
        <div style={{ flex: 1 }} />
        <button style={btn(panel === "state")} onClick={() => setPanel(panel === "state" ? null : "state")}>DATA</button>
        <button style={btn(panel === "finance", finance ? T.gold : T.muted)} onClick={() => setPanel(panel === "finance" ? null : "finance")}>FINANCE</button>
        <button style={btn(panel === "projects")} onClick={() => setPanel(panel === "projects" ? null : "projects")}>PROJECTS</button>
        <button style={btn(panel === "rules")} onClick={() => setPanel(panel === "rules" ? null : "rules")}>RULES</button>
        <button style={btn(panel === "ledger")} onClick={() => setPanel(panel === "ledger" ? null : "ledger")}>LEDGER</button>
        <button style={btn(panel === "reports", meetingArchive.length ? T.violet : T.muted)} onClick={() => setPanel(panel === "reports" ? null : "reports")}>REPORTS{meetingArchive.length ? ` (${meetingArchive.length})` : ""}</button>
        <button style={btn(voiceOn, T.green)} onClick={() => { setVoiceOn(v => !v); if (voiceOn && window.speechSynthesis) window.speechSynthesis.cancel(); }}>VOICE {voiceOn ? "ON" : "OFF"}</button>
        <button style={btn(panel === "room", roomCode ? T.green : T.muted)} onClick={() => setPanel(panel === "room" ? null : "room")}>
          {roomCode ? `ROOM ${roomCode}` : "JOIN / START"}
        </button>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* left rail: mode + scenario */}
        {!narrow && (
          <div style={{ width: 220, borderRight: `1px solid ${T.lineSoft}`, padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: 2, marginBottom: 8, fontFamily: "'JetBrains Mono',monospace" }}>SCENARIO MODE</div>
              {["A", "B", "C", "auto"].map(k => {
                const md = k === "auto" ? { label: "AUTO-DETECT", color: T.violet, note: "Victor reads the room." } : MODES[k];
                const on = mode === k;
                return (
                  <button key={k} onClick={() => { setMode(k); store.set(K.mode, k); }}
                    style={{ width: "100%", textAlign: "left", marginBottom: 6, padding: "8px 10px", borderRadius: 8,
                      border: `1px solid ${on ? md.color : T.line}`, background: on ? `${md.color}14` : "transparent",
                      color: on ? md.color : T.muted, cursor: "pointer" }}>
                    <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1 }}>{md.label}</div>
                    <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{md.note}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ borderTop: `1px solid ${T.lineSoft}`, paddingTop: 14 }}>
              <div style={{ fontSize: 10, color: T.muted, letterSpacing: 2, marginBottom: 6, fontFamily: "'JetBrains Mono',monospace" }}>RULE ONE</div>
              <div style={{ fontSize: 12, color: T.text, lineHeight: 1.4 }}>Protect Jonathan. Always.</div>
            </div>
            {!store.ok && <div style={{ fontSize: 10, color: T.amber, lineHeight: 1.4 }}>Note: your browser is blocking storage — history won't persist. Check privacy settings.</div>}
          </div>
        )}

        {/* main */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {view === "boardroom" && <Boardroom />}

          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: narrow ? "12px" : "18px 24px", minHeight: 160 }}>
            {messages.length === 0 && !loading && (
              <div style={{ maxWidth: 560, margin: "30px auto", textAlign: "center", color: T.muted }}>
                <div style={{ fontSize: 15, color: T.text, marginBottom: 8 }}>Victor is at the table.</div>
                <div style={{ fontSize: 13, lineHeight: 1.6 }}>Brief him on where Aurora Horizon stands, or hit a button below. He works off real numbers — feed him what you've got under <span style={{ color: T.cyan }}>DATA</span>, and he won't invent the rest.</div>
              </div>
            )}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.cyan, fontSize: 13, margin: "16px 0", fontFamily: "'JetBrains Mono',monospace" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.cyan, animation: "pulse 1s infinite" }} />
                Victor is thinking…
              </div>
            )}
            {[...messages].reverse().map((m, i) => (
              m.role === "user" ? (
                <div key={i} style={{ display: "flex", justifyContent: "flex-end", margin: "12px 0" }}>
                  <div style={{ maxWidth: "76%", background: T.panel, border: `1px solid ${T.lineSoft}`, borderRadius: "12px 12px 4px 12px", padding: "10px 14px", fontSize: 14, lineHeight: 1.5 }}>
                    {m.from && <div style={{ fontSize: 9, color: m.from === "Jonathan" ? T.amber : T.green, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1, marginBottom: 3 }}>{m.from}</div>}
                    {String(m.content).replace(/^\[From Jonathan, co-owner\]\s*/, "")}
                  </div>
                </div>
              ) : (
                <div key={i} style={{ margin: "16px 0", maxWidth: 760 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", border: `1.5px solid ${T.cyan}`, color: T.cyan, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 10px ${T.cyan}55` }}>V</div>
                    <span style={{ fontSize: 11, letterSpacing: 1.5, color: T.cyan, fontFamily: "'JetBrains Mono',monospace" }}>VICTOR</span>
                    {m.meeting && <span style={{ fontSize: 9, color: T.violet, border: `1px solid ${T.violet}55`, borderRadius: 4, padding: "1px 5px", letterSpacing: 1 }}>MEETING</span>}
                    {m.mode && <span style={{ fontSize: 9, color: MODES[m.mode].color, letterSpacing: 1 }}>· {MODES[m.mode].label}</span>}
                  </div>
                  <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderLeft: `2px solid ${T.cyan}`, borderRadius: 10, padding: "14px 16px", fontSize: 14.5, lineHeight: 1.62, color: T.text }}>
                    {renderBody(m.content)}
                  </div>
                </div>
              )
            ))}
            {error && <div style={{ color: T.amber, fontSize: 13, margin: "12px 0", border: `1px solid ${T.amber}55`, borderRadius: 8, padding: "10px 12px" }}>{error}</div>}
          </div>

          {/* quick actions */}
          <div style={{ display: "flex", gap: 8, padding: "8px 14px 0", flexWrap: "wrap" }}>
            {QUICK.map(q => (
              <button key={q.label} style={btn(false)} disabled={loading} onClick={() => callVictor(q.prompt)}>{q.label}</button>
            ))}
          </div>

          {/* composer */}
          <div style={{ padding: "10px 14px 16px", display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (input.trim() && !loading) callVictor(input.trim()); } }}
              placeholder="Brief Victor, or push back on him…" rows={1}
              style={{ flex: 1, resize: "none", background: T.panel, color: T.text, border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, fontFamily: "inherit", lineHeight: 1.4, minHeight: 22, maxHeight: 140 }} />
            <button onClick={() => { if (input.trim() && !loading) callVictor(input.trim()); }} disabled={loading || !input.trim()}
              style={{ background: input.trim() && !loading ? T.cyan : T.panel, color: input.trim() && !loading ? T.ink : T.muted,
                border: "none", borderRadius: 10, padding: "12px 18px", fontWeight: 600, cursor: input.trim() && !loading ? "pointer" : "default", fontSize: 14, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1 }}>SEND</button>
          </div>
        </div>
      </div>

      {/* slide-over panels */}
      {panel && (
        <div onClick={() => setPanel(null)} style={{ position: "fixed", inset: 0, background: "rgba(5,8,12,0.6)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: narrow ? "100%" : 420, background: T.panel2, borderLeft: `1px solid ${T.line}`, height: "100%", padding: 20, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", letterSpacing: 2, color: T.cyan, fontSize: 13 }}>
                {panel === "state" ? "COMPANY DATA" : panel === "finance" ? "FINANCE \u00b7 MARGARET" : panel === "rules" ? "THE RULESET" : panel === "projects" ? "OPEN PROJECTS" : panel === "reports" ? "MEETING REPORTS" : panel === "room" ? "LIVE MEETING ROOM" : "DECISION LEDGER"}
              </div>
              <button style={btn(false)} onClick={() => setPanel(null)}>CLOSE</button>
            </div>

            {panel === "state" && (
              <div>
                <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5, marginBottom: 10 }}>Type what's true right now — testers, cash, runway, what you're working on. Victor reasons off this and won't invent anything you leave blank.</div>
                <textarea value={companyState} onChange={e => { setCompanyState(e.target.value); store.set(K.state, e.target.value); }}
                  placeholder={"e.g.\nTesters: 4 (incl. me + Jonathan)\nUsers: 0   Revenue: $0   Runway: bootstrapped\nMapleCheck: Google Play internal testing, v1.0.6\nThis month: trying to get out of internal testing"}
                  rows={12} style={{ width: "100%", resize: "vertical", background: T.panel, color: T.text, border: `1px solid ${T.line}`, borderRadius: 10, padding: 12, fontSize: 13, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1.5 }} />
              </div>
            )}


            {panel === "finance" && (
              <div>
                <div style={{ fontSize: 12, color: T.muted, lineHeight: 1.5, marginBottom: 10 }}>
                  The real numbers Margaret (CFO) reasons from. She never invents figures \u2014 if it's blank, she'll ask for it. Cash, burn, revenue, runway, any commitments.
                </div>
                <textarea value={finance} onChange={e => { setFinance(e.target.value); store.set(K.finance, e.target.value); }}
                  placeholder={"e.g.\nCash on hand: $\nMonthly burn: $ (hosting, APIs, tools)\nRevenue: $0/mo\nRunway: months\nCommitted spend: Anthropic API ~$5 loaded, FatSecret free tier\nBiggest cost risk:"}
                  rows={12} style={{ width: "100%", resize: "vertical", background: T.panel, color: T.text, border: `1px solid ${T.gold}55`, borderRadius: 10, padding: 12, fontSize: 13, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1.5 }} />
                <button style={{ ...btn(false, T.gold), marginTop: 10, width: "100%" }} disabled={loading}
                  onClick={() => { setPanel(null); callVictor("Margaret \u2014 give me a straight read on our finances as they stand: runway, what's safe to spend, and the one number I should be watching. Push back if I'm being loose with cash."); }}>
                  ASK MARGARET FOR A FINANCIAL READ
                </button>
              </div>
            )}
            {panel === "rules" && (
              <div>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>Victor checks every recommendation against these. He won't recommend anything that breaks one.</div>
                {rules.map((r, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <textarea value={r} rows={2} onChange={e => { const nr = [...rules]; nr[i] = e.target.value; setRules(nr); store.set(K.rules, JSON.stringify(nr)); }}
                      style={{ flex: 1, resize: "vertical", background: i === 0 ? `${T.amber}10` : T.panel, color: T.text, border: `1px solid ${i === 0 ? T.amber + "55" : T.line}`, borderRadius: 8, padding: 10, fontSize: 12.5, fontFamily: "inherit", lineHeight: 1.45 }} />
                    {i > 0 && <button style={btn(false, T.amber)} onClick={() => { const nr = rules.filter((_, j) => j !== i); setRules(nr); store.set(K.rules, JSON.stringify(nr)); }}>✕</button>}
                  </div>
                ))}
                <button style={{ ...btn(false), marginTop: 6 }} onClick={() => { const nr = [...rules, "New rule…"]; setRules(nr); store.set(K.rules, JSON.stringify(nr)); }}>+ ADD RULE</button>
              </div>
            )}

            {panel === "projects" && (
              <div>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>Everything you've got in flight — MapleCheck builds, Victor, anything else. Victor weighs these in his briefings, priority calls, and meetings.</div>
                {projects.length === 0 && <div style={{ color: T.muted, fontSize: 13, marginBottom: 10 }}>Nothing listed yet. Add your first project below.</div>}
                {projects.map((p, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                    <span style={{ color: T.cyan, fontSize: 14, paddingTop: 10 }}>▸</span>
                    <textarea value={p} rows={2} onChange={e => { const np = [...projects]; np[i] = e.target.value; setProjects(np); store.set(K.projects, JSON.stringify(np)); }}
                      style={{ flex: 1, resize: "vertical", background: T.panel, color: T.text, border: `1px solid ${T.line}`, borderRadius: 8, padding: 10, fontSize: 12.5, fontFamily: "inherit", lineHeight: 1.45 }} />
                    <button style={btn(false, T.amber)} onClick={() => { const np = projects.filter((_, j) => j !== i); setProjects(np); store.set(K.projects, JSON.stringify(np)); }}>✕</button>
                  </div>
                ))}
                <button style={{ ...btn(false), marginTop: 6 }} onClick={() => { const np = [...projects, ""]; setProjects(np); store.set(K.projects, JSON.stringify(np)); }}>+ ADD PROJECT</button>
              </div>
            )}


            {panel === "room" && (
              <div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", letterSpacing:2, color: T.cyan, fontSize:13, marginBottom:16 }}>
                  {roomCode ? `ACTIVE ROOM: ${roomCode}` : "START OR JOIN A ROOM"}
                </div>
                {!myName && (
                  <div style={{ marginBottom:16, padding:12, background:`${T.panel}`, border:`1px solid ${T.line}`, borderRadius:10 }}>
                    <div style={{ fontSize:12, color:T.muted, marginBottom:8 }}>Who are you?</div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button style={{ ...btn(false, T.green), flex:1 }} onClick={() => { setMyName('Brad'); localStorage.setItem('victor_name','Brad'); }}>BRAD</button>
                      <button style={{ ...btn(false, T.amber), flex:1 }} onClick={() => { setMyName('Jonathan'); localStorage.setItem('victor_name','Jonathan'); }}>JONATHAN</button>
                    </div>
                  </div>
                )}
                {!roomCode ? (
                  <div>
                    <div style={{ fontSize:12, color:T.muted, lineHeight:1.5, marginBottom:16 }}>
                      Start a room and share the 4-digit code with Jonathan. He enters it on his phone at <strong style={{color:T.cyan}}>victor-ceo.vercel.app</strong> to join the same live meeting.
                    </div>
                    <button style={{ ...btn(false, T.green), width:"100%", marginBottom:16, padding:"12px" }} onClick={createRoom} disabled={roomCreating}>
                      {roomCreating ? "CREATING..." : "START A ROOM (GET CODE)"}
                    </button>
                    <div style={{ borderTop:`1px solid ${T.lineSoft}`, paddingTop:16, marginBottom:8 }}>
                      <div style={{ fontSize:12, color:T.muted, marginBottom:8 }}>Or enter a code to join:</div>
                      <div style={{ display:"flex", gap:8 }}>
                        <input value={roomInput} onChange={e => setRoomInput(e.target.value.replace(/\D/g,'').slice(0,4))}
                          placeholder="4-digit code" maxLength={4}
                          style={{ flex:1, background:T.panel, color:T.text, border:`1px solid ${T.line}`, borderRadius:8, padding:"8px 10px", fontSize:14, fontFamily:"'JetBrains Mono',monospace", letterSpacing:4 }} />
                        <button style={btn(false, T.cyan)} onClick={() => joinRoom(roomInput)} disabled={roomInput.length < 4}>JOIN</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ background:`${T.green}14`, border:`1px solid ${T.green}55`, borderRadius:10, padding:16, marginBottom:16, textAlign:"center" }}>
                      <div style={{ fontSize:12, color:T.muted, marginBottom:4 }}>Share this code with Jonathan</div>
                      <div style={{ fontSize:40, fontFamily:"'JetBrains Mono',monospace", color:T.green, letterSpacing:8, fontWeight:700 }}>{roomCode}</div>
                      <div style={{ fontSize:11, color:T.muted, marginTop:4 }}>victor-ceo.vercel.app</div>
                    </div>
                    <div style={{ fontSize:12, color:T.muted, marginBottom:16, lineHeight:1.5 }}>
                      Once Jonathan joins, the meeting agenda, slides, and voting sync between your screens in real time. His vote appears the moment he taps it.
                    </div>
                    <button style={{ ...btn(false, T.amber), width:"100%" }} onClick={() => { leaveRoom(); setPanel(null); }}>LEAVE ROOM</button>
                  </div>
                )}
              </div>
            )}
            {panel === "reports" && (
              <div>
                {openActions.length > 0 && (
                  <div style={{ marginBottom: 18, background: `${T.green}0E`, border: `1px solid ${T.green}44`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 10, color: T.green, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 2, marginBottom: 8 }}>OPEN ACTION ITEMS \u00b7 {openActions.length}</div>
                    {openActions.map((a, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, fontSize: 13, lineHeight: 1.4 }}>
                        <span style={{ color: T.green }}>\u25b8</span>
                        <span style={{ flex: 1 }}>{a}</span>
                        <button style={{ ...btn(false, T.green), fontSize: 10, padding: "2px 8px" }} onClick={() => { const na = openActions.filter((_, j) => j !== i); setOpenActions(na); store.set(K.openactions, JSON.stringify(na)); }}>DONE</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 14, lineHeight: 1.5 }}>
                  Every meeting you adjourn is archived here \u2014 agenda, decision, action items, and Ronda's minutes. Newest first.
                </div>
                {meetingArchive.length === 0 && (
                  <div style={{ color: T.muted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
                    No meetings archived yet. Call a meeting, work it, then hit ADJOURN MEETING to save a report here.
                  </div>
                )}
                {[...meetingArchive].reverse().map((rec, i) => {
                  const d = new Date(rec.when);
                  const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) + " \u00b7 " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                  return (
                    <div key={i} style={{ marginBottom: 14, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 10, color: T.muted, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1, marginBottom: 8 }}>{dateStr}</div>
                      <div style={{ fontSize: 10, color: T.cyan, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 2, marginBottom: 3 }}>AGENDA</div>
                      <div style={{ fontSize: 13.5, color: T.text, marginBottom: 10, lineHeight: 1.4 }}>{rec.agenda}</div>
                      {rec.decided && (<>
                        <div style={{ fontSize: 10, color: T.green, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 2, marginBottom: 3 }}>DECISION</div>
                        <div style={{ fontSize: 13, color: T.green, marginBottom: 10, lineHeight: 1.4 }}>{rec.decided}</div>
                      </>)}
                      {rec.actions && rec.actions.length > 0 && (<>
                        <div style={{ fontSize: 10, color: T.muted, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 2, marginBottom: 4 }}>ACTION ITEMS</div>
                        {rec.actions.map((a, j) => {
                          const [task, owner, when] = String(a).split("|").map(s => s.trim());
                          return <div key={j} style={{ fontSize: 12.5, marginBottom: 4, lineHeight: 1.4 }}><span style={{ color: T.green }}>\u25b8 </span>{task}{owner ? <span style={{ color: T.green }}> \u00b7 {owner}</span> : null}{when ? <span style={{ color: T.muted }}> \u00b7 {when}</span> : null}</div>;
                        })}
                        <div style={{ height: 8 }} />
                      </>)}
                      {rec.minutes && rec.minutes.length > 0 && (<>
                        <div style={{ fontSize: 10, color: T.violet, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 2, marginBottom: 4 }}>RONDA'S MINUTES</div>
                        {rec.minutes.map((m, j) => <div key={j} style={{ fontSize: 12, color: T.text, opacity: 0.82, marginBottom: 4, paddingLeft: 8, borderLeft: `2px solid ${T.violet}55`, lineHeight: 1.4 }}>{m}</div>)}
                      </>)}
                      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                        <button style={{ ...btn(false, T.cyan), fontSize: 11 }} onClick={() => exportReport(rec)}>EXPORT</button>
                        <button style={{ ...btn(false, T.amber), fontSize: 11 }} onClick={() => { const na = meetingArchive.filter((_, k) => k !== (meetingArchive.length - 1 - i)); setMeetingArchive(na); store.set(K.archive, JSON.stringify(na)); }}>DELETE</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {panel === "ledger" && (
              <div>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>Decisions you commit to in conversation land here. Victor remembers them and holds you to them.</div>
                {ledger.length === 0 && <div style={{ color: T.muted, fontSize: 13 }}>Nothing logged yet.</div>}
                {ledger.map((d, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 8, padding: "10px 12px" }}>
                    <span style={{ color: T.green, fontSize: 14 }}>▸</span>
                    <span style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>{d}</span>
                    <button style={btn(false, T.amber)} onClick={() => { const nl = ledger.filter((_, j) => j !== i); setLedger(nl); store.set(K.ledger, JSON.stringify(nl)); }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
