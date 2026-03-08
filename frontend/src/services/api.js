import axios from 'axios'
import { getAWSConfig, getAuthHeaders } from '../config/aws.js'

const getClient = () => {
  const config = getAWSConfig()
  const baseURL = config.apiGatewayUrl || '/api'
  
  return axios.create({
    baseURL,
    timeout: 120000,
    headers: getAuthHeaders(),
  })
}

// ─── Ingestion APIs ──────────────────────────────────────────

export const ingestURL = async (url) => {
  const client = getClient()
  const response = await client.post('/ingest/url', { url })
  return response.data
}

export const ingestPDF = async (s3Key) => {
  const client = getClient()
  const response = await client.post('/ingest/pdf', { s3_key: s3Key })
  return response.data
}

export const ingestYoutube = async (videoUrl) => {
  const client = getClient()
  const response = await client.post('/ingest/youtube', { url: videoUrl })
  return response.data
}

// ─── Analysis API ────────────────────────────────────────────

export const analyzeContent = async (extractedText, options = {}) => {
  const client = getClient()
  const response = await client.post('/analyze', {
    text: extractedText,
    target_audience: options.targetAudience || 'general',
    tone: options.tone || 'balanced',
  })
  return response.data
}

// ─── Upload to S3 ────────────────────────────────────────────

export const getS3UploadUrl = async (filename, contentType) => {
  const client = getClient()
  const response = await client.post('/upload/presign', {
    filename,
    content_type: contentType,
  })
  return response.data
}

export const uploadFileToS3 = async (file, onProgress) => {
  const { upload_url, s3_key } = await getS3UploadUrl(file.name, file.type)
  
  await axios.put(upload_url, file, {
    headers: { 'Content-Type': file.type },
    onUploadProgress: (evt) => {
      if (onProgress) onProgress(Math.round((evt.loaded * 100) / evt.total))
    }
  })
  
  return s3_key
}

// ─── Transform / Generation APIs ─────────────────────────────

export const generateComic = async (payload) => {
  const client = getClient()
  const response = await client.post('/transform/comic', {
    script: payload.script,
    orientation: payload.orientation || 'square',
    art_style: payload.artStyle || 'anime',
    brand_tone: payload.brandTone || 5,
    character_description: payload.characterDescription || '',
    frames: payload.frames || 10,
  })
  return response.data
}

export const generateMeme = async (payload) => {
  const client = getClient()
  const response = await client.post('/transform/meme', {
    content_analysis: payload.contentAnalysis,
    platform: payload.platform || 'twitter',
    tone: payload.tone || 'humorous',
    brand_persona: payload.brandPersona || 'GenZ',
    count: payload.count || 3,
  })
  return response.data
}

export const generateInfographic = async (payload) => {
  const client = getClient()
  const response = await client.post('/transform/infographic', {
    data_points: payload.dataPoints,
    key_themes: payload.keyThemes,
    sentiment: payload.sentiment || 'professional',
    word_limit: payload.wordLimit || 500,
    dimensions: payload.dimensions || '1080x1080',
    platform: payload.platform || 'linkedin',
  })
  return response.data
}

// ─── Schedule / Distribution ──────────────────────────────────

export const getScheduleSuggestions = async (assets) => {
  const client = getClient()
  const response = await client.post('/schedule/suggest', { assets })
  return response.data
}

export const schedulePost = async (scheduleItem) => {
  const client = getClient()
  const response = await client.post('/schedule/create', scheduleItem)
  return response.data
}

export const getSchedule = async () => {
  const client = getClient()
  const response = await client.get('/schedule')
  return response.data
}

export const postToTwitter = async (content, imageUrl) => {
  const client = getClient()
  const response = await client.post('/distribute/twitter', {
    text: content,
    image_url: imageUrl,
  })
  return response.data
}

// ─── Health Check ─────────────────────────────────────────────

export const healthCheck = async () => {
  const client = getClient()
  try {
    const response = await client.get('/health')
    return { ok: true, data: response.data }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// ─── Dynamic mock generators for demo/offline mode ────────────────

/**
 * Extract a readable title/topic from a URL or raw text.
 * Ignores filenames like "Instruction.pdf" and uses actual content instead.
 */
function _extractTopicFromInput(source = '', rawText = '') {
  // If source is a filename (not a URL), skip it and use rawText
  const isFilename = /^[^/\\]+\.(pdf|docx?|txt|pptx?|csv)$/i.test(source)

  if (!isFilename && source.startsWith('http')) {
    try {
      const url = new URL(source)
      const segments = url.pathname.split('/').filter(Boolean)
      const last = segments[segments.length - 1] || url.hostname
      const slug = last
        .replace(/\.(html?|php|aspx?|pdf)$/i, '')
        .replace(/[-_]/g, ' ')
        .trim()
      if (slug.length > 3 && !/^\d+$/.test(slug)) return slug
      return url.hostname.replace(/^www\./i, '').split('.')[0]
    } catch {}
  }

  // Extract topic from actual text content
  const stopWords = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'is','was','are','were','be','been','being','have','has','had','do',
    'does','did','will','would','could','should','may','might','this','that',
    'these','those','it','its','from','by','as','we','our','your','their',
    'about','which','when','who','how','what','also','into','more','than',
    'other','some','such','after','before','between','through','during',
  ])
  const wordFreqs = {}
  rawText
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .forEach(w => {
      if (w.length > 4 && !stopWords.has(w)) {
        wordFreqs[w] = (wordFreqs[w] || 0) + 1
      }
    })
  const top = Object.entries(wordFreqs)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([w]) => w)

  return top.join(' ') || 'content insights'
}

