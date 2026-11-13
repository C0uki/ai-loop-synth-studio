import { ensureAudioContext } from './audio';
import { stopLoopPlayback } from './player';
import { getSecondsPerBeat, state } from './state';
import { $, drawPhraseRoll, regenerate, showToast } from './ui';

const IDLE_TEXT = '押すと、4拍のカウントのあとに録音が始まります';

const setDots = (activeIdx: number, color: 'amber' | 'red' | null): void => {
  document.querySelectorAll<HTMLElement>('#beatDots span').forEach((d, idx) => {
    d.className = idx === activeIdx && color ? `beat-dot ${color}` : 'beat-dot';
  });
};

/** 4拍のカウントイン → 2小節（8拍）を録音。録音中にもう一度押すと中断。 */
export function startPhraseRecording(): void {
  if (state.isRecording || state.isCountingIn) {
    stopPhraseRecording();
    return;
  }
  if (state.isPlayingLoop) stopLoopPlayback(false);

  ensureAudioContext();
  const ctx = state.audioCtx!;
  state.isCountingIn = true;
  state.phraseNotes = [];
  state.pendingRecNotes.clear();
  drawPhraseRoll();

  $('recordPhraseBtn').classList.add('recording');
  $('recBtnLabel').textContent = '録音を止める';
  const statusText = $('recStatusText');

  const secPerBeat = getSecondsPerBeat();
  let step = 0; // 0..3 = カウントイン, 4..11 = 録音8拍

  const tickMetronome = (): void => {
    if (!state.isCountingIn && !state.isRecording) return;

    // クリック音
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = step % 4 === 0 ? 1050 : 750;
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(g);
    g.connect(state.masterGain!);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);

    setDots(step % 4, step < 4 ? 'amber' : 'red');

    if (step < 4) {
      statusText.textContent = `${4 - step}… 準備してください`;
    } else if (step === 4) {
      state.isCountingIn = false;
      state.isRecording = true;
      state.recStartTime = ctx.currentTime;
      statusText.textContent = '録音中: 2小節（8拍）のメロディを弾いてください';
    } else if (step >= 12) {
      stopPhraseRecording();
      return;
    }

    step++;
    state.recTimer = setTimeout(tickMetronome, secPerBeat * 1000);
  };

  tickMetronome();
}

export function stopPhraseRecording(): void {
  const wasRecording = state.isRecording;
  state.isCountingIn = false;
  state.isRecording = false;
  if (state.recTimer) clearTimeout(state.recTimer);

  // 押しっぱなしの音を確定
  const nowBeat = Math.min(8, state.audioCtx ? (state.audioCtx.currentTime - state.recStartTime) / getSecondsPerBeat() : 8);
  state.pendingRecNotes.forEach((info, midi) => {
    state.phraseNotes.push({ midi, start: info.startBeat, dur: Math.max(0.25, nowBeat - info.startBeat), vel: info.vel });
  });
  state.pendingRecNotes.clear();

  // 16分音符にそろえる
  if (state.phraseNotes.length > 0) {
    state.phraseNotes = state.phraseNotes.map(n => ({
      ...n,
      start: Math.min(7.75, Math.max(0, Math.round(n.start * 4) / 4)),
      dur: Math.max(0.25, Math.round(n.dur * 4) / 4)
    }));
  }

  $('recordPhraseBtn').classList.remove('recording');
  $('recBtnLabel').textContent = '自分で録音（2小節）';
  setDots(-1, null);

  if (wasRecording && state.phraseNotes.length > 0) {
    $('recStatusText').textContent = `録音できました（${state.phraseNotes.length}音）。曲を作り直しました`;
    regenerate();
    showToast('録音したフレーズで曲を作りました。▶ 再生で聴けます');
  } else {
    $('recStatusText').textContent = IDLE_TEXT;
  }

  drawPhraseRoll();
}
