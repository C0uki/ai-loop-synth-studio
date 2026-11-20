import { midiToNoteName } from './audio';
import { state } from './state';
import type { Note } from './types';
import { $, cssVar, drawPhraseRoll, playLiveNote, regenerate, releaseLiveNote, showToast } from './ui';

const STEP = 0.25; // 16分音符
const COLS = 32; // 8拍 ÷ 16分
const GUTTER = 44; // 左の音名欄（px）
const BLACK = new Set([1, 3, 6, 8, 10]);

let lo = 60;
let hi = 83;
/**
 * new = 置いている途中の新しい音 / move = 持ち上げて動かしている既存の音 / resize = 右端を引いて長さを変えている既存の音。
 * move と resize の元の音は、操作中だけ phraseNotes から外してある。ただし copy（Alt / Ctrl を押して動かす複製）は元の音を残す。
 */
type Drag =
  | { kind: 'new'; midi: number; col: number; end: number }
  | { kind: 'move'; note: Note; grab: number; midi: number; start: number; moved: boolean; copy: boolean }
  | { kind: 'resize'; note: Note; dur: number }
  | { kind: 'select'; c0: number; m0: number; c1: number; m1: number } // Shift+ドラッグで囲んでいる範囲（列, 音）
  // 選択中の音をまとめて動かす（拍 dt・音の高さ dp だけずらす。copy なら複製）/ まとめて長さを変える（dd だけ伸ばす）。元の音は動かし終わるまでそのまま
  | { kind: 'gmove'; notes: Note[]; col0: number; midi0: number; dt: number; dp: number; copy: boolean }
  | { kind: 'gresize'; notes: Note[]; col0: number; dd: number };
let drag: Drag | null = null;
let hover: PointerEvent | null = null; // 直近のカーソル位置（コピー元と貼り付け先に使う）
let clip: Note[] = []; // コピーした音
const selected = new Set<Note>(); // 選択中の音（Shift で選ぶ）

const panel = (): HTMLElement => $('editorPanel');
const canvas = (): HTMLCanvasElement => $<HTMLCanvasElement>('editorCanvas');

function draw(): void {
  const c = canvas();
  const dpr = window.devicePixelRatio || 1;
  const rect = c.getBoundingClientRect();
  c.width = rect.width * dpr;
  c.height = rect.height * dpr;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);

  const rows = hi - lo + 1;
  const rowH = rect.height / rows;
  const colW = (rect.width - GUTTER) / COLS;

  // 行: 黒鍵の行は少し暗く、C には音名を出す
  ctx.font = '10px ui-monospace, "SF Mono", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let m = lo; m <= hi; m++) {
    const y = (hi - m) * rowH;
    if (BLACK.has(m % 12)) {
      ctx.fillStyle = cssVar('--separator');
      ctx.globalAlpha = 0.35;
      ctx.fillRect(GUTTER, y, rect.width - GUTTER, rowH);
      ctx.globalAlpha = 1;
    }
    if (m % 12 === 0) {
      ctx.fillStyle = cssVar('--label-secondary');
      ctx.fillText(midiToNoteName(m), GUTTER - 6, y + rowH / 2);
      ctx.fillStyle = cssVar('--separator');
      ctx.fillRect(GUTTER, y + rowH - 0.5, rect.width - GUTTER, 1);
    }
  }

  // 列: 16分 / 拍 / 小節
  for (let i = 0; i <= COLS; i++) {
    const x = GUTTER + i * colW;
    ctx.strokeStyle = cssVar(i === 16 ? '--blue' : '--separator');
    ctx.globalAlpha = i === 16 ? 0.6 : i % 4 === 0 ? 1 : 0.35;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, rect.height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const box = (midi: number, start: number, dur: number, alpha: number): void => {
    const x = GUTTER + (start / STEP) * colW;
    const w = Math.max(4, (dur / STEP) * colW - 1);
    const y = (hi - midi) * rowH + 1;
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, cssVar('--blue'));
    grad.addColorStop(1, cssVar('--purple'));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, rowH - 2, 3);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  const d = drag;
  const lifted = d?.kind === 'gmove' && !d.copy ? d.notes : []; // 持ち上げて動かしている最中の元の音は薄くする
  state.phraseNotes.forEach(n => {
    box(n.midi, n.start, n.dur, (0.2 + 0.8 * n.vel) * (lifted.includes(n) ? 0.3 : 1)); // 強い音ほど濃く
    if (!selected.has(n)) return;
    ctx.strokeStyle = cssVar('--orange');
    ctx.lineWidth = 2;
    ctx.strokeRect(GUTTER + (n.start / STEP) * colW, (hi - n.midi) * rowH + 1, Math.max(4, (n.dur / STEP) * colW - 1), rowH - 2);
  });
  if (drag?.kind === 'select') {
    const x = GUTTER + Math.min(drag.c0, drag.c1) * colW;
    const y = (hi - Math.max(drag.m0, drag.m1)) * rowH;
    const w = (Math.abs(drag.c1 - drag.c0) + 1) * colW;
    const h = (Math.abs(drag.m1 - drag.m0) + 1) * rowH;
    ctx.fillStyle = cssVar('--blue');
    ctx.globalAlpha = 0.18;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = cssVar('--blue');
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
  }
  if (drag?.kind === 'new') box(drag.midi, drag.col * STEP, (drag.end - drag.col + 1) * STEP, 0.6);
  if (drag?.kind === 'move') box(drag.midi, drag.start, drag.note.dur, 0.85);
  if (drag?.kind === 'resize') box(drag.note.midi, drag.note.start, drag.dur, 0.85);
  if (d?.kind === 'gmove') d.notes.forEach(n => box(n.midi + d.dp, n.start + d.dt, n.dur, 0.85));
  if (d?.kind === 'gresize') d.notes.forEach(n => box(n.midi, n.start, groupDur(n, d.dd), 0.85));
}

