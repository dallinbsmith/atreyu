const styles = new Map();

export default (href) => {
  const path = href.endsWith('.js') ? href.replace('.js', '.css') : href;
  if (!styles.has(path)) {
    styles.set(path, fetch(path)
      .then((resp) => resp.text())
      .then((text) => {
        const style = new CSSStyleSheet();
        style.path = path;
        style.replaceSync(text);
        return style;
      }));
  }
  return styles.get(path);
};
