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
          已接入模块：运行态势中心、货站与资源管理、航线网络与链路配置、规则与指令引擎、主数据与接口治理、货站看板、进港、出港、提单与履约链路、单证与指令中心、作业指令中心、异常中心。
        </Typography>
      </Stack>
    </MainCard>
  );
}