/** まとめて長さを変えたときの、1つの音の長さ（16分より短くせず、2小節の終わりを超えない）。 */
const groupDur = (n: Note, dd: number): number => Math.min(8 - n.start, Math.max(STEP, n.dur + dd));

/** 音の集まりが占める範囲（拍・音の高さ）。まとめて動かすとき、はみ出さないよう収めるのに使う。 */
function span(ns: Note[]): { t0: number; end: number; min: number; max: number } {
  return {
    t0: Math.min(...ns.map(n => n.start)),
    end: Math.max(...ns.map(n => n.start + n.dur)),
    min: Math.min(...ns.map(n => n.midi)),
    max: Math.max(...ns.map(n => n.midi))
  };
}

/** 画面上の位置 → { 音, 列 }（音名欄の上なら null）。 */
function cellAt(e: PointerEvent): { midi: number; col: number } | null {
  const rect = canvas().getBoundingClientRect();
  const x = e.clientX - rect.left - GUTTER;
  if (x < 0) return null;
  const col = Math.min(COLS - 1, Math.floor(x / ((rect.width - GUTTER) / COLS)));
  const midi = hi - Math.min(hi - lo, Math.floor((e.clientY - rect.top) / (rect.height / (hi - lo + 1))));
  return { midi, col };
}

/** 位置にある音と、その右端（長さを変える持ち手）をつかんでいるかどうか。 */
function noteAt(e: PointerEvent): { index: number; onEdge: boolean } | null {
  const p = cellAt(e);
  if (!p) return null;
  const t0 = p.col * STEP;
  const index = state.phraseNotes.findIndex(n => n.midi === p.midi && n.start < t0 + STEP - 1e-6 && n.start + n.dur > t0 + 1e-6);
  if (index < 0) return null;
  const n = state.phraseNotes[index];
  const rect = canvas().getBoundingClientRect();
  const colW = (rect.width - GUTTER) / COLS;
  const edgeX = GUTTER + ((n.start + n.dur) / STEP) * colW;
  const zone = Math.min(8, (n.dur / STEP) * colW / 3); // 短い音でも、動かす部分を残す
  return { index, onEdge: e.clientX - rect.left >= edgeX - zone };
}

