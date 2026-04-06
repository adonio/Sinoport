import PropTypes from 'prop-types';
import { useEffect, useState, useMemo } from 'react';

// third-party
import { IntlProvider } from 'react-intl';

// project imports
import useConfig from 'hooks/useConfig';

// load locales files
const loadLocaleData = (locale) => {
  switch (locale) {
    case 'fr':
      return import('utils/locales/fr.json');
    case 'ro':
      return import('utils/locales/ro.json');
    case 'zh':
      return import('utils/locales/zh.json');
    case 'en':
    default:
      return import('utils/locales/en.json');
  }
};

// ==============================|| LOCALIZATION ||============================== //

export default function Locales({ children }) {
  const { state } = useConfig();

  const [messages, setMessages] = useState();
  const localeDataPromise = useMemo(() => loadLocaleData(state.i18n), [state.i18n]);

  useEffect(() => {
    localeDataPromise.then((d) => {
      setMessages(d.default);
    });
  }, [localeDataPromise]);

  return (
    <>
      {messages && (
        <IntlProvider locale={state.i18n} defaultLocale="en" messages={messages}>
          {children}
        </IntlProvider>
      )}
    </>
  );
}

Locales.propTypes = { children: PropTypes.node };
