export const wordpressMemoryMinimums = {
  WP_MEMORY_LIMIT: 512 * 1024 * 1024,
  WP_MAX_MEMORY_LIMIT: 768 * 1024 * 1024,
} as const;

export type WordPressMemoryConstant = keyof typeof wordpressMemoryMinimums;

function parseMemoryBytes(value: string) {
  const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*([KMGT]?)B?$/i);
  if (!match) return null;
  const exponent = ['', 'K', 'M', 'G', 'T'].indexOf(match[2].toUpperCase());
  const bytes = Number(match[1]) * (1024 ** exponent);
  return Number.isFinite(bytes) && bytes > 0 ? bytes : null;
}

function formatMemory(bytes: number) {
  for (const [suffix, divisor] of [['G', 1024 ** 3], ['M', 1024 ** 2], ['K', 1024]] as const) {
    if (bytes >= divisor && bytes % divisor === 0) return `${bytes / divisor}${suffix}`;
  }
  return String(bytes);
}

function constantPattern(name: WordPressMemoryConstant) {
  return new RegExp(
    `^(\\s*)define\\s*\\(\\s*(['"])${name}\\2\\s*,\\s*(['"])([^'"]+)\\3\\s*\\)\\s*;(\\s*(?://.*|#.*)?)$`,
    'gmi',
  );
}

export function inspectWordPressMemory(content: string) {
  const values = {} as Record<WordPressMemoryConstant, string | null>;
  const sufficient = {} as Record<WordPressMemoryConstant, boolean>;
  for (const name of Object.keys(wordpressMemoryMinimums) as WordPressMemoryConstant[]) {
    const matches = [...content.matchAll(constantPattern(name))];
    if (!matches.length) {
      values[name] = null;
      sufficient[name] = false;
      continue;
    }
    const parsed = matches.map((match) => parseMemoryBytes(match[4]));
    if (parsed.some((value) => value === null)) {
      throw new Error(`${name} uses an unsupported value in wp-config.php. SpyderWeb left the file unchanged for manual inspection.`);
    }
    const highest = Math.max(...parsed as number[]);
    values[name] = formatMemory(highest);
    sufficient[name] = parsed.every((value) => value! >= wordpressMemoryMinimums[name]);
  }
  return { values, sufficient };
}

function insertBeforeWordPressBootstrap(content: string, lines: string[]) {
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const insertion = `${lines.join(newline)}${newline}${newline}`;
  const marker = /^(\s*\/\*\s*That's all, stop editing![^\r\n]*\*\/|\s*require_once\s+ABSPATH\s*\.\s*['"]wp-settings\.php['"]\s*;)/mi;
  const match = marker.exec(content);
  if (match?.index !== undefined) return `${content.slice(0, match.index)}${insertion}${content.slice(match.index)}`;
  return `${content.replace(/\s*$/, '')}${newline}${newline}${insertion}`;
}

export function ensureWordPressMemoryConstants(content: string) {
  if (!content.includes('<?php') || content.includes('\0')) {
    throw new Error('wp-config.php is not a readable PHP configuration file. SpyderWeb left it unchanged.');
  }

  let updated = content;
  const changed: WordPressMemoryConstant[] = [];
  const missing: string[] = [];
  for (const name of Object.keys(wordpressMemoryMinimums) as WordPressMemoryConstant[]) {
    const pattern = constantPattern(name);
    const matches = [...updated.matchAll(pattern)];
    if (!matches.length) {
      missing.push(`define( '${name}', '${formatMemory(wordpressMemoryMinimums[name])}' );`);
      changed.push(name);
      continue;
    }
    const parsed = matches.map((match) => parseMemoryBytes(match[4]));
    if (parsed.some((value) => value === null)) {
      throw new Error(`${name} uses an unsupported value in wp-config.php. SpyderWeb left the file unchanged for manual inspection.`);
    }
    const desired = Math.max(wordpressMemoryMinimums[name], ...(parsed as number[]));
    if (parsed.every((value) => value === desired)) continue;
    const formatted = formatMemory(desired);
    updated = updated.replace(pattern, (_full, indent: string, _nameQuote: string, _valueQuote: string, _value: string, suffix: string) =>
      `${indent}define( '${name}', '${formatted}' );${suffix}`,
    );
    changed.push(name);
  }
  if (missing.length) updated = insertBeforeWordPressBootstrap(updated, missing);

  const verified = inspectWordPressMemory(updated);
  const unverified = (Object.keys(wordpressMemoryMinimums) as WordPressMemoryConstant[])
    .filter((name) => !verified.sufficient[name]);
  if (unverified.length) throw new Error(`WordPress memory settings did not verify: ${unverified.join(', ')}.`);
  return { content: updated, changed, values: verified.values };
}

export function ensureWordPressSiteUrlConstants(content: string, siteUrl: string) {
  if (!content.includes('<?php') || content.includes('\0')) {
    throw new Error('wp-config.php is not a readable PHP configuration file. SpyderWeb left the file unchanged.');
  }
  const parsed = new URL(siteUrl);
  if (parsed.protocol !== 'https:' || !parsed.hostname) throw new Error('SpyderWeb requires a valid HTTPS WordPress site address.');
  const normalized = `${parsed.protocol}//${parsed.hostname}`;
  let updated = content;
  const changed: Array<'WP_HOME' | 'WP_SITEURL'> = [];
  const missing: string[] = [];
  for (const name of ['WP_HOME', 'WP_SITEURL'] as const) {
    const pattern = new RegExp(`^(\\s*)define\\s*\\(\\s*(['"])${name}\\2\\s*,\\s*(['"])([^'"]*)\\3\\s*\\)\\s*;(\\s*(?://.*|#.*)?)$`, 'gmi');
    const matches = [...updated.matchAll(pattern)];
    if (!matches.length) {
      missing.push(`define( '${name}', '${normalized}' );`);
      changed.push(name);
      continue;
    }
    if (matches.every((match) => match[4].replace(/\/$/, '') === normalized)) continue;
    updated = updated.replace(pattern, (_full, indent: string, _nameQuote: string, _valueQuote: string, _value: string, suffix: string) =>
      `${indent}define( '${name}', '${normalized}' );${suffix}`,
    );
    changed.push(name);
  }
  if (missing.length) updated = insertBeforeWordPressBootstrap(updated, missing);
  return { content: updated, changed, siteUrl: normalized };
}
