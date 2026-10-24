import { INITIAL_FEN, replay } from "../../lib/chess";
import { makeFen } from "chessops/fen";

export type ExerciseLevel = 1 | 2 | 3;
export type ExerciseKind = "guided" | "transfer";

export interface PlanOption {
  text: string;
  reason: string;
  preferred: boolean;
}

export interface CounterplayPrompt {
  question: string;
  options: PlanOption[];
}

export interface PlanExercise {
  id: string;
  title: string;
  theme: string;
  level: ExerciseLevel;
  kind: ExerciseKind;
  moves: string[];
  question: string;
  options: PlanOption[];
  principle: string;
  opponent: string;
  counterplay: CounterplayPrompt;
}

const choices = (
  best: string,
  bestReason: string,
  first: string,
  firstReason: string,
  second: string,
  secondReason: string,
): PlanOption[] => [
  { text: best, reason: bestReason, preferred: true },
  { text: first, reason: firstReason, preferred: false },
  { text: second, reason: secondReason, preferred: false },
];

const italian = ["e2e4", "e7e5", "g1f3", "b8c6", "f1c4", "f8c5", "c2c3", "g8f6"];
const french = ["e2e4", "e7e6", "d2d4", "d7d5", "e4e5"];
const carlsbad = [
  "d2d4",
  "d7d5",
  "c2c4",
  "e7e6",
  "b1c3",
  "g8f6",
  "c4d5",
  "e6d5",
  "c1g5",
  "f8e7",
  "e2e3",
  "e8g8",
  "f1d3",
  "b8d7",
  "g1f3",
  "c7c6",
  "e1g1",
  "a7a6",
];
const isolated = [
  "e2e4",
  "c7c6",
  "d2d4",
  "d7d5",
  "e4d5",
  "c6d5",
  "c2c4",
  "g8f6",
  "b1c3",
  "e7e6",
  "g1f3",
  "f8e7",
  "c4d5",
  "f6d5",
];
const sicilian = ["e2e4", "c7c5", "g1f3", "d7d6", "d2d4", "c5d4", "f3d4", "g8f6", "b1c3", "a7a6"];
const kingsIndian = [
  "d2d4",
  "g8f6",
  "c2c4",
  "g7g6",
  "b1c3",
  "f8g7",
  "e2e4",
  "d7d6",
  "g1f3",
  "e8g8",
  "f1e2",
  "e7e5",
  "e1g1",
  "b8c6",
  "d4d5",
  "c6e7",
];

