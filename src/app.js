import {
  addWellbeingEntry,
  calculateWellbeingStats,
  completeCurrentTask,
  createInitialState,
  daysUntil,
  filterProjects,
  formatMoney,
  getCheckinType,
  getProfileStats,
  hasSleepEntryForDate,
  getScreenTitle,
  moneySummary,
  projectProgress,
  setCurrentTaskStatus,
  setVacancyStatus,
  submitCheckin,
} from './model.js'

let state = { ...createInitialState(), confirmCompletion: false, serverConnected: false, searchExpanded: false, selectedEventId: null, eventCommentDraft: '', searchBusy: false, projectMenuOpen: false, createFormOpen: false }
const app = document.querySelector('#app')
const telegram = window.Telegram?.WebApp
telegram?.ready()
telegram?.expand()

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': telegram?.initData || '',
      ...(options.headers || {}),
    },
  })
  if (!response.ok) throw new Error(`API ${response.status}`)
  return response.json()
}

function mergeServerState(serverState) {
  return {
    ...state,
    ...serverState,
    selectedProjectId: state.selectedProjectId,
    selectedVacancyId: state.selectedVacancyId,
    profileOpen: state.profileOpen,
    confirmCompletion: false,
    serverConnected: true,
  }
}

async function loadServerState() {
  try {
    const serverState = await apiRequest('/api/state')
    setState(mergeServerState(serverState))
  } catch (error) {
    console.warn('Server state is unavailable; demonstration state remains active', error)
  }
}

const navItems = [
  ['today', '⌂', 'Сегодня'],
  ['projects', '▤', 'Проекты'],
  ['vacancies', '◇', 'Вакансии'],
  ['checkin', '○', 'Чек-ин'],
  ['calendar', '□', 'Календарь'],
]

const projectStatus = {
  active: ['В работе', 'mint'],
  waiting: ['Ожидание', 'amber'],
  archived: ['Архив', 'muted'],
}
const vacancyStatus = { review: 'На рассмотрении', later: 'Посмотреть позже', preparing: 'Готовим отклик', sent: 'Отправлено' }
const taskStatus = { ready: 'Следующая по приоритету', 'in-progress': 'Сейчас в работе', postponed: 'На паузе', blocked: 'Есть препятствие', done: 'Завершено' }

function setState(next) { state = next; render() }

function setStatePreserveProfileScroll(next) {
  const scrollTop = document.querySelector('.profile-overlay')?.scrollTop || 0
  state = next
  render()
  requestAnimationFrame(() => {
    const overlay = document.querySelector('.profile-overlay')
    if (overlay) overlay.scrollTop = scrollTop
  })
}

function header(kicker) {
  const moscow = new Date(new Date().toLocaleString('en-US', { timeZone:'Europe/Moscow' }))
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
  const weekdays = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота']
  const label = kicker || `${moscow.getDate()} ${months[moscow.getMonth()]} · ${weekdays[moscow.getDay()]}`
  return `<header class="topbar">
    <div><p class="kicker">${label}</p><h1>Сегодня</h1></div>
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

function focusTasks() {
  const tasks = state.weeklyFocus.tasks || []
  const completed = tasks.filter((task) => task.done).length
  const total = tasks.length || state.weeklyFocus.total || 1
  const progress = Math.round(completed / total * 100)
  return { tasks, completed, total, progress }
}

function weeklyFocusSection() {
  const focus = focusTasks()
  const expanded = state.focusExpanded
  return `<section class="weekly-focus">
    <button class="focus-head" data-toggle-focus><div><p class="kicker">Фокус недели</p><h2>${state.weeklyFocus.title}</h2></div><div class="focus-side"><strong>${focus.progress}%</strong><i>${expanded ? '⌃' : '⌄'}</i></div></button>
    <div class="progress-track"><span style="width:${focus.progress}%"></span></div>
    <div class="focus-meta"><span>${focus.completed} из ${focus.total} задач</span><span>до ${state.weeklyFocus.deadline}</span></div>
    ${expanded && focus.tasks.length ? `<div class="focus-tasks">${focus.tasks.map((task,index) => `<button class="task-row ${task.done ? 'done' : ''}" data-focus-task="${index}"><span class="task-check">${task.done ? '✓' : ''}</span><span><b>${task.text}</b></span></button>`).join('')}</div>` : ''}
    ${expanded && !focus.tasks.length ? '<small class="focus-empty">Задачи фокуса появятся, когда разбиваем цель на шаги</small>' : ''}
  </section>`
}

function todayView() {
  const completed = state.dayTasks.filter((task) => task.status === 'done').length
  return `${header()}
    ${weekStrip()}

    ${weeklyFocusSection()}

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

function moscowToday() {
  return new Date(new Date().toLocaleString('en-US', { timeZone:'Europe/Moscow' }))
}

function currentWeekDays(base = moscowToday()) {
  const dayOfWeek = (base.getDay() + 6) % 7
  const monday = new Date(base)
  monday.setDate(base.getDate() - dayOfWeek)
  return Array.from({length:7},(_,offset) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + offset)
    return { date, day: date.getDate(), month: date.getMonth(), isToday: date.toDateString() === moscowToday().toDateString(), inMonth: date.getMonth() === base.getMonth() }
  })
}

const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

