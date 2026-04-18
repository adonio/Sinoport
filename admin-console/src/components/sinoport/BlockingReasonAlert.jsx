import PropTypes from 'prop-types';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useIntl } from 'react-intl';

import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

export default function BlockingReasonAlert({ title = '当前阻断', reasons = [] }) {
  const intl = useIntl();
  const locale = intl.locale;
  if (!reasons.length) return null;

  return (
    <Alert severity="warning" variant="outlined">
      <Stack sx={{ gap: 0.75 }}>
        <Typography variant="subtitle2">{formatLocalizedMessage(intl, title)}</Typography>
        {reasons.map((reason) => (
          <Typography key={reason} variant="body2">
            {localizeUiText(locale, reason)}
          </Typography>
        ))}
      </Stack>
    </Alert>
  );
}

BlockingReasonAlert.propTypes = {
  reasons: PropTypes.arrayOf(PropTypes.string),
  title: PropTypes.string
};
