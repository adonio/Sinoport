import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import RightOutlined from '@ant-design/icons/RightOutlined';

import MainCard from 'components/MainCard';
import { getMobileRoleView, mobileNodeOptions } from 'data/sinoport-adapters';
import { readMobileSession, writeMobileSession } from 'utils/mobile/session';
import { localizeMobileText, t } from 'utils/mobile/i18n';

const nodeFlowMap = {
  pre_warehouse: 'preWarehouse',
  headhaul: 'headhaul',
  outbound_station: 'exportRamp',
  export_ramp: 'exportRamp',
  flight_runtime: 'runtime',
  destination_ramp: 'destinationRamp',
  inbound_station: 'destinationRamp',
  tailhaul: 'tailhaul',
  delivery: 'delivery'
};

export default function MobileSelectPage() {
  const navigate = useNavigate();
  const session = readMobileSession();
  const language = session?.language || 'zh';
  const roleView = getMobileRoleView(session?.roleKey);
  const nodeOptions = mobileNodeOptions.map((item) => ({
    ...item,
    title: localizeMobileText(language, item.title),
    description: localizeMobileText(language, item.description),
    enterLabel: t(language, 'open_node'),
    recommended: roleView.flowKeys.includes(nodeFlowMap[item.key] || item.key)
  }));
  const recommendedNodeOptions = nodeOptions.filter((item) => item.recommended);
  const otherNodeOptions = nodeOptions.filter((item) => !item.recommended);
  const inboundCapability = roleView.inboundTabs.length ? roleView.inboundTabs.join(' / ') : '-';
  const outboundCapability = roleView.outboundTabs.length ? roleView.outboundTabs.join(' / ') : '-';

  const renderNodeCard = (option) => (
    <Grid key={option.key} size={12}>
      <MainCard
        sx={{ cursor: 'pointer', '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}
        onClick={() => {
          writeMobileSession({ ...session, selectedNode: option.key });
          navigate(option.path);
        }}
      >
        <Stack sx={{ gap: 2 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5 }}>
            <div>
              <Typography variant="h5">{option.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {option.description}
              </Typography>
            </div>
            {option.recommended ? <Chip label="Recommended" size="small" color="primary" variant="light" /> : null}
          </Stack>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2" color="primary.main">
              {option.enterLabel}
            </Typography>
            <Box sx={{ color: 'primary.main', display: 'flex', alignItems: 'center' }}>
              <RightOutlined />
            </Box>
          </Stack>
        </Stack>
      </MainCard>
    </Grid>
  );

  return (
    <Stack sx={{ gap: 2.5 }}>
      <MainCard contentSX={{ p: 2.5 }}>
        <Typography variant="overline" color="primary.main">
          {t(language, 'login_success')}
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.5 }}>
          {t(language, 'select_node_title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {session?.station} · {session?.operator}
        </Typography>
        <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mt: 2 }}>
          <Chip label={`角色 ${localizeMobileText(language, roleView.label)}`} size="small" color="secondary" variant="light" />
          <Chip label={`进港能力 ${inboundCapability}`} size="small" variant="outlined" />
          <Chip label={`出港能力 ${outboundCapability}`} size="small" variant="outlined" />
        </Stack>
      </MainCard>

      {recommendedNodeOptions.length ? (
        <MainCard contentSX={{ p: 2.5 }}>
          <Typography variant="subtitle1">当前角色推荐节点</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 2 }}>
            按当前角色能力优先显示建议进入的节点，帮助现场人员更快找到自己的任务入口。
          </Typography>
          <Grid container spacing={2}>
            {recommendedNodeOptions.map(renderNodeCard)}
          </Grid>
        </MainCard>
      ) : null}

      <MainCard contentSX={{ p: 2.5 }}>
        <Typography variant="subtitle1">全部执行节点</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          如果需要跨节点查看任务或支援其它岗位，也可以从全部节点中进入。
        </Typography>
        <Divider sx={{ my: 2 }} />
        <Grid container spacing={2}>
          {otherNodeOptions.map(renderNodeCard)}
        </Grid>
      </MainCard>
    </Stack>
  );
}
