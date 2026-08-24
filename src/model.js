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
  return {
    activeScreen: 'today',
    currentTask: {
      title: 'Проверить первый прототип Mini App',
      project: 'Личная Mini App',
      status: 'ready',
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
  return { today: 'Сегодня', projects: 'Проекты', vacancies: 'Вакансии', checkin: 'Чек-ин' }[state.activeScreen]
}

export function setCurrentTaskStatus(state, status) {
  return { ...state, currentTask: { ...state.currentTask, status } }
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
