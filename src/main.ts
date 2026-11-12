import './style.css';
import { PC_KEY_MAP, $, drawPhraseRoll, loadPresetMotif, playLiveNote, regenerate, releaseLiveNote, renderInstrumentGrid, renderMixerTracks, renderPianoKeyboard, renderPresetMotifs, renderTimelineBars, setStyleSegment, showToast, startVisualizerLoop, updateLoopDurationBadge } from './ui';
import { exportLoopToWav, startLoopPlayback, stopLoopPlayback } from './player';
import { clearPhrase, previewSeedPhrase, startPhraseRecording } from './recorder';
import { getTotalLoopSeconds, state } from './state';
import type { StyleId } from './types';

// ---- PCキーボード演奏 ----
const pressedKeys = new Set<string>();
const shiftOctave = (delta: number): void => {
  state.baseOctave = Math.min(5, Math.max(1, state.baseOctave + delta));
  renderPianoKeyboard();
};

window.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName ?? '';
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || ['INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return;
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
renderInstrumentGrid();
renderPianoKeyboard();
renderPresetMotifs();
renderTimelineBars(bar => startLoopPlayback(bar));
renderMixerTracks();
startVisualizerLoop();
loadPresetMotif('pop_dream', true); // すぐ再生・生成できるよう初期フレーズを読み込む

// マスター音量
$<HTMLInputElement>('masterVolume').addEventListener('input', e => {
  state.masterVol = parseFloat((e.target as HTMLInputElement).value);
  if (state.masterGain) state.masterGain.gain.value = state.masterVol;
});

// 使い方パネル
const guide = $('guidePanel');
$('toggleGuideBtn').addEventListener('click', () => guide.toggleAttribute('hidden'));
$('closeGuideBtn').addEventListener('click', () => guide.setAttribute('hidden', ''));

// 鍵盤コントロール
$('octDownBtn').addEventListener('click', () => shiftOctave(-1));
$('octUpBtn').addEventListener('click', () => shiftOctave(1));

const sustainBtn = $('sustainBtn');
sustainBtn.addEventListener('click', () => {
  state.sustain = !state.sustain;
  sustainBtn.setAttribute('aria-pressed', String(state.sustain));
  showToast(`サステイン（余韻）: ${state.sustain ? 'ON' : 'OFF'}`);
});

const hintBtn = $('keyHintToggleBtn');
hintBtn.addEventListener('click', () => {
  state.showKeyHints = !state.showKeyHints;
  hintBtn.setAttribute('aria-pressed', String(state.showKeyHints));
  renderPianoKeyboard();
});

// フレーズ録音
$('recordPhraseBtn').addEventListener('click', startPhraseRecording);
$('previewPhraseBtn').addEventListener('click', previewSeedPhrase);
$('clearPhraseBtn').addEventListener('click', clearPhrase);

// スタイル・BPM
document.querySelectorAll<HTMLButtonElement>('#styleSegment [data-style]').forEach(btn => {
  btn.addEventListener('click', () => {
    state.style = btn.dataset.style as StyleId;
    setStyleSegment(state.style);
    regenerate();
    showToast('アレンジスタイルを変更し、再編曲しました');
  });
});

$<HTMLInputElement>('bpmSlider').addEventListener('input', e => {
  state.bpm = parseInt((e.target as HTMLInputElement).value, 10);
  $('bpmValueLabel').textContent = String(state.bpm);
  updateLoopDurationBadge();
});

// 生成・再生
$('generateLoopBtn').addEventListener('click', () => {
  regenerate();
  startLoopPlayback(0);
  showToast(`約${Math.round(getTotalLoopSeconds())}秒（32小節）のループを生成して再生を始めました`);
});

$('playLoopBtn').addEventListener('click', () => {
  if (state.isPlayingLoop) stopLoopPlayback(false);
  else startLoopPlayback(state.currentBar);
});
$('stopLoopBtn').addEventListener('click', () => stopLoopPlayback(true));
$<HTMLInputElement>('seamlessLoopToggle').addEventListener('change', e => {
  state.seamlessLoop = (e.target as HTMLInputElement).checked;
});
$('exportWavBtn').addEventListener('click', exportLoopToWav);

// 再描画（サイズ変更・ライト/ダーク切替で canvas の色を更新）
window.addEventListener('resize', drawPhraseRoll);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawPhraseRoll);
