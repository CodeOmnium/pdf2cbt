export default () => {
  const { currentTestState } = useCbtTestData()
  const { testSettings } = useCbtSettings()
  const fired = new Set<string>()
  let prevRemaining: number | null = null

  const toast = useNuxtApp().$toast

  function formatHoursMinutes(seconds: number): string {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    if (hrs > 0 && mins > 0) return `${hrs} hour${hrs > 1 ? 's' : ''} ${mins} minute${mins > 1 ? 's' : ''}`
    if (hrs > 0) return `${hrs} hour${hrs > 1 ? 's' : ''}`
    return `${mins} minute${mins > 1 ? 's' : ''}`
  }

  function fireIfCrossed(
    id: string,
    threshold: number,
    remaining: number,
    getMessage: () => { title: string; description: string },
  ) {
    if (!fired.has(id) && remaining <= threshold && prevRemaining !== null && prevRemaining > threshold) {
      fired.add(id)
      const msg = getMessage()
      toast(msg.title, { description: msg.description, duration: 6000 })
    }
  }

  watch(() => currentTestState.value.remainingSeconds, (remaining) => {
    if (remaining === null || remaining === undefined) {
      prevRemaining = null
      return
    }

    if (prevRemaining === null) {
      prevRemaining = remaining
      return
    }

    const rules = testSettings.value.sectionTimeLockRules ?? []
    const duration = testSettings.value.durationInSeconds
    if (!duration) return

    fireIfCrossed('exam-end-30', 30 * 60, remaining, () => ({
      title: '30 Minutes Remaining',
      description: `${testSettings.value.testName || 'Exam'} ends in 30 minutes`,
    }))

    const transitionRule = rules.find(r => r.accessibleWhenRemainingLte !== undefined)
    const transitionSec = transitionRule?.accessibleWhenRemainingLte

    if (transitionSec !== undefined) {
      fireIfCrossed('section-end-30', transitionSec + 30 * 60, remaining, () => ({
        title: 'Section Ending Soon',
        description: `${transitionRule!.sections.join(' & ')} section ends in 30 minutes`,
      }))
    }
    else {
      const halfSec = Math.floor(duration / 2)
      fireIfCrossed('half-time', halfSec, remaining, () => ({
        title: 'Half Time',
        description: `${formatHoursMinutes(halfSec)} remaining`,
      }))
    }

    prevRemaining = remaining
  })
}
