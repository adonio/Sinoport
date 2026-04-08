import PropTypes from 'prop-types';

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

export default function TaskActionBar({ actions }) {
  return (
    <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
      {actions.map((action) => (
        <Button
          key={action.label}
          size="small"
          variant={action.variant || 'outlined'}
          color={action.color || 'primary'}
          disabled={action.disabled}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      ))}
    </Stack>
  );
}

TaskActionBar.propTypes = {
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      color: PropTypes.string,
      disabled: PropTypes.bool,
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func,
      variant: PropTypes.string
    })
  ).isRequired
};
