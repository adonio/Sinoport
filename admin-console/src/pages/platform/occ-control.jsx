import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import ControlPlanCreateDialog from 'components/sinoport/ControlPlanCreateDialog';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { useV14Collection, useV14Resource, v14Endpoints, v14Post } from 'api/v14';
import { localizeUiText } from 'utils/app-i18n';

function time(value) {
  if (!value) return '--';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString([], { hour12: false });
}

function CountCard({ title, value, note }) {
  return (
    <MainCard>
      <Typography variant="overline" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h2" sx={{ mt: 0.5 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {note}
      </Typography>
    </MainCard>
  );
}

export default function OccControlPage() {
  const intl = useIntl();
  const l = (value) => localizeUiText(intl.locale, value);
  const plans = useV14Collection(v14Endpoints.controlPlans, { refreshInterval: 30000 });
  const jobs = useV14Collection(v14Endpoints.jobs, { refreshInterval: 30000 });
  const borders = useV14Collection(v14Endpoints.borders, { refreshInterval: 30000 });
  const tas = useV14Collection(v14Endpoints.tasReceipts, { refreshInterval: 30000 });
  const integration = useV14Resource(v14Endpoints.integrationStatus, { refreshInterval: 15000 });
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [action, setAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    if (!selectedPlanId && plans.items.length) setSelectedPlanId(plans.items[0].operation_control_plan_id);
  }, [plans.items, selectedPlanId]);

  const milestones = useV14Resource(selectedPlanId ? v14Endpoints.milestones(selectedPlanId) : null);
  const summary = useV14Resource(selectedPlanId ? v14Endpoints.managementSummary(selectedPlanId) : null);
  const selectedPlan = plans.items.find((item) => item.operation_control_plan_id === selectedPlanId);
  const integrationCounts = useMemo(
    () => Object.fromEntries((integration.data?.outbox || []).map((row) => [row.status, Number(row.count)])),
    [integration.data]
  );

  async function integrationAction(path, body) {
    setBusy(true);
    setAction(null);
    try {
      const result = await v14Post(path, body);
      setAction({ severity: 'success', text: JSON.stringify(result.data || result) });
      await integration.mutate();
    } catch (error) {
      setAction({ severity: 'error', text: error?.response?.data?.error?.message || error.message });
    } finally {
      setBusy(false);
    }
  }

  async function publishSelectedPlan() {
    if (!selectedPlan?.operation_control_plan_id || !selectedPlan?.active_plan_version_id) return;
    setBusy(true);
    setAction(null);
    try {
      const result = await v14Post(
        v14Endpoints.publishControlPlanVersion(selectedPlan.operation_control_plan_id, selectedPlan.active_plan_version_id),
        {}
      );
      setAction({
        severity: 'success',
        text: `${l('运行计划已发布')} · ${selectedPlan.flight_no} · ${result.data?.result || result.result || 'ACTIVE'}`
      });
      await Promise.all([plans.mutate(), milestones.mutate(), summary.mutate()]);
    } catch (error) {
      setAction({ severity: 'error', text: error?.response?.data?.error?.message || error.message });
    } finally {
      setBusy(false);
    }
  }

  async function handlePlanCreated(result) {
    setCreateDialogOpen(false);
    setSelectedPlanId(result.planId);
    setAction({
      severity: 'success',
      text: `${l('运行计划草稿已创建')} · ${result.flightNo || result.flightId} · ${result.milestoneCount || 0} ${l('个里程碑')} · ${result.approvalStatus || 'PENDING_APPROVAL'}`
    });
    await plans.mutate();
  }

  const loading = plans.isLoading || jobs.isLoading || borders.isLoading || tas.isLoading;
  const error = plans.error || jobs.error || borders.error || tas.error || integration.error;
  const milestoneItems = milestones.data?.items || milestones.data?.milestones || [];
  const managementItems = summary.data?.items || summary.data?.milestones || [];

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="OCC v1.4"
          title={l('跨境空运运行控制塔')}
          description={l('以底层作业事实聚合前置仓、国内卡车、双边口岸、TAS 接收和航班节点；颜色不可手工覆盖，待审批基线不进入正式 SLA。')}
          chips={['双 ETD 时钟', 'A1-A3 / B1-B2 / OBI', 'Maker-Checker', 'Skyledger 双向同步'].map(l)}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button disabled={busy} variant="contained" onClick={() => setCreateDialogOpen(true)}>
                {l('新建运行计划')}
              </Button>
              <Button
                disabled={busy}
                variant="outlined"
                onClick={() => integrationAction('/api/v1/platform/integrations/skyledger/dispatch', { limit: 100 })}
              >
                {l('派送事件')}
              </Button>
              <Button
                disabled={busy}
                variant="outlined"
                onClick={() => integrationAction('/api/v1/platform/integrations/skyledger/reconcile', {})}
              >
                {l('核对台账')}
              </Button>
            </Stack>
          }
        />
        {loading ? <LinearProgress /> : null}
        {error ? <Alert severity="error">{error?.response?.data?.error?.message || error.message}</Alert> : null}
        {action ? (
          <Alert sx={{ mt: 1 }} severity={action.severity}>
            {action.text}
          </Alert>
        ) : null}
      </Grid>

      <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
        <CountCard title={l('运行计划')} value={plans.total} note="OperationControlPlan" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
        <CountCard title={l('卡车作业')} value={jobs.total} note="TransportJob" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
        <CountCard title={l('口岸作业')} value={borders.total} note={l('CN / KZ 独立 Gate')} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
        <CountCard title={l('TAS 接收')} value={tas.total} note={l('三方逐件核对')} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 2.4 }}>
        <CountCard
          title={l('同步待处理')}
          value={(integrationCounts.PENDING || 0) + (integrationCounts.FAILED || 0)}
          note={l(integration.data?.configured ? '已配置签名通道' : '通道未配置')}
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 7 }}>
        <MainCard title={l('运行计划与控制水位')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{l('航班')}</TableCell>
                <TableCell>{l('基准 ETD')}</TableCell>
                <TableCell>{l('当前 ETD')}</TableCell>
                <TableCell>{l('计划状态')}</TableCell>
                <TableCell>{l('覆盖')}</TableCell>
                <TableCell>{l('健康')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {plans.items.map((item) => (
                <TableRow
                  hover
                  selected={selectedPlanId === item.operation_control_plan_id}
                  key={item.operation_control_plan_id}
                  onClick={() => setSelectedPlanId(item.operation_control_plan_id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>
                    <Typography variant="subtitle2">{item.flight_no}</Typography>
                    <Typography variant="caption">{item.route_template_code}</Typography>
                  </TableCell>
                  <TableCell>{time(item.baseline_etd)}</TableCell>
                  <TableCell>{time(item.current_operating_etd)}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status || 'DRAFT'} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={item.current_coverage_status || 'GAP'} />
                  </TableCell>
                  <TableCell>
                    <StatusChip label={item.overall_health_color || 'UNKNOWN'} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <MainCard title={l('Skyledger 同步台账')}>
          <Stack sx={{ gap: 2 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
              <Typography>{l('通道')}</Typography>
              <StatusChip label={integration.data?.configured ? 'ACTIVE' : 'BLOCKED'} />
            </Stack>
            {(integration.data?.inbox || []).map((row) => (
              <Stack direction="row" sx={{ justifyContent: 'space-between' }} key={`in-${row.status}`}>
                <Typography>
                  {intl.locale === 'en' ? 'Inbound' : '入站'} · {row.status}
                </Typography>
                <Typography variant="h5">{row.count}</Typography>
              </Stack>
            ))}
            {(integration.data?.outbox || []).map((row) => (
              <Stack direction="row" sx={{ justifyContent: 'space-between' }} key={`out-${row.status}`}>
                <Typography>
                  {intl.locale === 'en' ? 'Outbound' : '出站'} · {row.status}
                </Typography>
                <Typography variant="h5">{row.count}</Typography>
              </Stack>
            ))}
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <MainCard title={`${l('节点计划')} ${selectedPlan?.flight_no || ''}`}>
          {selectedPlan ? (
            <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle2">{l('计划状态')}</Typography>
                <StatusChip label={selectedPlan.status || 'DRAFT'} />
                <Typography variant="caption" color="text.secondary">
                  {selectedPlan.active_plan_version_id}
                </Typography>
              </Stack>
              {selectedPlan.status === 'DRAFT' ? (
                <Button disabled={busy} variant="contained" color="success" onClick={publishSelectedPlan}>
                  {l('发布当前计划版本')}
                </Button>
              ) : null}
            </Stack>
          ) : null}
          {selectedPlan?.source_approval_status && selectedPlan.source_approval_status !== 'APPROVED_FOR_PRODUCTION' ? (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {l('手册基线 / 待审批：仅用于开发演练，不进入生产 SLA、对客承诺或供应商绩效。')}
            </Alert>
          ) : null}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{intl.locale === 'en' ? 'Milestone' : '节点'}</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>{l('基准计划')}</TableCell>
                <TableCell>{l('当前计划')}</TableCell>
                <TableCell>{l('实际/预测')}</TableCell>
                <TableCell>{l('偏差/缓冲')}</TableCell>
                <TableCell>{l('状态')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(managementItems.length ? managementItems : milestoneItems).map((item) => (
                <TableRow key={item.milestone_instance_id || item.milestone_code}>
                  <TableCell>
                    <Typography variant="subtitle2">{item.milestone_code}</Typography>
                    <Typography variant="caption">
                      {intl.locale === 'en' ? item.name_en || item.name_zh : item.name_zh || item.name_en}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {item.owner_role_code || item.current_owner_role || '--'} → {item.next_owner_role || '--'}
                  </TableCell>
                  <TableCell>{time(item.baseline_planned_at)}</TableCell>
                  <TableCell>{time(item.operating_planned_at)}</TableCell>
                  <TableCell>{time(item.actual_completed_at || item.forecast_at)}</TableCell>
                  <TableCell>
                    {item.operating_variance_minutes ?? '--'}m / {item.remaining_buffer_minutes ?? '--'}m
                  </TableCell>
                  <TableCell>
                    <StatusChip label={item.health_color || item.status || 'UNKNOWN'} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <ControlPlanCreateDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} onCreated={handlePlanCreated} />
    </Grid>
  );
}
