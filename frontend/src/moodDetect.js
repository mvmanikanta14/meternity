// Guesses the mood from what she says or types, in English, Telugu script or
// Telugu written in English letters ("naku tension ga undi"). Word lists only — no server.

// Stems match the start of a word, so "bhayam" also matches "bhayamga", "bhayamesthundi".
const WORDS = {
  sad: [
    'sad', 'low', 'down', 'cry', 'crying', 'cried', 'upset', 'lonely', 'alone', 'depress', 'hurt', 'unhappy',
    'hopeless', 'miss', 'heartbroken',
    'baadha', 'badha', 'bada ga', 'edupu', 'edust', 'edcha', 'edchesa', 'dukham', 'dhukham', 'ontari', 'nachatledu',
    'nachaledu', 'bagaledu', 'baagaledu', 'baledu', 'baaledu', 'manasu bagaledu', 'kannilu', 'kanneellu',
    'బాధ', 'ఏడుపు', 'ఏడుస్త', 'ఏడ్చ', 'దుఃఖ', 'ఒంటరి', 'బాగాలేదు', 'బాలేదు', 'నచ్చట్లేదు', 'కన్నీళ్లు',
  ],
  anxious: [
    'worri', 'worry', 'tension', 'tense', 'scared', 'afraid', 'fear', 'nervous', 'anxious', 'anxiety', 'panic',
    'stress', 'angry', 'anger', 'irritat', 'frustrat', 'mood swing',
    'bhayam', 'bayam', 'bhayamg', 'kangaru', 'kangaaru', 'chiraku', 'kopam', 'kopamg', 'aandolana', 'andolana',
    'digulu', 'dhigulu', 'bhayapad',
    'భయ', 'టెన్షన్', 'కంగారు', 'చిరాకు', 'కోపం', 'కోపంగా', 'ఆందోళన', 'దిగులు',
  ],
  tired: [
    'tired', 'exhaust', 'sleepy', 'weak', 'fatigue', 'no energy', 'drained', 'sleepless', 'cant sleep', "can't sleep",
    'alasata', 'alasipo', 'alasat', 'neerasam', 'nirasam', 'neerasang', 'nidra', 'opika ledu', 'opika', 'shakti ledu',
    'అలసట', 'అలసిపో', 'నీరసం', 'నిద్ర', 'ఓపిక',
  ],
  sick: [
    'nausea', 'nauseous', 'vomit', 'puke', 'sick', 'dizzy', 'headache', 'pain', 'unwell', 'fever', 'acidity',
    'heartburn', 'cramp',
    'vanthi', 'vanthul', 'vamtul', 'vaanthi', 'vomiting', 'vikaram', 'okkaram', 'kallu tirug', 'tala noppi',
    'talanoppi', 'noppi', 'jwaram', 'gas ga',
    'వాంతి', 'వాంతులు', 'వికారం', 'తలనొప్పి', 'నొప్పి', 'జ్వరం', 'కళ్ళు తిరుగ',
  ],
  happy: [
    'happy', 'good', 'great', 'excited', 'joy', 'awesome', 'love', 'wonderful', 'blessed', 'amazing', 'super',
    'santhosh', 'santosh', 'anandam', 'aanandam', 'bagundi', 'baagundi', 'baagunna', 'bagunna', 'kushi', 'khushi',
    'సంతోష', 'ఆనంద', 'బాగుంది', 'ఖుషి',
  ],
  calm: [
    'calm', 'relax', 'peace', 'okay', 'ok', 'fine', 'rested', 'chill', 'normal',
    'prashant', 'prasant', 'haayiga', 'hayiga', 'parledu', 'parvaledu',
    'ప్రశాంత', 'హాయిగా', 'పర్లేదు', 'పర్వాలేదు',
  ],
}

// "not happy", "happy ga ledu", "bagaledu" — a good word next to a "no" word means she is low.
const NEGATIONS = ['not', 'no', "don't", 'dont', 'never', 'isnt', "isn't", 'ledu', 'ledhu', 'kaadu', 'kadu', 'లేదు', 'కాదు', 'లేను']

// When two moods tie, the one that needs more care wins.
const PRIORITY = ['sad', 'anxious', 'sick', 'tired', 'calm', 'happy']

const tokenize = (text) => text.toLowerCase().match(/[\p{L}\p{M}']+/gu) || []

function wordMatches(token, stem) {
  // Short English words must match whole ("low" not "lower"); Telugu-script stems are short but always prefixes.
  if (stem.length <= 3 && /^[a-z']+$/.test(stem)) return token === stem || token === `${stem}s`
  return token.startsWith(stem)
}

export function detectMood(text) {
  const tokens = tokenize(text || '')
  if (!tokens.length) return null
  const joined = ` ${tokens.join(' ')} `
  const scores = Object.fromEntries(PRIORITY.map((m) => [m, 0]))
  const found = []

  for (const [mood, stems] of Object.entries(WORDS)) {
    for (const stem of stems) {
      if (stem.includes(' ')) {
        if (joined.includes(` ${stem}`)) {
          scores[mood] += 1.5
          found.push(stem)
        }
        continue
      }
      tokens.forEach((token, i) => {
        if (!wordMatches(token, stem)) return
        const near = [tokens[i - 1], tokens[i - 2], tokens[i + 1], tokens[i + 2]]
        const negated = near.some((t) => t && NEGATIONS.includes(t))
        if (negated && (mood === 'happy' || mood === 'calm')) {
          scores.sad += 1
          found.push(`${stem} (not)`)
        } else if (!negated || mood !== 'sad') {
          scores[mood] += 1
          found.push(token)
        }
      })
    }
  }

  const best = PRIORITY.reduce((a, b) => (scores[b] > scores[a] ? b : a))
  if (scores[best] === 0) return null
  return { mood: best, words: [...new Set(found)].slice(0, 6) }
}
