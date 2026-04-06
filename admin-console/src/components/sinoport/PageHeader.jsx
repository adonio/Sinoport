import PropTypes from 'prop-types';

import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export default function PageHeader({ eyebrow, title, description, chips = [], action = null }) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      sx={{ alignItems: { xs: 'flex-start', md: 'flex-start' }, justifyContent: 'space-between', gap: 2.5, mb: 3 }}
    >
      <Stack sx={{ gap: 1.25, maxWidth: 900 }}>
        {eyebrow ? (
          <Typography variant="overline" color="primary.main">
            {eyebrow}
          </Typography>
        ) : null}
        <Typography variant="h3">{title}</Typography>
        <Typography variant="body1" color="text.secondary">
          {description}
        </Typography>
        {chips.length ? (
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            {chips.map((chip) => (
              <Chip key={chip} label={chip} size="small" variant="light" color="secondary" />
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
  description: PropTypes.string.isRequired,
  eyebrow: PropTypes.string,
  title: PropTypes.string.isRequired
};