// 元に戻す用。last は「いまの状態」の写しで、編集のたびに1つ前の状態を undoStack へ積む
const undoStack: Note[][] = [];
const redoStack: Note[][] = [];
let last: Note[] = [];
const snap = (): Note[] => state.phraseNotes.map(n => ({ ...n }));

/** 編集を確定する: 履歴に積んで、曲に反映する。 */
function commit(): void {
  undoStack.push(last);
  redoStack.length = 0;
  apply();
  last = snap();
}

/** 元に戻す / やり直す（from から1つ取り出して、いまの状態を to へ積む）。 */
function restore(from: Note[][], to: Note[][]): void {
  const prev = from.pop();
  if (!prev) return;
  to.push(last);
  state.phraseNotes = prev.map(n => ({ ...n }));
  selected.clear();
  apply();
  last = snap();
}

/** 画面と曲を、いまの音の並びに合わせる（再生中ならそのまま変わる）。 */
function apply(): void {
  state.phraseNotes.sort((a, b) => a.start - b.start);
  draw();
  drawPhraseRoll();
  if (state.phraseNotes.length > 0) {
    regenerate();
    $('recStatusText').textContent = `打ち込み: ${state.phraseNotes.length}音。曲に反映しました`;
  } else {
    $('recStatusText').textContent = '音がありません。打ち込むか、サンプルを選んでください';
  }
}

function audition(midi: number, vel = 0.8): void {
  playLiveNote(midi, vel);
  setTimeout(() => releaseLiveNote(midi, true), 250);
}

/** 高さ・強さを変える対象: 選択中の音。なければカーソルの下の音（選択して、続けて操作できるようにする）。 */
function targets(): Note[] {
  const sel = state.phraseNotes.filter(n => selected.has(n));
  if (sel.length) return sel;
  const hit = hover && noteAt(hover);
  if (!hit) return [];
  const n = state.phraseNotes[hit.index];
  selected.add(n);
  return [n];
}

/** 文字入力やスライダーを操作中は、↑↓などをそちらに譲る。 */
const typing = (): boolean => ['SELECT', 'INPUT'].includes(document.activeElement?.tagName ?? '');

function syncBpm(): void {
  $<HTMLInputElement>('editorBpm').value = $<HTMLInputElement>('bpmSlider').value;
  $('editorBpmLabel').textContent = $<HTMLInputElement>('bpmSlider').value;
}

function open(): void {
  if (state.isRecording || state.isCountingIn) {
    showToast('録音中です。先に録音を止めてください');
    return;
  }
  syncBpm();
  selected.clear();
  undoStack.length = redoStack.length = 0; // 録音やサンプル読み込みで音が変わっていることがあるので、履歴は開くたびに作り直す
  last = snap();
  const midis = state.phraseNotes.map(n => n.midi);
  lo = Math.min(60, ...midis);
  hi = Math.max(83, ...midis);
  panel().removeAttribute('hidden');
  requestAnimationFrame(draw);
}

const close = (): void => panel().setAttribute('hidden', '');

