/*
 * apidoc
 * https://apidocjs.com
 *
 * Authors:
 * Peter Rottmann <rottmann@inveris.de>
 * Nicolas CARPi @ Deltablot
 * Copyright (c) 2013 inveris OHG
 * Licensed under the MIT license.
 */
import $ from 'jquery';
import UrlProcessor from './sampreq_url_processor';

// Prism is the syntax highlighting lib
import Prism from 'prismjs';
// json language
import 'prismjs/components/prism-json';

export function initSampleRequest () {
  // Button send - using event delegation
  $(document).off('click', '.sample-request-send');
  $(document).on('click', '.sample-request-send', function (e) {
    e.preventDefault();
    console.log('Send button clicked!'); // Debug log
    const root = $(this).parents('article');
    const group = root.data('group');
    const name = root.data('name');
    const version = root.data('version');
    console.log('Sending request for:', { group, name, version, type: $(this).data('type') }); // Debug log
    sendSampleRequest(group, name, version, $(this).data('type'));
  });

  // Button clear - using event delegation
  $(document).off('click', '.sample-request-clear');
  $(document).on('click', '.sample-request-clear', function (e) {
    e.preventDefault();
    console.log('Clear button clicked!'); // Debug log
    const root = $(this).parents('article');
    const group = root.data('group');
    const name = root.data('name');
    const version = root.data('version');
    console.log('Clearing request for:', { group, name, version }); // Debug log
    clearSampleRequest(group, name, version);
  });
}

// Converts path params in the {param} format to the accepted :param format, used before inserting the URL params.
function convertPathParams (url) {
  return url.replace(/{(.+?)}/g, ':$1');
}
/**
 * Transforms https://example.org/:path/:id in https://example.org/some-path/42
 * Based on query parameters collected
 * @return string
 */
function getHydratedUrl (root, queryParameters) {
  // grab user-inputted URL
  const dryUrl = root.find('.sample-request-url').val();
  const UrlProc = new UrlProcessor();
  // Convert {param} form to :param
  // TODO check if this is necessary, do we have urls with {param} in it?
  const url = convertPathParams(dryUrl);
  return UrlProc.hydrate(url, queryParameters);
}

/**
 * Grab the values from the different inputs
 *
 * The url in this object is already hydrated from query parameters
 * @return {
 *   "header": { "name": "some-name", "value": "some-value" },
 *   "query": { "name": "some-name", "value": "some-value" },
 *   "body": { "name": "some-name", "value": "some-value" },
 *   "url": "http://api.example.org/user/3",
 * }
 */
function collectValues (root) {
  console.log('Collecting values from root:', root);
  const parameters = {};
  ['header', 'query', 'body'].forEach(family => {
    // key: parameter name (e.g. 'id'), value: the content of the input
    const inputValues = {};
    // look for all parameters
    try {
      const elements = root.find(`[data-family="${family}"]:visible`);
      console.log(`Found ${elements.length} visible elements for family: ${family}`);
      
      elements.each((index, el) => {
        console.log('Processing element:', el, 'with dataset:', el.dataset);
        const name = el.dataset.name;
        let value = el.value;
        
        console.log(`Element name: ${name}, value: ${value}, type: ${el.type}`);
        
        // special case for checkbox, we look at the checked property
        if (el.type === 'checkbox') {
          if (el.checked) {
            value = 'on';
          } else {
            // don't send anything for checkbox if it's not checked
            // without this an empty string will be sent along
            return true;
          }
        }
        if (!value && !el.dataset.optional && el.type !== 'checkbox') {
          $(el).addClass('border-danger');
          return true;
        }
        inputValues[name] = value;
      });
    } catch (e) {
      console.error('Error in collectValues:', e);
      return;
    }
    parameters[family] = inputValues;
    console.log(`Parameters for ${family}:`, inputValues);
  });
  
  // find the json body
  const bodyJson = root.find('[data-family="body-json"]');
  console.log('Found bodyJson elements:', bodyJson.length);
  
  // load it if it's visible
  if (bodyJson.is(':visible') && bodyJson.length > 0) {
    console.log('Using JSON body with value:', bodyJson.val());
    parameters.body = bodyJson.val();
    if (!parameters.header) parameters.header = {};
    parameters.header['Content-Type'] = 'application/json';
  } else {
    console.log('Using form-data mode');
    if (!parameters.header) parameters.header = {};
    parameters.header['Content-Type'] = 'multipart/form-data';
  }
  
  console.log('Final parameters:', parameters);
  return parameters;
}

