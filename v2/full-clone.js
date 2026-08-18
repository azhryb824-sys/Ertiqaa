(function () {
  "use strict";
  window.__ERTIQAA_EDITION__ = "v2-full-clone";
  document.documentElement.dataset.edition = "v2";

  // The preview service has its own storage and database boundary. Never point
  // this edition's write traffic at the production origin.
  const productionOrigin = "https://ertiqaa.onrender.com";
  const originalFetch = window.fetch && window.fetch.bind(window);
  if (originalFetch) {
    window.fetch = function (input, init) {
      const raw = typeof input === "string" ? input : input && input.url;
      if (raw) {
        const target = new URL(raw, location.href);
        if (target.origin === productionOrigin && init && !/^(GET|HEAD)$/i.test(init.method || "GET")) {
          return Promise.reject(new Error("V2_WRITE_TO_V1_BLOCKED"));
        }
      }
      return originalFetch(input, init);
    };
  }
})();
