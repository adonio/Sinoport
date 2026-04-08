import PropTypes from 'prop-types';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import StatusChip from 'components/sinoport/StatusChip';

export default function ObjectSummaryCard({ eyebrow, title, subtitle, rows = [], status }) {
  return (
    <MainCard>
      <Stack sx={{ gap: 1.5 }}>
        {eyebrow ? (
          <Typography variant="overline" color="primary.main">
            {eyebrow}
          </Typography>
        ) : null}
        <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2, alignItems: 'flex-start' }}>
          <Stack sx={{ gap: 0.5 }}>
            <Typography variant="h4">{title}</Typography>
            {subtitle ? (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            ) : null}
          </Stack>
          {status ? <StatusChip label={status} /> : null}
        </Stack>

        <Stack sx={{ gap: 1 }}>
          {rows.map((row) => (
            <Stack key={row.label} direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {row.label}
              </Typography>
              <Typography variant="body2" fontWeight={600} textAlign="right">
                {row.value}
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
