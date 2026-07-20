import test from 'node:test';
import assert from 'node:assert/strict';

import { removeBBCodes, removeHtmlTags } from '@/lib/utils/text';

test('removeBBCodes strips tags and preserves content', () => {
  const input = '[b]Bold[/b]\\n[character=123 Hero]Lead[/character] [size=20]text[/size]';
  assert.equal(removeBBCodes(input), 'Bold\nLead text');
});

test('removeHtmlTags strips markup and decodes entities', () => {
  const input = '<p>Hello &quot;world&quot;</p><div>Line 2<br/>Line 3</div>';
  assert.equal(removeHtmlTags(input), 'Hello "world"\n\nLine 2\nLine 3');
});
