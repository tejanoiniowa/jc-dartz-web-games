// segs.js — dart segments, board layout and checkout routes
'use strict';

const BOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

// Parse a segment key ("T20", "D16", "S5I", "S5O", "SB", "DB", "OUT") into a dart.
// num: 1-20, 25 for bull, 0 for a miss. mult: 1/2/3, 0 for a miss.
function parseSeg(key) {
  const k = String(key || 'OUT').toUpperCase();
  if (k === 'SB' || k === 'BULL') return { key: 'SB', num: 25, mult: 1, value: 25, ring: 'B' };
  if (k === 'DB' || k === 'DBULL') return { key: 'DB', num: 25, mult: 2, value: 50, ring: 'B' };
  const m = k.match(/^([SDT])(\d{1,2})([IO]?)$/);
  if (m) {
    const num = parseInt(m[2], 10);
    if (num >= 1 && num <= 20) {
      const mult = { S: 1, D: 2, T: 3 }[m[1]];
      return { key: m[1] + num + (m[3] || ''), num, mult, value: num * mult, ring: m[3] || '' };
    }
  }
  return { key: 'OUT', num: 0, mult: 0, value: 0, ring: '' };
}

// Words shown in the dart strip: "Triple 20", "Single 5", "Bull", "Double Bull", "Miss"
function segName(d) {
  if (!d || d.num === 0) return 'Miss';
  if (d.num === 25) return d.mult === 2 ? 'Double Bull' : 'Bull';
  return ['', 'Single', 'Double', 'Triple'][d.mult] + ' ' + d.num;
}
function segShort(d) {
  if (!d || d.num === 0) return 'MISS';
  if (d.num === 25) return d.mult === 2 ? 'DB' : 'SB';
  return ['', 'S', 'D', 'T'][d.mult] + d.num;
}

// Numbers next to n on the board (for computer misses)
function neighbors(n) {
  const i = BOARD_ORDER.indexOf(n);
  if (i < 0) return [n];
  return [BOARD_ORDER[(i + 19) % 20], BOARD_ORDER[(i + 1) % 20]];
}

