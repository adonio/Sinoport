import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useIntl } from 'react-intl';
import { Link as RouterLink, useParams } from 'react-router-dom';

import { useGetObjectAudit, useGetStationShipmentDetail } from 'api/station';
import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import LifecycleStepList from 'components/sinoport/LifecycleStepList';
import MainCard from 'components/MainCard';
import ObjectAuditTrail from 'components/sinoport/ObjectAuditTrail';
import ObjectSummaryCard from 'components/sinoport/ObjectSummaryCard';
import PageHeader from 'components/sinoport/PageHeader';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import { buildStationCopilotUrl } from 'utils/copilot';

function getRelationshipActions(target, shipmentId, m) {
  if (target === 'Task') return [{ label: m('任务中心'), to: '/station/tasks' }];
  if (target === 'Document') return [{ label: m('单证中心'), to: '/station/documents' }];
  if (target === 'Exception') return [{ label: m('异常中心'), to: '/station/exceptions' }];
  if (target.startsWith('Flight / '))
    return [{ label: m('航班详情'), to: `/station/inbound/flights/${encodeURIComponent(target.replace('Flight / ', ''))}` }];
  if (target.startsWith('AWB / '))
    return [{ label: m('提单详情'), to: `/station/inbound/waybills/${encodeURIComponent(target.replace('AWB / ', ''))}` }];
  return [{ label: m('当前对象'), to: `/station/shipments/${shipmentId}` }];
}

export default function ShipmentDetailPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const { shipmentId } = useParams();
  const { stationShipmentDetail } = useGetStationShipmentDetail(shipmentId);
  const { objectAuditEvents, objectAuditTransitions } = useGetObjectAudit('Shipment', shipmentId);

  if (!stationShipmentDetail) {
    return (
      <Grid container rowSpacing={3} columnSpacing={3}>
        <Grid size={12}>
          <PageHeader
            eyebrow={m('履约链路 / 详情')}
            title={m('未找到履约对象')}
            description={m(`未找到履约对象 ${shipmentId || ''}，请返回履约对象列表重新选择。`)}
            action={
              <Button component={RouterLink} to="/station/shipments" variant="contained">
                {m('返回对象目录')}
              </Button>
            }
          />
        </Grid>
      </Grid>
    );
  }

  const detail = stationShipmentDetail;
  const gateItems = detail.gatePolicySummary || [];

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={localizeUiText(locale, detail.eyebrow)}
          title={localizeUiText(locale, detail.title)}
          description={m('履约详情页直接回连真实 AWB、Document、Task、Exception 和对象审计。')}
          chips={[
            localizeUiText(locale, detail.summary.direction),
            localizeUiText(locale, detail.summary.route),
            `${m('优先级')} ${localizeUiText(locale, detail.summary.priority)}`,
            localizeUiText(locale, detail.summary.station)
          ]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                {m('单证')}
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                {m('任务')}
              </Button>
              <Button component={RouterLink} to="/station/exceptions" variant="outlined">
                {m('异常')}
              </Button>
              <Button component={RouterLink} to={buildStationCopilotUrl('Shipment', detail.id)} variant="outlined">
                {m('Copilot')}
              </Button>
              <Button component={RouterLink} to="/station/shipments" variant="outlined">
                {m('返回目录')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <ObjectSummaryCard
          title={m('对象摘要')}
          subtitle={m('当前对象的状态和路由全部来自真实后端。')}
          status={detail.summary.fulfillmentStatus}
          rows={[
            { label: m('方向'), value: localizeUiText(locale, detail.summary.direction) },
            { label: m('链路'), value: localizeUiText(locale, detail.summary.route) },
            { label: m('运行态'), value: localizeUiText(locale, detail.summary.runtimeStatus) },
            { label: m('履约状态'), value: localizeUiText(locale, detail.summary.fulfillmentStatus) },
            { label: m('优先级'), value: localizeUiText(locale, detail.summary.priority) },
            { label: m('站点'), value: localizeUiText(locale, detail.summary.station) }
          ]}
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 8 }}>
        <MainCard title={m('履约时间线')}>
          <LifecycleStepList
            steps={detail.timeline.map((item, index) => ({
              label: localizeUiText(locale, item.label),
              note: localizeUiText(locale, item.note),
              progress: Math.max(18, 100 - index * 22),
              metric: localizeUiText(locale, item.status)
            }))}
          />
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 5 }}>
        <TaskQueueCard
          title={m('关联任务')}
          emptyText={m('当前对象没有关联任务。')}
          items={detail.tasks.map((item) => ({
            id: item.id,
            title: localizeUiText(locale, item.title),
            description: `${localizeUiText(locale, item.owner)} · ${m('截止')} ${item.due}`,
            meta: `${(item.gateIds || []).join(', ') || m('无门槛')} · ${localizeUiText(locale, item.evidence)}`,
            status: item.status,
            actions: [{ label: m('任务中心'), to: item.jumpTo || '/station/tasks', variant: 'outlined' }]
          }))}
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 7 }}>
        <MainCard title={m('关联文件')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('类型')}</TableCell>
                <TableCell>{m('文件名')}</TableCell>
                <TableCell>{m('门槛')}</TableCell>
                <TableCell>{m('状态')}</TableCell>
                <TableCell>{m('关联任务')}</TableCell>
                <TableCell>{m('说明')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {detail.documents.map((item) => (
                <TableRow key={`${item.type}-${item.name}`} hover>
                  <TableCell>{localizeUiText(locale, item.type)}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{(item.gateIds || []).join(', ') || '-'}</TableCell>
                  <TableCell>{localizeUiText(locale, item.status)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.linkedTask)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.note)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <DocumentStatusCard title={m('当前对象命中的门槛')} items={gateItems} />
      </Grid>

      <Grid size={12}>
        <MainCard title={m('对象关系')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Source</TableCell>
                <TableCell>Relation</TableCell>
                <TableCell>Target</TableCell>
                <TableCell>{m('说明')}</TableCell>
                <TableCell align="right">{m('操作')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {detail.relationshipRows.map((item) => (
                <TableRow key={`${item.source}-${item.target}`} hover>
                  <TableCell>{item.source}</TableCell>
                  <TableCell>{localizeUiText(locale, item.relation)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.target)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.note)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                      {getRelationshipActions(item.target, detail.id, m).map((action) => (
                        <Button
                          key={`${item.target}-${action.label}`}
                          component={RouterLink}
                          to={action.to}
                          size="small"
                          variant="outlined"
                        >
                          {action.label}
                        </Button>
                      ))}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <TaskQueueCard
          title={m('关联异常')}
          emptyText={m('当前对象暂无异常。')}
          items={detail.exceptions.map((item) => ({
            id: item.id,
            title: `${item.id} · ${localizeUiText(locale, item.type)} · ${item.gateId || m('无门槛')}`,
            description: localizeUiText(locale, item.note),
            status: item.status,
            actions: [{ label: m('异常中心'), to: item.jumpTo || '/station/exceptions', variant: 'outlined' }]
          }))}
        />
      </Grid>

      <Grid size={12}>
        <ObjectAuditTrail events={objectAuditEvents} transitions={objectAuditTransitions} title={m('履约对象审计')} />
      </Grid>
    </Grid>
  );
}
