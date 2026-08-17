import { useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Link as RouterLink } from 'react-router-dom';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import { useV14Collection, v14Endpoints } from 'api/v14';
import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import useAuth from 'hooks/useAuth';
import { localizeUiText } from 'utils/app-i18n';

import V14IntakeWizard from './v14-intake-wizard';

const ALL_ROLES = ['platform_admin', 'station_supervisor'];

const views = {
  prewarehouse: {
    title: '前置仓清点', path: v14Endpoints.receipts, mobile: '/mobile/pre-warehouse', id: 'receipt_session_id',
    roles: [...ALL_ROLES, 'PREWH_OPERATOR', 'A1_CARGO_CONTROLLER']
  },
  transport: {
    title: '卡车持续跟踪', path: v14Endpoints.jobs, mobile: '/mobile/headhaul', id: 'transport_job_id',
    roles: [...ALL_ROLES, 'TRUCK_OPERATOR', 'A1_CARGO_CONTROLLER', 'A2_DOMESTIC_TRUCK_CONTROLLER', 'A3_CROSS_BORDER_CONTROLLER']
  },
  border: {
    title: '阿拉山口 / 多斯特克', path: v14Endpoints.borders, mobile: '/mobile/border', id: 'border_operation_id',
    roles: [...ALL_ROLES, 'TRUCK_OPERATOR', 'ALASHANKOU_AGENT', 'DOSTYK_AGENT', 'A2_DOMESTIC_TRUCK_CONTROLLER', 'A3_CROSS_BORDER_CONTROLLER', 'OCC_DM']
  },
  tas: {
    title: 'TAS 机场清点', path: v14Endpoints.tasReceipts, mobile: '/mobile/tas', id: 'airport_receipt_session_id',
    roles: [...ALL_ROLES, 'mobile_operator', 'TAS_OPERATOR', 'B1_TAS_STATION_CONTROLLER', 'A3_CROSS_BORDER_CONTROLLER', 'OCC_DM']
  }
};

const INTAKE_ROLES = [...ALL_ROLES, 'document_desk', 'A1_CARGO_CONTROLLER'];

function userRoles(user) {
  return new Set([...(user?.roleIds || []), user?.role].filter(Boolean));
}

function canAny(roles, allowed) {
  return allowed.some((role) => roles.has(role));
}

function displayId(item, config) {
  return item[config.id] || item.transport_job_id || item.shipment_id || '--';
}

function emptyHint(key) {
  if (key === 'prewarehouse') return '尚无前置仓收货批次。请由有权限的人员使用“录入 AWB / 建立货物对象”向导创建，并把条码清单交给现场扫描。';
  if (key === 'transport') return '尚无运输任务。前置仓清点必须先提交并由主管复核通过，之后才能建立 TransportJob、锁定车辆司机并完成装车。';
  if (key === 'border') return '尚无口岸作业。运输任务完成装车后，先准备有效口岸日历、车辆映射和交接核对，再建立双边作业。';
  return '尚无 TAS 收货任务。卡车必须先完成 21 个节点并确认到达 TAS staging，然后到“TAS 站点管理”新建收货任务。';
}

