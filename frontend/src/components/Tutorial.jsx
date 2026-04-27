import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Tutorial.module.css';

export const TUTORIAL_KEY = 'tutorial_shown_v2';

const PAD = 12;
const TW = 300;

const STEPS = [
  // ── 1a: Страница /creators — кнопка добавления ──────────────────────────────
  {
    id: 'creator-btn',
    route: '/creators',
    selector: '[data-tour="add-creator"]',
    title: 'Добавь первого креатора',
    text: 'Начнём с добавления креатора. Нажми кнопку — откроется форма. Потом его можно удалить, это просто тест.',
    actionLabel: 'Добавить креатора →',
    clickSelector: '[data-tour="add-creator"] button, [data-tour="add-creator"]',
    autoNext: 350,
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
      'Ставка — дневная ставка',
    ],
    waitForEvent: 'tour:creator-added',
  },
  // ── 2a: Страница /videos — кнопка добавления ─────────────────────────────────
  {
    id: 'video-btn',
    route: '/videos',
    selector: '[data-tour="add-video"]',
    title: 'Добавь первый ролик',
    text: 'Теперь добавим ролик. Вставь ссылку с YouTube, TikTok или Instagram — статистика подтянется автоматически.',
    actionLabel: 'Добавить ролик →',
    clickSelector: '[data-tour="add-video"] button, [data-tour="add-video"]',
    autoNext: 350,
  },
  // ── 2b: Форма добавления ролика ──────────────────────────────────────────────
  {
    id: 'video-form',
    route: '/videos',
    selector: '[data-tour="video-modal"]',
    title: 'Вставь ссылку на ролик',
    text: 'Заполни форму и нажми Добавить — тур перейдёт автоматически.',
    bullets: [
      'Креатор — к кому привязан ролик',
      'Ссылка — полный URL видео',
      'Дата — подтянется из API',
    ],
    waitForEvent: 'tour:video-added',
  },
  // ── 3: Вторая платформа (+) ──────────────────────────────────────────────────
  {
    id: 'add-platform',
    route: '/posts',
    selector: '[data-tour="add-platform"]',
    title: 'Добавь вторую платформу',
    text: 'Один ролик можно отслеживать сразу на нескольких платформах. Нажми + чтобы добавить тот же контент с другой платформы.',
    actionLabel: 'Попробовать →',
    clickSelector: '[data-tour="add-platform"]',
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
  // ── 4b: Просмотры по платформам ──────────────────────────────────────────────
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
    text: 'Доступна на тарифе Про. Показывает путь от просмотра до покупки: охваты → заходы → корзина → заказы. Видно CAC каждого креатора и окупаемость.',
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
    text: 'Теперь ты знаешь как пользоваться КонтентМетрикой. Удачи с контент-заводом 🚀',
  },
];

// ── Позиция tooltip ───────────────────────────────────────────────────────────

