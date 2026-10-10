export const REELS_VIDEO_TYPES = ['Long Video', 'Short', 'Event', 'Story', 'Awareness']

export const REELS_SECTIONS = [
  {
    id: 'quality',
    label: 'Video Quality Check',
    items: [
      'Strong hook in first 5–10 seconds',
      'Story is clear and engaging',
      'Unnecessary footage removed',
      'Audio/voice is clear',
      'Background music is balanced',
      'Subtitles/captions checked',
      'Names, dates & facts are correct',
      'Video quality is HD/1080p or better',
      'Video has been checked on mobile',
      'Ending has a clear Call to Action',
    ],
  },
  {
    id: 'beneficiary',
    label: 'Beneficiary & Content Check',
    items: [
      'Beneficiary consent/permission confirmed where required',
      'Children\u2019s privacy/safety checked',
      'No misleading information',
      'No disrespectful or insensitive footage',
      'NGO\u2019s work and impact are accurately represented',
      'All statistics/data have been verified',
    ],
  },
  {
    id: 'thumbnail',
    label: 'Thumbnail Check',
    items: [
      'High-quality image',
      'Strong emotion/visual',
      'Text is short (2–5 words)',
      'Easy to read on mobile',
      'Thumbnail matches the actual video',
      'No misleading/clickbait image',
    ],
  },
  {
    id: 'seo',
    label: 'YouTube SEO Check',
    items: [
      'Title is attractive and relevant',
      'Main keyword included naturally',
      'Description completed',
      'Important keywords included in description',
      'Relevant hashtags added',
      'Correct category selected',
      'Correct language selected',
      'Playlist added',
      'End screen added',
      'Cards added where useful',
    ],
  },
  {
    id: 'final',
    label: 'Final Publishing Check',
    items: [
      'Video watched completely after final export',
      'Thumbnail checked',
      'Title checked',
      'Description checked',
      'Links/contact information checked',
      'Spelling checked',
      'Copyright/music checked',
      'Visibility setting confirmed',
      'Upload date/time confirmed',
    ],
  },
]

export const REELS_INIT_CHECKS = REELS_SECTIONS.reduce((acc, s) => {
  acc[s.id] = s.items.map(() => false)
  return acc
}, {})

export const REELS_PUBLISH_RULES = [
  'All mandatory checks are completed',
  'Final video has been approved',
  'Thumbnail + title are approved',
  'No copyright/privacy/content issue is pending',
]

export const APPROVER_ROLES = [
  { id: 'editor', label: 'Editor' },
  { id: 'social', label: 'Social Media Executive' },
  { id: 'final', label: 'Final Approver' },
]