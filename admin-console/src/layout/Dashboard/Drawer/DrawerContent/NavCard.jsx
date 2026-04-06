import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';

export default function NavCard() {
  return (
    <MainCard sx={{ bgcolor: 'grey.50', m: 3 }}>
      <Stack sx={{ gap: 1.5 }}>
        <Typography variant="h5">实施基线</Typography>
        <Typography variant="body2" color="text.secondary">
          当前后台基于 Mantis 的 dashboard shell 实现，所有页面统一使用它的 drawer、header、card、form 和 table 体系。
        </Typography>
        <Divider />
        <Typography variant="caption" color="text.secondary">
          已接入模块：平台总览、货站管理、航线网络、规则中心、审计中心、货站看板、进港、出港、文件中心、异常中心。
        </Typography>
      </Stack>
    </MainCard>
  );
}
