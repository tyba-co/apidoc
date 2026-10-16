/**
 * "Authorize" and environment selector of the sample requests, from the auth and environments keys of apidoc.json.
 */
import * as bootstrap from 'bootstrap';
import { authorizedSchemes, authRequest, inEnvironment } from './auth_request.mjs';

let project = {};
let modal;

const sessionStore = () => {
  try { return window.sessionStorage; } catch (error) { return undefined; }
};
const localStore = () => {
  try { return window.localStorage; } catch (error) { return undefined; }
};
const credentialsKey = () => `apidoc:auth:${project.name}`;
const environmentKey = () => `apidoc:environment:${project.name}`;

/**
 * @returns {Object} the credentials of this tab, by scheme name
 */
function readCredentials () {
  const store = sessionStore();
  try { return JSON.parse(store.getItem(credentialsKey())) || {}; } catch (error) { return {}; }
}

/**
 * @param {Object} credentials
 */
function saveCredentials (credentials) {
  const store = sessionStore();
  if (!store) { return; }
  if (Object.keys(credentials).length === 0) {
    store.removeItem(credentialsKey());
  } else {
    store.setItem(credentialsKey(), JSON.stringify(credentials));
  }
}

const FIELDS = {
  bearer: [{ key: 'token', label: 'Token', type: 'password' }],
  apiKey: [{ key: 'value', label: 'Value', type: 'password' }],
  basic: [{ key: 'username', label: 'Username', type: 'text' }, { key: 'password', label: 'Password', type: 'password' }],
};

/**
 * @returns {HTMLElement} the modal that asks for the credentials of every scheme
 */
function buildModal () {
  const element = document.createElement('div');
  element.className = 'modal fade';
  element.id = 'try-auth-modal';
  element.tabIndex = -1;
  element.setAttribute('aria-labelledby', 'try-auth-title');
  const schemes = project.auth.map((scheme, index) => {
    const inputs = (FIELDS[scheme.type] || []).map(field => `
      <div class="mb-2">
        <label class="form-label" for="try-auth-${index}-${field.key}">${field.label}</label>
        <input class="form-control form-control-sm" id="try-auth-${index}-${field.key}" type="${field.type}" autocomplete="off" data-scheme="${index}" data-field="${field.key}">
      </div>`).join('');
    const detail = scheme.type === 'bearer' ? `Authorization: ${scheme.prefix || 'Bearer'} ...` : scheme.type === 'apiKey' ? `${scheme.in === 'query' ? 'query' : 'header'} ${scheme.param || 'X-API-Key'}` : 'Authorization: Basic ...';
    return `<fieldset class="mb-3"><legend class="try-auth-legend">${scheme.name} <small class="text-muted">${detail}</small></legend>${inputs}</fieldset>`;
  }).join('');
  element.innerHTML = `
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="try-auth-title">Authorize</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          ${schemes}
          <p class="form-text mb-0">Kept only in this tab until it is closed, and sent with the sample requests of the endpoints that need it.</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary btn-sm" data-try-auth="clear">Clear</button>
          <button type="button" class="btn btn-primary btn-sm" data-try-auth="save">Save</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(element);
  return element;
}

function renderState () {
  const state = document.getElementById('try-auth-state');
  if (!state) { return; }
  const names = authorizedSchemes(project.auth, readCredentials());
  state.textContent = names.length > 0 ? names.join(', ') : 'not authorized';
  state.classList.toggle('chip-muted', names.length === 0);
}

function fillModal (element) {
  const credentials = readCredentials();
  element.querySelectorAll('input[data-scheme]').forEach(input => {
    const scheme = project.auth[Number(input.dataset.scheme)];
    const given = credentials[scheme.name] || {};
    input.value = given[input.dataset.field] || '';
  });
}

function collectModal (element) {
  const credentials = {};
  element.querySelectorAll('input[data-scheme]').forEach(input => {
    if (!input.value) { return; }
    const scheme = project.auth[Number(input.dataset.scheme)];
    credentials[scheme.name] = Object.assign(credentials[scheme.name] || {}, { [input.dataset.field]: input.value });
  });
  return credentials;
}

/**
 * Put every sample request URL in the selected environment.
 */
export function applyEnvironment () {
  const select = document.getElementById('try-environment');
  document.querySelectorAll('input.sample-request-url').forEach(input => {
    if (input.dataset.originalUrl === undefined) { input.dataset.originalUrl = input.value; }
    input.value = select ? inEnvironment(input.dataset.originalUrl, select.value, project.sampleUrl) : input.dataset.originalUrl;
  });
}

/**
 * @param {JQuery} $card the sample request card of an endpoint
 * @returns {{headers: Object, query: Object}} the credentials to send, none for public endpoints
 */
export function currentAuth ($card) {
  if (!project.auth || $card.data('public')) { return { headers: {}, query: {} }; }
  return authRequest(project.auth, readCredentials());
}

/**
 * @param {Object} apiProject the project of apidoc.json
 */
export function initTrySettings (apiProject) {
  project = apiProject;

  const select = document.getElementById('try-environment');
  if (select) {
    const stored = localStore() && localStore().getItem(environmentKey());
    if (stored && [...select.options].some(option => option.value === stored)) { select.value = stored; }
    select.addEventListener('change', () => {
      if (localStore()) { localStore().setItem(environmentKey(), select.value); }
      applyEnvironment();
    });
  }

  const button = document.getElementById('try-authorize');
  if (button) {
    modal = buildModal();
    button.addEventListener('click', () => {
      fillModal(modal);
      bootstrap.Modal.getOrCreateInstance(modal).show();
    });
    modal.addEventListener('click', event => {
      const action = event.target.dataset.tryAuth;
      if (!action) { return; }
      saveCredentials(action === 'save' ? collectModal(modal) : {});
      renderState();
      bootstrap.Modal.getOrCreateInstance(modal).hide();
    });
    renderState();
  }

  applyEnvironment();
}
