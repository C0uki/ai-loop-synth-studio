import type { BassStep, ChordPattern, Hits, Instrument, Motif, StyleId, StyleSpec } from './types';

export const INSTRUMENTS: Instrument[] = [
  {
    id: 'piano',
    name: 'グランドピアノ',
    en: 'Grand Piano',
    icon: '🎹',
    desc: '倍音豊かなアコースティック・グランドピアノ'
  },
  {
    id: 'epiano',
    name: 'エレクトリックピアノ',
    en: 'Electric Piano',
    icon: '✨',
    desc: 'FMベルの輝きを持つローズ風エレピ'
  },
  {
    id: 'synthlead',
    name: 'シンセリード',
    en: 'Analog Lead',
    icon: '⚡',
    desc: '太く存在感のあるデチューン・アナログリード'
  },
  {
    id: 'warmpad',
    name: 'ウォームパッド',
    en: 'Warm Pad',
    icon: '🌌',
    desc: '空間を包み込む幻想的なアンビエントパッド'
  },
  {
    id: 'synthbass',
    name: 'シンセベース',
    en: 'Deep Bass',
    icon: '🔊',
    desc: '重厚なローエンドを支えるレゾナンスベース'
  },
  {
    id: 'organ',
    name: 'ドローバーオルガン',
    en: 'Tone Organ',
    icon: '⛪',
    desc: 'ハモンド風の豊かな倍音加算オルガン'
  },
  {
    id: 'marimba',
    name: 'マリンバ / ヴィブラフォン',
    en: 'Marimba',
    icon: '🪵',
    desc: '木の温もりと透明感あるマレット打楽器'
  },
  {
    id: 'pluck',
    name: 'プラック / ハープ',
    en: 'Synth Pluck',
    icon: '🪕',
    desc: '歯切れよく煌めく撥弦プラックシンセ'
  },
  {
    id: 'chiptune',
    name: 'チップチューン 8bit',
    en: '8-Bit Retro',
    icon: '👾',
    desc: '懐かしのレトロゲーム風パルス矩形波'
  },
  {
    id: 'brass',
    name: 'シンセブラス',
    en: 'Synth Brass',
    icon: '🎺',
    desc: '力強いフィルタースウィープのブラスアンサンブル'
  },
  {
    id: 'strings',
    name: 'ストリングス',
    en: 'Lush Strings',
    icon: '🎻',
    desc: '滑らかなアタックの弦楽アンサンブル'
  }
];

// -------------------------------------------------------------------------
// 1b. GENRES（ジャンルの設計図。ここに足せば、選択肢と自動アレンジに反映される）
// -------------------------------------------------------------------------
const hits = (beats: number[], dur: number, vel: number): Hits => ({ beats, dur, vel });
const hold = (n: 3 | 4, dur: number, vel: number, chorusVel = vel): ChordPattern => ({ n, verse: hits([0], dur, vel), chorus: hits([0], dur, chorusVel) });
const eighthBass = (dur: number, vel: number, oct: (s: number) => number): BassStep[] =>
  Array.from({ length: 8 }, (_, s): BassStep => [s * 0.5, 0, oct(s), dur, vel]);

const FOUR = [0, 1, 2, 3];
const OFFBEATS = [0.5, 1.5, 2.5, 3.5];
const STAB: ChordPattern = { n: 3, verse: hits([0, 2], 1.8, 0.55), chorus: hits([0, 1.5, 2.5, 3.5], 0.85, 0.72) };
const POP_BASS: BassStep[] = [[0, 0, 0, 0.9, 0.88], [1.5, 0, 0, 0.45, 0.75], [2, 2, 0, 0.9, 0.82], [3, 0, 1, 0.85, 0.8]];
const WALK: BassStep[] = [[0, 0, 0, 0.9, 0.85], [1, 1, 0, 0.9, 0.75], [2, 2, 0, 0.9, 0.8], [3, 1, 0, 0.9, 0.75]];

