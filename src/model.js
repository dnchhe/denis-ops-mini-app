const projects = [
  {
    id: 'money-teeth', demo: true, title: 'Деньги на зубах', client: 'Клиентский проект',
    description: 'Подписочный клуб и автоматизация клиентского пути', status: 'waiting', url: '',
    nextAction: 'Проверить поступление остатка оплаты', nextMove: 'Клиент', deadlineText: '27 августа', deadlineDate: '2026-08-27',
    createdAt: '2026-08-10T12:00:00+03:00', payment: { total: null, paid: null, entries: [] }, prepaid: false, started: true,
    result: 'Работающий первый этап подписочного клуба', risk: 'Ожидается остаток оплаты',
    roadmap: [{ text: 'Первый этап завершён', done: true }, { text: 'Получить остаток оплаты', done: false }, { text: 'Согласовать следующий этап', done: false }],
    items: [{ kind: 'question', text: 'Сумма остатка оплаты', done: false }, { kind: 'question', text: 'Состав следующего этапа', done: false }],
  },
  {
    id: 'natalia', demo: true, title: 'Воронка Наталии', client: 'Наталия', description: 'Воронка для бухгалтерского сопровождения',
    status: 'waiting', url: '', nextAction: 'Получить разбор пути реального клиента', nextMove: 'Клиент', deadlineText: '', deadlineDate: null,
    createdAt: '2026-07-29T12:00:00+03:00', payment: { total: null, paid: null, entries: [] }, prepaid: false, started: false,
    result: 'Воронка: лид-магнит → квалификация → консультация → сопровождение', risk: 'Нет подтверждённого срока следующего ответа',
    roadmap: [{ text: 'Путь клиента', done: false }, { text: 'Основной продукт', done: false }, { text: 'Консультация', done: false }, { text: 'Лид-магнит', done: false }, { text: 'Материалы', done: false }, { text: 'Сборка бота', done: false }],
    items: [{ kind: 'question', text: 'Точный состав сопровождения', done: false }],
  },
  {
    id: 'mini-app', demo: true, title: 'Личная Mini App', client: 'Личный проект', description: 'Проекты, вакансии и быстрые чек-ины внутри Telegram',
    status: 'active', url: '', nextAction: 'Проверить обновлённый интерфейс на телефоне', nextMove: 'Денис', deadlineText: '', deadlineDate: null,
    createdAt: '2026-08-24T12:00:00+03:00', payment: { total: null, paid: null, entries: [] }, prepaid: false, started: true,
    result: 'Простая рабочая панель внутри Telegram', risk: 'Не перегрузить первую версию',
    roadmap: [{ text: 'Кликабельный прототип', done: true }, { text: 'База данных', done: true }, { text: 'Telegram', done: true }, { text: 'Постоянный адрес', done: false }, { text: 'Реальные данные', done: false }],
    items: [],
  },
]

const vacancies = [
  { id:'tech-specialist', title:'Технический специалист онлайн-проекта', company:'Демонстрационная вакансия', format:'Удалённо', salary:'100 000 ₽', match:82, summary:'GetCourse, SaleBot, amoCRM, вебинары и автоматизации', status:'review', url:'#', response:'Отклик ещё не подготовлен', risks:['Нужно уточнить занятость','Возможна работа по выходным'] },
  { id:'funnel-integrator', title:'Интегратор автоворонок', company:'Демонстрационная вакансия', format:'Проектно', salary:'20 000–45 000 ₽', match:91, summary:'SaleBot + GetCourse, оплаты, сегментация и сообщения', status:'later', url:'#', response:'Есть подтверждённые кейсы для отклика', risks:['Нужно уточнить точный объём функционала'] },
]

function createDemoWellbeingHistory() {
  const days = [18,19,20,21,22,23,24]
  const values = [
    [[2,3,2,3],[3,3,3,2],[4,4,4,2]], [[2,3,2,3],[3,3,2,3],[5,4,4,1]], [[3,3,3,2],[3,4,3,2],[4,4,4,1]],
    [[2,3,2,3],[3,3,3,2],[5,5,4,1]], [[3,4,3,2],[3,4,3,2],[4,4,4,1]], [[2,3,2,2],[3,4,3,2],[4,4,4,1]], [[3,4,3,2],[3,4,3,2],[4,4,4,1]],
  ]
  return days.flatMap((day, dayIndex) => ['morning','day','evening'].map((type, typeIndex) => {
    const [energy,mood,focus,anxiety] = values[dayIndex][typeIndex]
    const hour = [8,14,21][typeIndex]
    return { timestamp:`2026-08-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:00:00+03:00`, day, type, energy, mood, focus, anxiety,
      sleepHours:type === 'morning' ? [6.5,6,7,6.5,7.5,7,7][dayIndex] : null, sleepQuality:type === 'morning' ? [3,3,4,3,4,4,4][dayIndex] : null, demo:true }
  }))
}

export function getCheckinType(hour) {
  if (hour < 12) return 'morning'
  if (hour < 18) return 'day'
  return 'evening'
}

