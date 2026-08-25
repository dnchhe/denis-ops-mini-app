import {
  addWellbeingEntry,
  calculateWellbeingStats,
  completeCurrentTask,
  createInitialState,
  daysUntil,
  filterProjects,
  filterWellbeingByDays,
  formatMoney,
  getCheckinType,
  getProfileStats,
  hasSleepEntryForDate,
  moneySummary,
  normalizeProject,
  projectProgress,
  setCurrentTaskStatus,
  setVacancyStatus,
  submitCheckin,
} from './model.js'

const initialUi = {
  confirmCompletion:false, serverConnected:false, searchExpanded:false, selectedEventId:null, eventCommentDraft:'', commentSaving:false,
  searchBusy:false, createFormOpen:false, projectQuickMenuId:null, vacancyMenuOpen:false, focusExpanded:false, calendarCollapsed:true,
  modal:null, toast:'', serverStats:null,
}
let state = { ...createInitialState(), ...initialUi }
const app = document.querySelector('#app')
const telegram = window.Telegram?.WebApp
telegram?.ready()
telegram?.expand()

const h = (value = '') => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]))
const safeUrl = (value) => {
  const raw = String(value || '').trim()
  if (!raw || raw === '#') return ''
  try {
    const url = new URL(raw)
    return ['https:','http:','tg:'].includes(url.protocol) ? url.href : ''
  } catch { return '' }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers:{ 'Content-Type':'application/json', 'X-Telegram-Init-Data':telegram?.initData || '', ...(options.headers || {}) },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.detail || payload.error || `API ${response.status}`)
  return payload
}

const uiKeys = [
  'activeScreen','selectedProjectId','selectedVacancyId','profileOpen','confirmCompletion','searchExpanded','selectedEventId','eventCommentDraft','commentSaving',
  'searchBusy','createFormOpen','projectQuickMenuId','vacancyMenuOpen','focusExpanded','calendarCollapsed','calendarMonth','calendarYear','agendaFilter',
  'projectFilter','projectSort','vacancyFilter','wellbeingPeriod','checkin','checkinResult','modal','toast','serverStats',
]
function mergeServerState(serverState) {
  const preserved = Object.fromEntries(uiKeys.filter((key) => key in state).map((key) => [key,state[key]]))
  return { ...state, ...serverState, ...preserved, serverConnected:true }
}

function setState(next) { state = next; render() }
function setStatePreserveProfileScroll(next, forcedScroll = null) {
  const scrollTop = forcedScroll ?? document.querySelector('.profile-overlay')?.scrollTop ?? 0
  state = next
  render()
  requestAnimationFrame(() => { const overlay = document.querySelector('.profile-overlay'); if (overlay) overlay.scrollTop = scrollTop })
}

async function loadServerState() {
  try {
    const serverState = await apiRequest('/api/state')
    state = mergeServerState(serverState)
    render()
  } catch (error) {
    console.warn('Server state is unavailable; demonstration state remains active', error)
    state.toast = 'Сервер недоступен — показаны локальные данные'
    render()
  }
}

const navItems = [['today','⌂','Сегодня'],['projects','▤','Проекты'],['vacancies','◇','Вакансии'],['checkin','○','Чек-ин'],['calendar','□','Календарь']]
const projectStatus = { active:['В работе','mint'], waiting:['Ожидание','amber'], archived:['Архив','muted'] }
const vacancyStatus = { review:'На рассмотрении', later:'Посмотреть позже', preparing:'Готовим отклик', sent:'Отправлено' }
const taskStatus = { ready:'Следующая по приоритету','in-progress':'Сейчас в работе',postponed:'На паузе',blocked:'Есть препятствие',done:'Завершено' }
const itemKind = { task:'задание', question:'вопрос', comment:'комментарий', note:'заметка' }
const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']

function moscowToday() { return new Date(new Date().toLocaleString('en-US',{ timeZone:'Europe/Moscow' })) }
function moscowDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA',{ timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type,part.value]))
  return `${values.year}-${values.month}-${values.day}`
}
function currentWeekDays(base = moscowToday()) {
  const dayOfWeek = (base.getDay() + 6) % 7
  const monday = new Date(base); monday.setDate(base.getDate() - dayOfWeek)
  return Array.from({length:7},(_,offset) => { const date = new Date(monday); date.setDate(monday.getDate()+offset); return { date,day:date.getDate(),month:date.getMonth(),isToday:date.toDateString() === moscowToday().toDateString() } })
}

function header(kicker) {
  const now = moscowToday()
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
  const weekdays = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота']
  const label = kicker || `${now.getDate()} ${months[now.getMonth()]} · ${weekdays[now.getDay()]}`
  return `<header class="topbar"><div><p class="kicker">${h(label)}</p><h1>Сегодня</h1></div><button type="button" class="profile-button" data-open-profile aria-label="Открыть статистику">Д</button></header>`
}

function weekStrip() {
  const names = ['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС']
  return `<div class="week-strip">${currentWeekDays().map(({day,isToday},index) => `<div class="day-cell ${isToday ? 'active' : ''}"><small>${names[index]}</small><strong>${day}</strong></div>`).join('')}</div>`
}

function focusTasks() {
  const linked = state.dayTasks.filter((task) => Boolean(task.focus))
  const completed = linked.filter((task) => task.status === 'done').length
  return { tasks:linked,completed,total:linked.length,progress:linked.length ? Math.round(completed/linked.length*100) : 0 }
}

function weeklyFocusSection() {
  const focus = focusTasks()
  return `<section class="weekly-focus">
    <button type="button" class="focus-head" data-toggle-focus><div><p class="kicker">Фокус недели</p><h2>${h(state.weeklyFocus.title || 'Фокус недели')}</h2></div><div class="focus-side"><strong>${focus.progress}%</strong><i>${state.focusExpanded ? '⌃' : '⌄'}</i></div></button>
    <div class="progress-track"><span style="width:${focus.progress}%"></span></div>
    <div class="focus-meta"><span>${focus.completed} из ${focus.total} задач</span><span>${state.weeklyFocus.deadline ? `до ${h(state.weeklyFocus.deadline)}` : ''}</span></div>
    ${state.focusExpanded ? `<div class="focus-actions"><button type="button" data-open-focus-settings>Настроить фокус</button><button type="button" data-open-new-task>+ Задача</button></div>` : ''}
    ${state.focusExpanded && focus.tasks.length ? `<div class="focus-tasks">${focus.tasks.map((task) => `<button type="button" class="task-row ${task.status === 'done' ? 'done' : ''}" data-focus-task="${h(task.id)}"><span class="task-check">${task.status === 'done' ? '✓' : ''}</span><span><b>${h(task.title)}</b><small>${h(task.project)}${task.notes ? ' · есть комментарий' : ''}</small></span><i>›</i></button>`).join('')}</div>` : ''}
    ${state.focusExpanded && !focus.tasks.length ? '<small class="focus-empty">В фокусе пока нет задач. Добавь задачу и включи «В фокус недели».</small>' : ''}
  </section>`
}

function currentTaskActions() {
  if (state.currentTask.status === 'in-progress') return `<div class="task-actions active-state"><button type="button" class="primary-action" data-complete-current>Завершить</button><button type="button" data-task-status="postponed">Пауза</button><button type="button" data-task-status="blocked">Проблема</button></div>`
  if (['postponed','blocked'].includes(state.currentTask.status)) return `<div class="task-actions"><button type="button" class="primary-action" data-task-status="in-progress">Продолжить</button><button type="button" data-skip-task>Следующая</button></div>`
  if (state.currentTask.status === 'done') return ''
  return `<div class="task-actions"><button type="button" class="primary-action" data-task-status="in-progress">Начать задачу</button><button type="button" data-task-status="postponed">Отложить</button></div>`
}

function upcomingDeadlines() {
  return state.projects.map(normalizeProject).map((project) => ({ project,days:daysUntil(project.deadlineDate,moscowToday()) }))
    .filter(({project,days}) => project.status !== 'archived' && days != null && days >= 0 && days <= 7).sort((a,b) => a.days-b.days)
}

