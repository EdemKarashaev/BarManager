
import { spawnSync } from 'node:child_process';
import { nextVersion } from './release-version.mjs';
import { randomUUID } from 'node:crypto';
import {
    mkdirSync,
    existsSync,
    unlinkSync,
    readFileSync,
    writeFileSync,
} from 'node:fs';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { setTimeout as delay } from 'node:timers/promises';

const CHANNEL = 'preview';
const ENVIRONMENT = 'preview';
const VERSION_PATH = 'src/config/release.json';
const PENDING_PATH = '.release-android/pending.json';

const NOTIFY_URL =
  'https://cdiunbffdbyzmmthehic.supabase.co/functions/v1/notify-update';

const secret = process.env.NOTIFY_SECRET;

// Не передаём секрет дочерним процессам.
const childEnv = { ...process.env };
delete childEnv.NOTIFY_SECRET;
delete childEnv.UPDATE_NOTIFY_SECRET;

const args = process.argv.slice(2);

const emailArg = args.find(
  arg => arg.startsWith('--email=')
);

const email = emailArg
  ?.slice('--email='.length)
  .trim();

const resumeArg = args.find(
  arg => arg.startsWith('--resume=')
);

const resume = resumeArg?.slice('--resume='.length);

const dryRunOnly = args.includes('--dry-run');
const both = args.includes('--both');

const versionFlags = args.filter(
  arg => ['--patch', '--minor', '--major'].includes(arg)
);

const releaseType = versionFlags[0]?.slice(2) ?? 'patch';

const recipients = [
  { email: 'just_2_feel@mail.ru' },
  {
    email: 'pt@ketch-up.ru',
    allow_legacy_device: true,
  },
];

const message = args
  .filter(arg => !arg.startsWith('--'))
  .join(' ')
  .trim();

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const rl = createInterface({
  input: stdin,
  output: stdout,
});

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    stdio: 'inherit',
    shell: false,
    env: childEnv,
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      `Команда завершилась ошибкой: ${command}`
    );
  }
}

class NotifyError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'NotifyError';
    this.retryable = options.retryable ?? false;
    this.ambiguous = options.ambiguous ?? false;
    this.result = options.result ?? null;
  }
}

async function notifyOnce(payload) {
  let response;

  try {
    response = await fetch(NOTIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-update-secret': secret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000),
    });
  } catch (error) {
    const reason =
      error.cause?.code ??
      error.cause?.message ??
      error.message;

    throw new NotifyError(
      `Сетевая ошибка: ${reason}`,
      {
        retryable: true,
        ambiguous: true,
      }
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new NotifyError(
      `Некорректный ответ сервера: HTTP ${response.status}`,
      {
        retryable: response.status >= 500 ||
          response.ok,
        ambiguous: response.status >= 500 ||
          response.ok,
      }
    );
  }

  if (!response.ok || !result?.success) {
    throw new NotifyError(
      result?.error ??
        `Ошибка рассылки: HTTP ${response.status}`,
      {
        retryable:
          response.status === 429 ||
          response.status >= 500,
        ambiguous: response.status >= 500,
        result,
      }
    );
  }

  return result;
}

// Повторяем только безопасные запросы dry_run.
async function notify(payload) {
  const attempts = payload.dry_run === true ? 3 : 1;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await notifyOnce(payload);
    } catch (error) {
      if (!error.retryable || attempt === attempts) {
        throw error;
      }

      console.warn(
        `Сетевая ошибка. Повтор ${attempt + 1}/${attempts}...`
      );

      await delay(attempt * 2000);
    }
  }
}

function validateRelease(release) {
  if (
    !release ||
    !uuidPattern.test(release.update_id ?? '') ||
    typeof release.runtime_version !== 'string' ||
    !release.runtime_version ||
    release.runtime_version.length > 128 ||
    release.channel !== CHANNEL ||
    release.platform !== 'android'
  ) {
    throw new Error(
      'Некорректные данные Android-релиза'
    );
  }

  return release;
}

function printPreview(preview) {
  console.table({
    'Совместимые устройства':
      preview.compatible_devices,
    'Требуют уведомления':
      preview.eligible,
    'Уже обновлены':
      preview.skipped_installed,
    'Исключено дублей':
      preview.skipped_duplicate,
  });
}

function printSent(sent) {
  console.table({
    'Принято Expo': sent.accepted,
    'Ошибки': sent.failed,
    'Неизвестный статус': sent.unknown,
    'Исключено дублей': sent.skipped_duplicate,
    'Уже обновлены': sent.skipped_installed,
  });
}

function printResume(releasePath) {
  console.log(
    '\nПродолжение без повторной публикации:'
  );

  console.log(
    `npm run release:android -- --resume="${releasePath}"` +
    (both ? ' --both' : email ? ` --email="${email}"` : '')
  );
}

