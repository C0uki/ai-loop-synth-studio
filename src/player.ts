import { getSectionForBar } from './arranger';
import { ensureAudioContext, triggerDrumHit, triggerSynthNote } from './audio';
import { formatTimeMMSS, getSecondsPerBar, getSecondsPerBeat, getTotalLoopSeconds, state } from './state';
import type { NoteEvent, TrackId } from './types';
import { $, highlightTimelineBar, regenerate, setPlayButton, showToast } from './ui';

/** 1小節ぶんのイベントを、ミュート/ソロ/音量を反映して ctx に予約する（再生と WAV 書き出しで共通）。 */
function scheduleBarEvents(ctx: BaseAudioContext, destNode: AudioNode, barIndex: number, barStartTime: number, secPerBeat: number): void {
  if (!state.arrangement) return;
  const barData = state.arrangement.bars[barIndex % state.totalBars];
  const anySolo = state.tracks.some(t => t.solo);

  const audible = (id: TrackId): boolean => {
    const tr = state.tracks.find(t => t.id === id);
    if (!tr || tr.mute) return false;
    if (anySolo && !tr.solo) return false;
    return tr.vol > 0.01;
  };

  const playNotes = (id: Exclude<TrackId, 'drums'>, events: NoteEvent[]): void => {
    if (!audible(id)) return;
    const tr = state.tracks.find(t => t.id === id)!;
    events.forEach(ev => {
      triggerSynthNote(ctx, destNode, tr.inst, ev.midi, barStartTime + ev.beat * secPerBeat, ev.dur * secPerBeat, ev.vel * tr.vol);
    });
  };

  playNotes('lead', barData.lead);
  playNotes('chords', barData.chords);
  playNotes('bass', barData.bass);
  playNotes('arp', barData.arp);

  if (audible('drums')) {
    const vol = state.tracks.find(t => t.id === 'drums')!.vol;
    barData.drums.forEach(ev => triggerDrumHit(ctx, destNode, ev.type, barStartTime + ev.beat * secPerBeat, ev.vel * vol));
  }
}

export function startLoopPlayback(startFromBar = 0): void {
  ensureAudioContext();
  if (!state.arrangement) regenerate();
  stopLoopPlayback(false);

  const ctx = state.audioCtx!;
  state.isPlayingLoop = true;
  const secPerBar = getSecondsPerBar();
  const secPerBeat = getSecondsPerBeat();

  state.loopStartTime = ctx.currentTime - startFromBar * secPerBar;
  state.nextScheduleBar = startFromBar;
  setPlayButton(true);

  const lookAheadSec = 0.25;

  const schedulerTick = (): void => {
    if (!state.isPlayingLoop) return;
    const now = ctx.currentTime;
    const elapsedTotal = now - state.loopStartTime;
    const totalLoopSec = getTotalLoopSeconds();

    // シームレスループ OFF なら1周で止める
    if (!state.seamlessLoop && elapsedTotal >= totalLoopSec) {
      stopLoopPlayback(true);
      return;
    }

    // ループ境界をまたいで先読み予約
    while (state.loopStartTime + state.nextScheduleBar * secPerBar < now + lookAheadSec) {
      if (!state.seamlessLoop && state.nextScheduleBar >= state.totalBars) break;
      const barStartTime = state.loopStartTime + state.nextScheduleBar * secPerBar;
      scheduleBarEvents(ctx, state.compressorNode!, state.nextScheduleBar, barStartTime, secPerBeat);
      state.nextScheduleBar++;
    }

    const currentLoopSec = elapsedTotal % totalLoopSec;
    const activeBar = Math.floor(currentLoopSec / secPerBar) % state.totalBars;
    state.currentBar = activeBar;

    $('timeDisplay').textContent = `${formatTimeMMSS(currentLoopSec)} / ${formatTimeMMSS(totalLoopSec)}`;
    $('barSectionDisplay').textContent = `Bar ${activeBar + 1} / ${state.totalBars} — ${getSectionForBar(activeBar)}`;
    highlightTimelineBar(activeBar);
  };

  schedulerTick();
  state.schedulerTimer = setInterval(schedulerTick, 45);
}

export function stopLoopPlayback(resetPosition = true): void {
  state.isPlayingLoop = false;
  if (state.schedulerTimer) {
    clearInterval(state.schedulerTimer);
    state.schedulerTimer = null;
  }
  setPlayButton(false);

  if (resetPosition) {
    state.currentBar = 0;
    $('timeDisplay').textContent = `00:00 / ${formatTimeMMSS(getTotalLoopSeconds())}`;
    $('barSectionDisplay').textContent = `Bar 1 / ${state.totalBars} — Intro`;
    highlightTimelineBar(-1);
  }
}

// -----------------------------------------------------------------------------
// WAV 書き出し（OfflineAudioContext で全32小節をレンダリング）
// -----------------------------------------------------------------------------
export async function exportLoopToWav(): Promise<void> {
  if (!state.arrangement) regenerate();
  const btn = $<HTMLButtonElement>('exportWavBtn');
  const label = $('exportWavLabel');
  btn.disabled = true;
  label.textContent = '書き出し中...';

  try {
    const sampleRate = 44100;
    const totalSec = getTotalLoopSeconds();
    const offlineCtx = new OfflineAudioContext(2, Math.ceil(totalSec * sampleRate), sampleRate);

    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 4;
    const master = offlineCtx.createGain();
    master.gain.value = state.masterVol;
    compressor.connect(master);
    master.connect(offlineCtx.destination);

    const secPerBar = getSecondsPerBar();
    const secPerBeat = getSecondsPerBeat();
    for (let b = 0; b < state.totalBars; b++) {
      scheduleBarEvents(offlineCtx, compressor, b, b * secPerBar, secPerBeat);
    }

    const url = URL.createObjectURL(audioBufferToWavBlob(await offlineCtx.startRendering()));
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI_Loop_${state.style}_${state.bpm}bpm_${Math.round(totalSec)}s.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    showToast(`約${Math.round(totalSec)}秒のループ音源をWAV保存しました`);
  } catch (err) {
    console.error(err);
    showToast('WAV書き出し中にエラーが発生しました');
  } finally {
    btn.disabled = false;
    label.textContent = 'WAV保存';
  }
}

export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const blockAlign = numChannels * (bitDepth / 8);
  const dataLength = buffer.length * blockAlign;
  const view = new DataView(new ArrayBuffer(44 + dataLength));

  const writeStr = (offset: number, str: string): void => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, 'data');
  view.setUint32(40, dataLength, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([view.buffer], { type: 'audio/wav' });
}
