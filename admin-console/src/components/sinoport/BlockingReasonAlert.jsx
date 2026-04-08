import PropTypes from 'prop-types';

import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export default function BlockingReasonAlert({ title = '当前阻断', reasons = [] }) {
  if (!reasons.length) return null;

  return (
    <Alert severity="warning" variant="outlined">
      <Stack sx={{ gap: 0.75 }}>
        <Typography variant="subtitle2">{title}</Typography>
        {reasons.map((reason) => (
          <Typography key={reason} variant="body2">
            {reason}
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
