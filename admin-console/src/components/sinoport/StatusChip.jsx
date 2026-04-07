import PropTypes from 'prop-types';

import Chip from '@mui/material/Chip';

const colorMap = {
  已上线: 'success',
  样板优先: 'primary',
  强控制: 'primary',
  协同控制: 'secondary',
  接口可视: 'warning',
  运行中: 'success',
  待处理: 'warning',
  未开始: 'default',
  点货中: 'secondary',
  理货完成: 'success',
  暂时挂起: 'warning',
  计划: 'secondary',
  装车中: 'warning',
  已完成: 'success',
  待装车: 'warning',
  已装车: 'success',
  高优先级: 'error',
  稳定: 'success',
  警戒: 'warning',
  阻塞: 'error'
};

export default function StatusChip({ label, color }) {
  return <Chip size="small" variant="light" color={color || colorMap[label] || 'default'} label={label} />;
}

StatusChip.propTypes = {
  color: PropTypes.string,
  label: PropTypes.string.isRequired
};
