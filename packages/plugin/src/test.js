import { match, pathToRegexp } from 'path-to-regexp';
import path from 'path';

const matchPath = match('/testapi/get');
const matchFlag = matchPath('/testapi/get?a=1&b=2');

const pathToRegexpFlag = pathToRegexp('/testapi/get').test('/testapi/get?a=1&b=2');

console.log('---1--\n matchFlag', matchFlag, '---\n');
console.log('---2--\n pathToRegexpFlag', pathToRegexpFlag, '---\n');
const projectRoot = process.cwd().replace(/\\/g, '/');
console.log('---3--\n ', process.cwd(), '--\n--', path.resolve(process.cwd(), 'c'), '---\n');
console.log('---4--\n ', path.posix.resolve(projectRoot, 'c/b'), '$$', projectRoot, '---\n');
console.log('---5--\n ', import.meta.url, '---\n');
console.log(
  '---6--\n ',
  path.join(path.resolve(process.cwd(), 'mock'), '**\/*.{js,ts,cjs,mjs}'),
  '---\n'
);
