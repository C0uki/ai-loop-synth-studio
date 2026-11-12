import { generateArrangement, getSectionForBar } from './arranger';
import { ensureAudioContext, midiToNoteName, triggerSynthNote } from './audio';
import { INSTRUMENTS, PRESET_MOTIFS } from './data';
import { formatTimeMMSS, getSecondsPerBeat, getTotalLoopSeconds, state } from './state';
import type { StyleId } from './types';

/** id から要素を取る。無ければ即例外（HTML と ID がずれたことに気づくため）。 */
export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} が見つかりません`);
  return el as T;
}

const cssVar = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// -----------------------------------------------------------------------------
// トースト
// -----------------------------------------------------------------------------
let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function showToast(msg: string): void {
  const banner = $('toastBanner');
  $('toastText').textContent = msg;
  banner.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => banner.classList.remove('show'), 3200);
}

// -----------------------------------------------------------------------------
// 自動アレンジの実行と画面反映
// -----------------------------------------------------------------------------
export function regenerate(): void {
  if (state.phraseNotes.length === 0) loadPresetMotif('pop_dream', true);

  const { arrangement, scale, chordNames, trackInsts } = generateArrangement(
    state.phraseNotes,
    state.style,
    state.bpm,
    state.selectedInstrument
  );
  state.arrangement = arrangement;
  state.detectedScale = scale;
  for (const track of state.tracks) {
    if (track.id !== 'drums') track.inst = trackInsts[track.id];
  }

  $('detectedKeyLabel').textContent = scale.name;
  $('detectedChordsLabel').textContent = chordNames.join(' - ');
  renderMixerTracks();
  updateLoopDurationBadge();
}

export function updateLoopDurationBadge(): void {
  const totalSec = Math.round(getTotalLoopSeconds());
  $('loopDurationBadge').textContent = `${state.totalBars}小節 / ${formatTimeMMSS(totalSec)} (${totalSec}秒)`;
  if (!state.isPlayingLoop) {
    $('timeDisplay').textContent = `00:00 / ${formatTimeMMSS(totalSec)}`;
  }
}

export function setStyleSegment(style: StyleId): void {
  document.querySelectorAll<HTMLButtonElement>('#styleSegment [data-style]').forEach(b => {
    b.setAttribute('aria-pressed', String(b.dataset.style === style));
  });
}

export function loadPresetMotif(motifId: string, silent = false): void {
  const motif = PRESET_MOTIFS.find(m => m.id === motifId);
  if (!motif) return;

  state.phraseNotes = motif.notes.map(n => ({ ...n }));
  state.style = motif.style;
  state.bpm = motif.bpm;

  setStyleSegment(motif.style);
  $<HTMLInputElement>('bpmSlider').value = String(motif.bpm);
  $('bpmValueLabel').textContent = String(motif.bpm);

  selectInstrument(motif.inst, true);
  drawPhraseRoll();
  regenerate();

  if (!silent) {
    $('recStatusText').textContent = `サンプル「${motif.name}」を読み込み、約1分のアレンジを生成しました`;
    showToast(`「${motif.name}」から約1分のループ曲を生成しました`);
  }
}

// -----------------------------------------------------------------------------
// 音色グリッド・プリセット
// -----------------------------------------------------------------------------
export function renderInstrumentGrid(): void {
  const grid = $('instrumentGrid');
  grid.innerHTML = '';
  INSTRUMENTS.forEach((inst, idx) => {
    const selected = inst.id === state.selectedInstrument;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'inst-card';
    btn.setAttribute('aria-pressed', String(selected));
    btn.innerHTML = `
      <span class="inst-icon" aria-hidden="true">${inst.icon}</span>
      <span class="inst-text">
        <span class="inst-name">${inst.name}</span>
        <span class="inst-en">${inst.en}</span>
      </span>
      <span class="inst-num num">${idx + 1}</span>
    `;
    btn.addEventListener('click', () => selectInstrument(inst.id));
    grid.appendChild(btn);
  });
}

export function selectInstrument(instId: string, silent = false): void {
  const inst = INSTRUMENTS.find(i => i.id === instId);
  if (!inst) return;
  state.selectedInstrument = instId;
  $('currentInstDesc').textContent = `選択中: ${inst.name} — ${inst.desc}`;

  const leadTrack = state.tracks.find(t => t.id === 'lead');
  if (leadTrack) {
    leadTrack.inst = instId;
    renderMixerTracks();
  }

  renderInstrumentGrid();
  if (!silent) showToast(`音色を「${inst.name}」に切り替えました`);
}

export function renderPresetMotifs(): void {
  const grid = $('presetMotifGrid');
  grid.innerHTML = '';
  PRESET_MOTIFS.forEach(m => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset-btn';
    btn.innerHTML = `<span>${m.name}</span><span class="num muted">${m.bpm} BPM</span>`;
    btn.addEventListener('click', () => loadPresetMotif(m.id));
    grid.appendChild(btn);
  });
}

// -----------------------------------------------------------------------------
// 鍵盤
// -----------------------------------------------------------------------------
/** PCキーボードの割り当て（半音オフセット）。 */
export const PC_KEY_MAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4,
  f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ';': 16
};

export function renderPianoKeyboard(): void {
  const whiteLayer = $('whiteKeysLayer');
  const blackLayer = $('blackKeysLayer');
  whiteLayer.innerHTML = '';
  blackLayer.innerHTML = '';

  const startMidi = (state.baseOctave + 1) * 12; // C3 = 48
  const totalSemitones = 24; // 2オクターブ（白14・黒10）
  const isBlack = (semi: number): boolean => [1, 3, 6, 8, 10].includes(semi % 12);

  const semiToKeyHint: Record<number, string> = {};
  Object.entries(PC_KEY_MAP).forEach(([k, semi]) => {
    semiToKeyHint[semi] = k.toUpperCase();
  });

  const whiteSemis: number[] = [];
  for (let s = 0; s < totalSemitones; s++) if (!isBlack(s)) whiteSemis.push(s);

  whiteSemis.forEach(s => {
    const midi = startMidi + s;
    const keyEl = document.createElement('div');
    keyEl.className = 'white-key';
    keyEl.dataset.midi = String(midi);
    keyEl.innerHTML = `
      ${state.showKeyHints && semiToKeyHint[s] ? `<span class="key-hint">${semiToKeyHint[s]}</span>` : ''}
      <span class="key-name num">${midiToNoteName(midi)}</span>
    `;
    bindKeyPointerEvents(keyEl, midi);
    whiteLayer.appendChild(keyEl);
  });

  const whiteWidthPct = 100 / whiteSemis.length;
  const blackWidthPct = whiteWidthPct * 0.62;
  let whiteIndex = 0;
  for (let s = 0; s < totalSemitones; s++) {
    if (!isBlack(s)) {
      whiteIndex++;
      continue;
    }
    const midi = startMidi + s;
    const keyEl = document.createElement('div');
    keyEl.className = 'black-key';
    keyEl.dataset.midi = String(midi);
    keyEl.style.left = `${whiteIndex * whiteWidthPct - blackWidthPct / 2}%`;
    keyEl.style.width = `${blackWidthPct}%`;
    keyEl.innerHTML = `
      ${state.showKeyHints && semiToKeyHint[s] ? `<span class="key-hint">${semiToKeyHint[s]}</span>` : ''}
      <span class="key-name num">${midiToNoteName(midi).replace(/\d/, '')}</span>
    `;
    bindKeyPointerEvents(keyEl, midi);
    blackLayer.appendChild(keyEl);
  }

  $('octaveDisplay').textContent = `${midiToNoteName(startMidi)} – ${midiToNoteName(startMidi + totalSemitones - 1)}`;
}

function bindKeyPointerEvents(el: HTMLElement, midi: number): void {
  const onDown = (e: Event): void => {
    e.preventDefault();
    playLiveNote(midi);
  };
  const onUp = (e: Event): void => {
    e.preventDefault();
    releaseLiveNote(midi);
  };
  el.addEventListener('mousedown', onDown);
  el.addEventListener('mouseup', onUp);
  el.addEventListener('mouseleave', () => {
    if (state.activeNotes.has(midi)) releaseLiveNote(midi);
  });
  el.addEventListener('touchstart', onDown, { passive: false });
  el.addEventListener('touchend', onUp, { passive: false });
  el.addEventListener('touchcancel', onUp, { passive: false });
}

const keyElOf = (midi: number): Element | null => document.querySelector(`[data-midi="${midi}"]`);

export function playLiveNote(midi: number, velocity = 0.88): void {
  ensureAudioContext();
  const ctx = state.audioCtx!;
  if (state.activeNotes.has(midi)) releaseLiveNote(midi, true);

  const handle = triggerSynthNote(ctx, state.compressorNode!, state.selectedInstrument, midi, ctx.currentTime, null, velocity);
  state.activeNotes.set(midi, handle);
  $('activeNoteDisplay').textContent = midiToNoteName(midi);
  keyElOf(midi)?.classList.add('active');

  // 録音中なら開始位置（拍）を記録
  if (state.isRecording) {
    const beatPos = Math.max(0, (ctx.currentTime - state.recStartTime) / getSecondsPerBeat());
    if (beatPos < 8) state.pendingRecNotes.set(midi, { startBeat: beatPos, vel: velocity });
  }
}

export function releaseLiveNote(midi: number, forceImmediate = false): void {
  const handle = state.activeNotes.get(midi);
  if (handle) {
    if (!state.sustain || forceImmediate) handle.stop();
    else setTimeout(() => handle.stop(), 1100); // サステイン: 1.1秒だけ余韻を残す
    state.activeNotes.delete(midi);
  }

  keyElOf(midi)?.classList.remove('active');
  if (state.activeNotes.size === 0) $('activeNoteDisplay').textContent = '---';

  // 録音中なら長さを確定してフレーズに追加
  const info = state.pendingRecNotes.get(midi);
  if (state.isRecording && info) {
    const nowBeat = Math.min(8, (state.audioCtx!.currentTime - state.recStartTime) / getSecondsPerBeat());
    state.phraseNotes.push({ midi, start: info.startBeat, dur: Math.max(0.25, nowBeat - info.startBeat), vel: info.vel });
    state.pendingRecNotes.delete(midi);
    drawPhraseRoll();
  }
}

// -----------------------------------------------------------------------------
// タイムライン・トランスポート表示
// -----------------------------------------------------------------------------
export function renderTimelineBars(onSeek: (bar: number) => void): void {
  const grid = $('timelineBarsGrid');
  grid.innerHTML = '';
  for (let b = 0; b < state.totalBars; b++) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'bar-cell';
    cell.title = `Bar ${b + 1} (${getSectionForBar(b)}) — クリックでここから再生`;
    cell.setAttribute('aria-label', `Bar ${b + 1} ${getSectionForBar(b)} から再生`);
    cell.addEventListener('click', () => onSeek(b));
    grid.appendChild(cell);
  }
}

export function highlightTimelineBar(activeBar: number): void {
  document.querySelectorAll<HTMLElement>('#timelineBarsGrid > .bar-cell').forEach((cell, idx) => {
    cell.classList.toggle('current', idx === activeBar);
    cell.classList.toggle('played', idx < activeBar);
  });
}

export function setPlayButton(playing: boolean): void {
  $('playLoopIcon').textContent = playing ? '❚❚' : '▶';
  $('playLoopText').textContent = playing ? '再生中' : 'ループ再生';
}

// -----------------------------------------------------------------------------
// ミキサー
// -----------------------------------------------------------------------------
export function renderMixerTracks(): void {
  const container = $('mixerTracksContainer');
  container.innerHTML = '';

  state.tracks.forEach(track => {
    const instOptions =
      track.id === 'drums'
        ? '<option value="drums">🥁 ドラム＆パーカッション</option>'
        : INSTRUMENTS.map(i => `<option value="${i.id}" ${i.id === track.inst ? 'selected' : ''}>${i.icon} ${i.name}</option>`).join('');

    const row = document.createElement('div');
    row.className = 'mixer-row';
    row.innerHTML = `
      <div class="mixer-name"><span class="dot" style="background:${track.color}"></span>${track.name}</div>
      <select class="select" data-track-inst="${track.id}" aria-label="${track.name}の音色" ${track.id === 'drums' ? 'disabled' : ''}>${instOptions}</select>
      <div class="mixer-vol">
        <input type="range" data-track-vol="${track.id}" min="0" max="1" step="0.02" value="${track.vol}" aria-label="${track.name}の音量">
        <span class="num muted">${Math.round(track.vol * 100)}%</span>
      </div>
      <div class="mixer-ms">
        <button type="button" class="ms-btn mute" data-track-mute="${track.id}" aria-pressed="${track.mute}" aria-label="${track.name}をミュート">M</button>
        <button type="button" class="ms-btn solo" data-track-solo="${track.id}" aria-pressed="${track.solo}" aria-label="${track.name}をソロ">S</button>
      </div>
    `;
    container.appendChild(row);
  });

  const trackOf = (id: string | undefined) => state.tracks.find(t => t.id === id);

  container.querySelectorAll<HTMLSelectElement>('[data-track-inst]').forEach(sel => {
    sel.addEventListener('change', () => {
      const tr = trackOf(sel.dataset.trackInst);
      if (!tr) return;
      tr.inst = sel.value;
      if (tr.id === 'lead') selectInstrument(tr.inst, true);
    });
  });
  container.querySelectorAll<HTMLInputElement>('[data-track-vol]').forEach(slider => {
    slider.addEventListener('input', () => {
      const tr = trackOf(slider.dataset.trackVol);
      if (!tr) return;
      tr.vol = parseFloat(slider.value);
      slider.nextElementSibling!.textContent = `${Math.round(tr.vol * 100)}%`;
    });
  });
  container.querySelectorAll<HTMLButtonElement>('[data-track-mute]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tr = trackOf(btn.dataset.trackMute);
      if (tr) {
        tr.mute = !tr.mute;
        renderMixerTracks();
      }
    });
  });
  container.querySelectorAll<HTMLButtonElement>('[data-track-solo]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tr = trackOf(btn.dataset.trackSolo);
      if (tr) {
        tr.solo = !tr.solo;
        renderMixerTracks();
      }
    });
  });
}

// -----------------------------------------------------------------------------
// ビジュアライザ（フレーズのピアノロール・スペクトラム）
// -----------------------------------------------------------------------------
export function drawPhraseRoll(): void {
  const canvas = $<HTMLCanvasElement>('phraseCanvas');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  // 8拍のグリッド（4拍目 = 小節の区切りを強調）
  for (let b = 0; b <= 8; b++) {
    const x = (b / 8) * w;
    ctx.strokeStyle = cssVar(b === 4 ? '--blue' : '--separator');
    ctx.globalAlpha = b === 4 ? 0.5 : 1;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  $('phraseNoteCount').textContent = String(state.phraseNotes.length);

  if (state.phraseNotes.length === 0) {
    ctx.fillStyle = cssVar('--label-tertiary');
    ctx.font = '12px -apple-system, "Hiragino Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('フレーズ未録音 — 録音するか、下のサンプルを選んでください', w / 2, h / 2 + 4);
    return;
  }

  const midis = state.phraseNotes.map(n => n.midi);
  const minMidi = Math.min(...midis) - 3;
  const maxMidi = Math.max(...midis) + 3;
  const span = Math.max(12, maxMidi - minMidi);

  state.phraseNotes.forEach(n => {
    const x = (n.start / 8) * w;
    const noteW = Math.max(6, (n.dur / 8) * w - 2);
    const y = h - 12 - ((n.midi - minMidi) / span) * (h - 22);
    const grad = ctx.createLinearGradient(x, y, x + noteW, y);
    grad.addColorStop(0, cssVar('--blue'));
    grad.addColorStop(1, cssVar('--purple'));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x + 1, y, noteW, 8, 4);
    ctx.fill();
  });
}

export function startVisualizerLoop(): void {
  const canvas = $<HTMLCanvasElement>('visualizerCanvas');
  const ctx = canvas.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  const fit = (): void => {
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  };
  fit();
  window.addEventListener('resize', fit);

  const bars = 24;
  const render = (): void => {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const slot = w / bars;
    const barW = Math.max(1, slot - 2 * dpr);

    if (state.analyser) {
      const data = new Uint8Array(state.analyser.frequencyBinCount);
      state.analyser.getByteFrequencyData(data);
      for (let i = 0; i < bars; i++) {
        const barH = Math.max(3 * dpr, (data[i] / 255) * (h - 4 * dpr));
        ctx.fillStyle = cssVar('--blue');
        ctx.beginPath();
        ctx.roundRect(i * slot + dpr, h - barH, barW, barH, barW / 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = cssVar('--fill');
      for (let i = 0; i < bars; i++) ctx.fillRect(i * slot + dpr, h - 3 * dpr, barW, 2 * dpr);
    }
    requestAnimationFrame(render);
  };
  render();
}
