/**
 * Suggestion list for the body textarea of the sample request (see body_autocomplete.mjs).
 */
import { applySuggestion, buildFieldTree, suggest } from './body_autocomplete.mjs';

const TEXTAREA_SELECTOR = 'textarea[data-autocomplete]';
const MIRRORED_STYLES = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'tabSize', 'paddingTop', 'paddingLeft', 'paddingRight', 'paddingBottom'];

const trees = new WeakMap();
let popup;
let state;

const readTree = textarea => {
  if (!trees.has(textarea)) { trees.set(textarea, buildFieldTree(JSON.parse(textarea.dataset.autocomplete))); }
  return trees.get(textarea);
};

/**
 * Viewport position just below the caret, found by measuring a hidden copy of the text before it.
 *
 * @param {HTMLTextAreaElement} textarea
 * @param {Number} position
 * @returns {{left: Number, top: Number, lineHeight: Number}}
 */
function caretPosition (textarea, position) {
  const style = getComputedStyle(textarea);
  const mirror = document.createElement('div');
  MIRRORED_STYLES.forEach(name => { mirror.style[name] = style[name]; });
  Object.assign(mirror.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', top: '0', left: '0' });
  mirror.textContent = textarea.value.slice(0, position);
  const marker = document.createElement('span');
  marker.textContent = '​';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const box = textarea.getBoundingClientRect();
  const markerBox = marker.getBoundingClientRect();
  const mirrorBox = mirror.getBoundingClientRect();
  mirror.remove();
  return {
    left: box.left + parseFloat(style.borderLeftWidth) + markerBox.left - mirrorBox.left - textarea.scrollLeft,
    top: box.top + parseFloat(style.borderTopWidth) + markerBox.top - mirrorBox.top - textarea.scrollTop + markerBox.height,
    lineHeight: markerBox.height,
  };
}

const ensurePopup = () => {
  if (!popup) {
    popup = document.createElement('div');
    popup.className = 'body-autocomplete';
    popup.setAttribute('role', 'listbox');
    popup.hidden = true;
    popup.addEventListener('mousedown', event => {
      event.preventDefault();
      const item = event.target.closest('.body-autocomplete-item');
      if (item && state) { accept(Number(item.dataset.index)); }
    });
    document.body.appendChild(popup);
  }
  return popup;
};

function close () {
  state = undefined;
  if (popup) { popup.hidden = true; }
}

function render () {
  popup.textContent = '';
  state.suggestions.forEach((suggestion, index) => {
    const item = document.createElement('div');
    item.className = 'body-autocomplete-item' + (index === state.index ? ' active' : '');
    item.dataset.index = index;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', index === state.index);
    if (suggestion.description) { item.title = suggestion.description; }
    const label = document.createElement('span');
    label.className = 'body-autocomplete-label';
    label.textContent = suggestion.label;
    const detail = document.createElement('span');
    detail.className = 'body-autocomplete-detail';
    detail.textContent = suggestion.detail;
    item.append(label, detail);
    popup.appendChild(item);
  });
  const active = popup.querySelector('.active');
  if (active) { active.scrollIntoView({ block: 'nearest' }); }
}

function place () {
  const { left, top, lineHeight } = caretPosition(state.textarea, state.textarea.selectionStart);
  popup.hidden = false;
  const height = popup.offsetHeight;
  const width = popup.offsetWidth;
  popup.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`;
  popup.style.top = `${top + height > window.innerHeight ? top - lineHeight - height : top}px`;
}

function open (textarea, suggestions) {
  ensurePopup();
  state = { textarea, suggestions, index: 0 };
  render();
  place();
}

/**
 * @param {HTMLTextAreaElement} textarea
 * @param {Boolean} force show suggestions even when nothing has been typed yet
 */
function refresh (textarea, force) {
  const { suggestions, context } = suggest(readTree(textarea), textarea.value, textarea.selectionStart);
  const wanted = force || context.inString || Boolean(context.prefix);
  if (suggestions.length === 0 || !wanted) { return close(); }
  open(textarea, suggestions);
}

function accept (index) {
  const { textarea, suggestions } = state;
  const suggestion = suggestions[index];
  const { text, caret } = applySuggestion(textarea.value, suggestion);
  close();
  textarea.focus();
  textarea.setSelectionRange(suggestion.from, suggestion.to);
  if (!document.execCommand('insertText', false, suggestion.insert)) {
    textarea.value = text;
  }
  textarea.setSelectionRange(caret, caret);
  refresh(textarea, false);
}

const move = step => {
  state.index = (state.index + step + state.suggestions.length) % state.suggestions.length;
  render();
};

/**
 * Attach the suggestion list to every body textarea marked with data-autocomplete, now and later.
 */
export function initBodyAutocomplete () {
  document.addEventListener('input', event => {
    if (event.target.matches(TEXTAREA_SELECTOR)) { refresh(event.target, false); }
  });

  document.addEventListener('keydown', event => {
    if (!event.target.matches(TEXTAREA_SELECTOR)) { return; }
    if (event.ctrlKey && event.code === 'Space') {
      event.preventDefault();
      return refresh(event.target, true);
    }
    if (!state) { return; }
    const actions = {
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
      Enter: () => accept(state.index),
      Tab: () => accept(state.index),
      Escape: close,
    };
    if (actions[event.key]) {
      event.preventDefault();
      actions[event.key]();
    }
  });

  document.addEventListener('focusout', event => {
    if (event.target.matches(TEXTAREA_SELECTOR)) { close(); }
  });
  document.addEventListener('mousedown', event => {
    if (state && !event.target.closest('.body-autocomplete')) { close(); }
  });
  window.addEventListener('scroll', close, true);
  window.addEventListener('resize', close);
}
