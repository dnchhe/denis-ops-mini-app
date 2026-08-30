import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addWellbeingEntry,
  calculateWellbeingStats,
  completeCurrentTask,
  createInitialState,
  getCheckinType,
  getProfileStats,
  filterWellbeingByDays,
  hasSleepEntryForDate,
  getScreenTitle,
  normalizeProject,
  setCurrentTaskStatus,
  setVacancyStatus,
  submitCheckin,
} from '../src/model.js'

test('initial state opens Today with demonstration content', () => {
  const state = createInitialState()
  assert.equal(state.activeScreen, 'today')
  assert.equal(getScreenTitle(state), 'Сегодня')
  assert.equal(state.projects.length, 3)
  assert.equal(state.projects.every((project) => project.demo === true), true)
  assert.equal(state.projectSort, 'deadline')
})

test('project with unknown start date remains unknown', () => {
  const project = normalizeProject({ id:'p1',title:'Проект',status:'active',createdAt:null,payment:{} })
  assert.equal(project.createdAt, null)
})

test('current task can be started', () => {
  const state = setCurrentTaskStatus(createInitialState(), 'in-progress')
  assert.equal(state.currentTask.status, 'in-progress')
})

test('vacancy can move to preparing response', () => {
  const state = setVacancyStatus(createInitialState(), 'tech-specialist', 'preparing')
  assert.equal(state.vacancies[0].status, 'preparing')
})

test('short check-in returns one next action', () => {
  const result = submitCheckin({ energy: 3, focus: 2, distraction: 'phone' })
  assert.match(result, /^Следующее действие:/)
  assert.equal(result.split('\n').length, 1)
})

test('completing the current priority task reveals the next task', () => {
  const initial = createInitialState()
  const firstTaskId = initial.currentTask.id
  const next = completeCurrentTask(initial)

  assert.equal(next.dayTasks.find((task) => task.id === firstTaskId).status, 'done')
  assert.notEqual(next.currentTask.id, firstTaskId)
  assert.equal(next.currentTask.priority, 2)
})

test('profile statistics are derived from actual state collections', () => {
  const state = createInitialState()
  const stats = getProfileStats(state)

  assert.equal(stats.activeProjects, 1)
  assert.equal(stats.totalVacancies, 2)
  assert.equal(stats.completedToday, 1)
})

test('weekly focus is linked to marked day tasks', () => {
  const state = createInitialState()
  const focusTasks = state.dayTasks.filter((task) => task.focus)
  assert.equal(focusTasks.length, 3)
  assert.equal(focusTasks.filter((task) => task.status === 'done').length, 1)
})

test('check-in type is derived from local hour', () => {
  assert.equal(getCheckinType(8), 'morning')
  assert.equal(getCheckinType(14), 'day')
  assert.equal(getCheckinType(21), 'evening')
})

test('wellbeing statistics include averages and peak energy period', () => {
  const entries = [
    { type: 'morning', energy: 2, mood: 3, focus: 2, anxiety: 3, sleepHours: 6 },
    { type: 'day', energy: 3, mood: 4, focus: 3, anxiety: 2, sleepHours: 6 },
    { type: 'evening', energy: 5, mood: 4, focus: 4, anxiety: 1, sleepHours: 6 },
    { type: 'evening', energy: 4, mood: 5, focus: 4, anxiety: 1, sleepHours: 7 },
  ]
  const stats = calculateWellbeingStats(entries)

  assert.equal(stats.averageEnergy, 3.5)
  assert.equal(stats.averageMood, 4)
  assert.equal(stats.peakEnergyType, 'evening')
})

test('new wellbeing check-in is appended with its period', () => {
  const state = createInitialState()
  const next = addWellbeingEntry(state, { energy: 4, mood: 3, focus: 4, anxiety: 2 }, new Date('2026-08-24T14:00:00+03:00'))
  const last = next.wellbeingHistory.at(-1)

  assert.equal(last.type, 'day')
  assert.equal(last.energy, 4)
})

test('sleep questions are hidden after one real sleep entry for the day', () => {
  const entries = [
    { timestamp: '2026-08-25T07:13:00+03:00', sleepHours: 9, demo: 0 },
    { timestamp: '2026-08-24T08:00:00+03:00', sleepHours: 7, demo: 0 },
  ]
  assert.equal(hasSleepEntryForDate(entries, '2026-08-25'), true)
  assert.equal(hasSleepEntryForDate(entries, '2026-08-26'), false)
})


test('wellbeing period filter changes the selected dataset', () => {
  const entries = [
    { timestamp: '2026-08-01T08:00:00+03:00', energy: 1 },
    { timestamp: '2026-08-24T08:00:00+03:00', energy: 5 },
  ]
  assert.equal(filterWellbeingByDays(entries, 7, new Date('2026-08-25T12:00:00+03:00')).length, 1)
  assert.equal(filterWellbeingByDays(entries, 30, new Date('2026-08-25T12:00:00+03:00')).length, 2)
})
