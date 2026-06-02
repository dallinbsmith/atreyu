import { loadBlock } from './ak.js';
import { runBehaviors } from './behaviors.js';

export default async () => {
  runBehaviors('lazy');
  const header = document.querySelector('header');
  if (header) await loadBlock(header);
};
