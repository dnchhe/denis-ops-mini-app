import { createInitialState, getScreenTitle, setCurrentTaskStatus, setVacancyStatus, submitCheckin } from './model.js'

let state = createInitialState()
const app = document.querySelector('#app')

const icons = {
  today: '⌁',
  projects: '▦',
  vacancies: '◇',
  checkin: '●',
}

const projectStatus = {
  'waiting-payment': ['Ожидаем оплату', 'warning'],
  'client-turn': ['Ход клиента', 'neutral'],
  'in-progress': ['В работе', 'success'],
}

const vacancyStatus = {
  review: 'На рассмотрении',
  later: 'Посмотреть позже',
  preparing: 'Готовим отклик',
  sent: 'Отправлено',
}

const taskStatus = {
  ready: 'Можно начинать',
  'in-progress': 'В работе',
  done: 'Завершено',
  postponed: 'Отложено',
  blocked: 'Есть проблема',
}

function setState(next) {
  state = next
  render()
}

function header(subtitle = '') {
  return `<header class="page-header"><div><p class="eyebrow">${subtitle || '24 августа · понедельник'}</p><h1>${getScreenTitle(state)}</h1></div><button class="avatar" aria-label="Профиль">Д</button></header>`
}

function todayView() {
  const status = taskStatus[state.currentTask.status]
  return `
    ${header()}
    <section class="hero-card">
      <div class="hero-top"><span class="status-dot"></span><span data-current-status>${status}</span><span class="hero-project">${state.currentTask.project}</span></div>
      <h2>${state.currentTask.title}</h2>
      <p>Первый конкретный результат этого этапа</p>
      <div class="quick-actions">
        <button class="primary" data-task-status="in-progress">▶ Начал</button>
        <button data-task-status="done">✓ Завершил</button>
        <button data-task-status="postponed">↗ Отложил</button>
        <button data-task-status="blocked">! Проблема</button>
      </div>
    </section>

    <section class="section-block">
      <div class="section-title"><div><p class="eyebrow">Фокус</p><h2>Три результата</h2></div><span class="count">1 / 3</span></div>
      <div class="result-list">
        <article class="result-row done"><span class="check">✓</span><div><strong>Определить структуру MVP</strong><small>Mini App</small></div></article>
        <article class="result-row"><span class="check">2</span><div><strong>Проверить интерфейс</strong><small>15 минут на телефоне</small></div></article>
        <article class="result-row"><span class="check">3</span><div><strong>Дать короткую обратную связь</strong><small>Что оставить и что убрать</small></div></article>
      </div>
    </section>

    <section class="section-block">
      <div class="section-title"><div><p class="eyebrow">Контроль</p><h2>Ближайшие точки</h2></div></div>
      <div class="compact-grid">
        <article class="metric-card warning"><span>27 авг</span><strong>Деньги на зубах</strong><small>Ожидается остаток оплаты</small></article>
        <article class="metric-card"><span>Без срока</span><strong>Наталия</strong><small>Ждём путь реального клиента</small></article>
      </div>
    </section>

    <button class="checkin-cta" data-open-checkin><span><b>Быстрый чек-ин</b><small>Энергия и концентрация · 30 секунд</small></span><i>→</i></button>
  `
}

function projectsView() {
  if (state.selectedProjectId) return projectDetail(state.projects.find((p) => p.id === state.selectedProjectId))
  return `
    ${header('3 демонстрационных проекта')}
    <div class="info-banner">Примеры из подтверждённого контекста. После проверки заменим их актуальными данными.</div>
    <div class="filter-row"><button class="active">Активные <span>3</span></button><button>Ожидание <span>2</span></button><button>Архив</button></div>
    <section class="card-stack">
      ${state.projects.map((project) => {
        const [label, tone] = projectStatus[project.status]
        return `<button class="project-card" data-project-id="${project.id}">
          <div class="card-head"><span class="pill ${tone}">${label}</span><span class="demo-label">пример</span></div>
          <h2>${project.title}</h2><p>${project.description}</p>
          <div class="next-action"><small>Следующее действие</small><strong>${project.nextAction}</strong></div>
          <div class="card-meta"><span>Срок<br><b>${project.deadline}</b></span><span>Следующий ход<br><b>${project.nextMove}</b></span><i>→</i></div>
        </button>`
      }).join('')}
    </section>
    <button class="floating-add" aria-label="Добавить проект">＋</button>
  `
}