function calendarView() {
  const today = moscowToday()
  const viewMonth = state.calendarMonth != null ? state.calendarMonth : today.getMonth()
  const viewYear = state.calendarYear != null ? state.calendarYear : today.getFullYear()
  const eventsByDay = new Map(state.calendarEvents.map((event) => [event.day, event]))
  const weekBase = new Date(viewYear, viewMonth, state.calendarCollapsed === false ? Math.min(today.getDate(), 28) : today.getDate())
  if (state.calendarCollapsed !== false && (viewMonth !== today.getMonth() || viewYear !== today.getFullYear())) {
    weekBase.setMonth(viewMonth, 1)
  }
  const week = currentWeekDays(weekBase)
  const collapsed = state.calendarCollapsed !== false
  const firstOfMonth = new Date(viewYear, viewMonth, 1)
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const daysLeftInWeek = 7 - ((today.getDay() + 6) % 7 + 1) + 1
  return `${header('Календарь')}
    <section class="time-left"><div><p class="kicker">До конца недели</p><strong>${daysLeftInWeek} дн</strong></div><div class="week-meter"><span style="width:${Math.round((7 - daysLeftInWeek + 1) / 7 * 100)}%"></span></div><small>Главная контрольная точка – 31 августа</small></section>
    ${collapsed ? `<div class="week-strip-card"><div class="section-line"><h2>Текущая неделя</h2><button class="text-button" data-toggle-month>Весь месяц</button></div>
      <div class="week-days">${week.map(({day,isToday,hasEvent}) => `<div class="week-day ${isToday ? 'today' : ''}"><span>${day}</span>${eventsByDay.has(day) ? '<i></i>' : ''}</div>`).join('')}</div></div>`
    : `<div class="calendar-head">
        <button data-prev-month>‹</button>
        <h2>${monthNames[viewMonth]} ${viewYear}</h2>
        <div class="head-actions"><button data-toggle-month>Свернуть</button><button data-next-month>›</button></div>
      </div>
    <div class="calendar-weekdays">${['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'].map((day) => `<span>${day}</span>`).join('')}</div>
    <div class="month-grid">${Array(leadingBlanks).fill('<span class="calendar-day empty"></span>').join('')}${Array.from({length:daysInMonth},(_,i) => {
      const day = i + 1
      const isToday = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()
      const event = eventsByDay.get(day)
      return `<button class="calendar-day ${isToday ? 'today' : ''} ${event ? 'has-event' : ''}"><span>${day}</span>${event ? `<i class="${event.type}"></i>` : ''}</button>`
    }).join('')}</div>`}
    <section class="agenda-block plain-section">
      <div class="section-line"><h2>Планы и дедлайны</h2>
        <div class="agenda-filters">${[['all','Все'],['task','Задачи'],['payment','Оплаты'],['deadline','Дедлайны']].map(([key,label]) => `<button class="${(state.agendaFilter || 'all') === key ? 'active' : ''}" data-agenda-filter="${key}">${label}</button>`).join('')}</div>
      </div>
      <div class="calendar-agenda">${state.calendarEvents.filter((event) => (state.agendaFilter || 'all') === 'all' || event.type === state.agendaFilter).map((event) => `
        <button class="agenda-row" data-event-id="${event.id}"><time><b>${event.day}</b><small>АВГ</small></time><span><b>${event.label}</b><small>${{task:'Задача',payment:'Оплата',deadline:'Дедлайн',focus:'Фокус недели'}[event.type]}${event.comments?.length ? ` · комментариев: ${event.comments.length}` : ''}</small></span><em class="${event.type}"></em></button>`).join('') || '<div class="subtle-note">Пусто</div>'}</div>
    </section>`
}

function deadlineBadge(project) {
  const days = daysUntil(project.deadlineDate)
  if (days == null) return ''
  if (days < 0) return `<span class="deadline-badge overdue">просрочен ${Math.abs(days)} дн</span>`
  if (days === 0) return '<span class="deadline-badge today">дедлайн сегодня</span>'
  return `<span class="deadline-badge">– ${days} дн</span>`
}

function projectsView() {
  if (state.selectedProjectId) return projectDetail(state.projects.find((project) => project.id === state.selectedProjectId))
  const summary = moneySummary(state)
  const projects = filterProjects(state)
  const tabs = [['all','Все'],['active','В работе'],['waiting','Ожидание'],['archived','Архив']]
  return `${header(`${state.projects.length} проектов`)}
    <section class="money-summary">
      <div><small>Проектов на сумму</small><b>${formatMoney(summary.total)}</b></div>
      <div><small>Оплачено</small><b class="mint">${formatMoney(summary.paid)}</b></div>
      <div><small>Остаток</small><b class="amber">${formatMoney(summary.rest)}</b></div>
    </section>
    <div class="segmented">${tabs.map(([key,label]) => `<button class="${state.projectFilter === key ? 'active' : ''}" data-project-filter="${key}">${label}</button>`).join('')}</div>
    <div class="filter-row"><small>Сортировка:</small>${[['created','по созданию'],['deadline','по дедлайну'],['rest','по остатку']].map(([key,label]) => `<button class="${state.projectSort === key ? 'active' : ''}" data-project-sort="${key}">${label}</button>`).join('')}</div>
    <div class="object-list">${projects.map((project) => {
      const [label,tone] = projectStatus[project.status]
      const progress = projectProgress(project)
      return `<button class="object-row" data-project-id="${project.id}"><span class="object-mark ${tone}">${project.title[0]}</span><span class="object-copy"><small>${label}${progress != null ? ` · ${progress}%` : ''}</small><b>${project.title}</b><em>${project.nextAction || project.description}</em></span><span class="object-side"><small>${project.deadlineText ? project.deadlineText : (project.payment.rest ? formatMoney(project.payment.total - project.payment.paid) : '')}</small><i>›</i></span>${deadlineBadge(project)}</button>`
    }).join('') || '<div class="subtle-note">Пока пусто</div>'}</div>
    <button class="round-add" data-create-project>＋</button>
    ${state.createFormOpen ? createProjectForm() : ''}`
}

function createProjectForm() {
  return `<div class="modal-backdrop"><div class="comment-sheet">
    <button class="sheet-close" data-close-create>×</button>
    <h2>Новый проект</h2>
    <label><span>Название</span><input data-new-title placeholder="Например: Воронка для школы"/></label>
    <label><span>Клиент</span><input data-new-client placeholder="Имя клиента"/></label>
    <label><span>Сумма, ₽</span><input data-new-total inputmode="numeric" placeholder="50000"/></label>
    <label><span>Дедлайн</span><input data-new-deadline type="date"/></label>
    <label class="check-line"><input type="checkbox" data-new-started/> <span>Уже взял в работу</span></label>
    <button class="primary-action save-comment" data-save-create>Создать</button>
  </div></div>`
}

