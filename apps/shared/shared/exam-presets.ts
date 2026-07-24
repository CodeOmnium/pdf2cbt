import type { ExamPresetConfig } from './types/cbt-interface'

export const EXAM_PRESETS: Record<string, ExamPresetConfig> = {
  custom: {
    key: 'custom',
    name: 'Custom',
    description: 'No preset, manual configuration',
    markingSummary: '',
    testSettings: {},
    sectionTimeLockRules: [],
  },

  'jee-main': {
    key: 'jee-main',
    name: 'JEE Main',
    description: '75 questions · 3 hours',
    markingSummary: 'Correct: +4, Incorrect: -1, Unanswered: 0',
    testSettings: {
      testName: 'JEE Main Mock Test',
      durationInSeconds: 3 * 60 * 60,
      timeFormat: 'hh:mm:ss',
      submitBtn: 'enabled',
      showPauseBtn: false,
      saveQuestionsLikeRealExams: true,
    },
    sectionTimeLockRules: [],
  },

  'mht-cet-pcm': {
    key: 'mht-cet-pcm',
    name: 'MHT CET PCM',
    description: '150 questions · 3 hours (split 90+90)',
    markingSummary: 'Physics/Chemistry: +1/0/0, Mathematics: +2/0/0',
    testSettings: {
      testName: 'MHT CET PCM Mock Test',
      durationInSeconds: 3 * 60 * 60,
      timeFormat: 'hh:mm:ss',
      submitBtn: 'enabled',
      showPauseBtn: false,
      saveQuestionsLikeRealExams: true,
    },
    sectionTimeLockRules: [
      {
        sections: ['Physics', 'Chemistry'],
        accessibleWhenRemainingGte: 90 * 60 + 1,
      },
      {
        sections: ['Mathematics'],
        accessibleWhenRemainingLte: 90 * 60,
      },
    ],
  },
}

export const EXAM_PRESET_LIST = Object.values(EXAM_PRESETS).map(p => ({
  name: p.name,
  value: p.key,
  description: p.description,
  markingSummary: p.markingSummary,
}))
