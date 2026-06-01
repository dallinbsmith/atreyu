const DEF_BREAK = [{ media: '(min-width: 768px)', width: '2000' }, { width: '750' }];

export const createPicture = ({ src, alt = '', eager = false, breakpoints = DEF_BREAK }) => {
  const url = new URL(src, window.location.href);
  const picture = document.createElement('picture');
  const { origin, pathname } = url;
  const ext = pathname.split('.').at(-1);

  for (const br of breakpoints) {
    const source = document.createElement('source');
    if (br.media) source.setAttribute('media', br.media);
    source.setAttribute('type', 'image/webp');
    source.setAttribute('srcset', `${origin}${pathname}?width=${br.width}&format=webply&optimize=medium`);
    picture.append(source);
  }

  const fallback = breakpoints.at(-1);
  breakpoints.slice(0, -1).forEach((br) => {
    const source = document.createElement('source');
    if (br.media) source.setAttribute('media', br.media);
    source.setAttribute('srcset', `${origin}${pathname}?width=${br.width}&format=${ext}&optimize=medium`);
    picture.append(source);
  });

  const img = document.createElement('img');
  img.setAttribute('loading', eager ? 'eager' : 'lazy');
  img.setAttribute('alt', alt);
  img.setAttribute('src', `${origin}${pathname}?width=${fallback.width}&format=${ext}&optimize=medium`);
  picture.append(img);

  return picture;
};
