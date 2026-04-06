import PropTypes from 'prop-types';
// assets
import Dot from 'components/@extended/Dot';

// ==============================|| AVATAR STATUS ICONS ||============================== //

export default function AvatarStatus({ status }) {
  const colorMap = {
    available: 'success',
    do_not_disturb: 'error',
    offline: 'warning'
  };

  const color = colorMap[status];
  if (!color) return null;

  return <Dot {...{ size: 8, color, sx: { border: '1px solid', borderColor: 'background.paper' } }} />;
}

AvatarStatus.propTypes = { status: PropTypes.string };
