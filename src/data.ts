import type { Instrument, Motif } from './types';

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
