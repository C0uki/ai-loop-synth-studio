import { describe, expect, it } from 'vitest';
import { detectScaleFromNotes, generateArrangement, TOTAL_BARS } from './arranger';
import { PRESET_MOTIFS } from './data';
import type { StyleId } from './types';

describe('arranger', () => {
  it('Cメジャーのフレーズを C Major と判定する', () => {
    const notes = [60, 62, 64, 65, 67, 69, 71, 72].map((midi, i) => ({ midi, start: i * 0.5, dur: 0.5, vel: 0.8 }));
    expect(detectScaleFromNotes(notes).name).toBe('C Major');
  });

  it.each<StyleId>(['pop', 'lofi', 'synthwave', 'fusion'])('%s: 32小節で、Bar5以降にベースとドラムがあり Bar1 にドラムがない', style => {
    const motif = PRESET_MOTIFS[0];
    const { arrangement, chordNames } = generateArrangement(motif.notes, style, 120, 'piano');
    expect(arrangement.bars).toHaveLength(TOTAL_BARS);
    expect(chordNames).toHaveLength(4);
    expect(arrangement.bars[0].drums).toHaveLength(0);
    expect(arrangement.bars[4].bass.length).toBeGreaterThan(0);
    expect(arrangement.bars[4].drums.length).toBeGreaterThan(0);
    expect(arrangement.bars[0].lead.length).toBeGreaterThan(0);
  });
});