function projectDetail(project) {
  const [label,tone] = projectStatus[project.status] || ['Без статуса','muted']
  const progress = projectProgress(project)
  const createdDays = Math.max(0, Math.floor((Date.now() - new Date(project.createdAt)) / 86400000))
  const menuOpen = state.projectMenuOpen
  return `<header class="detail-top"><button data-back-projects>‹</button><div><p class="kicker">Проект · идёт ${createdDays} дн</p><h1>${project.title}</h1></div><button data-toggle-project-menu>•••</button></header>
    <section class="detail-summary">${deadlineBadge(project)}<span class="status-pill ${tone}">${label}</span>${progress != null ? `<div class="progress-track slim"><span style="width:${progress}%"></span></div><small>Завершён на ${progress}%</small>` : ''}
      <p>${project.description || ''}</p>
      ${menuOpen ? `<div class="project-menu">
        <div class="menu-label">Статус</div>
        <div class="status-options">${Object.entries(projectStatus).map(([key,[name]]) => `<button class="${project.status === key ? 'selected' : ''}" data-set-status="${key}">${name}</button>`).join('')}</div>
        ${project.url ? `<a class="menu-link" href="${project.url}" target="_blank" rel="noopener">Открыть ссылку →</a>` : `<button data-edit-url>Добавить ссылку</button>`}
        <button class="danger" data-delete-project>Удалить из списка</button>
      </div>` : ''}
      <div class="next-block"><small>Ближайшее действие</small><b>${project.nextAction || 'Не задано'}</b><span>Следующий ход: ${project.nextMove || '–'}</span></div></section>
    <section class="data-section"><h2>Оплата</h2><div class="stats-inline"><div><small>Всего</small><b>${formatMoney(project.payment?.total)}</b></div><div><small>Оплачено</small><b>${formatMoney(project.payment?.paid)}</b></div><div><small>Остаток</small><b>${formatMoney((project.payment?.total||0) - (project.payment?.paid||0) || null)}</b></div></div></section>
    <section class="data-section"><div class="section-line"><h2>Дорожная карта</h2>${project.roadmap.length ? `<span>${project.roadmap.filter((step) => step.done).length}/${project.roadmap.length}</span>` : ''}</div>
      ${project.roadmap.length ? `<ol class="timeline clickable">${project.roadmap.map((step,index) => `<li class="${step.done ? 'done' : index === 0 && !project.roadmap.some((s) => !s.done) ? 'active' : ''}" data-roadmap-step="${index}"><span>${index + 1}</span><b>${step.text}</b></li>`).join('')}</ol>` : '<div class="text-box muted-box">Карта появится после согласования с клиентом</div>'}
      <div class="stack-actions grid-2x2"><button data-add-item="task">+ Задание</button><button data-add-item="question">+ Вопрос клиенту</button><button data-edit-url>${project.url ? 'Ссылка' : '+ Ссылка'}</button><button class="danger-btn" data-delete-project>Удалить</button></div>
      ${project.items.length ? `<div class="items-list">${project.items.map((item,index) => `<button class="item-row ${item.done ? 'done' : ''}" data-item-index="${index}"><span>${item.done ? '✓' : '○'}</span><b>${item.text}</b><small>${item.kind === 'question' ? 'вопрос' : 'задание'}</small></button>`).join('')}</div>` : ''}
    </section>`
}

const vacancyFilters = [
  ['all', 'Все'],
  ['new', 'Новые'],
  ['not-sent', 'Отклик не отправлен'],
  ['sent', 'Отправлено'],
]

function vacanciesView() {
  if (state.selectedVacancyId) return vacancyDetail(state.vacancies.find((vacancy) => vacancy.id === state.selectedVacancyId))
  const paused = state.vacancySearch.status === 'paused'
  const filter = state.vacancyFilter || 'all'
  const filtered = state.vacancies.filter((vacancy) => {
    if (filter === 'new') return vacancy.status === 'review'
    if (filter === 'sent') return vacancy.status === 'sent'
    if (filter === 'not-sent') return vacancy.status !== 'sent'
    return true
  })
  return `${header('Поиск по будням')}
    <section class="search-schedule compact ${state.searchExpanded ? 'expanded' : ''}">
      <button class="search-summary" data-toggle-search><span class="live-dot ${paused ? 'paused' : ''}"></span><b>${paused ? 'Автопоиск остановлен' : 'Автопоиск включён'}</b><i>${state.searchExpanded ? '⌃' : '⌄'}</i></button>
      ${state.searchExpanded ? `<div class="search-details"><p>Будни · ${state.vacancySearch.schedule.join(' · ')}</p><small>Новые совпадения отправляются в проверочный чат. Повторы пропускаются.</small><div class="search-actions">${paused ? `<button class="primary-action" data-search-pause="false">Включить поиск</button>` : `<button class="primary-action" data-search-now>${state.searchBusy ? 'Запускаю…' : 'Внеплановый поиск'}</button><button data-search-pause="true">Остановить поиск</button>`}</div></div>` : ''}
    </section>
    <div class="section-line list-heading">
      <div><p class="kicker">${filtered.length} вакансий</p><h2>Подходящие</h2></div>
      <button class="kebab" data-toggle-vacancy-menu aria-label="Действия">⋮</button>
    </div>
    ${state.vacancyMenuOpen ? `<div class="vacancy-menu">
      ${['review','later','preparing','sent'].map((status) => `<div class="menu-row"><small>Перевести все в:</small><b>${vacancyStatus[status]}</b><button data-bulk-vacancy="${status}">ОК</button></div>`).join('')}
      <small class="menu-hint">Меню раздела: массовые действия по статусам</small>
    </div>` : ''}
    <div class="segmented slim">${vacancyFilters.map(([key,label]) => `<button class="${filter === key ? 'active' : ''}" data-vacancy-filter="${key}">${label}</button>`).join('')}</div>
    <div class="object-list">${filtered.map((vacancy) => `<button class="object-row vacancy" data-vacancy-id="${vacancy.id}"><span class="match-score">${vacancy.match}</span><span class="object-copy"><small>${vacancy.company}</small><b>${vacancy.title}</b><em>${vacancy.format} · ${vacancy.salary}</em></span><span class="object-side"><small>${vacancyStatus[vacancy.status]}</small><i>›</i></span></button>`).join('') || '<div class="subtle-note">Пусто</div>'}</div>`
}

