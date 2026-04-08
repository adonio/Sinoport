import PropTypes from 'prop-types';

import Chip from '@mui/material/Chip';
import { getStatusColor } from 'data/sinoport-dictionaries';

export default function StatusChip({ label, color }) {
  return <Chip size="small" variant="light" color={getStatusColor(label, color)} label={label} />;
}

StatusChip.propTypes = {
  color: PropTypes.string,
  label: PropTypes.string.isRequired
};
