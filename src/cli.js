#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { scanMergedPRs } from './scanner.js';
import { extractChanges } from './extractor.js';
import { generateDocs } from './generator.js';
import { createDocsPR } from './pr.js';

const { values } = parseArgs({
  options: {
    sources: { type: 'string' },
    'docs-repo': { type: 'string' },
    since: { type: 'string', default: '48h' },
    config: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
  },
  allowPositionals: true,
});

async function main() {
  const sources = values.sources?.split(',').map(s => s.trim()) ?? [];
  const docsRepo = values['docs-repo'];
  const since = values.since;
  const dryRun = values['dry-run'];

  if (!sources.length || !docsRepo) {
    console.error('Usage: cross-repo-docs sync --sources "org/repo1,org/repo2" --docs-repo "org/docs"');
    process.exit(1);
  }

  console.log(`Scanning ${sources.length} source repo(s) for merged PRs in the last ${since}...`);

  const prs = await scanMergedPRs(sources, since);
  console.log(`Found ${prs.length} merged PR(s) with documentation-worthy changes.`);

  if (!prs.length) {
    console.log('Nothing to document. Exiting.');
    return;
  }

  const changes = await extractChanges(prs);
  console.log(`Extracted ${changes.length} change(s) to document.`);

  const docs = await generateDocs(changes);
  console.log(`Generated documentation for ${docs.length} section(s).`);

  if (dryRun) {
    console.log('\n--- DRY RUN ---');
    docs.forEach(d => {
      console.log(`\n## ${d.section}\n${d.content.slice(0, 200)}...`);
    });
    return;
  }

  const prUrl = await createDocsPR(docsRepo, docs, prs);
  console.log(`\nDocumentation PR created: ${prUrl}`);
}

main().catch(err => { console.error(err); process.exit(1); });