function vacancyDetail(vacancy) {
  const comments = vacancy.comments || []
  return `<header class="detail-top"><button data-back-vacancies>‹</button><div><p class="kicker">${vacancy.company}</p><h1>${vacancy.title}</h1></div><a class="kebab" href="${vacancy.url && vacancy.url !== '#' ? vacancy.url : '#'}" target="_blank" rel="noopener" title="Открыть вакансию">↗</a></header>
    <section class="detail-summary"><div class="large-match"><b>${vacancy.match}</b><span>% соответствие</span></div><p>${vacancy.summary}</p><div class="tag-line"><span>${vacancy.format}</span><span>${vacancy.salary}</span></div></section>
    <section class="data-section"><div class="section-line"><h2>Действие</h2><span class="status-pill muted" data-vacancy-status>${vacancyStatus[vacancy.status]}</span></div><div class="stack-actions"><button class="primary-action" data-prepare-response>${vacancy.status === 'preparing' ? 'Отклик готовится…' : 'Подготовить отклик'}</button><button data-vacancy-action="sent">Я отправил</button><button data-vacancy-action="later">Посмотреть позже</button></div>
      ${!vacancy.url || vacancy.url === '#' ? '<button class="link-add" data-add-vacancy-url>+ Добавить ссылку на вакансию</button>' : `<a class="link-add" href="${vacancy.url}" target="_blank" rel="noopener">Открыть вакансию ↗</a>`}
    </section>
    <section class="data-section"><h2>Мои заметки</h2>
      <textarea data-vacancy-comment maxlength="1000" placeholder="Что важно помнить про эту вакансию…">${(vacancy.note || '')}</textarea>
      <button class="save-note" data-save-vacancy-note>Сохранить заметку</button>
    </section>
    <section class="data-section"><h2>Отклик</h2><div class="text-box">${vacancy.response}</div></section>`
}

function scaleButtons(type, value) {
  return `<div class="scale-row">${[1,2,3,4,5].map((number) => `<button class="${value === number ? 'selected' : ''}" data-${type}="${number}">${number}</button>`).join('')}</div>`
}

function currentCheckinType() {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/Moscow', hour:'2-digit', hour12:false }).format(new Date()))
  return getCheckinType(hour)
}

function metricQuestion(kicker, title, type, value) {
  return `<div class="check-question"><p class="kicker">${kicker}</p><h2>${title}</h2>${scaleButtons(type,value)}</div>`
}

function moscowDateString() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Moscow', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type,part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function lastCheckinInfo() {
  const real = state.wellbeingHistory.filter((entry) => !entry.demo)
  const last = real.at(-1)
  if (!last) return null
  const time = new Date(last.timestamp).toLocaleString('ru-RU', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
  return { time, type: { morning:'утренний', day:'дневной', evening:'вечерний' }[last.type] || '' }
}

const quickActivities = [
  ['project', 'Работа над проектом'],
  ['cleaning', 'Уборка'],
  ['meal', 'Завтрак / обед / ужин'],
  ['rest', 'Отдых'],
]

function checkinView() {
  const type = currentCheckinType()
  const sleepAlreadyRecorded = hasSleepEntryForDate(state.wellbeingHistory,moscowDateString())
  const defaultMeta = {
    morning: ['Утренний чек-ин','Как начался день'],
    day: ['Дневной чек-ин','Как проходит рабочий день'],
    evening: ['Вечерний чек-ин','Как завершился день'],
  }[type]
  const meta = type === 'morning' && sleepAlreadyRecorded ? ['Состояние сейчас','Как ты себя чувствуешь сейчас'] : defaultMeta
  const sleep = type === 'morning' && !sleepAlreadyRecorded ? `<div class="check-question"><p class="kicker">Сон</p><h2>Сколько часов спал?</h2><div class="sleep-grid">${Array.from({length:12},(_,hours) => `<button class="${state.checkin.sleepHours === hours ? 'selected' : ''}" data-sleep-hours="${hours}">${hours}</button>`).join('')}</div></div>${metricQuestion('Качество сна','Насколько восстановился?','sleep-quality',state.checkin.sleepQuality)}` : ''
  const last = lastCheckinInfo()
  return `${header(meta[0])}
    <div class="checkin-intro"><span>${{morning:'☼',day:'◐',evening:'◒'}[type]}</span><div><p class="kicker">${meta[0]}</p><h2>${meta[1]}</h2><small>${last ? `Последний чек-ин: ${last.type}, ${last.time}` : 'Первый чек-ин – время сохранится автоматически'}</small></div></div>
    <section class="checkin-sheet"><div class="checkin-status"><span style="width:${state.checkin.energy && state.checkin.mood ? '68%' : state.checkin.energy ? '35%' : '10%'}"></span></div>
      ${sleep}
      ${metricQuestion('Энергия','Сколько сил сейчас?','energy',state.checkin.energy)}
      ${metricQuestion('Настроение','Как ты себя чувствуешь?','mood',state.checkin.mood)}
      ${metricQuestion('Концентрация','Насколько легко держать фокус?','focus',state.checkin.focus)}
      ${metricQuestion('Тревога','Насколько тревожно?','anxiety',state.checkin.anxiety)}
      <div class="check-question"><p class="kicker">Контекст</p><h2>Что отвлекает?</h2><div class="choice-chips">${[['phone','Телефон'],['tasks','Другие задачи'],['state','Состояние'],['none','Ничего']].map(([key,label]) => `<button class="${state.checkin.distraction === key ? 'selected' : ''}" data-distraction="${key}">${label}</button>`).join('')}</div></div>
      <div class="check-question"><p class="kicker">Чем занят сейчас</p><h2>Свободная заметка</h2><div class="choice-chips wrap">${quickActivities.map(([key,label]) => `<button class="${state.checkin.activity === key ? 'selected' : ''}" data-activity="${key}">${label}</button>`).join('')}</div><textarea data-activity-note maxlength="500" placeholder="Что именно делаешь? (необязательно)">${state.checkin.activityNote || ''}</textarea></div>
      <button class="complete-checkin" data-submit-checkin>Завершить чек-ин</button>
    </section>${state.checkinResult ? `<div class="result-note"><span>✓</span><div><small>Следующее действие</small><b>${state.checkinResult.replace('Следующее действие: ','')}</b></div></div>` : ''}`
}

