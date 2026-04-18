import PropTypes from 'prop-types';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useIntl } from 'react-intl';

import { formatLocalizedMessage } from 'utils/app-i18n';
import { localizeMobileText } from 'utils/mobile/i18n';

export default function TaskBlockerNotice({ blockers }) {
  const intl = useIntl();
  const locale = intl.locale;
  if (!blockers.length) return null;

  return (
    <Alert severity="warning" variant="outlined">
      <Stack sx={{ gap: 0.5 }}>
        <Typography variant="subtitle2">{formatLocalizedMessage(intl, '当前阻断')}</Typography>
        {blockers.map((blocker) => (
          <Typography key={blocker} variant="body2">
            {localizeMobileText(locale, blocker)}
          </Typography>
        ))}
      </Stack>
    </Alert>
  );
}

TaskBlockerNotice.propTypes = {
  blockers: PropTypes.arrayOf(PropTypes.string)
};
