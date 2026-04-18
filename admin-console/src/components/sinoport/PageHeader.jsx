import PropTypes from 'prop-types';
import { useIntl } from 'react-intl';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { formatLocalizedMessage } from 'utils/app-i18n';

export default function PageHeader({ eyebrow, title, description, chips = [], action = null }) {
  const intl = useIntl();

  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      sx={{ alignItems: { xs: 'flex-start', md: 'flex-start' }, justifyContent: 'space-between', gap: 2.5, mb: 3 }}
    >
      <Stack sx={{ gap: 1.25, maxWidth: 900 }}>
        {eyebrow ? (
          <Typography variant="overline" color="primary.main">
            {formatLocalizedMessage(intl, eyebrow)}
          </Typography>
        ) : null}
        <Typography variant="h3">{formatLocalizedMessage(intl, title)}</Typography>
        <Typography variant="body1" color="text.secondary">
          {formatLocalizedMessage(intl, description)}
        </Typography>
        {chips.length ? (
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            {chips.map((chip) => (
              <Chip key={chip} label={formatLocalizedMessage(intl, chip)} size="small" variant="light" color="secondary" />
            ))}
          </Stack>
        ) : null}
      </Stack>
      {action}
    </Stack>
  );
}

PageHeader.propTypes = {
  action: PropTypes.node,
  chips: PropTypes.arrayOf(PropTypes.string),
  description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  eyebrow: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node])
};