function wellbeingSection() {
  const entries = state.wellbeingHistory
  const stats = calculateWellbeingStats(entries)
  const typeNames = { morning:'Утро', day:'День', evening:'Вечер' }
  const typeTimes = { morning:'07:00–11:59', day:'12:00–17:59', evening:'18:00–23:59' }
  const days = [18,19,20,21,22,23,24]
  const energyByDay = days.map((day) => {
    const dayEntries = entries.filter((entry) => entry.day === day)
    const average = dayEntries.length ? dayEntries.reduce((sum,entry) => sum + entry.energy,0) / dayEntries.length : 0
    return Math.round(average / 5 * 100)
  })
  return `<section class="wellbeing-section">
    <div class="wellbeing-head"><div><p class="kicker">Состояние</p><h2>Последние ${state.wellbeingPeriod} дней</h2></div><div class="period-toggle"><button class="${state.wellbeingPeriod === 7 ? 'active' : ''}" data-wellbeing-period="7">7</button><button class="${state.wellbeingPeriod === 30 ? 'active' : ''}" data-wellbeing-period="30">30</button></div></div>
    <div class="demo-data-label">${state.serverConnected ? `Данные из базы · ${stats.sampleSize} чек-ин` : `Демонстрационные данные · ${stats.sampleSize} чек-ин`}</div>
    <div class="wellbeing-metrics">
      <div><small>Энергия</small><b>${stats.averageEnergy}</b><span>/ 5</span></div>
      <div><small>Настроение</small><b>${stats.averageMood}</b><span>/ 5</span></div>
      <div><small>Фокус</small><b>${stats.averageFocus}</b><span>/ 5</span></div>
      <div><small>Тревога</small><b>${stats.averageAnxiety}</b><span>/ 5</span></div>
      <div><small>Сон</small><b>${stats.averageSleep}</b><span>ч</span></div>
      <div><small>Качество сна</small><b>${stats.averageSleepQuality}</b><span>/ 5</span></div>
    </div>
    <div class="peak-card"><div class="peak-clock">◷</div><div><p class="kicker">Пиковая энергия</p><h3>${typeNames[stats.peakEnergyType]}</h3><span>${typeTimes[stats.peakEnergyType]}</span></div><b>↑</b></div>
    <div class="energy-chart"><div class="section-line"><h3>Энергия по дням</h3><span>средний балл</span></div><div class="energy-bars">${energyByDay.map((height,index) => `<i style="height:${height}%" class="${index === 6 ? 'active' : ''}"><b>${Math.round(height/20*10)/10}</b></i>`).join('')}</div><div class="energy-labels">${['18','19','20','21','22','23','24'].map((day) => `<small>${day}</small>`).join('')}</div></div>
    <div class="insight-note"><span>≈</span><p><b>Наблюдение</b> В демонстрационных данных энергия выше вечером. Это гипотеза, которую нужно проверить на реальных чек-инах за 7–14 дней.</p></div>
  </section>`
}

function profileOverlay() {
  if (!state.profileOpen) return ''
  const stats = getProfileStats(state)
  const completion = Math.round(stats.completedToday / stats.totalToday * 100)
  return `<div class="profile-overlay"><header class="profile-head"><button data-close-profile>×</button><div class="profile-avatar">Д</div><h1>Денис</h1><p>Личная операционная статистика</p></header>
    <section class="profile-rings"><div class="stat-ring mint-ring" style="--value:${state.weeklyFocus.progress * 3.6}deg"><span><b>${state.weeklyFocus.progress}%</b><small>Неделя</small></span></div><div class="stat-ring amber-ring" style="--value:${completion * 3.6}deg"><span><b>${completion}%</b><small>Сегодня</small></span></div></section>
    <section class="profile-grid"><div><b>${stats.activeProjects}</b><span>Активных проекта</span></div><div><b>${stats.riskyProjects}</b><span>Проекта с риском</span></div><div><b>${stats.totalVacancies}</b><span>Вакансии</span></div><div><b>${stats.responsesPreparing}</b><span>Готовим отклики</span></div></section>
    <section class="profile-block"><div class="section-line"><h2>Активность</h2><span>7 дней</span></div><div class="bars">${[34,52,28,68,42,78,40].map((height,index) => `<i style="height:${height}%" class="${index === 6 ? 'active' : ''}"></i>`).join('')}</div><div class="bar-labels">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((day) => `<small>${day}</small>`).join('')}</div></section>
    ${wellbeingSection()}
    <section class="future-note"><p class="kicker">Следующий этап</p><h2>Контакты и мероприятия</h2><p>База знакомств, участников мероприятий и людей, которые перешли в бота.</p></section>
  </div>`
}

