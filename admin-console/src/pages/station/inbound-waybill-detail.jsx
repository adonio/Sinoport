import { useState } from 'react';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link as RouterLink, useParams } from 'react-router-dom';

import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { inboundWaybillRows } from 'data/sinoport';
import { useLocalStorage } from 'hooks/useLocalStorage';

const OFFICE_AWB_INBOUND_KEY = 'sinoport-station-awb-office-inbound-v1';

export default function StationInboundWaybillDetailPage() {
  const { awb } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const { state: officeState, setState: setOfficeState } = useLocalStorage(OFFICE_AWB_INBOUND_KEY, {});
  const detail = inboundWaybillRows.find((item) => item.awb === awb);

  if (!detail) {
    return (
      <Grid container rowSpacing={3} columnSpacing={3}>
        <Grid size={12}>
          <PageHeader
            eyebrow="Inbound / Waybills / Detail"
            title="未找到提单"
            description={`未找到提单 ${awb || ''}，请返回提单列表重新选择。`}
            action={
              <Button component={RouterLink} to="/station/inbound/waybills" variant="contained">
                返回提单列表
              </Button>
            }
          />
        </Grid>
      </Grid>
    );
  }

  const office = officeState[detail.awb] || {
    planStatus: '待排计划',
    dispatchStatus: '未下发',
    reviewStatus: '待复核',
    note: '办公室尚未补充该票的理货 / NOA / POD 办公动作。'
  };

  const updateOffice = (patch) =>
    setOfficeState((prev) => ({
      ...prev,
      [detail.awb]: {
        ...office,
        ...patch
      }
    }));

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="进港 / 提单 / 详情"
          title={`提单详情 / ${detail.awb}`}
          description="后台围绕单票货管理理货计划、NOA/POD 办公动作和 PDA 下发状态。"
          chips={[detail.flightNo, detail.consignee, detail.currentNode]}
          action={
            <Stack direction="row" sx={{ gap: 1 }}>
              <Button component={RouterLink} to={`/station/shipments/${encodeURIComponent(`in-${detail.awb}`)}`} variant="outlined">
                履约链路
              </Button>
              <Button component={RouterLink} to="/station/inbound/waybills" variant="outlined">
                返回提单列表
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="当前节点" value={detail.currentNode} helper={detail.flightNo} chip="AWB" color="primary" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="NOA" value={detail.noaStatus} helper="通知动作" chip="NOA" color="warning" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="POD" value={detail.podStatus} helper="签收文件" chip="POD" color="error" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="办公室状态" value={office.planStatus} helper={office.dispatchStatus} chip="Office" color="secondary" />
      </Grid>

      <Grid size={12}>
        <MainCard title="详情视图" contentSX={{ p: 0 }}>
          <Tabs value={activeTab} onChange={(_, nextTab) => setActiveTab(nextTab)} variant="scrollable" scrollButtons="auto" sx={{ px: 2.5, pt: 1 }}>
            <Tab label="概览" value="overview" />
            <Tab label="办公室动作" value="office" />
          </Tabs>
          <Divider />
          <Box sx={{ p: 2.5 }}>
            {activeTab === 'overview' ? (
              <Grid container rowSpacing={3} columnSpacing={3}>
                <Grid size={{ xs: 12, lg: 5 }}>
                  <MainCard title="提单基础信息">
                    <Stack sx={{ gap: 2 }}>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                        <Typography color="text.secondary">AWB</Typography>
                        <Typography fontWeight={600}>{detail.awb}</Typography>
                      </Stack>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                        <Typography color="text.secondary">航班</Typography>
                        <Typography fontWeight={600}>{detail.flightNo}</Typography>
                      </Stack>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                        <Typography color="text.secondary">收货方</Typography>
                        <Typography fontWeight={600}>{detail.consignee}</Typography>
                      </Stack>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                        <Typography color="text.secondary">件数</Typography>
                        <Typography fontWeight={600}>{detail.pieces}</Typography>
                      </Stack>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                        <Typography color="text.secondary">重量</Typography>
                        <Typography fontWeight={600}>{detail.weight}</Typography>
                      </Stack>
                    </Stack>
                  </MainCard>
                </Grid>
                <Grid size={{ xs: 12, lg: 7 }}>
                  <MainCard title="办公室应补动作">
                    <Stack sx={{ gap: 1.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        这票货的办公室动作应先完成：理货计划确认、NOA 节点准备、POD 归档要求和 PDA 下发。
                      </Typography>
                      <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                        <StatusChip label={office.planStatus} color={office.planStatus === '已排计划' ? 'success' : 'warning'} />
                        <StatusChip label={office.dispatchStatus} color={office.dispatchStatus === '已下发 PDA' ? 'success' : 'secondary'} />
                        <StatusChip label={office.reviewStatus} color={office.reviewStatus === '已复核' ? 'success' : 'info'} />
                      </Stack>
                    </Stack>
                  </MainCard>
                </Grid>
              </Grid>
            ) : null}

            {activeTab === 'office' ? (
              <MainCard title="办公室动作">
                <Stack sx={{ gap: 1.5 }}>
                  <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
                    <Button variant="outlined" onClick={() => updateOffice({ planStatus: '已排计划' })}>
                      标记已排计划
                    </Button>
                    <Button variant="outlined" onClick={() => updateOffice({ dispatchStatus: '已下发 PDA' })}>
                      下发到 PDA
                    </Button>
                    <Button variant="outlined" onClick={() => updateOffice({ reviewStatus: '已复核' })}>
                      完成复核
                    </Button>
                    <Button variant="outlined" color="warning" onClick={() => updateOffice({ planStatus: '已撤回', dispatchStatus: '未下发' })}>
                      撤回
                    </Button>
                  </Stack>
                  <TextField
                    multiline
                    minRows={4}
                    label="办公室备注"
                    value={office.note}
                    onChange={(event) => updateOffice({ note: event.target.value })}
                  />
                </Stack>
              </MainCard>
            ) : null}
          </Box>
        </MainCard>
      </Grid>
    </Grid>
  );
}
