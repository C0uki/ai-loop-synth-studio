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
 * move と resize の元の音は、操作中だけ phraseNotes から外してある。
 */
type Drag =
  | { kind: 'new'; midi: number; col: number; end: number }
  | { kind: 'move'; note: Note; grab: number; midi: number; start: number; moved: boolean }
  | { kind: 'resize'; note: Note; dur: number };
let drag: Drag | null = null;

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
  state.phraseNotes.forEach(n => box(n.midi, n.start, n.dur, 1));
  if (drag?.kind === 'new') box(drag.midi, drag.col * STEP, (drag.end - drag.col + 1) * STEP, 0.6);
  if (drag?.kind === 'move') box(drag.midi, drag.start, drag.note.dur, 0.85);
  if (drag?.kind === 'resize') box(drag.note.midi, drag.note.start, drag.dur, 0.85);
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

/** 編集のたびに曲を作り直す（再生中ならそのまま変わる）。 */
function commit(): void {
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

function audition(midi: number): void {
  playLiveNote(midi, 0.8);
  setTimeout(() => releaseLiveNote(midi, true), 250);
}

function open(): void {
  if (state.isRecording || state.isCountingIn) {
    showToast('録音中です。先に録音を止めてください');
    return;
  }
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
    commit();
  });
  window.addEventListener('keydown', e => e.key === 'Escape' && close());
  window.addEventListener('resize', () => !panel().hidden && draw());

  const c = canvas();
  c.addEventListener('pointerdown', e => {
    const p = cellAt(e);
    if (!p) return;
    const hit = noteAt(e);
    if (hit) {
      // 既存の音: 右端なら長さを変える。それ以外は持ち上げる（動かせば移動、動かさずに離せば消す）
      const [note] = state.phraseNotes.splice(hit.index, 1);
      drag = hit.onEdge
        ? { kind: 'resize', note, dur: note.dur }
        : { kind: 'move', note, grab: p.col - Math.round(note.start / STEP), midi: note.midi, start: note.start, moved: false };
    } else {
      drag = { kind: 'new', midi: p.midi, col: p.col, end: p.col };
    }
    c.setPointerCapture(e.pointerId);
    audition(p.midi);
    draw();
  });
  c.addEventListener('pointermove', e => {
    const p = cellAt(e);
    if (!drag) {
      const hit = noteAt(e);
      c.style.cursor = hit ? (hit.onEdge ? 'ew-resize' : 'grab') : 'crosshair';
      return;
    }
    if (!p) return;
    if (drag.kind === 'new') {
      drag.end = Math.max(drag.col, p.col);
    } else if (drag.kind === 'resize') {
      drag.dur = Math.min(8 - drag.note.start, Math.max(STEP, (p.col + 1) * STEP - drag.note.start));
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
    if (d.kind === 'new') {
      state.phraseNotes.push({ midi: d.midi, start: d.col * STEP, dur: (d.end - d.col + 1) * STEP, vel: 0.85 });
    } else if (d.kind === 'resize') {
      state.phraseNotes.push({ ...d.note, dur: d.dur });
    } else if (d.moved) {
      state.phraseNotes.push({ ...d.note, midi: d.midi, start: d.start });
    } // 動かさずに離した音は、そのまま消える
    commit();
  });
  c.addEventListener('pointercancel', () => {
    if (drag && drag.kind !== 'new') state.phraseNotes.push(drag.note); // 元に戻す
    drag = null;
    draw();
  });
}
