import PropTypes from 'prop-types';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';

export default function MetricCard({ title, value, helper, chip, color = 'primary' }) {
  return (
    <MainCard contentSX={{ p: 2.5 }}>
      <Stack sx={{ gap: 1.5 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>
          {chip ? <Chip label={chip} size="small" color={color} variant="light" /> : null}
        </Stack>
        <Typography variant="h3">{value}</Typography>
        {helper ? (
          <Typography variant="body2" color="text.secondary">
            {helper}
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
