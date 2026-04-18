import PropTypes from 'prop-types';
import { useIntl } from 'react-intl';

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

import { localizeMobileText } from 'utils/mobile/i18n';

export default function TaskActionBar({ actions }) {
  const intl = useIntl();
  const locale = intl.locale;

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
          {localizeMobileText(locale, action.label)}
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
