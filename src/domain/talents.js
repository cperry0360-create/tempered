import { totalLevels } from './rank.js'

export const TALENTS = [
  { id: 'edge', name: 'Tempered Edge', stat: 'DAMAGE', effectKey: 'damagePerRank', format: 'percent', description: 'Hit harder in every Expedition.' },
  { id: 'fortitude', name: 'Fortitude', stat: 'MAX HP', effectKey: 'healthPerRank', format: 'percent', description: 'Carry more health into every fight.' },
  { id: 'bulwark', name: 'Bulwark', stat: 'DEFENCE', effectKey: 'defencePerRank', format: 'flat', description: 'Reduce incoming damage.' },
  { id: 'quickstep', name: 'Quickstep', stat: 'SPEED', effectKey: 'speedPerRank', format: 'percent', description: 'Act more often in combat.' },
  { id: 'keen_eye', name: 'Keen Eye', stat: 'CRIT', effectKey: 'critChancePerRank', format: 'percentPoints', description: 'Raise critical-hit chance.' },
]

export function earnedTalentPoints(levels, balance) {
  const every = Math.max(1, Number(balance?.talents?.pointEveryTotalLevels ?? 1))
  return Math.floor(totalLevels(levels) / every)
}

export function normalizeTalents(talents, balance) {
  const maxRank = Math.max(1, Number(balance?.talents?.maxRankPerTalent ?? 1))
  const source = talents && typeof talents === 'object' ? talents : {}
  return Object.fromEntries(TALENTS.map(({ id }) => [
    id,
    Math.max(0, Math.min(maxRank, Math.floor(Number(source[id] ?? 0) || 0))),
  ]))
}

export function talentState(levels, talents, balance) {
  const ranks = normalizeTalents(talents, balance)
  const earned = earnedTalentPoints(levels, balance)
  const spent = Object.values(ranks).reduce((sum, rank) => sum + rank, 0)
  return {
    ranks,
    earned,
    spent,
    available: Math.max(0, earned - spent),
    maxRank: Math.max(1, Number(balance?.talents?.maxRankPerTalent ?? 1)),
  }
}

export function applyTalentsToHero(hero, talents, balance) {
  const ranks = normalizeTalents(talents, balance)
  const tune = balance?.talents ?? {}
  return {
    ...hero,
    damage: hero.damage * (1 + ranks.edge * Number(tune.damagePerRank ?? 0)),
    health: hero.health * (1 + ranks.fortitude * Number(tune.healthPerRank ?? 0)),
    defence: hero.defence + ranks.bulwark * Number(tune.defencePerRank ?? 0),
    attackSpeed: hero.attackSpeed * (1 + ranks.quickstep * Number(tune.speedPerRank ?? 0)),
    crit: Math.min(
      Number(balance?.battle?.critCap ?? 1),
      hero.crit + ranks.keen_eye * Number(tune.critChancePerRank ?? 0),
    ),
  }
}

export function talentEffectText(talent, balance) {
  const value = Number(balance?.talents?.[talent.effectKey] ?? 0)
  if (talent.format === 'flat') return `+${value} ${talent.stat} / rank`
  if (talent.format === 'percentPoints') return `+${Math.round(value * 100)}% ${talent.stat} / rank`
  return `+${Math.round(value * 100)}% ${talent.stat} / rank`
}
