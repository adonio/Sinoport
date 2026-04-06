// ==============================|| THEME CONSTANT ||============================== //

export const twitterColor = '#1DA1F2';
export const facebookColor = '#3b5998';
export const linkedInColor = '#0e76a8';

export const APP_DEFAULT_PATH = '/dashboard/platform-overview';
export const HORIZONTAL_MAX_ITEM = 7;
export const DRAWER_WIDTH = 260;
export const MINI_DRAWER_WIDTH = 60;

export const CSS_VAR_PREFIX = '';

export let SimpleLayoutType;

(function (SimpleLayoutType) {
  SimpleLayoutType['SIMPLE'] = 'simple';
  SimpleLayoutType['LANDING'] = 'landing';
})(SimpleLayoutType || (SimpleLayoutType = {}));

export let ThemeMode;

(function (ThemeMode) {
  ThemeMode['LIGHT'] = 'light';
  ThemeMode['DARK'] = 'dark';
  ThemeMode['SYSTEM'] = 'system';
})(ThemeMode || (ThemeMode = {}));

export let MenuOrientation;

(function (MenuOrientation) {
  MenuOrientation['VERTICAL'] = 'vertical';
  MenuOrientation['HORIZONTAL'] = 'horizontal';
  MenuOrientation['MINI_VERTICAL'] = 'mini-vertical';
})(MenuOrientation || (MenuOrientation = {}));

export let ThemeDirection;

(function (ThemeDirection) {
  ThemeDirection['LTR'] = 'ltr';
  ThemeDirection['RTL'] = 'rtl';
})(ThemeDirection || (ThemeDirection = {}));

export let NavActionType;

(function (NavActionType) {
  NavActionType['FUNCTION'] = 'function';
  NavActionType['LINK'] = 'link';
})(NavActionType || (NavActionType = {}));

export let Gender;

(function (Gender) {
  Gender['MALE'] = 'Male';
  Gender['FEMALE'] = 'Female';
})(Gender || (Gender = {}));

export let DropzoneType;

(function (DropzoneType) {
  DropzoneType['DEFAULT'] = 'default';
  DropzoneType['STANDARD'] = 'standard';
})(DropzoneType || (DropzoneType = {}));

export let AuthProvider;

(function (AuthProvider) {
  AuthProvider['JWT'] = 'jwt';
  AuthProvider['FIREBASE'] = 'firebase';
  AuthProvider['AUTH0'] = 'auth0';
  AuthProvider['AWS'] = 'aws';
  AuthProvider['SUPABASE'] = 'supabase';
})(AuthProvider || (AuthProvider = {}));

export const APP_AUTH = AuthProvider.JWT;
export const DEFAULT_THEME_MODE = ThemeMode.SYSTEM;

// ==============================|| THEME CONFIG ||============================== //

const config = {
  fontFamily: `'Public Sans', sans-serif`,
  i18n: 'zh',
  menuOrientation: MenuOrientation.VERTICAL,
  container: true,
  presetColor: 'default',
  themeDirection: ThemeDirection.LTR
};

export default config;