async function main() {
  console.log('\n====================================');
  console.log(' BAR MANAGER — ANDROID RELEASE');
  console.log('====================================\n');

  if (!secret) {
    throw new Error(
      'Не задана переменная NOTIFY_SECRET'
    );
  }

  if (!message && !resume) {
    throw new Error('Укажи описание обновления');
  }

  if (emailArg && !email) {
    throw new Error('Не указан email получателя');
  }

  if (resumeArg && !resume) {
    throw new Error('Не указан файл релиза');
  }

  if (dryRunOnly && !resume) {
    throw new Error(
      '--dry-run используется вместе с --resume'
    );
  }

  if (both && emailArg) {
    throw new Error('--both и --email нельзя совмещать');
  }

  if (versionFlags.length > 1) {
    throw new Error('Укажи только один тип повышения версии');
  }

  if (resume && versionFlags.length) {
    throw new Error('При --resume версия не повышается');
  }

  if (!resume && existsSync(PENDING_PATH)) {
    throw new Error(
      'Есть незавершённая публикация. Проверь EAS Dashboard и ' +
      PENDING_PATH + '. Повторная публикация заблокирована.'
    );
  }

  const target = email ? { email } : {};

  let release;
  let releasePath;

  if (resume) {
    releasePath = resume;

    release = validateRelease(
      JSON.parse(readFileSync(resume, 'utf8'))
    );

    console.log(
      'Используем существующий Android-релиз'
    );
  }

  console.log('Проверка доступа к серверу...');

  // Проверка авторизации без рассылки.
  // Не зависит от предыдущих OTA и runtime.
  await notify({
    mode: 'release',
    dry_run: true,
    runtime_version: 'preflight',
    channel: CHANNEL,
    update_id: randomUUID(),
    ...target,
  });

  console.log('Доступ к серверу подтверждён');

  if (!resume) {
    const currentRelease = JSON.parse(
      readFileSync(VERSION_PATH, 'utf8')
    );

    const newRelease = {
      version: nextVersion(currentRelease.version, releaseType),
      releasedAt: new Date().toISOString(),
      changelog: message,
    };

    console.log(
      'Версия Bar Manager:',
      currentRelease.version, '→', newRelease.version
    );

    console.log('Описание:', message);
    console.log('Тип релиза:', releaseType);

    console.log('\n[1/5] Проверка TypeScript');

    run('npm', ['run', 'typecheck']);

    console.log('\n[2/5] Автоматические тесты');

    run('npm', ['test']);

    console.log('\n[3/5] Публикация Android OTA');

    console.log(
      'OTA станет доступно всем совместимым устройствам preview.'
    );

    const confirmation = await rl.question(
      'Опубликовать OTA? [y/N]: '
    );

    if (confirmation.trim().toLowerCase() !== 'y') {
      console.log('Публикация отменена');
      return;
    }

    mkdirSync('.release-android', {
      recursive: true,
    });

    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-');

    const rawPath =
      `.release-android/${stamp}-eas.json`;

    const releaseMessage =
      `Bar Manager ${newRelease.version}: ${message}`;

    writeFileSync(
      PENDING_PATH,
      JSON.stringify({
        previous: currentRelease,
        next: newRelease,
        channel: CHANNEL,
        rawPath,
        releaseMessage,
        startedAt: new Date().toISOString(),
      }, null, 2),
      { flag: 'wx' }
    );

    writeFileSync(
      VERSION_PATH,
      JSON.stringify(newRelease, null, 2) + '\n'
    );

    console.log('Публикуем версию:', newRelease.version);

    const result = spawnSync(
      'npx',
      [
        'eas-cli',
        'update',
        '--channel', CHANNEL,
        '--platform', 'android',
        '--environment', ENVIRONMENT,
        '--message', releaseMessage,
        '--json',
        '--non-interactive',
      ],
      {
        encoding: 'utf8',
        stdio: ['inherit', 'pipe', 'inherit'],
        maxBuffer: 20 * 1024 * 1024,
        env: childEnv,
      }
    );

    writeFileSync(rawPath, result.stdout ?? '');

    if (result.error || result.status !== 0) {
      throw new Error(
        `Ошибка EAS. Проверь Expo Dashboard перед повторной публикацией. Вывод: ${rawPath}`
      );
    }

    let published;

    try {
      published = JSON.parse(result.stdout);
    } catch {
      throw new Error(
        `Не удалось разобрать ответ EAS: ${rawPath}. Не публикуй OTA повторно.`
      );
    }

    const updates = Array.isArray(published)
      ? published
      : published?.updates;

    if (!Array.isArray(updates)) {
      throw new Error(
        `Неизвестный формат ответа EAS: ${rawPath}`
      );
    }

    const androidUpdates = updates.filter(
      update => update.platform === 'android'
    );

    if (androidUpdates.length !== 1) {
      throw new Error(
        `Не удалось определить Android OTA: ${rawPath}`
      );
    }

    const android = androidUpdates[0];

    release = validateRelease({
      update_id: android.id,
      runtime_version: android.runtimeVersion,
      channel: CHANNEL,
      platform: 'android',
      group_id:
        android.group ??
        android.groupId ??
        null,
      message,
      app_release_version: newRelease.version,
      changelog: newRelease.changelog,
      released_at: newRelease.releasedAt,
      published_at: new Date().toISOString(),
    });

    releasePath =
      `.release-android/${release.update_id}.json`;

    writeFileSync(
      releasePath,
      JSON.stringify(release, null, 2)
    );

    unlinkSync(PENDING_PATH);

    console.log('\nOTA успешно опубликовано');
    console.log('Версия Bar Manager:', newRelease.version);
  }

  console.log('Update ID:', release.update_id);
  console.log('Runtime:', release.runtime_version);
  console.log('Channel:', release.channel);
  console.log('Файл релиза:', releasePath);

  printResume(releasePath);

  if (both) {
    const targets = [];

    for (const recipient of recipients) {
      const payload = {
        mode: 'release',
        update_id: release.update_id,
        runtime_version: release.runtime_version,
        channel: release.channel,
        ...recipient,
      };

      console.log('Получатель:', recipient.email);

      const preview = await notify({
        ...payload,
        dry_run: true,
      });

      printPreview(preview);
      targets.push({ payload, preview });
    }

    const total = targets.reduce(
      (sum, item) => sum + item.preview.eligible, 0
    );

    console.log('Всего устройств:', total);

    if (dryRunOnly || total === 0) return;

    const answer = await rl.question(
      'Отправить push обоим аккаунтам? [y/N]: '
    );

    if (answer.trim().toLowerCase() !== 'y') return;

    for (const { payload, preview } of targets) {
      if (!preview.eligible) continue;

      console.log('Отправка:', payload.email);

      try {
        const sent = await notify({
          ...payload,
          dry_run: false,
          confirm_broadcast: false,
        });

        printSent(sent);
      } catch (error) {
        console.error(payload.email, error.message);
        if (error.result) console.log(error.result);
        process.exitCode = 2;
      }
    }

    printResume(releasePath);
    return;
  }

  const payload = {
    mode: 'release',
    update_id: release.update_id,
    runtime_version: release.runtime_version,
    channel: release.channel,
    ...target,
  };

  console.log('\n[4/5] Проверка получателей');

  const preview = await notify({
    ...payload,
    dry_run: true,
  });

  printPreview(preview);

  if (dryRunOnly) {
    console.log(
      'Проверка завершена. Уведомления не отправлялись.'
    );
    return;
  }

  if (preview.eligible === 0) {
    console.log(
      'Нет устройств для новой рассылки'
    );
    return;
  }

  console.log('\n[5/5] Отправка уведомлений');

  console.log(
    'Получатели:',
    email ?? 'Все совместимые устройства'
  );

  const answer = await rl.question(
    `Отправить уведомления на ${preview.eligible} устройств? [y/N]: `
  );

  if (answer.trim().toLowerCase() !== 'y') {
    console.log(
      'Рассылка отменена. OTA остаётся опубликованным.'
    );
    return;
  }

  try {
    const sent = await notify({
      ...payload,
      dry_run: false,
      confirm_broadcast: !email,
    });

    printSent(sent);

    console.log('\n====================================');
    console.log(' РЕЛИЗ УСПЕШНО ЗАВЕРШЁН');
    console.log('====================================\n');

  } catch (error) {
    console.warn('\nОшибка:', error.message);

    if (error.result) {
      console.log(error.result);
    }

    if (!error.ambiguous) {
      throw error;
    }

    console.warn(
      'Сервер мог обработать рассылку до обрыва соединения.'
    );

    console.warn(
      'Автоматически повторять отправку не будем.'
    );

    await delay(3000);

    try {
      const after = await notify({
        ...payload,
        dry_run: true,
      });

      console.log(
        '\nСостояние получателей после сетевого сбоя:'
      );

      printPreview(after);

      if (after.eligible === 0) {
        console.log(
          'Новых получателей для рассылки нет.'
        );
      } else {
        console.warn(
          'Остались устройства без зарегистрированной попытки отправки.'
        );
      }

    } catch (checkError) {
      console.warn(
        'Не удалось проверить состояние:',
        checkError.message
      );
    }

    console.warn(
      '\nOTA опубликовано. Итог рассылки требует проверки истории Supabase.'
    );

    console.log(
      'Update ID для проверки:',
      release.update_id
    );

    printResume(releasePath);

    process.exitCode = 2;
  }
}

try {
  await main();
} catch (error) {
  console.error('\nОшибка:', error.message);
  process.exitCode = 1;
} finally {
  rl.close();
}
