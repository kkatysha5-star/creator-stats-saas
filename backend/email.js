import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'КонтентМетрика <noreply@cmetrika.com>';

async function send(to, subject, html) {
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    console.log(`[email] Sent "${subject}" to ${to}`);
  } catch (e) {
    console.error(`[email] Failed to send "${subject}" to ${to}:`, e.message);
  }
}

// ─── Shared template ──────────────────────────────────────────────────────────

function btn(url, text) {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background:#ff6a00;border-radius:100px;padding:14px 28px;">
      <a href="${url}" style="color:#fff;font-size:15px;font-weight:700;text-decoration:none;white-space:nowrap;">${text}</a>
    </td></tr>
  </table>`;
}

function buildHtml(bodyContent) {
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
  <tr><td align="center">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">

    <!-- Header -->
    <tr><td style="background:#080808;padding:22px 32px;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="width:40px;height:40px;background:#ff6a00;border-radius:10px;text-align:center;vertical-align:middle;color:#fff;font-weight:700;font-size:15px;line-height:40px;">КМ</td>
        <td style="padding-left:12px;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">КонтентМетрика</td>
      </tr></table>
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:32px 32px 24px;">
      ${bodyContent}
    </td></tr>

    <!-- Footer -->
    <tr><td style="background:#f9f9f9;padding:18px 32px;text-align:center;border-top:1px solid #eeeeee;">
      <span style="color:#aaaaaa;font-size:12px;">© 2026 КонтентМетрика · <a href="https://cmetrika.com" style="color:#aaaaaa;text-decoration:none;">cmetrika.com</a></span>
    </td></tr>

  </table>
  </td></tr>
</table>
</body></html>`;
}

function p(text) {
  return `<p style="margin:0 0 14px;color:#333333;font-size:15px;line-height:1.6;">${text}</p>`;
}

function h2(text) {
  return `<h2 style="margin:0 0 18px;color:#111111;font-size:22px;font-weight:700;letter-spacing:-0.4px;">${text}</h2>`;
}

