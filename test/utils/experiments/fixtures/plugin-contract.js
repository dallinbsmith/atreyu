export const controlSection = '<p id="control">Control</p>';

export const variantHtml = (body) => `<html><body><main><div>${body}</div></main></body></html>`;

export const responseMap = (entries, { raw = false } = {}) => {
  const calls = [];
  const fetch = async (url) => {
    const path = new URL(`${url}`, window.location.origin).pathname;
    calls.push(path);
    if (!Object.hasOwn(entries, path)) {
      throw new Error(`Unexpected fetch: ${path}`);
    }
    return new Response(raw ? entries[path] : variantHtml(entries[path]), {
      status: 200,
      headers: { 'content-type': 'text/html' },
    });
  };
  fetch.calls = calls;
  return fetch;
};
