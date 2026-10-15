/**
 * Build the GitHub Pages site: a landing page, the docs (docs/*.md) and the generated example.
 *
 * Usage: node scripts/build-pages.js [outputDir]   (default: tmp/site)
 */
const fs = require('fs-extra');
const path = require('path');
const { execFileSync } = require('child_process');
const MarkdownIt = require('markdown-it');
const Prism = require('prismjs');
const loadLanguages = require('prismjs/components/');

loadLanguages(['bash', 'json', 'javascript', 'diff']);

const repoRoot = path.join(__dirname, '..');
const docsSourceDir = path.join(repoRoot, 'docs');
const repositoryUrl = 'https://github.com/tyba-co/apidoc';
const pageFiles = ['index.md', 'structure.md', 'tags.md', 'configuration.md', 'tooling.md'];

const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * GitHub-style heading slug, so links written for GitHub keep working.
 *
 * @param {String} text
 * @returns {String}
 */
const slugify = text => text.toLowerCase().replace(/[^\w\- ]+/g, '').replace(/ /g, '-');

/**
 * @param {String} markdown
 * @returns {{html: String, title: String, headings: {level: Number, text: String, id: String}[]}}
 */
function renderMarkdown (markdown) {
  const markdownIt = new MarkdownIt({
    highlight: (code, language) => {
      const grammar = Prism.languages[language === 'js' ? 'javascript' : language];
      const highlighted = (grammar ? Prism.highlight(code, grammar, language) : escapeHtml(code))
        .replace(/@api\w*/g, '<span class="apidoc-tag">$&</span>');
      return `<pre class="language-${escapeHtml(language || 'text')}"><code>${highlighted}</code></pre>`;
    },
  });

  const headings = [];
  const usedIds = new Set();
  markdownIt.core.ruler.push('collect_headings', state => {
    state.tokens.forEach((token, index) => {
      if (token.type !== 'heading_open') { return; }
      const text = state.tokens[index + 1].children.map(child => child.content).join('');
      let id = slugify(text);
      while (usedIds.has(id)) { id += '-1'; }
      usedIds.add(id);
      token.attrSet('id', id);
      headings.push({ level: Number(token.tag.slice(1)), text, id });
    });
  });

  const defaultLinkOpen = markdownIt.renderer.rules.link_open || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));
  markdownIt.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const href = tokens[index].attrGet('href');
    const markdownLink = href && href.match(/^([\w-]+)\.md(#.*)?$/);
    if (markdownLink) { tokens[index].attrSet('href', `${markdownLink[1]}.html${markdownLink[2] || ''}`); }
    return defaultLinkOpen(tokens, index, options, env, self);
  };

  const html = markdownIt.render(markdown);
  const title = headings.find(heading => heading.level === 1);
  return { html, title: title ? title.text : '', headings };
}

/**
 * @param {Object[]} pages rendered pages in navigation order
 * @param {Object} current page being written
 * @returns {String}
 */
function renderSidebar (pages, current) {
  const items = pages.map(page => {
    const isCurrent = page === current;
    const sections = isCurrent
      ? `<ul class="docs-sections">${page.headings.filter(heading => heading.level >= 2 && heading.level <= 3).map(heading => `<li class="level-${heading.level}"><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`).join('')}</ul>`
      : '';
    return `<li><a class="docs-page${isCurrent ? ' active' : ''}" href="${page.output}">${escapeHtml(page.title)}</a>${sections}</li>`;
  });
  return `<ul class="list-unstyled">${items.join('')}</ul>`;
}

/**
 * @param {Object[]} pages
 * @param {Object} current
 * @returns {String}
 */
function renderPage (pages, current) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(current.title)} · apidoc</title>
  <link rel="stylesheet" href="assets/bootstrap.min.css">
  <link rel="stylesheet" href="assets/prism.css">
  <link rel="stylesheet" href="assets/docs.css">
