import PropTypes from 'prop-types';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export default function TaskEvidenceSection({ evidence }) {
  return (
    <Box sx={{ borderRadius: 2, bgcolor: 'grey.50', p: 1.25 }}>
      <Stack sx={{ gap: 0.5 }}>
        <Typography variant="subtitle2">必传证据</Typography>
        {evidence.map((item) => (
          <Typography key={item} variant="body2" color="text.secondary">
            {item}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
}

TaskEvidenceSection.propTypes = {
  evidence: PropTypes.arrayOf(PropTypes.string).isRequired
};
