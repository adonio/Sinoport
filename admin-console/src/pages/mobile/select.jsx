import { useNavigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import AppstoreOutlined from '@ant-design/icons/AppstoreOutlined';
import CarOutlined from '@ant-design/icons/CarOutlined';
import ClusterOutlined from '@ant-design/icons/ClusterOutlined';
import DeploymentUnitOutlined from '@ant-design/icons/DeploymentUnitOutlined';
import InboxOutlined from '@ant-design/icons/InboxOutlined';
import ScanOutlined from '@ant-design/icons/ScanOutlined';
import SendOutlined from '@ant-design/icons/SendOutlined';
import ShopOutlined from '@ant-design/icons/ShopOutlined';
import TruckOutlined from '@ant-design/icons/TruckOutlined';
import RightOutlined from '@ant-design/icons/RightOutlined';

import MainCard from 'components/MainCard';
import { useGetMobileSelect } from 'api/station';
import { readMobileSession, writeMobileSession } from 'utils/mobile/session';
import { localizeMobileText, t } from 'utils/mobile/i18n';

const nodeIconMap = {
  pre_warehouse: InboxOutlined,
  headhaul: TruckOutlined,
  outbound_station: ShopOutlined,
  export_ramp: DeploymentUnitOutlined,
  flight_runtime: SendOutlined,
  destination_ramp: ClusterOutlined,
  inbound_station: ScanOutlined,
  tailhaul: CarOutlined,
  delivery: AppstoreOutlined
};

export default function MobileSelectPage() {
  const navigate = useNavigate();
  const session = readMobileSession();
  const language = session?.language || 'zh';
  const { mobileSelectRoleView, mobileSelectNodeOptions, mobileSelectLoading } = useGetMobileSelect(session?.roleKey);
  const roleView = mobileSelectRoleView || {};
  const nodeOptions = (mobileSelectNodeOptions || []).map((item) => ({
    ...item,
    title: localizeMobileText(language, item.title),
    description: localizeMobileText(language, item.description),
    enterLabel: t(language, 'open_node')
  }));
  const recommendedNodeOptions = nodeOptions.filter((item) => item.recommended);
  const inboundCapability = roleView.inboundTabs?.length ? roleView.inboundTabs.join(' / ') : '-';
  const outboundCapability = roleView.outboundTabs?.length ? roleView.outboundTabs.join(' / ') : '-';
  const roleLabel = localizeMobileText(language, roleView.label || session?.roleLabel || session?.role || '');

  const renderNodeCard = (option) => (
    <Grid key={option.key} size={6}>
      <MainCard
        sx={{
          cursor: 'pointer',
          minHeight: 188,
          height: '100%',
          '&:hover': { borderColor: 'primary.main', boxShadow: 2 }
        }}
        onClick={() => {
          writeMobileSession({ ...session, selectedNode: option.key });
          navigate(option.path);
        }}
      >
        <Stack sx={{ gap: 1.5, height: '100%', justifyContent: 'space-between' }}>
          <Stack sx={{ gap: 1.25 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 3,
                  bgcolor: option.recommended ? 'primary.lighter' : 'secondary.lighter',
                  color: option.recommended ? 'primary.main' : 'secondary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28
                }}
              >
                {(() => {
                  const Icon = nodeIconMap[option.key] || AppstoreOutlined;
                  return <Icon />;
                })()}
              </Box>
              {option.recommended ? <Chip label="Recommended" size="small" color="primary" variant="light" /> : null}
            </Stack>

            <div>
              <Typography variant="h5">{option.title}</Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 0.75,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
              >
                {option.description}
              </Typography>
            </div>
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
          <Chip label={`角色 ${roleLabel || '-'}`} size="small" color="secondary" variant="light" />
          <Chip label={`进港能力 ${inboundCapability}`} size="small" variant="outlined" />
          <Chip label={`出港能力 ${outboundCapability}`} size="small" variant="outlined" />
        </Stack>
      </MainCard>

      {mobileSelectLoading && !nodeOptions.length ? (
        <MainCard contentSX={{ p: 2.5 }}>
          <Typography variant="subtitle1">正在加载节点配置</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            正在从后端读取当前角色可用的节点列表和推荐入口。
          </Typography>
        </MainCard>
      ) : null}

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
          {nodeOptions.length ? (
            nodeOptions.map(renderNodeCard)
          ) : (
            <Grid size={12}>
              <Typography variant="body2" color="text.secondary">
                暂无可展示的节点配置。
              </Typography>
            </Grid>
          )}
        </Grid>
      </MainCard>
    </Stack>
  );
}
