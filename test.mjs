import assert from 'node:assert/strict';
import { parseAnchorLink } from './index.js';

const page = 'https://console.nimbalyst.com/app/page/00000000-0000-4000-8000-000000000000';
assert.deepEqual(parseAnchorLink(`${page}#type`), { pageId: '00000000-0000-4000-8000-000000000000', slug: 'type' });
assert.deepEqual(parseAnchorLink(`${page}#수신-방향-인사-연동`).slug, '수신-방향-인사-연동');
assert.deepEqual(parseAnchorLink(`${page}#%EC%88%98%EC%8B%A0`).slug, '수신');
assert.equal(parseAnchorLink(page), null); // no hash
assert.equal(parseAnchorLink(`${page}#`), null);
assert.equal(parseAnchorLink('#type'), null); // same-page links: the app handles these
assert.equal(parseAnchorLink('https://example.com/app/page/x#type'), null);
assert.equal(parseAnchorLink('https://console.nimbalyst.com/app/item/x#type'), null);
assert.equal(parseAnchorLink('https://console.nimbalyst.com/org/o/project/p/document/x#type'), null);
console.log('ok');
