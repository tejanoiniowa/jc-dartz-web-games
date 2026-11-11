// common.js — small helpers the game modules share
'use strict';

const Kit = {
  // Did this entrant's side win the match?
  won(S, e) { return S.winner >= 0 && S.sides[S.winner].members.includes(e.idx); },
  tied(S, e) { return S.winner < 0 && (S.tied || []).includes(S.sides.findIndex(s => s.members.includes(e.idx))); },

  // A saved player's stats bucket for one game, created with defaults
  bucket(e, key, defaults) {
    if (e.kind !== 'player') return null;
    const p = Store.get(e.id); if (!p) return null;
    p.stats[key] = Object.assign({ history: [] }, defaults, p.stats[key]);
    return p.stats[key];
  },
  push(arr, item, max) { arr.push(item); if (arr.length > (max || 50)) arr.splice(0, arr.length - (max || 50)); },

  // Awards any game can give for a turn
  generic(darts) {
    const ds = darts.filter(d => !d.filler);
    if (ds.length !== 3) return null;
    if (ds.every(d => d.num === 25)) return { big: 'HAT TRICK', say: ['hat_trick', 'Hat trick!'] };
    if (ds.every(d => d.mult === 3 && d.num === ds[0].num)) return { big: 'THREE IN A BED', say: ['three_in_a_bed', 'Three in a bed!'] };
    return null;
  },
  pct(h, d) { return d ? Math.round(100 * h / d) + '%' : '-'; },
};
window.Kit = Kit;
