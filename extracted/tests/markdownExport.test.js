/**
 * Unit tests for Markdown export/import core module
 */

const MarkdownExportCore = require('../core/markdownExportCore');

describe('MarkdownExportCore', () => {
  test('documentToMarkdown includes title and body', () => {
    const md = MarkdownExportCore.documentToMarkdown({
      title: 'My Note',
      content: 'Hello world',
      folder: 'Ideas',
      url: 'https://example.com',
      createdAt: 0
    });
    expect(md).toContain('# My Note');
    expect(md).toContain('Hello world');
    expect(md).toContain('Category:** Ideas');
    expect(md).toContain('URL:** https://example.com');
  });

  test('documentToMarkdown fences body and avoids fence collision', () => {
    const body = 'text with ``` triple backticks inside';
    const md = MarkdownExportCore.documentToMarkdown({ title: 'x', content: body });
    expect(md).toContain('````');
    expect(md).toContain(body);
  });

  test('collectionToMarkdown joins documents with separator', () => {
    const md = MarkdownExportCore.collectionToMarkdown(
      [{ title: 'A', content: 'one' }, { title: 'B', content: 'two' }],
      { title: 'Export', separator: '\n\n===\n\n' }
    );
    expect(md).toContain('# Export');
    expect(md).toContain('# A');
    expect(md).toContain('# B');
    expect(md).toContain('===');
  });

  test('parseMarkdown extracts title and content', () => {
    const md = [
      '# Title Here',
      '',
      '> **Category:** Ideas',
      '',
      '```',
      'body text',
      '```'
    ].join('\n');
    const parsed = MarkdownExportCore.parseMarkdown(md);
    expect(parsed.title).toBe('Title Here');
    expect(parsed.content).toContain('body text');
    expect(parsed.content).not.toContain('Category');
  });

  test('parseMarkdown handles missing title', () => {
    const parsed = MarkdownExportCore.parseMarkdown('just some text\nwithout heading');
    expect(parsed.title).toBe('');
    expect(parsed.content).toContain('just some text');
  });

  test('formatDate returns empty string for invalid input', () => {
    expect(MarkdownExportCore.formatDate(null)).toBe('');
    expect(MarkdownExportCore.formatDate('not-a-date')).toBe('not-a-date');
  });

  test('round-trip preserves body content', () => {
    const doc = { title: 'RT', content: 'line1\nline2\n```\ncode\n```' };
    const md = MarkdownExportCore.documentToMarkdown(doc);
    const parsed = MarkdownExportCore.parseMarkdown(md);
    expect(parsed.title).toBe('RT');
    expect(parsed.content).toContain('line1');
    expect(parsed.content).toContain('code');
  });

  test('collectionFromMarkdown splits exported collection back', () => {
    const docs = [
      { title: 'One', content: 'first body' },
      { title: 'Two', content: 'second body' }
    ];
    const md = MarkdownExportCore.collectionToMarkdown(docs, { title: 'My Export' });
    const parsed = MarkdownExportCore.collectionFromMarkdown(md, { collectionTitle: 'My Export' });
    expect(parsed.length).toBe(2);
    expect(parsed[0].title).toBe('One');
    expect(parsed[0].content).toContain('first body');
    expect(parsed[1].title).toBe('Two');
    expect(parsed[1].content).toContain('second body');
  });

  test('collectionFromMarkdown ignores collection header', () => {
    const md = '# Library\n\n---\n\n# Note A\n\nbody a';
    const parsed = MarkdownExportCore.collectionFromMarkdown(md, { collectionTitle: 'Library' });
    expect(parsed.length).toBe(1);
    expect(parsed[0].title).toBe('Note A');
  });
});
