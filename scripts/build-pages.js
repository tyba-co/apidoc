/**
 * Build the GitHub Pages site: a landing page, the docs (docs/*.md as one page) and the generated example.
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
const tagSection = 'params';
const sections = [
  { file: 'index.md', id: 'getting-started' },
  { file: 'configuration.md', id: 'configuration' },
  { file: 'structure.md', id: 'guide' },
  { file: 'tags.md', id: tagSection },
  { file: 'tooling.md', id: 'tooling' },
];
const pageFiles = sections.map(section => section.file);

const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * GitHub-style heading slug, so links written for GitHub keep working.
 *
 * @param {String} text
 * @returns {String}
 */
const slugify = text => text.toLowerCase().replace(/[^\w\- ]+/g, '').replace(/ /g, '-');

const isTagHeading = text => /^@api\w*$/.test(text);

/**
 * Anchor of a tag section, like apidocjs.com: @apiSampleRequest -> param-api-sample-request.
 *
 * @param {String} tag
 * @returns {String}
 */
const tagAnchor = tag => 'param-' + tag.replace(/^@/, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

/**
 * @returns {MarkdownIt}
 */
function createMarkdown () {
  const markdownIt = new MarkdownIt({
    highlight: (code, language) => {
      const grammar = Prism.languages[language === 'js' ? 'javascript' : language];
      const highlighted = (grammar ? Prism.highlight(code, grammar, language) : escapeHtml(code))
        .replace(/@api\w*/g, '<span class="apidoc-tag">$&</span>');
      return `<pre class="language-${escapeHtml(language || 'text')}"><code>${highlighted}</code></pre>`;
    },
  });

  markdownIt.renderer.rules.table_open = () => '<div class="table-responsive"><table>';
  markdownIt.renderer.rules.table_close = () => '</table></div>';

  markdownIt.renderer.rules.heading_close = (tokens, index, options, env, self) => {
    const id = tokens[index - 2].attrGet('id');
    return `<a class="anchor" href="#${id}" aria-label="Link to this section">#</a>${self.renderToken(tokens, index, options)}`;
  };

  const defaultLinkOpen = markdownIt.renderer.rules.link_open || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));
  markdownIt.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const href = tokens[index].attrGet('href') || '';
    const local = href.match(/^#(.+)$/);
    const other = href.match(/^([\w-]+\.md)(?:#(.+))?$/);
    if (local) {
      tokens[index].attrSet('href', `#${env.anchors.get(`${env.file}#${local[1]}`) || local[1]}`);
    } else if (other) {
      const target = other[2] ? env.anchors.get(`${other[1]}#${other[2]}`) : env.sectionIds.get(other[1]);
      tokens[index].attrSet('href', `#${target || other[2] || ''}`);
    }
    return defaultLinkOpen(tokens, index, options, env, self);
  };

  return markdownIt;
}

/**
 * Parse every section, give each heading its final id and remember where each source anchor went.
 *
 * @param {MarkdownIt} markdownIt
 * @returns {{parsed: Object[], anchors: Map, sectionIds: Map}}
 */
function parseSections (markdownIt) {
  const usedIds = new Set();
  const anchors = new Map();
  const sectionIds = new Map(sections.map(section => [section.file, section.id]));

  const parsed = sections.map(section => {
    const tokens = markdownIt.parse(fs.readFileSync(path.join(docsSourceDir, section.file), 'utf8'), {});
    const headings = [];
    tokens.forEach((token, index) => {
      if (token.type !== 'heading_open') { return; }
      const text = tokens[index + 1].children.map(child => child.content).join('');
      const level = Number(token.tag.slice(1));
      const slug = slugify(text);
      let id = slug;
      if (level === 1) { id = section.id; } else if (isTagHeading(text)) { id = tagAnchor(text); }
      if (usedIds.has(id)) { id = `${section.id}-${id}`; }
      while (usedIds.has(id)) { id += '-1'; }
      usedIds.add(id);
      anchors.set(`${section.file}#${slug}`, id);
      token.attrSet('id', id);
      headings.push({ level, text, id });
    });
    return { section, tokens, headings };
  });

  return { parsed, anchors, sectionIds };
}

/**
 * @param {Object} section
 * @param {Object} heading
 * @returns {Boolean} whether the heading gets a sidebar entry: every h2, plus the tag sections of the tag reference
 */
function isSidebarEntry (section, heading) {
  if (heading.level === 2) { return true; }
  return section.id === tagSection && heading.level === 3 && isTagHeading(heading.text);
}

/**
 * @param {Object[]} parsed
 * @returns {String}
 */
function renderSidebar (parsed) {
  const groups = parsed.map(({ section, headings }) => {
    const [title] = headings;
    const children = headings.filter(heading => isSidebarEntry(section, heading));
    const items = children.map(heading => `<li class="level-${heading.level}${isTagHeading(heading.text) ? ' tag' : ''}"><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`).join('');
    return `<li class="docs-group${section.id === tagSection ? ' docs-group-tags' : ''}"><a class="docs-page" href="#${title.id}">${escapeHtml(title.text)}</a><ul class="docs-sections">${items}</ul></li>`;
  });
  return `<ul class="list-unstyled">${groups.join('')}</ul>`;
}

/**
 * @param {Object[]} parsed
 * @param {String} content
 * @returns {String}
 */
function renderPage (parsed, content) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Documentation · apidoc</title>
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
        ${renderSidebar(parsed)}
      </nav>
      <main class="col-lg-9 col-xl-8 docs-content">
        ${content}
      </main>
    </div>
  </div>
  <script src="assets/bootstrap.bundle.min.js"></script>
  <script src="assets/docs.js"></script>
</body>
</html>
`;
}

/**
 * @param {String} outputDir directory that receives the docs page and its assets
 * @returns {String[]} names of the written pages
 */
function buildDocs (outputDir) {
  const markdownIt = createMarkdown();
  const { parsed, anchors, sectionIds } = parseSections(markdownIt);
  const content = parsed.map(({ section, tokens }) => {
    const env = { file: section.file, anchors, sectionIds };
    return `<section class="docs-section">${markdownIt.renderer.render(tokens, markdownIt.options, env)}</section>`;
  }).join('\n');

  const assetsDir = path.join(outputDir, 'assets');
  fs.ensureDirSync(assetsDir);
  fs.copySync(require.resolve('bootstrap/dist/css/bootstrap.min.css'), path.join(assetsDir, 'bootstrap.min.css'));
  fs.copySync(require.resolve('bootstrap/dist/js/bootstrap.bundle.min.js'), path.join(assetsDir, 'bootstrap.bundle.min.js'));
  fs.copySync(path.join(path.dirname(require.resolve('prismjs')), 'themes', 'prism-tomorrow.css'), path.join(assetsDir, 'prism.css'));
  fs.copySync(path.join(__dirname, 'pages.css'), path.join(assetsDir, 'docs.css'));
  fs.copySync(path.join(__dirname, 'pages.js'), path.join(assetsDir, 'docs.js'));

  fs.writeFileSync(path.join(outputDir, 'index.html'), renderPage(parsed, content));
  return ['index.html'];
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

module.exports = { buildDocs, buildSite, pageFiles, tagAnchor };

if (require.main === module) {
  const outputDir = path.resolve(process.argv[2] || path.join(repoRoot, 'tmp', 'site'));
  buildSite(outputDir);
  console.log(`Pages site written to ${outputDir}`);
}