// ---------------------------------------------------------------
// Checkout routes (double out). Bull = 50 in the table.
// ---------------------------------------------------------------
const CHECKOUTS = {
  170: ['T20', 'T20', 'DB'], 167: ['T20', 'T19', 'DB'], 164: ['T20', 'T18', 'DB'], 161: ['T20', 'T17', 'DB'],
  160: ['T20', 'T20', 'D20'], 158: ['T20', 'T20', 'D19'], 157: ['T20', 'T19', 'D20'], 156: ['T20', 'T20', 'D18'],
  155: ['T20', 'T19', 'D19'], 154: ['T20', 'T18', 'D20'], 153: ['T20', 'T19', 'D18'], 152: ['T20', 'T20', 'D16'],
  151: ['T20', 'T17', 'D20'], 150: ['T20', 'T18', 'D18'], 149: ['T20', 'T19', 'D16'], 148: ['T20', 'T16', 'D20'],
  147: ['T20', 'T17', 'D18'], 146: ['T20', 'T18', 'D16'], 145: ['T20', 'T15', 'D20'], 144: ['T20', 'T20', 'D12'],
  143: ['T20', 'T17', 'D16'], 142: ['T20', 'T14', 'D20'], 141: ['T20', 'T19', 'D12'], 140: ['T20', 'T20', 'D10'],
  139: ['T20', 'T13', 'D20'], 138: ['T20', 'T18', 'D12'], 137: ['T20', 'T19', 'D10'], 136: ['T20', 'T20', 'D8'],
  135: ['T20', 'T17', 'D12'], 134: ['T20', 'T14', 'D16'], 133: ['T20', 'T19', 'D8'], 132: ['T20', 'T16', 'D12'],
  131: ['T20', 'T13', 'D16'], 130: ['T20', 'T20', 'D5'], 129: ['T19', 'T16', 'D12'], 128: ['T18', 'T14', 'D16'],
  127: ['T20', 'T17', 'D8'], 126: ['T19', 'T19', 'D6'], 125: ['T18', 'T13', 'D16'], 124: ['T20', 'T16', 'D8'],
  123: ['T19', 'T16', 'D9'], 122: ['T18', 'T20', 'D4'], 121: ['T20', 'T11', 'D14'], 120: ['T20', 'S20', 'D20'],
  119: ['T19', 'T12', 'D13'], 118: ['T20', 'S18', 'D20'], 117: ['T20', 'S17', 'D20'], 116: ['T20', 'S16', 'D20'],
  115: ['T20', 'S15', 'D20'], 114: ['T20', 'S14', 'D20'], 113: ['T20', 'S13', 'D20'], 112: ['T20', 'S12', 'D20'],
  111: ['T20', 'S11', 'D20'], 110: ['T20', 'S10', 'D20'], 109: ['T20', 'S9', 'D20'], 108: ['T20', 'S8', 'D20'],
  107: ['T19', 'S10', 'D20'], 106: ['T20', 'S6', 'D20'], 105: ['T20', 'S5', 'D20'], 104: ['T18', 'S10', 'D20'],
  103: ['T19', 'S6', 'D20'], 102: ['T20', 'S10', 'D16'], 101: ['T17', 'S10', 'D20'], 100: ['T20', 'D20'],
  99: ['T19', 'S10', 'D16'], 98: ['T20', 'D19'], 97: ['T19', 'D20'], 96: ['T20', 'D18'], 95: ['T19', 'D19'],
  94: ['T18', 'D20'], 93: ['T19', 'D18'], 92: ['T20', 'D16'], 91: ['T17', 'D20'], 90: ['T18', 'D18'],
  89: ['T19', 'D16'], 88: ['T16', 'D20'], 87: ['T17', 'D18'], 86: ['T18', 'D16'], 85: ['T15', 'D20'],
  84: ['T20', 'D12'], 83: ['T17', 'D16'], 82: ['T14', 'D20'], 81: ['T15', 'D18'], 80: ['T20', 'D10'],
  79: ['T13', 'D20'], 78: ['T18', 'D12'], 77: ['T19', 'D10'], 76: ['T20', 'D8'], 75: ['T17', 'D12'],
  74: ['T14', 'D16'], 73: ['T19', 'D8'], 72: ['T16', 'D12'], 71: ['T13', 'D16'], 70: ['T10', 'D20'],
  69: ['T15', 'D12'], 68: ['T20', 'D4'], 67: ['T17', 'D8'], 66: ['T10', 'D18'], 65: ['T19', 'D4'],
  64: ['T16', 'D8'], 63: ['T13', 'D12'], 62: ['T10', 'D16'], 61: ['T15', 'D8'], 60: ['S20', 'D20'],
  59: ['S19', 'D20'], 58: ['S18', 'D20'], 57: ['S17', 'D20'], 56: ['S16', 'D20'], 55: ['S15', 'D20'],
  54: ['S14', 'D20'], 53: ['S13', 'D20'], 52: ['S12', 'D20'], 51: ['S11', 'D20'], 50: ['DB'],
  49: ['S17', 'D16'], 48: ['S16', 'D16'], 47: ['S15', 'D16'], 46: ['S6', 'D20'], 45: ['S13', 'D16'],
  44: ['S12', 'D16'], 43: ['S3', 'D20'], 42: ['S10', 'D16'], 41: ['S9', 'D16'], 39: ['S7', 'D16'],
  37: ['S5', 'D16'], 35: ['S3', 'D16'], 33: ['S1', 'D16'], 31: ['S15', 'D8'], 29: ['S13', 'D8'],
  27: ['S11', 'D8'], 25: ['S9', 'D8'], 23: ['S7', 'D8'], 21: ['S5', 'D8'], 19: ['S3', 'D8'],
  17: ['S1', 'D8'], 15: ['S7', 'D4'], 13: ['S5', 'D4'], 11: ['S3', 'D4'], 9: ['S1', 'D4'],
  7: ['S3', 'D2'], 5: ['S1', 'D2'], 3: ['S1', 'D1'],
};
for (let n = 2; n <= 40; n += 2) if (!CHECKOUTS[n]) CHECKOUTS[n] = ['D' + n / 2];

// Best finish for `score` with `darts` left.
// out: 'open' | 'double' | 'master'.  bull50: true when any bull counts 50.
function checkoutRoute(score, darts, out, bull50) {
  if (score <= 0 || darts <= 0) return null;
  let path = null;
  if (out === 'open') {
    if (score <= 20) path = ['S' + score];
    else if (score <= 60 && score % 3 === 0) path = ['T' + score / 3];
    else if (score <= 40 && score % 2 === 0) path = ['D' + score / 2];
    else if (score === 50) path = [bull50 ? 'SB' : 'DB'];
    else if (score === 25 && !bull50) path = ['SB'];
  }
  if (out === 'master' && !path) {
    if (score <= 60 && score % 3 === 0) path = ['T' + score / 3];
  }
  if (!path) path = CHECKOUTS[score] ? CHECKOUTS[score].slice() : null;
  if (!path || path.length > darts) return null;
  return path;
}

window.Segs = { BOARD_ORDER, parseSeg, segName, segShort, neighbors, checkoutRoute };
