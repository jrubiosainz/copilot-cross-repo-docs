export async function extractChanges(prs) {
  const changes = [];

  for (const pr of prs) {
    const addedFiles = pr.files.filter(f => f.status === 'added');
    const modifiedFiles = pr.files.filter(f => f.status === 'modified' && f.additions > 5);

    const signatures = [];
    for (const file of [...addedFiles, ...modifiedFiles]) {
      if (file.patch) {
        const added = file.patch.split('\n')
          .filter(l => l.startsWith('+') && !l.startsWith('+++'))
          .map(l => l.slice(1));

        const exports = added.filter(l =>
          l.match(/^export\s/) || l.match(/^(async\s+)?function\s/) ||
          l.match(/^(pub\s+)?(fn|struct|enum)\s/) || l.match(/^(def|class)\s/) ||
          l.match(/^\s*["']?[A-Z_]+["']?\s*:/)
        );

        if (exports.length) {
          signatures.push({ file: file.filename, exports: exports.slice(0, 10) });
        }
      }
    }

    if (signatures.length || pr.body?.match(/breaking|new api|new endpoint|new flag/i)) {
      changes.push({
        repo: pr.repo, pr_number: pr.number, title: pr.title,
        url: pr.url, signatures, body: pr.body?.slice(0, 500) ?? '',
      });
    }
  }

  return changes;
}
