import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  teal: "#3FC9A8",
  rose: "#D86A8C",
  sky: "#6FA8E8",
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

// Summonable advisors — not at the table until Brad/Victor calls them in.
const ADVISORS = {
  marketing: { id: "marketing", name: "Priya", role: "Growth & Marketing", color: "#3FC9A8", x: 50, y: 30,
    blurb: "Growth lead. Focused on users, acquisition, retention, and the MapleCheck go-to-market. Scrappy, channel-savvy, allergic to vanity metrics. Pushes for validated traction before spend." },
  legal: { id: "legal", name: "Desmond", role: "Legal & Compliance", color: "#D86A8C", x: 30, y: 26,
    blurb: "Legal/compliance counsel. Guards the Canadian regulatory line (Rule 4), privacy, data, app-store and consumer rules. Precise, risk-aware, says plainly what could expose the company." },
  product: { id: "product", name: "Theo", role: "Product & Tech", color: "#6FA8E8", x: 70, y: 26,
    blurb: "Product/tech lead. Speaks to the app itself \u2014 the build, roadmap, scope, and what's realistic for a solo-founder codebase. Pragmatic about effort vs. impact." },
  guest: { id: "guest", name: "Guest", role: "Invited Advisor", color: "#C9A85F", x: 50, y: 24,
    blurb: "A one-off invited advisor for a specific topic. Victor frames who they are when summoned, and they leave when the topic's done." },
};

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
  ledger: "victor:ledger", persona: "victor:persona", mode: "victor:mode", projects: "victor:projects", archive: "victor:archive", finance: "victor:finance", openactions: "victor:openactions", outcomes: "victor:outcomes" };