function eventCommentSheet() {
  if (!state.selectedEventId) return ''
  const event = state.calendarEvents.find((item) => Number(item.id) === Number(state.selectedEventId))
  if (!event) return ''
  return `<div class="modal-backdrop"><div class="comment-sheet"><button class="sheet-close" data-close-event>×</button><p class="kicker">${event.day} августа</p><h2>${event.label}</h2><div class="comment-list">${event.comments?.length ? event.comments.map((comment) => `<div><p>${comment.text}</p><div class="comment-meta"><small>${new Date(comment.createdAt).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small><button class="comment-delete" data-delete-comment="${comment.id}" title="Удалить">×</button></div></div>`).join('') : '<span>Комментариев пока нет</span>'}</div><label><span>Новый комментарий</span><textarea data-comment-input maxlength="2000" placeholder="Добавить уточнение, договорённость или заметку…">${state.eventCommentDraft}</textarea></label><button class="primary-action save-comment" data-save-comment ${state.eventCommentDraft.trim() ? '' : 'disabled'}>Сохранить</button></div></div>`
}

function confirmation() {
  if (!state.confirmCompletion) return ''
  return `<div class="modal-backdrop"><div class="confirm-modal"><span class="confirm-icon">✓</span><h2>Задача завершена?</h2><p>${state.currentTask.title}</p><button class="primary-action" data-confirm-completion>Да, показать следующую</button><button data-cancel-completion>Вернуться</button></div></div>`
}

function bottomNav() {
  if (state.selectedProjectId || state.selectedVacancyId || state.profileOpen) return ''
  return `<nav class="bottom-dock">${navItems.map(([key,icon,label]) => `<button class="${state.activeScreen === key ? 'active' : ''}" data-nav="${key}"><span>${icon}</span><small>${label}</small></button>`).join('')}</nav>`
}

async function updateSelectedProject(patch) {
  const projectId = state.selectedProjectId
  if (!projectId) return null
  try {
    const result = await apiRequest(`/api/projects/${projectId}`, { method:'POST', body:JSON.stringify(patch) })
    setState(mergeServerState(result.state))
    return result.project
  } catch (error) {
    console.warn('Project was not updated',error)
    return null
  }
}

function bindEvents() {
  document.querySelectorAll('[data-nav]').forEach((button) => button.addEventListener('click', () => setState({ ...state, activeScreen: button.dataset.nav, selectedProjectId: null, selectedVacancyId: null })))
  document.querySelectorAll('[data-open-profile]').forEach((button) => button.addEventListener('click', () => setState({ ...state, profileOpen: true })))
  document.querySelectorAll('[data-vacancy-filter]').forEach((button) => button.addEventListener('click', () => setState({ ...state, vacancyFilter:button.dataset.vacancyFilter })))
  document.querySelector('[data-toggle-vacancy-menu]')?.addEventListener('click', () => setState({ ...state, vacancyMenuOpen:!state.vacancyMenuOpen }))
  document.querySelectorAll('[data-bulk-vacancy]').forEach((button) => button.addEventListener('click', async (event) => {
    event.stopPropagation()
    const status = button.dataset.bulkVacancy
    try {
      for (const vacancy of state.vacancies) {
        await apiRequest(`/api/vacancies/${vacancy.id}/status`, { method:'POST', body:JSON.stringify({ status }) })
      }
      const serverState = await apiRequest('/api/state')
      setState({ ...mergeServerState(serverState), vacancyMenuOpen:false })
    } catch (error) { console.warn('Bulk status was not applied',error) }
  }))
  document.querySelector('[data-add-vacancy-url]')?.addEventListener('click', async () => {
    const url = window.prompt('Ссылка на вакансию:', '')
    if (!url?.trim() || !state.selectedVacancyId) return
    try {
      const result = await apiRequest(`/api/vacancies/${state.selectedVacancyId}/details`, { method:'POST', body:JSON.stringify({ url:url.trim() }) })
      setState(mergeServerState(result.state))
    } catch (error) { console.warn('Vacancy URL was not saved',error) }
  })
  document.querySelector('[data-save-vacancy-note]')?.addEventListener('click', async () => {
    const note = document.querySelector('[data-vacancy-comment]')?.value.trim()
    if (note == null || !state.selectedVacancyId) return
    try {
      const result = await apiRequest(`/api/vacancies/${state.selectedVacancyId}/details`, { method:'POST', body:JSON.stringify({ note }) })
      setState(mergeServerState(result.state))
    } catch (error) { console.warn('Vacancy note was not saved',error) }
  })
  document.querySelectorAll('[data-project-filter]').forEach((button) => button.addEventListener('click', () => setState({ ...state, projectFilter:button.dataset.projectFilter })))
  document.querySelectorAll('[data-project-sort]').forEach((button) => button.addEventListener('click', () => setState({ ...state, projectSort:button.dataset.projectSort })))
  document.querySelector('[data-create-project]')?.addEventListener('click', () => setState({ ...state, createFormOpen:true }))
  document.querySelector('[data-close-create]')?.addEventListener('click', () => setState({ ...state, createFormOpen:false }))
  document.querySelector('[data-save-create]')?.addEventListener('click', async () => {
    const title = document.querySelector('[data-new-title]')?.value.trim()
    if (!title) return
    try {
      const result = await apiRequest('/api/projects', { method:'POST', body:JSON.stringify({
        title,
        client: document.querySelector('[data-new-client]')?.value,
        total: Number((document.querySelector('[data-new-total]')?.value || '').replace(/\D/g,'')) || null,
        deadlineDate: document.querySelector('[data-new-deadline]')?.value || null,
        started: document.querySelector('[data-new-started]')?.checked,
      }) })
      setState({ ...mergeServerState(result.state), createFormOpen:false, selectedProjectId:result.project.id })
    } catch (error) { console.warn('Project was not created',error) }
  })
  document.querySelector('[data-toggle-month]')?.addEventListener('click', () => setState({ ...state, calendarCollapsed: state.calendarCollapsed === false ? true : false }))
  document.querySelector('[data-prev-month]')?.addEventListener('click', () => {
    const today = moscowToday()
    let month = (state.calendarMonth != null ? state.calendarMonth : today.getMonth()) - 1
    let year = state.calendarYear != null ? state.calendarYear : today.getFullYear()
    if (month < 0) { month = 11; year -= 1 }
    setState({ ...state, calendarMonth: month, calendarYear: year })
  })
  document.querySelector('[data-next-month]')?.addEventListener('click', () => {
    const today = moscowToday()
    let month = (state.calendarMonth != null ? state.calendarMonth : today.getMonth()) + 1
    let year = state.calendarYear != null ? state.calendarYear : today.getFullYear()
    if (month > 11) { month = 0; year += 1 }
    setState({ ...state, calendarMonth: month, calendarYear: year })
  })
  document.querySelectorAll('[data-agenda-filter]').forEach((button) => button.addEventListener('click', () => setState({ ...state, agendaFilter:button.dataset.agendaFilter })))
  document.querySelector('[data-toggle-focus]')?.addEventListener('click', () => setState({ ...state, focusExpanded:!state.focusExpanded }))
  document.querySelectorAll('[data-focus-task]').forEach((row) => row.addEventListener('click', async () => {
    const index = Number(row.dataset.focusTask)
    const tasks = (state.weeklyFocus.tasks || []).map((task,i) => i === index ? { ...task, done:!task.done } : task)
    const completed = tasks.filter((task) => task.done).length
    const progress = Math.round(completed / (tasks.length || 1) * 100)
    try {
      await apiRequest('/api/settings/weekly_focus', { method:'POST', body:JSON.stringify({ ...state.weeklyFocus, tasks, completed, total:tasks.length, progress }) })
      setState({ ...state, weeklyFocus: { ...state.weeklyFocus, tasks, completed, total:tasks.length, progress } })
    } catch { setState({ ...state, weeklyFocus: { ...state.weeklyFocus, tasks, completed, total:tasks.length, progress } }) }
  }))
  document.querySelector('[data-toggle-project-menu]')?.addEventListener('click', () => setState({ ...state, projectMenuOpen:!state.projectMenuOpen }))
  document.querySelectorAll('[data-set-status]').forEach((button) => button.addEventListener('click', () => updateSelectedProject({ status:button.dataset.setStatus })))
  document.querySelectorAll('[data-roadmap-step]').forEach((stepElement) => stepElement.addEventListener('click', async () => {
    const project = state.projects.find((item) => item.id === state.selectedProjectId)
    if (!project) return
    const roadmap = project.roadmap.map((step,index) => ({ text:step.text, done: index === Number(stepElement.dataset.roadmapStep) ? !step.done : step.done }))
    updateSelectedProject({ roadmap })
  }))
  document.querySelectorAll('[data-add-item]').forEach((button) => button.addEventListener('click', () => {
    const kind = button.dataset.addItem
    const text = window.prompt(kind === 'question' ? 'Вопрос клиенту:' : 'Что за задание?')
    if (!text?.trim()) return
    const project = state.projects.find((item) => item.id === state.selectedProjectId)
    updateSelectedProject({ items: [...(project.items || []), { kind, text:text.trim(), done:false }] })
  }))
  document.querySelectorAll('[data-item-index]').forEach((row) => row.addEventListener('click', () => {
    const project = state.projects.find((item) => item.id === state.selectedProjectId)
    const index = Number(row.dataset.itemIndex)
    updateSelectedProject({ items: project.items.map((item,i) => i === index ? { ...item, done:!item.done } : item) })
  }))
  document.querySelector('[data-delete-project]')?.addEventListener('click', async () => {
    if (!window.confirm('Удалить проект из списка?')) return
    try {
      const result = await apiRequest(`/api/projects/${state.selectedProjectId}`, { method:'POST', body:JSON.stringify({ delete:true }) })
      setState({ ...mergeServerState(result.state), selectedProjectId:null, projectMenuOpen:false })
    } catch (error) { console.warn('Project was not deleted',error) }
  })
  document.querySelector('[data-edit-url]')?.addEventListener('click', () => {
    const url = window.prompt('Ссылка на вакансию/чат/документ:', '')
    if (url?.trim()) updateSelectedProject({ url:url.trim() })
  })
  document.querySelectorAll('[data-activity]').forEach((button) => button.addEventListener('click', () => setState({ ...state, checkin: { ...state.checkin, activity: button.dataset.activity } })))
  document.querySelector('[data-activity-note]')?.addEventListener('input', (event) => {
    state.checkin.activityNote = event.target.value
  })
  document.querySelector('[data-close-profile]')?.addEventListener('click', () => setState({ ...state, profileOpen: false }))
  document.querySelectorAll('[data-event-id]').forEach((button) => button.addEventListener('click', () => setState({ ...state, selectedEventId:Number(button.dataset.eventId), eventCommentDraft:'' })))
  document.querySelector('[data-close-event]')?.addEventListener('click', () => setState({ ...state, selectedEventId:null, eventCommentDraft:'' }))
  document.querySelectorAll('[data-delete-comment]').forEach((button) => button.addEventListener('click', async (event) => {
    event.stopPropagation()
    try {
      const result = await apiRequest(`/api/comments/${button.dataset.deleteComment}`, { method:'POST', body:'{}' })
      setState(mergeServerState(result.state))
    } catch (error) { console.warn('Comment was not deleted',error) }
  }))
  document.querySelector('[data-comment-input]')?.addEventListener('input', (event) => {
    state.eventCommentDraft = event.target.value
    const save = document.querySelector('[data-save-comment]')
    if (save) save.disabled = !state.eventCommentDraft.trim()
  })
  document.querySelector('[data-save-comment]')?.addEventListener('click', async () => {
    const eventId = state.selectedEventId
    const text = state.eventCommentDraft.trim()
    if (!text || state.commentSaving) return
    state.commentSaving = true
    try {
      const result = await apiRequest(`/api/calendar/${eventId}/comments`, { method:'POST', body:JSON.stringify({ text }) })
      state = { ...mergeServerState(result.state), selectedEventId:eventId, eventCommentDraft:'' }
      render()
    } catch (error) { console.warn('Comment was not saved',error) }
    state.commentSaving = false
  })
  document.querySelector('[data-toggle-search]')?.addEventListener('click', () => setState({ ...state, searchExpanded:!state.searchExpanded }))
  document.querySelector('[data-search-now]')?.addEventListener('click', async () => {
    if (state.searchBusy) return
    setState({ ...state, searchBusy:true, searchExpanded:true })
    try {
      await apiRequest('/api/vacancy-search/run', { method:'POST', body:'{}' })
    } catch (error) { console.warn('Unplanned search was not started',error) }
    setState({ ...state, searchBusy:false, searchExpanded:true })
  })
  document.querySelector('[data-search-pause]')?.addEventListener('click', async (event) => {
    const paused = event.currentTarget.dataset.searchPause === 'true'
    try {
      const result = await apiRequest('/api/vacancy-search/pause', { method:'POST', body:JSON.stringify({ paused }) })
      setState({ ...mergeServerState(result.state), searchExpanded:true })
    } catch (error) { console.warn('Search schedule was not changed',error) }
  })
  document.querySelectorAll('[data-task-status]').forEach((button) => button.addEventListener('click', async () => {
    const nextStatus = button.dataset.taskStatus
    const taskId = state.currentTask.id
    setState(setCurrentTaskStatus(state,nextStatus))
    try {
      const serverState = await apiRequest(`/api/tasks/${taskId}/status`, { method:'POST', body:JSON.stringify({ status:nextStatus }) })
      setState(mergeServerState(serverState))
    } catch (error) { console.warn('Task status was not saved',error) }
  }))
  document.querySelector('[data-complete-current]')?.addEventListener('click', () => setState({ ...state, confirmCompletion: true }))
  document.querySelector('[data-confirm-completion]')?.addEventListener('click', async () => {
    const taskId = state.currentTask.id
    setState({ ...completeCurrentTask(state), confirmCompletion:false })
    try {
      const result = await apiRequest(`/api/tasks/${taskId}/complete`, { method:'POST', body:'{}' })
      setState(mergeServerState(result.state))
    } catch (error) { console.warn('Task completion was not saved',error) }
  })
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
  document.querySelector('[data-prepare-response]')?.addEventListener('click', async () => {
    const vacancyId = state.selectedVacancyId
    setState(setVacancyStatus(state,vacancyId,'preparing'))
    try {
      const result = await apiRequest(`/api/vacancies/${vacancyId}/status`, { method:'POST', body:JSON.stringify({ status:'preparing' }) })
      setState(mergeServerState(result.state))
    } catch (error) { console.warn('Vacancy status was not saved',error) }
  })
  document.querySelectorAll('[data-vacancy-action]').forEach((button) => button.addEventListener('click', async () => {
    const vacancyId = state.selectedVacancyId
    const nextStatus = button.dataset.vacancyAction
    setState(setVacancyStatus(state,vacancyId,nextStatus))
    try {
      const result = await apiRequest(`/api/vacancies/${vacancyId}/status`, { method:'POST', body:JSON.stringify({ status:nextStatus }) })
      setState(mergeServerState(result.state))
    } catch (error) { console.warn('Vacancy status was not saved',error) }
  }))
  document.querySelectorAll('[data-energy]').forEach((button) => button.addEventListener('click', () => setState({ ...state, checkin: { ...state.checkin, energy:Number(button.dataset.energy) } })))
  document.querySelectorAll('[data-mood]').forEach((button) => button.addEventListener('click', () => setState({ ...state, checkin: { ...state.checkin, mood:Number(button.dataset.mood) } })))
  document.querySelectorAll('[data-focus]').forEach((button) => button.addEventListener('click', () => setState({ ...state, checkin: { ...state.checkin, focus:Number(button.dataset.focus) } })))
  document.querySelectorAll('[data-anxiety]').forEach((button) => button.addEventListener('click', () => setState({ ...state, checkin: { ...state.checkin, anxiety:Number(button.dataset.anxiety) } })))
  document.querySelectorAll('[data-sleep-quality]').forEach((button) => button.addEventListener('click', () => setState({ ...state, checkin: { ...state.checkin, sleepQuality:Number(button.dataset.sleepQuality) } })))
  document.querySelectorAll('[data-sleep-hours]').forEach((button) => button.addEventListener('click', () => setState({ ...state, checkin: { ...state.checkin, sleepHours:Number(button.dataset.sleepHours) } })))
  document.querySelectorAll('[data-distraction]').forEach((button) => button.addEventListener('click', () => setState({ ...state, checkin: { ...state.checkin, distraction:button.dataset.distraction } })))
  document.querySelectorAll('[data-wellbeing-period]').forEach((button) => button.addEventListener('click', async () => {
    const days = Number(button.dataset.wellbeingPeriod)
    setStatePreserveProfileScroll({ ...state, wellbeingPeriod:days })
    try {
      const stats = await apiRequest(`/api/stats?days=${days}`)
      const serverState = await apiRequest('/api/state')
      state = mergeServerState({ ...serverState, stats })
      render()
    } catch (error) { console.warn('Stats were not refreshed',error) }
  }))
  document.querySelector('[data-submit-checkin]')?.addEventListener('click', async () => {
    const localResult = submitCheckin(state.checkin)
    const localState = addWellbeingEntry(state,state.checkin)
    setState({ ...localState, checkinResult:localResult })
    try {
      const activity = state.checkin.activity || null
      const note = (state.checkin.activityNote || '').trim()
      if (activity || note) {
        await apiRequest('/api/activities', { method:'POST', body:JSON.stringify({ kind:activity || 'note', text: note || quickActivities.find(([key]) => key === activity)?.[1] || 'Заметка без текста' }) })
      }
      const result = await apiRequest('/api/checkins', { method:'POST', body:JSON.stringify(state.checkin) })
      setState({ ...mergeServerState(result.state), checkinResult:localResult })
    } catch (error) { console.warn('Check-in was not saved',error) }
  })
}

function render() {
  const views = { today:todayView, calendar:calendarView, projects:projectsView, vacancies:vacanciesView, checkin:checkinView }
  const content = views[state.activeScreen]()
  app.innerHTML = `<div class="app-shell"><main>${content}</main>${bottomNav()}${profileOverlay()}${confirmation()}${eventCommentSheet()}</div>`
  bindEvents()
}

render()
loadServerState()
