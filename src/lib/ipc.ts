// Typed wrappers around the Rust commands. The Rust core is the single source of truth;
// the UI only asks.
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface AppInfo {
  version: string;
  dataDir: string;
  dbPath: string;
  schemaVersion: number;
}

export interface EngineStatus {
  ready: boolean;
  /** `id name` reported by the engine, e.g. "Stockfish 19". */
  name: string | null;
  author: string | null;
  path: string;
  /** "bundled" sidecar, or "custom" when the `engine.path` setting points elsewhere. */
  source: "bundled" | "custom";
  optionCount: number;
  elapsedMs: number;
  error: string | null;
}

/** Engine score from White's point of view (normalised in the Rust core). */
export type Score = { kind: "cp"; value: number } | { kind: "mate"; value: number };

export type PositionStatus = "ongoing" | "checkmate" | "stalemate";

export interface PvLine {
  multipv: number;
  depth: number;
  seldepth: number | null;
  score: Score;
  bound: "exact" | "lower" | "upper";
  /** White's win probability, 0–100. */
  winWhite: number;
  wdl: { win: number; draw: number; loss: number } | null;
  /** UCI moves from the analysed position. */
  pv: string[];
}

export interface AnalysisUpdate {
  id: number;
  status: PositionStatus;
  depth: number;
  nodes: number;
  nps: number;
  timeMs: number;
  lines: PvLine[];
  done: boolean;
}

export type EngineEvent =
  | ({ type: "update" } & AnalysisUpdate)
  | { type: "ready"; name: string }
  | { type: "restarted"; reason: string }
  | { type: "failed"; reason: string };

export interface AnalysisTicket {
  id: number;
  whiteToMove: boolean;
  status: PositionStatus;
}

export const ENGINE_EVENT = "engine://event";
export const PUZZLE_PROGRESS_EVENT = "puzzles://progress";

export interface Puzzle {
  /** "<lichess game id>#<ply>" */
  id: string;
  fen: string;
  /** UCI moves, solver first, odd count. */
  moves: string[];
  rating: number;
  eco: string;
  ecoFamily: string;
  opening: string;
  themes: string[];
  solverColor: "white" | "black";
}

export interface PuzzleFilter {
  theme: string | null;
  minRating: number;
  maxRating: number;
  ecoFamily: string | null;
  excludeSolved: boolean;
}

export interface ImportProgress {
  filesDone: number;
  filesTotal: number;
  currentFile: string;
  imported: number;
  duplicates: number;
  rejected: number;
  totalInDb: number;
  elapsedMs: number;
}

export interface ImportReport {
  files: number;
  filesSkipped: number;
  imported: number;
  duplicates: number;
  rejected: number;
  totalInDb: number;
  elapsedMs: number;
  rejects: { file: string; site: string; reason: string }[];
  rejectReasons: [string, number][];
}

export type PuzzleImportState =
  | { state: "idle" }
  | ({ state: "running" } & ImportProgress)
  | ({ state: "done" } & ImportReport)
  | { state: "failed"; error: string };

export interface PuzzleImportStatus {
  folder: string | null;
  files: number;
  totalBytes: number;
  importedFiles: number;
  puzzlesInDb: number;
  pendingFiles: number;
  job: PuzzleImportState;
  lastReport: ImportReport | null;
}

export interface ThemeCount {
  theme: string;
  count: number;
}

export interface ThemeRating {
  theme: string;
  rating: number;
  rd: number;
  attempts: number;
}

export interface AttemptResult {
  attemptId: number;
  overall: ThemeRating;
  themes: ThemeRating[];
}

export interface Attempt {
  id: number;
  puzzleId: string;
  attemptedAt: string;
  success: boolean;
  timeMs: number;
  hintsUsed: number;
  rating: number;
  themes: string[];
}

export const SYNC_EVENT = "games://sync";

export interface Account {
  id: number;
  source: "lichess" | "chesscom";
  username: string;
  lastSyncedAt: string | null;
  games: number;
}

export type SyncStatus =
  | { state: "idle" }
  | { state: "running"; accountId: number; phase: string; fetched: number }
  | {
      state: "done";
      accountId: number;
      fetched: number;
      inserted: number;
      duplicates: number;
      skipped: number;
    }
  | { state: "failed"; accountId: number; error: string };

export interface PgnImportSummary {
  games: number;
  inserted: number;
  duplicates: number;
  unassigned: number;
  rejected: string[];
}

