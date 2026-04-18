import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useIntl } from 'react-intl';

import { formatLocalizedMessage } from 'utils/app-i18n';
import { localizeMobileText } from 'utils/mobile/i18n';

export default function TaskEvidenceSection({ evidence }) {
  const intl = useIntl();
  const locale = intl.locale;
  return (
    <Box sx={{ borderRadius: 2, bgcolor: 'grey.50', p: 1.25 }}>
      <Stack sx={{ gap: 0.5 }}>
        <Typography variant="subtitle2">{formatLocalizedMessage(intl, '必传证据')}</Typography>
        {evidence.map((item) => (
          <Typography key={item} variant="body2" color="text.secondary">
            {localizeMobileText(locale, item)}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
}

TaskEvidenceSection.propTypes = {
  evidence: PropTypes.arrayOf(PropTypes.string).isRequired
};