/**
 * Generate context-aware analysis from the user's actual input.
 */
export function generateMockAnalysis(source = '', rawText = '', audience = [], tone = []) {
  const topic = _extractTopicFromInput(source, rawText)
  const topicTitle = topic.charAt(0).toUpperCase() + topic.slice(1)

  const stopWords = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'is','was','are','were','be','been','being','have','has','had','do',
    'does','did','will','would','could','should','may','might','this','that',
    'these','those','it','its',
  ])
  const wordFreqs = {}
  rawText
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .forEach(w => {
      if (w.length > 4 && !stopWords.has(w)) wordFreqs[w] = (wordFreqs[w] || 0) + 1
    })
  const topWords = Object.entries(wordFreqs)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([w]) => w)

  const themes =
    topWords.length >= 4
      ? topWords.slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1))
      : [
          `${topicTitle} Overview`,
          'Key Insights',
          'Impact & Trends',
          'Future Outlook',
        ]

  const sentences = rawText
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 40)

  const quotables =
    sentences.length >= 3
      ? sentences.slice(0, 5).map(s => s.slice(0, 150) + (s.length > 150 ? '...' : ''))
      : [
          `Understanding ${topicTitle} is essential for staying ahead in today's landscape.`,
          `The core principles of ${topicTitle} have far-reaching implications across industries.`,
          `Experts agree: ${topicTitle} is reshaping the way we think about the future.`,
          `The impact of ${topicTitle} continues to grow as adoption accelerates globally.`,
          `Organizations that embrace ${topicTitle} early gain a significant competitive advantage.`,
        ]

  const stats = []
  const numRegex = /(\d[\d,]*\.?\d*)\s*(%|percent|x|times|million|billion|k\b)/gi
  let match
  while ((match = numRegex.exec(rawText)) !== null && stats.length < 3) {
    const context = rawText.slice(Math.max(0, match.index - 30), match.index + 20).trim()
    stats.push({ label: context.slice(0, 25), value: match[1] + match[2] })
  }
  if (stats.length === 0) {
    stats.push(
      { label: `${topicTitle} Growth`, value: '3x' },
      { label: 'Audience Reach', value: '1M+' },
      { label: 'Engagement Rate', value: '12%' },
    )
  }

  const summary =
    sentences.length > 0
      ? sentences.slice(0, 3).join('. ') + '.'
      : `This content covers the key aspects of ${topicTitle}, exploring its impact, trends, and future implications for ${audience.join(', ') || 'a broad audience'}.`

  const isHumorous =
    tone.includes('Humorous') || tone.includes('Sarcastic') || tone.includes('Casual')

  return {
    key_themes: themes,
    quotable_moments: quotables,
    statistics: stats.slice(0, 3),
    sentiment: 0.68,
    humor_score: isHumorous ? 0.72 : 0.28,
    summary,
    core_conflict: `The challenge of understanding and applying ${topicTitle} in a rapidly changing world.`,
    target_emotion: isHumorous ? 'amusement' : 'curiosity',
    meme_potential: `The ironic gap between what people expect from ${topicTitle} and what it actually delivers.`,
    comic_storyline: `Setup: A character encounters ${topicTitle} for the first time. Conflict: They struggle to grasp its implications. Resolution: They discover a key insight that changes their perspective.`,
  }
}

/**
 * Curated picsum photo IDs grouped by visual mood.
 * These IDs are verified to work reliably with picsum.photos/id/{id}/WxH
 */
const PICSUM_SETS = {
  discovery: [15, 42, 67, 119, 137, 160, 180, 210],
  research:  [20, 48, 96, 110, 145, 170, 195, 220],
  challenge: [25, 55, 88, 125, 150, 175, 200, 230],
  success:   [30, 60, 100, 130, 155, 185, 215, 240],
  action:    [35, 65, 105, 135, 162, 190, 218, 245],
  team:      [38, 70, 108, 140, 165, 193, 222, 250],
  journey:   [40, 75, 112, 143, 168, 196, 225, 255],
  clarity:   [44, 80, 115, 147, 172, 199, 228, 260],
}

