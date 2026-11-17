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

export type StyleId =
  | 'pop' | 'lofi' | 'synthwave' | 'fusion'
  | 'rock' | 'ballad' | 'house' | 'edm' | 'hiphop' | 'trap' | 'rnb' | 'funk' | 'disco' | 'reggae'
  | 'bossa' | 'jazz' | 'blues' | 'ambient' | 'chiptune' | 'dnb';

/** コードを鳴らす拍と、その長さ・強さ。 */
export interface Hits { beats: number[]; dur: number; vel: number }
/** コードの鳴らし方。n = 重ねる音数（3 か 4）。verse = 通常、chorus = サビ。 */
export interface ChordPattern { n: 3 | 4; verse: Hits; chorus: Hits }
/** ベースの1音: [拍, コードの何番目の音か（0根音 / 1三度 / 2五度）, オクターブ移動, 長さ, 強さ] */
export type BassStep = [beat: number, tone: 0 | 1 | 2, oct: number, dur: number, vel: number];

/** ジャンルの設計図。arranger はこれを読んで曲を組み立てる。 */
export interface StyleSpec {
  name: string;
  /** ジャンルを選んだときのテンポ */
  bpm: number;
  /** 裏拍を後ろへずらす量（拍） */
  swing: number;
  /** コード進行（スケールの度数, 0始まり） */
  prog: { major: number[]; minor: number[] };
  insts: { chords: string; bass: string; arp: string };
  chords: ChordPattern;
  bass: BassStep[];
  /** アルペジオの刻み（拍）: [通常, サビ] */
  arp: [number, number];
  drums: {
    kick: number[];
    snare: number[];
    snareType?: 'snare' | 'clap';
    /** ハイハットの刻み数（1小節あたり）: [通常, サビ] */
    hat: [number, number];
    /** true なら裏拍をオープンハットにする */
    openOff?: boolean;
    /** true なら4小節ごとのフィルを入れない */
    noFill?: boolean;
  };
}
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