function pricingCards() {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 8px;">
    <tr>
      <td width="48%" style="background:#f9f9f9;border:1px solid #eeeeee;border-radius:10px;padding:20px;vertical-align:top;">
        <div style="font-size:17px;font-weight:700;color:#111;">Старт</div>
        <div style="font-size:26px;font-weight:800;color:#111;margin:8px 0 2px;">1 990 ₽</div>
        <div style="font-size:12px;color:#888;margin-bottom:12px;">в месяц</div>
        <div style="font-size:13px;color:#555;line-height:1.7;">
          ✓ До 5 креаторов<br>
          ✓ YouTube, TikTok, Instagram<br>
          ✓ Автообновление статистики
        </div>
      </td>
      <td width="4%"></td>
      <td width="48%" style="background:#fff5ee;border:2px solid #ff6a00;border-radius:10px;padding:20px;vertical-align:top;">
        <div style="font-size:17px;font-weight:700;color:#ff6a00;">Про</div>
        <div style="font-size:26px;font-weight:800;color:#111;margin:8px 0 2px;">3 990 ₽</div>
        <div style="font-size:12px;color:#888;margin-bottom:12px;">в месяц</div>
        <div style="font-size:13px;color:#555;line-height:1.7;">
          ✓ До 20 креаторов<br>
          ✓ + Воронка продаж<br>
          ✓ YouTube, TikTok, Instagram
        </div>
      </td>
    </tr>
  </table>`;
}

// ─── 0. Подтверждение почты ───────────────────────────────────────────────────

export async function sendVerifyEmail(user, verifyUrl) {
  const html = buildHtml(`
    ${h2('Подтвердите почту')}
    ${p(`Здравствуйте, ${user.name}!`)}
    ${p('Вы указали этот адрес при регистрации в КонтентМетрике. Нажмите кнопку ниже, чтобы подтвердить его и получить доступ к аккаунту.')}
    ${p('Ссылка действительна в течение 24 часов. Если вы не регистрировались в КонтентМетрике, просто проигнорируйте это письмо.')}
    ${btn(verifyUrl, 'Подтвердить почту →')}
  `);
  await send(user.email, 'Подтвердите почту, чтобы войти в КонтентМетрику', html);
}

// ─── 1. Приветствие ───────────────────────────────────────────────────────────

export async function sendWelcome(user) {
  const html = buildHtml(`
    ${h2('Добро пожаловать!')}
    ${p(`Здравствуйте, ${user.name}!`)}
    ${p('Вы зарегистрировались в КонтентМетрике — платформе, которая собирает статистику по всем вашим креаторам автоматически.')}
    ${p('Добавьте первого креатора самостоятельно (или сразу пригласите креатора) — внесите ссылки на несколько роликов для теста, далее креатор самостоятельно вносит данные.')}
    ${p('Первая статистика появится сразу после добавления. Дальше платформа будет обновлять данные каждые 12 часов без вашего участия.')}
    ${p('Если что-то непонятно, пишите на <a href="mailto:support@cmetrika.com" style="color:#ff6a00;">support@cmetrika.com</a>')}
    ${btn('https://app.cmetrika.com', 'Перейти в сервис →')}
  `);
  await send(user.email, 'Добро пожаловать в КонтентМетрику — ваши 7 дней начались', html);
}

// ─── 2. Триал заканчивается через 2 дня ──────────────────────────────────────

export async function sendTrialEndingSoon(user, daysUsed) {
  const html = buildHtml(`
    ${h2('Скоро заканчивается бесплатный доступ')}
    ${p(`Здравствуйте, ${user.name}!`)}
    ${p(`Вы уже ${daysUsed} ${daysUsed === 1 ? 'день' : daysUsed < 5 ? 'дня' : 'дней'} пользуетесь КонтентМетрикой и видите, как выглядит аналитика без ручного сбора данных.`)}
    ${p('Через 2 дня бесплатный период завершится. Чтобы не потерять доступ и не возвращаться к таблицам, выберите тариф сейчас.')}
    ${pricingCards()}
    ${p('Если не уверены, какой тариф подходит, начните со «Старта». Перейти на «Про» можно в любой момент.')}
    ${btn('https://app.cmetrika.com/billing', 'Выбрать тариф →')}
  `);
  await send(user.email, 'Через 2 дня заканчивается бесплатный доступ к КонтентМетрике', html);
}

// ─── 3. Триал закончился ─────────────────────────────────────────────────────

export async function sendTrialEnded(user) {
  const html = buildHtml(`
    ${h2('Бесплатный доступ завершён')}
    ${p(`Здравствуйте, ${user.name}!`)}
    ${p('Бесплатный период закончился. Аккаунт переведён в режим чтения: добавлять ролики и получать обновления статистики пока недоступно.')}
    ${p('Всё, что вы настроили, сохранено. Один шаг — и продолжите с того же места.')}
    ${pricingCards()}
    ${btn('https://app.cmetrika.com/billing', 'Продолжить работу →')}
  `);
  await send(user.email, 'Бесплатный доступ к КонтентМетрике завершён — данные вас ждут', html);
}

// ─── 4. Оплата прошла ────────────────────────────────────────────────────────

export async function sendPaymentSuccess(user, { planName, amount, nextDate }) {
  const html = buildHtml(`
    ${h2('Оплата принята')}
    ${p(`Здравствуйте, ${user.name}!`)}
    ${p(`Оплата на сумму <strong>${amount} ₽</strong> прошла успешно. Тариф «${planName}» активен.`)}
    ${p(`Следующее списание — ${nextDate}. Управлять подпиской и платёжными данными можно в настройках аккаунта.`)}
    ${p('Спасибо, что выбрали КонтентМетрику.')}
    ${btn('https://app.cmetrika.com/settings', 'Настройки подписки →')}
  `);
  await send(user.email, `Оплата КонтентМетрики принята — тариф «${planName}» активен`, html);
}

// ─── 5. Напоминание о списании ───────────────────────────────────────────────

export async function sendPaymentReminder(user, { planName, amount, date }) {
  const html = buildHtml(`
    ${h2('Напоминание о списании')}
    ${p(`Здравствуйте, ${user.name}!`)}
    ${p(`Напоминаем: <strong>${date}</strong> спишем <strong>${amount} ₽</strong> за тариф «${planName}».`)}
    ${p('Если хотите отменить или сменить тариф, сделайте это в настройках аккаунта до указанной даты.')}
    ${btn('https://app.cmetrika.com/settings', 'Настройки подписки →')}
  `);
  await send(user.email, `Через 3 дня спишем оплату за КонтентМетрику — тариф «${planName}»`, html);
}

// ─── 6. Оплата не прошла ─────────────────────────────────────────────────────

export async function sendPaymentFailed(user, { planName, amount }) {
  const html = buildHtml(`
    ${h2('Не удалось списать оплату')}
    ${p(`Здравствуйте, ${user.name}!`)}
    ${p(`При попытке списать <strong>${amount} ₽</strong> за тариф «${planName}» возникла ошибка. Скорее всего, проблема с платёжными данными.`)}
    ${p('Обновите данные карты, чтобы не потерять доступ к статистике. Это займёт меньше минуты.')}
    ${p('Если возникли трудности, пишите на <a href="mailto:support@cmetrika.com" style="color:#ff6a00;">support@cmetrika.com</a>')}
    ${btn('https://app.cmetrika.com/settings', 'Обновить платёжные данные →')}
  `);
  await send(user.email, `Не удалось списать оплату за КонтентМетрику — требуется действие`, html);
}

// ─── 6b. Оплата принята — новый пользователь (установить пароль) ─────────────

export async function sendPaymentNewUser(email, fullName, planName, resetUrl) {
  const html = buildHtml(`
    ${h2('Оплата принята — установите пароль')}
    ${p(`Здравствуйте, ${fullName}!`)}
    ${p(`Оплата прошла успешно. Тариф «${planName}» активен.`)}
    ${p('Осталось придумать пароль — и можно приступать к работе.')}
    ${btn(resetUrl, 'Установить пароль →')}
    ${p('Ссылка действительна 24 часа. Если возникли трудности, пишите на <a href="mailto:support@cmetrika.com" style="color:#ff6a00;">support@cmetrika.com</a>')}
  `);
  await send(email, 'Оплата КонтентМетрики принята — установите пароль для входа', html);
}

// ─── 7. Сброс пароля ─────────────────────────────────────────────────────────

export async function sendPasswordReset(user, resetUrl) {
  const html = buildHtml(`
    ${h2('Сброс пароля')}
    ${p(`Здравствуйте, ${user.name}!`)}
    ${p('Мы получили запрос на сброс пароля для вашего аккаунта. Нажмите кнопку ниже, чтобы установить новый пароль.')}
    ${p('Ссылка действительна в течение 1 часа. Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо — ничего не изменится.')}
    ${btn(resetUrl, 'Сбросить пароль →')}
  `);
  await send(user.email, 'Сброс пароля в КонтентМетрике', html);
}
