import PropTypes from 'prop-types';

import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export default function LifecycleStepList({ steps }) {
  return (
    <Stack sx={{ gap: 1.5 }}>
      {steps.map((step) => (
        <Stack key={`${step.label}-${step.progress}`} sx={{ gap: 0.75 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="subtitle2">{step.label}</Typography>
            <Typography variant="caption" color="text.secondary">
              {step.metric || `${step.progress}%`}
            </Typography>
          </Stack>
          <LinearProgress variant="determinate" value={step.progress} />
          <Typography variant="caption" color="text.secondary">
            {step.note}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

LifecycleStepList.propTypes = {
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      metric: PropTypes.string,
      note: PropTypes.string.isRequired,
      progress: PropTypes.number.isRequired
    })
  ).isRequired
};