function sendSampleRequest (group, name, version, method) {
  // root is the current sample request block, all is scoped within this block
  const root = $(`article[data-group="${group}"][data-name="${name}"][data-version="${version}"]`);

  const parameters = collectValues(root);

  // build the object that will be passed to jquery's ajax function
  const requestParams = {};
  // assign the hydrated url
  requestParams.url = getHydratedUrl(root, parameters.query);

  // assign the headers
  requestParams.headers = parameters.header;

  if (requestParams.headers['Content-Type'] === 'application/json') {
    // TODO check json is valid?
    // or maybe have a direct feedback on the textarea onkeypress for valid/invalid json
    requestParams.data = parameters.body;
  } else if (requestParams.headers['Content-Type'] === 'multipart/form-data') {
    const formData = new FormData();
    // Note: here we don't try to handle nested fields for form-data because it doesn't make sense
    // if you need to send non-flat data, use json, not form-data which is a flat key/value structure
    for (const [name, value] of Object.entries(parameters.body)) {
      formData.append(name, value);
    }
    requestParams.data = formData;
    requestParams.processData = false;
    // With no content-type header, browser will know it needs to generate a proper content-type for
    // the form data when sending it. Fix #1122
    delete requestParams.headers['Content-Type'];
    // As of jQuery 1.6 you can pass false to tell jQuery to not set any content type header.
    // https://api.jquery.com/jquery.ajax/
    requestParams.contentType = false;
  }

  requestParams.type = method;
  requestParams.success = displaySuccess;
  requestParams.error = displayError;

  // Do the request!
  $.ajax(requestParams);

  // Show response container and set loading state
  console.log('Showing response container and setting loading state');
  const responseContainer = root.find('.sample-request-response');
  responseContainer.removeAttr('hidden').show();
  responseContainer.fadeTo(200, 1);
  root.find('.sample-request-response-json').html('Loading...');

  function displaySuccess (data, status, jqXHR) {
    console.log('Request successful:', { data, status, response: jqXHR.responseText });
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(jqXHR.responseText);
      jsonResponse = JSON.stringify(jsonResponse, null, 4);
    } catch (e) {
      jsonResponse = jqXHR.responseText;
    }
    root.find('.sample-request-response-json').text(jsonResponse);
    console.log('Response displayed in UI');
    Prism.highlightAll();
  }

  function displayError (jqXHR, textStatus, error) {
    console.log('Request failed:', { jqXHR, textStatus, error });
    let message = 'Error ' + jqXHR.status + ': ' + error;
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(jqXHR.responseText);
      jsonResponse = JSON.stringify(jsonResponse, null, 4);
    } catch (e) {
      jsonResponse = jqXHR.responseText;
    }

    if (jsonResponse) { message += '\n' + jsonResponse; }

    // Show response container for errors too
    const responseContainer = root.find('.sample-request-response');
    
    // flicker on previous error to make clear that there is a new response
    if (responseContainer.is(':visible')) { 
      responseContainer.fadeTo(1, 0.1); 
    } else {
      responseContainer.removeAttr('hidden').show();
    }

    responseContainer.fadeTo(250, 1);
    root.find('.sample-request-response-json').text(message);
    console.log('Error displayed in UI');
    Prism.highlightAll();
  }
}

function clearSampleRequest (group, name, version) {
  console.log('Clearing sample request for:', { group, name, version });
  const root = $('article[data-group="' + group + '"][data-name="' + name + '"][data-version="' + version + '"]');

  // hide sample response
  root.find('.sample-request-response-json').html('');
  const responseContainer = root.find('.sample-request-response');
  responseContainer.hide().attr('hidden', 'hidden');

  // reset value of parameters
  root.find('.sample-request-input').each((idx, el) => {
    // placeholder is the name of the input if there are no default value
    // so replace by the placeholder if it's different (input has a default value)
    // or empty string if there is no default value
    el.value = el.placeholder !== el.dataset.name ? el.placeholder : '';
  });

  // restore default URL
  const $urlElement = root.find('.sample-request-url');
  $urlElement.val($urlElement.prop('defaultValue'));
}