function moscowDateFromTimestamp(timestamp) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return String(timestamp).slice(0,10)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/Moscow', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function hasSleepEntryForDate(entries, date) {
  return entries.some((entry) => !Boolean(entry.demo) && typeof entry.sleepHours === 'number' && moscowDateFromTimestamp(entry.timestamp) === date)
}

function roundedAverage(entries, field) {
  const values = entries.map((entry) => Number(entry[field])).filter((value) => Number.isFinite(value))
  if (!values.length) return null
  return Math.round(values.reduce((sum,value) => sum + value,0) / values.length * 10) / 10
}

export function calculateWellbeingStats(entries) {
  if (!entries.length) return { sampleSize:0, averageEnergy:null, averageMood:null, averageFocus:null, averageAnxiety:null, averageSleep:null, averageSleepQuality:null, peakEnergyType:null }
  const types = ['morning','day','evening']
  const energyByType = types.map((type) => ({ type, average:roundedAverage(entries.filter((entry) => entry.type === type),'energy') }))
    .filter((item) => item.average !== null).sort((a,b) => b.average - a.average)
  return { sampleSize:entries.length, averageEnergy:roundedAverage(entries,'energy'), averageMood:roundedAverage(entries,'mood'), averageFocus:roundedAverage(entries,'focus'),
    averageAnxiety:roundedAverage(entries,'anxiety'), averageSleep:roundedAverage(entries,'sleepHours'), averageSleepQuality:roundedAverage(entries,'sleepQuality'), peakEnergyType:energyByType[0]?.type ?? null }
}

export function filterWellbeingByDays(entries, days, now = new Date()) {
  const hasReal = entries.some((entry) => !Boolean(entry.demo))
  const source = hasReal ? entries.filter((entry) => !Boolean(entry.demo)) : entries
  const latestReal = [...source].map((entry) => new Date(entry.timestamp)).filter((date) => !Number.isNaN(date.getTime())).sort((a,b) => b-a)[0]
  const anchor = latestReal && latestReal > now ? latestReal : now
  const cutoff = new Date(anchor.getTime() - (days - 1) * 86400000)
  cutoff.setHours(0,0,0,0)
  return source.filter((entry) => {
    const date = new Date(entry.timestamp)
    return !Number.isNaN(date.getTime()) && date >= cutoff && date <= new Date(anchor.getTime() + 86400000)
  })
}

export function addWellbeingEntry(state, values, date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone:'Europe/Moscow', hour:'2-digit', hour12:false }).format(date))
  const entry = { ...values, timestamp:date.toISOString(), day:Number(new Intl.DateTimeFormat('en-GB',{ timeZone:'Europe/Moscow', day:'2-digit' }).format(date)), type:getCheckinType(hour), demo:false }
  return { ...state, wellbeingHistory:[...state.wellbeingHistory, entry] }
}

export function createInitialState() {
  const dayTasks = [
    { id:'task-0', title:'Определить структуру ближайшей версии', project:'Личная Mini App', priority:0, status:'done', estimate:'20 мин', notes:'', focus:true },
    { id:'task-1', title:'Проверить обновлённый прототип Mini App', project:'Личная Mini App', priority:1, status:'ready', estimate:'15 мин', notes:'', focus:true },
    { id:'task-2', title:'Дать короткую обратную связь по интерфейсу', project:'Личная Mini App', priority:2, status:'ready', estimate:'10 мин', notes:'', focus:true },
    { id:'task-3', title:'Проверить поступление оплаты', project:'Деньги на зубах', priority:3, status:'ready', estimate:'5 мин', notes:'', focus:false },
  ]
  return {
    activeScreen:'today', profileOpen:false, currentTask:{ ...dayTasks.find((task) => task.status !== 'done') }, dayTasks,
    weeklyFocus:{ title:'Собрать и проверить первую рабочую Mini App', deadline:'30 августа' },
    calendarEvents:[{id:1,day:24,type:'task',label:'Прототип Mini App',comments:[]},{id:2,day:25,type:'task',label:'Проверка интерфейса',comments:[]},{id:3,day:27,type:'payment',label:'Остаток оплаты',comments:[]},{id:4,day:28,type:'deadline',label:'Контроль проектов',comments:[]},{id:5,day:30,type:'focus',label:'Фокус недели',comments:[]}],
    vacancySearch:{ schedule:['12:00','16:00','20:00'], weekdaysOnly:true, lastRun:'Ещё не запускался по расписанию', status:'scheduled' },
    projects:structuredClone(projects), vacancies:structuredClone(vacancies), selectedProjectId:null, selectedVacancyId:null,
    checkin:{ energy:null,mood:null,focus:null,anxiety:null,sleepHours:null,sleepQuality:null,distraction:null,activity:null,activityNote:'',comment:'' },
    activities:[], projectFilter:'all', projectSort:'deadline', wellbeingHistory:createDemoWellbeingHistory(), wellbeingPeriod:7, checkinResult:'',
  }
}