function todayView() {
  const completed = state.dayTasks.filter((task) => task.status === 'done').length
  const deadlines = upcomingDeadlines()
  return `${header()}${weekStrip()}${weeklyFocusSection()}
    <section class="priority-task"><div class="task-label"><span class="live-dot"></span>${h(taskStatus[state.currentTask.status] || '')}<small>${h(state.currentTask.estimate)}</small></div><h2>${h(state.currentTask.title)}</h2><p>${h(state.currentTask.project)}</p>${currentTaskActions()}</section>
    <section class="plain-section"><div class="section-line"><div><p class="kicker">План</p><h2>Задачи на день</h2></div><div class="section-actions"><span class="section-count">${completed}/${state.dayTasks.length}</span><button type="button" class="text-button" data-open-new-task>+ задача</button></div></div>
      <div class="task-list">${state.dayTasks.map((task) => `<button type="button" class="task-row ${task.status === 'done' ? 'done' : ''} ${task.id === state.currentTask.id ? 'current' : ''}" data-edit-task="${h(task.id)}"><span class="task-check">${task.status === 'done' ? '✓' : ''}</span><span><b>${h(task.title)}</b><small>${h(task.project)}${task.estimate ? ` · ${h(task.estimate)}` : ''}${task.notes ? ' · комментарий' : ''}</small></span><i>›</i></button>`).join('')}</div>
    </section>
    <section class="plain-section compact-agenda"><div class="section-line"><div><p class="kicker">Контроль</p><h2>Ближайшие дедлайны</h2></div><button type="button" class="text-button" data-nav="projects">Проекты</button></div>
      ${deadlines.length ? deadlines.map(({project,days}) => `<button type="button" class="deadline-row" data-project-id="${h(project.id)}"><span><b>${h(project.title)}</b><small>${days === 0 ? 'Дедлайн сегодня' : `До дедлайна ${days} дн`}</small></span><strong>${days === 0 ? 'сегодня' : `${days} дн`}</strong></button>`).join('') : '<div class="subtle-note">На ближайшие 7 дней дедлайнов нет</div>'}
    </section>`
}

function deadlineBadge(project) {
  const days = daysUntil(project.deadlineDate,moscowToday())
  if (days == null) return ''
  if (days < 0) return `<span class="deadline-badge overdue">просрочен ${Math.abs(days)} дн</span>`
  if (days === 0) return '<span class="deadline-badge today">дедлайн сегодня</span>'
  return `<span class="deadline-badge">${days} дн до дедлайна</span>`
}

function projectRow(project) {
  const [label,tone] = projectStatus[project.status] || ['Без статуса','muted']
  const progress = projectProgress(project)
  const rest = Math.max((project.payment?.total || 0) - (project.payment?.paid || 0),0)
  const quick = state.projectQuickMenuId === project.id
  return `<div class="project-list-item">
    <button type="button" class="object-row project-main" data-project-id="${h(project.id)}"><span class="object-mark ${tone}">${h(project.title[0] || 'П')}</span><span class="object-copy"><small>${h(label)}${progress != null ? ` · ${progress}%` : ''}</small><b>${h(project.title)}</b><em>${h(project.nextAction || project.description || project.client)}</em></span><span class="object-side"><small>${rest ? formatMoney(rest) : ''}</small>${deadlineBadge(project)}</span></button>
    <button type="button" class="project-kebab" data-project-quick="${h(project.id)}" aria-label="Быстрые действия">⋮</button>
    ${quick ? `<div class="project-quick-menu"><div><small>Статус</small><div class="quick-status">${Object.entries(projectStatus).map(([key,[name]]) => `<button type="button" class="${project.status === key ? 'selected' : ''}" data-quick-status="${key}" data-project="${h(project.id)}">${h(name)}</button>`).join('')}</div></div><button type="button" data-quick-edit="${h(project.id)}">Редактировать</button>${safeUrl(project.url) ? `<a href="${h(safeUrl(project.url))}" target="_blank" rel="noopener">Открыть ссылку ↗</a>` : `<button type="button" data-quick-link="${h(project.id)}">Добавить ссылку</button>`}<button type="button" class="danger" data-quick-delete="${h(project.id)}">Удалить</button></div>` : ''}
  </div>`
}

function projectsView() {
  if (state.selectedProjectId) {
    const project = state.projects.map(normalizeProject).find((item) => item.id === state.selectedProjectId)
    return project ? projectDetail(project) : `${header('Проекты')}<div class="subtle-note">Проект не найден</div>`
  }
  const summary = moneySummary(state)
  const projects = filterProjects(state)
  const tabs = [['all','Все'],['active','В работе'],['waiting','Ожидание'],['archived','Архив']]
  return `${header(`${state.projects.length} проектов`)}
    <section class="money-summary"><div><small>Проектов на сумму</small><b>${formatMoney(summary.total)}</b></div><div><small>Оплачено</small><b class="mint">${formatMoney(summary.paid)}</b></div><div><small>Остаток</small><b class="amber">${formatMoney(summary.rest)}</b></div></section>
    <div class="segmented project-tabs">${tabs.map(([key,label]) => `<button type="button" class="${state.projectFilter === key ? 'active' : ''}" data-project-filter="${key}">${label}</button>`).join('')}</div>
    <div class="filter-row"><small>Сортировка:</small>${[['created','создание'],['deadline','дедлайн'],['rest','остаток']].map(([key,label]) => `<button type="button" class="${state.projectSort === key ? 'active' : ''}" data-project-sort="${key}">${label}</button>`).join('')}</div>
    <div class="object-list project-list">${projects.length ? projects.map(projectRow).join('') : '<div class="subtle-note">В этой вкладке пока пусто</div>'}</div>
    <button type="button" class="round-add" data-create-project>＋</button>`
}

function projectDetail(project) {
  const [label,tone] = projectStatus[project.status] || ['Без статуса','muted']
  const progress = projectProgress(project)
  const createdDays = Math.max(0,Math.floor((Date.now()-new Date(project.createdAt))/86400000))
  const payment = project.payment || {total:null,paid:null,entries:[]}
  const rest = payment.total == null ? null : Math.max((payment.total || 0)-(payment.paid || 0),0)
  return `<header class="detail-top"><button type="button" data-back-projects>‹</button><div><p class="kicker">Проект · идёт ${createdDays} дн</p><h1>${h(project.title)}</h1></div><button type="button" class="detail-edit" data-edit-project="${h(project.id)}" aria-label="Редактировать">✎</button></header>
    <section class="detail-summary"><div class="detail-badges"><span class="status-pill ${tone}">${h(label)}</span>${deadlineBadge(project)}</div>${progress != null ? `<div class="progress-track slim"><span style="width:${progress}%"></span></div><small>Завершён на ${progress}%</small>` : ''}<p>${h(project.description || '')}</p><div class="next-block"><small>Ближайшее действие</small><b>${h(project.nextAction || 'Не задано')}</b><span>Следующий ход: ${h(project.nextMove || '–')}</span></div></section>
    <section class="data-section"><div class="section-line"><h2>Оплата</h2><div class="section-actions"><button type="button" class="text-button" data-edit-project="${h(project.id)}">Сумма</button><button type="button" class="text-button" data-add-payment="${h(project.id)}">+ деньги</button></div></div>
      <div class="stats-inline"><div><small>Всего</small><b>${formatMoney(payment.total)}</b></div><div><small>Оплачено</small><b>${formatMoney(payment.paid)}</b></div><div><small>Остаток</small><b>${formatMoney(rest)}</b></div></div>
      ${payment.entries?.length ? `<div class="payment-history">${payment.entries.slice().reverse().map((entry) => `<div><span><b>${formatMoney(entry.amount)}</b><small>${h(entry.purpose || 'Оплата')}</small></span><time>${h(String(entry.date || '').slice(0,10))}</time></div>`).join('')}</div>` : '<div class="subtle-note">Платежей пока нет</div>'}
    </section>
    <section class="data-section"><div class="section-line"><h2>Дорожная карта</h2><div class="section-actions">${project.roadmap.length ? `<span>${project.roadmap.filter((step) => step.done).length}/${project.roadmap.length}</span>` : ''}<button type="button" class="text-button" data-edit-roadmap>Редактировать</button></div></div>
      ${project.roadmap.length ? `<ol class="timeline clickable">${project.roadmap.map((step,index) => `<li class="${step.done ? 'done' : ''}" data-roadmap-step="${index}"><span>${index+1}</span><b>${h(step.text)}</b></li>`).join('')}</ol>` : '<div class="text-box muted-box">Карта появится после согласования с клиентом. Добавь этапы, когда структура утверждена.</div>'}
      <div class="stack-actions grid-3"><button type="button" data-add-item="task">+ Задание</button><button type="button" data-add-item="question">+ Вопрос</button><button type="button" data-add-item="comment">+ Комментарий</button></div>
      ${project.items?.length ? `<div class="items-list">${project.items.map((item,index) => `<div class="item-row ${item.done ? 'done' : ''}"><button type="button" class="item-toggle" data-item-toggle="${index}">${item.done ? '✓' : '○'}</button><button type="button" class="item-copy" data-edit-item="${index}"><b>${h(item.text)}</b><small>${h(itemKind[item.kind] || item.kind)}</small></button><button type="button" class="item-more" data-edit-item="${index}">⋮</button></div>`).join('')}</div>` : ''}
    </section>`
}

