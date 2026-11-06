/**
 * A compact, evidence-first full-history prompt. Keep all of the structured
 * observations: changing the text layout must never drop training/nutrition data.
 */
export function formatProgressIntelligencePrompt(report) {
  const lines=[
    'LFMS PROGRESS INTELLIGENCE | '+report.today,
    'Respond in COMPACT PLAIN MARKDOWN with minimal vertical whitespace. No cards, icons, charts, giant headings, separate one-sentence paragraphs, decorative callouts, or blank lines between list items. Use tight tables and short paragraphs, with at most one blank line between major sections. Be specific, not motivational filler; roughly 900–1300 words unless the evidence demands more.',
    'Evidence rules: Cite dates, numbers, sample sizes, comparison windows and confidence (high/medium/low). Do not invent missing logs or diagnose health conditions. Missing/unchecked is unknown, not zero or proof of skipping. Distinguish closed nutrition days from partial logs and observed intake from true consumption. Use averages/trends rather than individual daily weight spikes; consider creatine-related water retention and strength-method differences.',
    'A. EXECUTIVE READ: 5–6 compact sentences on fat loss, strength, adherence, and one high-impact change.',
    'B. KEY INSIGHTS: Rank 5–7 findings by impact. For each give evidence, confidence, and one action.',
    'C. WEIGHT + NUTRITION: One compact 7/14/30/90-day comparison table with weight sample counts, first/last/average weight, defensible lb/week trend, logged vs closed calorie means and counts, protein, targets and prior-period comparison. Flag missing logs, weekend effects, and incompatible coverage.',
    'D. CALORIE TARGET DECISION: KEEP, CONSIDER SMALL ADJUSTMENT, or INSUFFICIENT DATA. Explain with longitudinal weight and closed-day calorie evidence. Do not invent TDEE or aggressively restrict. Only consider ~100–200 kcal/day change after a persistent multiweek stall with sufficient data; give a 14-day recheck trigger.',
    'E. LIFT-BY-LIFT AUDIT: A compact table of priority stalled/declining lifts (name, method, recent dates/sets, last 3 vs prior 3 estimates where reliable, suggested change); include notable improvements. Be skeptical of calculated plateaus: inspect actual sets including reps above 12, avoid treating skipped e1RM estimates as declines, and do not compare different equipment methods as identical lifts. Distinguish undertrained, uncertain and truly stalled exercises.',
    'F. CREATINE + SUPPLEMENTS + HABITS: Report separate confirmed checkoff counts/eligible days and percentages over 7/14/30/90 days. Tracking launched 2026-11-04; earlier dates cannot be misses; checkboxes show logging, not necessarily ingestion. Include one low-friction routine.',
    'G. RECOVERY + MOVEMENT: Compare training volume/frequency, sleep, water, steps and cardio against prior periods, accounting for missing health sync and travel. Include the latest graded training score, weighted components and ungraded/away weeks from trainingScore. Do not infer a medical issue from sparse HR/HRV/respiratory readings. Note waist-measurement and fiber limitations.',
    'H. NEXT 14 DAYS: At most five prioritized, measurable actions and a clear DO NOT CHANGE YET recommendation. Do not silently alter saved calories, training plans, habits or user data.',
    'DATA (complete local observations, training sets and trends; compact JSON):',
  ];
  return lines.join('\n')+'\n'+JSON.stringify(report);
}
