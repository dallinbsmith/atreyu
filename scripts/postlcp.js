import { loadBlock } from './ak.js';

export default async () => {
  const header = document.querySelector('header');
  if (header) await loadBlock(header);
};
