import type { Arrangement, BarData, Note, Scale, Section, StyleId, TrackId } from './types';

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

export const TOTAL_BARS = 32;

export function getSectionForBar(bar: number): Section {
  if (bar < 4) return 'Intro';
  if (bar < 12) return 'Verse';
  if (bar < 16) return 'Build';
  if (bar < 24) return 'Chorus';
  if (bar < 28) return 'Solo/Var';
  return 'Outro';
}

/** 音がいちばん多く収まる 24 通り（12 ルート × 長/短）のうち最良のスケールを選ぶ。 */
export function detectScaleFromNotes(notes: Note[]): Scale {
  if (!notes || notes.length === 0) {
    return { root: 0, type: 'major', name: 'C Major' };
  }
  let bestScore = -1;
  let bestRoot = 0;
  let bestType: Scale['type'] = 'major';

  for (let root = 0; root < 12; root++) {
    for (const type of ['major', 'minor'] as const) {
      const scaleSet = new Set((type === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS).map(i => (root + i) % 12));
      let score = 0;
      notes.forEach(n => {
        const pc = n.midi % 12;
        if (scaleSet.has(pc)) score += 2;
        if (pc === root) score += 1.5;
      });
      // 同点のときは C Major / A Minor をわずかに優先
      if (root === 0 && type === 'major') score += 0.2;
      if (root === 9 && type === 'minor') score += 0.2;

      if (score > bestScore) {
        bestScore = score;
        bestRoot = root;
        bestType = type;
      }
    }
  }

  return {
    root: bestRoot,
    type: bestType,
    name: `${NOTE_NAMES[bestRoot]} ${bestType === 'major' ? 'Major' : 'Minor'}`
  };
}

/** 度数から 7th コード（根音・3度・5度・7度）の MIDI 番号を作る。 */
export function buildDiatonicChord(scaleRoot: number, scaleType: Scale['type'], degreeIndex: number, baseOctave = 4): number[] {
  const intervals = scaleType === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS;
  const getDegreeMidi = (deg: number): number => {
    const octOffset = Math.floor(deg / 7);
    const idx = ((deg % 7) + 7) % 7;
    return (baseOctave + 1) * 12 + scaleRoot + intervals[idx] + octOffset * 12;
  };
  return [
    getDegreeMidi(degreeIndex),
    getDegreeMidi(degreeIndex + 2),
    getDegreeMidi(degreeIndex + 4),
    getDegreeMidi(degreeIndex + 6)
  ];
}

const STYLE_INSTRUMENTS: Record<StyleId, Record<'chords' | 'bass' | 'arp', string>> = {
  pop: { chords: 'epiano', bass: 'synthbass', arp: 'pluck' },
  lofi: { chords: 'epiano', bass: 'synthbass', arp: 'marimba' },
  synthwave: { chords: 'warmpad', bass: 'synthbass', arp: 'pluck' },
  fusion: { chords: 'organ', bass: 'synthbass', arp: 'epiano' }
};

export interface ArrangeResult {
  arrangement: Arrangement;
  scale: Scale;
  /** 表示用のコード名（例: F - G - Em - Am） */
  chordNames: string[];
  /** スタイルに合わせたトラック別の既定音色（lead は選択中の音色） */
  trackInsts: Record<Exclude<TrackId, 'drums'>, string>;
}

/**
 * 2小節の種フレーズから 32 小節（120BPMで約64秒）の曲を組み立てる。DOM にも state にも触らない。
 *  0-3 Intro / 4-11 Verse / 12-15 Build / 16-23 Chorus / 24-27 Solo/Var / 28-31 Outro
 */
