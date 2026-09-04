import assert from 'node:assert/strict';
import { ensureWordPressMemoryConstants, inspectWordPressMemory } from '../lib/wordpress-memory.ts';

const marker = "/* That's all, stop editing! Happy publishing. */";

const absent = ensureWordPressMemoryConstants(`<?php\n${marker}\n`);
assert.equal(absent.values.WP_MEMORY_LIMIT, '512M');
assert.equal(absent.values.WP_MAX_MEMORY_LIMIT, '768M');
assert.ok(absent.content.indexOf('WP_MAX_MEMORY_LIMIT') < absent.content.indexOf(marker));

const low = ensureWordPressMemoryConstants(`<?php
define( 'WP_MEMORY_LIMIT', '40M' );
define( 'WP_MAX_MEMORY_LIMIT', '256M' );
${marker}`);
assert.equal(low.values.WP_MEMORY_LIMIT, '512M');
assert.equal(low.values.WP_MAX_MEMORY_LIMIT, '768M');

const highSource = `<?php
define( 'WP_MEMORY_LIMIT', '768M' );
define( 'WP_MAX_MEMORY_LIMIT', '1G' );
${marker}`;
const high = ensureWordPressMemoryConstants(highSource);
assert.equal(high.content, highSource);
assert.deepEqual(high.changed, []);
assert.equal(inspectWordPressMemory(high.content).sufficient.WP_MEMORY_LIMIT, true);

assert.throws(
  () => ensureWordPressMemoryConstants(`<?php\ndefine( 'WP_MEMORY_LIMIT', 'dynamic' );\n${marker}`),
  /unsupported/,
);

console.log('WordPress memory transform: 4 scenarios passed');