const vacancyFilters = [['all','Все'],['new','Новые'],['not-sent','Не отправлен'],['sent','Отправлено']]
function vacanciesView() {
  if (state.selectedVacancyId) {
    const vacancy = state.vacancies.find((item) => item.id === state.selectedVacancyId)
    return vacancy ? vacancyDetail(vacancy) : `${header('Вакансии')}<div class="subtle-note">Вакансия не найдена</div>`
  }
  const paused = state.vacancySearch.status === 'paused'
  const filter = state.vacancyFilter || 'all'
  const filtered = state.vacancies.filter((vacancy) => filter === 'new' ? vacancy.status === 'review' : filter === 'sent' ? vacancy.status === 'sent' : filter === 'not-sent' ? vacancy.status !== 'sent' : true)
  return `${header('Поиск по будням')}
    <section class="search-schedule compact ${state.searchExpanded ? 'expanded' : ''}"><button type="button" class="search-summary" data-toggle-search><span class="live-dot ${paused ? 'paused' : ''}"></span><b>${paused ? 'Автопоиск остановлен' : 'Автопоиск включён'}</b><i>${state.searchExpanded ? '⌃' : '⌄'}</i></button>${state.searchExpanded ? `<div class="search-details"><p>Будни · ${state.vacancySearch.schedule.map(h).join(' · ')}</p><small>Новые совпадения отправляются в проверочный чат. Повторы пропускаются.</small><div class="search-actions">${paused ? `<button type="button" class="primary-action" data-search-pause="false">Включить поиск</button>` : `<button type="button" class="primary-action" data-search-now>${state.searchBusy ? 'Запускаю…' : 'Внеплановый поиск'}</button><button type="button" data-search-pause="true">Остановить поиск</button>`}</div></div>` : ''}</section>
    <div class="section-line list-heading"><div><p class="kicker">${filtered.length} вакансий</p><h2>Подходящие</h2></div><button type="button" class="kebab" data-toggle-vacancy-menu aria-label="Действия">⋮</button></div>
    ${state.vacancyMenuOpen ? `<div class="vacancy-menu">${['review','later','preparing','sent'].map((status) => `<div class="menu-row"><small>Перевести все в:</small><b>${h(vacancyStatus[status])}</b><button type="button" data-bulk-vacancy="${status}">ОК</button></div>`).join('')}</div>` : ''}
    <div class="segmented vacancy-tabs">${vacancyFilters.map(([key,label]) => `<button type="button" class="${filter === key ? 'active' : ''}" data-vacancy-filter="${key}">${label}</button>`).join('')}</div>
    <div class="object-list">${filtered.length ? filtered.map((vacancy) => `<button type="button" class="object-row vacancy" data-vacancy-id="${h(vacancy.id)}"><span class="match-score">${h(vacancy.match)}</span><span class="object-copy"><small>${h(vacancy.company)}</small><b>${h(vacancy.title)}</b><em>${h(vacancy.format)} · ${h(vacancy.salary)}</em></span><span class="object-side"><small>${h(vacancyStatus[vacancy.status])}</small><i>›</i></span></button>`).join('') : '<div class="subtle-note">Пусто</div>'}</div>`
}

function vacancyDetail(vacancy) {
  const url = safeUrl(vacancy.url)
  return `<header class="detail-top"><button type="button" data-back-vacancies>‹</button><div><p class="kicker">${h(vacancy.company)}</p><h1>${h(vacancy.title)}</h1></div>${url ? `<a class="kebab" href="${h(url)}" target="_blank" rel="noopener" title="Открыть вакансию">↗</a>` : '<span></span>'}</header>
    <section class="detail-summary"><div class="large-match"><b>${h(vacancy.match)}</b><span>% соответствие</span></div><p>${h(vacancy.summary)}</p><div class="tag-line"><span>${h(vacancy.format)}</span><span>${h(vacancy.salary)}</span></div></section>
    <section class="data-section"><div class="section-line"><h2>Действие</h2><span class="status-pill muted">${h(vacancyStatus[vacancy.status])}</span></div><div class="stack-actions"><button type="button" class="primary-action" data-prepare-response>${vacancy.status === 'preparing' ? 'Обновить отклик' : 'Подготовить отклик'}</button><button type="button" data-vacancy-action="sent">Я отправил</button><button type="button" data-vacancy-action="later">Посмотреть позже</button></div>${url ? `<a class="link-add" href="${h(url)}" target="_blank" rel="noopener">Открыть вакансию ↗</a>` : '<button type="button" class="link-add" data-add-vacancy-url>+ Добавить ссылку</button>'}</section>
    <section class="data-section"><h2>Мои заметки</h2><textarea data-vacancy-comment maxlength="1000" placeholder="Что важно помнить про эту вакансию…">${h(vacancy.note || '')}</textarea><button type="button" class="save-note" data-save-vacancy-note>Сохранить заметку</button></section>
    <section class="data-section"><h2>Отклик</h2><textarea class="response-editor" data-vacancy-response maxlength="6000">${h(vacancy.response || '')}</textarea><button type="button" class="save-note" data-save-vacancy-response>Сохранить отклик</button></section>`
}

