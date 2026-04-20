import { useState, useEffect } from 'react';
import styles from './Tutorial.module.css';

const OWNER_SLIDES = [
  {
    icon: '🎬',
    title: 'Добавление роликов',
    text: 'Ваши креаторы заходят в раздел «Ролики» и нажимают «+ Добавить ролик». Они вставляют ссылку — название и статистика подтягиваются автоматически.',
    tip: 'Чтобы добавить этот же ролик на другой платформе — нажмите «+» рядом с роликом. Один ролик = одна строка, но несколько платформ.',
  },
  {
    icon: '📊',
    title: 'Воронка продаж',
    text: 'В разделе «Воронка» создайте период для каждого креатора. Укажите дату начала — не все начинают с 1-го числа.',
    tip: 'Вносите данные продаж раз в неделю. Важно: вводите цифры накопительно — от начала периода до сегодня. Данные не суммируются.',
  },
  {
    icon: '💰',
    title: 'Зарплата и выплаты',
    text: 'В воронке при редактировании периода есть поле «Выплата». Сумма зарплаты видна только вам — креаторы её не видят.',
    tip: 'Из выплаты автоматически считается CAC (стоимость привлечения покупателя) и CPM.',
  },
  {
    icon: '✉️',
    title: 'Приглашение команды',
    text: 'Зайдите в раздел «Креаторы» → добавьте креатора → нажмите значок ✉ на его карточке. Скопируйте ссылку и отправьте ему.',
    tip: 'Также можно пригласить менеджера — он будет видеть всё кроме выплат. Это делается в Настройках → Команда.',
  },
];

const CREATOR_SLIDES = [
  {
    icon: '🎬',
    title: 'Добавление роликов',
    text: 'Заходите в раздел «Ролики» и нажимайте «+ Добавить ролик». Вставьте ссылку на видео — название и статистика подтянутся автоматически.',
    tip: 'Если ролик вышел на нескольких платформах — нажмите «+» рядом с роликом и добавьте ссылку на другую платформу.',
  },
  {
    icon: '📈',
    title: 'Ваша статистика',
    text: 'На дашборде вы видите общую статистику. Нажмите на своё имя в таблице — откроется личная страница с детальной аналитикой по всем роликам.',
    tip: 'Статистика обновляется автоматически каждые 6 часов. Можно обновить вручную кнопкой «↻ Обновить данные».',
  },
  {
    icon: '🛒',
    title: 'Воронка продаж',
    text: 'В разделе «Воронка» вы видите конверсии — сколько людей зашли по артикулу, положили в корзину и купили.',
    tip: 'Данные в воронку вносит владелец. Вы видите свои показатели и можете сравнить с предыдущим периодом.',
  },
];

const TUTORIAL_KEY = 'tutorial_seen_v1';

export default function Tutorial({ role, onClose }) {
  const slides = role === 'owner' ? OWNER_SLIDES : CREATOR_SLIDES;
  const [current, setCurrent] = useState(0);

  const handleClose = () => {
    localStorage.setItem(TUTORIAL_KEY + '_' + role, '1');
    onClose();
  };

  const handleNext = () => {
    if (current < slides.length - 1) {
      setCurrent(current + 1);
    } else {
      handleClose();
    }
  };

  const slide = slides[current];

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {/* Прогресс */}
        <div className={styles.progress}>
          {slides.map((_, i) => (
            <div
              key={i}
              className={styles.dot + (i === current ? ' ' + styles.dotActive : i < current ? ' ' + styles.dotDone : '')}
              onClick={() => setCurrent(i)}
            />
          ))}
        </div>

        {/* Контент */}
        <div className={styles.icon}>{slide.icon}</div>
        <h2 className={styles.title}>{slide.title}</h2>
        <p className={styles.text}>{slide.text}</p>

        {slide.tip && (
          <div className={styles.tip}>
            <span className={styles.tipIcon}>💡</span>
            <span>{slide.tip}</span>
          </div>
        )}

        {/* Навигация */}
        <div className={styles.nav}>
          <button className={styles.skipBtn} onClick={handleClose}>
            Пропустить
          </button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {current > 0 && (
              <button className={styles.prevBtn} onClick={() => setCurrent(current - 1)}>
                ← Назад
              </button>
            )}
            <button className={styles.nextBtn} onClick={handleNext}>
              {current < slides.length - 1 ? 'Далее →' : 'Начать работу ✓'}
            </button>
          </div>
        </div>

        <p className={styles.counter}>{current + 1} / {slides.length}</p>
      </div>
    </div>
  );
}

// Хук для проверки нужно ли показывать туториал
export function useTutorial(role) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!role) return;
    const seen = localStorage.getItem(TUTORIAL_KEY + '_' + role);
    if (!seen) setShow(true);
  }, [role]);

  return [show, () => setShow(false)];
}
