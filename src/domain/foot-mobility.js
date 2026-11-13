export const FOOT_MOBILITY_REST = 5

const calfSets = ['Left', 'Right'].map(side => ({ label: side + ' leg back', seconds: 30 }))

export const FOOT_MOBILITY = [
  {
    id: 'arch-roll', name: 'Seated arch roll', photo: 'roll',
    cue: 'Sit and roll a ball slowly under the sore arch, between the heel and ball of the foot. Use light pressure, especially with a lacrosse ball.',
    sets: [{ label: 'Sore foot · Roll', seconds: 120 }],
  },
  {
    id: 'plantar-fascia', name: 'Seated plantar fascia stretch', photo: 'plantar',
    cue: 'Cross the sore foot over your other knee. Gently draw the big toe toward your shin until you feel tension under the arch. Back off if the toe joint hurts.',
    sets: Array.from({ length: 5 }, (_, index) => ({ label: 'Sore foot · Rep ' + (index + 1), seconds: 10 })),
  },
  {
    id: 'straight-knee', name: 'Straight-knee calf stretch', photo: 'straight',
    cue: 'Use a wall or fixed support. Keep your back knee straight and your back heel and toes down. Lean gently into the stretch.',
    sets: calfSets,
  },
  {
    id: 'bent-knee', name: 'Bent-knee calf stretch', photo: 'bent',
    cue: 'Use a wall or fixed support. Soften the back knee and keep your back heel and toes down. Lean gently into the stretch.',
    sets: calfSets,
  },
]

export const FOOT_MOBILITY_INTERVALS = FOOT_MOBILITY.reduce((total, movement) => total + movement.sets.length, 0)