function scaleButtons(type,value) { return `<div class="scale-row">${[1,2,3,4,5].map((number) => `<button type="button" class="${Number(value) === number ? 'selected' : ''}" data-${type}="${number}">${number}</button>`).join('')}</div>` }
function metricQuestion(kicker,title,type,value) { return `<div class="check-question"><p class="kicker">${h(kicker)}</p><h2>${h(title)}</h2>${scaleButtons(type,value)}</div>` }
function currentCheckinType() { return getCheckinType(Number(new Intl.DateTimeFormat('en-GB',{ timeZone:'Europe/Moscow',hour:'2-digit',hour12:false }).format(new Date()))) }
function lastCheckinInfo() {
  const real = state.wellbeingHistory.filter((entry) => !entry.demo)
  const last = real.at(-1)
  if (!last) return null
  const time = new Date(last.timestamp).toLocaleString('ru-RU',{ timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit' })
  return { time,type:{morning:'утренний',day:'дневной',evening:'вечерний'}[last.type] || '' }
}
const quickActivities = [['project','Работа над проектом'],['cleaning','Уборка'],['meal','Завтрак / обед / ужин'],['rest','Отдых']]
function checkinView() {
  const type = currentCheckinType()
  const sleepAlreadyRecorded = hasSleepEntryForDate(state.wellbeingHistory,moscowDateString())
  const defaultMeta = { morning:['Утренний чек-ин','Как начался день'],day:['Дневной чек-ин','Как проходит рабочий день'],evening:['Вечерний чек-ин','Как завершился день'] }[type]
  const meta = type === 'morning' && sleepAlreadyRecorded ? ['Состояние сейчас','Сон уже сохранён — оцени состояние'] : defaultMeta
  const sleep = type === 'morning' && !sleepAlreadyRecorded ? `<div class="check-question"><p class="kicker">Сон</p><h2>Сколько часов спал?</h2><div class="sleep-grid">${Array.from({length:12},(_,hours) => `<button type="button" class="${Number(state.checkin.sleepHours) === hours ? 'selected' : ''}" data-sleep-hours="${hours}">${hours}</button>`).join('')}</div></div>${metricQuestion('Восстановление','Насколько восстановился?','sleep-quality',state.checkin.sleepQuality)}` : ''
  const last = lastCheckinInfo()
  const ready = state.checkin.energy && state.checkin.mood && state.checkin.focus && state.checkin.anxiety && (sleepAlreadyRecorded || type !== 'morning' || state.checkin.sleepHours != null)
  return `${header(meta[0])}<div class="checkin-intro"><span>${{morning:'☼',day:'◐',evening:'◒'}[type]}</span><div><p class="kicker">${h(meta[0])}</p><h2>${h(meta[1])}</h2><small>${last ? `Последний чек-ин: ${h(last.type)}, ${h(last.time)}` : 'Первый чек-ин — время сохранится автоматически'}</small></div></div>
    <section class="checkin-sheet"><div class="checkin-status"><span style="width:${ready ? '100%' : state.checkin.energy && state.checkin.mood ? '68%' : state.checkin.energy ? '35%' : '10%'}"></span></div>${sleep}
      ${metricQuestion('Энергия','Сколько сил сейчас?','energy',state.checkin.energy)}${metricQuestion('Настроение','Как ты себя чувствуешь?','mood',state.checkin.mood)}${metricQuestion('Концентрация','Насколько легко держать фокус?','focus',state.checkin.focus)}${metricQuestion('Тревога','Насколько тревожно?','anxiety',state.checkin.anxiety)}
      <div class="check-question"><p class="kicker">Контекст</p><h2>Что отвлекает?</h2><div class="choice-chips">${[['phone','Телефон'],['tasks','Другие задачи'],['state','Состояние'],['none','Ничего']].map(([key,label]) => `<button type="button" class="${state.checkin.distraction === key ? 'selected' : ''}" data-distraction="${key}">${label}</button>`).join('')}</div></div>
      <div class="check-question"><p class="kicker">Чем занят сейчас</p><h2>Что делаешь?</h2><div class="choice-chips wrap">${quickActivities.map(([key,label]) => `<button type="button" class="${state.checkin.activity === key ? 'selected' : ''}" data-activity="${key}">${label}</button>`).join('')}</div><textarea data-activity-note maxlength="500" placeholder="Что именно делаешь? (необязательно)">${h(state.checkin.activityNote || '')}</textarea></div>
      <div class="check-question"><p class="kicker">Комментарий</p><h2>Что ещё важно зафиксировать?</h2><textarea data-checkin-comment maxlength="2000" placeholder="Свободный комментарий к чек-ину">${h(state.checkin.comment || '')}</textarea></div>
      <button type="button" class="complete-checkin" data-submit-checkin ${ready ? '' : 'disabled'}>Завершить чек-ин</button>
    </section>${state.checkinResult ? `<div class="result-note"><span>✓</span><div><small>Следующее действие</small><b>${h(state.checkinResult.replace('Следующее действие: ',''))}</b></div></div>` : ''}`
}

function wellbeingSection() {
  const entries = filterWellbeingByDays(state.wellbeingHistory,state.wellbeingPeriod)
  const stats = calculateWellbeingStats(entries)
  const typeNames = { morning:'Утро',day:'День',evening:'Вечер' }
  const typeTimes = { morning:'07:00–11:59',day:'12:00–17:59',evening:'18:00–23:59' }
  const byDate = new Map()
  for (const entry of entries) {
    const key = new Date(entry.timestamp).toLocaleDateString('ru-RU',{ timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit' })
    if (!byDate.has(key)) byDate.set(key,[])
    byDate.get(key).push(entry)
  }
  const points = [...byDate.entries()].slice(-(state.wellbeingPeriod === 30 ? 30 : 7)).map(([label,items]) => ({ label, value:calculateWellbeingStats(items).averageEnergy || 0 }))
  return `<section class="wellbeing-section"><div class="wellbeing-head"><div><p class="kicker">Состояние</p><h2>Последние ${state.wellbeingPeriod} дней</h2></div><div class="period-toggle"><button type="button" class="${state.wellbeingPeriod === 7 ? 'active' : ''}" data-wellbeing-period="7">7</button><button type="button" class="${state.wellbeingPeriod === 30 ? 'active' : ''}" data-wellbeing-period="30">30</button></div></div>
    <div class="demo-data-label">${state.serverConnected ? `Данные из базы · ${stats.sampleSize} чек-ин` : `Локальные данные · ${stats.sampleSize} чек-ин`}</div>
    <div class="wellbeing-metrics"><div><small>Энергия</small><b>${stats.averageEnergy ?? '–'}</b><span>/ 5</span></div><div><small>Настроение</small><b>${stats.averageMood ?? '–'}</b><span>/ 5</span></div><div><small>Фокус</small><b>${stats.averageFocus ?? '–'}</b><span>/ 5</span></div><div><small>Тревога</small><b>${stats.averageAnxiety ?? '–'}</b><span>/ 5</span></div><div><small>Сон</small><b>${stats.averageSleep ?? '–'}</b><span>ч</span></div><div><small>Качество сна</small><b>${stats.averageSleepQuality ?? '–'}</b><span>/ 5</span></div></div>
    <div class="peak-card"><div class="peak-clock">◷</div><div><p class="kicker">Пиковая энергия</p><h3>${h(typeNames[stats.peakEnergyType] || 'Нет данных')}</h3><span>${h(typeTimes[stats.peakEnergyType] || '')}</span></div></div>
    <div class="energy-chart"><div class="section-line"><h3>Энергия по дням</h3><span>${state.wellbeingPeriod} дней</span></div><div class="energy-bars period-${state.wellbeingPeriod}">${points.map((point,index) => `<i style="height:${Math.max(5,point.value/5*100)}%" class="${index === points.length-1 ? 'active' : ''}" title="${h(point.label)}: ${point.value}"><b>${point.value || ''}</b></i>`).join('')}</div><div class="energy-labels dynamic">${points.map((point,index) => `<small>${state.wellbeingPeriod === 30 && index % 5 !== 0 && index !== points.length-1 ? '' : h(point.label.split('.')[0])}</small>`).join('')}</div></div>
  </section>`
}

function profileOverlay() {
  if (!state.profileOpen) return ''
  const stats = getProfileStats(state)
  const completion = stats.totalToday ? Math.round(stats.completedToday/stats.totalToday*100) : 0
  const focus = focusTasks()
  return `<div class="profile-overlay"><header class="profile-head"><button type="button" data-close-profile>×</button><div class="profile-avatar">Д</div><h1>Денис</h1><p>Личная операционная статистика</p></header>
    <section class="profile-rings"><div class="stat-ring mint-ring" style="--value:${focus.progress*3.6}deg"><span><b>${focus.progress}%</b><small>Неделя</small></span></div><div class="stat-ring amber-ring" style="--value:${completion*3.6}deg"><span><b>${completion}%</b><small>Сегодня</small></span></div></section>
    <section class="profile-grid"><div><b>${stats.activeProjects}</b><span>Активных проектов</span></div><div><b>${stats.riskyProjects}</b><span>Проектов с риском</span></div><div><b>${stats.totalVacancies}</b><span>Вакансий</span></div><div><b>${stats.responsesPreparing}</b><span>Готовим отклики</span></div></section>
    ${wellbeingSection()}</div>`
}

function calendarWidget() {
  const today = moscowToday()
  const viewMonth = state.calendarMonth ?? today.getMonth()
  const viewYear = state.calendarYear ?? today.getFullYear()
  const collapsed = state.calendarCollapsed !== false
  const eventsByDay = new Map(state.calendarEvents.map((event) => [event.day,event]))
  const weekBase = new Date(viewYear,viewMonth,viewMonth === today.getMonth() && viewYear === today.getFullYear() ? today.getDate() : 1)
  const week = currentWeekDays(weekBase)
  const firstOfMonth = new Date(viewYear,viewMonth,1)
  const leadingBlanks = (firstOfMonth.getDay()+6)%7
  const daysInMonth = new Date(viewYear,viewMonth+1,0).getDate()
  if (collapsed) return `<section class="calendar-bottom"><div class="section-line"><div><p class="kicker">Календарь</p><h2>Текущая неделя</h2></div><button type="button" class="text-button" data-toggle-month>Весь месяц</button></div><div class="week-days">${week.map(({day,isToday}) => `<div class="week-day ${isToday ? 'today' : ''}"><span>${day}</span></div>`).join('')}</div></section>`
  return `<section class="calendar-bottom"><div class="calendar-head"><button type="button" data-prev-month>‹</button><h2>${monthNames[viewMonth]} ${viewYear}</h2><div class="head-actions"><button type="button" data-toggle-month>Свернуть</button><button type="button" data-next-month>›</button></div></div><div class="calendar-weekdays">${['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'].map((day) => `<span>${day}</span>`).join('')}</div><div class="month-grid">${Array(leadingBlanks).fill('<span class="calendar-day empty"></span>').join('')}${Array.from({length:daysInMonth},(_,i) => { const day=i+1; const event=eventsByDay.get(day); const isToday=day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear(); return `<button type="button" class="calendar-day ${isToday ? 'today' : ''} ${event ? 'has-event' : ''}" ${event ? `data-event-id="${event.id}"` : ''}><span>${day}</span>${event ? `<i class="${h(event.type)}"></i>` : ''}</button>` }).join('')}</div></section>`
}

function calendarView() {
  const filter = state.agendaFilter || 'all'
  const visible = state.calendarEvents.filter((event) => filter === 'all' || event.type === filter)
  const today = moscowToday(); const dayOfWeek=(today.getDay()+6)%7; const daysLeft=7-dayOfWeek
  return `${header('Календарь')}<section class="time-left"><div><p class="kicker">До конца недели</p><strong>${daysLeft} дн</strong></div><div class="week-meter"><span style="width:${Math.round((dayOfWeek+1)/7*100)}%"></span></div></section>
    <section class="plain-section agenda-block"><div class="section-line"><div><p class="kicker">План</p><h2>Задачи, оплаты и дедлайны</h2></div></div><div class="agenda-filters">${[['all','Все'],['task','Задачи'],['payment','Оплаты'],['deadline','Дедлайны']].map(([key,label]) => `<button type="button" class="${filter === key ? 'active' : ''}" data-agenda-filter="${key}">${label}</button>`).join('')}</div><div class="calendar-agenda">${visible.length ? visible.map((event) => `<button type="button" class="agenda-row" data-event-id="${event.id}"><time><b>${event.day}</b><small>${monthNames[today.getMonth()].slice(0,3).toUpperCase()}</small></time><span><b>${h(event.label)}</b><small>${h({task:'Задача',payment:'Оплата',deadline:'Дедлайн',focus:'Фокус недели'}[event.type] || event.type)}${event.comments?.length ? ` · комментариев: ${event.comments.length}` : ''}</small></span><em class="${h(event.type)}"></em></button>`).join('') : '<div class="subtle-note">Пусто</div>'}</div></section>
    ${calendarWidget()}`
}

function eventCommentSheet() {
  if (!state.selectedEventId) return ''
  const event = state.calendarEvents.find((item) => Number(item.id) === Number(state.selectedEventId))
  if (!event) return ''
  return `<div class="modal-backdrop"><div class="comment-sheet"><button type="button" class="sheet-close" data-close-event>×</button><p class="kicker">${event.day} · календарь</p><h2>${h(event.label)}</h2><div class="comment-list">${event.comments?.length ? event.comments.map((comment) => `<div><p>${h(comment.text)}</p><div class="comment-meta"><small>${h(new Date(comment.createdAt).toLocaleString('ru-RU',{ timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit' }))}</small><button type="button" class="comment-delete" data-delete-comment="${comment.id}">×</button></div></div>`).join('') : '<span>Комментариев пока нет</span>'}</div><label><span>Новый комментарий</span><textarea data-comment-input maxlength="2000" placeholder="Добавить уточнение, договорённость или заметку…">${h(state.eventCommentDraft)}</textarea></label><button type="button" class="primary-action save-comment" data-save-comment ${state.eventCommentDraft.trim() && !state.commentSaving ? '' : 'disabled'}>${state.commentSaving ? 'Сохраняю…' : 'Сохранить'}</button></div></div>`
}

function confirmation() {
  if (!state.confirmCompletion) return ''
  return `<div class="modal-backdrop"><div class="confirm-modal"><span class="confirm-icon">✓</span><h2>Задача завершена?</h2><p>${h(state.currentTask.title)}</p><button type="button" class="primary-action" data-confirm-completion>Да, показать следующую</button><button type="button" data-cancel-completion>Вернуться</button></div></div>`
}

function modalShell(title,body,actions='') { return `<div class="modal-backdrop"><div class="comment-sheet form-sheet"><button type="button" class="sheet-close" data-close-modal>×</button><h2>${h(title)}</h2>${body}${actions}</div></div>` }
function uiModal() {
  const modal = state.modal
  if (!modal) return ''
  if (modal.type === 'new-task') return modalShell('Новая задача',`<label><span>Задача</span><input data-task-title value="" placeholder="Что нужно сделать"/></label><label><span>Проект</span><input data-task-project value="" placeholder="Проект или Сегодня"/></label><label><span>Оценка времени</span><input data-task-estimate value="" placeholder="20 мин"/></label><label><span>Комментарий</span><textarea data-task-notes maxlength="2000"></textarea></label><label class="check-line"><input type="checkbox" data-task-focus checked/><span>В фокус недели</span></label>`,`<button type="button" class="primary-action save-comment" data-save-new-task>Добавить задачу</button>`)
  if (modal.type === 'task') {
    const task = state.dayTasks.find((item) => item.id === modal.id); if (!task) return ''
    return modalShell('Редактировать задачу',`<label><span>Задача</span><input data-task-title value="${h(task.title)}"/></label><label><span>Проект</span><input data-task-project value="${h(task.project)}"/></label><label><span>Оценка времени</span><input data-task-estimate value="${h(task.estimate || '')}"/></label><label><span>Статус</span><select data-task-status-edit>${Object.entries(taskStatus).map(([key,label]) => `<option value="${key}" ${task.status === key ? 'selected' : ''}>${h(label)}</option>`).join('')}</select></label><label><span>Комментарий</span><textarea data-task-notes maxlength="2000">${h(task.notes || '')}</textarea></label><label class="check-line"><input type="checkbox" data-task-focus ${task.focus ? 'checked' : ''}/><span>В фокус недели</span></label>`,`<div class="modal-actions"><button type="button" class="primary-action" data-save-task>Сохранить</button><button type="button" class="danger-btn" data-delete-task>Удалить</button></div>`)
  }
  if (modal.type === 'focus') return modalShell('Фокус недели',`<label><span>Цель недели</span><input data-focus-title value="${h(state.weeklyFocus.title || '')}"/></label><label><span>Дедлайн</span><input data-focus-deadline value="${h(state.weeklyFocus.deadline || '')}" placeholder="30 августа"/></label><div class="subtle-note">Количество задач и прогресс считаются автоматически по задачам с отметкой «В фокус недели».</div>`,`<button type="button" class="primary-action save-comment" data-save-focus>Сохранить</button>`)
  if (modal.type === 'vacancy-link') {
    const vacancy = state.vacancies.find((item) => item.id === state.selectedVacancyId)
    return modalShell('Ссылка на вакансию',`<label><span>URL вакансии</span><input data-vacancy-link value="${h(vacancy?.url && vacancy.url !== '#' ? vacancy.url : '')}" placeholder="https://..."/></label>`,`<button type="button" class="primary-action save-comment" data-save-vacancy-link>Сохранить</button>`)
  }
  const project = modal.projectId ? state.projects.map(normalizeProject).find((item) => item.id === modal.projectId) : state.projects.map(normalizeProject).find((item) => item.id === state.selectedProjectId)
  if (modal.type === 'project-edit' && project) return modalShell('Редактировать проект',`<label><span>Название</span><input data-project-title value="${h(project.title)}"/></label><label><span>Клиент</span><input data-project-client value="${h(project.client || '')}"/></label><label><span>Описание</span><textarea data-project-description maxlength="2000">${h(project.description || '')}</textarea></label><label><span>Дедлайн</span><input type="date" data-project-deadline value="${h(project.deadlineDate || '')}"/></label><label><span>Сумма проекта, ₽</span><input inputmode="numeric" data-project-total value="${project.payment?.total ?? ''}"/></label><label><span>Ссылка</span><input data-project-url value="${h(project.url || '')}" placeholder="https://..."/></label>`,`<button type="button" class="primary-action save-comment" data-save-project-edit="${h(project.id)}">Сохранить</button>`)
  if (modal.type === 'project-link' && project) return modalShell('Ссылка проекта',`<label><span>Ссылка на вакансию, чат или документ</span><input data-project-link value="${h(project.url || '')}" placeholder="https://..."/></label>`,`<button type="button" class="primary-action save-comment" data-save-project-link="${h(project.id)}">Сохранить</button>`)
  if (modal.type === 'payment' && project) return modalShell('Внести деньги',`<label><span>Сумма, ₽</span><input inputmode="numeric" data-payment-amount placeholder="15000"/></label><label><span>Назначение</span><input data-payment-purpose placeholder="Предоплата / остаток / этап"/></label>`,`<button type="button" class="primary-action save-comment" data-save-payment="${h(project.id)}">Добавить оплату</button>`)
  if (modal.type === 'roadmap' && project) return modalShell('Дорожная карта',`<label><span>Каждый этап с новой строки</span><textarea class="roadmap-editor" data-roadmap-lines>${h(project.roadmap.map((step) => step.text).join('\n'))}</textarea></label><div class="subtle-note">Готовые этапы сохранят свой статус, если текст не изменился.</div>`,`<button type="button" class="primary-action save-comment" data-save-roadmap>Сохранить карту</button>`)
  if (modal.type === 'project-item' && project) {
    const existing = modal.index != null ? project.items[modal.index] : null
    return modalShell(existing ? 'Редактировать запись' : `Добавить: ${itemKind[modal.kind] || 'запись'}`,`<label><span>Текст</span><textarea data-item-text maxlength="1000">${h(existing?.text || '')}</textarea></label>`,`${existing ? '<div class="modal-actions">' : ''}<button type="button" class="primary-action save-comment" data-save-project-item>${existing ? 'Сохранить' : 'Добавить'}</button>${existing ? '<button type="button" class="danger-btn" data-delete-project-item>Удалить</button></div>' : ''}`)
  }
  if (modal.type === 'delete-project' && project) return modalShell('Удалить проект?',`<p class="modal-copy">${h(project.title)} будет удалён из списка.</p>`,`<div class="modal-actions"><button type="button" data-close-modal>Отмена</button><button type="button" class="danger-btn" data-confirm-delete-project="${h(project.id)}">Удалить</button></div>`)
  return ''
}

function createProjectForm() {
  if (!state.createFormOpen) return ''
  return `<div class="modal-backdrop"><div class="comment-sheet form-sheet"><button type="button" class="sheet-close" data-close-create>×</button><h2>Новый проект</h2><label><span>Название</span><input data-new-title placeholder="Например: Воронка для школы"/></label><label><span>Клиент</span><input data-new-client placeholder="Имя клиента"/></label><label><span>Сумма, ₽</span><input data-new-total inputmode="numeric" placeholder="50000"/></label><label><span>Дедлайн</span><input data-new-deadline type="date"/></label><label class="check-line"><input type="checkbox" data-new-started/><span>Уже взял в работу</span></label><button type="button" class="primary-action save-comment" data-save-create>Создать</button></div></div>`
}

function bottomNav() {
  if (state.selectedProjectId || state.selectedVacancyId || state.profileOpen) return ''
  return `<nav class="bottom-dock">${navItems.map(([key,icon,label]) => `<button type="button" class="${state.activeScreen === key ? 'active' : ''}" data-nav="${key}"><span>${icon}</span><small>${label}</small></button>`).join('')}</nav>`
}

async function updateProject(projectId,patch,closeModal = false) {
  try {
    const result = await apiRequest(`/api/projects/${projectId}`,{ method:'POST',body:JSON.stringify(patch) })
    state = { ...mergeServerState(result.state), modal:closeModal ? null : state.modal, projectQuickMenuId:null }
    render(); return result.project
  } catch (error) { console.warn('Project was not updated',error); state.toast=`Не удалось сохранить: ${error.message}`; render(); return null }
}

function bindEvents() {
  document.querySelectorAll('[data-nav]').forEach((button) => button.addEventListener('click',() => setState({ ...state,activeScreen:button.dataset.nav,selectedProjectId:null,selectedVacancyId:null,projectQuickMenuId:null })))
  document.querySelectorAll('[data-open-profile]').forEach((button) => button.addEventListener('click',() => setState({ ...state,profileOpen:true })))
  document.querySelector('[data-close-profile]')?.addEventListener('click',() => setState({ ...state,profileOpen:false }))
  document.querySelector('[data-toggle-focus]')?.addEventListener('click',() => setState({ ...state,focusExpanded:!state.focusExpanded }))
  document.querySelector('[data-open-focus-settings]')?.addEventListener('click',() => setState({ ...state,modal:{type:'focus'} }))
  document.querySelectorAll('[data-open-new-task]').forEach((button) => button.addEventListener('click',() => setState({ ...state,modal:{type:'new-task'} })))
  document.querySelectorAll('[data-edit-task]').forEach((button) => button.addEventListener('click',() => setState({ ...state,modal:{type:'task',id:button.dataset.editTask} })))
  document.querySelectorAll('[data-focus-task]').forEach((button) => button.addEventListener('click',async () => {
    const task = state.dayTasks.find((item) => item.id === button.dataset.focusTask); if (!task) return
    try { const result = await apiRequest(`/api/tasks/${task.id}`,{ method:'POST',body:JSON.stringify({ status:task.status === 'done' ? 'ready' : 'done' }) }); setState(mergeServerState(result.state)) } catch (error) { console.warn(error) }
  }))
  document.querySelector('[data-save-new-task]')?.addEventListener('click',async () => {
    const title=document.querySelector('[data-task-title]')?.value.trim(); if (!title) return
    try { const result=await apiRequest('/api/tasks',{ method:'POST',body:JSON.stringify({ title,project:document.querySelector('[data-task-project]')?.value.trim(),estimate:document.querySelector('[data-task-estimate]')?.value.trim(),notes:document.querySelector('[data-task-notes]')?.value.trim(),focus:document.querySelector('[data-task-focus]')?.checked }) }); setState({ ...mergeServerState(result.state),modal:null }) } catch(error){ console.warn(error) }
  })
  document.querySelector('[data-save-task]')?.addEventListener('click',async () => {
    const taskId=state.modal?.id; if (!taskId) return
    try { const result=await apiRequest(`/api/tasks/${taskId}`,{ method:'POST',body:JSON.stringify({ title:document.querySelector('[data-task-title]')?.value.trim(),project:document.querySelector('[data-task-project]')?.value.trim(),estimate:document.querySelector('[data-task-estimate]')?.value.trim(),notes:document.querySelector('[data-task-notes]')?.value.trim(),focus:document.querySelector('[data-task-focus]')?.checked,status:document.querySelector('[data-task-status-edit]')?.value }) }); setState({ ...mergeServerState(result.state),modal:null }) } catch(error){ console.warn(error) }
  })
  document.querySelector('[data-delete-task]')?.addEventListener('click',async () => { const id=state.modal?.id; if (!id) return; try { const result=await apiRequest(`/api/tasks/${id}`,{method:'POST',body:JSON.stringify({delete:true})}); setState({ ...mergeServerState(result.state),modal:null }) } catch(error){ console.warn(error) } })
  document.querySelector('[data-save-focus]')?.addEventListener('click',async () => { try { const result=await apiRequest('/api/settings/weekly_focus',{method:'POST',body:JSON.stringify({title:document.querySelector('[data-focus-title]')?.value,deadline:document.querySelector('[data-focus-deadline]')?.value})}); setState({ ...mergeServerState(result.state),modal:null,focusExpanded:true }) } catch(error){ console.warn(error) } })

  document.querySelectorAll('[data-project-filter]').forEach((button) => button.addEventListener('click',() => setState({ ...state,projectFilter:button.dataset.projectFilter,projectQuickMenuId:null })))
  document.querySelectorAll('[data-project-sort]').forEach((button) => button.addEventListener('click',() => setState({ ...state,projectSort:button.dataset.projectSort,projectQuickMenuId:null })))
  document.querySelectorAll('[data-project-id]').forEach((button) => button.addEventListener('click',() => setState({ ...state,activeScreen:'projects',selectedProjectId:button.dataset.projectId,projectQuickMenuId:null })))
  document.querySelector('[data-back-projects]')?.addEventListener('click',() => setState({ ...state,selectedProjectId:null,projectQuickMenuId:null }))
  document.querySelectorAll('[data-project-quick]').forEach((button) => button.addEventListener('click',(event) => { event.stopPropagation(); const id=button.dataset.projectQuick; setState({ ...state,projectQuickMenuId:state.projectQuickMenuId === id ? null : id }) }))
  document.querySelectorAll('[data-quick-status]').forEach((button) => button.addEventListener('click',(event) => { event.stopPropagation(); updateProject(button.dataset.project,{status:button.dataset.quickStatus}) }))
  document.querySelectorAll('[data-quick-edit]').forEach((button) => button.addEventListener('click',(event) => { event.stopPropagation(); setState({ ...state,modal:{type:'project-edit',projectId:button.dataset.quickEdit},projectQuickMenuId:null }) }))
  document.querySelectorAll('[data-quick-link]').forEach((button) => button.addEventListener('click',(event) => { event.stopPropagation(); setState({ ...state,modal:{type:'project-link',projectId:button.dataset.quickLink},projectQuickMenuId:null }) }))
  document.querySelectorAll('[data-quick-delete]').forEach((button) => button.addEventListener('click',(event) => { event.stopPropagation(); setState({ ...state,modal:{type:'delete-project',projectId:button.dataset.quickDelete},projectQuickMenuId:null }) }))
  document.querySelector('[data-create-project]')?.addEventListener('click',() => setState({ ...state,createFormOpen:true }))
  document.querySelector('[data-close-create]')?.addEventListener('click',() => setState({ ...state,createFormOpen:false }))
  document.querySelector('[data-save-create]')?.addEventListener('click',async () => { const title=document.querySelector('[data-new-title]')?.value.trim(); if(!title)return; try { const result=await apiRequest('/api/projects',{method:'POST',body:JSON.stringify({title,client:document.querySelector('[data-new-client]')?.value,total:Number((document.querySelector('[data-new-total]')?.value||'').replace(/\D/g,''))||null,deadlineDate:document.querySelector('[data-new-deadline]')?.value||null,started:document.querySelector('[data-new-started]')?.checked})}); setState({ ...mergeServerState(result.state),createFormOpen:false,selectedProjectId:result.project.id }) } catch(error){ console.warn(error) } })
  document.querySelectorAll('[data-edit-project]').forEach((button) => button.addEventListener('click',() => setState({ ...state,modal:{type:'project-edit',projectId:button.dataset.editProject} })))
  document.querySelector('[data-save-project-edit]')?.addEventListener('click',() => { const id=document.querySelector('[data-save-project-edit]').dataset.saveProjectEdit; const totalRaw=document.querySelector('[data-project-total]')?.value||''; const project=state.projects.map(normalizeProject).find((item)=>item.id===id); updateProject(id,{title:document.querySelector('[data-project-title]')?.value.trim(),client:document.querySelector('[data-project-client]')?.value.trim(),description:document.querySelector('[data-project-description]')?.value.trim(),deadlineDate:document.querySelector('[data-project-deadline]')?.value||null,url:document.querySelector('[data-project-url]')?.value.trim(),payment:{...project.payment,total:Number(totalRaw.replace(/\D/g,''))||null}},true) })
  document.querySelector('[data-add-payment]')?.addEventListener('click',() => setState({ ...state,modal:{type:'payment',projectId:state.selectedProjectId} }))
  document.querySelector('[data-save-payment]')?.addEventListener('click',() => { const id=document.querySelector('[data-save-payment]').dataset.savePayment; const amount=Number((document.querySelector('[data-payment-amount]')?.value||'').replace(/\D/g,'')); if(!amount)return; const project=state.projects.map(normalizeProject).find((item)=>item.id===id); const entries=[...(project.payment.entries||[]),{amount,purpose:document.querySelector('[data-payment-purpose]')?.value.trim()||'Оплата',date:new Date().toISOString()}]; updateProject(id,{payment:{...project.payment,entries}},true) })
  document.querySelector('[data-edit-roadmap]')?.addEventListener('click',() => setState({ ...state,modal:{type:'roadmap',projectId:state.selectedProjectId} }))
  document.querySelector('[data-save-roadmap]')?.addEventListener('click',() => { const project=state.projects.map(normalizeProject).find((item)=>item.id===state.selectedProjectId); const old=new Map(project.roadmap.map((step)=>[step.text,step.done])); const roadmap=(document.querySelector('[data-roadmap-lines]')?.value||'').split('\n').map((text)=>text.trim()).filter(Boolean).map((text)=>({text,done:old.get(text)||false})); updateProject(project.id,{roadmap},true) })
  document.querySelectorAll('[data-roadmap-step]').forEach((element) => element.addEventListener('click',() => { const project=state.projects.map(normalizeProject).find((item)=>item.id===state.selectedProjectId); const index=Number(element.dataset.roadmapStep); updateProject(project.id,{roadmap:project.roadmap.map((step,i)=>i===index?{...step,done:!step.done}:step)}) }))
  document.querySelectorAll('[data-add-item]').forEach((button) => button.addEventListener('click',() => setState({ ...state,modal:{type:'project-item',projectId:state.selectedProjectId,kind:button.dataset.addItem} })))
  document.querySelectorAll('[data-edit-item]').forEach((button) => button.addEventListener('click',() => setState({ ...state,modal:{type:'project-item',projectId:state.selectedProjectId,index:Number(button.dataset.editItem)} })))
  document.querySelectorAll('[data-item-toggle]').forEach((button) => button.addEventListener('click',() => { const project=state.projects.map(normalizeProject).find((item)=>item.id===state.selectedProjectId); const index=Number(button.dataset.itemToggle); updateProject(project.id,{items:project.items.map((item,i)=>i===index?{...item,done:!item.done}:item)}) }))
  document.querySelector('[data-save-project-item]')?.addEventListener('click',() => { const modal=state.modal; const project=state.projects.map(normalizeProject).find((item)=>item.id===modal.projectId); const text=document.querySelector('[data-item-text]')?.value.trim(); if(!text)return; const items=[...project.items]; if(modal.index!=null) items[modal.index]={...items[modal.index],text}; else items.push({kind:modal.kind||'note',text,done:false}); updateProject(project.id,{items},true) })
  document.querySelector('[data-delete-project-item]')?.addEventListener('click',() => { const modal=state.modal; const project=state.projects.map(normalizeProject).find((item)=>item.id===modal.projectId); updateProject(project.id,{items:project.items.filter((_,i)=>i!==modal.index)},true) })
  document.querySelector('[data-save-project-link]')?.addEventListener('click',() => { const id=document.querySelector('[data-save-project-link]').dataset.saveProjectLink; updateProject(id,{url:document.querySelector('[data-project-link]')?.value.trim()},true) })
  document.querySelector('[data-confirm-delete-project]')?.addEventListener('click',async () => { const id=document.querySelector('[data-confirm-delete-project]').dataset.confirmDeleteProject; try { const result=await apiRequest(`/api/projects/${id}`,{method:'POST',body:JSON.stringify({delete:true})}); setState({ ...mergeServerState(result.state),selectedProjectId:null,modal:null }) } catch(error){console.warn(error)} })

  document.querySelectorAll('[data-vacancy-filter]').forEach((button) => button.addEventListener('click',() => setState({ ...state,vacancyFilter:button.dataset.vacancyFilter })))
  document.querySelectorAll('[data-vacancy-id]').forEach((button) => button.addEventListener('click',() => setState({ ...state,selectedVacancyId:button.dataset.vacancyId })))
  document.querySelector('[data-back-vacancies]')?.addEventListener('click',() => setState({ ...state,selectedVacancyId:null }))
  document.querySelector('[data-toggle-vacancy-menu]')?.addEventListener('click',() => setState({ ...state,vacancyMenuOpen:!state.vacancyMenuOpen }))
  document.querySelectorAll('[data-bulk-vacancy]').forEach((button) => button.addEventListener('click',async () => { try { for(const vacancy of state.vacancies) await apiRequest(`/api/vacancies/${vacancy.id}/status`,{method:'POST',body:JSON.stringify({status:button.dataset.bulkVacancy})}); const serverState=await apiRequest('/api/state'); setState({ ...mergeServerState(serverState),vacancyMenuOpen:false }) } catch(error){console.warn(error)} }))
  document.querySelector('[data-add-vacancy-url]')?.addEventListener('click',() => setState({ ...state,modal:{type:'vacancy-link'} }))
  document.querySelector('[data-save-vacancy-link]')?.addEventListener('click',async () => { try { const result=await apiRequest(`/api/vacancies/${state.selectedVacancyId}/details`,{method:'POST',body:JSON.stringify({url:document.querySelector('[data-vacancy-link]')?.value.trim()})}); setState({ ...mergeServerState(result.state),modal:null }) } catch(error){console.warn(error)} })
  document.querySelector('[data-save-vacancy-note]')?.addEventListener('click',async () => { try { const result=await apiRequest(`/api/vacancies/${state.selectedVacancyId}/details`,{method:'POST',body:JSON.stringify({note:document.querySelector('[data-vacancy-comment]')?.value.trim()})}); setState(mergeServerState(result.state)) } catch(error){console.warn(error)} })
  document.querySelector('[data-save-vacancy-response]')?.addEventListener('click',async () => { try { const result=await apiRequest(`/api/vacancies/${state.selectedVacancyId}/details`,{method:'POST',body:JSON.stringify({response:document.querySelector('[data-vacancy-response]')?.value.trim()})}); setState(mergeServerState(result.state)) } catch(error){console.warn(error)} })
  document.querySelector('[data-prepare-response]')?.addEventListener('click',async () => { const id=state.selectedVacancyId; try { const result=await apiRequest(`/api/vacancies/${id}/prepare`,{method:'POST',body:'{}'}); setState(mergeServerState(result.state)) } catch(error){console.warn(error)} })
  document.querySelectorAll('[data-vacancy-action]').forEach((button) => button.addEventListener('click',async () => { const id=state.selectedVacancyId; const status=button.dataset.vacancyAction; setState(setVacancyStatus(state,id,status)); try { const result=await apiRequest(`/api/vacancies/${id}/status`,{method:'POST',body:JSON.stringify({status})}); setState(mergeServerState(result.state)) } catch(error){console.warn(error)} }))
  document.querySelector('[data-toggle-search]')?.addEventListener('click',() => setState({ ...state,searchExpanded:!state.searchExpanded }))
  document.querySelector('[data-search-now]')?.addEventListener('click',async () => { if(state.searchBusy)return; setState({ ...state,searchBusy:true,searchExpanded:true }); try { await apiRequest('/api/vacancy-search/run',{method:'POST',body:'{}'}) } catch(error){console.warn(error)} setState({ ...state,searchBusy:false,searchExpanded:true }) })
  document.querySelector('[data-search-pause]')?.addEventListener('click',async (event) => { try { const paused=event.currentTarget.dataset.searchPause==='true'; const result=await apiRequest('/api/vacancy-search/pause',{method:'POST',body:JSON.stringify({paused})}); setState({ ...mergeServerState(result.state),searchExpanded:true }) } catch(error){console.warn(error)} })

  document.querySelectorAll('[data-task-status]').forEach((button) => button.addEventListener('click',async () => { const status=button.dataset.taskStatus; const id=state.currentTask.id; setState(setCurrentTaskStatus(state,status)); try { const result=await apiRequest(`/api/tasks/${id}/status`,{method:'POST',body:JSON.stringify({status})}); setState(mergeServerState(result)) } catch(error){console.warn(error)} }))
  document.querySelector('[data-complete-current]')?.addEventListener('click',() => setState({ ...state,confirmCompletion:true }))
  document.querySelector('[data-confirm-completion]')?.addEventListener('click',async () => { const id=state.currentTask.id; setState({ ...completeCurrentTask(state),confirmCompletion:false }); try { const result=await apiRequest(`/api/tasks/${id}/complete`,{method:'POST',body:'{}'}); setState(mergeServerState(result.state)) } catch(error){console.warn(error)} })
  document.querySelector('[data-cancel-completion]')?.addEventListener('click',() => setState({ ...state,confirmCompletion:false }))
  document.querySelector('[data-skip-task]')?.addEventListener('click',() => { const candidate=state.dayTasks.filter((task)=>task.status!=='done'&&task.id!==state.currentTask.id).sort((a,b)=>a.priority-b.priority)[0]; if(candidate)setState({ ...state,currentTask:{...candidate} }) })

  document.querySelectorAll('[data-energy]').forEach((button) => button.addEventListener('click',() => setState({ ...state,checkin:{...state.checkin,energy:Number(button.dataset.energy)} })))
  document.querySelectorAll('[data-mood]').forEach((button) => button.addEventListener('click',() => setState({ ...state,checkin:{...state.checkin,mood:Number(button.dataset.mood)} })))
  document.querySelectorAll('[data-focus]').forEach((button) => button.addEventListener('click',() => setState({ ...state,checkin:{...state.checkin,focus:Number(button.dataset.focus)} })))
  document.querySelectorAll('[data-anxiety]').forEach((button) => button.addEventListener('click',() => setState({ ...state,checkin:{...state.checkin,anxiety:Number(button.dataset.anxiety)} })))
  document.querySelectorAll('[data-sleep-quality]').forEach((button) => button.addEventListener('click',() => setState({ ...state,checkin:{...state.checkin,sleepQuality:Number(button.dataset.sleepQuality)} })))
  document.querySelectorAll('[data-sleep-hours]').forEach((button) => button.addEventListener('click',() => setState({ ...state,checkin:{...state.checkin,sleepHours:Number(button.dataset.sleepHours)} })))
  document.querySelectorAll('[data-distraction]').forEach((button) => button.addEventListener('click',() => setState({ ...state,checkin:{...state.checkin,distraction:button.dataset.distraction} })))
  document.querySelectorAll('[data-activity]').forEach((button) => button.addEventListener('click',() => setState({ ...state,checkin:{...state.checkin,activity:button.dataset.activity} })))
  document.querySelector('[data-activity-note]')?.addEventListener('input',(event) => { state.checkin.activityNote=event.target.value })
  document.querySelector('[data-checkin-comment]')?.addEventListener('input',(event) => { state.checkin.comment=event.target.value })
  document.querySelector('[data-submit-checkin]')?.addEventListener('click',async () => {
    const payload={...state.checkin}; const localResult=submitCheckin(payload); const localState=addWellbeingEntry(state,payload)
    setState({ ...localState,checkinResult:localResult })
    try {
      if(payload.activity || payload.activityNote?.trim()) await apiRequest('/api/activities',{method:'POST',body:JSON.stringify({kind:payload.activity||'note',text:payload.activityNote?.trim()||quickActivities.find(([key])=>key===payload.activity)?.[1]||'Заметка'})})
      const result=await apiRequest('/api/checkins',{method:'POST',body:JSON.stringify(payload)})
      const empty={energy:null,mood:null,focus:null,anxiety:null,sleepHours:null,sleepQuality:null,distraction:null,activity:null,activityNote:'',comment:''}
      setState({ ...mergeServerState(result.state),checkin:empty,checkinResult:localResult })
    } catch(error){ console.warn('Check-in was not saved',error) }
  })
  document.querySelectorAll('[data-wellbeing-period]').forEach((button) => button.addEventListener('click',async () => {
    const days=Number(button.dataset.wellbeingPeriod); const scroll=document.querySelector('.profile-overlay')?.scrollTop||0
    setStatePreserveProfileScroll({ ...state,wellbeingPeriod:days },scroll)
    try { const [stats,serverState]=await Promise.all([apiRequest(`/api/stats?days=${days}`),apiRequest('/api/state')]); state={ ...mergeServerState(serverState),wellbeingPeriod:days,serverStats:stats }; setStatePreserveProfileScroll(state,scroll) } catch(error){ console.warn('Stats were not refreshed',error) }
  }))

  document.querySelectorAll('[data-event-id]').forEach((button) => button.addEventListener('click',() => setState({ ...state,selectedEventId:Number(button.dataset.eventId),eventCommentDraft:'' })))
  document.querySelector('[data-close-event]')?.addEventListener('click',() => setState({ ...state,selectedEventId:null,eventCommentDraft:'',commentSaving:false }))
  document.querySelector('[data-comment-input]')?.addEventListener('input',(event) => { state.eventCommentDraft=event.target.value; const save=document.querySelector('[data-save-comment]'); if(save) save.disabled=!state.eventCommentDraft.trim()||state.commentSaving })
  document.querySelector('[data-save-comment]')?.addEventListener('click',async () => { const eventId=state.selectedEventId; const text=state.eventCommentDraft.trim(); if(!text||state.commentSaving)return; state.commentSaving=true; render(); try { const result=await apiRequest(`/api/calendar/${eventId}/comments`,{method:'POST',body:JSON.stringify({text})}); state={ ...mergeServerState(result.state),selectedEventId:eventId,eventCommentDraft:'',commentSaving:false }; render() } catch(error){ state.commentSaving=false; render(); console.warn(error) } })
  document.querySelectorAll('[data-delete-comment]').forEach((button) => button.addEventListener('click',async () => { try { const result=await apiRequest(`/api/comments/${button.dataset.deleteComment}`,{method:'POST',body:'{}'}); setState({ ...mergeServerState(result.state),selectedEventId:state.selectedEventId }) } catch(error){console.warn(error)} }))
  document.querySelectorAll('[data-agenda-filter]').forEach((button) => button.addEventListener('click',() => setState({ ...state,agendaFilter:button.dataset.agendaFilter })))
  document.querySelector('[data-toggle-month]')?.addEventListener('click',() => setState({ ...state,calendarCollapsed:state.calendarCollapsed === false }))
  document.querySelector('[data-prev-month]')?.addEventListener('click',() => { const today=moscowToday(); let month=(state.calendarMonth??today.getMonth())-1; let year=state.calendarYear??today.getFullYear(); if(month<0){month=11;year--} setState({ ...state,calendarMonth:month,calendarYear:year }) })
  document.querySelector('[data-next-month]')?.addEventListener('click',() => { const today=moscowToday(); let month=(state.calendarMonth??today.getMonth())+1; let year=state.calendarYear??today.getFullYear(); if(month>11){month=0;year++} setState({ ...state,calendarMonth:month,calendarYear:year }) })

  document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click',() => setState({ ...state,modal:null })))
}

function render() {
  const views={today:todayView,calendar:calendarView,projects:projectsView,vacancies:vacanciesView,checkin:checkinView}
  const content=(views[state.activeScreen] || todayView)()
  app.innerHTML=`<div class="app-shell"><main>${content}</main>${bottomNav()}${profileOverlay()}${confirmation()}${eventCommentSheet()}${createProjectForm()}${uiModal()}${state.toast ? `<button type="button" class="toast" data-dismiss-toast>${h(state.toast)}</button>` : ''}</div>`
  bindEvents()
  document.querySelector('[data-dismiss-toast]')?.addEventListener('click',() => setState({ ...state,toast:'' }))
}

render()
loadServerState()
