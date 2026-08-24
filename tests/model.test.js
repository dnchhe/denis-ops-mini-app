import test from 'node:test'
import assert from 'node:assert/strict'
import {
  completeCurrentTask,
  createInitialState,
  getProfileStats,
  getScreenTitle,
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

  assert.equal(stats.activeProjects, 3)
  assert.equal(stats.totalVacancies, 2)
  assert.equal(stats.completedToday, 1)
})

test('weekly focus progress is based on completed milestones', () => {
  const state = createInitialState()
  assert.equal(state.weeklyFocus.completed, 2)
  assert.equal(state.weeklyFocus.total, 5)
  assert.equal(state.weeklyFocus.progress, 40)
})
