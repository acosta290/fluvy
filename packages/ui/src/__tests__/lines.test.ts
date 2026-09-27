import { describe, expect, it } from 'vitest';
import { linesNeeded } from '../text.js';

/** A monospace stand-in for the ruler: 8 px a character. */
const measure = (text: string): number => text.length * 8;

describe('linesNeeded', () => {
  it('fills a line word by word, as the browser wraps at spaces', () => {
    expect(linesNeeded('Apagar Luz Porche & Patio', 80, measure)).toBe(3); // "Apagar Luz" · "Porche &" · "Patio"
    expect(linesNeeded('Movie night', 88, measure)).toBe(1);
    expect(linesNeeded('Good night', 40, measure)).toBe(2);
  });

  it('breaks a word wider than the line inside itself', () => {
    expect(linesNeeded('Supercalifragilistic', 80, measure)).toBe(2);
    expect(linesNeeded('Supercalifragilistic on', 80, measure)).toBe(3);
  });

  it('breaks after a hyphen, as the browser does', () => {
    expect(linesNeeded('Encendido power-on', 72, measure)).toBe(2); // "Encendido" · "power-on"
    expect(linesNeeded('power-on', 48, measure)).toBe(2); // "power-" · "on"
    expect(linesNeeded('power-on', 64, measure)).toBe(1);
  });

  it('says a line of no width never fits', () => {
    expect(linesNeeded('Scene', 0, measure)).toBe(Number.POSITIVE_INFINITY);
  });
});
