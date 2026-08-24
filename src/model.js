const projects = [
  {
    id: 'money-teeth',
    demo: true,
    title: 'Деньги на зубах',
    client: 'Клиентский проект',
    description: 'Подписочный клуб и автоматизация клиентского пути',
    stage: 'Первый этап завершён',
    status: 'waiting-payment',
    nextAction: 'Проверить поступление остатка оплаты',
    deadline: '27 августа',
    nextMove: 'Клиент',
    payment: { total: 'Не указано', paid: 'Не указано', rest: 'Уточнить' },
    risk: 'Ожидается остаток оплаты',
    firstContact: 'Уточнить',
    startedAt: 'Уточнить',
    result: 'Работающий первый этап подписочного клуба',
    roadmap: ['Первый этап завершён', 'Получить остаток оплаты', 'Согласовать следующий этап'],
    questions: ['Сумма остатка оплаты', 'Состав следующего этапа'],
  },
  {
    id: 'natalia',
    demo: true,
    title: 'Воронка Наталии',
    client: 'Наталия',
    description: 'Воронка для бухгалтерского сопровождения',
    stage: 'Исследование клиента',
    status: 'client-turn',
    nextAction: 'Получить разбор пути реального клиента',
    deadline: 'Уточнить',
    nextMove: 'Клиент',
    payment: { total: 'Уточнить', paid: 'Уточнить', rest: 'Уточнить' },
    risk: 'Нет подтверждённого срока следующего ответа',
    firstContact: '28 июля 2026',
    startedAt: '29 июля 2026',
    result: 'Воронка: лид-магнит → квалификация → консультация → сопровождение',
    roadmap: ['Путь клиента', 'Основной продукт', 'Консультация', 'Лид-магнит', 'Материалы', 'Сборка бота'],
    questions: ['Точный состав сопровождения', 'Формат консультации', 'Лид-магнит'],
  },
  {
    id: 'mini-app',
    demo: true,
    title: 'Личная Mini App',
    client: 'Личный проект',
    description: 'Проекты, вакансии и быстрые чек-ины внутри Telegram',
    stage: 'Прототип',
    status: 'in-progress',
    nextAction: 'Проверить первый интерфейс на телефоне',
    deadline: 'После готовности прототипа',
    nextMove: 'Денис',
    payment: { total: '–', paid: '–', rest: '–' },
    risk: 'Не перегрузить первую версию',
    firstContact: '24 августа 2026',
    startedAt: '24 августа 2026',
    result: 'Простая рабочая панель внутри Telegram',
    roadmap: ['Кликабельный прототип', 'База данных', 'Telegram', 'Hermes', 'Переносимый запуск'],
    questions: ['Визуальная обратная связь', 'Состав реальных данных для переноса'],
  },
]

const vacancies = [
  {
    id: 'tech-specialist',
    title: 'Технический специалист онлайн-проекта',
    company: 'Демонстрационная вакансия',
    format: 'Удалённо',
    salary: '100 000 ₽',
    match: 82,
    summary: 'GetCourse, SaleBot, amoCRM, вебинары и автоматизации',
    status: 'review',
    url: '#',
    response: 'Отклик ещё не подготовлен',
    risks: ['Нужно уточнить занятость', 'Возможна работа по выходным'],
  },
  {
    id: 'funnel-integrator',
    title: 'Интегратор автоворонок',
    company: 'Демонстрационная вакансия',
    format: 'Проектно',
    salary: '20 000–45 000 ₽',
    match: 91,
    summary: 'SaleBot + GetCourse, оплаты, сегментация и сообщения',
    status: 'later',
    url: '#',
    response: 'Есть подтверждённые кейсы для отклика',
    risks: ['Нужно уточнить точный объём функционала'],
  },
]

