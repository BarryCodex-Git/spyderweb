import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { parseClientIntake } from '../lib/client-intake.ts';
import { clientIntakeDocx } from '../lib/client-intake-docx.ts';

const intake = parseClientIntake({
  clientName: 'Jamie Plumbing', industry: 'Plumbing', primaryRegion: 'Pretoria',
  phone: '012 555 0100', email: 'hello@example.test', primaryServices: ['Emergency plumbing', 'Leak detection'],
  additionalServices: ['Geyser installations'], additionalLocations: ['Centurion'], trustFacts: ['Licensed team'],
  clientFolderCreated: 'Yes', logoReady: 'Yes', aiImagesPermitted: 'Yes', stockImagesPermitted: 'Yes',
}, 'Jamie Plumbing');
const output = new URL('../tmp/client-intake-fixture.docx', import.meta.url);
const buffer = await clientIntakeDocx({ intake, domain: 'jamie.example.test', createdAt: '2026-09-06T12:00:00Z' });
assert.ok(buffer.byteLength > 10_000);
await writeFile(output, buffer);
console.log(`Client intake document generated: ${output.pathname}`);
