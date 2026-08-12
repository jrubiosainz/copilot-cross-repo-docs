import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

function parseDuration(since) {
  const match = since.match(/^(\d+)(h|d)$/);
  if (!match) return 48 * 60 * 60 * 1000;
  const [, num, unit] = match;
  const ms = unit === 'h' ? Number(num) * 3600000 : Number(num) * 86400000;
  return ms;
}

export async function scanMergedPRs(repos, since) {
  const cutoff = new Date(Date.now() - parseDuration(since));
  const results = [];

  for (const repo of repos) {
    const [owner, name] = repo.split('/');
    const { data: pulls } = await octokit.pulls.list({
      owner, repo: name, state: 'closed', sort: 'updated', direction: 'desc', per_page: 50,
    });

    for (const pr of pulls) {
      if (!pr.merged_at) continue;
      if (new Date(pr.merged_at) < cutoff) continue;

      const { data: files } = await octokit.pulls.listFiles({
        owner, repo: name, pull_number: pr.number,
      });

      const docWorthy = files.some(f =>
        f.filename.match(/\.(ts|js|py|go|rs|yaml|yml|json)$/) &&
        (f.additions > 5 || f.status === 'added')
      );

      if (docWorthy) {
        results.push({
          repo, number: pr.number, title: pr.title,
          body: pr.body, merged_at: pr.merged_at, files,
          url: pr.html_url,
        });
      }
    }
  }

  return results;
}
