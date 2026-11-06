/**
 * ChatGPT-ready analysis request: every relevant local observation is in the
 * companion JSON. All recommendations are evidence-first and read-only.
 */
export function formatProgressIntelligencePrompt(report) {
  const instructions=[
    '# LFMS — Comprehensive Progress Intelligence Review',
    '',
    'You are reviewing longitudinal Less Fat More Strong self-tracking data. Give practical, specific, ranked recommendations from the evidence below, not a generic motivational summary.',
    '',
    '## Rules of evidence',
    '- This is not a diagnosis or a laboratory metabolism test. Do not invent missing days, calories, exercise loads, supplementation, intensity or recovery data. Missing/null is unknown, not zero or a failed habit.',
    '- Every important conclusion should cite numeric values, dates, sample counts, comparison windows, and confidence (high/medium/low). Distinguish training change from random day-to-day variance.',
    '- Calorie logging is not complete consumption. Compare all logged days with explicit closed nutrition days and give counts for each; even closed days may contain omissions. Do not equate a 0 kcal day with a fast unless specifically recorded.',
    '- Distinguish a true weight trend from water-weight fluctuations and temporary creatine-related changes. Use repeated weigh-ins, 7-day average vs preceding 7-day average when adequately sampled, plus 14/30/90 day slopes and waist/body-measurement trends. State if data coverage is too sparse.',
    '- The export includes ALL locally stored daily observations and completed training sessions; summary windows cover 7, 14, 30 and 90 days plus matching previous periods. Consider the longer history when available.',
    '',
    '## Specific questions to answer',
    '1. FAT LOSS & ENERGY BALANCE: What actually happened to body weight over 7/14/30/90 days? How many readings support each conclusion? How does that compare with calories logged, protein, steps and resistance-training exposure? Are there gaps or weekend effects?',
    '2. CALORIE TARGET DECISION: Identify the actual current target and achieved intake. Choose KEEP, CONSIDER SMALL ADJUSTMENT, or INSUFFICIENT DATA, explaining why. Make no change based on one noisy week. A modest 100-200 kcal/day adjustment may be considered only for a persistent multiweek stall with adequate nutrition logging and weigh-ins. Do not invent TDEE or recommend aggressive restriction; give an explicit 1-2 week recheck condition.',
    '3. LIFT-BY-LIFT AUDIT: Review each meaningful exercise. Show the exercise name and method, sessions and dates, last 3 vs preceding 3 comparable best-set/e1RM readings where available, workout volume and frequency. Distinguish improving, declining, potentially flat, absent from recent training and insufficient data. Recommend targeted rep-range, load increment, volume, recovery, deload or substitution changes only where supported. Do not compare cables and barbell variants as identical strength tests; e1RM is estimated and high-rep estimates are unstable.',
    '4. HABIT CONSISTENCY: Evaluate creatine and other supplements SEPARATELY, alongside the other enabled daily habits. Report checked days / eligible days over 7/14/30/90 days with percentages and data coverage. These two checkboxes launched 2026-11-04. Earlier dates do not count as missed; unchecked means not confirmed, not necessarily untaken. Suggest a low-friction reminder/stacking method without shaming.',
    '5. RECOVERY & SUSTAINABILITY: Examine sessions, working sets, recent vs prior training volume, steps, sleep, water, rest days, cardio, heart rate/HRV/respiratory rate only when actually measured, and current program and marked travel/away periods. Avoid clinical conclusions from health readings.',
    '6. OTHER LEVERS: Use available waist and other measurements, fiber/protein distribution, meal patterns and actual progress to spot additional practical improvements. Note conflicts (e.g., weight loss alongside multiple declining lifts) and probable explanations cautiously.',
    '',
    '## Required answer structure',
    'A. EXECUTIVE READ (5-8 crisp sentences): what is working, what is stuck, and the single most important change or missing input.',
    'B. KEY INSIGHTS: top 5-8 findings ranked by impact with evidence (dates/numbers/samples), confidence and suggested action.',
    'C. WEIGHT + NUTRITION TABLE: columns 7/14/30/90 days; number of weigh-ins, first/last and average weight, trend lb/week if defensible, calories on logged and closed days, sample counts, protein, stored targets, and prior-period comparison. Explain why missing data limits claims.',
    'D. CALORIE DECISION: KEEP / CONSIDER SMALL ADJUSTMENT / INSUFFICIENT DATA, a conservative reason, and the trigger for revisiting within 14 days.',
    'E. LIFT AUDIT: ranked watchlist of flat/declining or untrained lifts; training changes tied to actual sets/reps/loads, and a short list of notable improvements.',
    'F. CREATINE, SUPPLEMENTS + HABITS: checkoff percentages, tracking-start caveat, and easy habit systems.',
    'G. RECOVERY + DAILY ACTIVITY: findings supported by samples, not diagnoses.',
    'H. NEXT 14 DAYS: no more than 5 prioritized actions, with a metric to watch and success threshold. Include DO NOT CHANGE YET. Ask at most 3 essential follow-ups if critical facts are not available.',
    '',
    'This is an analysis for a user to review; DO NOT silently alter calorie targets, programs, habits, or saved app data.',
    '',
    '## LFMS_PROGRESS_INTELLIGENCE_V1 structured data (JSON)',
  ]
  return instructions.join('\n')+'\n'+JSON.stringify(report)
}
