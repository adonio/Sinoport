import { matchPath } from 'react-router-dom';

export function isActiveMenuItem(item, pathname) {
  if (!item || !pathname) return false;

  if (item.url && matchPath({ path: item.url, end: item.matchPrefix ? false : true }, pathname)) {
    return true;
  }

  if (item.link && matchPath({ path: item.link, end: false }, pathname)) {
    return true;
  }

  return false;
}

export function matchesMenuTree(menu, pathname) {
  if (isActiveMenuItem(menu, pathname)) return true;
  return menu.children?.some((child) => matchesMenuTree(child, pathname)) || false;
}
