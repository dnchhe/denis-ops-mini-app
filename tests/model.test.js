import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createInitialState,
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