function getPos(rect) {
  const W = window.innerWidth, H = window.innerHeight, G = 16;
  const cy = y => Math.max(8, Math.min(H - 280, y));
  const cx = x => Math.max(8, Math.min(W - TW - 8, x));
  if (rect.right + G + TW <= W)
    return { left: rect.right + G, top: cy(rect.top + rect.height / 2 - 110) };
  if (rect.left - G - TW >= 0)
    return { left: rect.left - G - TW, top: cy(rect.top + rect.height / 2 - 110) };
  if (rect.bottom + G + 280 <= H)
    return { left: cx(rect.left + rect.width / 2 - TW / 2), top: rect.bottom + G };
  return { left: cx(rect.left + rect.width / 2 - TW / 2), top: Math.max(8, rect.top - G - 250) };
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
      return n < STEPS.length ? n : i;
    });
    if (idx >= STEPS.length - 1) finish();
  }, [idx, finish]);

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
    timerRef.current = setTimeout(find, step.route ? 400 : 80);
    return () => { cancelled = true; clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, loc.pathname]);

  // ── Событие авто-перехода ─────────────────────────────────────────────────
  useEffect(() => {
    if (!step.waitForEvent) return;
    const h = () => setTimeout(next, 500);
    window.addEventListener(step.waitForEvent, h);
    return () => window.removeEventListener(step.waitForEvent, h);
  }, [step.waitForEvent, next]);

  // ── Обновление позиции при ресайзе ────────────────────────────────────────
  useEffect(() => {
    if (!rect || !step.selector) return;
    const update = () => {
      const el = document.querySelector(step.selector);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [rect, step.selector]);

  // ── Клик по целевому элементу ─────────────────────────────────────────────
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
          <div style={{ fontSize: 52, lineHeight: 1 }}>🚀</div>
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
        <div className={styles.tooltip} style={{ width: Math.min(560, window.innerWidth - 32), maxWidth: 560 }}>
          <Progress idx={idx} />
          <h3 className={styles.title}>{step.title}</h3>
          <p className={styles.text}>{step.text}</p>
          <FunnelDemo />
          <div className={styles.nav}>
            <button className={styles.skipBtn} onClick={finish}>Пропустить</button>
            <button className={styles.nextBtn} onClick={next}>Понятно →</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Ожидание элемента ─────────────────────────────────────────────────────
  if (!rect) return null;

  const sx = rect.left - PAD, sy = rect.top - PAD;
  const sw = rect.width + PAD * 2, sh = rect.height + PAD * 2;
  const pos = getPos(rect);
  const isLast = idx === STEPS.length - 1;

  return (
    <>
      <SkipBtn onSkip={finish} />

      {/*
        Spotlight via box-shadow.
        pointer-events: none → все клики проходят насквозь к элементу.
        Сам элемент за spotlight'ом кликабелен — overlay его не блокирует.
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
      <div
        className={styles.tooltip}
        style={{ position: 'fixed', left: pos.left, top: pos.top, width: TW, zIndex: 9999 }}
      >
        <Progress idx={idx} />
        <h3 className={styles.title}>{step.title}</h3>
        <p className={styles.text}>{step.text}</p>
        {step.bullets && (
          <ul className={styles.bullets}>
            {step.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}

        <div className={styles.nav}>
          <button className={styles.skipBtn} onClick={finish}>Пропустить</button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {step.actionLabel && (
              <button className={styles.actionBtn} onClick={doAction}>
                {step.actionLabel}
              </button>
            )}
            {step.waitForEvent ? (
              <span className={styles.waitHint}>↑ выполни действие</span>
            ) : !(step.autoNext && step.actionLabel) && (
              <button className={styles.nextBtn} onClick={next}>
                {isLast ? 'Завершить ✓' : 'Далее →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Вспомогательные компоненты ────────────────────────────────────────────────

function SkipBtn({ onSkip }) {
  return (
    <button
      onClick={onSkip}
      style={{
        position: 'fixed', top: 14, right: 14, zIndex: 10000,
        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 100, color: 'rgba(255,255,255,0.75)', fontFamily: 'var(--font)',
        fontSize: 12, padding: '6px 14px', cursor: 'pointer', backdropFilter: 'blur(4px)',
      }}
    >
      Пропустить ✕
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

function FunnelDemo() {
  const rows = [
    { name: 'Мария К.',   views: '186 400', visits: '2 230', cart: '890', orders: '178', cac: '1 120 ₽', cr: '2.1%' },
    { name: 'Дмитрий В.', views: '124 800', visits: '1 490', cart: '595', orders: '119', cac: '1 345 ₽', cr: '1.9%' },
    { name: 'Елена С.',   views: '97 300',  visits: '1 169', cart: '409', orders: '82',  cac: '1 220 ₽', cr: '2.0%' },
  ];
  const heads = ['Креатор', 'Охваты', 'Заходы', 'Корзина', 'Заказы', 'CAC', 'CR'];
  return (
    <div style={{ overflowX: 'auto', margin: '6px 0', borderRadius: 8, border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg3)' }}>
            {heads.map((h, i) => (
              <th key={h} style={{ padding: '7px 10px', color: 'var(--text3)', fontWeight: 600, textAlign: i === 0 ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.name} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 10px', color: 'var(--text)', fontWeight: 600 }}>{r.name}</td>
              <td style={{ padding: '8px 10px', color: 'var(--text2)', textAlign: 'right' }}>{r.views}</td>
              <td style={{ padding: '8px 10px', color: 'var(--text2)', textAlign: 'right' }}>{r.visits}</td>
              <td style={{ padding: '8px 10px', color: 'var(--text2)', textAlign: 'right' }}>{r.cart}</td>
              <td style={{ padding: '8px 10px', color: 'var(--text)', textAlign: 'right', fontWeight: 700 }}>{r.orders}</td>
              <td style={{ padding: '8px 10px', color: '#ff6a00', textAlign: 'right', fontWeight: 700 }}>{r.cac}</td>
              <td style={{ padding: '8px 10px', color: 'var(--color-ok)', textAlign: 'right', fontWeight: 700 }}>{r.cr}</td>
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
