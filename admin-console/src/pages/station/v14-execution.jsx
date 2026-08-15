import { useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { Link as RouterLink } from 'react-router-dom';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { useV14Collection, v14Endpoints } from 'api/v14';
import { localizeUiText } from 'utils/app-i18n';

const views = {
  prewarehouse: { title: '前置仓清点', path: v14Endpoints.receipts, mobile: '/mobile/pre-warehouse', id: 'receipt_session_id' },
  transport: { title: '卡车持续跟踪', path: v14Endpoints.jobs, mobile: '/mobile/headhaul', id: 'transport_job_id' },
  border: { title: '阿拉山口 / 多斯特克', path: v14Endpoints.borders, mobile: '/mobile/border', id: 'border_operation_id' },
  tas: { title: 'TAS 机场清点', path: v14Endpoints.tasReceipts, mobile: '/mobile/tas', id: 'airport_receipt_session_id' }
};

function displayId(item, config) {
  return item[config.id] || item.transport_job_id || item.shipment_id || '--';
}

export default function V14ExecutionPage() {
  const intl = useIntl();
  const l = (value) => localizeUiText(intl.locale, value);
  const [tab, setTab] = useState('prewarehouse');
  const receipts = useV14Collection(v14Endpoints.receipts, { refreshInterval: 20000 });
  const jobs = useV14Collection(v14Endpoints.jobs, { refreshInterval: 20000 });
  const borders = useV14Collection(v14Endpoints.borders, { refreshInterval: 20000 });
  const tas = useV14Collection(v14Endpoints.tasReceipts, { refreshInterval: 20000 });
  const resources = { prewarehouse: receipts, transport: jobs, border: borders, tas };
  const active = resources[tab];
  const config = views[tab];
  const blocked = useMemo(() => active.items.filter((item) => ['BLOCKED', 'REJECTED', 'HOLD', 'UNKNOWN'].includes(item.status)).length, [active.items]);

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="v1.4 Execution"
          title={l('跨境前段执行中心')}
          description={l('四个业务对象保持独立事实、独立 Gate 和独立审计；OCC 仅聚合，不替代现场扫描、车辆节点或双边口岸确认。')}
          chips={['CargoUnit 逐件事件', '21 个卡车节点', '中国/哈方独立 Gate', 'TAS 三方核对'].map(l)}
          action={<Button component={RouterLink} to={config.mobile} variant="contained">{l('打开现场终端')}</Button>}
        />
      </Grid>
      <Grid size={12}>
        <MainCard>
          <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="scrollable">
            {Object.entries(views).map(([key, value]) => <Tab key={key} value={key} label={`${l(value.title)} (${resources[key].total})`} />)}
          </Tabs>
        </MainCard>
      </Grid>
      <Grid size={12}>
        {active.error ? <Alert severity="error">{active.error?.response?.data?.error?.message || active.error.message}</Alert> : null}
        {blocked ? <Alert severity="warning" sx={{ mb: 2 }}>{blocked} {l('个对象处于阻断/未知状态，请先完成证据、数据一致性与下一 Owner 接收。')}</Alert> : null}
        <MainCard title={l(config.title)}>
          <Table size="small">
            <TableHead><TableRow><TableCell>{l('业务对象')}</TableCell><TableCell>Shipment</TableCell><TableCell>{l('航班 / 路线')}</TableCell><TableCell>{l('件数 / 重量')}</TableCell><TableCell>{l('最新事实')}</TableCell><TableCell>{l('状态')}</TableCell></TableRow></TableHead>
            <TableBody>
              {active.items.map((item) => (
                <TableRow hover key={displayId(item, config)}>
                  <TableCell><Typography variant="subtitle2">{displayId(item, config)}</Typography><Typography variant="caption">{item.vehicle_plate || item.cn_port_code || item.warehouse_station_id || 'TAS'}</Typography></TableCell>
                  <TableCell>{item.shipment_id || '--'}</TableCell>
                  <TableCell>{item.flight_id || item.route_template_code || item.port_pair_code || '--'}</TableCell>
                  <TableCell>{item.unique_received_pieces ?? item.airport_received_pieces ?? item.loaded_pieces ?? '--'} / {item.actual_weight_kg ?? item.loaded_weight_kg ?? '--'} kg</TableCell>
                  <TableCell>{item.last_location_at || item.updated_at || '--'}</TableCell>
                  <TableCell><StatusChip label={item.status || item.health_state || 'UNKNOWN'} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!active.isLoading && !active.items.length ? <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>{l('当前没有业务对象。')}</Typography> : null}
        </MainCard>
      </Grid>
    </Grid>
  );
}
