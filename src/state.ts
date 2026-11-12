import type { Arrangement, Note, NoteHandle, Scale, StyleId, Track } from './types';

export interface State {
  audioCtx: AudioContext | null;
  masterGain: GainNode | null;
  analyser: AnalyserNode | null;
  compressorNode: DynamicsCompressorNode | null;
  masterVol: number;

  selectedInstrument: string;
  baseOctave: number;
  sustain: boolean;
  showKeyHints: boolean;
  activeNotes: Map<number, NoteHandle>;

  isRecording: boolean;
  isCountingIn: boolean;
  recStartTime: number;
  recTimer: ReturnType<typeof setTimeout> | null;
  phraseNotes: Note[];
  pendingRecNotes: Map<number, { startBeat: number; vel: number }>;

  bpm: number;
  style: StyleId;
  totalBars: number;
  seamlessLoop: boolean;
  isPlayingLoop: boolean;
  loopStartTime: number;
  schedulerTimer: ReturnType<typeof setInterval> | null;
  nextScheduleBar: number;
  currentBar: number;

  detectedScale: Scale;
  arrangement: Arrangement | null;
  tracks: Track[];
}

export const state: State = {
  audioCtx: null,
  masterGain: null,
  analyser: null,
  compressorNode: null,
  masterVol: 0.8,

  selectedInstrument: 'piano',
  baseOctave: 3, // C3 〜 B4（24鍵）
  sustain: false,
  showKeyHints: true,
  activeNotes: new Map(),

  isRecording: false,
  isCountingIn: false,
  recStartTime: 0,
  recTimer: null,
  phraseNotes: [],
  pendingRecNotes: new Map(),

  bpm: 120,
  style: 'pop',
  totalBars: 32, // 120BPMで32小節 = 64秒
  seamlessLoop: true,
  isPlayingLoop: false,
  loopStartTime: 0,
  schedulerTimer: null,
  nextScheduleBar: 0,
  currentBar: 0,

  detectedScale: { root: 0, type: 'major', name: 'C Major' },
  arrangement: null,

  tracks: [
    { id: 'lead', name: 'リードメロディ', inst: 'piano', vol: 0.85, mute: false, solo: false, color: 'var(--blue)' },
    { id: 'chords', name: 'コードバッキング', inst: 'epiano', vol: 0.65, mute: false, solo: false, color: 'var(--purple)' },
    { id: 'bass', name: 'シンセベース', inst: 'synthbass', vol: 0.8, mute: false, solo: false, color: 'var(--pink)' },
    { id: 'arp', name: 'アルペジオ装飾', inst: 'pluck', vol: 0.55, mute: false, solo: false, color: 'var(--orange)' },
    { id: 'drums', name: 'ドラム＆ビート', inst: 'drums', vol: 0.85, mute: false, solo: false, color: 'var(--green)' }
  ]
};

// ---- 拍・小節・ループ長の計算（state.bpm に依存）----
export const getSecondsPerBeat = (): number => 60 / state.bpm;
export const getSecondsPerBar = (): number => getSecondsPerBeat() * 4;
export const getTotalLoopSeconds = (): number => getSecondsPerBar() * state.totalBars;

export function formatTimeMMSS(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