export function generateArrangement(seed: Note[], style: StyleId, bpm: number, leadInst: string): ArrangeResult {
  const scale = detectScaleFromNotes(seed);

  // スタイル別のコード進行（度数）
  const progressionsByStyle: Record<StyleId, number[]> = {
    pop: scale.type === 'major' ? [3, 4, 2, 5] : [5, 3, 0, 4],
    lofi: scale.type === 'major' ? [1, 4, 0, 5] : [3, 6, 2, 5],
    synthwave: scale.type === 'major' ? [5, 3, 0, 4] : [0, 5, 2, 6],
    fusion: scale.type === 'major' ? [3, 2, 1, 4] : [1, 4, 0, 3]
  };
  const progDegrees = progressionsByStyle[style] || [3, 4, 2, 5];
  const intervals = scale.type === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS;
  const chordNames = progDegrees.map(deg => {
    const chordRoot = (scale.root + intervals[deg % 7]) % 12;
    const isMinor = scale.type === 'major' ? [1, 2, 5].includes(deg % 7) : [0, 3, 4].includes(deg % 7);
    return `${NOTE_NAMES[chordRoot]}${isMinor ? 'm' : ''}`;
  });

  const swingAmount = style === 'lofi' ? 0.08 : style === 'fusion' ? 0.05 : 0;
  const bars: BarData[] = [];

  for (let bar = 0; bar < TOTAL_BARS; bar++) {
    const section = getSectionForBar(bar);
    const barData: BarData = { barIndex: bar, section, lead: [], chords: [], bass: [], arp: [], drums: [] };

    const degree = progDegrees[bar % 4];
    const chordNotes = buildDiatonicChord(scale.root, scale.type, degree, 3);
    const bassRoot = chordNotes[0] - 12;
    const bassFifth = chordNotes[2] - 12;

    // 1. リード: 種フレーズを1小節ずつ使い、セクションごとに変化させる
    const seedHalfOffset = (bar % 2) * 4; // 偶数小節は0〜4拍、奇数小節は4〜8拍
    const notesInThisBar = seed.filter(n => n.start >= seedHalfOffset - 0.01 && n.start < seedHalfOffset + 3.99);

    if (section !== 'Outro' || bar < 30) {
      notesInThisBar.forEach((n, idx) => {
        const localBeat = n.start - seedHalfOffset + (Math.round(n.start * 2) % 2 === 1 ? swingAmount : 0);
        let midi = n.midi;
        let vel = n.vel;

        if (section === 'Intro') {
          vel *= 0.72;
        } else if (section === 'Chorus') {
          // サビはオクターブ上を重ねる
          barData.lead.push({ midi: midi + 12, beat: localBeat, dur: n.dur, vel: vel * 0.65 });
          vel = Math.min(1.0, vel * 1.05);
        } else if (section === 'Solo/Var') {
          // 1音おきに3度上へ
          midi += idx % 2 === 0 ? intervals[2] : 0;
        } else if (section === 'Outro') {
          vel *= bar === 28 ? 0.75 : 0.55;
        }

        barData.lead.push({ midi, beat: localBeat, dur: n.dur, vel });
      });
    }

    // 2. コード
    if (style === 'lofi') {
      chordNotes.forEach(cMidi => {
        barData.chords.push({ midi: cMidi, beat: 0, dur: 3.75, vel: section === 'Chorus' ? 0.75 : 0.58 });
      });
    } else if (style === 'pop' || style === 'fusion') {
      const hitBeats = section === 'Chorus' ? [0, 1.5, 2.5, 3.5] : [0, 2];
      const hitDur = section === 'Chorus' ? 0.85 : 1.8;
      hitBeats.forEach(b => {
        chordNotes.slice(0, 3).forEach(cMidi => {
          barData.chords.push({ midi: cMidi, beat: b, dur: hitDur, vel: section === 'Chorus' ? 0.72 : 0.55 });
        });
      });
    } else {
      chordNotes.slice(0, 3).forEach(cMidi => {
        barData.chords.push({ midi: cMidi, beat: 0, dur: 3.9, vel: 0.62 });
      });
    }

    // 3. ベース（Verse から入り、Outro 手前まで）
    if (bar >= 4 && bar < 30) {
      if (style === 'synthwave') {
        for (let step = 0; step < 8; step++) {
          const noteMidi = step % 4 === 3 ? bassRoot + 12 : bassRoot;
          barData.bass.push({ midi: noteMidi, beat: step * 0.5, dur: 0.42, vel: 0.85 });
        }
      } else if (style === 'lofi') {
        barData.bass.push({ midi: bassRoot, beat: 0, dur: 1.75, vel: 0.82 });
        barData.bass.push({ midi: bassFifth, beat: 2.0 + swingAmount, dur: 1.25, vel: 0.72 });
        barData.bass.push({ midi: bassRoot + 12, beat: 3.5 + swingAmount, dur: 0.45, vel: 0.68 });
      } else {
        barData.bass.push({ midi: bassRoot, beat: 0, dur: 0.9, vel: 0.88 });
        barData.bass.push({ midi: bassRoot, beat: 1.5, dur: 0.45, vel: 0.75 });
        barData.bass.push({ midi: bassFifth, beat: 2.0, dur: 0.9, vel: 0.82 });
        barData.bass.push({ midi: bassRoot + 12, beat: 3.0, dur: 0.85, vel: 0.8 });
      }
    }

    // 4. アルペジオ（Build / Chorus / Solo と、Intro 終盤の2小節）
    if ((bar >= 12 && bar < 28) || (bar >= 2 && bar < 4)) {
      const arpNotes = chordNotes.map(m => m + 12);
      const stepDur = section === 'Chorus' ? 0.25 : 0.5;
      const totalSteps = Math.floor(4 / stepDur);
      for (let s = 0; s < totalSteps; s++) {
        barData.arp.push({
          midi: arpNotes[s % arpNotes.length],
          beat: s * stepDur,
          dur: stepDur * 0.85,
          vel: section === 'Chorus' ? 0.65 : 0.48
        });
      }
    }

    // 5. ドラム
    if (bar >= 4 && bar < 30) {
      if (style === 'pop' || style === 'synthwave') {
        [0, 1, 2, 3].forEach(b => barData.drums.push({ type: 'kick', beat: b, vel: 0.92 }));
        [1, 3].forEach(b => barData.drums.push({ type: style === 'pop' ? 'clap' : 'snare', beat: b, vel: 0.85 }));
      } else {
        barData.drums.push({ type: 'kick', beat: 0, vel: 0.9 });
        barData.drums.push({ type: 'kick', beat: 2.5 + swingAmount, vel: 0.82 });
        barData.drums.push({ type: 'snare', beat: 1, vel: 0.8 });
        barData.drums.push({ type: 'snare', beat: 3, vel: 0.84 });
      }

      const hatSteps = section === 'Chorus' ? 16 : 8;
      const hatInterval = 4 / hatSteps;
      for (let h = 0; h < hatSteps; h++) {
        const beat = h * hatInterval + (h % 2 === 1 ? swingAmount * 0.5 : 0);
        const isOpen = h === hatSteps - 2 && bar % 2 === 1;
        barData.drums.push({ type: isOpen ? 'openhat' : 'hat', beat, vel: h % 2 === 0 ? 0.72 : 0.45 });
      }

      // 4小節ごとのフィル
      if (bar % 4 === 3) {
        barData.drums.push({ type: 'snare', beat: 3.5, vel: 0.75 });
        barData.drums.push({ type: 'snare', beat: 3.75, vel: 0.88 });
      }
    } else if (bar === 3 || bar === 31) {
      // 次のセクション（31小節目は頭）へつなぐピックアップ
      barData.drums.push({ type: 'hat', beat: 3.0, vel: 0.5 });
      barData.drums.push({ type: 'openhat', beat: 3.5, vel: 0.65 });
    }

    bars.push(barData);
  }

  return {
    arrangement: { bpm, style, bars },
    scale,
    chordNames,
    trackInsts: { lead: leadInst, ...STYLE_INSTRUMENTS[style] }
  };
}
