import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Tutorial.module.css';

export const TUTORIAL_KEY = 'tutorial_shown_v2';

const PAD = 12;
const TW = 300;

const STEPS = [
  // ── 1a: /creators — кнопка добавления ───────────────────────────────────────
  {
    id: 'creator-btn',
    route: '/creators',
    selector: '[data-tour="add-creator"]',
    title: 'Добавь первого креатора',
    text: 'Начнём с добавления креатора. Нажми кнопку + Добавить — откроется форма.',
    // Нет actionLabel: пользователь кликает реальную кнопку
    waitForEvent: 'tour:creator-form-opened',
  },
  // ── 1b: Форма добавления креатора ────────────────────────────────────────────
  {
    id: 'creator-form',
    route: '/creators',
    selector: '[data-tour="creator-modal"]',
    title: 'Заполни данные',
    text: 'Заполни форму и нажми Сохранить — тур перейдёт автоматически.',
    bullets: [
      'Имя — как будет отображаться в сервисе',
      'Username — никнейм на платформе',
      'Email — для инвайта (необязательно)',
      'Цвет аватара — визуальное отличие в списке',
      'План роликов — сколько роликов в месяц',
      'План охватов — целевые просмотры в месяц',
      'Расчётный период — дата начала работы. Позволяет отслеживать отставание от графика публикаций',
    ],
    waitForEvent: 'tour:creator-added',
  },
  // ── Инвайт: /creators — кнопка приглашения ──────────────────────────────────
  {
    id: 'creators-invite',
    route: '/creators',
    selector: '[data-tour="invite-creator-btn"]',
    title: 'Пригласи креатора',
    text: 'Чтобы креатор привязался к своей карточке — отправь ему ссылку-приглашение. Он войдёт в сервис и автоматически привяжется к своей карточке. После этого его email подтянется в профиль.',
    skipIfNotFound: true,
  },
  // ── 2a: /posts — кнопка добавления ролика ────────────────────────────────────
  {
    id: 'video-btn',
    route: '/posts',
    selector: '[data-tour="add-post"]',
    title: 'Добавь первый ролик',
    text: 'Нажми кнопку + Добавить ролик. Вставь ссылку с YouTube, TikTok или Instagram — статистика подтянется автоматически.',
    waitForEvent: 'tour:post-form-opened',
  },
  // ── 2b: Форма добавления ролика ──────────────────────────────────────────────
  {
    id: 'video-form',
    route: '/posts',
    selector: '[data-tour="post-modal"]',
    title: 'Вставь ссылку на ролик',
    text: 'Заполни форму и нажми Добавить — тур перейдёт автоматически.',
    bullets: [
      'Ссылка — полный URL ролика (YouTube / TikTok / Instagram)',
      'Креатор — к кому привязан ролик',
      'Дата — опционально, подтянется из API автоматически',
    ],
    waitForEvent: 'tour:video-added',
  },
  // ── 3: Вторая платформа (+) ──────────────────────────────────────────────────
  {
    id: 'add-platform',
    route: '/posts',
    selector: '[data-tour="add-platform"]',
    title: 'Добавь вторую платформу',
    text: 'Один ролик можно отслеживать на нескольких платформах сразу. Нажми + чтобы добавить ссылку на этот же контент с другой платформы.',
    // Нет actionLabel: пользователь кликает реальный "+"
    waitForEvent: 'tour:platform-added',
    skipIfNotFound: true,
  },
  // ── 4a: Дашборд — метрики ────────────────────────────────────────────────────
  {
    id: 'dash-metrics',
    route: '/',
    selector: '[data-tour="metrics"]',
    title: 'Метрики команды',
    text: 'Сводная статистика всей команды за выбранный период — просмотры, лайки, ER.',
    skipIfNotFound: true,
  },
  // ── 4б: Просмотры по платформам ──────────────────────────────────────────────
  {
    id: 'dash-plat',
    route: '/',
    selector: '[data-tour="plat-bars"]',
    title: 'Просмотры по платформам',
    text: 'Видно какая платформа даёт больше охватов и как менялась динамика.',
    skipIfNotFound: true,
  },
  // ── 4в: Рейтинг ──────────────────────────────────────────────────────────────
  {
    id: 'dash-rank',
    route: '/',
    selector: '[data-tour="ranking"]',
    title: 'Рейтинг креаторов',
    text: 'Кто из команды выполняет план по просмотрам и продажам.',
    skipIfNotFound: true,
  },
  // ── 4г: Строка креатора → личный дашборд ─────────────────────────────────────
  {
    id: 'dash-creator',
    route: '/',
    selector: '[data-tour="creator-row"]',
    title: 'Личный дашборд',
    text: 'Нажми на имя — откроется личный дашборд с детальной статистикой по каждому ролику.',
    actionLabel: 'Посмотреть →',
    clickSelector: '[data-tour="creator-row"]',
    autoNext: 1500,
    skipIfNotFound: true,
  },
  // ── 5: База роликов (/videos) ────────────────────────────────────────────────
  {
    id: 'videos-list',
    route: '/videos',
    selector: '[data-tour="videos-list"]',
    title: 'База роликов',
    text: 'Здесь вся база роликов всех креаторов. Фильтруй по платформе, креатору или периоду.',
    skipIfNotFound: true,
  },
  // ── 6: Воронка — ДЕМО ────────────────────────────────────────────────────────
  {
    id: 'funnel-demo',
    route: '/funnel',
    selector: null,
    isDemo: true,
    title: 'Воронка продаж',
  },
  // ── 7a: Настройки — профиль ──────────────────────────────────────────────────
  {
    id: 'settings-profile',
    route: '/settings',
    selector: '[data-tour="profile-section"]',
    title: 'Профиль',
    text: 'Здесь настройки аккаунта и данные профиля.',
  },
  // ── 7б: Настройки — команда ──────────────────────────────────────────────────
  {
    id: 'settings-team',
    route: '/settings',
    selector: '[data-tour="team-section"]',
    title: 'Команда и инвайты',
    text: 'Создавай ссылки-приглашения для креаторов и менеджеров. Выбирай роль и срок действия ссылки.',
    skipIfNotFound: true,
  },
  // ── 7в: Настройки — тариф ────────────────────────────────────────────────────
  {
    id: 'settings-billing',
    route: '/settings',
    selector: '[data-tour="billing-section"]',
    title: 'Тариф и подписка',
    text: 'Текущий тариф, дата следующего списания и управление подпиской.',
  },
  // ── Финал ────────────────────────────────────────────────────────────────────
  {
    id: 'final',
    selector: null,
    isFinal: true,
    title: 'Готово!',
    text: 'Теперь ты знаешь как пользоваться КонтентМетрикой. Удачи с контент-заводом!',
  },
];

