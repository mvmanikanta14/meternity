// Common pregnancy test values and the usual reference ranges, used to flag results.
// These are general guidance only — labs and doctors may use slightly different cut-offs.

export const REPORT_TYPE_LABEL = {
  blood: { label: 'Blood test', emoji: '🩸' },
  ultrasound: { label: 'Ultrasound / scan', emoji: '🩻' },
  urine: { label: 'Urine test', emoji: '🧪' },
  other: { label: 'Other', emoji: '📄' },
}

const URINE_LEVELS = ['Nil', 'Trace', '1+', '2+', '3+']

const ok = (text = 'Normal') => ({ level: 'ok', text })
const low = (text) => ({ level: 'low', text })
const high = (text) => ({ level: 'high', text })

const urineCheck = (what, advice) => (v) =>
  URINE_LEVELS.indexOf(v) >= 2 ? high(`${what} found in urine. ${advice}`) : ok()

// TSH targets by trimester (mIU/L).
const TSH_RANGE = { 1: [0.1, 2.5], 2: [0.2, 3.0], 3: [0.3, 3.0] }

export const METRICS = [
  {
    key: 'hb',
    label: 'Hemoglobin (Hb)',
    unit: 'g/dL',
    type: 'blood',
    step: '0.1',
    range: (t) => `${t === 2 ? '10.5' : '11'} g/dL or more`,
    check: (v, t) => {
      if (v < 7) return low('Very low hemoglobin (severe anaemia). Please see your doctor soon.')
      if (v < (t === 2 ? 10.5 : 11))
        return low('Low hemoglobin (anaemia). Eat iron-rich foods and ask your doctor about iron tablets.')
      return ok()
    },
  },
  {
    key: 'fbs',
    label: 'Fasting blood sugar',
    unit: 'mg/dL',
    type: 'blood',
    range: () => 'below 92 mg/dL',
    check: (v) =>
      v >= 92 ? high('Fasting sugar is high — this can be a sign of gestational diabetes. Ask your doctor.') : ok(),
  },
  {
    key: 'ogtt',
    label: 'Sugar 2 hrs after glucose / meal',
    unit: 'mg/dL',
    type: 'blood',
    range: () => 'below 140 mg/dL',
    check: (v) =>
      v >= 140 ? high('2-hour sugar is high — this can be a sign of gestational diabetes. Ask your doctor.') : ok(),
  },
  {
    key: 'tsh',
    label: 'TSH (thyroid)',
    unit: 'mIU/L',
    type: 'blood',
    step: '0.01',
    range: (t) => `${TSH_RANGE[t][0]}–${TSH_RANGE[t][1]} mIU/L`,
    check: (v, t) => {
      const [min, max] = TSH_RANGE[t]
      if (v > max) return high('TSH is above the pregnancy range (underactive thyroid). Your doctor may adjust treatment.')
      if (v < min) return low('TSH is below the pregnancy range (overactive thyroid). Please discuss with your doctor.')
      return ok()
    },
  },
  {
    key: 'platelets',
    label: 'Platelets',
    unit: 'lakh/µL',
    type: 'blood',
    step: '0.01',
    range: () => '1.5–4.5 lakh/µL',
    check: (v) => (v < 1.5 ? low('Platelet count is low. Please show this report to your doctor.') : v > 4.5 ? high('Platelet count is high. Please show this report to your doctor.') : ok()),
  },
  {
    key: 'urine_protein',
    label: 'Urine protein (albumin)',
    type: 'urine',
    options: URINE_LEVELS,
    range: () => 'Nil or trace',
    check: urineCheck('Protein', 'Check your BP and tell your doctor — it can be a sign of pre-eclampsia.'),
  },
  {
    key: 'urine_sugar',
    label: 'Urine sugar',
    type: 'urine',
    options: URINE_LEVELS,
    range: () => 'Nil or trace',
    check: urineCheck('Sugar', 'Your doctor may suggest a blood sugar test.'),
  },
  {
    key: 'fhr',
    label: "Baby's heart rate (FHR)",
    unit: 'bpm',
    type: 'ultrasound',
    range: () => '110–160 bpm',
    check: (v) => (v < 110 ? low("Baby's heart rate is below the usual range. Please talk to your doctor.") : v > 160 ? high("Baby's heart rate is above the usual range. Please talk to your doctor.") : ok()),
  },
  {
    key: 'afi',
    label: 'Amniotic fluid (AFI)',
    unit: 'cm',
    type: 'ultrasound',
    step: '0.1',
    range: () => '5–24 cm',
    check: (v) => (v < 5 ? low('Amniotic fluid is low. Drink plenty of water and follow your doctor’s advice.') : v > 24 ? high('Amniotic fluid is high. Your doctor may want to check more closely.') : ok()),
  },
  {
    key: 'efw',
    label: 'Baby weight (EFW)',
    unit: 'g',
    type: 'ultrasound',
    range: () => 'see the week guide',
    check: () => ({ level: 'info', text: 'Noted' }),
  },
]

export const metricsFor = (type) => (type === 'other' ? METRICS : METRICS.filter((m) => m.type === type))

export const metricByKey = Object.fromEntries(METRICS.map((m) => [m.key, m]))

export const trimesterOf = (week) => (week <= 13 ? 1 : week <= 27 ? 2 : 3)

export function analyse(key, value, week) {
  const m = metricByKey[key]
  if (!m || value === undefined || value === null || value === '') return null
  const t = trimesterOf(week || 20)
  const result = m.check(value, t)
  return { ...result, metric: m, value, range: m.range(t) }
}