export function initEditor(): void {
  $('editPhraseBtn').addEventListener('click', open);
  $('closeEditorBtn').addEventListener('click', close);
  $('editorClearBtn').addEventListener('click', () => {
    state.phraseNotes = [];
    selected.clear();
    commit();
  });
  // テンポ: 画面の本体のスライダーと同じものを、打ち込みの画面からも動かせるようにする
  const bpmMain = $<HTMLInputElement>('bpmSlider');
  const bpmHere = $<HTMLInputElement>('editorBpm');
  bpmMain.addEventListener('input', syncBpm);
  bpmHere.addEventListener('input', () => {
    bpmMain.value = bpmHere.value;
    bpmMain.dispatchEvent(new Event('input')); // 本体側の処理（テンポの反映）をそのまま使う
  });
  bpmHere.addEventListener('change', () => bpmHere.blur()); // 触ったあとも↑↓などの鍵を音に使えるように
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') return close();
    if (e.key === 'Delete' || e.key === 'Backspace') {
      // 選択中の音を消す。選んでいなければ、カーソルの下の1音
      if (panel().hidden || drag) return;
      const victims = state.phraseNotes.filter(n => selected.has(n));
      const hit = hover && noteAt(hover);
      if (!victims.length && hit) victims.push(state.phraseNotes[hit.index]);
      if (!victims.length) return;
      e.preventDefault();
      state.phraseNotes = state.phraseNotes.filter(n => !victims.includes(n));
      selected.clear();
      return commit();
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // 選択中の音（なければカーソルの下の音）の高さを、↑↓で半音ずつ、Shift で1オクターブ動かす
      if (panel().hidden || drag || typing()) return;
      const t = targets();
      if (!t.length) return;
      e.preventDefault();
      const step = (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 12 : 1);
      const dp = Math.max(lo - Math.min(...t.map(n => n.midi)), Math.min(step, hi - Math.max(...t.map(n => n.midi)))); // 画面の範囲内に収める
      if (!dp) return;
      t.forEach(n => (n.midi += dp));
      audition(t[0].midi, t[0].vel);
      return commit();
    }
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      // 音の強さ（ベロシティ）を 10% ずつ変える。強い音ほど濃く表示される
      if (panel().hidden || drag || typing()) return;
      const t = targets();
      if (!t.length) return;
      e.preventDefault();
      const d = e.key === 'PageUp' ? 0.1 : -0.1;
      const before = t.map(n => n.vel);
      t.forEach(n => (n.vel = Math.min(1, Math.max(0.1, Math.round((n.vel + d) * 100) / 100))));
      if (t.every((n, i) => n.vel === before[i])) return;
      audition(t[0].midi, t[0].vel);
      commit();
      $('recStatusText').textContent = `音の強さ: ${Math.round(t[0].vel * 100)}%`;
      return;
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.altKey && !e.ctrlKey && !e.metaKey) {
      // Alt+←→: 選択中の音（なければカーソルの下の音）の長さを、16分ずつ短く・長く（Shift で1拍ずつ）。右端のドラッグと同じ
      if (panel().hidden || drag || typing()) return;
      const t = targets();
      if (!t.length) return;
      e.preventDefault(); // ブラウザの「戻る」を止める
      const dd = (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 : STEP);
      const durs = t.map(n => groupDur(n, dd));
      if (t.every((n, i) => durs[i] === n.dur)) return;
      t.forEach((n, i) => (n.dur = durs[i]));
      return commit();
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.shiftKey) {
      // 選んだ音（なければ全部）の間隔と長さを、2倍に広げる（ゆっくり）/ 半分に詰める（速く）。16分に揃える
      if (panel().hidden || drag || typing()) return;
      const sel = state.phraseNotes.filter(n => selected.has(n));
      const t = sel.length ? sel : state.phraseNotes;
      if (!t.length) return;
      e.preventDefault();
      const f = e.key === 'ArrowLeft' ? 0.5 : 2;
      const q = (x: number): number => Math.round(x / STEP) * STEP;
      const t0 = Math.min(...t.map(n => n.start));
      const moved = t.map(n => ({ n, start: t0 + q((n.start - t0) * f), dur: Math.max(STEP, q(n.dur * f)) }));
      if (moved.some(m => m.start + m.dur > 8 + 1e-6)) {
        $('recStatusText').textContent = 'これ以上は広げられません（2小節を超えます）';
        return;
      }
      if (moved.every(m => m.start === m.n.start && m.dur === m.n.dur)) return;
      moved.forEach(m => Object.assign(m.n, { start: m.start, dur: m.dur }));
      return commit();
    }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.ctrlKey && !e.metaKey) {
      // ←→: 選択中の音（なければカーソルの下の音）を、16分ずつ左右（時間方向）へ動かす
      if (panel().hidden || drag || typing()) return;
      const t = targets();
      if (!t.length) return;
      e.preventDefault();
      const dt = Math.max(-span(t).t0, Math.min(e.key === 'ArrowRight' ? STEP : -STEP, 8 - span(t).end));
      if (!dt) return;
      t.forEach(n => (n.start += dt));
      return commit();
    }
    if (panel().hidden || drag || !(e.ctrlKey || e.metaKey)) return;
    const key = e.key.toLowerCase();
    if (key === 'z' || key === 'y') {
      // Ctrl+Z で元に戻す、Ctrl+Shift+Z / Ctrl+Y でやり直す
      e.preventDefault();
      return key === 'y' || e.shiftKey ? restore(redoStack, undoStack) : restore(undoStack, redoStack);
    }
    if (key === 'a') {
      // 全選択
      e.preventDefault();
      selected.clear();
      state.phraseNotes.forEach(n => selected.add(n));
      $('recStatusText').textContent = `${selected.size}音を選択中。ドラッグでまとめて動かせます`;
      return draw();
    }
    if (!hover) return;
    if (key === 'c') {
      // 選択中の音をコピー。選んでいなければ、カーソルの下の1音
      const hit = noteAt(hover);
      const src = state.phraseNotes.filter(n => selected.has(n));
      if (!src.length && hit) src.push(state.phraseNotes[hit.index]);
      if (!src.length) return;
      clip = src.map(n => ({ ...n }));
      e.preventDefault();
      $('recStatusText').textContent = `${clip.length}音をコピーしました。貼り付けたい場所にカーソルを置いて Ctrl+V`;
    } else if (key === 'v' && clip.length) {
      // 一番前の音をカーソル位置（拍と音の高さ）に合わせて貼り付け。はみ出す分は内側へ寄せる
      const p = cellAt(hover);
      if (!p) return;
      e.preventDefault();
      const t0 = Math.min(...clip.map(n => n.start));
      const base = clip.find(n => n.start === t0)!;
      const dt = Math.min(p.col * STEP - t0, 8 - Math.max(...clip.map(n => n.start + n.dur)));
      const dp = Math.max(lo - Math.min(...clip.map(n => n.midi)), Math.min(p.midi - base.midi, hi - Math.max(...clip.map(n => n.midi))));
      const pasted = clip.map(n => ({ ...n, midi: n.midi + dp, start: n.start + dt }));
      state.phraseNotes.push(...pasted);
      selected.clear();
      pasted.forEach(n => selected.add(n)); // 貼った音をそのまま選択（続けて動かしたりコピーしたりできる）
      audition(base.midi + dp);
      commit();
    }
  });
  window.addEventListener('resize', () => !panel().hidden && draw());

  const c = canvas();
  c.addEventListener('pointerdown', e => {
    const p = cellAt(e);
    if (!p) return;
    const hit = noteAt(e);
    if (e.shiftKey) {
      // Shift: 音をクリックで選択を切り替え / 空いた所からドラッグで範囲選択
      if (hit) {
        const n = state.phraseNotes[hit.index];
        if (!selected.delete(n)) selected.add(n);
        return draw();
      }
      drag = { kind: 'select', c0: p.col, m0: p.midi, c1: p.col, m1: p.midi };
      c.setPointerCapture(e.pointerId);
      return draw();
    }
    if (hit && selected.size > 1 && selected.has(state.phraseNotes[hit.index])) {
      // 選択中の音をつかんだ: 選んだ音を全部まとめて、動かす / 右端なら長さを変える / Alt・Ctrl で複製
      const notes = state.phraseNotes.filter(n => selected.has(n));
      drag = hit.onEdge
        ? { kind: 'gresize', notes, col0: p.col, dd: 0 }
        : { kind: 'gmove', notes, col0: p.col, midi0: p.midi, dt: 0, dp: 0, copy: e.altKey || e.ctrlKey };
      c.setPointerCapture(e.pointerId);
      audition(p.midi);
      return draw();
    }
    selected.clear();
    if (hit) {
      // 既存の音: 右端なら長さを変える。それ以外は持ち上げる（動かせば移動、動かさずに離せば消す）
      const copy = !hit.onEdge && (e.altKey || e.ctrlKey); // Alt / Ctrl を押しながら = 複製
      const note = copy ? { ...state.phraseNotes[hit.index] } : state.phraseNotes.splice(hit.index, 1)[0];
      drag = hit.onEdge
        ? { kind: 'resize', note, dur: note.dur }
        : { kind: 'move', note, grab: p.col - Math.round(note.start / STEP), midi: note.midi, start: note.start, moved: false, copy };
    } else {
      drag = { kind: 'new', midi: p.midi, col: p.col, end: p.col };
    }
    c.setPointerCapture(e.pointerId);
    audition(p.midi);
    draw();
  });
  c.addEventListener('pointerleave', () => (hover = null));
  c.addEventListener('pointermove', e => {
    hover = e;
    const p = cellAt(e);
    if (!drag) {
      const hit = noteAt(e);
      c.style.cursor = hit ? (hit.onEdge ? 'ew-resize' : 'grab') : 'crosshair';
      return;
    }
    if (!p) return;
    if (drag.kind === 'new') {
      drag.end = Math.max(drag.col, p.col);
    } else if (drag.kind === 'select') {
      drag.c1 = p.col;
      drag.m1 = p.midi;
    } else if (drag.kind === 'resize') {
      drag.dur = Math.min(8 - drag.note.start, Math.max(STEP, (p.col + 1) * STEP - drag.note.start));
    } else if (drag.kind === 'gmove') {
      const s = span(drag.notes);
      drag.dt = Math.max(-s.t0, Math.min((p.col - drag.col0) * STEP, 8 - s.end)); // 2小節の外へ出さない
      const dp = Math.max(lo - s.min, Math.min(p.midi - drag.midi0, hi - s.max)); // 画面の音域の外へ出さない
      if (dp !== drag.dp) audition(drag.notes[0].midi + dp, drag.notes[0].vel);
      drag.dp = dp;
    } else if (drag.kind === 'gresize') {
      drag.dd = (p.col - drag.col0) * STEP;
    } else {
      const start = Math.min(8 - drag.note.dur, Math.max(0, (p.col - drag.grab) * STEP));
      if (p.midi !== drag.midi) audition(p.midi);
      if (p.midi !== drag.midi || start !== drag.start) drag.moved = true;
      drag.midi = p.midi;
      drag.start = start;
    }
    draw();
  });
  c.addEventListener('pointerup', () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.kind === 'select') {
      // 囲んだ範囲に少しでもかかる音を、選択に加える
      const [c0, c1] = [Math.min(d.c0, d.c1), Math.max(d.c0, d.c1)];
      const [m0, m1] = [Math.min(d.m0, d.m1), Math.max(d.m0, d.m1)];
      for (const n of state.phraseNotes) {
        if (n.midi >= m0 && n.midi <= m1 && n.start < (c1 + 1) * STEP - 1e-6 && n.start + n.dur > c0 * STEP + 1e-6) selected.add(n);
      }
      $('recStatusText').textContent = `${selected.size}音を選択中。Ctrl+C でコピーできます`;
      return draw();
    }
    if (d.kind === 'gmove') {
      if (!d.dt && !d.dp) return draw(); // 動かさずに離したら、何もしない（選択もそのまま）
      if (d.copy) {
        const copies = d.notes.map(n => ({ ...n, start: n.start + d.dt, midi: n.midi + d.dp }));
        state.phraseNotes.push(...copies);
        selected.clear();
        copies.forEach(n => selected.add(n)); // できた複製を選択に切り替える
      } else {
        d.notes.forEach(n => Object.assign(n, { start: n.start + d.dt, midi: n.midi + d.dp }));
      }
      return commit();
    }
    if (d.kind === 'gresize') {
      if (!d.dd) return draw();
      d.notes.forEach(n => (n.dur = groupDur(n, d.dd)));
      return commit();
    }
    if (d.kind === 'new') {
      state.phraseNotes.push({ midi: d.midi, start: d.col * STEP, dur: (d.end - d.col + 1) * STEP, vel: 0.85 });
    } else if (d.kind === 'resize') {
      state.phraseNotes.push({ ...d.note, dur: d.dur });
    } else if (d.moved) {
      state.phraseNotes.push({ ...d.note, midi: d.midi, start: d.start });
    } else if (d.copy) {
      return draw(); // 動かさずに離した複製は、何もしない
    } // 動かさずに離した音は、そのまま消える
    commit();
  });
  c.addEventListener('pointercancel', () => {
    if (drag && (drag.kind === 'resize' || (drag.kind === 'move' && !drag.copy))) state.phraseNotes.push(drag.note); // 元に戻す
    drag = null;
    draw();
  });
}