export interface GameFilter {
  source?: string | null;
  timeClass?: string | null;
  userColor?: string | null;
  outcome?: string | null;
  player?: string | null;
}

export interface GameSummary {
  id: number;
  source: "lichess" | "chesscom" | "manual";
  sourceGameId: string;
  playedAt: string | null;
  timeControl: string;
  timeClass: string;
  white: string;
  black: string;
  whiteRating: number | null;
  blackRating: number | null;
  userColor: "w" | "b" | null;
  result: string;
  termination: string | null;
  eco: string | null;
  openingName: string | null;
  plyCount: number;
  wallClockSec: number | null;
}

export interface GamePage {
  total: number;
  games: GameSummary[];
}

export type Classification = "best" | "good" | "ok" | "inaccuracy" | "mistake" | "blunder";

export interface GamePly {
  ply: number;
  san: string;
  uci: string;
  clockMs: number | null;
  timeSpentMs: number | null;
  /** Evaluation after the move, White's view; filled by the analysis. */
  evalCp: number | null;
  evalMate: number | null;
  bestUci: string | null;
  bestPv: string | null;
  /** Mover's win-% before and after the move. */
  winBefore: number | null;
  winAfter: number | null;
  classification: Classification | null;
}

export interface GameFinding {
  id: number;
  ply: number;
  kind:
    "missed_tactic" | "allowed_tactic" | "time_trouble" | "opening_deviation" | "conversion_fail";
  motifs: string[];
  severity: number;
  phase: "opening" | "middlegame" | "endgame";
  summary: string;
  bestUci: string | null;
  bestSan: string | null;
}

export interface AnalysisInfo {
  analyzedAt: string;
  preset: "quick" | "deep";
  nodes: number;
}

export interface GameDetail extends GameSummary {
  pgn: string;
  initialSec: number | null;
  plies: GamePly[];
  analysis: AnalysisInfo | null;
  findings: GameFinding[];
}

export type AnalysisProgress =
  | { state: "running"; gameId: number; preset: "quick" | "deep"; done: number; total: number }
  | {
      state: "done";
      gameId: number;
      preset: "quick" | "deep";
      findings: number;
      elapsedMs: number;
    }
  | { state: "failed"; gameId: number; error: string };

export interface QueueStatus {
  current: AnalysisProgress | null;
  queued: number[];
}

export const ANALYSIS_EVENT = "analysis://progress";

export interface Evidence {
  gameId: number;
  ply: number;
  summary: string;
  white: string;
  black: string;
  playedAt: string | null;
  result: string;
  userColor: "w" | "b" | null;
}

export interface ThemeWeakness {
  theme: string;
  opportunities: number;
  misses: number;
  missRate: number;
  puzzleRating: number | null;
  puzzleGap: number | null;
  score: number;
  evidenceGames: number;
  evidence: Evidence[];
}

export interface WeaknessProfile {
  windowDays: number;
  analysedGames: number;
  unanalysedGames: number;
  themes: ThemeWeakness[];
}

export interface SrsDue {
  count: number;
  next: Puzzle | null;
}

export interface DurationEstimate {
  initialSec: number;
  incrementSec: number;
  p20Sec: number;
  p50Sec: number;
  p80Sec: number;
  maxSec: number;
  source: "prior" | "learned";
  games: number;
}

export type TaskKind = "srs_due" | "puzzles" | "review_game" | "play_game" | string;
export type TaskState = "pending" | "active" | "done" | "skipped" | "dropped";

export interface PlanTask {
  id: number;
  kind: TaskKind;
  /** Theme, game id or time control, by kind. */
  reference: string | null;
  title: string;
  why: string;
  priority: number;
  minMin: number;
  targetMin: number;
  maxMin: number;
  plannedMin: number;
  actualMin: number | null;
  state: TaskState;
  orderIdx: number;
  startedAt: string | null;
  carried: boolean;
  estimate: DurationEstimate | null;
}

export interface DayPlan {
  id: number;
  date: string;
  mode: "dedicated" | "casual";
  budgetMin: number;
  status: "open" | "closed";
  note: string | null;
  tasks: PlanTask[];
}

export interface ScheduleSettings {
  mode: "dedicated" | "casual";
  dailyMinutes: number;
  configured: boolean;
}

export interface Streak {
  days: number;
  minutesToday: number;
  minutesThisWeek: number;
}

export interface QuickAction {
  kind: TaskKind;
  reference: string | null;
  title: string;
  minutes: number;
}