export const STYLES: Record<StyleId, StyleSpec> = {
  pop: {
    name: 'ポップ', bpm: 120, swing: 0,
    prog: { major: [3, 4, 2, 5], minor: [5, 3, 0, 4] },
    insts: { chords: 'epiano', bass: 'synthbass', arp: 'pluck' },
    chords: STAB, bass: POP_BASS, arp: [0.5, 0.25],
    drums: { kick: FOUR, snare: [1, 3], snareType: 'clap', hat: [8, 16] }
  },
  lofi: {
    name: 'Lo-Fi', bpm: 108, swing: 0.08,
    prog: { major: [1, 4, 0, 5], minor: [3, 6, 2, 5] },
    insts: { chords: 'epiano', bass: 'synthbass', arp: 'marimba' },
    chords: hold(4, 3.75, 0.58, 0.75),
    bass: [[0, 0, 0, 1.75, 0.82], [2, 2, 0, 1.25, 0.72], [3.5, 0, 1, 0.45, 0.68]], arp: [0.5, 0.25],
    drums: { kick: [0, 2.5], snare: [1, 3], hat: [8, 16] }
  },
  synthwave: {
    name: 'シンセウェーブ', bpm: 124, swing: 0,
    prog: { major: [5, 3, 0, 4], minor: [0, 5, 2, 6] },
    insts: { chords: 'warmpad', bass: 'synthbass', arp: 'pluck' },
    chords: hold(3, 3.9, 0.62), bass: eighthBass(0.42, 0.85, s => (s % 4 === 3 ? 1 : 0)), arp: [0.5, 0.25],
    drums: { kick: FOUR, snare: [1, 3], hat: [8, 16] }
  },
  fusion: {
    name: 'フュージョン', bpm: 116, swing: 0.05,
    prog: { major: [3, 2, 1, 4], minor: [1, 4, 0, 3] },
    insts: { chords: 'organ', bass: 'synthbass', arp: 'epiano' },
    chords: STAB, bass: POP_BASS, arp: [0.5, 0.25],
    drums: { kick: [0, 2.5], snare: [1, 3], hat: [8, 16] }
  },
  rock: {
    name: 'ロック', bpm: 130, swing: 0,
    prog: { major: [0, 4, 5, 3], minor: [0, 6, 5, 6] },
    insts: { chords: 'organ', bass: 'synthbass', arp: 'pluck' },
    chords: { n: 3, verse: hits(FOUR, 0.9, 0.5), chorus: hits([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], 0.45, 0.62) },
    bass: eighthBass(0.45, 0.8, () => 0), arp: [0.5, 0.25],
    drums: { kick: [0, 2, 2.5], snare: [1, 3], hat: [8, 8] }
  },
  ballad: {
    name: 'バラード', bpm: 72, swing: 0,
    prog: { major: [0, 2, 3, 4], minor: [0, 5, 3, 4] },
    insts: { chords: 'strings', bass: 'synthbass', arp: 'piano' },
    chords: { n: 4, verse: hits([0], 3.9, 0.5), chorus: hits([0, 2], 1.9, 0.6) },
    bass: [[0, 0, 0, 3.8, 0.8]], arp: [0.5, 0.5],
    drums: { kick: [0, 2], snare: [1, 3], hat: [4, 8], noFill: true }
  },
  house: {
    name: 'ハウス', bpm: 124, swing: 0,
    prog: { major: [0, 5, 3, 4], minor: [0, 3, 5, 6] },
    insts: { chords: 'piano', bass: 'synthbass', arp: 'pluck' },
    chords: { n: 3, verse: hits([0, 1.5, 3], 0.5, 0.55), chorus: hits([0, 1.5, 3], 0.5, 0.7) },
    bass: OFFBEATS.map((b): BassStep => [b, 0, 0, 0.35, 0.85]), arp: [0.5, 0.25],
    drums: { kick: FOUR, snare: [1, 3], snareType: 'clap', hat: [8, 16], openOff: true }
  },
  edm: {
    name: 'EDM', bpm: 128, swing: 0,
    prog: { major: [3, 4, 5, 0], minor: [5, 6, 0, 4] },
    insts: { chords: 'synthlead', bass: 'synthbass', arp: 'pluck' },
    chords: { n: 3, verse: hits([0], 3.9, 0.55), chorus: hits([0, 2], 1.9, 0.7) },
    bass: FOUR.map((b): BassStep => [b, 0, 0, 0.45, 0.85]), arp: [0.25, 0.25],
    drums: { kick: FOUR, snare: [1, 3], snareType: 'clap', hat: [8, 16] }
  },
  hiphop: {
    name: 'ヒップホップ', bpm: 90, swing: 0.06,
    prog: { major: [5, 4, 3, 4], minor: [0, 5, 3, 4] },
    insts: { chords: 'epiano', bass: 'synthbass', arp: 'pluck' },
    chords: { n: 4, verse: hits([0, 2.5], 1.5, 0.55), chorus: hits([0, 2.5], 1.5, 0.68) },
    bass: [[0, 0, 0, 1.4, 0.9], [2.5, 0, 0, 1, 0.8], [3.5, 2, 0, 0.4, 0.7]], arp: [0.5, 0.5],
    drums: { kick: [0, 0.75, 2.5], snare: [1, 3], hat: [8, 8] }
  },
  trap: {
    name: 'トラップ', bpm: 140, swing: 0,
    prog: { major: [5, 2, 3, 4], minor: [0, 5, 6, 4] },
    insts: { chords: 'warmpad', bass: 'synthbass', arp: 'marimba' },
    chords: hold(4, 3.9, 0.5, 0.6),
    bass: [[0, 0, 0, 1.8, 0.95], [2.75, 0, 0, 0.9, 0.9]], arp: [0.5, 0.25],
    drums: { kick: [0, 2.75], snare: [2], snareType: 'clap', hat: [16, 16] }
  },
  rnb: {
    name: 'R&B', bpm: 86, swing: 0.06,
    prog: { major: [1, 4, 2, 5], minor: [0, 3, 6, 2] },
    insts: { chords: 'epiano', bass: 'synthbass', arp: 'pluck' },
    chords: hold(4, 3.75, 0.55, 0.7),
    bass: [[0, 0, 0, 1.5, 0.85], [1.75, 0, 0, 0.4, 0.7], [2.5, 2, 0, 1, 0.78], [3.5, 1, 0, 0.4, 0.7]], arp: [0.5, 0.5],
    drums: { kick: [0, 2.5], snare: [1, 3], snareType: 'clap', hat: [8, 8] }
  },
  funk: {
    name: 'ファンク', bpm: 106, swing: 0.04,
    prog: { major: [0, 3, 0, 4], minor: [0, 3, 0, 3] },
    insts: { chords: 'epiano', bass: 'synthbass', arp: 'brass' },
    chords: { n: 4, verse: hits([0, 0.75, 2.5, 3.25], 0.3, 0.55), chorus: hits([0, 0.75, 2.5, 3.25], 0.3, 0.7) },
    bass: [[0, 0, 0, 0.4, 0.9], [0.75, 0, 0, 0.3, 0.75], [1.5, 0, 1, 0.3, 0.8], [2.5, 0, 0, 0.4, 0.85], [3, 2, 0, 0.3, 0.75], [3.25, 0, 0, 0.3, 0.7]],
    arp: [0.5, 0.25],
    drums: { kick: [0, 0.75, 2.5], snare: [1, 3], hat: [16, 16] }
  },
  disco: {
    name: 'ディスコ', bpm: 116, swing: 0,
    prog: { major: [1, 4, 0, 5], minor: [0, 3, 6, 2] },
    insts: { chords: 'strings', bass: 'synthbass', arp: 'pluck' },
    chords: { n: 3, verse: hits(OFFBEATS, 0.4, 0.55), chorus: hits(OFFBEATS, 0.4, 0.68) },
    bass: eighthBass(0.45, 0.85, s => s % 2), arp: [0.5, 0.25],
    drums: { kick: FOUR, snare: [1, 3], snareType: 'clap', hat: [8, 8], openOff: true }
  },
  reggae: {
    name: 'レゲエ', bpm: 78, swing: 0.05,
    prog: { major: [0, 4, 0, 3], minor: [0, 6, 0, 3] },
    insts: { chords: 'organ', bass: 'synthbass', arp: 'marimba' },
    chords: { n: 3, verse: hits(OFFBEATS, 0.25, 0.55), chorus: hits(OFFBEATS, 0.25, 0.65) },
    bass: [[0, 0, 0, 1.4, 0.9], [2, 2, 0, 0.9, 0.8], [3, 0, 0, 0.9, 0.8]], arp: [0.5, 0.5],
    drums: { kick: [2], snare: [2], hat: [8, 8] }
  },
  bossa: {
    name: 'ボサノバ', bpm: 112, swing: 0,
    prog: { major: [1, 4, 0, 5], minor: [1, 4, 0, 3] },
    insts: { chords: 'piano', bass: 'synthbass', arp: 'marimba' },
    chords: { n: 3, verse: hits([0, 1.5, 3], 0.9, 0.5), chorus: hits([0, 1.5, 3], 0.9, 0.6) },
    bass: [[0, 0, 0, 1.3, 0.85], [1.5, 2, 0, 0.4, 0.7], [2, 0, 0, 1.3, 0.8], [3.5, 2, 0, 0.4, 0.7]], arp: [0.5, 0.5],
    drums: { kick: [0, 1.5, 2, 3.5], snare: [], hat: [8, 8], noFill: true }
  },
  jazz: {
    name: 'ジャズ', bpm: 104, swing: 0.14,
    prog: { major: [2, 5, 1, 4], minor: [1, 4, 0, 5] },
    insts: { chords: 'piano', bass: 'synthbass', arp: 'epiano' },
    chords: { n: 4, verse: hits([0, 2.5], 1.2, 0.5), chorus: hits([0, 1.5, 2.5], 0.9, 0.6) },
    bass: WALK, arp: [0.5, 0.5],
    drums: { kick: [0], snare: [3], hat: [8, 8] }
  },
  blues: {
    name: 'ブルース', bpm: 92, swing: 0.12,
    prog: { major: [0, 3, 0, 4], minor: [0, 3, 0, 4] },
    insts: { chords: 'organ', bass: 'synthbass', arp: 'piano' },
    chords: { n: 4, verse: hits([0, 2], 1.8, 0.55), chorus: hits(FOUR, 0.9, 0.65) },
    bass: WALK, arp: [0.5, 0.5],
    drums: { kick: [0, 2], snare: [1, 3], hat: [8, 8] }
  },
  ambient: {
    name: 'アンビエント', bpm: 66, swing: 0,
    prog: { major: [0, 2, 5, 3], minor: [0, 2, 5, 6] },
    insts: { chords: 'warmpad', bass: 'synthbass', arp: 'epiano' },
    chords: hold(4, 3.95, 0.5),
    bass: [[0, 0, 0, 3.8, 0.6]], arp: [1, 0.5],
    drums: { kick: [0], snare: [], hat: [4, 4], noFill: true }
  },
  chiptune: {
    name: 'チップチューン', bpm: 150, swing: 0,
    prog: { major: [0, 5, 3, 4], minor: [0, 6, 5, 4] },
    insts: { chords: 'chiptune', bass: 'chiptune', arp: 'chiptune' },
    chords: { n: 3, verse: hits([0, 2], 0.9, 0.45), chorus: hits(FOUR, 0.45, 0.55) },
    bass: eighthBass(0.4, 0.8, s => s % 2), arp: [0.25, 0.25],
    drums: { kick: [0, 2], snare: [1, 3], hat: [16, 16] }
  },
  dnb: {
    name: 'ドラムンベース', bpm: 170, swing: 0,
    prog: { major: [5, 4, 3, 4], minor: [0, 2, 6, 5] },
    insts: { chords: 'warmpad', bass: 'synthbass', arp: 'pluck' },
    chords: { n: 3, verse: hits([0], 3.9, 0.5), chorus: hits([0, 2], 1.9, 0.65) },
    bass: [[0, 0, 0, 1.4, 0.9], [1.5, 0, 1, 0.4, 0.75], [2.5, 0, 0, 1.2, 0.88]], arp: [0.5, 0.25],
    drums: { kick: [0, 2.5], snare: [1, 3], hat: [16, 16] }
  }
};

