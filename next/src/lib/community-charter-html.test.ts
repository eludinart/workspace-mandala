import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  charterBlocksToHtml,
  parseCharterToHtml,
  serializeCharterHtml,
  charterHtmlRequiresAcceptance,
} from './community-charter'

describe('charter html', () => {
  it('converts legacy blocks to html', () => {
    const html = charterBlocksToHtml([
      { id: '1', type: 'heading', level: 1, text: '**Association Terre d’Éveil**' },
      { id: '2', type: 'paragraph', text: 'Intro' },
      { id: '3', type: 'list', items: ['A', 'B'] },
    ])
    assert.match(html, /<h1>Association Terre d’Éveil<\/h1>/)
    assert.match(html, /<p>Intro<\/p>/)
    assert.match(html, /<li>A<\/li>/)
  })

  it('parses html document format', () => {
    const stored = serializeCharterHtml('<p>Hello <strong>world</strong></p>')
    assert.ok(stored.includes('"format":"html"'))
    const html = parseCharterToHtml(stored)
    assert.match(html, /<strong>world<\/strong>/)
    assert.equal(charterHtmlRequiresAcceptance(html), true)
  })

  it('parses legacy JSON array string', () => {
    const raw = JSON.stringify([{ id: '1', type: 'paragraph', text: 'Legacy' }])
    const html = parseCharterToHtml(raw)
    assert.match(html, /<p>Legacy<\/p>/)
  })

  it('strips scripts on sanitize', () => {
    const html = parseCharterToHtml('<p>ok</p><script>alert(1)</script>')
    assert.equal(html.includes('script'), false)
    assert.match(html, /<p>ok<\/p>/)
  })
})
