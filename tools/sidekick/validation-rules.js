const checkHeadingHierarchy = () => {
  const headings = [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')];
  const levels = headings.map((h) => +h.tagName[1]);
  const h1Count = levels.filter((l) => l === 1).length;
  if (h1Count !== 1) {
    const el = h1Count === 0 ? null : headings.find((h) => h.tagName === 'H1');
    return { status: 'fail', message: `Found ${h1Count} h1 elements (expected 1)`, el };
  }
  const skip = levels.find((l, i) => i > 0 && l > levels[i - 1] + 1);
  if (skip) {
    const idx = levels.findIndex((l, i) => i > 0 && l > levels[i - 1] + 1);
    return { status: 'fail', message: `Skipped heading level before h${skip}`, el: headings[idx] };
  }
  return { status: 'pass', message: 'Heading hierarchy is valid' };
};

const checkAltText = () => {
  const images = [...document.querySelectorAll('main img')];
  const missing = images.filter((img) => !img.getAttribute('alt')?.trim());
  if (missing.length) {
    return { status: 'fail', message: `${missing.length} image(s) missing alt text`, el: missing[0] };
  }
  return images.length
    ? { status: 'pass', message: `All ${images.length} images have alt text` }
    : { status: 'pass', message: 'No images found' };
};

const checkEmptyBlocks = () => {
  const blocks = [...document.querySelectorAll('main [class]:not(.section):not(.default-content)')];
  const empty = blocks.filter((b) => !b.textContent.trim() && !b.querySelector('img, video, picture, svg'));
  if (empty.length) {
    return { status: 'warning', message: `${empty.length} block(s) appear empty`, el: empty[0] };
  }
  return { status: 'pass', message: 'No empty blocks found' };
};

const checkMetaDescription = () => {
  const meta = document.querySelector('meta[name="description"]');
  if (!meta) return { status: 'fail', message: 'Missing meta description' };
  const len = meta.content.trim().length;
  if (len < 50 || len > 160) {
    return { status: 'warning', message: `Meta description is ${len} chars (ideal: 50-160)` };
  }
  return { status: 'pass', message: `Meta description is ${len} chars` };
};

const checkOgImage = () => {
  const og = document.querySelector('meta[property="og:image"]');
  return og?.content
    ? { status: 'pass', message: 'OG image is set' }
    : { status: 'fail', message: 'Missing og:image meta tag' };
};

const checkBrokenLinks = async (onUpdate) => {
  const links = [...document.querySelectorAll('main a[href]')]
    .filter((a) => {
      try {
        return new URL(a.href).origin === window.location.origin;
      } catch { return false; }
    });
  if (!links.length) {
    onUpdate({ status: 'pass', message: 'No internal links to check' });
    return;
  }
  const checked = new Map();
  const broken = [];
  let pending = links.length;
  const semaphore = { active: 0, queue: [] };
  const acquire = () => new Promise((resolve) => {
    if (semaphore.active < 3) {
      semaphore.active += 1;
      resolve();
    } else semaphore.queue.push(resolve);
  });
  const release = () => {
    semaphore.active -= 1;
    semaphore.queue.shift()?.();
  };
  const checkLink = async (a) => {
    const { href } = a;
    if (!checked.has(href)) {
      await acquire();
      try {
        const res = await fetch(href, { method: 'HEAD', mode: 'no-cors' });
        checked.set(href, res.ok || res.type === 'opaque');
      } catch {
        checked.set(href, false);
      } finally { release(); }
    }
    if (!checked.get(href)) broken.push(a);
    pending -= 1;
    let msg = `All ${links.length} internal links OK`;
    if (pending) msg = `Checking links... ${links.length - pending}/${links.length}`;
    else if (broken.length) msg = `${broken.length} broken link(s)`;
    onUpdate({
      status: broken.length ? 'fail' : 'pass',
      message: msg,
      el: broken[0] ?? null,
    });
  };
  await Promise.all(links.map(checkLink));
};

export const runSyncRules = () => [
  { label: 'Heading hierarchy', ...checkHeadingHierarchy() },
  { label: 'Alt text', ...checkAltText() },
  { label: 'Empty blocks', ...checkEmptyBlocks() },
  { label: 'Meta description', ...checkMetaDescription() },
  { label: 'OG image', ...checkOgImage() },
];

export const runLinkCheck = checkBrokenLinks;