</head>
<body>
  <nav class="navbar navbar-dark bg-dark">
    <div class="container-fluid">
      <a class="navbar-brand" href="../">@tyba-co/apidoc</a>
      <div class="d-flex gap-3">
        <a class="nav-link text-white" href="../example/">Example</a>
        <a class="nav-link text-white" href="${repositoryUrl}">GitHub</a>
        <button class="navbar-toggler d-lg-none" type="button" data-bs-toggle="collapse" data-bs-target="#docs-nav" aria-controls="docs-nav" aria-expanded="false" aria-label="Toggle navigation"><span class="navbar-toggler-icon"></span></button>
      </div>
    </div>
  </nav>
  <div class="container-fluid">
    <div class="row">
      <nav id="docs-nav" class="col-lg-3 col-xl-2 docs-sidebar collapse d-lg-block" aria-label="Documentation">
        ${renderSidebar(pages, current)}
      </nav>
      <main class="col-lg-9 col-xl-8 docs-content">
        ${current.html}
      </main>
    </div>
  </div>
  <script src="assets/bootstrap.bundle.min.js"></script>
</body>
</html>
`;
}

/**
 * @param {String} outputDir directory that receives the docs pages and their assets
 * @returns {String[]} names of the written pages
 */
function buildDocs (outputDir) {
  const pages = pageFiles.map(file => {
    const rendered = renderMarkdown(fs.readFileSync(path.join(docsSourceDir, file), 'utf8'));
    return Object.assign(rendered, { output: file.replace(/\.md$/, '.html') });
  });

  const assetsDir = path.join(outputDir, 'assets');
  fs.ensureDirSync(assetsDir);
  fs.copySync(require.resolve('bootstrap/dist/css/bootstrap.min.css'), path.join(assetsDir, 'bootstrap.min.css'));
  fs.copySync(require.resolve('bootstrap/dist/js/bootstrap.bundle.min.js'), path.join(assetsDir, 'bootstrap.bundle.min.js'));
  fs.copySync(path.join(path.dirname(require.resolve('prismjs')), 'themes', 'prism-tomorrow.css'), path.join(assetsDir, 'prism.css'));
  fs.copySync(path.join(__dirname, 'pages.css'), path.join(assetsDir, 'docs.css'));

  pages.forEach(page => fs.writeFileSync(path.join(outputDir, page.output), renderPage(pages, page)));
  return pages.map(page => page.output);
}

/**
 * @param {String} outputDir
 */
function buildLanding (outputDir) {
  const landing = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>@tyba-co/apidoc</title>
  <link rel="stylesheet" href="docs/assets/bootstrap.min.css">
  <link rel="stylesheet" href="docs/assets/docs.css">
</head>
<body>
  <main class="container landing">
    <h1>@tyba-co/apidoc</h1>
    <p class="lead">Generate a static REST API documentation site from inline <code>@api</code> comments. Tyba's fork of apidoc.</p>
    <div class="row g-4">
      <div class="col-md-6">
        <a class="card h-100 text-decoration-none" href="docs/">
          <div class="card-body">
            <h2 class="h4">Documentation</h2>
            <p class="mb-0">What every tag means, how to structure your docs, configuration and the CLI.</p>
          </div>
        </a>
      </div>
      <div class="col-md-6">
        <a class="card h-100 text-decoration-none" href="example/">
          <div class="card-body">
            <h2 class="h4">Example</h2>
            <p class="mb-0">A live site generated from <code>example/</code>, with the body example, type tooltips and nesting warnings.</p>
          </div>
        </a>
      </div>
    </div>
    <p class="mt-4"><a href="${repositoryUrl}">Source on GitHub</a></p>
  </main>
</body>
</html>
`;
  fs.writeFileSync(path.join(outputDir, 'index.html'), landing);
}

/**
 * @param {String} outputDir directory that receives the generated example site
 */
function buildExample (outputDir) {
  execFileSync(process.execPath, [path.join(repoRoot, 'bin', 'apidoc'), '-i', path.join(repoRoot, 'example'), '-o', outputDir, '-q'], { stdio: 'inherit' });
}

/**
 * @param {String} outputDir
 */
function buildSite (outputDir) {
  fs.emptyDirSync(outputDir);
  buildLanding(outputDir);
  buildDocs(path.join(outputDir, 'docs'));
  buildExample(path.join(outputDir, 'example'));
}

module.exports = { buildDocs, buildSite, renderMarkdown, pageFiles };

if (require.main === module) {
  const outputDir = path.resolve(process.argv[2] || path.join(repoRoot, 'tmp', 'site'));
  buildSite(outputDir);
  console.log(`Pages site written to ${outputDir}`);
}
