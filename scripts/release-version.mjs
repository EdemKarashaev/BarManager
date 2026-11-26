export function nextVersion(current, type = 'patch') {
  if (!/^\d+\.\d+\.\d+$/.test(current)) {
    throw new Error(`Некорректная версия: ${current}`);
  }

  let [major, minor, patch] = current.split('.').map(Number);

  switch (type) {
    case 'major':
      major++;
      minor = 0;
      patch = 0;
      break;

    case 'minor':
      minor++;
      patch = 0;
      break;

    case 'patch':
      patch++;
      break;

    default:
      throw new Error(`Неизвестный тип релиза: ${type}`);
  }

  return `${major}.${minor}.${patch}`;
}