export interface GameBlockStatus {
  taskId: number;
  startedAt: string;
  checks: number;
  lastCheck: string | null;
}

export type ScheduleEvent =
  | { state: "gameFinished"; taskId: number; gameId: number; note: string | null }
  | { state: "checked"; taskId: number; checks: number };

export const SCHEDULE_EVENT = "schedule://event";

// ---- Phase 7: openings, endgame, soft skills

export interface StyleScores {
  sharpness: number;
  initiative: number;
  label: "aggressive" | "tactical" | "defensive" | "mixed";
  games: number;
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: { text: string; sharpness: number; initiative: number }[];
}

export interface StyleProfile {
  fromGames: StyleScores | null;
  fromQuiz: StyleScores | null;
  source: "games" | "quiz";
  effective: StyleScores | null;
  quiz: QuizQuestion[];
  answers: number[] | null;
}

export interface Recommendation {
  slot: "white" | "black_e4" | "black_d4";
  repertoire: string;
  name: string;
  fit: number;
  reasons: string[];
}

export interface LineMove {
  ply: number;
  san: string;
  uci: string;
  fenBefore: string;
  note: string | null;
}

export interface RepertoireLine {
  key: string;
  name: string;
  repertoire: string;
  color: "white" | "black";
  moves: LineMove[];
}

export interface Repertoire {
  key: string;
  name: string;
  color: "white" | "black";
  against: "e4" | "d4" | null;
  style: string;
  sharpness: number;
  initiative: number;
  theoryLoad: number;
  minRating: number;
  ecoPrefixes: string[];
  summary: string;
  lines: RepertoireLine[];
}

export interface RepertoireChoices {
  white: string | null;
  blackE4: string | null;
  blackD4: string | null;
}

export interface DrillCard {
  refId: string;
  lineKey: string;
  lineName: string;
  repertoire: string;
  ply: number;
  fen: string;
  expectedUci: string;
  expectedSan: string;
  note: string | null;
  side: "white" | "black";
  replyUci: string | null;
  replySan: string | null;
  isNew: boolean;
  dueAt: string | null;
}

export interface DrillStats {
  due: number;
  learned: number;
  totalMoves: number;
}

export interface Deviation {
  gameId: number;
  ply: number;
  playedSan: string;
  playedUci: string;
  expectedSan: string;
  expectedUci: string;
  lineKey: string;
  lineName: string;
  fenBefore: string;
  white: string;
  black: string;
  playedAt: string | null;
  kept: boolean;
}

export interface DeviationGroup {
  lineKey: string;
  lineName: string;
  ply: number;
  playedSan: string;
  playedUci: string;
  expectedSan: string;
  expectedUci: string;
  games: number;
  latest: Deviation;
}

export interface FamilyStat {
  family: string;
  games: number;
  score: number;
  winAtMove15: number | null;
  mostPlayed: string | null;
}

export interface DrillPosition {
  fen: string;
  side: "white" | "black";
  goal: "win" | "draw";
  success: "mate" | "promote" | "draw";
  holdMoves: number;
  note: string;
}

export interface EndgameLesson {
  id: string;
  title: string;
  concept: string;
  positions: DrillPosition[];
}

export interface EndgameUnit {
  id: number;
  title: string;
  lessons: EndgameLesson[];
}

export interface EndgameProgress {
  lessonId: string;
  attempts: number;
  successes: number;
  status: "started" | "done";
  completedAt: string | null;
}

export interface EndgameCurriculum {
  units: EndgameUnit[];
  progress: EndgameProgress[];
}

export interface EndgameVerdict {
  ok: boolean;
  message: string;
  fenAfter: string;
  replyUci: string | null;
  replySan: string | null;
  fenNext: string | null;
  done: boolean;
  category: string;
}

export interface Insight {
  id: string;
  area: "time" | "mind";
  title: string;
  observation: string;
  why: string;
  action: string;
  severity: number;
  sample: number;
  positive: boolean;
}

export interface SoftSkills {
  windowDays: number;
  games: number;
  gamesWithClocks: number;
  insights: Insight[];
}

// ---- Phase 7b: Lichess Elite Database

export interface EliteMonth {
  month: string;
  fileName: string;
  path: string | null;
  bytes: number;
  state: "available" | "queued" | "importing" | "done" | "cancelled" | string;
  gamesImported: number;
  gamesSkipped: number;
  elapsedMs: number | null;
  importedAt: string | null;
  explorerRows: number;
}

