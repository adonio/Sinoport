import PropTypes from 'prop-types';

import Chip from '@mui/material/Chip';
import { getLocalizedStatusLabel, getStatusColor } from 'data/sinoport-dictionaries';
import useConfig from 'hooks/useConfig';

export default function StatusChip({ label, color }) {
  const { state } = useConfig();

  return <Chip size="small" variant="light" color={getStatusColor(label, color)} label={getLocalizedStatusLabel(label, state.i18n)} />;
}

StatusChip.propTypes = {
  color: PropTypes.string,
  label: PropTypes.string.isRequired
};
