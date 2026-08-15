import { matchPath } from 'react-router-dom';

function matchesConfiguredPath(config, pathname) {
  if (!config) return false;

  if (typeof config === 'string') {
    return Boolean(matchPath({ path: config, end: true }, pathname));
  }

  if (typeof config === 'object' && config.path) {
    return Boolean(matchPath({ path: config.path, end: config.end ?? true }, pathname));
  }

  return false;
}

export function isActiveMenuItem(item, pathname) {
  if (!item || !pathname) return false;

  if (item.inactivePaths?.some((config) => matchesConfiguredPath(config, pathname))) {
    return false;
  }

  if (item.url && matchPath({ path: item.url, end: item.matchPrefix ? false : true }, pathname)) {
    return true;
  }

  if (item.link && matchPath({ path: item.link, end: false }, pathname)) {
    return true;
  }

  if (item.activePaths?.some((config) => matchesConfiguredPath(config, pathname))) {
    return true;
  }

  return false;
}

export function matchesMenuTree(menu, pathname) {
  if (isActiveMenuItem(menu, pathname)) return true;
  return menu.children?.some((child) => matchesMenuTree(child, pathname)) || false;
}
