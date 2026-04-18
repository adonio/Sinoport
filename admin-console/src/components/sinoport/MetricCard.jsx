import PropTypes from 'prop-types';
import { useIntl } from 'react-intl';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

export default function MetricCard({ title, value, helper, chip, color = 'primary' }) {
  const intl = useIntl();
  const locale = intl.locale;

  return (
    <MainCard contentSX={{ p: 2.5 }}>
      <Stack sx={{ gap: 1.5 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {formatLocalizedMessage(intl, title)}
          </Typography>
          {chip ? <Chip label={formatLocalizedMessage(intl, chip)} size="small" color={color} variant="light" /> : null}
        </Stack>
        <Typography variant="h3">{localizeUiText(locale, value)}</Typography>
        {helper ? (
          <Typography variant="body2" color="text.secondary">
            {formatLocalizedMessage(intl, helper)}
          </Typography>
        ) : null}
      </Stack>
    </MainCard>
  );
}

MetricCard.propTypes = {
  chip: PropTypes.string,
  color: PropTypes.string,
  helper: PropTypes.string,
  title: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired
};
