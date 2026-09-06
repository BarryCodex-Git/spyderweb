import assert from 'node:assert/strict';
import { parseCpanelDnsZone } from '../lib/cpanel-dns.ts';

const parsed = parseCpanelDnsZone({
  serial: 2026090601,
  parsed: [
    { dname: 'dev4.testwebsitebuild.com.', record_type: 'A', data: ['102.130.114.178'], line_index: 12 },
    { dname: 'dev4.testwebsitebuild.com.', record_type: 'TXT', data: ['verification'], line_index: 13 },
    { dname: 'dev5.testwebsitebuild.com.', record_type: 'A', data: ['102.130.114.178'], line_index: 14 },
  ],
}, 'dev4.testwebsitebuild.com');

assert.equal(parsed.serial, 2026090601);
assert.deepEqual(parsed.records, [
  { name: 'dev4.testwebsitebuild.com', type: 'A', value: '102.130.114.178', lineIndex: 12 },
  { name: 'dev4.testwebsitebuild.com', type: 'TXT', value: 'verification', lineIndex: 13 },
]);

console.log('cPanel DNS conflict parsing passed.');
