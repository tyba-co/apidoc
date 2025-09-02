/*
 * apidoc - Sample Request Handler (Improved)
 * https://apidocjs.com
 *
 * Authors:
 * Peter Rottmann <rottmann@inveris.de>
 * Nicolas CARPi @ Deltablot
 * Copyright (c) 2013 inveris OHG
 * Licensed under the MIT license.
 */
import $ from 'jquery';
import UrlProcessor from './sampreq_url_processor.mjs';
import Prism from 'prismjs';
import 'prismjs/components/prism-json';

// Constants for better maintainability
const SELECTORS = {
  SEND_BUTTON: '.sample-request-send',
  CLEAR_BUTTON: '.sample-request-clear',
  RESPONSE_CONTAINER: '.sample-request-response',
  RESPONSE_JSON: '.sample-request-response-json',
  SAMPLE_INPUT: '.sample-request-input',
  SAMPLE_URL: '.sample-request-url',
};

const CSS_CLASSES = {
  BORDER_DANGER: 'border-danger',
};

// Debug logging utility
const logger = {
  debug: (message, data = null) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SampleRequest] ${message}`, data || '');
    }
  },
  error: (message, error = null) => {
    console.error(`[SampleRequest Error] ${message}`, error || '');
  },
};

/**
 * Initialize sample request functionality
 */
export function initSampleRequest () {
  logger.debug('Initializing sample request handlers');

  // Remove existing handlers to prevent duplicates
  $(document).off('click', SELECTORS.SEND_BUTTON);
  $(document).off('click', SELECTORS.CLEAR_BUTTON);

  // Button send - using event delegation for dynamic content
  $(document).on('click', SELECTORS.SEND_BUTTON, function (e) {
    e.preventDefault();

    try {
      const $button = $(this);
      const $root = $button.parents('article');
      const requestData = extractRequestData($root, $button);

      logger.debug('Send button clicked', requestData);
      sendSampleRequest(requestData.group, requestData.name, requestData.version, requestData.type);
    } catch (error) {
      logger.error('Error handling send button click', error);
    }
  });

  // Button clear - using event delegation for dynamic content
  $(document).on('click', SELECTORS.CLEAR_BUTTON, function (e) {
    e.preventDefault();

    try {
      const $button = $(this);
      const $root = $button.parents('article');
      const requestData = extractRequestData($root);

      logger.debug('Clear button clicked', requestData);
      clearSampleRequest(requestData.group, requestData.name, requestData.version);
    } catch (error) {
      logger.error('Error handling clear button click', error);
    }
  });
}

/**
 * Extract request data from DOM elements
 */
function extractRequestData ($root, $button = null) {
  return {
    group: $root.data('group'),
    name: $root.data('name'),
    version: $root.data('version'),
    type: $button ? $button.data('type') : null,
  };
}

/**
 * Convert path params from {param} format to :param format
 */
function convertPathParams (url) {
  return url.replace(/{(.+?)}/g, ':$1');
}

/**
 * Transform URL with parameters (e.g., https://example.org/:path/:id → https://example.org/some-path/42)
 */
function getHydratedUrl ($root, queryParameters) {
  const dryUrl = $root.find(SELECTORS.SAMPLE_URL).val();
  const urlProcessor = new UrlProcessor();

  // Convert {param} format to :param
  const convertedUrl = convertPathParams(dryUrl);

  try {
    return urlProcessor.hydrate(convertedUrl, queryParameters);
  } catch (error) {
    logger.error('Error processing URL', { url: convertedUrl, error });
    return dryUrl; // fallback to original URL
  }
}

/**
 * Collect parameter values from form elements
 */
function collectValues ($root) {
  logger.debug('Collecting values from form');
  const parameters = {};
  const families = ['header', 'query', 'body'];

  families.forEach(family => {
    const inputValues = {};

    try {
      const $elements = $root.find(`[data-family="${family}"]:visible`);
      logger.debug(`Found ${$elements.length} visible elements for family: ${family}`);

      $elements.each((index, el) => {
        const $el = $(el);
        const name = el.dataset?.name;
        const isOptional = el.dataset?.optional === 'true';

        if (!name) {
          logger.debug('Skipping element without name attribute');
          return true; // continue
        }

        let value = el.value || '';

        // Handle different input types
        if (el.type === 'checkbox') {
          if (el.checked) {
            value = 'on';
          } else {
            return true; // Skip unchecked checkboxes
          }
        }

        // Validate required fields
        if (!value && !isOptional && el.type !== 'checkbox') {
          $el.addClass(CSS_CLASSES.BORDER_DANGER);
          logger.debug(`Required field '${name}' is empty`);
          return true; // continue
        } else {
          // Remove error styling if field now has value
          $el.removeClass(CSS_CLASSES.BORDER_DANGER);
        }

        inputValues[name] = value;
      });
    } catch (error) {
      logger.error(`Error processing ${family} parameters`, error);
    }

    parameters[family] = inputValues;
  });

  // Handle JSON body special case
  const $bodyJson = $root.find('[data-family="body-json"]');

  if ($bodyJson.length > 0 && $bodyJson.is(':visible')) {
    const jsonValue = $bodyJson.val();
    logger.debug('Using JSON body mode', { hasValue: !!jsonValue });

    parameters.body = jsonValue || '';
    if (!parameters.header) parameters.header = {};
    parameters.header['Content-Type'] = 'application/json';
  } else {
    logger.debug('Using form-data mode');
    if (!parameters.header) parameters.header = {};
    parameters.header['Content-Type'] = 'multipart/form-data';
  }

  logger.debug('Final collected parameters', parameters);
  return parameters;
}

/**
 * Show response container with loading state
 */
function showResponseContainer ($root, loadingText = 'Loading...') {
  const $responseContainer = $root.find(SELECTORS.RESPONSE_CONTAINER);
  $responseContainer.removeAttr('hidden').show().fadeTo(200, 1);
  $root.find(SELECTORS.RESPONSE_JSON).html(loadingText);
}

/**
 * Update response display with content
 */
function updateResponseDisplay ($root, content, isError = false) {
  const $responseContainer = $root.find(SELECTORS.RESPONSE_CONTAINER);

  // Show flicker effect for new responses
  if ($responseContainer.is(':visible')) {
    $responseContainer.fadeTo(1, 0.1);
  } else {
    $responseContainer.removeAttr('hidden').show();
  }

  $responseContainer.fadeTo(250, 1);
  $root.find(SELECTORS.RESPONSE_JSON).text(content);

  logger.debug(`${isError ? 'Error' : 'Success'} response displayed`);

  // Re-apply syntax highlighting
  Prism.highlightAll();
}

/**
 * Send sample request
 */
function sendSampleRequest (group, name, version, method) {
  logger.debug('Sending sample request', { group, name, version, method });

  const $root = $(`article[data-group="${group}"][data-name="${name}"][data-version="${version}"]`);
  if (!$root.length) {
    logger.error('Could not find article element for request');
    return;
  }

  const parameters = collectValues($root);
  const url = getHydratedUrl($root, parameters.query);

  // Prepare request configuration
  const requestConfig = {
    url: url,
    headers: parameters.header || {},
    type: method.toUpperCase(),
    success: (data, status, jqXHR) => displaySuccess($root, data, status, jqXHR),
    error: (jqXHR, textStatus, error) => displayError($root, jqXHR, textStatus, error),
  };

  // Handle request body based on content type
  if (parameters.header && parameters.header['Content-Type'] === 'application/json') {
    // JSON body
    requestConfig.data = parameters.body;
    requestConfig.processData = false;
    requestConfig.contentType = 'application/json';
  } else {
    // Form data
    const formData = new FormData();
    if (parameters.body && typeof parameters.body === 'object') {
      for (const [name, value] of Object.entries(parameters.body)) {
        formData.append(name, value);
      }
    }
    requestConfig.data = formData;
    requestConfig.processData = false;
    requestConfig.contentType = false; // Let browser set multipart boundary

    // Remove Content-Type header to let browser handle it
    delete requestConfig.headers['Content-Type'];
  }

  // Show loading state
  showResponseContainer($root, 'Loading...');

  // Execute request
  $.ajax(requestConfig);
}

/**
 * Handle successful response
 */
function displaySuccess ($root, data, status, jqXHR) {
  logger.debug('Request successful', { status, responseLength: jqXHR.responseText?.length });

  let formattedResponse;
  try {
    const parsedJson = JSON.parse(jqXHR.responseText);
    formattedResponse = JSON.stringify(parsedJson, null, 2);
  } catch (error) {
    // Not JSON, display as-is
    formattedResponse = jqXHR.responseText || 'No response content';
  }

  updateResponseDisplay($root, formattedResponse);
}

/**
 * Handle error response
 */
function displayError ($root, jqXHR, textStatus, error) {
  logger.error('Request failed', { status: jqXHR.status, textStatus, error });

  let errorMessage = `Error ${jqXHR.status}: ${error}`;

  // Try to parse error response
  if (jqXHR.responseText) {
    try {
      const parsedJson = JSON.parse(jqXHR.responseText);
      const formattedJson = JSON.stringify(parsedJson, null, 2);
      errorMessage += '\n\n' + formattedJson;
    } catch (parseError) {
      errorMessage += '\n\n' + jqXHR.responseText;
    }
  }

  updateResponseDisplay($root, errorMessage, true);
}

/**
 * Clear sample request form and response
 */
function clearSampleRequest (group, name, version) {
  logger.debug('Clearing sample request', { group, name, version });

  const $root = $(`article[data-group="${group}"][data-name="${name}"][data-version="${version}"]`);
  if (!$root.length) {
    logger.error('Could not find article element for clearing');
    return;
  }

  // Hide response container
  const $responseContainer = $root.find(SELECTORS.RESPONSE_CONTAINER);
  $responseContainer.hide().attr('hidden', 'hidden');
  $root.find(SELECTORS.RESPONSE_JSON).html('');

  // Reset form inputs
  $root.find(SELECTORS.SAMPLE_INPUT).each((idx, el) => {
    const $el = $(el);

    // Remove error styling
    $el.removeClass(CSS_CLASSES.BORDER_DANGER);

    // Reset value - use placeholder if it's a default value, otherwise empty
    const placeholder = el.placeholder || '';
    const name = el.dataset?.name || '';
    el.value = placeholder && placeholder !== name ? placeholder : '';
  });

  // Restore default URL
  const $urlElement = $root.find(SELECTORS.SAMPLE_URL);
  if ($urlElement.length) {
    const defaultValue = $urlElement.prop('defaultValue');
    $urlElement.val(defaultValue);
  }

  logger.debug('Sample request cleared successfully');
}