export function getScreenTitle(state) { return { today:'Сегодня', calendar:'Календарь', projects:'Проекты', vacancies:'Вакансии', checkin:'Чек-ин' }[state.activeScreen] }

export function setCurrentTaskStatus(state, status) {
  return { ...state, currentTask:{ ...state.currentTask,status }, dayTasks:state.dayTasks.map((task) => task.id === state.currentTask.id ? { ...task,status } : task) }
}

export function completeCurrentTask(state) {
  const dayTasks = state.dayTasks.map((task) => task.id === state.currentTask.id ? { ...task,status:'done' } : task)
  const nextTask = [...dayTasks].filter((task) => task.status !== 'done').sort((a,b) => a.priority-b.priority)[0]
  return { ...state, dayTasks, currentTask:nextTask ? { ...nextTask } : { id:'none',title:'Все задачи на день выполнены',project:'Сегодня',priority:999,status:'done',estimate:'–',notes:'',focus:false } }
}

export function getProfileStats(state) {
  return { activeProjects:state.projects.filter((project) => project.status === 'active').length, riskyProjects:state.projects.filter((project) => project.risk && project.risk !== 'Нет' && project.status !== 'archived').length,
    totalVacancies:state.vacancies.length, responsesPreparing:state.vacancies.filter((vacancy) => vacancy.status === 'preparing').length, completedToday:state.dayTasks.filter((task) => task.status === 'done').length, totalToday:state.dayTasks.length }
}

export function setVacancyStatus(state, vacancyId, status) { return { ...state, vacancies:state.vacancies.map((vacancy) => vacancy.id === vacancyId ? { ...vacancy,status } : vacancy) } }

export function normalizeProject(project) {
  const payment = project.payment || {}
  const toNumber = (value) => typeof value === 'number' ? value : (typeof value === 'string' && value.trim() ? Number(value.replace(/[^0-9.-]/g,'')) || null : null)
  const roadmap = Array.isArray(project.roadmap) ? project.roadmap.map((step) => typeof step === 'string' ? { text:step,done:false } : { text:step.text,done:Boolean(step.done) }) : []
  const total = toNumber(payment.total)
  const entries = Array.isArray(payment.entries) ? payment.entries : []
  const paidFromEntries = entries.reduce((sum,entry) => sum + (Number(entry.amount) || 0),0)
  const paid = toNumber(payment.paid) ?? (entries.length ? paidFromEntries : null)
  return { ...project, status:['active','waiting','archived'].includes(project.status) ? project.status : 'waiting', url:project.url || '', deadlineText:project.deadlineText || '', deadlineDate:project.deadlineDate || null,
    createdAt:project.createdAt || null, payment:{ total,paid,entries }, prepaid:Number(paid) > 0, started:project.status === 'active', roadmap, items:Array.isArray(project.items) ? project.items : [] }
}

export function countableProjects(state) { return state.projects.map(normalizeProject).filter((project) => project.status !== 'archived' && (project.prepaid || project.started)) }

export function moneySummary(state) {
  const projects = countableProjects(state)
  const total = projects.reduce((sum,project) => sum + (project.payment.total || 0),0)
  const paid = projects.reduce((sum,project) => sum + (project.payment.paid || 0),0)
  return { count:projects.length,total,paid,rest:Math.max(total-paid,0) }
}

export function formatMoney(value) { if (value == null) return '–'; return `${Number(value).toLocaleString('ru-RU')} ₽` }

export function daysUntil(dateString, today = new Date()) {
  if (!dateString) return null
  const target = new Date(`${dateString}T12:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const base = new Date(today); base.setHours(12,0,0,0)
  return Math.round((target-base)/86400000)
}

export function projectProgress(project) {
  const roadmap = project.roadmap || []
  if (!roadmap.length) return null
  return Math.round(roadmap.filter((step) => step.done).length / roadmap.length * 100)
}

export function filterProjects(state) {
  const normalized = state.projects.map(normalizeProject)
  const filtered = state.projectFilter === 'all' ? normalized : normalized.filter((project) => project.status === state.projectFilter)
  const sorted = [...filtered]
  if (state.projectSort === 'deadline') sorted.sort((a,b) => (a.deadlineDate || '9999-12-31').localeCompare(b.deadlineDate || '9999-12-31'))
  else if (state.projectSort === 'rest') sorted.sort((a,b) => ((b.payment.total||0)-(b.payment.paid||0))-((a.payment.total||0)-(a.payment.paid||0)))
  else sorted.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt))
  return sorted
}

export function submitCheckin({ energy, focus, distraction }) {
  if (!energy || !focus) return 'Следующее действие: оцени энергию и концентрацию'
  if (focus <= 2) return 'Следующее действие: убери отвлечение и сделай один 25-минутный блок'
  if (energy <= 2) return 'Следующее действие: сократи план до одного обязательного результата'
  if (distraction === 'phone') return 'Следующее действие: убери телефон на 25 минут и начни главное действие'
  return 'Следующее действие: продолжай текущий блок до конкретного результата'
}
