import {
  completeCurrentTask,
  createInitialState,
  getProfileStats,
  getScreenTitle,
  setCurrentTaskStatus,
  setVacancyStatus,
  submitCheckin,
} from './model.js'

let state = { ...createInitialState(), confirmCompletion: false }
const app = document.querySelector('#app')

const navItems = [
  ['today', '⌂', 'Сегодня'],
  ['calendar', '□', 'Календарь'],
  ['projects', '▤', 'Проекты'],
  ['vacancies', '◇', 'Вакансии'],
  ['checkin', '○', 'Чек-ин'],
]

const projectStatus = {
  'waiting-payment': ['Ожидаем оплату', 'amber'],
  'client-turn': ['Ход клиента', 'muted'],
  'in-progress': ['В работе', 'mint'],
}
const vacancyStatus = { review: 'На рассмотрении', later: 'Посмотреть позже', preparing: 'Готовим отклик', sent: 'Отправлено' }
const taskStatus = { ready: 'Следующая по приоритету', 'in-progress': 'Сейчас в работе', postponed: 'На паузе', blocked: 'Есть препятствие', done: 'Завершено' }

function setState(next) { state = next; render() }

function header(kicker = '24 августа · понедельник') {
  return `<header class="topbar">
    <div><p class="kicker">${kicker}</p><h1>${getScreenTitle(state)}</h1></div>
    <button class="profile-button" data-open-profile aria-label="Открыть статистику">Д</button>
  </header>`
}

function weekStrip() {
  const days = [['ПН',24],['ВТ',25],['СР',26],['ЧТ',27],['ПТ',28],['СБ',29],['ВС',30]]
  const eventDays = new Set(state.calendarEvents.map((event) => event.day))
  return `<div class="week-strip">${days.map(([name, day]) => `<button class="day-cell ${day === 24 ? 'active' : ''}"><small>${name}</small><strong>${day}</strong>${eventDays.has(day) ? '<i></i>' : ''}</button>`).join('')}</div>`
}

function currentTaskActions() {
  if (state.currentTask.status === 'in-progress') {
    return `<div class="task-actions active-state">
      <button class="primary-action" data-complete-current>Завершить</button>
      <button data-task-status="postponed">Пауза</button>
      <button data-task-status="blocked">Проблема</button>
    </div>`
  }
  if (state.currentTask.status === 'postponed' || state.currentTask.status === 'blocked') {
    return `<div class="task-actions"><button class="primary-action" data-task-status="in-progress">Продолжить</button><button data-skip-task>Следующая</button></div>`
  }
  if (state.currentTask.status === 'done') return ''
  return `<div class="task-actions"><button class="primary-action" data-task-status="in-progress">Начать задачу</button><button data-task-status="postponed">Отложить</button></div>`
}

function todayView() {
  const completed = state.dayTasks.filter((task) => task.status === 'done').length
  return `${header()}
    ${weekStrip()}

    <section class="weekly-focus">
      <div class="section-line"><div><p class="kicker">Фокус недели</p><h2>${state.weeklyFocus.title}</h2></div><strong>${state.weeklyFocus.progress}%</strong></div>
      <div class="progress-track"><span style="width:${state.weeklyFocus.progress}%"></span></div>
      <div class="focus-meta"><span>${state.weeklyFocus.completed} из ${state.weeklyFocus.total} этапов</span><span>до ${state.weeklyFocus.deadline}</span></div>
    </section>

    <section class="priority-task">
      <div class="task-label"><span class="live-dot"></span>${taskStatus[state.currentTask.status]}<small>${state.currentTask.estimate}</small></div>
      <h2>${state.currentTask.title}</h2>
      <p>${state.currentTask.project}</p>
      ${currentTaskActions()}
    </section>

    <section class="plain-section">
      <div class="section-line"><div><p class="kicker">План</p><h2>Задачи на день</h2></div><span class="section-count">${completed}/${state.dayTasks.length}</span></div>
      <div class="task-list">${state.dayTasks.map((task) => `<button class="task-row ${task.status === 'done' ? 'done' : ''} ${task.id === state.currentTask.id ? 'current' : ''}" data-day-task="${task.id}">
        <span class="task-check">${task.status === 'done' ? '✓' : ''}</span>
        <span><b>${task.title}</b><small>${task.project} · ${task.estimate}</small></span>
        <i>›</i>
      </button>`).join('')}</div>
    </section>

    <section class="plain-section compact-agenda">
      <div class="section-line"><div><p class="kicker">Дальше</p><h2>Ближайшие даты</h2></div><button class="text-button" data-nav="calendar">Все</button></div>
      <button class="agenda-row"><time><b>27</b><small>АВГ</small></time><span><b>Деньги на зубах</b><small>Ожидается остаток оплаты</small></span><em class="amber-dot"></em></button>
      <button class="agenda-row"><time><b>30</b><small>АВГ</small></time><span><b>Фокус недели</b><small>Контроль результата</small></span><em class="mint-dot"></em></button>
    </section>`
}