export interface EliteTotals {
  monthsDone: number;
  games: number;
  explorerRows: number;
  dbBytes: number;
  newestMonth: string | null;
  oldestMonth: string | null;
}

export type EliteJob =
  | { state: "idle" }
  | {
      state: "running";
      phase: string;
      month: string;
      monthsDone: number;
      monthsTotal: number;
      games: number;
      skipped: number;
      bytesDone: number;
      bytesTotal: number;
      elapsedMs: number;
    }
  | { state: "done"; months: number; games: number; modelLines: number; elapsedMs: number }
  | { state: "failed"; error: string }
  | { state: "cancelled" };

export interface EliteOverview {
  folder: string | null;
  months: EliteMonth[];
  totals: EliteTotals;
  available: boolean;
  job: EliteJob;
  plyCap: number;
  dbPath: string;
}

export const ELITE_EVENT = "elite://progress";

export interface ExplorerMove {
  uci: string;
  san: string;
  games: number;
  whiteWins: number;
  draws: number;
  blackWins: number;
  score: number;
  avgElo: number;
  lastMonth: string;
  share: number;
  recentShare: number | null;
  olderShare: number | null;
}

export interface EliteTopGame {
  id: number;
  white: string;
  black: string;
  whiteElo: number | null;
  blackElo: number | null;
  result: string;
  playedOn: string | null;
  opening: string | null;
  plyCount: number;
}

export interface ExplorerResult {
  total: number;
  moves: ExplorerMove[];
  topGames: EliteTopGame[];
  newestMonth: string | null;
}

export interface ExplorerPlan {
  side: "White" | "Black";
  feature: string;
  sentence: string;
  gamesWith: number;
  gamesTotal: number;
  avgPly: number;
  scoreWith: number;
  scoreWithout: number;
}

export interface ModelGameNote {
  ply: number;
  text: string;
}

export interface ModelGame {
  rank: number;
  game: EliteTopGame;
  moves: string[];
  score: number;
  reason: string;
  annotations: { winWhite: number[]; bestUci: (string | null)[]; notes: ModelGameNote[] };
  linePly: number;
}

export interface MasterDeviationGroup {
  fen: string;
  ply: number;
  userSan: string;
  userUci: string;
  topSan: string;
  topUci: string;
  topShare: number;
  topScore: number;
  userScore: number;
  games: number;
  latestGameId: number;
  opening: string | null;
  verdict: "rare_but_sound" | "dubious";
}

export interface TrendWarning {
  lineKey: string;
  ply: number;
  san: string;
  recentShare: number;
  olderShare: number;
  games: number;
}

// ---- Stats page

export interface PlayerRating {
  source: "lichess" | "chesscom";
  timeClass: string;
  rating: number;
  asOf: string;
  games: number;
  threeMonthsAgo: number | null;
}

export interface AreaScore {
  area: "opening" | "middlegame" | "endgame" | "tactics";
  score: number | null;
  measure: number | null;
  expected: number | null;
  sample: number;
  label: "strength" | "weakness" | "average";
  note: string;
}

export interface MonthPoint {
  month: string;
  games: number;
  analysed: number;
  ratings: Record<string, number>;
  areas: Record<string, number>;
}

export interface PlayerStats {
  ratings: PlayerRating[];
  referenceRating: number;
  areas: AreaScore[];
  history: MonthPoint[];
  analysedGames: number;
  totalGames: number;
}