// The preferred choice answers the stated strategic question; it is not a claim
// that the position has only one good move. Each transfer changes the decision:
// a forcing check, reinforced chain, tactical threat, reversed side, exposed king,
// or attacked piece. Do not replace these with shared theme-only answers.
const CONTENT: PlanExercise[] = [
  {
    id: "central-break-guided",
    title: "Give c3 a purpose",
    theme: "central-break",
    level: 1,
    kind: "guided",
    moves: italian,
    question: "White to move: which plan uses c3 to challenge the e5 centre directly?",
    options: choices(
      "Calculate d4, including ...exd4 and the checks after cxd4.",
      "c3 supports d4 and can recapture there. Opening the centre also exposes the king on e1, so the exchange sequence matters.",
      "Play d3 and keep the d-pawn behind e4 while developing.",
      "d3 is a sound quieter setup, but it maintains the tension instead of using c3 for the direct d4 challenge asked for here.",
      "Play a4 to prepare queenside space and restrain ...b5.",
      "a4 is legal and can restrain Black's expansion, but it does not challenge e5 or make use of c3's central support.",
    ),
    counterplay: {
      question:
        "After White plays d4, which Black continuation makes the uncastled king an immediate concern?",
      options: choices(
        "...exd4, followed by ...Bb4+ if White recaptures cxd4.",
        "After cxd4, c3 and d2 are empty. The bishop can move from c5 to b4 and check the king along b4-c3-d2-e1.",
        "...Bb6, preserving the bishop on the a7-g1 diagonal.",
        "Retreating the attacked bishop is a real option, but it does not produce the forcing check along b4-e1.",
        "...a6, preparing ...b5 for queenside space.",
        "This is a legal expansion plan, but it leaves the central tension unresolved and does not exploit the king immediately.",
      ),
    },
    principle: "A supported pawn break still needs a check of forcing replies.",
    opponent: "Black can exchange on d4 and use ...Bb4+ once the c3 pawn leaves the diagonal.",
  },
  {
    id: "central-break-transfer-scotch",
    title: "The break has opened a check",
    theme: "central-break",
    level: 2,
    kind: "transfer",
    moves: [...italian, "d2d4", "e5d4", "c3d4", "c5b4"],
    question:
      "White to move, in check: how can White meet ...Bb4+ while developing and retaining castling rights?",
    options: choices(
      "Interpose a developing piece with Nc3 or Bd2, then calculate Black's captures.",
      "Both moves block the check without moving the king. Neither makes White immune to tactics: for example, after Nc3 Black can consider ...Nxe4.",
      "Play Kf1 to keep the c3 square free for later manoeuvring.",
      "Kf1 legally escapes check, but gives up castling rights and leaves the rook on h1 harder to connect with the centre.",
      "Play Ke2 to defend the centre with the king.",
      "Ke2 is legal, but exposes the king on an open central file and gives up castling when a developing interposition is available.",
    ),
    counterplay: {
      question:
        "After White blocks with Nc3, which Black move captures a central pawn while the knight is pinned to e1?",
      options: choices(
        "...Nxe4, using the f6 knight and the pin of Nc3.",
        "The f6 knight can capture e4. White's c3 knight cannot answer Nxe4 while that would uncover the bishop's check on e1; White must calculate other replies.",
        "...d6, reinforcing the centre and freeing the c8 bishop.",
        "This is a useful developing move, but it does not use the pin to capture the e4 pawn.",
        "...O-O, bringing the king to safety before further play.",
        "Castling is legal and sensible, but it does not itself exploit the pinned knight to take central material.",
      ),
    },
    principle:
      "Once a break produces a forcing reply, solve that reply before resuming the strategic plan.",
    opponent:
      "After Nc3, the pin can make ...Nxe4 possible; blocking the check is the beginning of the calculation.",
  },
  {
    id: "pawn-chain-guided",
    title: "Find the base of the chain",
    theme: "pawn-chain",
    level: 1,
    kind: "guided",
    moves: french,
    question: "Black to move: which pawn break attacks the supporting base of White's d4-e5 chain?",
    options: choices(
      "Play ...c5 to put pressure on d4, then develop behind the challenge.",
      "The d4 pawn supports e5. ...c5 attacks that base and gives Black a concrete central target.",
      "Play ...f6 to attack the advanced pawn on e5.",
      "...f6 is a genuine French Defence idea, but it attacks the head of this chain and opens kingside lines; it is a different target from the base asked for here.",
      "Play ...b6 and prepare ...Bb7 against the dark squares.",
      "This develops the bishop, but White's d4 pawn still supports e5, and the bishop's diagonal is initially blocked by Black's own d5 pawn.",
    ),
    counterplay: {
      question:
        "After ...c5, which White move adds a pawn defender to d4 while retaining the chain?",
      options: choices(
        "Play c3 to reinforce d4.",
        "The c3 pawn protects d4 and can recapture there after ...cxd4, preserving the d4-e5 chain.",
        "Play Bd3 to develop toward the kingside.",
        "Bd3 develops a piece and looks toward h7, but does not add a pawn defender to d4; it also temporarily blocks the queen's defence along the d-file.",
        "Play a3 to prepare queenside expansion with b4.",
        "a3 can support a wing plan against the c5 pawn, but it does not directly reinforce d4.",
      ),
    },
    principle: "Distinguish attacking a chain's base from challenging its advanced pawn.",
    opponent:
      "White can meet ...c5 with c3, so the pawn break needs follow-up pressure from pieces.",
  },
  {
    id: "pawn-chain-transfer-pressure",
    title: "The base has gained support",
    theme: "pawn-chain",
    level: 2,
    kind: "transfer",
    moves: [...french, "c7c5", "c2c3", "b8c6", "g1f3"],
    question: "Black to move: which plan keeps d4 as the target after White reinforces it with c3?",
    options: choices(
      "Consider ...cxd4, cxd4 and ...Qb6, adding queen pressure to the c6 knight's attack on d4.",
      "Once the c5 pawn exchanges, the b6-c5-d4 diagonal is clear. White can maintain the chain, so Black must build pressure rather than assume the base will fall.",
      "Play ...c4 to gain space and fix White's pawn on c3.",
      "...c4 changes the structure and can support a queenside plan, but removes the c-pawn's attack on d4 and closes the diagonal that ...Qb6 would use.",
      "Play ...f6 and shift the main pawn pressure to e5.",
      "...f6 is legal and challenges the chain's head, but it changes the target and requires attention to the uncastled king rather than reinforcing pressure on d4.",
    ),
    counterplay: {
      question: "After ...cxd4, which White reply preserves a pawn on d4 supporting e5?",
      options: choices(
        "Recapture cxd4 and continue developing behind the chain.",
        "The c3 pawn replaces the captured d-pawn. Black has exchanged a pair of pawns, but has not removed the chain's base.",
        "Recapture Nxd4 with the f3 knight to centralise a piece.",
        "Nxd4 is legal, but leaves a knight rather than a pawn on d4. The e5 pawn loses its pawn support and the knight faces the c6 knight's attack.",
        "Play Be2 first, planning to recover the pawn later.",
        "Be2 develops safely toward castling, but leaves Black's pawn on d4 and does not preserve White's supporting pawn chain now.",
      ),
    },
    principle:
      "A defender's recapture can preserve the structure; add pressure instead of assuming one exchange solves it.",
    opponent:
      "White can recapture with c3xd4, retaining the base and using Nf3 and the queen to support it.",
  },
  {
    id: "minority-attack-guided",
    title: "Choose a structural target",
    theme: "minority-attack",
    level: 1,
    kind: "guided",
    moves: carlsbad,
    question:
      "White to move: after checking tactics, which long-term pawn plan aims to create a weakness around c6?",
    options: choices(
      "Prepare b4-b5, then attack the pawn weakness left by queenside exchanges.",
      "b5 challenges c6. Exchanges can leave a backward c6 pawn or another queenside target; the exact result depends on Black's response.",
      "Prepare a4-a5 to restrain Black's b7 pawn.",
      "This can restrict queenside expansion, but a pawn on a5 does not challenge c6 directly, so it is a different structural aim.",
      "Prepare e4-e5 to gain central space against Nf6.",
      "A central expansion is another possible plan, but it aims at the centre and f6 knight rather than creating the c6 weakness.",
    ),
    counterplay: {
      question:
        "After b4, which Black move should White check for immediate pressure on both Nc3 and Bg5?",
      options: choices(
        "...Ne4, centralising the f6 knight with attacks on c3 and g5.",
        "The knight attacks both pieces, and b4 has removed the b2 pawn's protection of c3. The bishop on e7 also supports a capture on g5 along the now-clear f6 square.",
        "...a5 to challenge the b4 pawn from the side.",
        "...a5 is a real way to challenge the minority attack, but it attacks b4, not the two minor pieces named in the question.",
        "...Re8 to improve the rook on the e-file.",
        "...Re8 can support central play, but does not immediately attack Nc3 and Bg5 together.",
      ),
    },
    principle:
      "Identify the target of a pawn plan, then check what that pawn move stops defending.",
    opponent:
      "After b4, ...Ne4 can exploit the newly loose c3 knight; b5 should never be automatic.",
  },
  {
    id: "minority-attack-transfer-activity",
    title: "A structural plan meets a tactic",
    theme: "minority-attack",
    level: 3,
    kind: "transfer",
    moves: [...carlsbad, "b2b4", "f6e4"],
    question:
      "White to move: ...Ne4 attacks Nc3 and Bg5. What must take priority over the minority attack?",
    options: choices(
      "Resolve the pressure on the minor pieces; calculate bishop exchanges and the defence of c3 before b5.",
      "The b-pawn no longer protects c3. Both the knight on e4 and bishop on e7 bear on g5, so an exchange or defensive move needs concrete calculation.",
      "Play b5 now so the threat to c6 forces Black to respond on the queenside.",
      "b5 is legal, but it does not force Black to defend c6. ...Nxc3 can take the loose knight and attack the queen on d1 before White creates a lasting pawn target.",
      "Exchange with Nxe4, assuming ...dxe4 only gives Black a pawn weakness.",
      "After Nc3xe4 d5xe4, the pawn on e4 attacks both Bd3 and Nf3. Removing the knight without checking that fork can lose material.",
    ),
    counterplay: {
      question:
        "After the tempting Nxe4 dxe4, which Black threat makes the recapture more than a structural change?",
      options: choices(
        "The pawn on e4 forks White's bishop on d3 and knight on f3.",
        "The pawn attacks both pieces immediately. White must calculate a concrete response instead of counting the pawn as a future target.",
        "...a5 can undermine the b4 pawn.",
        "...a5 remains a legal queenside idea, but the new immediate problem is the pawn fork against White's pieces.",
        "...b5 can gain queenside space beside White's b4 pawn.",
        "...b5 is legal in this position, but gaining space is slower than the existing double attack by the e4 pawn.",
      ),
    },
    principle:
      "Before exchanging an active piece, inspect the threats created by the recapturing pawn.",
    opponent: "...Nxc3 can gain a tempo on Qd1; after Nxe4, ...dxe4 creates a fork on d3 and f3.",
  },
  {
    id: "isolated-pawn-guided",
    title: "Understand the blockaded pawn",
    theme: "isolated-pawn",
    level: 1,
    kind: "guided",
    moves: isolated,
    question:
      "White to move: which plan uses the dynamic side of the isolated d4 pawn while recognising the knight already on d5?",
    options: choices(
      "Develop Be2, castle and improve piece activity; consider d5 only after removing the blockader.",
      "The pawn offers central space, but Black's knight occupies d5, so the advance is currently unavailable. Development and activity are White's compensation.",
      "Use Nxd5 to start simplifying, aiming primarily for a minor-piece ending.",
      "Nxd5 is legal and changes the structure after ...exd5, but exchanging pieces is not automatically the way to exploit White's middlegame activity. Reassess the new pawns before choosing an ending.",
      "Play a3 and b4 first to seek space away from the blocked d-file.",
      "These wing moves are possible, but leave the bishop on f1 and king on e1 while Black can develop and reinforce the central blockade.",
    ),
    counterplay: {
      question: "Which Black setup most directly limits the isolated pawn's potential advance?",
      options: choices(
        "Keep the knight on d5 supported by e6 and develop the remaining pieces.",
        "The knight occupies the square immediately ahead of d4, and the e6 pawn supports it. White must address that blockade before advancing.",
        "Prepare ...b6 and ...Bb7 to develop the c8 bishop.",
        "This is a valid development scheme, but the bishop's long diagonal is initially obstructed by its own knight on d5; it is not what physically stops d4-d5.",
        "Prepare ...a6 and ...b5 to gain queenside space.",
        "Queenside expansion is legal, but the blockader on d5, rather than wing space, is what directly prevents the isolated pawn's advance.",
      ),
    },
    principle:
      "Activity can compensate for an isolated pawn, but a planned advance needs an available square.",
    opponent:
      "Black already blockades d5; exchanging White's active pieces can make the d4 pawn easier to attack.",
  },
  {
    id: "isolated-pawn-transfer-castled",
    title: "Play against the isolated pawn",
    theme: "isolated-pawn",
    level: 2,
    kind: "transfer",
    moves: [...isolated, "f1e2", "b8c6", "e1g1", "e8g8", "c1e3"],
    question:
      "Black to move: which plan combines the existing d5 blockade with direct pressure on White's isolated d4 pawn?",
    options: choices(
      "Consider ...Bf6 to bear on d4, maintain the blockader and coordinate the remaining pieces.",
      "From f6 the bishop looks through e5 to d4. White has defenders, so this builds pressure rather than winning the pawn immediately.",
      "Play ...b5 to gain queenside space before arranging pressure on d4.",
      "...b5 is legal and gains space, but it does not add an attacker to the isolated pawn and gives White time to activate pieces.",
      "Play ...f5 to build a kingside attack around the central knight.",
      "...f5 is legal, but loosens e5 and the king's shelter. It changes the aim from restraining and attacking d4 to a more committal kingside plan.",
    ),
    counterplay: {
      question:
        "Which White resource must Black account for before treating the current pawn structure as permanent?",
      options: choices(
        "White can exchange the blockader with Nxd5; ...exd5 gives Black an isolated d-pawn too.",
        "Nc3 can capture d5. If Black recaptures with the e6 pawn, Black's c- and e-pawns are gone and the d5 pawn has no neighbouring pawn support: the evaluation of exchanges must change.",
        "White can play a3 to take b4 away from Black's pieces.",
        "a3 is a useful restraining move, but it leaves the central blockade and isolated-pawn structure unchanged.",
        "White can play Rc1 to occupy the semi-open c-file.",
        "Rc1 develops a rook and can add pressure to c6, but the rook move itself does not change the pawn structure or remove Nd5.",
      ),
    },
    principle:
      "When playing against a weakness, check whether an exchange changes which side owns that weakness.",
    opponent:
      "White can seek activity or exchange Nd5; a recapture with ...exd5 changes the structural story.",
  },
  {
    id: "semi-open-file-guided",
    title: "Read the pawn exchange",
    theme: "semi-open-file",
    level: 1,
    kind: "guided",
    moves: sicilian,
    question:
      "White to move: which Black asset follows specifically from exchanging the c-pawn for White's d-pawn?",
    options: choices(
      "A semi-open c-file that Black can use after developing heavy pieces.",
      "Black's c-pawn is gone while White's c2 pawn remains. The file can carry pressure, but Nc3 screens c2 and Black's rooks are not developed yet.",
      "Queenside space from a later ...b5, supported by ...a6.",
      "That expansion is a real Black plan, but its immediate support comes from ...a6 rather than from the c-pawn exchange alone.",
      "The chance to play ...e5 with tempo against Nd4.",
      "...e5 legally attacks the d4 knight, but is a separate central pawn choice that also loosens d5; it is not the file created by the exchange.",
    ),
    counterplay: {
      question:
        "After White develops Be2, which Black move places a heavy piece on the semi-open file?",
      options: choices(
        "...Qc7, bringing the queen onto the c-file while development continues.",
        "The queen has a clear route from d8 to c7. It can look toward Nc3, although c2 is still screened and protected; this is pressure, not a forced pawn win.",
        "...b5, gaining space and preparing a place for the c8 bishop.",
        "...b5 supports queenside expansion and can prepare ...Bb7, but it does not itself put a heavy piece on the c-file.",
        "...g6, preparing to develop the f8 bishop on g7.",
        "A kingside fianchetto is legal, but develops a bishop and changes the setup rather than occupying the c-file with a queen or rook.",
      ),
    },
    principle: "A semi-open file is a route for pieces, not an automatic material gain.",
    opponent:
      "Black can develop the queen to c7 and later arrange a rook on c8; White must weigh that against central activity.",
  },
  {
    id: "semi-open-file-transfer-development",
    title: "The file now points toward a king",
    theme: "semi-open-file",
    level: 3,
    kind: "transfer",
    moves: [...sicilian, "c1e3", "e7e6", "f2f3", "f8e7", "d1d2", "e8g8", "e1c1", "b8c6"],
    question:
      "White to move: after castling queenside, how should White reassess Black's c-file before starting g4-g5?",
    options: choices(
      "Compare the pawn attack with ...d5 and future c-file pressure toward the king on c1.",
      "White's king now stands behind Nc3 and c2 on the file Black may use. Both a central break and pressure on c3 can matter before the wing attack gets going.",
      "Commit to g4-g5 first, treating opposite-side castling as enough reason to race.",
      "The pawn storm is a genuine plan, but the castling pattern does not establish its timing. Central lines can open before White's pawns create threats.",
      "Play Kb1 and treat the king move as sufficient defence for an uninterrupted h4-h5 plan.",
      "Kb1 is useful and legal, but the king remains near c2. It does not remove the need to calculate ...d5 or pressure against the queenside pieces.",
    ),
    counterplay: {
      question:
        "After a quiet Kb1, which Black pawn break directly attacks e4 and can open central lines?",
      options: choices(
        "...d5, using the d6 pawn to challenge White's e4 centre.",
        "The pawn can move to d5 and attack e4. Whether to exchange or maintain the tension needs calculation, especially with the kings on opposite wings.",
        "...b5, expanding on the side of White's king.",
        "...b5 is relevant queenside counterplay, but it attacks a4 and c4 rather than challenging the e4 pawn directly.",
        "...h5, restraining White's intended g-pawn advance.",
        "...h5 is a legal kingside reaction, but it acts against the wing plan instead of opening the centre against e4.",
      ),
    },
    principle:
      "Reassess a file when the king moves behind it; a familiar asset can become a direct attacking route.",
    opponent:
      "Black can challenge e4 with ...d5 and prepare c-file pressure; White's pawn storm must be timed against those resources.",
  },
  {
    id: "closed-centre-guided",
    title: "Choose the base to challenge",
    theme: "closed-centre",
    level: 1,
    kind: "guided",
    moves: kingsIndian,
    question:
      "White to move: which wing plan prepares a pawn break against the base on d6 of Black's d6-e5 chain?",
    options: choices(
      "Prepare queenside play with c5, supported by development and space-gaining moves as needed.",
      "A pawn on c5 attacks d6, the support of e5. White must still choose the timing and account for Black's kingside counterplay.",
      "Prepare h4-h5 to challenge the g6 pawn.",
      "This is a legal kingside space plan, but it targets the king's pawn shelter rather than the base on d6.",
      "Move Nf3 to e1 and prepare f4 against e5.",
      "The knight manoeuvre can free the f-pawn, but f4 challenges the head on e5 and opens play on a different wing; it does not attack d6 directly.",
    ),
    counterplay: {
      question:
        "Which Black preparation specifically clears the way for the f7 pawn to challenge White's e4 pawn?",
      options: choices(
        "Move Nf6 to e8, then prepare ...f5.",
        "The knight currently blocks f7-f5. ...Ne8 clears f6 and allows Black to prepare the characteristic kingside break.",
        "Play ...a5 to restrain White's b4 expansion.",
        "...a5 is a real response to queenside expansion, but it does not move the knight blocking Black's f-pawn.",
        "Play ...c6 to challenge the d5 pawn.",
        "...c6 is a legal central challenge, but it acts against d5 and leaves f6 occupied.",
      ),
    },
    principle:
      "In a closed centre, identify each side's pawn break and the preparatory moves it needs.",
    opponent:
      "Black can clear f6 and prepare ...f5; White should compare that timing with the c5 plan.",
  },
  {
    id: "closed-centre-transfer-queenside",
    title: "Pause the race for an attacked piece",
    theme: "closed-centre",
    level: 3,
    kind: "transfer",
    moves: [...kingsIndian, "f3e1", "f6d7", "f2f3", "f7f5", "c1e3", "f5f4"],
    question:
      "White to move: Black's ...f4 attacks Be3. How should White adapt the queenside plan?",
    options: choices(
      "Save the attacked bishop, for example with Bf2, then reassess c5 against Black's kingside play.",
      "Bf2 moves the bishop out of the pawn's attack. The c5 plan can remain relevant, but it must wait while White addresses a direct material threat.",
      "Play c5 now because attacking d6 is the normal plan in this structure.",
      "c5 is legal and attacks the chain's base, but ...fxe3 takes a bishop before that structural pressure compensates for the loss.",
      "Play b4 to accelerate the queenside expansion before moving the bishop.",
      "b4 is a plausible preparation for queenside play, but does not save Be3 or create a forcing threat that answers ...fxe3.",
    ),
    counterplay: {
      question:
        "After Bf2, which Black pawn plan supports f4 and prepares to attack White's pawn on f3?",
      options: choices(
        "Play ...g5 to support f4, then consider ...g4 against f3.",
        "The g6 pawn can advance to g5 and support f4. A later ...g4 attacks f3, so White must watch the king's pawn shelter even though the centre is locked.",
        "Play ...a5 to restrain b4 and gain queenside space.",
        "...a5 is legal and can slow White's expansion, but does not reinforce f4 or prepare a pawn attack on f3.",
        "Play ...c6 to challenge White's d5 pawn.",
        "...c6 offers a different central break, but does not support the f4 pawn or attack the king's shelter through f3.",
      ),
    },
    principle:
      "A closed centre does not suspend tactics: answer an attacked piece before continuing a wing race.",
    opponent:
      "Black's f4 pawn gains space with tempo, and ...g5-g4 can create further threats against White's king shelter.",
  },
];

// Keep answer order stable for retries, but vary it across both prompt types.
const rotate = (options: PlanOption[], offset: number): PlanOption[] => [
  ...options.slice(offset),
  ...options.slice(0, offset),
];

export const PLAN_EXERCISES: PlanExercise[] = CONTENT.map((exercise, index) => ({
  ...exercise,
  options: rotate(exercise.options, index % 3),
  counterplay: {
    ...exercise.counterplay,
    options: rotate(exercise.counterplay.options, (index * 2 + 1) % 3),
  },
}));

export function exerciseFen(exercise: PlanExercise): string {
  const result = replay(INITIAL_FEN, exercise.moves);
  if (result.sans.length !== exercise.moves.length)
    throw new Error(`Invalid exercise: ${exercise.id}`);
  return makeFen(result.pos.toSetup());
}
