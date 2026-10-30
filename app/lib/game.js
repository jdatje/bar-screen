// Quiz engine shared by Intro raden, Popquiz and Pubquiz.
//
// Phases: loading → question → between → … → roundEnd → reveal → scoreboard
//         → (next round: question …) → final
// Answers are hidden until the round's walkthrough ("Antwoorden bekijken").
import * as spotify from './spotify.js';
import { getHook, setHook } from './hooks.js';
import { musicQuestions, triviaQuestions } from './questions.js';

const BETWEEN_MS = 2500;
const MUSIC_TYPES = ['intro', 'popquiz'];

export const TYPE_LABELS = { intro: 'Intro raden', popquiz: 'Popquiz', pubquiz: 'Pubquiz' };
const TYPE_LABELS_EN = { intro: 'Name that intro', popquiz: 'Pop quiz', pubquiz: 'Pub quiz' };

export class Game {
  /**
   * @param {object} deps
   * @param {() => Map<string,{name:string, sockets:Set}>} deps.players
   * @param {(screenState:object, phoneState:(id:string)=>object) => void} deps.emit
   */
  constructor({ players, emit }) {
    this.players = players;
    this.emitFn = emit;
    this.reset();
  }

  reset() {
    clearTimeout(this.timer);
    clearTimeout(this.clipTimer);
    this.active = false;
    this.phase = null;
    this.type = null;
    this.settings = null;
    this.questions = [];
    this.index = -1;
    this.revealIndex = -1;
    this.answers = []; // per question: Map playerId -> { choice, ms, correct, points }
    this.scores = new Map(); // playerId -> total
    this.roundStartScores = new Map();
    this.error = null;
    this.musicSnapshot = null;
    this.hookMs = null;
    this.hookPlaying = false;
  }

  get round() {
    return Math.floor(Math.max(0, this.index) / this.settings.perRound);
  }
  get roundRange() {
    const start = this.round * this.settings.perRound;
    return [start, Math.min(start + this.settings.perRound, this.questions.length) - 1];
  }
  get isMusic() {
    return MUSIC_TYPES.includes(this.type);
  }
  onlineIds() {
    return [...this.players().entries()].filter(([, p]) => p.quiz === this.type && p.sockets.size > 0).map(([id]) => id);
  }

  // ---------- Players ----------
  // who plays: phones that tapped "Quiz" plus names added by hand on the screen
  addPlayer(id) {
    if (this.active && !this.scores.has(id) && this.players().get(id)?.quiz === this.type) this.scores.set(id, 0);
  }
  removePlayer(id) {
    this.scores.delete(id);
    this.roundStartScores.delete(id);
    for (const a of this.answers) a.delete(id);
    if (this.active) this.emit();
  }

  // ---------- Lifecycle ----------
  async start(type, settings) {
    this.reset();
    for (const [id, p] of this.players()) if (p.quiz === type && (p.sockets.size > 0 || p.manual)) this.scores.set(id, 0);
    this.active = true;
    this.type = type;
    this.settings = {
      ...settings,
      rounds: clamp(settings.rounds, 1, 6, 2),
      perRound: clamp(settings.perRound, 3, 20, 8),
      seconds: clamp(settings.seconds, 5, 60, 20),
      clip: clamp(settings.clip, 3, 30, 10),
    };
    this.phase = 'loading';
    this.emit();

    try {
      const total = this.settings.rounds * this.settings.perRound;
      this.questions = this.isMusic
        ? await musicQuestions(type, this.settings, total)
        : await triviaQuestions(this.settings, total);
      // fewer questions than asked: shrink rounds so they stay full
      this.settings.rounds = Math.max(1, Math.ceil(this.questions.length / this.settings.perRound));
      this.answers = this.questions.map(() => new Map());
      if (this.isMusic) this.musicSnapshot = await spotify.snapshot().catch(() => null);
      this.roundStartScores = new Map(this.scores);
      this.startQuestion(0);
    } catch (err) {
      this.error = err.message;
      this.phase = 'error';
      this.emit();
    }
  }

  async end() {
    const snap = this.musicSnapshot;
    const wasMusic = this.isMusic;
    this.reset();
    this.emit();
    if (wasMusic) await spotify.restore(snap).catch(() => {});
  }

  // ---------- Questions ----------
  async startQuestion(i) {
    clearTimeout(this.timer);
    this.index = i;
    this.phase = 'question';
    this.startedAt = Date.now();
    this.endsAt = this.startedAt + this.settings.seconds * 1000;
    this.timer = setTimeout(() => this.closeQuestion(), this.settings.seconds * 1000);
    this.emit();
    this.playClip().catch(() => {});
  }

