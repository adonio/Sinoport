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
import { outboundWaybillRows } from 'data/sinoport';
import { useLocalStorage } from 'hooks/useLocalStorage';

const OFFICE_AWB_OUTBOUND_KEY = 'sinoport-station-awb-office-outbound-v1';

export default function StationOutboundWaybillDetailPage() {
  const { awb } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const { state: officeState, setState: setOfficeState } = useLocalStorage(OFFICE_AWB_OUTBOUND_KEY, {});
  const detail = outboundWaybillRows.find((item) => item.awb === awb);

  if (!detail) {
    return (
      <Grid container rowSpacing={3} columnSpacing={3}>
        <Grid size={12}>
          <PageHeader
            eyebrow="Outbound / Waybills / Detail"
            title="未找到提单"
            description={`未找到提单 ${awb || ''}，请返回提单列表重新选择。`}
            action={
              <Button component={RouterLink} to="/station/outbound/waybills" variant="contained">
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
    note: '办公室尚未补充该票的收货 / 主单 / 装载 / Manifest 办公动作。'
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
          eyebrow="出港 / 提单 / 详情"
          title={`提单详情 / ${detail.awb}`}
          description="后台围绕单票货管理收货、主单、装载、Manifest 和 PDA 下发状态。"
          chips={[detail.flightNo, detail.destination, detail.loading]}
          action={
            <Stack direction="row" sx={{ gap: 1 }}>
              <Button component={RouterLink} to={`/station/shipments/${encodeURIComponent(`out-${detail.awb}`)}`} variant="outlined">
                履约链路
              </Button>
              <Button component={RouterLink} to="/station/outbound/waybills" variant="outlined">
                返回提单列表
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="预报" value={detail.forecast} helper={detail.flightNo} chip="FFM" color="primary" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="收货" value={detail.receipt} helper={detail.destination} chip="Receipt" color="warning" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="装载" value={detail.loading} helper={detail.manifest} chip="Loading" color="secondary" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="办公室状态" value={office.planStatus} helper={office.dispatchStatus} chip="Office" color="success" />
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
                        <Typography color="text.secondary">目的站</Typography>
                        <Typography fontWeight={600}>{detail.destination}</Typography>
                      </Stack>
                      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
                        <Typography color="text.secondary">主单</Typography>
                        <Typography fontWeight={600}>{detail.master}</Typography>
                      </Stack>
                    </Stack>
                  </MainCard>
                </Grid>
                <Grid size={{ xs: 12, lg: 7 }}>
                  <MainCard title="办公室应补动作">
                    <Stack sx={{ gap: 1.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        这票货的办公室动作应先完成：收货窗口确认、主单套打、ULD/机位绑定和 Manifest 对账，再下发给 PDA 执行。
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