function projectDetail(project) {
  return `
    <header class="detail-header"><button class="back" data-back-projects>←</button><div><p class="eyebrow">Демонстрационный проект</p><h1>${project.title}</h1></div><button class="more">•••</button></header>
    <section class="detail-hero"><span class="pill ${projectStatus[project.status][1]}">${projectStatus[project.status][0]}</span><p>${project.description}</p><div class="big-next"><small>Ближайшее действие</small><strong>${project.nextAction}</strong></div></section>
    <section class="detail-section"><h2>Проект</h2><div class="detail-grid">
      <div><small>Результат</small><strong>${project.result}</strong></div><div><small>Следующий ход</small><strong>${project.nextMove}</strong></div>
      <div><small>Первое касание</small><strong>${project.firstContact}</strong></div><div><small>Начало</small><strong>${project.startedAt}</strong></div>
    </div></section>
    <section class="detail-section"><h2>Оплата</h2><div class="payment-row"><div><small>Всего</small><strong>${project.payment.total}</strong></div><div><small>Оплачено</small><strong>${project.payment.paid}</strong></div><div><small>Остаток</small><strong>${project.payment.rest}</strong></div></div></section>
    <section class="detail-section"><h2>Дорожная карта</h2><ol class="roadmap">${project.roadmap.map((step, index) => `<li class="${index === 0 ? 'current' : ''}"><span>${index + 1}</span><b>${step}</b></li>`).join('')}</ol></section>
    <section class="detail-section"><h2>Нерешённые вопросы</h2><ul class="question-list">${project.questions.map((question) => `<li>${question}</li>`).join('')}</ul></section>
  `
}

function vacanciesView() {
  if (state.selectedVacancyId) return vacancyDetail(state.vacancies.find((v) => v.id === state.selectedVacancyId))
  return `
    ${header('2 демонстрационные вакансии')}
    <div class="info-banner">Отправка откликов остаётся за тобой. Здесь – анализ, статус и готовый текст.</div>
    <div class="filter-row"><button class="active">Новые <span>2</span></button><button>В работе</button><button>Архив</button></div>
    <section class="card-stack">
      ${state.vacancies.map((vacancy) => `<button class="vacancy-card" data-vacancy-id="${vacancy.id}">
        <div class="match-ring" style="--match:${vacancy.match * 3.6}deg"><span>${vacancy.match}%</span></div>
        <div class="vacancy-main"><small>${vacancy.company}</small><h2>${vacancy.title}</h2><p>${vacancy.summary}</p><div class="vacancy-tags"><span>${vacancy.format}</span><span>${vacancy.salary}</span></div></div>
        <div class="vacancy-status">${vacancyStatus[vacancy.status]} <i>→</i></div>
      </button>`).join('')}
    </section>
  `
}

function vacancyDetail(vacancy) {
  return `<header class="detail-header"><button class="back" data-back-vacancies>←</button><div><p class="eyebrow">${vacancy.company}</p><h1>${vacancy.title}</h1></div><button class="more">•••</button></header>
    <section class="detail-hero"><div class="score-line"><strong>${vacancy.match}%</strong><span>соответствие</span></div><p>${vacancy.summary}</p><div class="vacancy-tags"><span>${vacancy.format}</span><span>${vacancy.salary}</span></div></section>
    <section class="detail-section"><div class="section-title"><h2>Статус</h2><span class="pill neutral" data-vacancy-status>${vacancyStatus[vacancy.status]}</span></div><div class="action-column"><button class="primary wide" data-prepare-response>Подготовить отклик</button><button class="wide" data-vacancy-action="sent">Я отправил</button><button class="wide ghost" data-vacancy-action="later">Посмотреть позже</button></div></section>
    <section class="detail-section"><h2>Подготовленный отклик</h2><div class="response-box">${vacancy.response}</div></section>
    <section class="detail-section"><h2>Риски</h2><ul class="question-list">${vacancy.risks.map((risk) => `<li>${risk}</li>`).join('')}</ul></section>`
}

function scaleButtons(type, value) {
  return `<div class="scale-row">${[1,2,3,4,5].map((number) => `<button class="${value === number ? 'selected' : ''}" data-${type}="${number}">${number}</button>`).join('')}</div>`
}