function calendarView() {
  const eventsByDay = new Map(state.calendarEvents.map((event) => [event.day, event]))
  const blanks = Array(5).fill('<span class="calendar-day empty"></span>').join('')
  return `${header('Август 2026')}
    <div class="calendar-head"><button>‹</button><h2>Август</h2><button>›</button></div>
    <div class="calendar-weekdays">${['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'].map((day) => `<span>${day}</span>`).join('')}</div>
    <div class="month-grid">${blanks}${Array.from({length:31},(_,i) => {
      const day = i + 1; const event = eventsByDay.get(day)
      return `<button class="calendar-day ${day === 24 ? 'today' : ''} ${event ? 'has-event' : ''}"><span>${day}</span>${event ? `<i class="${event.type}"></i>` : ''}</button>`
    }).join('')}</div>
    <section class="time-left"><div><p class="kicker">До конца недели</p><strong>6 дней</strong></div><div class="week-meter"><span style="width:14%"></span></div><small>Главная контрольная точка – 30 августа</small></section>
    <section class="plain-section"><div class="section-line"><h2>Планы и дедлайны</h2><span class="section-count">${state.calendarEvents.length}</span></div>
      <div class="calendar-agenda">${state.calendarEvents.map((event) => `<button class="agenda-row"><time><b>${event.day}</b><small>АВГ</small></time><span><b>${event.label}</b><small>${{task:'Задача',payment:'Оплата',deadline:'Дедлайн',focus:'Фокус недели'}[event.type]}</small></span><em class="${event.type}"></em></button>`).join('')}</div>
    </section>`
}

function projectsView() {
  if (state.selectedProjectId) return projectDetail(state.projects.find((project) => project.id === state.selectedProjectId))
  return `${header('3 демонстрационных проекта')}
    <div class="subtle-note">Пока здесь примеры. После проверки заменим их актуальными данными.</div>
    <div class="segmented"><button class="active">Активные</button><button>Ожидание</button><button>Архив</button></div>
    <div class="object-list">${state.projects.map((project) => {
      const [label,tone] = projectStatus[project.status]
      return `<button class="object-row" data-project-id="${project.id}"><span class="object-mark ${tone}">${project.title[0]}</span><span class="object-copy"><small>${label}</small><b>${project.title}</b><em>${project.nextAction}</em></span><span class="object-side"><small>${project.nextMove}</small><i>›</i></span></button>`
    }).join('')}</div>
    <button class="round-add">＋</button>`
}

function projectDetail(project) {
  const [label,tone] = projectStatus[project.status]
  return `<header class="detail-top"><button data-back-projects>‹</button><div><p class="kicker">Проект</p><h1>${project.title}</h1></div><button>•••</button></header>
    <section class="detail-summary"><span class="status-pill ${tone}">${label}</span><p>${project.description}</p><div class="next-block"><small>Ближайшее действие</small><b>${project.nextAction}</b><span>Следующий ход: ${project.nextMove}</span></div></section>
    <section class="data-section"><h2>Ключевые данные</h2><div class="data-list"><div><span>Результат</span><b>${project.result}</b></div><div><span>Срок</span><b>${project.deadline}</b></div><div><span>Первое касание</span><b>${project.firstContact}</b></div><div><span>Начало</span><b>${project.startedAt}</b></div></div></section>
    <section class="data-section"><h2>Оплата</h2><div class="stats-inline"><div><small>Всего</small><b>${project.payment.total}</b></div><div><small>Оплачено</small><b>${project.payment.paid}</b></div><div><small>Остаток</small><b>${project.payment.rest}</b></div></div></section>
    <section class="data-section"><h2>Дорожная карта</h2><ol class="timeline">${project.roadmap.map((step,index) => `<li class="${index === 0 ? 'active' : ''}"><span>${index + 1}</span><b>${step}</b></li>`).join('')}</ol></section>`
}

