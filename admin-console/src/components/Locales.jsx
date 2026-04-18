import PropTypes from 'prop-types';
import { useEffect, useState, useMemo } from 'react';

// third-party
import { IntlProvider } from 'react-intl';

// project imports
import useConfig from 'hooks/useConfig';
import { normalizeAppLanguage } from 'utils/app-i18n';

// load locales files
const loadLocaleData = (locale) => {
  switch (locale) {
    case 'zh':
      return import('utils/locales/zh.json');
    case 'en':
    default:
      return import('utils/locales/en.json');
  }
};

// ==============================|| LOCALIZATION ||============================== //

function handleIntlError(error) {
  // Ignore missing translation noise so one missing key doesn't break navigation rendering.
  if (error && (error.code === 'MISSING_TRANSLATION' || String(error.message || '').includes('Missing message'))) {
    return;
  }

  if (console && typeof console.error === 'function') {
    console.error(error);
  }
}

export default function Locales({ children }) {
  const { state } = useConfig();
  const locale = normalizeAppLanguage(state.i18n);

  const [messages, setMessages] = useState();
  const localeDataPromise = useMemo(() => loadLocaleData(locale), [locale]);

  useEffect(() => {
    localeDataPromise.then((d) => {
      setMessages(d.default);
    });
  }, [localeDataPromise]);

  return (
    <>
      {messages && (
        <IntlProvider locale={locale} defaultLocale="zh" messages={messages} onError={handleIntlError}>
          {children}
        </IntlProvider>
      )}
    </>
  );
}

Locales.propTypes = { children: PropTypes.node };