const PANEL_MOODS = [
  'discovery', 'challenge', 'research', 'success',
  'action', 'team', 'challenge', 'success',
  'team', 'journey', 'action', 'clarity',
]

const MEME_MOODS = ['discovery', 'challenge', 'success', 'clarity', 'action']

function _getPicsumId(theme = '', moodKey = 'discovery', index = 0) {
  const set = PICSUM_SETS[moodKey] || PICSUM_SETS.discovery
  const themeHash = theme.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return set[(themeHash + index) % set.length]
}

/**
 * Generate comic frames with working images and topic-relevant captions.
 */
export function generateMockComicFrames(analysis, count = 4) {
  const themes = analysis?.key_themes || ['the topic', 'key ideas', 'insights', 'the conclusion']
  const quotes = analysis?.quotable_moments || []
  const topic = themes[0] || 'this topic'

  const frameTemplates = [
    { caption: `Our hero first encounters ${topic}...`,                                   dialogue: quotes[0]?.slice(0, 80) || 'Wait — this changes everything!' },
    { caption: `The challenge of ${themes[1] || 'understanding'} becomes clear`,          dialogue: 'How do we even begin to tackle this?' },
    { caption: `Diving deep into ${themes[2] || 'the details'}`,                          dialogue: quotes[1]?.slice(0, 80) || "The data doesn't lie." },
    { caption: `A breakthrough moment with ${themes[3 % themes.length] || 'insight'}`,    dialogue: '💡 Now it all makes sense!' },
    { caption: `Applying ${topic} in the real world`,                                      dialogue: 'This is actually simpler than I thought!' },
    { caption: `The community rallies around ${themes[1 % themes.length] || 'the idea'}`, dialogue: 'Together we can make this work.' },
    { caption: `Obstacles arise — but ${themes[2 % themes.length] || 'perseverance'} wins`, dialogue: quotes[2]?.slice(0, 80) || 'Never give up.' },
    { caption: `The transformation is complete`,                                            dialogue: '✨ Mission accomplished!' },
    { caption: `Sharing the knowledge of ${topic} with others`,                            dialogue: 'You need to hear this.' },
    { caption: `The journey with ${topic} continues...`,                                   dialogue: quotes[3]?.slice(0, 80) || 'More to explore ahead.' },
    { caption: `New horizons — ${themes[0] || 'fresh ideas'} await`,                      dialogue: 'What comes next?' },
    { caption: `The final revelation about ${topic}`,                                      dialogue: 'This was the key all along.' },
  ]

  return Array.from({ length: Math.min(count, 12) }, (_, i) => {
    const tpl = frameTemplates[i % frameTemplates.length]
    const moodKey = PANEL_MOODS[i % PANEL_MOODS.length]
    const picsumId = _getPicsumId(themes[0], moodKey, i)
    return {
      panel_number: i + 1,
      image_url: `https://picsum.photos/id/${picsumId}/300/300`,
      caption: tpl.caption,
      dialogue: tpl.dialogue,
    }
  })
}

/**
 * Generate memes with working images and topic-relevant text.
 */
export function generateMockMemes(analysis, count = 3) {
  const themes = analysis?.key_themes || ['the topic']
  const quotes = analysis?.quotable_moments || []

  const templates = [
    {
      top_text: `EVERYONE TALKING ABOUT ${(themes[0] || 'IT').toUpperCase()}`,
      bottom_text: `ME ACTUALLY UNDERSTANDING IT`,
    },
    {
      top_text: `BEFORE READING ABOUT ${(themes[1] || themes[0] || 'THIS').toUpperCase()}`,
      bottom_text: `AFTER READING ABOUT IT`,
    },
    {
      top_text: quotes[0]
        ? `"${quotes[0].slice(0, 50).toUpperCase()}"`
        : `THE STRUGGLE WITH ${(themes[0] || 'IT').toUpperCase()} IS REAL`,
      bottom_text: `— EVERYONE IN THIS FIELD`,
    },
    {
      top_text: `WHEN SOMEONE SAYS ${(themes[2] || themes[0] || 'THIS').toUpperCase()} IS EASY`,
      bottom_text: `HAVE YOU MET ${(themes[1] || 'REALITY').toUpperCase()}??`,
    },
    {
      top_text: `${(themes[0] || 'IT').toUpperCase()} EXPERTS BE LIKE`,
      bottom_text: quotes[1]
        ? `"${quotes[1].slice(0, 50).toUpperCase()}"`
        : `"IT'S ACTUALLY QUITE SIMPLE"`,
    },
  ]

  return Array.from({ length: Math.min(count, 5) }, (_, i) => {
    const tpl = templates[i % templates.length]
    const moodKey = MEME_MOODS[i % MEME_MOODS.length]
    const picsumId = _getPicsumId(themes[0], moodKey, i + 50)
    return {
      id: i + 1,
      image_url: `https://picsum.photos/id/${picsumId}/400/400`,
      top_text: tpl.top_text,
      bottom_text: tpl.bottom_text,
    }
  })
}