export default function V14ExecutionPage() {
  const intl = useIntl();
  const l = (value) => localizeUiText(intl.locale, value);
  const { user } = useAuth();
  const roles = userRoles(user);
  const roleSignature = [...roles].sort().join('|');
  const visibleKeys = useMemo(
    () => Object.keys(views).filter((key) => canAny(roles, views[key].roles)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [roleSignature]
  );
  const b1Only = roles.has('B1_TAS_STATION_CONTROLLER') && !canAny(roles, ALL_ROLES);
  const firstView = b1Only && visibleKeys.includes('tas') ? 'tas' : visibleKeys[0] || 'tas';
  const [tab, setTab] = useState(firstView);
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (!visibleKeys.includes(tab)) setTab(firstView);
  }, [firstView, tab, visibleKeys]);

  const receipts = useV14Collection(visibleKeys.includes('prewarehouse') ? v14Endpoints.receipts : null, { refreshInterval: 20000 });
  const jobs = useV14Collection(visibleKeys.includes('transport') ? v14Endpoints.jobs : null, { refreshInterval: 20000 });
  const borders = useV14Collection(visibleKeys.includes('border') ? v14Endpoints.borders : null, { refreshInterval: 20000 });
  const tas = useV14Collection(visibleKeys.includes('tas') ? v14Endpoints.tasReceipts : null, { refreshInterval: 20000 });
  const resources = { prewarehouse: receipts, transport: jobs, border: borders, tas };
  const active = resources[tab] || { items: [], total: 0 };
  const config = views[tab] || views.tas;
  const blocked = useMemo(
    () => (active.items || []).filter((item) => ['BLOCKED', 'REJECTED', 'HOLD', 'UNKNOWN'].includes(item.status)).length,
    [active.items]
  );
  const canOpenIntake = canAny(roles, INTAKE_ROLES);
  const canManageFlights = canAny(roles, ['platform_admin', 'OCC_DM']);

  const refreshAll = async () => {
    await Promise.all([receipts.mutate?.(), jobs.mutate?.(), borders.mutate?.(), tas.mutate?.()]);
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="v1.4 Execution"
          title={l('跨境前段执行中心')}
          description={l('页面只展示当前账号可操作的业务段；现场事实必须按前置条件顺序录入，OCC 不替代扫描、车辆节点或双边口岸确认。')}
          chips={['AWB 建立货物对象', 'CargoUnit 逐件事件', '21 个卡车节点', '中国/哈方独立 Gate'].map(l)}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              {canOpenIntake ? <Button variant="contained" onClick={() => setWizardOpen(true)}>{l('录入 AWB / 建立货物对象')}</Button> : null}
              {visibleKeys.length ? <Button component={RouterLink} to={config.mobile} variant="outlined">{l('打开当前现场终端')}</Button> : null}
              {canManageFlights ? <Button component={RouterLink} to="/platform/occ-control" variant="outlined">{l('管理航班与 OCC')}</Button> : null}
            </Stack>
          }
        />
      </Grid>

      {b1Only ? (
        <Grid size={12}>
          <Alert severity="info">
            B1 账号默认进入 TAS 作业，只读已选航班，不能编辑 OCC 航班主数据。上游完成并到达 TAS staging 后，请到
            <Button component={RouterLink} to="/station/tas" size="small">TAS 站点管理</Button>
            新建收货任务。
          </Alert>
        </Grid>
      ) : null}

      {!canManageFlights ? (
        <Grid size={12}>
          <Alert severity="info">航班主数据由 OCC 创建和编辑；当前账号只可在获授权的业务步骤中选择已发布航班，不会获得航班编辑权限。</Alert>
        </Grid>
      ) : null}

      {!visibleKeys.length ? <Grid size={12}><Alert severity="warning">当前账号没有跨境执行中心的可用业务段，请联系管理员核对岗位角色。</Alert></Grid> : null}

      {visibleKeys.length ? (
        <>
          <Grid size={12}>
            <MainCard>
              <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="scrollable">
                {visibleKeys.map((key) => <Tab key={key} value={key} label={`${l(views[key].title)} (${resources[key].total})`} />)}
              </Tabs>
            </MainCard>
          </Grid>
          <Grid size={12}>
            {active.error ? <Alert severity="error">{active.error?.response?.data?.error?.message || active.error.message}</Alert> : null}
            {blocked ? <Alert severity="warning" sx={{ mb: 2 }}>{blocked} {l('个对象处于阻断/未知状态，请先补齐证据、数据一致性与下一 Owner 接收。')}</Alert> : null}
            <MainCard title={l(config.title)}>
              <Table size="small">
                <TableHead><TableRow><TableCell>{l('业务对象')}</TableCell><TableCell>Shipment</TableCell><TableCell>{l('航班 / 路线')}</TableCell><TableCell>{l('件数 / 重量')}</TableCell><TableCell>{l('最新事实')}</TableCell><TableCell>{l('状态')}</TableCell><TableCell align="right">{l('操作')}</TableCell></TableRow></TableHead>
                <TableBody>
                  {(active.items || []).map((item) => {
                    const itemId = displayId(item, config);
                    return (
                      <TableRow hover key={itemId}>
                        <TableCell><Typography variant="subtitle2">{itemId}</Typography><Typography variant="caption">{item.vehicle_plate || item.cn_port_code || item.warehouse_station_id || 'TAS'}</Typography></TableCell>
                        <TableCell>{item.shipment_id || '--'}</TableCell>
                        <TableCell>{item.flight_id || item.route_template_code || item.port_pair_code || '--'}</TableCell>
                        <TableCell>{item.unique_received_pieces ?? item.airport_received_pieces ?? item.loaded_pieces ?? '--'} / {item.actual_weight_kg ?? item.loaded_weight_kg ?? '--'} kg</TableCell>
                        <TableCell>{item.last_location_at || item.updated_at || '--'}</TableCell>
                        <TableCell><StatusChip label={item.status || item.health_state || 'UNKNOWN'} /></TableCell>
                        <TableCell align="right"><Button size="small" component={RouterLink} to={`${config.mobile}/${encodeURIComponent(itemId)}`}>{l('进入作业')}</Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {!active.isLoading && !active.items?.length ? (
                <Stack sx={{ py: 3, alignItems: 'center', gap: 1.5 }}>
                  <Typography color="text.secondary" textAlign="center">{l(emptyHint(tab))}</Typography>
                  {tab === 'tas' ? <Button component={RouterLink} to="/station/tas" variant="outlined">{l('打开 TAS 站点管理')}</Button> : null}
                </Stack>
              ) : null}
            </MainCard>
          </Grid>
        </>
      ) : null}

      <V14IntakeWizard open={wizardOpen} onClose={() => setWizardOpen(false)} user={user} onChanged={refreshAll} />
    </Grid>
  );
}
