export interface ZohoEmbedRewriteOptions {
  /** Absolute proxy base, e.g. https://host/api/hackathon/social-share-form/p/TOKEN */
  proxyBase: string;
  /** Root-relative proxy path, e.g. /api/hackathon/social-share-form/p/TOKEN */
  proxyBasePath: string;
  zohoHost: string;
}

/** Zoho Forms live JS submits to /FirstStep/form/... on the iframe origin — rewrite for the proxy. */
export function rewriteZohoEmbedBody(
  text: string,
  options: ZohoEmbedRewriteOptions,
  postProcess?: (output: string) => string
): string {
  const { proxyBase, proxyBasePath, zohoHost } = options;
  const zohoHttps = `https://${zohoHost}`;
  const zohoProtocolRelative = `//${zohoHost}`;

  let output = text
    .replaceAll(zohoHttps, proxyBase)
    .replaceAll(zohoProtocolRelative, proxyBase)
    .replace(/(["'(=\s])\/FirstStep\//g, `$1${proxyBasePath}/FirstStep/`)
    .replace(/X-Frame-Options:\s*[^\r\n]+/gi, '')
    .replace(/frame-ancestors[^;]*;?/gi, '');

  if (postProcess) {
    output = postProcess(output);
  }

  return output;
}

/** Patch XHR / fetch / jQuery before ZFLive submits to a root-relative Zoho path. */
export function buildZohoSubmitUrlRewriteScript(proxyBasePath: string): string {
  const base = JSON.stringify(proxyBasePath);
  return `<script id="firststep-zoho-submit-rewrite">
(function () {
  var proxyBase = ${base};
  function rewriteUrl(url) {
    if (!url || typeof url !== 'string') return url;
    if (url.indexOf(proxyBase + '/FirstStep/') === 0) return url;
    if (url.charAt(0) === '/' && url.indexOf('/FirstStep/') === 0) {
      return proxyBase + url;
    }
    return url;
  }
  var origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function () {
    var args = Array.prototype.slice.call(arguments);
    if (args.length > 1) args[1] = rewriteUrl(args[1]);
    return origOpen.apply(this, args);
  };
  if (window.fetch) {
    var origFetch = window.fetch;
    window.fetch = function (input, init) {
      if (typeof input === 'string') {
        input = rewriteUrl(input);
      } else if (input && typeof input.url === 'string') {
        input = new Request(rewriteUrl(input.url), input);
      }
      return origFetch.call(this, input, init);
    };
  }
  function patchJQuery($) {
    if (!$ || !$.ajax || $.ajax.__firststepPatched) return;
    var origAjax = $.ajax;
    $.ajax = function (url, options) {
      if (typeof url === 'string') {
        return origAjax.call(this, rewriteUrl(url), options);
      }
      if (url && typeof url === 'object' && typeof url.url === 'string') {
        url = Object.assign({}, url, { url: rewriteUrl(url.url) });
      }
      return origAjax.call(this, url, options);
    };
    $.ajax.__firststepPatched = true;
  }
  patchJQuery(window.jQuery);
  if (window.jQuery) return;
  Object.defineProperty(window, 'jQuery', {
    configurable: true,
    set: function (value) {
      Object.defineProperty(window, 'jQuery', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: value,
      });
      patchJQuery(value);
    },
  });
})();
</script>`;
}
