/**
 * Seed data for `npm run seed` (SPEC.md section 11).
 *
 * This is the acceptance fixture: every string below is copied VERBATIM from
 * the two reference pages (reference/supplement-plan.html and
 * reference/lifting-plan.html). Do not "fix" wording, dashes (–), middle
 * dots (·) or the degree sign (°) — the app's default screens must reproduce
 * the reference pages from this data.
 *
 * Pure data only: no database access, no ids. scripts/seed.mjs assigns the
 * UUIDs and wires the foreign keys from the symbolic `key` fields.
 */

const EVERY = [0, 1, 2, 3, 4, 5, 6];

export function buildSeed() {
  return {
    /* ---------- meal slots (6 rows total; `bed` is shared between the
       default and the Friday two-meal variant) ---------- */
    mealSlots: [
      { key: 'breakfast', name: 'Breakfast', subtitle: 'Protein bar, honey and coffee', sortOrder: 0 },
      { key: 'lunch', name: 'First lunch', subtitle: null, sortOrder: 1 },
      { key: 'dinner', name: 'Dinner', subtitle: null, sortOrder: 2 },
      { key: 'dinner1', name: 'First dinner', subtitle: 'Two meals on Fridays', sortOrder: 3 },
      { key: 'dinner2', name: 'Second dinner', subtitle: null, sortOrder: 4 },
      { key: 'bed', name: 'Before bed', subtitle: null, sortOrder: 5 },
    ],

    /* ---------- day variants: Friday is a two-meal day ---------- */
    dayVariants: [{ day: 5, variant: 'two_meal', label: 'Two-meal day' }],

    /* ---------- supplements (facts text verbatim from the reference) ---------- */
    supplements: [
      {
        key: 'multi',
        name: 'Multivitamin',
        form: 'tablet',
        defaultDose: '1 tablet',
        color: '#B4385A',
        sortOrder: 0,
        ingredients: 'Zinc 15 mg · Vitamin B6 85 mg · Iron 11 mg',
        why: "Every other day keeps it off the zinc days and brings your B6 down to about 49 mg a day on average. Coffee lowers how much iron you absorb from it, so take it at least an hour away from your coffee.",
        watchFor:
          'Watch for: tingling or numbness in your hands or feet. If that happens, stop the multivitamin.',
      },
      {
        key: 'zinc',
        name: 'Zinc',
        form: 'chewable',
        defaultDose: '1 chewable',
        color: '#B85D12',
        sortOrder: 1,
        ingredients: 'Zinc 25 mg · Vitamin C 100 mg',
        why: 'It goes on the days you skip the multivitamin, so your pills give 15 or 25 mg of zinc a day instead of 40. Taking it with food makes it easier on your stomach. On Fridays it goes with the first dinner, to keep it hours away from the magnesium.',
        watchFor: null,
      },
      {
        key: 'omega',
        name: 'Omega-3',
        form: 'softgel',
        defaultDose: '1 softgel',
        color: '#2C5FC4',
        sortOrder: 2,
        ingredients: 'EPA 180 mg · DHA 120 mg',
        why: "It absorbs better with a meal that has some fat. Coffee doesn't affect it, so breakfast works too.",
        watchFor: null,
      },
      {
        // The reference draws ashwagandha as a plain round pill. The form enum
        // has no 'round', so it is seeded as 'other' and the glyph component
        // renders 'other' as the round pill (see QUESTIONS.md).
        key: 'ashwa',
        name: 'Ashwagandha',
        form: 'other',
        defaultDose: '1 tablet',
        color: '#38804A',
        sortOrder: 3,
        ingredients: 'Root extract 300 mg per tablet',
        why: "Its effect builds over weeks, so taking it every day matters more than the time. Splitting the dose matches how it's usually given in studies. If the morning tablet makes you drowsy at work, take both at dinner.",
        watchFor:
          'Breaks: use it for up to 3 months, then stop for a few weeks.\nWatch for: yellowing eyes or skin, or dark urine. If that happens, stop taking it. The label also says not to combine it with sedatives or anxiety medication.',
      },
      {
        key: 'crea',
        name: 'Creatine',
        form: 'scoop',
        defaultDose: '5 g',
        color: '#0A7C86',
        sortOrder: 4,
        ingredients: 'Creatine monohydrate 5 g · check how many grams your scoop holds',
        why: "It works by keeping your muscles topped up, so taking it every day, rest days included, matters more than the time. If you train in the evening, dinner comes right after your workout, which may help a little. You don't need a loading phase, since 5 g a day fills your muscles in about 3 to 4 weeks.",
        watchFor:
          "Expect: your weight may go up 1 to 2 kg over the first few weeks. That's water stored in your muscles, not fat.\nBlood tests: it can raise your creatinine, a number used to check your kidneys. Tell your doctor you take it before any blood work.",
      },
      {
        key: 'mag',
        name: 'Magnesium',
        form: 'capsule',
        defaultDose: '1 capsule',
        color: '#7450BF',
        sortOrder: 5,
        ingredients: 'Magnesium 200 mg per capsule, as buffered bisglycinate',
        why: 'One capsule keeps you under the 350 mg daily limit for supplements. Training raises your needs a little, so the second capsule goes on your gym days if your stomach handles it. Bedtime also keeps it hours away from the zinc.',
        watchFor: 'Watch for: loose stools. If they happen, go back to 1 capsule.',
      },
    ],

    /* ---------- schedule rules ----------
       variant null = default day; 'two_meal' = Friday.
       sortOrder is per slot and matches the reference item order. */
    scheduleRules: [
      // default: Breakfast
      { supplement: 'ashwa', slot: 'breakfast', days: EVERY, doseOverride: null, note: null, variant: null, sortOrder: 0 },
      // default: First lunch
      { supplement: 'omega', slot: 'lunch', days: EVERY, doseOverride: null, note: null, variant: null, sortOrder: 0 },
      { supplement: 'multi', slot: 'lunch', days: [0, 2, 4, 6], doseOverride: null, note: 'At least an hour away from coffee', variant: null, sortOrder: 1 },
      // default: Dinner
      { supplement: 'ashwa', slot: 'dinner', days: EVERY, doseOverride: null, note: null, variant: null, sortOrder: 0 },
      { supplement: 'crea', slot: 'dinner', days: EVERY, doseOverride: null, note: null, variant: null, sortOrder: 1 },
      { supplement: 'zinc', slot: 'dinner', days: [1, 3, 5], doseOverride: null, note: null, variant: null, sortOrder: 2 },
      // default: Before bed (magnesium doubles on gym days Thu–Sat)
      { supplement: 'mag', slot: 'bed', days: [0, 1, 2, 3], doseOverride: null, note: null, variant: null, sortOrder: 0 },
      { supplement: 'mag', slot: 'bed', days: [4, 5, 6], doseOverride: '2 capsules', note: 'Gym day dose', variant: null, sortOrder: 1 },
      // two_meal (Friday): First dinner
      { supplement: 'ashwa', slot: 'dinner1', days: EVERY, doseOverride: null, note: null, variant: 'two_meal', sortOrder: 0 },
      { supplement: 'omega', slot: 'dinner1', days: EVERY, doseOverride: null, note: null, variant: 'two_meal', sortOrder: 1 },
      { supplement: 'zinc', slot: 'dinner1', days: [1, 3, 5], doseOverride: null, note: 'Keeps it hours away from the magnesium', variant: 'two_meal', sortOrder: 2 },
      // The multivitamin's days don't include Friday, so this rule never shows
      // on the two-meal day — kept on purpose so the user can toggle days later
      // (SPEC 11.1).
      { supplement: 'multi', slot: 'dinner1', days: [0, 2, 4, 6], doseOverride: null, note: 'At least an hour away from coffee', variant: 'two_meal', sortOrder: 3 },
      // two_meal (Friday): Second dinner
      { supplement: 'ashwa', slot: 'dinner2', days: EVERY, doseOverride: null, note: null, variant: 'two_meal', sortOrder: 0 },
      { supplement: 'crea', slot: 'dinner2', days: EVERY, doseOverride: null, note: null, variant: 'two_meal', sortOrder: 1 },
      // two_meal (Friday): Before bed — Friday is a gym day
      { supplement: 'mag', slot: 'bed', days: [5], doseOverride: '2 capsules', note: 'Gym day dose', variant: 'two_meal', sortOrder: 0 },
    ],

    /* ---------- plan notes (supplement_settings.notes, markdown) ----------
       The "Daily amounts from pills" table, its two footnotes and the
       disclaimer, verbatim from the reference facts label. */
    supplementNotes: [
      '## Daily amounts from pills',
      '',
      '| Nutrient | Now | Limit |',
      '| --- | --- | --- |',
      '| Zinc | 15 or 25 mg — was 40 mg every day | 40 mg* |',
      '| Vitamin B6 | 49 mg a day on average — was 85 mg every day | 100 mg* |',
      '| Magnesium | 200 mg Sun–Wed, 400 mg Thu–Sat | 350 mg** |',
      '',
      '* Upper daily limit for adults in the US. The zinc limit includes food. Europe sets a lower B6 limit of 12 mg.',
      '',
      '** For magnesium from supplements only. The multivitamin adds 20 mg on its days. Going over mostly risks loose stools.',
      '',
      'Built from your bottle labels, except creatine, which uses the standard 5 g dose. This is general information, not medical advice, so check the plan with a pharmacist.',
    ].join('\n'),

    /* ---------- program (lifting reference) ---------- */
    program: {
      name: 'Thu–Sat Lifting Plan',
      description:
        'Three gym days in a row. Each day trains different muscles, so you can train back to back and recover Sunday to Wednesday.',
      isActive: true,
      restDayLabel: 'Walk',
      restDayNotes:
        'No gym · recover and stay active\nWalk 8,000–10,000 steps a day.\nSleep 7 hours or more. Muscle is built while you recover.',

      sessionRules: [
        { key: 'Warm up', text: '5 min easy on the bike, then 1–2 light sets of the first exercise.', sortOrder: 0 },
        { key: 'Effort', text: 'End each set with 1–2 good reps still in you.', sortOrder: 1 },
        { key: 'Tempo', text: 'Lift in about 1 second, lower in about 2.', sortOrder: 2 },
        { key: 'Progress', text: 'Hit the top of the rep range on every set, then add 2.5–5 kg the next week.', sortOrder: 3 },
      ],

      /* 16 exercises in order of appearance; cues are the two <li> texts
         joined with \n; views: side / front / top ("From above"). */
      exercises: [
        {
          key: 'chest-press',
          name: 'Chest press',
          mainMuscles: ['Chest'],
          helpingMuscles: ['Triceps'],
          view: 'side',
          cues: 'Set the seat so the handles line up with the middle of your chest.\nPush until your arms are almost straight, then lower for 2 seconds.',
          sortOrder: 0,
        },
        {
          key: 'incline-press',
          name: 'Incline chest press',
          mainMuscles: ['Upper chest'],
          helpingMuscles: ['Triceps'],
          view: 'side',
          cues: 'Handles start level with your upper chest.\nPress up and forward. Keep your shoulders down, away from your ears.',
          sortOrder: 1,
        },
        {
          key: 'shoulder-press',
          name: 'Shoulder press',
          mainMuscles: ['Shoulders'],
          helpingMuscles: ['Triceps'],
          view: 'side',
          cues: 'Start with the handles at chin height and your back flat on the pad.\nPress straight up and stop just before your elbows lock.',
          sortOrder: 2,
        },
        {
          key: 'cable-lateral-raise',
          name: 'Cable lateral raise',
          mainMuscles: ['Side shoulders'],
          helpingMuscles: [],
          view: 'front',
          cues: 'Set the pulley at the bottom, stand side-on to it and hold the handle with your far hand.\nLift your arm out to the side to shoulder height, lower slowly, then do the same reps with the other arm.',
          sortOrder: 3,
        },
        {
          key: 'triceps-pushdown',
          name: 'Triceps pushdown',
          mainMuscles: ['Triceps'],
          helpingMuscles: [],
          view: 'side',
          cues: 'Keep your elbows pinned to your sides the whole time.\nPush down until your arms are straight, then let your hands come back up to chest height.',
          sortOrder: 4,
        },
        {
          key: 'leg-press',
          name: 'Leg press',
          mainMuscles: ['Quads'],
          helpingMuscles: ['Glutes'],
          view: 'side',
          cues: "Feet shoulder-width apart in the middle of the platform.\nLower until your knees reach about 90°. Keep your lower back on the pad and don't lock your knees at the top.",
          sortOrder: 5,
        },
        {
          key: 'leg-curl',
          name: 'Seated leg curl',
          mainMuscles: ['Hamstrings'],
          helpingMuscles: ['Calves'],
          view: 'side',
          cues: 'Line your knees up with the pivot. The roller sits just above your heels.\nCurl as far as you can, pause, then let it rise slowly.',
          sortOrder: 6,
        },
        {
          key: 'leg-extension',
          name: 'Leg extension',
          mainMuscles: ['Quads'],
          helpingMuscles: [],
          view: 'side',
          cues: 'Knees in line with the pivot, pad on your lower shins.\nStraighten your legs fully and hold for 1 second at the top.',
          sortOrder: 7,
        },
        {
          key: 'hip-thrust',
          name: 'Hip thrust machine',
          mainMuscles: ['Glutes'],
          helpingMuscles: ['Hamstrings'],
          view: 'side',
          cues: 'Upper back on the pad, feet flat, shins vertical at the top.\nPush through your heels until your body is straight from shoulders to knees, then squeeze.',
          sortOrder: 8,
        },
        {
          key: 'calf-raise',
          name: 'Standing calf raise',
          mainMuscles: ['Calves'],
          helpingMuscles: [],
          view: 'side',
          cues: 'Balls of your feet on the edge, heels hanging off.\nDrop your heels for a stretch, then rise as high as you can and hold 1 second.',
          sortOrder: 9,
        },
        {
          key: 'ab-crunch',
          name: 'Ab crunch machine',
          mainMuscles: ['Abs'],
          helpingMuscles: [],
          view: 'side',
          cues: 'Sit tall and hold the handles lightly.\nCurl your chest toward your hips using your abs, not your arms. Breathe out as you crunch.',
          sortOrder: 10,
        },
        {
          key: 'lat-pulldown',
          name: 'Lat pulldown',
          mainMuscles: ['Lats'],
          helpingMuscles: ['Biceps'],
          view: 'front',
          cues: "Grip a little wider than your shoulders, thighs locked under the pads.\nPull the bar to your upper chest, driving your elbows down. Don't lean far back.",
          sortOrder: 11,
        },
        {
          key: 'seated-row',
          name: 'Seated row',
          mainMuscles: ['Mid back'],
          // One combined chip, exactly like the reference card renders it.
          helpingMuscles: ['Biceps, rear shoulders'],
          view: 'side',
          cues: 'Chest against the pad, arms straight to start.\nPull your elbows back and squeeze your shoulder blades together.',
          sortOrder: 12,
        },
        {
          key: 'rear-delt-fly',
          name: 'Rear-delt fly',
          mainMuscles: ['Rear shoulders'],
          helpingMuscles: ['Upper back'],
          view: 'top',
          cues: 'Chest on the pad, handles at shoulder height, arms almost straight.\nSweep your arms out and back until they line up with your body.',
          sortOrder: 13,
        },
        {
          key: 'biceps-curl',
          name: 'Biceps curl machine',
          mainMuscles: ['Biceps'],
          helpingMuscles: [],
          view: 'side',
          cues: 'Backs of your upper arms flat on the pad, elbows in line with the pivot.\nCurl up, squeeze, then lower all the way down slowly.',
          sortOrder: 14,
        },
        {
          key: 'straight-arm-pulldown',
          name: 'Straight-arm pulldown',
          mainMuscles: ['Lats'],
          helpingMuscles: ['Rear shoulders'],
          view: 'side',
          cues: 'Set the pulley at the top, hold a straight bar or rope, step back and lean forward a little.\nKeep your arms almost straight and pull the bar down to your thighs, then let it rise back to head height slowly.',
          sortOrder: 15,
        },
      ],

      /* Rest seconds: 2:30=150, 2:00=120, 1:30=90, 1:00=60.
         est_minutes is computed by the app (SPEC 7.2), never stored. */
      days: [
        {
          weekday: 4,
          name: 'Push',
          focus: 'chest, shoulders, triceps',
          sortOrder: 0,
          exercises: [
            { exercise: 'chest-press', sets: 4, repsMin: 8, repsMax: 10, restSeconds: 120, perSide: false, sortOrder: 0 },
            { exercise: 'incline-press', sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90, perSide: false, sortOrder: 1 },
            { exercise: 'shoulder-press', sets: 3, repsMin: 8, repsMax: 10, restSeconds: 120, perSide: false, sortOrder: 2 },
            { exercise: 'cable-lateral-raise', sets: 4, repsMin: 12, repsMax: 15, restSeconds: 60, perSide: true, sortOrder: 3 },
            { exercise: 'triceps-pushdown', sets: 3, repsMin: 10, repsMax: 12, restSeconds: 60, perSide: false, sortOrder: 4 },
          ],
        },
        {
          weekday: 5,
          name: 'Legs + core',
          focus: 'quads, hamstrings, glutes, calves, abs',
          sortOrder: 1,
          exercises: [
            { exercise: 'leg-press', sets: 4, repsMin: 8, repsMax: 10, restSeconds: 150, perSide: false, sortOrder: 0 },
            { exercise: 'leg-curl', sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90, perSide: false, sortOrder: 1 },
            { exercise: 'leg-extension', sets: 3, repsMin: 10, repsMax: 12, restSeconds: 90, perSide: false, sortOrder: 2 },
            { exercise: 'hip-thrust', sets: 3, repsMin: 8, repsMax: 12, restSeconds: 120, perSide: false, sortOrder: 3 },
            { exercise: 'calf-raise', sets: 4, repsMin: 10, repsMax: 15, restSeconds: 60, perSide: false, sortOrder: 4 },
            { exercise: 'ab-crunch', sets: 3, repsMin: 10, repsMax: 15, restSeconds: 60, perSide: false, sortOrder: 5 },
          ],
        },
        {
          weekday: 6,
          name: 'Pull',
          focus: 'back, rear shoulders, biceps',
          sortOrder: 2,
          exercises: [
            { exercise: 'lat-pulldown', sets: 4, repsMin: 8, repsMax: 10, restSeconds: 120, perSide: false, sortOrder: 0 },
            { exercise: 'seated-row', sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90, perSide: false, sortOrder: 1 },
            { exercise: 'rear-delt-fly', sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60, perSide: false, sortOrder: 2 },
            { exercise: 'biceps-curl', sets: 3, repsMin: 10, repsMax: 12, restSeconds: 60, perSide: false, sortOrder: 3 },
            { exercise: 'straight-arm-pulldown', sets: 3, repsMin: 12, repsMax: 15, restSeconds: 60, perSide: false, sortOrder: 4 },
          ],
        },
      ],
    },
  };
}
