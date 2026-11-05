(function (root) {
  'use strict';

  if (!root.Ajax || typeof root.Ajax.Request !== 'function') {
    throw new Error('افتح صفحة اللعبة المحمّلة أولاً؛ Ajax.Request غير متاح.');
  }

  function request(url, parameters, options) {
    options = options || {};
    var method = options.method || 'post';
    var expectJson = options.json !== false;

    return new Promise(function (resolve, reject) {
      new root.Ajax.Request(url, {
        method: method,
        parameters: parameters || {},
        onSuccess: function (response) {
          var body = response.responseText;
          var result = body;
          if (expectJson) {
            try {
              result = response.responseJSON || JSON.parse(body);
            } catch (error) {
              reject(new Error('تعذر قراءة JSON من ' + url + ': ' + error.message));
              return;
            }
          }
          resolve({ url: url, status: response.status, body: result, raw: body });
        },
        onFailure: function (response) {
          reject(new Error('HTTP ' + response.status + ' عند طلب ' + url));
        },
        onException: function (_request, error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    });
  }

  root.KWAjax = Object.freeze({ request: request });
})(window);
