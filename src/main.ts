import './style.css';
import { PC_KEY_MAP, $, drawPhraseRoll, loadPresetMotif, playLiveNote, regenerate, releaseLiveNote, renderInstrumentSelect, renderMixerTracks, renderPianoKeyboard, renderPresetMotifs, renderTimelineBars, setStyleSegment, updateTimeDisplay } from './ui';
import { exportLoopToWav, startLoopPlayback, stopLoopPlayback } from './player';
import { startPhraseRecording } from './recorder';
import { state } from './state';
import type { StyleId } from './types';

// ---- PCキーボード演奏 ----
const pressedKeys = new Set<string>();
const shiftOctave = (delta: number): void => {
  state.baseOctave = Math.min(5, Math.max(1, state.baseOctave + delta));
  renderPianoKeyboard();
};

/** 文字を打つ欄やプルダウンを操作中は、鍵盤として扱わない（スライダーは除く）。 */
const isTyping = (): boolean => {
  const el = document.activeElement;
  if (!el) return false;
  if (el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && !['range', 'checkbox'].includes((el as HTMLInputElement).type);
};

window.addEventListener('keydown', e => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTyping()) return;
  const key = e.key.toLowerCase();

  if (key === 'z') return shiftOctave(-1);
  if (key === 'x') return shiftOctave(1);

  if (key in PC_KEY_MAP && !pressedKeys.has(key)) {
    pressedKeys.add(key);
    playLiveNote((state.baseOctave + 1) * 12 + PC_KEY_MAP[key]);
  }
});

window.addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  if (key in PC_KEY_MAP) {
    pressedKeys.delete(key);
    releaseLiveNote((state.baseOctave + 1) * 12 + PC_KEY_MAP[key]);
  }
});

// ---- 初期化 ----
renderInstrumentSelect();
renderPianoKeyboard();
renderPresetMotifs(id => {
  loadPresetMotif(id);
  startLoopPlayback(0); // 選んだらすぐ聴ける
});
renderTimelineBars(bar => startLoopPlayback(bar));
renderMixerTracks();
loadPresetMotif('pop_dream', true); // 最初から再生できるよう、初期フレーズを読み込む

// 音量
$<HTMLInputElement>('masterVolume').addEventListener('input', e => {
  state.masterVol = parseFloat((e.target as HTMLInputElement).value);
  if (state.masterGain) state.masterGain.gain.value = state.masterVol;
});

// 使い方・ミキサーのパネル
const guide = $('guidePanel');
const mixer = $('mixerPanel');
$('toggleGuideBtn').addEventListener('click', () => guide.toggleAttribute('hidden'));
$('closeGuideBtn').addEventListener('click', () => guide.setAttribute('hidden', ''));
$('toggleMixerBtn').addEventListener('click', () => mixer.toggleAttribute('hidden'));
$('closeMixerBtn').addEventListener('click', () => mixer.setAttribute('hidden', ''));
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    guide.setAttribute('hidden', '');
    mixer.setAttribute('hidden', '');
  }
});

// 鍵盤
$('octDownBtn').addEventListener('click', () => shiftOctave(-1));
$('octUpBtn').addEventListener('click', () => shiftOctave(1));
const sustainBtn = $('sustainBtn');
sustainBtn.addEventListener('click', () => {
  state.sustain = !state.sustain;
  sustainBtn.setAttribute('aria-pressed', String(state.sustain));
});

// 録音
$('recordPhraseBtn').addEventListener('click', startPhraseRecording);

// ジャンル・テンポ
document.querySelectorAll<HTMLButtonElement>('#styleSegment [data-style]').forEach(btn => {
  btn.addEventListener('click', () => {
    state.style = btn.dataset.style as StyleId;
    setStyleSegment(state.style);
    regenerate();
    if (!state.isPlayingLoop) startLoopPlayback(0);
  });
});

const bpmSlider = $<HTMLInputElement>('bpmSlider');
bpmSlider.addEventListener('input', () => {
  state.bpm = parseInt(bpmSlider.value, 10);
  $('bpmValueLabel').textContent = String(state.bpm);
  updateTimeDisplay();
});

// 再生・停止・WAV
$('playLoopBtn').addEventListener('click', () => {
  if (state.isPlayingLoop) stopLoopPlayback(true);
  else startLoopPlayback(state.currentBar);
});
$('exportWavBtn').addEventListener('click', exportLoopToWav);

// canvas の再描画（サイズ変更・ライト/ダーク切替）
window.addEventListener('resize', drawPhraseRoll);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawPhraseRoll);
