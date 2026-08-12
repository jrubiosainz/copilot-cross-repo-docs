export async function generateDocs(changes) {
  const token = process.env.GITHUB_TOKEN;
  const sections = [];

  for (const change of changes) {
    const prompt = buildPrompt(change);

    const response = await fetch('https://api.github.com/copilot/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: 'You are a technical writer. Generate concise API documentation in Markdown from code changes. Include parameters, return types, and brief examples.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      console.warn(`Doc generation failed for ${change.repo}#${change.pr_number}: ${response.status}`);
      continue;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';

    if (content) {
      sections.push({
        section: `${change.repo}#${change.pr_number} — ${change.title}`,
        content,
        source_pr: change.url,
      });
    }
  }

  return sections;
}

function buildPrompt(change) {
  let prompt = `Document the following changes from PR "${change.title}" in ${change.repo}:\n\n`;

  if (change.body) {
    prompt += `PR description:\n${change.body}\n\n`;
  }

  for (const sig of change.signatures) {
    prompt += `File: ${sig.file}\nNew/modified exports:\n${sig.exports.join('\n')}\n\n`;
  }

  prompt += 'Generate Markdown documentation for these changes. Include usage examples where appropriate.';
  return prompt;
}
