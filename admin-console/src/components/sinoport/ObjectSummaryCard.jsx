import PropTypes from 'prop-types';
import { useIntl } from 'react-intl';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import StatusChip from 'components/sinoport/StatusChip';
import { localizeUiText } from 'utils/app-i18n';

export default function ObjectSummaryCard({ eyebrow, title, subtitle, rows = [], status }) {
  const intl = useIntl();
  const locale = intl.locale;

  return (
    <MainCard>
      <Stack sx={{ gap: 1.5 }}>
        {eyebrow ? (
          <Typography variant="overline" color="primary.main">
            {localizeUiText(locale, eyebrow)}
          </Typography>
        ) : null}
        <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2, alignItems: 'flex-start' }}>
          <Stack sx={{ gap: 0.5 }}>
            <Typography variant="h4">{localizeUiText(locale, title)}</Typography>
            {subtitle ? (
              <Typography variant="body2" color="text.secondary">
                {localizeUiText(locale, subtitle)}
              </Typography>
            ) : null}
          </Stack>
          {status ? <StatusChip label={localizeUiText(locale, status)} /> : null}
        </Stack>

        <Stack sx={{ gap: 1 }}>
          {rows.map((row) => (
            <Stack key={row.label} direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {localizeUiText(locale, row.label)}
              </Typography>
              <Typography variant="body2" fontWeight={600} textAlign="right">
                {localizeUiText(locale, row.value)}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </MainCard>
  );
}

ObjectSummaryCard.propTypes = {
  eyebrow: PropTypes.string,
  rows: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired
    })
  ),
  status: PropTypes.string,
  subtitle: PropTypes.string,
  title: PropTypes.string.isRequired
};