  async playClip() {
    const q = this.questions[this.index];
    if (!q?.audio || !q.track) return;
    const startMs = q.audio === 'hook' ? await getHook(q.track) : 0;
    await spotify.playTrack(q.track.uri, startMs);
    clearTimeout(this.clipTimer);
    this.clipTimer = setTimeout(() => spotify.command('pause').catch(() => {}), this.settings.clip * 1000);
  }

  answer(playerId, choice) {
    if (this.phase !== 'question') return { ok: false, error: 'closed' };
    const q = this.questions[this.index];
    if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) return { ok: false, error: 'invalid' };
    // allow changing your answer while the clock runs; speed counts from the last change
    this.answers[this.index].set(playerId, { choice, ms: Date.now() - this.startedAt });
    if (!this.scores.has(playerId)) this.scores.set(playerId, 0);
    const online = this.onlineIds();
    const allIn = online.length > 0 && online.every((id) => this.answers[this.index].has(id));
    if (allIn) {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.closeQuestion(), 1200);
    }
    this.emit();
    return { ok: true };
  }

  closeQuestion() {
    if (this.phase !== 'question') return;
    clearTimeout(this.timer);
    clearTimeout(this.clipTimer);
    const q = this.questions[this.index];
    const limit = this.settings.seconds * 1000;
    for (const [id, a] of this.answers[this.index]) {
      a.correct = a.choice === q.answer;
      a.points = a.correct ? Math.round((500 + 500 * Math.max(0, 1 - a.ms / limit)) / 10) * 10 : 0;
    }
    if (q.audio) spotify.command('pause').catch(() => {});

    const [, last] = this.roundRange;
    if (this.index >= last) {
      this.phase = 'roundEnd';
      this.emit();
    } else {
      this.phase = 'between';
      this.emit();
      this.timer = setTimeout(() => this.startQuestion(this.index + 1), BETWEEN_MS);
    }
  }

  // Host controls during a question
  stopTime() {
    this.closeQuestion();
  }
  replay() {
    if (this.phase === 'question') this.playClip().catch(() => {});
  }

  // ---------- Walkthrough ----------
  startReveal() {
    if (this.phase !== 'roundEnd') return;
    this.phase = 'reveal';
    this.revealIndex = this.roundRange[0];
    this.loadHookForReveal();
    this.emit();
  }

  revealStep(dir) {
    if (this.phase !== 'reveal') return;
    const [first, last] = this.roundRange;
    const next = this.revealIndex + dir;
    if (next < first) return;
    if (next > last) return this.showScoreboard();
    this.revealIndex = next;
    this.stopHook();
    this.loadHookForReveal();
    this.emit();
  }

  async loadHookForReveal() {
    const q = this.questions[this.revealIndex];
    this.hookMs = null;
    if (q?.track) {
      this.hookMs = await getHook(q.track).catch(() => null);
      this.emit();
    }
  }

  async playHook() {
    const q = this.questions[this.revealIndex];
    if (this.phase !== 'reveal' || !q?.track) return;
    const ms = this.hookMs ?? (await getHook(q.track));
    this.hookPlaying = true;
    await spotify.playTrack(q.track.uri, ms);
  }

  // Only stop the music if the walkthrough started a song itself; music
  // that was already playing (e.g. during a pubquiz) just keeps going.
  stopHook() {
    if (!this.hookPlaying) return;
    this.hookPlaying = false;
    spotify.command('pause').catch(() => {});
  }

  // Correct the chorus start by ±seconds; it's remembered for next time
  async adjustHook(deltaSec) {
    const q = this.questions[this.revealIndex];
    if (this.phase !== 'reveal' || !q?.track) return;
    const ms = Math.max(0, (this.hookMs ?? (await getHook(q.track))) + deltaSec * 1000);
    setHook(q.track.id, ms);
    this.hookMs = ms;
    this.emit();
    this.hookPlaying = true;
    await spotify.playTrack(q.track.uri, ms);
  }

  // ---------- Scores ----------
  showScoreboard() {
    const [first, last] = this.roundRange;
    for (let i = first; i <= last; i++) {
      for (const [id, a] of this.answers[i]) this.scores.set(id, (this.scores.get(id) || 0) + (a.points || 0));
    }
    this.stopHook();
    const isLastRound = this.round >= this.settings.rounds - 1 || last >= this.questions.length - 1;
    this.phase = isLastRound ? 'final' : 'scoreboard';
    this.emit();
  }

  nextRound() {
    if (this.phase !== 'scoreboard') return;
    this.roundStartScores = new Map(this.scores);
    this.startQuestion(this.roundRange[1] + 1);
  }

  standings() {
    const names = this.players();
    return [...this.scores.entries()]
      .map(([id, score]) => ({
        id,
        name: names.get(id)?.name || (this.settings?.lang === 'en' ? 'Guest' : 'Gast'),
        score,
        delta: score - (this.roundStartScores.get(id) || 0),
      }))
      .sort((a, b) => b.score - a.score)
      .map((s, _i, arr) => ({ ...s, rank: 1 + arr.filter((o) => o.score > s.score).length }));
  }

  // ---------- Views ----------
  base() {
    if (!this.active) return { active: false };
    const [first, last] = this.index >= 0 ? this.roundRange : [0, 0];
    return {
      active: true,
      type: this.type,
      typeLabel: (this.settings?.lang === 'en' ? TYPE_LABELS_EN : TYPE_LABELS)[this.type],
      phase: this.phase,
      error: this.error,
      round: this.round + 1,
      rounds: this.settings.rounds,
      qInRound: this.index - first + 1,
      perRound: last - first + 1,
      serverNow: Date.now(),
      endsAt: this.endsAt,
      seconds: this.settings.seconds,
    };
  }

  screenView() {
    const v = this.base();
    if (!v.active) return v;
    const names = this.players();
    if (['question', 'between', 'roundEnd'].includes(this.phase)) {
      const q = this.questions[this.index];
      v.question = { kind: q.kind, prompt: q.prompt, options: q.options, category: q.category, audio: q.audio };
      v.answered = this.answers[this.index].size;
      v.online = this.onlineIds().length;
    }
    if (this.phase === 'reveal') {
      const q = this.questions[this.revealIndex];
      const answers = [...this.answers[this.revealIndex].entries()];
      v.reveal = {
        index: this.revealIndex - this.roundRange[0] + 1,
        prompt: q.prompt,
        options: q.options,
        answer: q.answer,
        info: q.reveal,
        hasAudio: Boolean(q.track?.uri),
        hookMs: this.hookMs,
        distribution: q.options.map((_, i) => answers.filter(([, a]) => a.choice === i).length),
        correct: answers
          .filter(([, a]) => a.correct)
          .sort((a, b) => a[1].ms - b[1].ms)
          .map(([id, a]) => ({ name: names.get(id)?.name || (this.settings?.lang === 'en' ? 'Guest' : 'Gast'), points: a.points, secs: (a.ms / 1000).toFixed(1) })),
      };
    }
    if (['question', 'between', 'roundEnd', 'scoreboard', 'final'].includes(this.phase)) v.standings = this.standings();
    if (['question', 'between', 'roundEnd'].includes(this.phase)) {
      // during a round, show standings as they were at the start of the round
      v.standings = v.standings.map((s) => ({ ...s, score: this.roundStartScores.get(s.id) || 0 })).sort((a, b) => b.score - a.score);
    }
    return v;
  }

  phoneView(playerId) {
    const v = this.base();
    if (!v.active) return v;
    if (this.phase === 'question' || this.phase === 'between') {
      const q = this.questions[this.index];
      v.question = { prompt: q.prompt, options: q.options, category: q.category };
      v.myChoice = this.answers[this.index].get(playerId)?.choice ?? null;
    }
    if (this.phase === 'reveal') {
      const q = this.questions[this.revealIndex];
      const a = this.answers[this.revealIndex].get(playerId);
      v.reveal = {
        prompt: q.prompt,
        answer: q.options[q.answer],
        mine: a ? q.options[a.choice] : null,
        correct: Boolean(a?.correct),
        points: a?.points || 0,
      };
    }
    if (['scoreboard', 'final', 'roundEnd'].includes(this.phase)) {
      const st = this.standings();
      const me = st.find((s) => s.id === playerId);
      v.me = me ? { rank: me.rank, score: me.score, delta: me.delta, of: st.length } : null;
      if (this.phase === 'roundEnd') v.me = null;
    }
    return v;
  }

  emit() {
    this.emitFn(this.screenView(), (id) => this.phoneView(id));
  }
}

function clamp(v, min, max, dflt) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : dflt;
}