export function createInitialState() {
  const dayTasks = [
    { id: 'task-0', title: 'Определить структуру ближайшей версии', project: 'Личная Mini App', priority: 0, status: 'done', estimate: '20 мин' },
    { id: 'task-1', title: 'Проверить обновлённый прототип Mini App', project: 'Личная Mini App', priority: 1, status: 'ready', estimate: '15 мин' },
    { id: 'task-2', title: 'Дать короткую обратную связь по интерфейсу', project: 'Личная Mini App', priority: 2, status: 'ready', estimate: '10 мин' },
    { id: 'task-3', title: 'Проверить поступление оплаты', project: 'Деньги на зубах', priority: 3, status: 'ready', estimate: '5 мин' },
  ]
  return {
    activeScreen: 'today',
    profileOpen: false,
    currentTask: { ...dayTasks.find((task) => task.status !== 'done') },
    dayTasks,
    weeklyFocus: {
      title: 'Собрать и проверить первую рабочую Mini App',
      completed: 2,
      total: 5,
      progress: 40,
      deadline: '30 августа',
    },
    calendarEvents: [
      { day: 24, type: 'task', label: 'Прототип Mini App' },
      { day: 25, type: 'task', label: 'Проверка интерфейса' },
      { day: 27, type: 'payment', label: 'Остаток оплаты' },
      { day: 28, type: 'deadline', label: 'Контроль проектов' },
      { day: 30, type: 'focus', label: 'Фокус недели' },
    ],
    vacancySearch: {
      schedule: ['12:00', '16:00', '20:00'],
      weekdaysOnly: true,
      lastRun: 'Ещё не запускался по расписанию',
      status: 'scheduled',
    },
    projects: structuredClone(projects),
    vacancies: structuredClone(vacancies),
    selectedProjectId: null,
    selectedVacancyId: null,
    checkin: { energy: null, focus: null, distraction: null },
    checkinResult: '',
  }
}

export function getScreenTitle(state) {
  return { today: 'Сегодня', calendar: 'Календарь', projects: 'Проекты', vacancies: 'Вакансии', checkin: 'Чек-ин' }[state.activeScreen]
}

export function setCurrentTaskStatus(state, status) {
  return {
    ...state,
    currentTask: { ...state.currentTask, status },
    dayTasks: state.dayTasks.map((task) => task.id === state.currentTask.id ? { ...task, status } : task),
  }
}

export function completeCurrentTask(state) {
  const dayTasks = state.dayTasks.map((task) => task.id === state.currentTask.id ? { ...task, status: 'done' } : task)
  const nextTask = [...dayTasks]
    .filter((task) => task.status !== 'done')
    .sort((a, b) => a.priority - b.priority)[0]
  return {
    ...state,
    dayTasks,
    currentTask: nextTask ? { ...nextTask } : { id: 'none', title: 'Все задачи на день выполнены', project: 'Сегодня', priority: 999, status: 'done', estimate: '–' },
  }
}

export function getProfileStats(state) {
  return {
    activeProjects: state.projects.length,
    riskyProjects: state.projects.filter((project) => project.risk && project.risk !== 'Нет').length,
    totalVacancies: state.vacancies.length,
    responsesPreparing: state.vacancies.filter((vacancy) => vacancy.status === 'preparing').length,
    completedToday: state.dayTasks.filter((task) => task.status === 'done').length,
    totalToday: state.dayTasks.length,
  }
}

export function setVacancyStatus(state, vacancyId, status) {
  return {
    ...state,
    vacancies: state.vacancies.map((vacancy) => vacancy.id === vacancyId ? { ...vacancy, status } : vacancy),
  }
}

export function submitCheckin({ energy, focus, distraction }) {
  if (!energy || !focus) return 'Следующее действие: оцени энергию и концентрацию'
  if (focus <= 2) return 'Следующее действие: убери отвлечение и сделай один 25-минутный блок'
  if (energy <= 2) return 'Следующее действие: сократи план до одного обязательного результата'
  if (distraction === 'phone') return 'Следующее действие: убери телефон на 25 минут и начни главное действие'
  return 'Следующее действие: продолжай текущий блок до конкретного результата'
}
