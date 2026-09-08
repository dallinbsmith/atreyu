export default async (src) => {
  if (document.querySelector(`head > script[src="${src}"]`)) return null;
  const { promise, resolve, reject } = Promise.withResolvers();
  const script = document.createElement('script');
  script.src = src;
  script.addEventListener('load', resolve);
  script.addEventListener('error', reject);
  document.head.append(script);
  return promise;
};
