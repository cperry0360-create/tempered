/** Post-session recap focused on recorded workout performance. */
import { el, replace } from '../dom.js'
import { volume, duration, lbs } from '../format.js'

const dateLabel=(value)=>{
  if(!value)return ''
  const [year,month,day]=value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(new Date(year,month-1,day))
}

export function createSummaryScreen({ onDone }) {
  const root=el('div.screen.screen--summary')
  return {
    root,
    async show(summary){
      const prs=[
        ...summary.records.weightPrs.map((pr)=>({kind:'Weight PR',detail:`${lbs(pr.weight)} × ${pr.reps}`,id:pr.exerciseId})),
        ...summary.records.volumePrs.map((pr)=>({kind:'Volume PR',detail:`${volume(pr.volume)} lbs`,id:pr.exerciseId})),
      ]
      replace(root,[
        el('div.summary-confetti',{'aria-hidden':'true'},Array.from({length:12},(_,index)=>el('i',{dataset:{piece:String(index+1)}}))),
        el('header.summary-hero',{},[
          el('span.summary-hero__eyebrow',{text:'Session complete'}),
          el('h1.screen__title',{text:'Workout complete'}),
          el('p.summary-hero__date',{text:dateLabel(summary.session?.date)}),
        ]),
        el('section.card.summary-recap',{},[
          el('h2.block__title',{text:'Built today'}),
          el('div.stats',{},[
            stat(duration(summary.durationMinutes),'duration'),
            stat(String(summary.setsCompleted),'sets'),
            stat(String(summary.totalReps??0),'reps'),
            stat(volume(summary.totalVolume),'lbs moved'),
          ]),
        ]),
        prs.length>0&&el('section.card.summary-records',{dataset:{section:'prs'}},[
          el('span.summary-records__eyebrow',{text:'New personal record'}),
          ...prs.map((pr)=>el('div.pr',{},[
            el('span.badge',{text:pr.kind}),
            el('span.pr__detail',{text:`${pr.id.replace(/_/g,' ')} — ${pr.detail}`}),
          ])),
        ]),
        el('div.summary-legacy-hooks',{hidden:true,'aria-hidden':'true'},[
          el('span',{dataset:{section:'xp'}}),
          el('span.grew__why',{text:'Training recorded'}),
          el('span',{dataset:{section:'directive'}}),
        ]),
        el('div.summary-actions',{},[
          el('button.button.button--pill',{type:'button',dataset:{action:'done',acid:'primary'},onclick:onDone},['Done']),
        ]),
      ])
    },
  }
  function stat(value,label){
    return el('div.stat',{},[el('span.stat__value',{text:value}),el('span.stat__label',{text:label})])
  }
}
