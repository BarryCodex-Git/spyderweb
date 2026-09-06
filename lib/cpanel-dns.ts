export type CpanelDnsRecord = {
  name: string;
  type: string;
  value: string;
  lineIndex: number;
};

export function parseCpanelDnsZone(data: unknown, hostname: string) {
  const target = hostname.toLowerCase().replace(/\.$/, '');
  const records: CpanelDnsRecord[] = [];
  let serial: number | null = null;
  const queue: unknown[] = [data];
  const seen = new Set<object>();

  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== 'object') continue;
    if (seen.has(value)) continue;
    seen.add(value);
    if (Array.isArray(value)) {
      queue.push(...value);
      continue;
    }

    const row = value as Record<string, unknown>;
    const serialValue = row.serial ?? row.serial_number ?? row.serialnum;
    const parsedSerial = Number(serialValue);
    if (serial === null && Number.isInteger(parsedSerial) && parsedSerial >= 0) serial = parsedSerial;

    const name = String(row.dname ?? row.name ?? row.domain ?? '').toLowerCase().replace(/\.$/, '');
    const type = String(row.record_type ?? row.type ?? '').toUpperCase();
    const parsedLine = Number(row.line_index ?? row.line ?? row.Line);
    if (name === target && type && Number.isInteger(parsedLine) && parsedLine >= 0) {
      const rawData = row.data ?? row.address ?? row.record ?? '';
      const recordValue = Array.isArray(rawData) ? rawData.map(String).join(' ') : String(rawData);
      records.push({ name, type, value: recordValue, lineIndex: parsedLine });
    }
    queue.push(...Object.values(row));
  }

  return {
    serial,
    records: records.filter(
      (record, index, all) => all.findIndex((candidate) => candidate.lineIndex === record.lineIndex) === index,
    ),
  };
}
