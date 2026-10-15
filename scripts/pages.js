/**
 * Docs page: follow the scroll in the sidebar and open only the group being read.
 */
document.documentElement.classList.add('docs-js');

const links = [...document.querySelectorAll('#docs-nav a[href^="#"]')];
const entries = links
  .map(link => ({ link, target: document.getElementById(link.getAttribute('href').slice(1)) }))
  .filter(entry => entry.target);
const readingOffset = 120;
let current;

const update = () => {
  let active = entries[0];
  entries.forEach(entry => {
    if (entry.target.getBoundingClientRect().top <= readingOffset) { active = entry; }
  });
  if (!active || active === current) { return; }
  current = active;

  links.forEach(link => link.classList.remove('active'));
  document.querySelectorAll('.docs-group').forEach(group => group.classList.remove('active'));
  active.link.classList.add('active');
  const group = active.link.closest('.docs-group');
  if (group) {
    group.classList.add('active');
    group.querySelector('.docs-page').classList.add('active');
  }

  const nav = document.getElementById('docs-nav');
  const linkBox = active.link.getBoundingClientRect();
  const navBox = nav.getBoundingClientRect();
  if (linkBox.top < navBox.top + 40 || linkBox.bottom > navBox.bottom - 40) {
    nav.scrollTop += linkBox.top - navBox.top - nav.clientHeight / 2;
  }
};

let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) { return; }
  ticking = true;
  window.requestAnimationFrame(() => {
    ticking = false;
    update();
  });
}, { passive: true });
window.addEventListener('hashchange', update);
update();