function checkinView() {
  return `${header('30–60 секунд')}
    <section class="checkin-card">
      <div class="checkin-progress"><span style="width:${state.checkin.energy && state.checkin.focus ? '70%' : state.checkin.energy ? '40%' : '15%'}"></span></div>
      <div class="question"><p class="eyebrow">1 из 3</p><h2>Сколько энергии сейчас?</h2><p>1 – сил почти нет, 5 – энергии много</p>${scaleButtons('energy', state.checkin.energy)}</div>
      <div class="question"><p class="eyebrow">2 из 3</p><h2>Как с концентрацией?</h2><p>Насколько легко удерживать внимание</p>${scaleButtons('focus', state.checkin.focus)}</div>
      <div class="question"><p class="eyebrow">3 из 3</p><h2>Что отвлекает?</h2><div class="choice-grid">${[['phone','Телефон'],['tasks','Другие задачи'],['state','Состояние'],['none','Ничего']].map(([key,label]) => `<button class="${state.checkin.distraction === key ? 'selected' : ''}" data-distraction="${key}">${label}</button>`).join('')}</div></div>
      <button class="primary wide submit-checkin" data-submit-checkin>Отправить чек-ин</button>
    </section>
    ${state.checkinResult ? `<div class="checkin-result"><span>✓</span><div><small>Короткий вывод</small><strong>${state.checkinResult}</strong></div></div>` : ''}
  `
}

function bottomNav() {
  if (state.selectedProjectId || state.selectedVacancyId) return ''
  return `<nav class="bottom-nav">${Object.entries(icons).map(([key, icon]) => `<button class="${state.activeScreen === key ? 'active' : ''}" data-nav="${key}"><span>${icon}</span><small>${{today:'Сегодня',projects:'Проекты',vacancies:'Вакансии',checkin:'Чек-ин'}[key]}</small></button>`).join('')}</nav>`
}

function bindEvents() {
  document.querySelectorAll('[data-nav]').forEach((button) => button.addEventListener('click', () => setState({ ...state, activeScreen: button.dataset.nav, selectedProjectId: null, selectedVacancyId: null })))
  document.querySelectorAll('[data-task-status]').forEach((button) => button.addEventListener('click', () => setState(setCurrentTaskStatus(state, button.dataset.taskStatus))))
  document.querySelector('[data-open-checkin]')?.addEventListener('click', () => setState({ ...state, activeScreen: 'checkin' }))
  document.querySelectorAll('[data-project-id]').forEach((button) => button.addEventListener('click', () => setState({ ...state, selectedProjectId: button.dataset.projectId })))
  document.querySelector('[data-back-projects]')?.addEventListener('click', () => setState({ ...state, selectedProjectId: null }))
  document.querySelectorAll('[data-vacancy-id]').forEach((button) => button.addEventListener('click', () => setState({ ...state, selectedVacancyId: button.dataset.vacancyId })))
  document.querySelector('[data-back-vacancies]')?.addEventListener('click', () => setState({ ...state, selectedVacancyId: null }))
  document.querySelector('[data-prepare-response]')?.addEventListener('click', () => setState(setVacancyStatus(state, state.selectedVacancyId, 'preparing')))
  document.querySelectorAll('[data-vacancy-action]').forEach((button) => button.addEventListener('click', () => setState(setVacancyStatus(state, state.selectedVacancyId, button.dataset.vacancyAction))))
  document.querySelectorAll('[data-energy]').forEach((button) => button.addEventListener('click', () => setState({ ...state, checkin: { ...state.checkin, energy: Number(button.dataset.energy) } })))
  document.querySelectorAll('[data-focus]').forEach((button) => button.addEventListener('click', () => setState({ ...state, checkin: { ...state.checkin, focus: Number(button.dataset.focus) } })))
  document.querySelectorAll('[data-distraction]').forEach((button) => button.addEventListener('click', () => setState({ ...state, checkin: { ...state.checkin, distraction: button.dataset.distraction } })))
  document.querySelector('[data-submit-checkin]')?.addEventListener('click', () => setState({ ...state, checkinResult: submitCheckin(state.checkin) }))
}

function render() {
  const view = { today: todayView, projects: projectsView, vacancies: vacanciesView, checkin: checkinView }[state.activeScreen]()
  app.innerHTML = `<div class="app-shell"><main>${view}</main>${bottomNav()}</div>`
  bindEvents()
}

render()