export const ipc = {
  playerStats: () => invoke<PlayerStats>("player_stats"),
  eliteStatus: () => invoke<EliteOverview>("elite_status"),
  eliteSetFolder: (path: string | null) => invoke<void>("elite_set_folder", { path }),
  eliteSetPlyCap: (plyCap: number) => invoke<void>("elite_set_ply_cap", { plyCap }),
  eliteImport: (months: string[]) => invoke<void>("elite_import", { months }),
  eliteImportFile: (path: string) => invoke<void>("elite_import_file", { path }),
  eliteCancel: () => invoke<void>("elite_cancel"),
  eliteRemoveMonth: (month: string) => invoke<void>("elite_remove_month", { month }),
  onEliteEvent: (handler: (e: EliteJob) => void): Promise<UnlistenFn> =>
    listen<EliteJob>(ELITE_EVENT, (e) => handler(e.payload)),
  explorerQuery: (
    fen: string,
    tc: number[],
    fromMonth: string | null = null,
    toMonth: string | null = null,
  ) => invoke<ExplorerResult>("explorer_query", { fen, tc, fromMonth, toMonth }),
  explorerPlans: (fen: string) => invoke<ExplorerPlan[]>("explorer_plans", { fen }),
  eliteGame: (id: number) =>
    invoke<{ game: EliteTopGame; moves: string[] } | null>("elite_game", { id }),
  modelGames: (lineKey: string) => invoke<ModelGame[]>("model_games", { lineKey }),
  linesWithModelGames: () => invoke<string[]>("lines_with_model_games"),
  masterDeviations: (games: number) =>
    invoke<MasterDeviationGroup[]>("master_deviations", { games }),
  keepMasterMove: (fen: string, uci: string) => invoke<void>("keep_master_move", { fen, uci }),
  addMasterDrill: (fen: string, uci: string) => invoke<void>("add_master_drill", { fen, uci }),
  repertoireTrends: () => invoke<TrendWarning[]>("repertoire_trends"),
  styleProfile: () => invoke<StyleProfile>("style_profile"),
  saveStyleQuiz: (answers: number[]) => invoke<StyleProfile>("save_style_quiz", { answers }),
  setStyleSource: (source: "games" | "quiz") =>
    invoke<StyleProfile>("set_style_source", { source }),
  repertoireRecommendations: () => invoke<Recommendation[]>("repertoire_recommendations"),
  listRepertoires: () => invoke<Repertoire[]>("list_repertoires"),
  repertoireChoices: () => invoke<RepertoireChoices>("repertoire_choices"),
  chooseRepertoire: (slot: Recommendation["slot"], key: string | null) =>
    invoke<RepertoireChoices>("choose_repertoire", { slot, key }),
  openingDrillSession: (newLimit: number) =>
    invoke<DrillCard[]>("opening_drill_session", { newLimit }),
  answerOpeningDrill: (refId: string, correct: boolean) =>
    invoke<string>("answer_opening_drill", { refId, correct }),
  addOpeningDrill: (lineKey: string, ply: number) =>
    invoke<DrillStats>("add_opening_drill", { lineKey, ply }),
  openingDrillStats: () => invoke<DrillStats>("opening_drill_stats"),
  gameRepertoireDeviation: (gameId: number) =>
    invoke<Deviation | null>("game_repertoire_deviation", { gameId }),
  recentRepertoireDeviations: (games: number) =>
    invoke<DeviationGroup[]>("recent_repertoire_deviations", { games }),
  keepRepertoireMove: (lineKey: string, ply: number, uci: string) =>
    invoke<void>("keep_repertoire_move", { lineKey, ply, uci }),
  openingFamilyStats: () => invoke<FamilyStat[]>("opening_family_stats"),
  endgameCurriculum: () => invoke<EndgameCurriculum>("endgame_curriculum"),
  nextEndgameLesson: () => invoke<EndgameLesson | null>("next_endgame_lesson"),
  endgameJudge: (lessonId: string, position: number, fen: string, uci: string) =>
    invoke<EndgameVerdict>("endgame_judge", { lessonId, position, fen, uci }),
  endgameAttempt: (lessonId: string, success: boolean) =>
    invoke<EndgameProgress[]>("endgame_attempt", { lessonId, success }),
  softSkills: () => invoke<SoftSkills>("soft_skills"),
  scheduleSettings: () => invoke<ScheduleSettings>("schedule_settings"),
  setScheduleSettings: (mode: "dedicated" | "casual", dailyMinutes: number) =>
    invoke<ScheduleSettings>("set_schedule_settings", { mode, dailyMinutes }),
  todayPlan: () => invoke<DayPlan | null>("today_plan"),
  regenerateToday: () => invoke<DayPlan>("regenerate_today"),
  casualSession: (minutes: number, withGame: boolean) =>
    invoke<DayPlan>("casual_session", { minutes, withGame }),
  quickActions: () => invoke<QuickAction[]>("quick_actions"),
  startTask: (id: number) => invoke<DayPlan>("start_task", { id }),
  finishTask: (id: number, actualMin: number | null = null) =>
    invoke<DayPlan>("finish_task", { id, actualMin }),
  skipTask: (id: number) => invoke<DayPlan>("skip_task", { id }),
  startGameBlock: (id: number) => invoke<DayPlan>("start_game_block", { id }),
  finishGameBlock: (id: number) => invoke<DayPlan>("finish_game_block", { id }),
  gameBlockStatus: () => invoke<GameBlockStatus | null>("game_block_status"),
  durationEstimate: (initialSec: number, incrementSec: number) =>
    invoke<DurationEstimate>("duration_estimate", { initialSec, incrementSec }),
  trainingStreak: () => invoke<Streak>("training_streak"),
  onScheduleEvent: (handler: (e: ScheduleEvent) => void): Promise<UnlistenFn> =>
    listen<ScheduleEvent>(SCHEDULE_EVENT, (e) => handler(e.payload)),
  listAccounts: () => invoke<Account[]>("list_accounts"),
  addAccount: (source: string, username: string) =>
    invoke<number>("add_account", { source, username }),
  removeAccount: (id: number) => invoke<void>("remove_account", { id }),
  syncAccount: (id: number) => invoke<void>("sync_account", { id }),
  syncStatus: () => invoke<SyncStatus>("sync_status"),
  onSyncEvent: (handler: (status: SyncStatus) => void): Promise<UnlistenFn> =>
    listen<SyncStatus>(SYNC_EVENT, (e) => handler(e.payload)),
  importPgnText: (text: string) => invoke<PgnImportSummary>("import_pgn_text", { text }),
  listGames: (filter: GameFilter, limit: number, offset: number) =>
    invoke<GamePage>("list_games", { filter, limit, offset }),
  getGame: (id: number) => invoke<GameDetail | null>("get_game", { id }),
  deleteGame: (id: number) => invoke<boolean>("delete_game", { id }),
  setGameUserColor: (id: number, color: "w" | "b" | null, rememberAlias: boolean) =>
    invoke<void>("set_game_user_color", { id, color, rememberAlias }),
  weaknessProfile: () => invoke<WeaknessProfile>("weakness_profile"),
  analyzeUnreviewed: (limit: number) => invoke<number>("analyze_unreviewed", { limit }),
  trainingSet: (theme: string, ecoFamily: string | null, size: number) =>
    invoke<Puzzle[]>("training_set", { theme, ecoFamily, size }),
  srsDue: () => invoke<SrsDue>("srs_due"),
  analyzeGame: (id: number, preset: "quick" | "deep") =>
    invoke<void>("analyze_game", { id, preset }),
  analysisStatus: () => invoke<QueueStatus>("analysis_status"),
  cancelAnalysis: () => invoke<void>("cancel_analysis"),
  onAnalysisEvent: (handler: (p: AnalysisProgress) => void): Promise<UnlistenFn> =>
    listen<AnalysisProgress>(ANALYSIS_EVENT, (e) => handler(e.payload)),
  puzzleImportStatus: () => invoke<PuzzleImportStatus>("puzzle_import_status"),
  startPuzzleImport: (folder: string | null) => invoke<void>("start_puzzle_import", { folder }),
  cancelPuzzleImport: () => invoke<void>("cancel_puzzle_import"),
  onPuzzleProgress: (handler: (state: PuzzleImportState) => void): Promise<UnlistenFn> =>
    listen<PuzzleImportState>(PUZZLE_PROGRESS_EVENT, (e) => handler(e.payload)),
  puzzleThemes: () => invoke<ThemeCount[]>("puzzle_themes"),
  countPuzzles: (filter: PuzzleFilter) => invoke<number>("count_puzzles", { filter }),
  pickPuzzles: (filter: PuzzleFilter, limit: number) =>
    invoke<Puzzle[]>("pick_puzzles", { filter, limit }),
  recordPuzzleAttempt: (puzzleId: string, success: boolean, timeMs: number, hintsUsed: number) =>
    invoke<AttemptResult>("record_puzzle_attempt", { puzzleId, success, timeMs, hintsUsed }),
  themeRatings: () => invoke<ThemeRating[]>("theme_ratings"),
  recentPuzzleAttempts: (limit: number) => invoke<Attempt[]>("recent_puzzle_attempts", { limit }),
  appInfo: () => invoke<AppInfo>("app_info"),
  engineStatus: () => invoke<EngineStatus>("engine_status"),
  getSetting: (key: string) => invoke<string | null>("get_setting", { key }),
  setSetting: (key: string, value: string) => invoke<void>("set_setting", { key, value }),
  analyzePosition: (id: number, fen: string, moves: string[], multipv: number) =>
    invoke<AnalysisTicket>("analyze_position", { id, fen, moves, multipv }),
  stopAnalysis: () => invoke<void>("stop_analysis"),
  onEngineEvent: (handler: (event: EngineEvent) => void): Promise<UnlistenFn> =>
    listen<EngineEvent>(ENGINE_EVENT, (e) => handler(e.payload)),
};