function vacanciesView() {
  if (state.selectedVacancyId) return vacancyDetail(state.vacancies.find((vacancy) => vacancy.id === state.selectedVacancyId))
  return `${header('Поиск по будням')}
    <section class="search-schedule"><div><span class="live-dot"></span><b>Автопоиск включён</b><small>Следующий запуск – 12:00</small></div><div class="schedule-times">${state.vacancySearch.schedule.map((time) => `<span>${time}</span>`).join('')}</div></section>
    <div class="section-line list-heading"><div><p class="kicker">Новые</p><h2>Подходящие вакансии</h2></div><span class="section-count">${state.vacancies.length}</span></div>
    <div class="object-list">${state.vacancies.map((vacancy) => `<button class="object-row vacancy" data-vacancy-id="${vacancy.id}"><span class="match-score">${vacancy.match}</span><span class="object-copy"><small>${vacancy.company}</small><b>${vacancy.title}</b><em>${vacancy.format} · ${vacancy.salary}</em></span><span class="object-side"><small>${vacancyStatus[vacancy.status]}</small><i>›</i></span></button>`).join('')}</div>`
}

function vacancyDetail(vacancy) {
  return `<header class="detail-top"><button data-back-vacancies>‹</button><div><p class="kicker">${vacancy.company}</p><h1>${vacancy.title}</h1></div><button>•••</button></header>
    <section class="detail-summary"><div class="large-match"><b>${vacancy.match}</b><span>% соответствие</span></div><p>${vacancy.summary}</p><div class="tag-line"><span>${vacancy.format}</span><span>${vacancy.salary}</span></div></section>
    <section class="data-section"><div class="section-line"><h2>Действие</h2><span class="status-pill muted" data-vacancy-status>${vacancyStatus[vacancy.status]}</span></div><div class="stack-actions"><button class="primary-action" data-prepare-response>Подготовить отклик</button><button data-vacancy-action="sent">Я отправил</button><button data-vacancy-action="later">Посмотреть позже</button></div></section>
    <section class="data-section"><h2>Отклик</h2><div class="text-box">${vacancy.response}</div></section>`
}

function scaleButtons(type, value) {
  return `<div class="scale-row">${[1,2,3,4,5].map((number) => `<button class="${value === number ? 'selected' : ''}" data-${type}="${number}">${number}</button>`).join('')}</div>`
}

function checkinView() {
  return `${header('30–60 секунд')}
    <section class="checkin-sheet"><div class="checkin-status"><span style="width:${state.checkin.energy && state.checkin.focus ? '72%' : state.checkin.energy ? '38%' : '12%'}"></span></div>
      <div class="check-question"><p class="kicker">Энергия</p><h2>Сколько сил сейчас?</h2>${scaleButtons('energy',state.checkin.energy)}</div>
      <div class="check-question"><p class="kicker">Фокус</p><h2>Как с концентрацией?</h2>${scaleButtons('focus',state.checkin.focus)}</div>
      <div class="check-question"><p class="kicker">Контекст</p><h2>Что отвлекает?</h2><div class="choice-chips">${[['phone','Телефон'],['tasks','Другие задачи'],['state','Состояние'],['none','Ничего']].map(([key,label]) => `<button class="${state.checkin.distraction === key ? 'selected' : ''}" data-distraction="${key}">${label}</button>`).join('')}</div></div>
      <button class="complete-checkin" data-submit-checkin>Завершить чек-ин</button>
    </section>${state.checkinResult ? `<div class="result-note"><span>✓</span><div><small>Следующее действие</small><b>${state.checkinResult.replace('Следующее действие: ','')}</b></div></div>` : ''}`
}

function profileOverlay() {
  if (!state.profileOpen) return ''
  const stats = getProfileStats(state)
  const completion = Math.round(stats.completedToday / stats.totalToday * 100)
  return `<div class="profile-overlay"><header class="profile-head"><button data-close-profile>×</button><div class="profile-avatar">Д</div><h1>Денис</h1><p>Личная операционная статистика</p></header>
    <section class="profile-rings"><div class="stat-ring mint-ring" style="--value:${state.weeklyFocus.progress * 3.6}deg"><span><b>${state.weeklyFocus.progress}%</b><small>Неделя</small></span></div><div class="stat-ring amber-ring" style="--value:${completion * 3.6}deg"><span><b>${completion}%</b><small>Сегодня</small></span></div></section>
    <section class="profile-grid"><div><b>${stats.activeProjects}</b><span>Активных проекта</span></div><div><b>${stats.riskyProjects}</b><span>Проекта с риском</span></div><div><b>${stats.totalVacancies}</b><span>Вакансии</span></div><div><b>${stats.responsesPreparing}</b><span>Готовим отклики</span></div></section>
    <section class="profile-block"><div class="section-line"><h2>Активность</h2><span>7 дней</span></div><div class="bars">${[34,52,28,68,42,78,40].map((height,index) => `<i style="height:${height}%" class="${index === 6 ? 'active' : ''}"></i>`).join('')}</div><div class="bar-labels">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((day) => `<small>${day}</small>`).join('')}</div></section>
    <section class="future-note"><p class="kicker">Следующий этап</p><h2>Контакты и мероприятия</h2><p>База знакомств, участников мероприятий и людей, которые перешли в бота.</p></section>
  </div>`
}

