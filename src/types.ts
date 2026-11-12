export interface Instrument {
  id: string;
  name: string;
  en: string;
  icon: string;
  desc: string;
}

/** 録音フレーズの音。start / dur は拍単位（2小節 = 0〜8拍）。 */
export interface Note {
  midi: number;
  start: number;
  dur: number;
  vel: number;
}

export interface Motif {
  id: string;
  name: string;
  style: StyleId;
  inst: string;
  bpm: number;
  notes: Note[];
}

export type StyleId = 'pop' | 'lofi' | 'synthwave' | 'fusion';
export type Section = 'Intro' | 'Verse' | 'Build' | 'Chorus' | 'Solo/Var' | 'Outro';
export type DrumType = 'kick' | 'snare' | 'clap' | 'hat' | 'openhat';

/** 小節内の1音。beat は小節頭からの拍（0〜4）。 */
export interface NoteEvent {
  midi: number;
  beat: number;
  dur: number;
  vel: number;
}

export interface DrumEvent {
  type: DrumType;
  beat: number;
  vel: number;
}

export interface BarData {
  barIndex: number;
  section: Section;
  lead: NoteEvent[];
  chords: NoteEvent[];
  bass: NoteEvent[];
  arp: NoteEvent[];
  drums: DrumEvent[];
}

export interface Arrangement {
  bpm: number;
  style: StyleId;
  bars: BarData[];
}

export interface Scale {
  root: number;
  type: 'major' | 'minor';
  name: string;
}

export type TrackId = 'lead' | 'chords' | 'bass' | 'arp' | 'drums';

export interface Track {
  id: TrackId;
  name: string;
  inst: string;
  vol: number;
  mute: boolean;
  solo: boolean;
  color: string;
}

/** 発音中の音を止めるためのハンドル。 */
export interface NoteHandle {
  stop(): void;
}