// ── Позиция tooltip ───────────────────────────────────────────────────────────
function getPos(rect) {
  const W = window.innerWidth, H = window.innerHeight, G = 16;
  const cy = y => Math.max(8, Math.min(H - 300, y));
  const cx = x => Math.max(8, Math.min(W - TW - 8, x));
  if (rect.right + G + TW <= W)
    return { left: rect.right + G, top: cy(rect.top + rect.height / 2 - 120) };
  if (rect.left - G - TW >= 0)
    return { left: rect.left - G - TW, top: cy(rect.top + rect.height / 2 - 120) };
  if (rect.bottom + G + 300 <= H)
    return { left: cx(rect.left + rect.width / 2 - TW / 2), top: rect.bottom + G };
  return { left: cx(rect.left + rect.width / 2 - TW / 2), top: Math.max(8, rect.top - G - 260) };
}

// ── Компонент ─────────────────────────────────────────────────────────────────
export default function Tutorial({ onClose }) {
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);
  const nav = useNavigate();
  const loc = useLocation();
  const timerRef = useRef(null);
  const step = STEPS[idx];

  const finish = useCallback(() => {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    onClose();
  }, [onClose]);

  const next = useCallback(() => {
    clearTimeout(timerRef.current);
    setRect(null);
    setIdx(i => {
      const n = i + 1;
      if (n >= STEPS.length) { finish(); return i; }
      return n;
    });
  }, [finish]);

  // ── Навигация + поиск элемента ────────────────────────────────────────────
  useEffect(() => {
    if (step.route && loc.pathname !== step.route) {
      nav(step.route);
      return;
    }
    if (!step.selector) return;

    let cancelled = false, tries = 0;
    const find = () => {
      if (cancelled) return;
      const el = document.querySelector(step.selector);
      if (el) {
        setRect(el.getBoundingClientRect());
      } else {
        tries++;
        if (step.skipIfNotFound && tries > 20) { next(); return; }
        if (tries < 40) timerRef.current = setTimeout(find, 100);
      }
    };
    timerRef.current = setTimeout(find, step.route ? 600 : 80);
    return () => { cancelled = true; clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, loc.pathname]);

  // ── Событие авто-перехода ─────────────────────────────────────────────────
  useEffect(() => {
    if (!step.waitForEvent) return;
    const h = () => setTimeout(next, 400);
    window.addEventListener(step.waitForEvent, h);
    return () => window.removeEventListener(step.waitForEvent, h);
  }, [step.waitForEvent, next]);

  // ── Ресайз ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!rect || !step.selector) return;
    const update = () => {
      const el = document.querySelector(step.selector);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [rect, step.selector]);

  // ── Клик по целевому элементу (только для dash-creator) ───────────────────
  const doAction = useCallback(() => {
    if (!step.clickSelector) return;
    const sel = step.clickSelector.split(',').map(s => s.trim());
    const el = sel.reduce((found, s) => found || document.querySelector(s), null);
    el?.click();
    if (step.autoNext) {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setRect(null);
        setIdx(i => i + 1 < STEPS.length ? i + 1 : i);
      }, step.autoNext);
    }
  }, [step]);

  // ── Финальный экран ───────────────────────────────────────────────────────
  if (step.isFinal) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className={styles.tooltip} style={{ width: TW + 60, textAlign: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,106,0,0.12)', borderRadius: '50%' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff6a00" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="rgba(255,106,0,0.15)" stroke="none"/>
              <path d="M9 12l2 2 4-4"/>
              <circle cx="12" cy="12" r="10"/>
            </svg>
          </div>
          <h3 className={styles.title} style={{ fontSize: 22 }}>{step.title}</h3>
          <p className={styles.text}>{step.text}</p>
          <button className={styles.nextBtn} onClick={finish} style={{ width: '100%', marginTop: 4 }}>
            Начать работу
          </button>
        </div>
      </div>
    );
  }

  // ── Демо-экран (воронка) ──────────────────────────────────────────────────
  if (step.isDemo) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <SkipBtn onSkip={finish} />
        <div className={styles.tooltip} style={{ width: Math.min(780, window.innerWidth - 32), maxWidth: 780 }}>
          <Progress idx={idx} />
          <h3 className={styles.title}>{step.title}</h3>
          <FunnelDemo />
          <p className={styles.text} style={{ marginTop: 4 }}>
            Воронка продаж доступна на тарифе Про. Видно CAC каждого креатора, конверсия на каждом этапе и окупаемость.
          </p>
          <div className={styles.nav}>
            <button className={styles.skipBtn} onClick={finish}>Пропустить</button>
            <button className={styles.nextBtn} onClick={next}>Понятно →</button>
          </div>
        </div>
      </div>
    );
  }

  if (!rect) return null;

  const sx = rect.left - PAD, sy = rect.top - PAD;
  const sw = rect.width + PAD * 2, sh = rect.height + PAD * 2;
  const pos = getPos(rect);
  const isLast = idx === STEPS.length - 1;

  return (
    <>
      <SkipBtn onSkip={finish} />

      {/*
        pointer-events: none → клики проходят насквозь к элементу под overlay.
        Реальная кнопка на странице остаётся кликабельной.
      */}
      <div style={{
        position: 'fixed', left: sx, top: sy, width: sw, height: sh,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.70)',
        borderRadius: 12, border: '2px solid #ff6a00',
        zIndex: 9997,
        pointerEvents: 'none',
        transition: 'left 300ms ease, top 300ms ease, width 300ms ease, height 300ms ease',
      }} />

      {/* Tooltip */}
      <div className={styles.tooltip} style={{ position: 'fixed', left: pos.left, top: pos.top, width: TW, zIndex: 9999 }}>
        <Progress idx={idx} />
        <h3 className={styles.title}>{step.title}</h3>
        <p className={styles.text}>{step.text}</p>
        {step.bullets && (
          <ul className={styles.bullets}>
            {step.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}

        <div className={styles.nav}>
          {/* Пропустить — всегда слева */}
          <div /> {/* placeholder для flex spacing */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {step.actionLabel && (
              <button className={styles.actionBtn} onClick={doAction}>
                {step.actionLabel}
              </button>
            )}
            {step.waitForEvent ? (
              <span className={styles.waitHint}>↑ выполни действие</span>
            ) : !(step.autoNext && step.actionLabel) ? (
              <button className={styles.nextBtn} onClick={next}>
                {isLast ? 'Завершить ✓' : 'Далее →'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Вспомогательные компоненты ────────────────────────────────────────────────

// Проблема 2: кнопка "Пропустить" — левый нижний угол
function SkipBtn({ onSkip }) {
  return (
    <button
      onClick={onSkip}
      style={{
        position: 'fixed', bottom: 20, left: 20, zIndex: 10000,
        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 100, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font)',
        fontSize: 12, padding: '6px 14px', cursor: 'pointer', backdropFilter: 'blur(4px)',
      }}
    >
      Пропустить тур
    </button>
  );
}

function Progress({ idx }) {
  return (
    <div className={styles.progress}>
      {STEPS.map((_, i) => (
        <div key={i} className={[styles.dot, i === idx ? styles.dotActive : i < idx ? styles.dotDone : ''].join(' ')} />
      ))}
    </div>
  );
}

// Проблема 7: полная таблица воронки
function FunnelDemo() {
  const heads = [
    'КРЕАТОР','ОХВАТ','ЗАХОДЫ','ЗАХ/ОХВ','КОРЗИНА','КОРЗ/ЗАХ',
    'КОРЗ/ОХВ','ЗАКАЗЫ','ЗАК/КОРЗ','ЗАК/ОХВ','CPM','ВЫПЛАТА','CAC',
  ];
  const rows = [
    ['Мария К.',  '185 420','2 341','1.26%','892','38.1%','0.48%','134','15.0%','0.07%','₽198','₽42 000','₽313'],
    ['Дмитрий В.','124 880','1 156','0.93%','487','42.1%','0.39%', '89','18.3%','0.07%','₽278','₽38 000','₽427'],
    ['Елена С.',  '143 670',  '987','0.69%','398','40.3%','0.28%', '67','16.8%','0.05%','₽412','₽35 000','₽522'],
  ];
  return (
    <div style={{ overflowX: 'auto', margin: '8px 0', borderRadius: 8, border: '1px solid var(--border)' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 11, whiteSpace: 'nowrap' }}>
        <thead>
          <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
            {heads.map((h, i) => (
              <th key={h} style={{ padding: '6px 9px', color: 'var(--text3)', fontWeight: 700, textAlign: i === 0 ? 'left' : 'right', letterSpacing: '0.3px' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r[0]} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '7px 9px', color: 'var(--text)', fontWeight: 600 }}>{r[0]}</td>
              {r.slice(1).map((v, i) => {
                const isOrders = i === 6; // ЗАКАЗЫ
                const isCac = i === 11;   // CAC
                const isConv = [2,4,7,8].includes(i);
                return (
                  <td key={i} style={{
                    padding: '7px 9px', textAlign: 'right', fontWeight: isOrders || isCac ? 700 : 400,
                    color: isCac ? '#ff6a00' : isOrders ? 'var(--text)' : isConv ? 'var(--color-ok)' : 'var(--text2)',
                  }}>{v}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function useTutorial(role) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!role) return;
    if (!localStorage.getItem(TUTORIAL_KEY)) setShow(true);
  }, [role]);
  return [show, () => setShow(false)];
}
