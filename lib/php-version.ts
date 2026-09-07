const packagePattern = /(?:ea|alt)-php\d{2,3}/gi;

export function phpPackageNumber(value: string | null | undefined) {
  if (!value) return null;
  const packageMatch = value.match(/(?:ea|alt)-php(\d{2,3})/i);
  if (packageMatch) {
    const digits = packageMatch[1];
    return Number(`${digits[0]}.${digits.slice(1)}`);
  }
  const semanticMatch = value.match(/(?:^|\D)(\d+)\.(\d+)(?:\D|$)/);
  return semanticMatch ? Number(`${semanticMatch[1]}.${semanticMatch[2]}`) : null;
}

export function phpPackageLabel(value: string | null | undefined) {
  const version = phpPackageNumber(value);
  return version === null ? null : `PHP ${version.toFixed(1)}`;
}

export function collectPhpPackages(value: unknown) {
  const packages = new Set<string>();
  const visit = (candidate: unknown) => {
    if (typeof candidate === 'string') {
      for (const match of candidate.match(packagePattern) ?? []) packages.add(match.toLowerCase());
      return;
    }
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (candidate && typeof candidate === 'object') {
      for (const [key, nested] of Object.entries(candidate as Record<string, unknown>)) {
        visit(key);
        visit(nested);
      }
    }
  };
  visit(value);
  return [...packages];
}

export function selectRecommendedPhpPackage(installed: string[], systemDefault: string | null) {
  const supported = [...new Set(installed.map((item) => item.toLowerCase()))]
    .filter((item) => {
      const version = phpPackageNumber(item);
      return version !== null && version >= 8.3 && version <= 8.4;
    });
  const normalizedDefault = systemDefault?.toLowerCase() ?? null;
  if (normalizedDefault && supported.includes(normalizedDefault)) return normalizedDefault;
  return supported.sort((left, right) => {
    const leftVersion = phpPackageNumber(left) ?? 0;
    const rightVersion = phpPackageNumber(right) ?? 0;
    // PHP 8.3 is the conservative WordPress recommendation. Use 8.4 only
    // when the host has made it the account default or 8.3 is unavailable.
    const leftRank = leftVersion === 8.3 ? 2 : 1;
    const rightRank = rightVersion === 8.3 ? 2 : 1;
    return rightRank - leftRank || rightVersion - leftVersion;
  })[0] ?? null;
}

export function currentPhpPackage(value: unknown, domain: string) {
  const normalizedDomain = domain.toLowerCase();
  const inspect = (candidate: unknown, matchedDomain = false): string | null => {
    if (!candidate || typeof candidate !== 'object') return null;
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const found = inspect(item, matchedDomain);
        if (found) return found;
      }
      return null;
    }
    const record = candidate as Record<string, unknown>;
    const recordDomain = String(record.vhost ?? record.domain ?? record.hostname ?? '').toLowerCase();
    if (recordDomain && recordDomain !== normalizedDomain) return null;
    const exactRecord = matchedDomain || recordDomain === normalizedDomain;
    if (exactRecord) {
      for (const key of ['version', 'phpversion', 'php_version', 'package']) {
        const raw = record[key];
        if (typeof raw === 'string') {
          const packageName = collectPhpPackages(raw)[0];
          if (packageName) return packageName;
        }
      }
    }
    for (const [key, nested] of Object.entries(record)) {
      const found = inspect(nested, exactRecord || key.toLowerCase() === normalizedDomain);
      if (found) return found;
    }
    return null;
  };
  return inspect(value);
}

const cpanelHandlerBlockPattern = /(?:\r?\n)?# php -- BEGIN cPanel-generated handler[^\r\n]*[\s\S]*?# php -- END cPanel-generated handler[^\r\n]*(?:\r?\n)?/gi;
const standalonePhpHandlerPattern = /^\s*AddHandler\s+application\/x-httpd-(?:ea|alt)-php\d{2,3}[^\r\n]*\r?\n?/gim;

export function ensureCpanelPhpHandler(content: string, phpPackage: string) {
  const normalizedPackage = phpPackage.toLowerCase();
  const previousPackages = collectPhpPackages(content);
  const alreadyManaged = previousPackages.includes(normalizedPackage)
    && !previousPackages.some((item) => item !== normalizedPackage);
  if (alreadyManaged) return { content, changed: false, previousPackages };

  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const base = content
    .replace(cpanelHandlerBlockPattern, newline)
    .replace(standalonePhpHandlerPattern, '')
    .trimEnd();
  const major = phpPackageNumber(normalizedPackage)?.toFixed(1).split('.')[0] ?? '8';
  const block = [
    '# php -- BEGIN cPanel-generated handler, do not edit',
    `# Set the “${normalizedPackage}” package as the default “PHP” programming language.`,
    '<IfModule mime_module>',
    `  AddHandler application/x-httpd-${normalizedPackage} .php .php${major} .phtml`,
    '</IfModule>',
    '# php -- END cPanel-generated handler, do not edit',
  ].join(newline);
  return {
    content: `${base ? `${base}${newline}${newline}` : ''}${block}${newline}`,
    changed: true,
    previousPackages,
  };
}