// -------------------------------------------------------------------------
// 2. PRESET SEED PHRASES (2 Bars = 8 Beats)
// -------------------------------------------------------------------------
export const PRESET_MOTIFS: Motif[] = [
  {
    id: 'pop_dream',
    name: '✨ 煌めきポップ',
    style: 'pop',
    inst: 'piano',
    bpm: 120,
    notes: [
      { midi: 72, start: 0.0, dur: 0.75, vel: 0.9 },
      { midi: 71, start: 0.75, dur: 0.5, vel: 0.85 },
      { midi: 67, start: 1.5, dur: 0.5, vel: 0.85 },
      { midi: 69, start: 2.0, dur: 1.5, vel: 0.9 },
      { midi: 67, start: 4.0, dur: 0.75, vel: 0.85 },
      { midi: 69, start: 4.75, dur: 0.75, vel: 0.85 },
      { midi: 72, start: 5.5, dur: 0.75, vel: 0.9 },
      { midi: 74, start: 6.25, dur: 1.5, vel: 0.95 }
    ]
  },
  {
    id: 'lofi_night',
    name: '☕ 夜更かしLo-Fi',
    style: 'lofi',
    inst: 'epiano',
    bpm: 108,
    notes: [
      { midi: 69, start: 0.0, dur: 1.25, vel: 0.8 },
      { midi: 72, start: 1.25, dur: 0.75, vel: 0.75 },
      { midi: 76, start: 2.0, dur: 1.5, vel: 0.85 },
      { midi: 74, start: 3.5, dur: 0.5, vel: 0.7 },
      { midi: 72, start: 4.0, dur: 1.0, vel: 0.8 },
      { midi: 69, start: 5.0, dur: 1.0, vel: 0.75 },
      { midi: 67, start: 6.0, dur: 1.75, vel: 0.82 }
    ]
  },
  {
    id: 'cyber_drive',
    name: '🌃 サイバー疾走',
    style: 'synthwave',
    inst: 'synthlead',
    bpm: 124,
    notes: [
      { midi: 64, start: 0.0, dur: 0.5, vel: 0.95 },
      { midi: 64, start: 0.5, dur: 0.5, vel: 0.8 },
      { midi: 67, start: 1.0, dur: 0.75, vel: 0.9 },
      { midi: 71, start: 1.75, dur: 0.75, vel: 0.95 },
      { midi: 69, start: 2.5, dur: 1.25, vel: 0.9 },
      { midi: 67, start: 4.0, dur: 0.75, vel: 0.9 },
      { midi: 66, start: 4.75, dur: 0.75, vel: 0.85 },
      { midi: 64, start: 5.5, dur: 0.75, vel: 0.9 },
      { midi: 71, start: 6.25, dur: 1.5, vel: 0.95 }
    ]
  },
  {
    id: 'jazz_breeze',
    name: '🎷 都会のフュージョン',
    style: 'fusion',
    inst: 'marimba',
    bpm: 116,
    notes: [
      { midi: 74, start: 0.0, dur: 0.5, vel: 0.88 },
      { midi: 72, start: 0.5, dur: 0.5, vel: 0.82 },
      { midi: 69, start: 1.0, dur: 0.75, vel: 0.88 },
      { midi: 67, start: 1.75, dur: 0.75, vel: 0.85 },
      { midi: 64, start: 2.5, dur: 1.0, vel: 0.9 },
      { midi: 67, start: 4.0, dur: 0.5, vel: 0.85 },
      { midi: 71, start: 4.5, dur: 0.5, vel: 0.88 },
      { midi: 74, start: 5.0, dur: 1.0, vel: 0.92 },
      { midi: 76, start: 6.0, dur: 1.75, vel: 0.95 }
    ]
  }
];
