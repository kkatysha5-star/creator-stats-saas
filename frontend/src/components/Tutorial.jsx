import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Tutorial.module.css';

export const TUTORIAL_KEY = 'tutorial_shown_v2';

const PAD = 10;
const TOOLTIP_W = 300;

const STEPS = [
  {
    id: 'dashboard',
    selector: 'a.nav-item[href="/"]',
    title: 'Дашборд',
    text: 'Здесь сводная статистика всей команды — просмотры, лайки, ER и выполнение плана',
  },
  {
    id: 'posts',
    selector: 'a.nav-item[href="/posts"]',
    title: 'Ролики',
    text: 'Все ролики команды в одном месте. YouTube, TikTok и Instagram.',
  },
  {
    id: 'add-video',
    selector: '[data-tour="add-video"]',
    route: '/videos',
    title: 'Добавь первый ролик',
    text: 'Попробуй сам! Вставь ссылку на любой ролик с YouTube, TikTok или Instagram — мы покажем статистику',
    actionLabel: 'Добавить ролик →',
    waitForEvent: 'tour:video-added',
  },
  {
    id: 'refresh',
    selector: 'button[title="Обновить статистику"]',
    title: 'Обновление статистики',
    text: 'Нажми ↻ чтобы обновить статистику вручную. Данные берутся напрямую с платформ.',
    skipIfNotFound: true,
  },
  {
    id: 'creators',
    selector: 'a.nav-item[href="/creators"]',
    title: 'Креаторы',
    text: 'Управляй командой — добавляй креаторов, приглашай менеджеров, смотри план каждого',
    skipIfNotFound: true,
  },
  {
    id: 'funnel',
    selector: 'a.nav-item[href="/funnel"]',
    title: 'Воронка',
    text: 'Воронка продаж — CAC, лиды и конверсия. Доступно на тарифе Про.',
  },
];

function getTooltipPos(rect) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const GAP = 16;
  const clampY = (y) => Math.max(12, Math.min(H - 240, y));
  const clampX = (x) => Math.max(12, Math.min(W - TOOLTIP_W - 12, x));

  // right of element
  if (rect.right + GAP + TOOLTIP_W + 16 <= W) {
    return { left: rect.right + GAP, top: clampY(rect.top + rect.height / 2 - 90) };
  }
  // left of element
  if (rect.left - GAP - TOOLTIP_W >= 0) {
    return { left: rect.left - GAP - TOOLTIP_W, top: clampY(rect.top + rect.height / 2 - 90) };
  }
  // below
  if (rect.bottom + GAP + 220 <= H) {
    return { left: clampX(rect.left + rect.width / 2 - TOOLTIP_W / 2), top: rect.bottom + GAP };
  }
  // above
  return { left: clampX(rect.left + rect.width / 2 - TOOLTIP_W / 2), top: Math.max(12, rect.top - GAP - 200) };
}

export default function Tutorial({ onClose }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const timerRef = useRef(null);
  const step = STEPS[stepIndex];

  const finish = useCallback(() => {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    onClose();
  }, [onClose]);

  const nextStep = useCallback(() => {
    setRect(null);
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(i => i + 1);
    } else {
      finish();
    }
  }, [stepIndex, finish]);

  // Navigate to step's required route
  useEffect(() => {
    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
      return;
    }

    let cancelled = false;
    let tries = 0;

    const find = () => {
      if (cancelled) return;
      const el = document.querySelector(step.selector);
      if (el) {
        setRect(el.getBoundingClientRect());
      } else {
        tries++;
        if (step.skipIfNotFound && tries > 20) {
          nextStep();
        } else if (tries < 40) {
          timerRef.current = setTimeout(find, 100);
        }
      }
    };

    timerRef.current = setTimeout(find, step.route ? 350 : 80);
    return () => {
      cancelled = true;
      clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, location.pathname]);

  // Auto-advance when video is saved (step 3)
  useEffect(() => {
    if (!step.waitForEvent) return;
    const handler = () => setTimeout(nextStep, 400);
    window.addEventListener(step.waitForEvent, handler);
    return () => window.removeEventListener(step.waitForEvent, handler);
  }, [step.waitForEvent, nextStep]);

  // Reposition on resize
  useEffect(() => {
    if (!rect) return;
    const update = () => {
      const el = document.querySelector(step.selector);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [rect, step.selector]);

  const handleAction = () => {
    const el = document.querySelector('[data-tour="add-video"] button')
            || document.querySelector('[data-tour="add-video"]');
    el?.click();
  };

  if (!rect) return null;

  const spotX = rect.left - PAD;
  const spotY = rect.top - PAD;
  const spotW = rect.width + PAD * 2;
  const spotH = rect.height + PAD * 2;
  const pos = getTooltipPos(rect);
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <>
      {/* Overlay с вырезом под элемент */}
      <svg
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 9998, pointerEvents: 'none' }}
      >
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={spotX} y={spotY} width={spotW} height={spotH} rx={10} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.72)" mask="url(#tour-mask)" />
        {/* Оранжевая обводка вокруг spotlight */}
        <rect x={spotX - 1.5} y={spotY - 1.5} width={spotW + 3} height={spotH + 3} rx={11} fill="none" stroke="#ff6a00" strokeWidth="2" opacity="0.9" />
      </svg>

      {/* Tooltip */}
      <div
        className={styles.tooltip}
        style={{ position: 'fixed', left: pos.left, top: pos.top, width: TOOLTIP_W, zIndex: 9999 }}
      >
        <div className={styles.progress}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={[styles.dot, i === stepIndex ? styles.dotActive : i < stepIndex ? styles.dotDone : ''].join(' ')}
            />
          ))}
        </div>

        <h3 className={styles.title}>{step.title}</h3>
        <p className={styles.text}>{step.text}</p>

        {step.actionLabel && (
          <button className={styles.actionBtn} onClick={handleAction}>
            {step.actionLabel}
          </button>
        )}

        <div className={styles.nav}>
          <button className={styles.skipBtn} onClick={finish}>Пропустить</button>
          {!step.waitForEvent && (
            <button className={styles.nextBtn} onClick={nextStep}>
              {isLast ? 'Завершить ✓' : 'Далее →'}
            </button>
          )}
          {step.waitForEvent && (
            <span className={styles.waitHint}>добавь ролик ↑</span>
          )}
        </div>
      </div>
    </>
  );
}

export function useTutorial(role) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!role) return;
    const seen = localStorage.getItem(TUTORIAL_KEY);
    if (!seen) setShow(true);
  }, [role]);

  return [show, () => setShow(false)];
}
