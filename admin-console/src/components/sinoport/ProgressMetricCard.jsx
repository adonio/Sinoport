import PropTypes from 'prop-types';

import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';

export default function ProgressMetricCard({ title, value, helper, chip, progress, color = 'primary' }) {
  return (
    <MainCard contentSX={{ p: 2 }}>
      <Stack sx={{ gap: 1 }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {title}
          </Typography>
          {chip ? <Chip label={chip} size="small" color={color} variant="light" /> : null}
        </Stack>
        <Typography variant="h5">{value}</Typography>
        <LinearProgress color={color} variant="determinate" value={progress} />
        {helper ? (
          <Typography variant="caption" color="text.secondary">
            {helper}
          </Typography>
        ) : null}
      </Stack>
    </MainCard>
  );
}

ProgressMetricCard.propTypes = {
  chip: PropTypes.string,
  color: PropTypes.string,
  helper: PropTypes.string,
  progress: PropTypes.number.isRequired,
  title: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired
};