/**
 * Generate a rich infographic / LinkedIn post with expanded word limit.
 */
export function generateMockInfographic(analysis, wordLimit = 500) {
  const themes = analysis?.key_themes || ['Key Topic']
  const quotes = analysis?.quotable_moments || []
  const stats = analysis?.statistics || []
  const summary = analysis?.summary || ''
  const topicTitle = themes[0] || 'Key Insights'

  const hook = `🔑 ${quotes[0]?.slice(0, 150) || `Everything you need to know about ${topicTitle}`}`
  const title = `${topicTitle}: Key Insights & Takeaways`

  // Rich bullets — each theme gets a stat and a supporting quote if available
  const bullets = themes
    .map((t, i) => {
      const stat = stats[i]
      const quote = quotes[i + 1]
      let line = stat
        ? `• **${t}** — ${stat.value} ${stat.label}.`
        : `• **${t}** — A critical factor reshaping how we think and operate today.`
      if (quote) line += ` "${quote.slice(0, 120)}"`
      return line
    })
    .join('\n')

  // Additional insight paragraphs from remaining quotes
  const extraInsights = quotes
    .slice(themes.length + 1)
    .map(q => `💡 ${q.slice(0, 200)}`)
    .join('\n\n')

  const fullBody = [
    summary,
    '',
    '📌 Key Takeaways:',
    bullets,
    extraInsights ? '\n🔍 Deep Dive:' : '',
    extraInsights,
  ]
    .filter(Boolean)
    .join('\n')

  // Trim to word limit
  const words = fullBody.split(/\s+/)
  const body =
    words.slice(0, wordLimit).join(' ') + (words.length > wordLimit ? '...' : '')

  const hashtags = themes.map(t => `#${t.replace(/\s+/g, '')}`)
  hashtags.push('#ContentMarketing', '#Insights', '#AI', '#LinkedIn')

  const picsumId = _getPicsumId(topicTitle, 'clarity', 0)

  return {
    image_url: `https://picsum.photos/id/${picsumId}/1080/1080`,
    content: {
      hook,
      title,
      body,
      cta: `💬 What's your take on ${topicTitle}? Drop your thoughts below!`,
      hashtags: hashtags.slice(0, 7),
    },
    data: { title: topicTitle, sections: themes.length },
  }
}

/**
 * Generate a schedule based on which assets were actually created.
 */
export function generateMockSchedule(generatedAssets = {}) {
  const baseTime = Date.now()
  const schedule = []
  let id = 1

  if (generatedAssets.infographic) {
    schedule.push({
      id: id++,
      date: new Date(baseTime + 86400000).toISOString(),
      time: '09:00',
      platform: 'linkedin',
      type: 'infographic',
      reason: 'Monday morning — professional audiences peak on LinkedIn 9–11am',
    })
  }
  if (generatedAssets.comicFrames?.length > 0) {
    schedule.push({
      id: id++,
      date: new Date(baseTime + 86400000 * 2).toISOString(),
      time: '11:00',
      platform: 'twitter',
      type: 'comic',
      reason: 'Tuesday carousel — visual content drives 3x more engagement mid-morning',
    })
    schedule.push({
      id: id++,
      date: new Date(baseTime + 86400000 * 3).toISOString(),
      time: '18:00',
      platform: 'instagram',
      type: 'comic',
      reason: 'Wednesday evening — Instagram carousel gets peak reach after 6pm',
    })
  }
  if (generatedAssets.memes?.length > 0) {
    schedule.push({
      id: id++,
      date: new Date(baseTime + 86400000 * 4).toISOString(),
      time: '15:00',
      platform: 'twitter',
      type: 'meme',
      reason: 'Thursday afternoon — memes peak 3–5pm on Twitter/X',
    })
    schedule.push({
      id: id++,
      date: new Date(baseTime + 86400000 * 6).toISOString(),
      time: '10:00',
      platform: 'instagram',
      type: 'meme',
      reason: 'Saturday morning — casual scroll time, memes outperform all content types',
    })
  }

  if (schedule.length === 0) {
    schedule.push({
      id: 1,
      date: new Date(baseTime + 86400000).toISOString(),
      time: '09:00',
      platform: 'linkedin',
      type: 'infographic',
      reason: 'Default optimal posting time',
    })
  }

  return schedule
}