function confirmation() {
  if (!state.confirmCompletion) return ''
  return `<div class="modal-backdrop"><div class="confirm-modal"><span class="confirm-icon">✓</span><h2>Задача завершена?</h2><p>${state.currentTask.title}</p><button class="primary-action" data-confirm-completion>Да, показать следующую</button><button data-cancel-completion>Вернуться</button></div></div>`
}

function bottomNav() {
  if (state.selectedProjectId || state.selectedVacancyId || state.profileOpen) return ''
  return `<nav class="bottom-dock">${navItems.map(([key,icon,label]) => `<button class="${state.activeScreen === key ? 'active' : ''}" data-nav="${key}"><span>${icon}</span><small>${label}</small></button>`).join('')}</nav>`
}

function bindEvents() {
  document.querySelectorAll('[data-nav]').forEach((button) => button.addEventListener('click', () => setState({ ...state, activeScreen: button.dataset.nav, selectedProjectId: null, selectedVacancyId: null })))
  document.querySelectorAll('[data-open-profile]').forEach((button) => button.addEventListener('click', () => setState({ ...state, profileOpen: true })))
  document.querySelector('[data-close-profile]')?.addEventListener('click', () => setState({ ...state, profileOpen: false }))
  document.querySelectorAll('[data-task-status]').forEach((button) => button.addEventListener('click', () => setState(setCurrentTaskStatus(state, button.dataset.taskStatus))))
  document.querySelector('[data-complete-current]')?.addEventListener('click', () => setState({ ...state, confirmCompletion: true }))
  document.querySelector('[data-confirm-completion]')?.addEventListener('click', () => setState({ ...completeCurrentTask(state), confirmCompletion: false }))
  document.querySelector('[data-cancel-completion]')?.addEventListener('click', () => setState({ ...state, confirmCompletion: false }))
  document.querySelector('[data-skip-task]')?.addEventListener('click', () => {
    const candidates = state.dayTasks.filter((task) => task.status !== 'done' && task.id !== state.currentTask.id).sort((a,b) => a.priority-b.priority)
    if (candidates[0]) setState({ ...state, currentTask: { ...candidates[0] } })
  })
  document.querySelectorAll('[data-day-task]').forEach((button) => button.addEventListener('click', () => {
    const task = state.dayTasks.find((item) => item.id === button.dataset.dayTask)
    if (task && task.status !== 'done') setState({ ...state, currentTask: { ...task } })
  }))
  document.querySelectorAll('[data-project-id]').forEach((button) => button.addEventListener('click', () => setState({ ...state, selectedProjectId: button.dataset.projectId })))
  document.querySelector('[data-back-projects]')?.addEventListener('click', () => setState({ ...state, selectedProjectId: null }))
  document.querySelectorAll('[data-vacancy-id]').forEach((button) => button.addEventListener('click', () => setState({ ...state, selectedVacancyId: button.dataset.vacancyId })))
  document.querySelector('[data-back-vacancies]')?.addEventListener('click', () => setState({ ...state, selectedVacancyId: null }))
  document.querySelector('[data-prepare-response]')?.addEventListener('click', () => setState(setVacancyStatus(state,state.selectedVacancyId,'preparing')))
  document.querySelectorAll('[data-vacancy-action]').forEach((button) => button.addEventListener('click', () => setState(setVacancyStatus(state,state.selectedVacancyId,button.dataset.vacancyAction))))
  document.querySelectorAll('[data-energy]').forEach((button) => button.addEventListener('click', () => setState({ ...state, checkin: { ...state.checkin, energy:Number(button.dataset.energy) } })))
  document.querySelectorAll('[data-focus]').forEach((button) => button.addEventListener('click', () => setState({ ...state, checkin: { ...state.checkin, focus:Number(button.dataset.focus) } })))
  document.querySelectorAll('[data-distraction]').forEach((button) => button.addEventListener('click', () => setState({ ...state, checkin: { ...state.checkin, distraction:button.dataset.distraction } })))
  document.querySelector('[data-submit-checkin]')?.addEventListener('click', () => setState({ ...state, checkinResult:submitCheckin(state.checkin) }))
}

function render() {
  const views = { today:todayView, calendar:calendarView, projects:projectsView, vacancies:vacanciesView, checkin:checkinView }
  const content = views[state.activeScreen]()
  app.innerHTML = `<div class="app-shell"><main>${content}</main>${bottomNav()}${profileOverlay()}${confirmation()}</div>`
  bindEvents()
}

render()