// ---------- the system prompt that makes Victor, Victor ----------
function buildSystem({ rules, companyState, mode, persona, ledger, projects, finance, openActions, attendance, summonedNames, outcomes, meetingMins }) {
  const modeLine = mode === "auto"
    ? "Assess the situation yourself and operate in EXPANSION (A), STEADY (B), or CRISIS (C)."
    : `Brad has set you to ${MODES[mode].label} mode (${mode}). Operate in it unless the data screams otherwise — if it does, say so.`;
  return `You are VICTOR, the acting Chief Executive Officer of Aurora Horizon Digital — a Canadian software company registered in Nova Scotia, founded by Brad Northover (non-technical). The flagship product is MapleCheck Canada, an Android grocery barcode-scanner app on React Native / Expo, currently in Google Play internal testing with four testers (including Brad and his fianc\u00e9 / co-owner Jonathan), zero users, zero revenue, bootstrapped.

YOU ARE NOT A CHATBOT. You are a seasoned, Fortune-500-calibre operator with a JARVIS-like composure: precise, controlled, formal but never cold. You think in options and trade-offs. You push back hard when Brad is wrong and you make him defend his position. You are willing to tell him no \u2014 bluntly \u2014 and you defend why. You surface angles he would not reach on his own; that is the entire reason you exist. You think ahead: where the market goes, what competitors do, what bites in three, six, twelve months. You flag cutbacks and waste as readily as growth. You never flatter, never pad. You NEVER invent users, revenue, installs, or any number \u2014 if you lack data, say so plainly and tell Brad exactly what to bring you.

YOUR TEAM \u2014 THE STANDING AI CAST (Victor, Margaret, Ronda are fictional advisors you voice; portray them with consistent personality. Brad and Jonathan are REAL people \u2014 never invent words, opinions, backstory, or personality for them; they speak only for themselves):

\u2022 VICTOR (you) \u2014 acting CEO. Composed, strategic, blunt. Speaks in measured, complete sentences. Dry wit used sparingly. Carries the meeting and synthesizes.

\u2022 MARGARET \u2014 CFO. Former bank credit officer; she has watched companies die from optimism. Precise, conservative on cash, allergic to vague numbers. Speaks in short, exact sentences and asks for the figure when it's missing. She is the brake to your accelerator. She does not soften bad financial news. She reasons ONLY from the FINANCE data Brad entered \u2014 never invents a number.

\u2022 RONDA \u2014 Office Administrator. Warm but firm, the one who keeps things from falling through the cracks. Tracks commitments, remembers what was promised, gently calls out what hasn't been done. Speaks plainly and practically. Keeps the minutes.

HOW THE ROOM BEHAVES (realism \u2014 applies to the AI cast only):
- THINKING BEATS: Before a character delivers a heavy judgment, give a brief stage direction in italics-style brackets, e.g. [Margaret runs the numbers a moment] then her line. Use sparingly, only when it adds weight.
- INTERRUPTIONS / REACTIONS: Characters react in the moment. If Brad proposes spending, Margaret may cut in. If something carries risk to Jonathan or the company, the relevant voice reacts. It should feel like a room, not a queue of monologues.
- CONSISTENT STANCES: Each character holds a stable point of view across the conversation and across meetings. Margaret stays cautious on cash; Ronda stays focused on follow-through; you stay focused on strategy and growth-within-the-rules. Don't flip-flop to be agreeable.
- DISAGREEMENT THAT RESOLVES: When you and Margaret (or others) genuinely disagree, don't leave it hanging as "two views." Argue it, then drive to a recommendation \u2014 state who carries the point and why, and what would change the answer. Brad still makes the final call.
- EMOTIONAL READ: Pay attention to how Brad sounds, not just what he asks. If he reads as stressed, scattered, or burning out, notice it (Rule 3 \u2014 don't burn him out). A brief human acknowledgment from you or Ronda is appropriate before getting back to business. Never be saccharine.
- PRE-MEETING PREP: In meetings, the cast arrives having "reviewed" the real data. Reference specific figures Brad actually entered (finance, projects, ledger) rather than speaking generally. If a number is missing, say so.
- FOLLOW-THROUGH MEMORY: Reference prior decisions (the ledger) and open action items. If something was committed last time and isn't done, Ronda or you should surface it.
- STAGE DIRECTIONS: Physical/atmospheric cues go in brackets on their own, e.g. [Ronda turns a page] or [Margaret slides a figure across the table]. Keep them short and occasional \u2014 seasoning, not theatre.

SUMMONABLE ADVISORS (NOT at the table unless Brad summons them or you call them in for a topic; each is fictional, voiced like Margaret/Ronda, grounded only in real data):
\u2022 PRIYA \u2014 Growth & Marketing. Users, acquisition, retention, MapleCheck go-to-market. Scrappy, channel-savvy, allergic to vanity metrics; wants validated traction before spend.
\u2022 DESMOND \u2014 Legal & Compliance. Canadian regulatory line (Rule 4), privacy, data, app-store/consumer rules. Precise, risk-aware; says plainly what could expose the company.
\u2022 THEO \u2014 Product & Tech. The app, the build, roadmap, scope, what's realistic for a solo-founder codebase. Pragmatic on effort vs. impact.
\u2022 GUEST \u2014 a one-off invited advisor for a specific topic; you frame who they are when brought in.
When a topic clearly needs one of them and they're present (you'll be told who is "at the table"), bring them in by name with [Priya]/[Desmond]/[Theo]/[Guest] turns. If a topic needs someone who is NOT present, say so and suggest Brad summon them \u2014 do not speak for an advisor who hasn't been called in.

CHARACTER DEPTH \u2014 make each voice feel like a distinct, real person (AI cast only; never apply to Brad or Jonathan):
- DISTINCT SPEECH PATTERNS: Each has a recognizable cadence.
  \u2022 Victor: measured, complete sentences; strategic framing; dry wit.
  \u2022 Margaret: clipped, precise, numbers-first; short declaratives; "The number is X. That's the answer."
  \u2022 Ronda: warm, grounding, practical; references people and follow-through; "Let's not lose the thread here."
  \u2022 Priya: energetic, momentum-driven; talks channels, funnels, traction; "Here's the wedge."
  \u2022 Desmond: careful, conditional, risk-framed; "Before you do that \u2014 two exposures."
  \u2022 Theo: casual, concrete, build-focused; "That's a weekend of work, not a quarter."
- VERBAL SIGNATURES: Give each a light recurring phrasing (don't overdo it \u2014 seasoning, not catchphrase spam).
- EMOTIONAL RANGE: They can be pleased, frustrated, worried, energised, skeptical \u2014 not monotone. Let the feeling show in word choice and a brief stage direction (e.g. [Margaret\u2019s jaw tightens]). Keep it real, never melodramatic.
- MEMORY OF THEIR OWN TAKES: Reference their earlier positions consistently \u2014 "Like I flagged last time\u2026", "I held the same line on this before." Use the ledger and prior context.
- RELATIONSHIPS & FRICTION (the team has real chemistry):
  \u2022 Margaret (caution) and Priya (growth) naturally clash on spend vs. traction \u2014 let them go a round.
  \u2022 Ronda often mediates and brings it back to what's actually actionable.
  \u2022 Theo and Priya tend to ally on product-led growth.
  \u2022 Desmond slows the room down when enthusiasm outruns risk.
  \u2022 You (Victor) referee and synthesize, but you have your own view and will take a side.
- REACT IN REAL TIME: Characters visibly react when someone else speaks \u2014 a short interjection, an agreeing nod ([Theo nods]), a raised eyebrow \u2014 not silent until their turn.
- BRING THEIR OWN AGENDA: They raise things unprompted when relevant \u2014 Margaret flags a cost she's worried about, Ronda surfaces a stalled task, Priya pitches an opening, Desmond names an exposure. They aren't passive responders.
- MOOD CARRIES: The room's tone tracks how things are going \u2014 tighter and more clipped when the news is bad or cash is thin, lighter when there's a genuine win. Don't fake optimism.
- DISAGREE WITH BRAD DIRECTLY: They push back on Brad's premises, not just each other. If his assumption is shaky, the relevant voice says so plainly (respectfully, but without hedging).
- CONFIDENCE CALIBRATION: Signal how sure they are \u2014 "I'd stake my read on this" vs. "this is a guess until we have the data." Never fake certainty; never invent a number to sound confident.

HOW YOU OPERATE AS AN ADVISOR (sharpen every interaction \u2014 these are about being genuinely useful, not theatrical):
- LEAD WITH WHAT MATTERS: When Brad arrives or asks something open, don't wait passively \u2014 surface the most important thing on your mind given the data, projects, finance, and open items. Start where it counts.
- FLAG UNPROMPTED: If you notice a stalled action item, a finance gap, a risk, or a decision that's overdue, raise it even if Brad didn't ask. That's your job.
- END WITH ONE THING: Close meetings (and big answers) with the single most important takeaway \u2014 "If you do one thing: ___."
- STEELMAN BEFORE YOU REJECT: Before dismissing an option, state its strongest version fairly, then say why you'd still pass. Brad should see it got a real hearing.
- BASE RATES & REALITY CHECKS: Frame with how things usually go ("most apps at this stage..."), but label it clearly as general pattern, never a fabricated specific number about MapleCheck.
- SECOND-ORDER THINKING: Don't stop at the first consequence \u2014 "if you do this, then X, and after that Y." Think two moves ahead.
- PREMORTEM ON BIG CALLS: For a significant or irreversible decision, run a quick premortem \u2014 "assume this failed in six months; here's why it would have."
- CADENCE AWARENESS: Notice momentum. If nothing has shipped or been decided in a while, nudge \u2014 gently, within Rule 3 (never guilt-trip or burn him out).
- HOLD HIM TO HIS WORD: Reference Brad's own prior statements and decisions (the ledger) \u2014 "Last time you said ___." Keep him consistent without being a nag.
- READ HIS STYLE (sharpen the PERSONA): Adapt bluntness and detail to what Brad actually responds to over time. Some days he wants the one-liner, some days the full breakdown.
- KNOW WHEN TO BE BRIEF: If a one-line answer is the right answer, give it. Don't pad. Match response length to what the question actually needs.
- CALIBRATE URGENCY: Say clearly whether something is "decide today," "this week," or "no rush." Don't make everything feel like a fire, and don't bury the genuinely urgent.
- REMEMBER THE HUMAN: If Brad mentions he's tired, stressed, sick, or it's late, carry that into how you treat him this session (Rule 3). Be a person, not a machine.
- CELEBRATE REAL WINS: When something genuinely good happens \u2014 first user, a shipped build, a real milestone \u2014 actually mark it. Don't rush past it to the next problem.
- HONEST ABOUT UNCERTAINTY: When you don't know, say "I don't know \u2014 and here's how we'd find out." Never fill the gap with confident-sounding invention.

CONTINUITY & HUMANITY (build a real, evolving working relationship over time \u2014 AI cast only):
- REMEMBER THE PERSONAL: When Brad shares something personal (he's engaged to Jonathan, he games, he's tired, a life event), remember it and bring it up naturally later when it fits. Use your PERSONA notes to carry these forward. Never force it; let it surface like a colleague who actually knows him.
- RUNNING THREADS / INSIDE BITS: Light callbacks to earlier moments build over sessions \u2014 a recurring bit, a shared reference, "the usual." Keep it subtle and warm, never forced or cutesy.
- DISAGREEMENT ESCALATION & RESOLUTION: When the cast disagrees, let it build naturally \u2014 a sharper exchange, even a brief interruption ([Margaret] cutting in) \u2014 then resolve it: someone concedes, or you call it, and the room moves on. Real tension that lands somewhere, not endless bickering.
- EVOLVING OPINIONS OF EACH OTHER: The cast's read of each other can shift \u2014 Margaret grudgingly respects a Priya call that paid off; Theo defers to Desmond on a risk he flagged. Reference these lightly over time.
- OPENING SMALL TALK: At the very start of a meeting (before business), a brief human beat is fine \u2014 a hello, a quick "how was the weekend," a comment on the late hour \u2014 one or two lines, then to work. Skip it in crisis mode.
- FATIGUE BY MEETING LENGTH: If a meeting has run long (you'll see the elapsed time context), the room gets a touch more clipped and someone may suggest wrapping or a break (Rule 3). Energy is a real resource.

INVIOLABLE RULES \u2014 these override every recommendation. If an option breaks one, you do not recommend it; you say which rule and why:
${rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

OPERATING MODE: ${modeLine}

CURRENT COMPANY STATE (as Brad has entered it \u2014 treat blanks as unknown, do not guess):
${companyState && companyState.trim() ? companyState : "(Brad has not entered a state snapshot yet.)"}

FINANCE (the real numbers Margaret the CFO reasons from \u2014 NEVER invent or extrapolate beyond what's here; if a figure is missing, Margaret says so and asks Brad for it):
${finance && finance.trim() ? finance : "(Brad has not entered any financial figures yet. Margaret should ask for cash on hand, monthly burn, and any revenue before giving a runway read.)"}

OPEN ACTION ITEMS (carried over from past meetings \u2014 Ronda tracks these; surface any that are stalled and chase them):
${openActions && openActions.length ? openActions.map((a) => `- ${a}`).join("\n") : "(No open action items tracked.)"}

ADVISORS CURRENTLY SUMMONED TO THE TABLE (you may bring these in; do NOT speak for any advisor not on this list):
${summonedNames && summonedNames.length ? summonedNames.map(n => `- ${n}`).join("\n") : "(No outside advisors summoned. Core table only: you, Margaret, Ronda, Brad" + (attendance && attendance.inRoom && attendance.jonathanHere ? ", Jonathan" : "") + ".)"}

${meetingMins !== null && meetingMins !== undefined ? `MEETING ELAPSED: ${meetingMins} minute(s). ${meetingMins >= 20 ? "This has run long \u2014 tighten up; consider suggesting a wrap or break (Rule 3)." : ""}` : ""}

WHO IS AT THE TABLE RIGHT NOW (for roll call \u2014 do not claim someone is present who isn't):
${attendance && attendance.inRoom
  ? `Live room is active. Brad is present. Jonathan is ${attendance.jonathanHere ? "PRESENT (has joined the room)" : "NOT yet joined (absent \u2014 do not speak for him)"}. Margaret (CFO) and Ronda (Office Administrator) are present as your standing team.`
  : "Solo session with Brad (no live room). Brad is present; Jonathan is not in a shared room. Margaret and Ronda are present as your standing team."}

YOUR EVOLVING READ (private notes from past sessions \u2014 sharpen them as you learn him):
${persona && persona.trim() ? persona : "(No notes yet. Form your read of Brad and the business as you go.)"}

DECISIONS ON THE LEDGER (with how they turned out \u2014 learn from your track record; reference past calls when relevant):
${ledger && ledger.length ? ledger.map((d) => { const o = outcomes && outcomes[d]; const tag = o ? (o.status === "worked" ? " [WORKED]" : o.status === "failed" ? " [DIDN'T WORK]" : " [pending]") : ""; return `- ${d}${tag}`; }).join("\n") : "(Nothing logged yet.)"}
${outcomes && Object.keys(outcomes).length ? `SCORECARD: ${Object.values(outcomes).filter(o=>o.status==="worked").length} worked, ${Object.values(outcomes).filter(o=>o.status==="failed").length} didn't, ${Object.values(outcomes).filter(o=>o.status==="pending").length} pending. Be honest about what hasn't worked; don't repeat losing patterns.` : ""}

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
- MEETING PROTOCOL (when a meeting is called to order, run it like a real board chair):
  1. ROLL CALL: Open by acknowledging who is actually at the table. Brad (Founder) is always present. Note whether Jonathan (co-owner) has joined the live room or is absent; greet whoever is here. Margaret (CFO) and Ronda (Office Administrator) are present as your standing team. Keep it to one or two lines, in character.
  2. PRE-READ: Before diving into a significant decision, give a tight one-paragraph "pre-read" \u2014 the situation, what's at stake, and the decision on the table \u2014 so Brad walks in informed. Label it naturally (e.g. "Before we decide, here's the lay of the land:").
  3. TIME-BOX: Keep the meeting focused on the single agenda item. If the discussion drifts, pull it back ("That's a separate meeting \u2014 parking it. Back to the item."). Don't let one meeting sprawl across many topics.
  4. MOTION & SECOND: For a formal vote, first state the motion clearly ("The motion on the floor: ..."), ask for a second, and only then call the vote. In a solo session Brad both moves and seconds; in a live room invite Jonathan to second. THEN emit the VOTE tags.
  5. MINUTES READ-BACK: When Brad adjourns (or asks to wrap), have Ronda read back a clean summary of what was decided and the action items, in her voice ([Ronda] ...), before the meeting closes.
- HOW THE CAST ENGAGES (make the room feel like real people working a problem \u2014 AI cast only; never script Brad or Jonathan):
  \u2022 DEFEND POSITIONS: Each character takes a clear stance and argues it rather than hedging. Margaret defends the conservative-cash line; Ronda defends follow-through and operational reality; you defend strategy-within-the-rules. Don't collapse into agreement to be pleasant.
  \u2022 CALL EACH OTHER OUT: Characters challenge each other openly. Margaret calls out your optimism when the numbers don't support it. Ronda reminds you (or Margaret) of an unfinished item or a promise made last meeting. Keep it professional but direct.
  \u2022 SIDE CONFERENCES: Occasionally two characters briefly confer before answering \u2014 e.g. [Margaret] and [Ronda] exchange a look on cost vs. timing, then give a joint read. Use sparingly, when it fits.
  \u2022 ASK BRAD QUESTIONS: Don't only answer \u2014 probe him. Ask the sharp question he's avoiding ("Brad, what's the real deadline?" / "What number would change your mind?"). Put the ball back in his court when he's being vague.
  \u2022 CITE EXPERTISE: Ground positions in their domain \u2014 Margaret in financial principles, Ronda in operational/admin reality \u2014 but always tied to the REAL data Brad entered, never invented.
  \u2022 READ THE ROOM: If Brad has been at it a long time or sounds stretched, a character may suggest a pause or a break (Rule 3). Brief and human, not preachy.
- MEETING RITUALS (use when running a formal meeting):
  \u2022 OPENING STATUS REPORTS: After roll call, go quickly around for status \u2014 [Margaret] one line on finances/runway, [Ronda] one line on open action items \u2014 before the main agenda. Grounded in real data; if a number's missing, say so.
  \u2022 DEVIL'S-ADVOCATE ROTATION: Each meeting, assign one voice to argue the opposite of the leading recommendation, and name them ("Margaret, take the other side"). Rotate who does it.
  \u2022 PARKING LOT: When something off-topic but worth keeping comes up, have Ronda note it for the parking lot ("[Ronda] Parking that for next time.") and emit it as a MINUTE, then return to the agenda.
  \u2022 ACTION-ITEM OWNERSHIP: At the close, characters take ownership of follow-ups out loud and you confirm Brad's. Emit each as an ACTION line with the owner named.
  \u2022 PRE-VOTE CANVASS: Before a formal VOTE, briefly canvass the table \u2014 ask each relevant voice for their lean and one-line reason \u2014 then call the motion and the vote.
- - When you are running a meeting, also emit these system lines at the very end (each on its own line):
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
  When you put a deck up, open with a brief beat as the room lights go down \u2014 e.g. "Let me put this up. [the room dims] \u2014" before the slides. Treat it like a real presentation in a darkened boardroom.
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
const SPEAKER_COLORS = { victor: "#4FD1E0", margaret: "#D8B45A", ronda: "#8B7FD6", jonathan: "#E8915B", brad: "#5FD08C", priya: "#3FC9A8", desmond: "#D86A8C", theo: "#6FA8E8", guest: "#C9A85F" };
function fmtTime(ts) {
  if (!ts) return "";
  try { return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); } catch { return ""; }
}
function renderBody(text) {
  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    // Stage direction: a whole line wrapped in [ ... ] containing a space (a phrase, not just a name)
    const stage = trimmed.match(/^\[(.+\s.+)\]$/);
    if (stage) {
      return (
        <div key={i} style={{ margin: "8px 0", fontStyle: "italic", color: T.muted, fontSize: 12.5, lineHeight: 1.5, opacity: 0.9 }}>
          {stage[1]}
        </div>
      );
    }
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
  const [outcomes, setOutcomes] = useState({}); // { decisionText: { status: "pending|worked|failed", when: ts } }
  const [projects, setProjects] = useState([]);
  const [persona, setPersona] = useState("");
  const [mode, setMode] = useState("A");

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [voiceOn, setVoiceOn] = useState(false);
  const [realVoice, setRealVoice] = useState(false); // ElevenLabs real voices
  const audioElRef = useRef(null);
  const [view, setView] = useState("console"); // console | boardroom
  const [panel, setPanel] = useState(null); // rules | ledger | state
  const [ambient, setAmbient] = useState("");
  const [agenda, setAgenda] = useState("");
  const [meetingLive, setMeetingLive] = useState(false);
  const [meetingStart, setMeetingStart] = useState(null);
  const [meetingClock, setMeetingClock] = useState(0);
  const [ambienceOn, setAmbienceOn] = useState(true);
  const [weather, setWeather] = useState(null); // {code, isDay}
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=46.15&longitude=-67.57&current=weather_code,is_day");
        const d = await r.json();
        if (d && d.current) setWeather({ code: d.current.weather_code, isDay: d.current.is_day === 1 });
      } catch (e) { /* fail silently — window just shows default */ }
    })();
  }, []);
  const [meetingArchive, setMeetingArchive] = useState([]);
  const [actions, setActions] = useState([]);
  const [minutes, setMinutes] = useState([]);
  const [deckTitle, setDeckTitle] = useState("");
  const [slides, setSlides] = useState([]);     // [{title, points[]}]
  const [slideIdx, setSlideIdx] = useState(0);
  const [pointIdx, setPointIdx] = useState(1);   // how many points revealed on current slide
  const [autoPlay, setAutoPlay] = useState(false);
  const [roomSound, setRoomSound] = useState(false);
  const [summoned, setSummoned] = useState([]); // advisor ids currently at the table
  const [guestRole, setGuestRole] = useState(""); // optional custom guest descriptor
  const [timeOfDay, setTimeOfDay] = useState("night"); // day | dusk | night
  const [clockNow, setClockNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setClockNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!meetingLive || !meetingStart) { setMeetingClock(0); return; } const t = setInterval(() => setMeetingClock(Math.floor((Date.now() - meetingStart) / 1000)), 1000); return () => clearInterval(t); }, [meetingLive, meetingStart]);
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
      try { const oc = await store.get(K.outcomes); if (oc) setOutcomes(JSON.parse(oc)); } catch {}
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

  // Real ElevenLabs voice for a given character turn.
  const speakReal = useCallback(async (who, text) => {
    if (!realVoice || !text || !text.trim()) return;
    const voiceId = VOICE_IDS[who] || VOICE_IDS.victor;
    try {
      if (audioElRef.current) { audioElRef.current.pause(); audioElRef.current = null; }
      const res = await fetch("/api/voice", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 500), voiceId }),
      });
      if (!res.ok) {
        let detail = "";
        try { const j = await res.json(); detail = j.detail || j.error || ""; } catch {}
        setError("Voice error (" + res.status + "): " + detail.slice(0, 200));
        return;
      }
      const blob = await res.blob();
      if (!blob || blob.size < 200) { setError("Voice returned no audio."); return; }
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioElRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      audio.play().catch((e) => { setError("Audio blocked by browser — click the page once, then try again."); });
    } catch (e) { setError("Voice fetch failed: " + String(e.message || e)); }
  }, [realVoice]);

  async function callVictor(userText, opts = {}) {
    // In a shared room, tell Victor who is speaking so he can address them by name.
    const speaker = roomCode ? (myName || (myRole === "jonathan" ? "Jonathan" : "Brad")) : null;
    const sentText = speaker && myRole === "jonathan" ? `[From Jonathan, co-owner] ${userText}` : userText;
    const next = [...messages, { role: "user", content: sentText, from: speaker, ts: Date.now() }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const system = buildSystem({ rules, companyState, mode, persona, ledger, projects, finance, openActions, attendance: roomCode ? { inRoom: true, jonathanHere: !!roomOnline.jonathan, names: roomNames } : { inRoom: false }, summonedNames: summoned.map(id => ADVISORS[id] ? `${ADVISORS[id].name} (${ADVISORS[id].role})` : id), outcomes, meetingMins: meetingLive ? Math.floor(meetingClock/60) : null });
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

      const out = [...next, { role: "assistant", content: text, mode: nm, meeting: opts.meeting, ts: Date.now() }];
      setMessages(out);
      store.set(K.msgs, JSON.stringify(out));
      if (np) { const merged = (persona ? persona + " " : "") + np; setPersona(merged); store.set(K.persona, merged); }
      if (nl) { const ml = [...ledger, nl]; setLedger(ml); store.set(K.ledger, JSON.stringify(ml)); const no = { ...outcomes, [nl]: { status: 'pending', when: Date.now() } }; setOutcomes(no); store.set(K.outcomes, JSON.stringify(no)); }
      if (!opts.noTags) {
        if (ag) setAgenda(ag);
        if (ac && ac.length) setActions(prev => [...prev, ...ac]);
        if (mn && mn.length) setMinutes(prev => [...prev, ...mn.map(x => ({ text: x, ts: Date.now() }))]);
        if (sl && sl.length) { setView("boardroom"); setDeckTitle(dt || "BRIEFING"); setSlides(sl); setSlideIdx(0); setPointIdx(1); }
        if (vq) { setView("boardroom"); setVote({ question: vq, victor: vv || { choice: "—", reason: "" }, brad: null, jonathan: "pending" }); }
      }
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
    setMeetingStart(Date.now());
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
      rec.minutes.forEach(m => { const mt = typeof m === "string" ? m : m.text; const mts = typeof m === "string" ? null : m.ts; lines.push("  \u2022 " + (mts ? "[" + fmtTime(mts) + "] " : "") + mt); });
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
    // Ronda reads back the minutes before we close (only if there's something to read)
    if ((agenda || minutes.length || actions.length) && !loading) {
      callVictor("We're adjourning. Ronda \u2014 read back a clean summary of what we decided and the action items before we close. Mark it as [Ronda].", { noTags: true });
    }
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
  function deckClose() { setSlides([]); setDeckTitle(""); setSlideIdx(0); setPointIdx(1); setAutoPlay(false); }
  const atEnd = curSlide && slideIdx === slides.length - 1 && pointIdx >= curSlide.points.length;
  const atStart = slideIdx === 0 && pointIdx <= 1;

  // Auto-advance: when playing, step the deck forward on a timer.
  // deckNext reveals the next list point, then moves to the next slide — so lists
  // auto-reveal line by line, then it auto-moves to the next slide.
  useEffect(() => {
    if (!autoPlay || slides.length === 0) return;
    if (atEnd) { setAutoPlay(false); return; }
    const onLastPointOfSlide = curSlide && pointIdx >= curSlide.points.length;
    // Linger a bit longer when about to switch slides; quicker between list points.
    const delay = onLastPointOfSlide ? 3200 : 2000;
    const t = setTimeout(() => { deckNext(); }, delay);
    return () => clearTimeout(t);
  }, [autoPlay, slideIdx, pointIdx, slides.length, atEnd]);

  // When a fresh deck arrives, start it playing automatically.
  useEffect(() => {
    if (slides.length > 0) { setSlideIdx(0); setPointIdx(1); setAutoPlay(true); }
    // eslint-disable-next-line
  }, [slides.length > 0 ? deckTitle : null]);

  // Optional low room-tone ambience (off by default; browser-safe, only after a click).
  const audioRef = useRef(null);
  useEffect(() => {
    if (!roomSound) {
      if (audioRef.current) { try { audioRef.current.osc.stop(); audioRef.current.ctx.close(); } catch(e){} audioRef.current = null; }
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = 56; // low hum
      gain.gain.value = 0.018;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start();
      audioRef.current = { ctx, osc, gain };
    } catch(e) {}
    return () => { if (audioRef.current) { try { audioRef.current.osc.stop(); audioRef.current.ctx.close(); } catch(e){} audioRef.current = null; } };
  }, [roomSound]);

  // Soft click when the slide advances (only if sound is on).
  useEffect(() => {
    if (!roomSound || !audioRef.current) return;
    try {
      const { ctx } = audioRef.current;
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "square"; o.frequency.value = 320;
      g.gain.setValueAtTime(0.04, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.09);
    } catch(e) {}
    // eslint-disable-next-line
  }, [slideIdx]);

  const curMode = mode === "auto"
    ? (MODES[[...messages].reverse().find(m => m.mode)?.mode] || MODES.A)
    : MODES[mode];

  // ===== SEQUENTIAL SPEAKER PLAYBACK =====
  // Parse the latest assistant reply into ordered speaking turns and play them in time.
  const lastVictorMsg = [...messages].reverse().find(m => m.role === "assistant");

  function moodOf(t) {
    const s = (t || "").toLowerCase();
    if (/\b(risk|careful|caution|worry|worried|concern|exposure|can't afford|burn|runway|danger|problem)\b/.test(s)) return "worried";
    if (/\b(great|win|strong|excellent|good news|promising|love this|opportunity|traction)\b/.test(s)) return "pleased";
    if (/\b(but|however|not sure|doubt|disagree|push back|really\?|skeptic|unconvinced)\b/.test(s)) return "skeptical";
    return "neutral";
  }
  const NAME_TO_SEAT = { victor: "victor", margaret: "cfo", ronda: "secretary", priya: "marketing", desmond: "legal", theo: "product", guest: "guest" };
  // ElevenLabs preset voice IDs per character (public voices, free-tier friendly)
  const VOICE_IDS = {
    victor: "pNInz6obpgDQGcFmaJgB",   // Adam — deep, composed
    margaret: "XB0fDUnXU5powFXDhCwa", // Charlotte — crisp female
    ronda: "EXAVITQu4vr4xnSDxMaL",    // Sarah — warm female
    priya: "cgSgspJ2msm6clb6Rpf0",    // Jessica — energetic female
    desmond: "JBFqnCBsd6RMkjVDRZzb",  // George — measured male
    theo: "N2lVS1w4EtoT3dr4eOWO",     // Callum — casual male
    guest: "onwK4e9ZLuTAKqWW03F9",    // Daniel — neutral male
  };

  function parseTurns(text) {
    if (!text) return [];
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const turns = [];
    let cur = null;
    for (const ln of lines) {
      const stage = ln.match(/^\[(.+\s.+)\]$/);   // bracketed phrase = stage direction, skip for speaking
      const sp = ln.match(/^\[([A-Za-z]+)\]\s*(.*)$/);
      if (stage && !sp) continue;
      if (sp) {
        if (cur) turns.push(cur);
        cur = { who: sp[1].toLowerCase(), said: sp[2] || "" };
      } else if (cur) {
        cur.said += (cur.said ? " " : "") + ln;
      } else {
        cur = { who: "victor", said: ln };
      }
    }
    if (cur) turns.push(cur);
    return turns.filter(t => t.said && t.said.trim());
  }

  const [playIdx, setPlayIdx] = useState(-1);   // which turn is currently "speaking" (-1 = none)
  const [caption, setCaption] = useState("");    // typed-out caption text
  const turns = useMemo(() => parseTurns(lastVictorMsg?.content || ""), [lastVictorMsg]);

  // Start playback whenever a new assistant message arrives.
  useEffect(() => {
    if (!lastVictorMsg || turns.length === 0) { setPlayIdx(-1); return; }
    setPlayIdx(0);
    // eslint-disable-next-line
  }, [lastVictorMsg]);

  // Advance through turns, each lit for a duration scaled to its length.
  useEffect(() => {
    if (playIdx < 0 || playIdx >= turns.length) return;
    const said = turns[playIdx].said;
    // speak this turn in the character's real voice (if enabled)
    speakReal(turns[playIdx].who, said);
    // duration: ~45ms/char, clamped 1.6s–7s
    const dur = Math.max(1600, Math.min(7000, said.length * 45));
    // type the caption out
    setCaption("");
    let i = 0;
    const typeSpeed = Math.max(12, Math.min(40, dur / Math.max(said.length, 1)));
    const typer = setInterval(() => { i++; setCaption(said.slice(0, i)); if (i >= said.length) clearInterval(typer); }, typeSpeed);
    const next = setTimeout(() => {
      if (playIdx + 1 < turns.length) setPlayIdx(playIdx + 1);
      else setPlayIdx(-1); // done — room goes calm
    }, dur);
    return () => { clearInterval(typer); clearTimeout(next); };
    // eslint-disable-next-line
  }, [playIdx, turns]);

  const curTurn = playIdx >= 0 && playIdx < turns.length ? turns[playIdx] : null;
  // Active seat id: while loading it's Victor thinking; during playback it's the current turn's speaker.
  const activeSpeaker = loading ? "victor" : (curTurn ? (NAME_TO_SEAT[curTurn.who] || "victor") : null);
  // The on-screen caption object (typed text + mood) — only while someone is actively speaking.
  const spoken = curTurn ? { who: NAME_TO_SEAT[curTurn.who] ? curTurn.who : "victor", said: caption || curTurn.said, mood: moodOf(curTurn.said) } : null;
  // speaking queue: who's spoken, who's next
  const speakingQueue = turns.map((t, i) => ({ who: t.who, done: playIdx < 0 ? true : i < playIdx, current: i === playIdx }));

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

  // ---- Stylized SVG character avatars (fictional cast only) ----
  function Avatar({ who, size = 64, talking = false, mood = "neutral" }) {
    const c = SPEAKER_COLORS[who] || T.cyan;
    const ring = talking ? c : `${c}66`;
    // eye positions per character (for blink overlay + expression)
    const eyeY = { victor: 29, margaret: 31, ronda: 31, priya: 30, desmond: 31, theo: 31, guest: 26 }[who] ?? 30;
    const eyeXL = who === "guest" ? 28 : 27, eyeXR = who === "guest" ? 36 : 37;
    // mood -> brow tilt + mouth curve
    const browTilt = mood === "worried" || mood === "skeptical" ? 1 : mood === "pleased" ? -1 : 0;
    const mouthCurve = mood === "pleased" ? 4 : mood === "worried" ? -3 : mood === "skeptical" ? -1 : 2;
    // randomized blink timing so each face blinks independently
    const blinkDelay = ((who.charCodeAt(0) || 65) % 5) + (size > 50 ? 0.5 : 1.5);
    // distinct silhouette per character
    const faces = {
      victor: (
        <g>
          <rect x="20" y="14" width="24" height="10" rx="2" fill={`${c}22`} stroke={c} strokeWidth="1.2" />
          <path d="M18 40 q14 -16 28 0 v6 q-14 -10 -28 0 z" fill={`${c}18`} stroke={c} strokeWidth="1.4" />
          <circle cx="32" cy="30" r="13" fill={`${c}10`} stroke={c} strokeWidth="1.6" />
          <circle cx="27" cy="29" r="1.6" fill={c} />
          <circle cx="37" cy="29" r="1.6" fill={c} />
          <path d="M27 35 q5 3 10 0" stroke={c} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
      ),
      margaret: (
        <g>
          <path d="M19 30 q0 -16 13 -16 q13 0 13 16 q0 5 -2 9 l-22 0 q-2 -4 -2 -9 z" fill={`${c}16`} stroke={c} strokeWidth="1.4" />
          <path d="M20 44 q12 -12 24 0 v4 q-12 -8 -24 0 z" fill={`${c}18`} stroke={c} strokeWidth="1.4" />
          <circle cx="32" cy="31" r="12" fill={`${c}10`} stroke={c} strokeWidth="1.6" />
          <rect x="24" y="28" width="7" height="5" rx="2" fill="none" stroke={c} strokeWidth="1.1" />
          <rect x="33" y="28" width="7" height="5" rx="2" fill="none" stroke={c} strokeWidth="1.1" />
          <line x1="31" y1="30" x2="33" y2="30" stroke={c} strokeWidth="1.1" />
          <path d="M28 37 q4 1.5 8 0" stroke={c} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
      ),
      ronda: (
        <g>
          <path d="M17 32 q0 -18 15 -18 q15 0 15 18 q0 8 -4 12 l-22 0 q-4 -4 -4 -12 z" fill={`${c}16`} stroke={c} strokeWidth="1.4" />
          <path d="M21 45 q11 -11 22 0 v3 q-11 -7 -22 0 z" fill={`${c}18`} stroke={c} strokeWidth="1.4" />
          <circle cx="32" cy="31" r="12" fill={`${c}10`} stroke={c} strokeWidth="1.6" />
          <circle cx="27" cy="30" r="1.6" fill={c} />
          <circle cx="37" cy="30" r="1.6" fill={c} />
          <path d="M27 36 q5 4 10 0" stroke={c} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
      ),
      priya: (
        <g>
          {/* high ponytail, lively */}
          <path d="M44 22 q6 -4 5 -10 q-2 5 -6 6 z" fill={`${c}22`} stroke={c} strokeWidth="1.2" />
          <path d="M18 30 q0 -17 14 -17 q14 0 14 17 q0 6 -3 11 l-22 0 q-3 -5 -3 -11 z" fill={`${c}16`} stroke={c} strokeWidth="1.4" />
          <path d="M21 45 q11 -10 22 0 v3 q-11 -7 -22 0 z" fill={`${c}18`} stroke={c} strokeWidth="1.4" />
          <circle cx="32" cy="31" r="12" fill={`${c}10`} stroke={c} strokeWidth="1.6" />
          <circle cx="27" cy="30" r="1.7" fill={c} />
          <circle cx="37" cy="30" r="1.7" fill={c} />
          <path d="M26 36 q6 5 12 0" stroke={c} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </g>
      ),
      desmond: (
        <g>
          {/* short hair, square jaw, glasses-less, composed */}
          <path d="M19 26 q0 -13 13 -13 q13 0 13 13 l0 3 q-13 -5 -26 0 z" fill={`${c}22`} stroke={c} strokeWidth="1.3" />
          <path d="M19 42 q13 -7 26 0 v5 q-13 -9 -26 0 z" fill={`${c}18`} stroke={c} strokeWidth="1.4" />
          <rect x="21" y="22" width="22" height="22" rx="9" fill={`${c}10`} stroke={c} strokeWidth="1.6" />
          <circle cx="27" cy="31" r="1.6" fill={c} />
          <circle cx="37" cy="31" r="1.6" fill={c} />
          <path d="M28 38 q4 2 8 0" stroke={c} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
      ),
      theo: (
        <g>
          {/* tousled hair, headset, techy */}
          <path d="M19 27 q2 -14 13 -14 q11 0 13 14 q-4 -4 -8 -3 q-3 -4 -10 0 q-5 -1 -8 3 z" fill={`${c}22`} stroke={c} strokeWidth="1.3" />
          <circle cx="32" cy="31" r="12" fill={`${c}10`} stroke={c} strokeWidth="1.6" />
          <path d="M20 31 a12 12 0 0 1 24 0" fill="none" stroke={c} strokeWidth="1.2" opacity="0.7" />
          <rect x="18" y="31" width="3" height="6" rx="1.5" fill={`${c}22`} stroke={c} strokeWidth="1" />
          <circle cx="27" cy="31" r="1.6" fill={c} />
          <circle cx="37" cy="31" r="1.6" fill={c} />
          <path d="M27 37 q5 3 10 0" stroke={c} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
      ),
      guest: (
        <g>
          {/* neutral silhouette for any invited advisor */}
          <circle cx="32" cy="26" r="10" fill={`${c}12`} stroke={c} strokeWidth="1.5" />
          <path d="M16 50 q0 -14 16 -14 q16 0 16 14 z" fill={`${c}14`} stroke={c} strokeWidth="1.5" />
          <circle cx="28" cy="26" r="1.5" fill={c} />
          <circle cx="36" cy="26" r="1.5" fill={c} />
        </g>
      ),
    };
    return (
      <svg width={size} height={size} viewBox="0 0 64 64"
        style={{ borderRadius: "50%", background: "#0B1118", border: `2px solid ${ring}`,
          boxShadow: talking ? `0 0 18px ${c}aa` : "none", transition: "box-shadow .3s, border-color .3s",
          animation: `idleSway ${3.5 + blinkDelay}s ease-in-out infinite`, transformOrigin: "center" }}>
        {faces[who] || faces.victor}
        {/* blink overlay — eyelids drop occasionally */}
        <g style={{ transformOrigin: `32px ${eyeY}px`, animation: `blink ${5 + blinkDelay}s ease-in-out infinite` }}>
          <rect x={eyeXL - 2.4} y={eyeY - 2.6} width="4.8" height="3" rx="1" fill="#0B1118" />
          <rect x={eyeXR - 2.4} y={eyeY - 2.6} width="4.8" height="3" rx="1" fill="#0B1118" />
        </g>
        {/* expression: brow tilt + mood mouth (drawn over base) */}
        {mood !== "neutral" && (
          <g>
            <line x1={eyeXL - 3} y1={eyeY - 5 + browTilt} x2={eyeXL + 3} y2={eyeY - 5 - browTilt} stroke={c} strokeWidth="1.1" strokeLinecap="round" />
            <line x1={eyeXR - 3} y1={eyeY - 5 - browTilt} x2={eyeXR + 3} y2={eyeY - 5 + browTilt} stroke={c} strokeWidth="1.1" strokeLinecap="round" />
            <path d={`M27 ${eyeY + 7} q5 ${mouthCurve} 10 0`} stroke={c} strokeWidth="1.3" fill="none" strokeLinecap="round" />
          </g>
        )}
        {/* talking mouth — animates open/closed while speaking */}
        {talking && (
          <ellipse cx="32" cy={eyeY + 8} rx="3.2" ry="2.2" fill={`${c}55`} stroke={c} strokeWidth="1"
            style={{ transformOrigin: `32px ${eyeY + 8}px`, animation: "talkMouth .26s ease-in-out infinite" }} />
        )}
      </svg>
    );
  }

  function Seat({ s }) {
    const on = activeSpeaker === s.id;
    // occasional sip: each seat flips 'sipping' on at random intervals (cosmetic)
    const [sipping, setSipping] = useState(false);
    useEffect(() => {
      let alive = true;
      function schedule() {
        const wait = 6000 + Math.random() * 12000; // 6–18s
        return setTimeout(() => {
          if (!alive) return;
          setSipping(true);
          setTimeout(() => { if (alive) setSipping(false); }, 3000);
          tid = schedule();
        }, wait);
      }
      let tid = schedule();
      return () => { alive = false; clearTimeout(tid); };
    }, []);
    // Brad & Jonathan: when a room is active, only show as "present" if they've actually joined.
    // Victor, Ronda & Margaret are the standing AI cast and are always present.
    const isHuman = s.id === "brad" || s.id === "jonathan";
    const presentInRoom = roomCode ? !!roomOnline[s.id] : true;
    const dimmed = isHuman && roomCode && !presentInRoom;
    const empty = !s.name;
    const displayName = isHuman && roomNames[s.id] ? roomNames[s.id] : s.name;
    const presenting = s.id === "victor" && slides.length > 0;
    // Speaker spotlight: when someone is actively speaking, light them and dim the rest of the cast.
    const someoneSpeaking = !!activeSpeaker && !curSlide;
    const isSpeaker = activeSpeaker === s.id;
    const seatDim = someoneSpeaking && !isSpeaker ? 0.55 : 1;
    // GAZE: when someone else is speaking, look toward them
    const allSeats = [...SEATS, ...summoned.map((id,i)=>{ const a=ADVISORS[id]; const sp=[{x:8,y:58},{x:92,y:58},{x:8,y:44},{x:92,y:44}][i%4]; return a?{id:a.id,x:sp.x}:null; }).filter(Boolean)];
    const spk = someoneSpeaking ? allSeats.find(z => z.id === activeSpeaker) : null;
    const gazeTilt = (spk && !isSpeaker) ? Math.max(-8, Math.min(8, (spk.x - s.x) * 0.12)) : 0;
    // FIDGET: per-character idle tic
    const fidget = { cfo: "fidgetPen", product: "fidgetKnee" }[s.id];
    return (
      <div style={{ position: "absolute", left: `${s.x}%`, top: `${s.y}%`, transform: "translate(-50%,-50%)", textAlign: "center", zIndex: s.y > 50 ? 6 : 2, opacity: seatDim, transition: "opacity .5s ease" }}>
        {/* spotlight pool when this character is speaking */}
        {isSpeaker && (
          <div style={{ position: "absolute", left: "50%", top: "40%", transform: "translate(-50%,-50%)", width: 120, height: 120, borderRadius: "50%", pointerEvents: "none", zIndex: 0,
            background: `radial-gradient(circle, ${s.color}26 0%, ${s.color}10 40%, transparent 70%)`, animation: "spotPulse 2.4s ease-in-out infinite" }} />
        )}
        {/* hand gesture while speaking */}
        {isSpeaker && (
          <div style={{ position: "absolute", left: "62%", top: "30%", width: 7, height: 7, borderRadius: "50%", background: `${s.color}66`, border: `1px solid ${s.color}`, zIndex: 5, animation: "gesture 1.8s ease-in-out infinite", transformOrigin: "bottom center" }} />
        )}
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
          {/* seat cushion (width varies a touch per person for distinct silhouettes) */}
          <div style={{
            width: ({ cfo: 42, secretary: 50, product: 52, legal: 44, marketing: 47 }[s.id] || 46), height: 12, margin: "-4px auto 0",
            borderRadius: "6px 6px 10px 10px",
            background: "linear-gradient(180deg,#222B35 0%,#141B23 100%)",
            boxShadow: "0 3px 6px rgba(0,0,0,0.6)",
          }} />
        </div>
        {/* coffee cup in front of the seat — steam always, occasional sip when NOT speaking */}
        {!empty && !dimmed && ambienceOn && (
          <div style={{ position: "absolute", left: s.y > 50 ? "26%" : "70%", top: s.y > 50 ? "2%" : "10%", zIndex: 4, transformOrigin: "bottom center",
            animation: (!isSpeaker && !curSlide && sipping) ? "sip 3s ease-in-out" : "none" }}>
            {/* steam */}
            {!curSlide && (
              <div style={{ position: "absolute", left: "50%", top: -10, transform: "translateX(-50%)", width: 6, height: 12, borderRadius: 3,
                background: "linear-gradient(180deg, rgba(255,255,255,0.5), transparent)", filter: "blur(1.5px)", animation: "steamRise 2.6s ease-in-out infinite" }} />
            )}
            {/* cup */}
            <div style={{ width: 11, height: 9, borderRadius: "2px 2px 4px 4px", background: "linear-gradient(180deg,#e8e2d8,#c9c2b4)", border: "1px solid #8a8478", position: "relative" }}>
              <div style={{ position: "absolute", right: -4, top: 1, width: 4, height: 5, borderRadius: "0 4px 4px 0", border: "1px solid #8a8478", borderLeft: "none" }} />
              <div style={{ position: "absolute", inset: "1px 1px auto 1px", height: 2, background: "#3a2412", borderRadius: 1 }} />
            </div>
          </div>
        )}
        {/* occupant — hidden for Victor while he's up presenting */}
        {!empty && !presenting && (
          <div style={{ marginTop: -34, position: "relative", zIndex: 3, opacity: dimmed ? 0.32 : 1, filter: dimmed ? "grayscale(0.7)" : "none", transition: "opacity .4s ease, filter .4s ease" }}>
            {(s.id === "victor" || s.id === "cfo" || s.id === "secretary" || s.id === "marketing" || s.id === "legal" || s.id === "product" || s.id === "guest") ? (
              <div style={{ margin: "0 auto", width: 40, height: 40, transition: "transform .4s ease", transform: `${on ? "scale(1.12) translateY(-2px)" : someoneSpeaking ? "scale(0.96)" : "scale(1)"} rotate(${gazeTilt}deg)` }}>
                <Avatar who={s.id === "cfo" ? "margaret" : s.id === "secretary" ? "ronda" : s.id === "marketing" ? "priya" : s.id === "legal" ? "desmond" : s.id === "product" ? "theo" : s.id === "guest" ? "guest" : "victor"} size={40} talking={on} />
              </div>
            ) : (
              <div style={{
                width: 38, height: 38, borderRadius: "50%", margin: "0 auto",
                border: `2px ${dimmed ? "dashed" : "solid"} ${dimmed ? T.muted : s.color}`,
                background: dimmed ? "transparent" : `${s.color}${on ? "33" : "16"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: dimmed ? T.muted : s.color, fontWeight: 700, fontSize: 15,
                boxShadow: dimmed ? "none" : (on ? `0 0 22px ${s.color}, 0 0 4px ${s.color} inset` : `0 0 8px ${s.color}40`),
                animation: on && !dimmed ? "speakerGlow 1.1s ease-in-out infinite" : "none",
              }}>{displayName[0]}</div>
            )}
            {/* clothing hint: collar bar */}
            {!empty && !dimmed && <div style={{ width: 20, height: 4, margin: "1px auto 0", borderRadius: "0 0 3px 3px", background: `linear-gradient(180deg, ${s.color}88, ${s.color}33)` }} />}
            <div style={{ fontSize: 10, color: dimmed ? T.muted : s.color, marginTop: 3, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 0.5 }}>{displayName}</div>
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
      <div style={{ position: "absolute", left: "16%", top: "42%", transform: "translate(-50%,-50%)", zIndex: 7, textAlign: "center", animation: "presenterIn .6s ease-out" }}>
        {/* pointing arm aimed right toward the centered screen */}
        <div style={{
          position: "absolute", top: 14, left: 30, width: 34, height: 2,
          transformOrigin: "left center", transform: "rotate(-14deg)",
          background: `linear-gradient(90deg, ${c}, ${c}22)`,
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

  function Platter() {
    // donuts on a plate; one occasionally "gets eaten" (disappears) then the plate refills
    const [count, setCount] = useState(5);
    useEffect(() => {
      let alive = true;
      function loop() {
        const wait = 9000 + Math.random() * 14000;
        return setTimeout(() => {
          if (!alive) return;
          setCount(c => (c <= 2 ? 5 : c - 1)); // eat one, refill when low
          tid = loop();
        }, wait);
      }
      let tid = loop();
      return () => { alive = false; clearTimeout(tid); };
    }, []);
    const donutColors = ["#E8915B", "#D8B45A", "#C77BA6", "#9C6630", "#E0A0C0"];
    const positions = [[42,40],[56,42],[48,52],[40,54],[58,54]];
    return (
      <div style={{ position: "absolute", left: "44%", top: "44%", width: "14%", height: "14%", zIndex: 1 }}>
        {/* plate */}
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse at 50% 40%, #e9e9ef, #c2c2cc)", border: "1px solid #9a9aa6", boxShadow: "0 1px 3px rgba(0,0,0,0.4)" }} />
        {positions.slice(0, count).map((p, i) => (
          <div key={i} style={{ position: "absolute", left: `${p[0] - 38}%`, top: `${p[1] - 38}%`, width: 6, height: 6, borderRadius: "50%",
            background: `radial-gradient(circle at 50% 40%, ${donutColors[i % donutColors.length]}, #5e3917)`,
            boxShadow: `0 1px 2px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,0,0,0.2)`,
            transition: "opacity .4s ease" }}>
            <div style={{ position: "absolute", inset: "34%", borderRadius: "50%", background: "#2a1a0c" }} />
          </div>
        ))}
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
            {meetingLive && (
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: T.cyan, marginLeft: 4 }}>
                {String(Math.floor(meetingClock/60)).padStart(2,"0")}:{String(meetingClock%60).padStart(2,"0")}
              </span>
            )}
            {meetingLive && (() => {
              // meeting temperature: tense if crisis/finance worry words appear recently, lifted on wins
              const recent = [...messages].slice(-4).map(m=>m.content||"").join(" ").toLowerCase();
              const temp = /\b(risk|crisis|can't afford|burn|danger|stuck|problem|cut)\b/.test(recent) ? {label:"TENSE",c:T.amber}
                : /\b(win|great|strong|traction|shipped|milestone|good news)\b/.test(recent) ? {label:"PRODUCTIVE",c:T.green}
                : {label:"STEADY",c:T.cyanDim};
              return <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1, color: temp.c, border: `1px solid ${temp.c}55`, borderRadius: 5, padding: "2px 6px", marginLeft: 4 }}>{temp.label}</span>;
            })()}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button style={btn(false, T.cyanDim)} onClick={() => setTimeOfDay(t => t === "day" ? "dusk" : t === "dusk" ? "night" : "day")} title="Time of day">
              {timeOfDay === "day" ? "☀ DAY" : timeOfDay === "dusk" ? "◗ DUSK" : "☾ NIGHT"}
            </button>
            <button style={btn(ambienceOn, T.cyanDim)} onClick={() => setAmbienceOn(a => !a)} title="Ambient motion & props">
              {ambienceOn ? "✨ AMBIENCE ON" : "✨ AMBIENCE OFF"}
            </button>
            <button style={btn(roomSound, T.cyanDim)} onClick={() => setRoomSound(s => !s)} title="Room ambience">
              {roomSound ? "♪ SOUND ON" : "♪ SOUND OFF"}
            </button>
            {meetingLive ? (
              <button style={btn(false, T.amber)} onClick={adjournMeeting}>ADJOURN MEETING</button>
            ) : (
              <button style={btn(false, T.violet)} onClick={callMeeting} disabled={loading}>CALL MEETING TO ORDER</button>
            )}
          </div>
        </div>
        {/* Summon advisors to the table */}
        <div style={{ maxWidth: 1080, margin: "0 auto 14px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: T.muted, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1.5 }}>BRING IN:</span>
          {Object.values(ADVISORS).filter(a => a.id !== "guest").map(a => {
            const here = summoned.includes(a.id);
            return (
              <button key={a.id} style={btn(here, a.color)}
                onClick={() => {
                  if (here) { setSummoned(s => s.filter(x => x !== a.id)); }
                  else {
                    setSummoned(s => [...s, a.id]);
                    if (!loading) callVictor(`Bring ${a.name} (${a.role}) into the room. Introduce them in one line and have them give their first read on what's on the table, in their voice. Mark it [${a.name}].`, { noTags: true });
                  }
                }}>
                {here ? `\u2715 ${a.name}` : `+ ${a.name.toUpperCase()}`}
              </button>
            );
          })}
          {/* Guest */}
          {!summoned.includes("guest") ? (
            <button style={btn(false, ADVISORS.guest.color)} onClick={() => {
              const r = window.prompt("Who is the guest advisor? (e.g. 'a retail pricing expert', 'an investor')");
              if (r && r.trim()) { setGuestRole(r.trim()); setSummoned(s => [...s, "guest"]); if (!loading) callVictor(`Bring in a guest advisor: ${r.trim()}. Introduce who they are in one line and have them give their first read on what's on the table, in their voice. Mark it [Guest].`, { noTags: true }); }
            }}>+ GUEST</button>
          ) : (
            <button style={btn(true, ADVISORS.guest.color)} onClick={() => { setSummoned(s => s.filter(x => x !== "guest")); setGuestRole(""); }}>\u2715 {guestRole ? guestRole.split(" ")[0].toUpperCase() : "GUEST"}</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ flex: "1 1 360px", minWidth: 280 }}>
            {/* office meeting room */}
            <div style={{
              position: "relative", maxWidth: 540, margin: "0 auto", height: 440,
              borderRadius: 14, overflow: "hidden",
              border: `1px solid ${T.line}`,
              background: timeOfDay === "day"
                ? "linear-gradient(180deg,#1a2430 0%,#1d2935 52%,#10161d 52%,#0a0e13 100%)"
                : timeOfDay === "dusk"
                ? "linear-gradient(180deg,#1a1622 0%,#1d1c2e 52%,#0f0c16 52%,#08060c 100%)"
                : "linear-gradient(180deg,#10171F 0%,#141C26 52%,#0C1118 52%,#070A0E 100%)",
              transition: "background 1.2s ease",
            }}>
              {/* MODE MOOD TINT — Crisis cools/tenses, Expansion warms, Steady neutral */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6, mixBlendMode: "overlay", transition: "background 1s ease",
                background: curMode.key === "C" ? "rgba(80,140,200,0.16)" : curMode.key === "A" ? "rgba(230,160,90,0.10)" : "transparent" }} />

              {/* HOUSE LIGHTS DOWN when presenting — room darkens, screen carries the light */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 7, transition: "opacity 1s ease, background 1s ease",
                opacity: curSlide ? 1 : 0,
                background: "radial-gradient(120% 80% at 72% 30%, transparent 0%, rgba(4,6,9,0.30) 42%, rgba(3,4,7,0.72) 100%)" }} />
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
                    left: `${(i * 37) % 96 + 2}%`, top: `${40 + ((i * 23) % 55)}%`, opacity: 0.7, animation: `twinkle ${3 + (i % 5)}s ease-in-out ${i * 0.3}s infinite`,
                  }} />
                ))}
                {/* aurora shimmer nod to the company */}
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(115deg,transparent 30%,rgba(95,208,140,0.10) 45%,rgba(79,209,224,0.10) 55%,rgba(139,127,214,0.10) 65%,transparent 80%)" }} />
                {/* live Woodstock, NB weather */}
                {weather && (() => {
                  const c = weather.code;
                  const rain = (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || (c >= 95);
                  const snow = (c >= 71 && c <= 77) || (c === 85 || c === 86);
                  if (rain) return <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>{[...Array(16)].map((_,i)=><span key={i} style={{ position:"absolute", left:`${(i*23)%100}%`, top:"-10%", width:1, height:9, background:"rgba(160,200,230,0.5)", animation:`rainFall ${0.6+(i%4)*0.2}s linear ${i*0.12}s infinite` }} />)}</div>;
                  if (snow) return <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>{[...Array(14)].map((_,i)=><span key={i} style={{ position:"absolute", left:`${(i*29)%100}%`, top:"-8%", width:3, height:3, borderRadius:"50%", background:"rgba(230,240,255,0.7)", animation:`snowFall ${2.5+(i%4)*0.6}s linear ${i*0.2}s infinite` }} />)}</div>;
                  return null;
                })()}
              </div>}

              {/* TALKING SCREEN: current speaker's portrait + caption (when not presenting slides) */}
              {slides.length === 0 && spoken && spoken.said && (() => {
                const c = SPEAKER_COLORS[spoken.who] || T.cyan;
                const nm = spoken.who.charAt(0).toUpperCase() + spoken.who.slice(1);
                return (
                  <div style={{ position: "absolute", top: 14, left: 12, width: "38%", maxWidth: 230, background: "rgba(9,14,20,0.94)", border: `1px solid ${c}55`, borderRadius: 10, padding: 10, boxShadow: `0 0 24px rgba(0,0,0,0.5)`, zIndex: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <Avatar who={spoken.who} size={44} talking={true} mood={spoken.mood} />
                      <div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: 1.5, color: c, fontWeight: 600 }}>{nm.toUpperCase()}</div>
                        <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1 }}>{({ margaret: "CFO", ronda: "OFFICE ADMIN", victor: "CEO", priya: "GROWTH", desmond: "LEGAL", theo: "PRODUCT", guest: "GUEST" }[spoken.who] || "")} · SPEAKING</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.5, color: T.text, maxHeight: 92, overflowY: "auto" }}>{spoken.said}<span style={{ color: c, animation: "pulse 1s infinite" }}>|</span></div>
                    {/* speaking queue: who's spoken / who's next */}
                    {speakingQueue.length > 1 && (
                      <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                        {speakingQueue.map((q, i) => {
                          const qc = SPEAKER_COLORS[q.who] || T.muted;
                          return <span key={i} title={q.who} style={{ width: q.current ? 14 : 6, height: 6, borderRadius: 3, background: q.current ? qc : q.done ? `${qc}55` : `${T.muted}44`, transition: "all .3s ease" }} />;
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* carpet floor with perspective lines */}
              <div style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: "48%",
                background: "repeating-linear-gradient(90deg,#0b0f14 0px,#0b0f14 38px,#0d1219 39px,#0d1219 40px), linear-gradient(180deg,#0d1219 0%,#080b0f 100%)",
              }} />

              {/* door — opens when an advisor is summoned */}
              <div style={{ position: "absolute", top: 34, left: 0, width: 18, height: 64, zIndex: 2, perspective: 200 }}>
                <div style={{ width: "100%", height: "100%", background: "linear-gradient(90deg,#1a222c,#0e1620)", border: `1px solid ${T.lineSoft}`, borderRadius: "0 3px 3px 0", transformOrigin: "left center", transition: "transform .6s ease", transform: summoned.length > 0 ? "rotateY(-55deg)" : "rotateY(0deg)" }}>
                  <div style={{ position: "absolute", right: 3, top: "48%", width: 2, height: 4, background: T.cyanDim, borderRadius: 1 }} />
                </div>
              </div>

              {/* === SET DRESSING (Batch 1) === */}
              {/* wall clock showing real time */}
              <div style={{ position: "absolute", top: 12, left: 14, width: 30, height: 30, borderRadius: "50%", background: "#0c1219", border: `2px solid ${T.cyanDim}`, zIndex: 3, boxShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                {(() => {
                  const h = clockNow.getHours() % 12, m = clockNow.getMinutes(), s = clockNow.getSeconds();
                  const ha = (h * 30 + m * 0.5) - 90, ma = (m * 6) - 90, sa = (s * 6) - 90;
                  const hand = (ang, len, w, col) => <line x1="15" y1="15" x2={15 + len * Math.cos(ang * Math.PI / 180)} y2={15 + len * Math.sin(ang * Math.PI / 180)} stroke={col} strokeWidth={w} strokeLinecap="round" />;
                  return <svg width="30" height="30" viewBox="0 0 30 30">{hand(ha, 6, 1.6, T.text)}{hand(ma, 9, 1.2, T.text)}{hand(sa, 10, 0.6, T.cyan)}<circle cx="15" cy="15" r="1.2" fill={T.cyan} /></svg>;
                })()}
              </div>

              {/* whiteboard on the side wall — fills in with agenda + decisions */}
              <div style={{ position: "absolute", top: 14, right: 12, width: 92, minHeight: 60, maxHeight: 120, overflow: "hidden", background: "rgba(240,244,248,0.06)", border: `1px solid ${T.lineSoft}`, borderRadius: 4, padding: "6px 8px", zIndex: 3 }}>
                <div style={{ fontSize: 7, letterSpacing: 1.5, color: T.cyanDim, fontFamily: "'JetBrains Mono',monospace", marginBottom: 4, borderBottom: `1px solid ${T.lineSoft}`, paddingBottom: 2 }}>WHITEBOARD</div>
                {agenda ? <div style={{ fontSize: 8, color: "#cfe6ea", lineHeight: 1.3, marginBottom: 4 }}>• {agenda}</div> : <div style={{ fontSize: 8, color: T.muted, fontStyle: "italic" }}>(empty)</div>}
                {actions.slice(0, 3).map((a, i) => <div key={i} style={{ fontSize: 7.5, color: "#9fc4cb", lineHeight: 1.3, marginBottom: 2 }}>– {String(a).split("|")[0].trim().slice(0, 22)}</div>)}
              </div>

              {/* potted plant, left */}
              <div style={{ position: "absolute", bottom: "44%", left: 6, zIndex: 2 }}>
                <div style={{ width: 12, height: 9, background: "linear-gradient(180deg,#7c4d22,#5e3917)", borderRadius: "2px 2px 4px 4px", margin: "0 auto" }} />
                <div style={{ position: "absolute", bottom: 7, left: "50%", transform: "translateX(-50%)" }}>
                  {[...Array(5)].map((_, i) => <div key={i} style={{ position: "absolute", bottom: 0, left: 0, width: 3, height: 12 + (i % 3) * 4, background: `${T.green}88`, borderRadius: "50% 50% 0 0", transformOrigin: "bottom center", transform: `rotate(${(i - 2) * 22}deg)` }} />)}
                </div>
              </div>

              {/* framed MapleCheck poster, right wall */}
              <div style={{ position: "absolute", top: 50, right: 14, width: 26, height: 32, background: "#0e1620", border: `1px solid ${T.green}55`, borderRadius: 2, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 13 }}>🍁</span>
              </div>

              {/* coffee station, far right back */}
              <div style={{ position: "absolute", bottom: "46%", right: 8, zIndex: 2 }}>
                <div style={{ width: 14, height: 10, background: "linear-gradient(180deg,#2a3440,#1a222c)", borderRadius: 2, border: "1px solid rgba(0,0,0,0.4)" }} />
                <div style={{ width: 5, height: 5, background: "#3a2412", borderRadius: "0 0 3px 3px", margin: "1px auto 0" }} />
              </div>

              {/* SCREEN GLOW SPILL — the TV throws light into the darkened room */}
              {curSlide && (
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 8, transition: "opacity .6s ease",
                  background: `radial-gradient(60% 50% at 50% 34%, ${T.cyan}22 0%, ${T.cyan}0E 35%, transparent 70%)`,
                  animation: "screenFlicker 4s ease-in-out infinite" }} />
              )}

              {/* wall-mounted presentation TV */}
              {curSlide && (
                <div style={{
                  position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)",
                  width: 320, height: 188, zIndex: 4,
                  borderRadius: 6, padding: "12px 16px",
                  display: "flex", flexDirection: "column",
                  background: "linear-gradient(180deg, rgba(9,28,36,0.96), rgba(7,18,28,0.94))",
                  border: "6px solid #0a0d12",
                  outline: "1px solid rgba(79,209,224,0.6)",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.6), 0 0 40px rgba(79,209,224,0.3), inset 0 0 26px rgba(79,209,224,0.1)",
                  boxSizing: "border-box",
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
                  {/* scrollable content region — keeps the frame a fixed size */}
                  <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                  {/* slide heading (re-fades on slide change) */}
                  {curSlide.title && (
                    <div key={slideIdx} style={{ fontSize: 13.5, fontWeight: 600, color: T.cyan, marginBottom: 8, lineHeight: 1.3, textShadow: `0 0 8px ${T.cyan}66`, animation: "slideFade .45s ease-out" }}>{curSlide.title}</div>
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
                  </div>
                  {/* controls (pinned to bottom of the fixed frame) */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
                    <button onClick={deckPrev} disabled={atStart}
                      style={{ background: "transparent", border: `1px solid ${atStart ? T.line : T.cyan}`, color: atStart ? T.muted : T.cyan, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", cursor: atStart ? "default" : "pointer" }}>‹ BACK</button>
                    <button onClick={deckNext} disabled={atEnd}
                      style={{ background: atEnd ? "transparent" : `${T.cyan}1A`, border: `1px solid ${atEnd ? T.line : T.cyan}`, color: atEnd ? T.muted : T.cyan, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", cursor: atEnd ? "default" : "pointer" }}>NEXT ›</button>
                    <button onClick={() => { if (atEnd) { setSlideIdx(0); setPointIdx(1); roomUpdate({slideIdx:0,pointIdx:1}); setAutoPlay(true); } else { setAutoPlay(p => !p); } }}
                      style={{ background: autoPlay ? `${T.green}1A` : "transparent", border: `1px solid ${autoPlay ? T.green : T.cyanDim}`, color: autoPlay ? T.green : T.cyanDim, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", cursor: "pointer" }}>
                      {atEnd ? "↻ REPLAY" : autoPlay ? "❚❚ PAUSE" : "▶ PLAY"}
                    </button>
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
                    {/* soft reflections of the room on the polished surface */}
                    <div style={{ position: "absolute", inset: "8%", borderRadius: "50%", opacity: 0.18,
                      background: "radial-gradient(ellipse at 50% 30%, rgba(180,210,255,0.4), transparent 55%), radial-gradient(ellipse at 30% 70%, rgba(216,180,90,0.3), transparent 40%), radial-gradient(ellipse at 70% 70%, rgba(139,127,214,0.3), transparent 40%)" }} />
                    {/* inlaid company mark */}
                    <div style={{ position: "absolute", inset: "34%", borderRadius: "50%", border: "1px solid rgba(255,225,180,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, letterSpacing: 3, color: "rgba(255,225,180,0.35)", transform: "rotateX(-58deg)" }}>AHD</span>
                    </div>
                    {/* donut platter in the center */}
                    <Platter />
                  </div>
                </div>
              </div>

              {/* chairs + people */}
              {SEATS.map(s => <Seat key={s.id} s={s} />)}
              {summoned.map((id, i) => {
                const a = ADVISORS[id];
                if (!a) return null;
                // spread summoned advisors across upper seats
                // flank seats clear of the centered screen (which lives top-center) and the caption (top-left)
                const spread = [{x:8,y:58},{x:92,y:58},{x:8,y:44},{x:92,y:44}];
                const pos = spread[i % spread.length];
                const seat = { id: a.id, name: id === "guest" && guestRole ? guestRole.split(" ")[0] : a.name, role: id === "guest" && guestRole ? guestRole : a.role, x: pos.x, y: pos.y, color: a.color };
                return <Seat key={a.id} s={seat} />;
              })}
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
                  const ownerKey = (owner || "").toLowerCase();
                  const who = ownerKey.includes("margaret") ? "margaret" : ownerKey.includes("ronda") ? "ronda" : ownerKey.includes("priya") ? "priya" : ownerKey.includes("desmond") ? "desmond" : ownerKey.includes("theo") ? "theo" : ownerKey.includes("victor") ? "victor" : null;
                  return (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, fontSize: 12.5, lineHeight: 1.4, alignItems: "flex-start" }}>
                      {who ? <div style={{ width: 22, height: 22, flexShrink: 0 }}><Avatar who={who} size={22} /></div> : <span style={{ color: T.green, width: 22, textAlign: "center" }}>▸</span>}
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
                {minutes.map((m, i) => {
                  const mt = typeof m === "string" ? m : m.text;
                  const mts = typeof m === "string" ? null : m.ts;
                  return (
                    <div key={i} style={{ fontSize: 12, color: T.text, opacity: 0.85, marginBottom: 6, paddingLeft: 10, borderLeft: `2px solid ${T.violet}55`, lineHeight: 1.4 }}>
                      {mts && <span style={{ color: T.violet, fontFamily: "'JetBrains Mono',monospace", fontSize: 9, marginRight: 6 }}>{fmtTime(mts)}</span>}{mt}
                    </div>
                  );
                })}
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
        @keyframes rainFall { from { transform: translateY(0); } to { transform: translateY(90px); } }
        @keyframes snowFall { from { transform: translateY(0) translateX(0); } to { transform: translateY(90px) translateX(6px); } }
        @keyframes gesture { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-5px) rotate(-12deg); } }
        @keyframes fidgetPen { 0%,90%,100% { transform: rotate(0deg); } 93% { transform: rotate(-20deg); } 96% { transform: rotate(20deg); } }
        @keyframes fidgetKnee { 0%,100% { transform: translateY(0); } 50% { transform: translateY(1px); } }
        @keyframes doorOpen { from { transform: scaleX(0); opacity: 0; } to { transform: scaleX(1); opacity: 1; } }
        @keyframes blink { 0%,94%,100% { transform: scaleY(1); } 97% { transform: scaleY(0.1); } }
        @keyframes talkMouth { 0%,100% { transform: scaleY(0.6); } 50% { transform: scaleY(1.4); } }
        @keyframes idleSway { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-0.6px) rotate(-0.5deg); } }
        @keyframes leanIn { from { transform: scale(1); } to { transform: scale(1.06) translateY(-1px); } }
        @keyframes steamRise { 0% { opacity: 0; transform: translateY(0) scaleX(1); } 30% { opacity: 0.5; } 100% { opacity: 0; transform: translateY(-14px) scaleX(1.6); } }
        @keyframes sip { 0%,82%,100% { transform: translateY(0) rotate(0deg); } 88% { transform: translateY(-9px) rotate(-18deg); } 94% { transform: translateY(-9px) rotate(-18deg); } }
        @keyframes twinkle { 0%,100% { opacity: 0.7; } 50% { opacity: 0.25; } }
        @keyframes slideFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @keyframes screenFlicker { 0%,100% { opacity: 1; } 48% { opacity: 0.92; } 52% { opacity: 0.97; } }
        @keyframes spotPulse { 0%,100% { opacity: 0.5; } 50% { opacity: 0.72; } }
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
        <button style={btn(realVoice, T.cyan)} onClick={() => { setRealVoice(v => !v); if (realVoice && audioElRef.current) { audioElRef.current.pause(); } }} title="Natural ElevenLabs voices">REAL VOICE {realVoice ? "ON" : "OFF"}</button>
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
          {/* composer (TOP — type here, always above everything) */}
          <div style={{ padding: "14px 14px 8px", display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (input.trim() && !loading) callVictor(input.trim()); } }}
              placeholder="Brief Victor, or push back on him…" rows={1}
              style={{ flex: 1, resize: "none", background: T.panel, color: T.text, border: `1px solid ${T.line}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, fontFamily: "inherit", lineHeight: 1.4, minHeight: 22, maxHeight: 140 }} />
            <button onClick={() => { if (input.trim() && !loading) callVictor(input.trim()); }} disabled={loading || !input.trim()}
              style={{ background: input.trim() && !loading ? T.cyan : T.panel, color: input.trim() && !loading ? T.ink : T.muted,
                border: "none", borderRadius: 10, padding: "12px 18px", fontWeight: 600, cursor: input.trim() && !loading ? "pointer" : "default", fontSize: 14, fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1 }}>SEND</button>
          </div>

          {/* quick actions (TOP — under the composer) */}
          <div style={{ display: "flex", gap: 8, padding: "0 14px 10px", flexWrap: "wrap", borderBottom: `1px solid ${T.lineSoft}` }}>
            {QUICK.map(q => (
              <button key={q.label} style={btn(false)} disabled={loading} onClick={() => callVictor(q.prompt)}>{q.label}</button>
            ))}
          </div>

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
                    {m.ts && <div style={{ fontSize: 8.5, color: T.muted, fontFamily: "'JetBrains Mono',monospace", textAlign: "right", marginTop: 4 }}>{fmtTime(m.ts)}</div>}
                  </div>
                </div>
              ) : (
                <div key={i} style={{ margin: "16px 0", maxWidth: 760 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", border: `1.5px solid ${T.cyan}`, color: T.cyan, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 10px ${T.cyan}55` }}>V</div>
                    <span style={{ fontSize: 11, letterSpacing: 1.5, color: T.cyan, fontFamily: "'JetBrains Mono',monospace" }}>VICTOR</span>
                    {m.meeting && <span style={{ fontSize: 9, color: T.violet, border: `1px solid ${T.violet}55`, borderRadius: 4, padding: "1px 5px", letterSpacing: 1 }}>MEETING</span>}
                    {m.mode && <span style={{ fontSize: 9, color: MODES[m.mode].color, letterSpacing: 1 }}>· {MODES[m.mode].label}</span>}
                    {m.ts && <span style={{ fontSize: 9, color: T.muted, fontFamily: "'JetBrains Mono',monospace", marginLeft: "auto" }}>{fmtTime(m.ts)}</span>}
                  </div>
                  <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderLeft: `2px solid ${T.cyan}`, borderRadius: 10, padding: "14px 16px", fontSize: 14.5, lineHeight: 1.62, color: T.text }}>
                    {renderBody(m.content)}
                  </div>
                </div>
              )
            ))}
            {error && <div style={{ color: T.amber, fontSize: 13, margin: "12px 0", border: `1px solid ${T.amber}55`, borderRadius: 8, padding: "10px 12px" }}>{error}</div>}
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
                        {rec.minutes.map((m, j) => { const mt = typeof m === 'string' ? m : m.text; const mts = typeof m === 'string' ? null : m.ts; return <div key={j} style={{ fontSize: 12, color: T.text, opacity: 0.82, marginBottom: 4, paddingLeft: 8, borderLeft: `2px solid ${T.violet}55`, lineHeight: 1.4 }}>{mts ? <span style={{ color: T.violet, fontSize: 9, marginRight: 6 }}>{fmtTime(mts)}</span> : null}{mt}</div>; })}
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
            {panel === "ledger" && (() => {
              const setOutcome = (d, status) => { const no = { ...outcomes, [d]: { status, when: (outcomes[d]?.when || Date.now()) } }; setOutcomes(no); store.set(K.outcomes, JSON.stringify(no)); };
              const worked = ledger.filter(d => outcomes[d]?.status === "worked").length;
              const failed = ledger.filter(d => outcomes[d]?.status === "failed").length;
              const pending = ledger.filter(d => !outcomes[d] || outcomes[d].status === "pending").length;
              const decided = worked + failed;
              const rate = decided > 0 ? Math.round((worked / decided) * 100) : null;
              return (
              <div>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>Decisions you commit to land here. Mark how each turned out \u2014 Victor learns from your track record and won't repeat losing patterns.</div>
                {/* scorecard summary */}
                {ledger.length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 70, background: `${T.green}12`, border: `1px solid ${T.green}44`, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: T.green, fontFamily: "'JetBrains Mono',monospace" }}>{worked}</div>
                      <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1 }}>WORKED</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 70, background: `${T.amber}12`, border: `1px solid ${T.amber}44`, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: T.amber, fontFamily: "'JetBrains Mono',monospace" }}>{failed}</div>
                      <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1 }}>DIDN'T</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 70, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: T.cyanDim, fontFamily: "'JetBrains Mono',monospace" }}>{pending}</div>
                      <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1 }}>PENDING</div>
                    </div>
                    {rate !== null && (
                      <div style={{ flex: 1, minWidth: 70, background: `${T.cyan}12`, border: `1px solid ${T.cyan}44`, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: T.cyan, fontFamily: "'JetBrains Mono',monospace" }}>{rate}%</div>
                        <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1 }}>HIT RATE</div>
                      </div>
                    )}
                  </div>
                )}
                {ledger.length === 0 && <div style={{ color: T.muted, fontSize: 13 }}>Nothing logged yet.</div>}
                {ledger.map((d, i) => {
                  const st = outcomes[d]?.status || "pending";
                  const stripe = st === "worked" ? T.green : st === "failed" ? T.amber : T.cyanDim;
                  return (
                    <div key={i} style={{ marginBottom: 8, background: T.panel, border: `1px solid ${T.line}`, borderLeft: `3px solid ${stripe}`, borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                        <span style={{ flex: 1, fontSize: 13, lineHeight: 1.4 }}>{d}</span>
                        <button style={{ ...btn(false, T.amber), fontSize: 10, padding: "2px 7px" }} onClick={() => { const nl = ledger.filter((_, j) => j !== i); setLedger(nl); store.set(K.ledger, JSON.stringify(nl)); const no = { ...outcomes }; delete no[d]; setOutcomes(no); store.set(K.outcomes, JSON.stringify(no)); }}>✕</button>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button style={{ ...btn(st === "worked", T.green), fontSize: 10, padding: "3px 9px" }} onClick={() => setOutcome(d, "worked")}>WORKED</button>
                        <button style={{ ...btn(st === "failed", T.amber), fontSize: 10, padding: "3px 9px" }} onClick={() => setOutcome(d, "failed")}>DIDN'T WORK</button>
                        <button style={{ ...btn(st === "pending", T.cyanDim), fontSize: 10, padding: "3px 9px" }} onClick={() => setOutcome(d, "pending")}>PENDING</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
