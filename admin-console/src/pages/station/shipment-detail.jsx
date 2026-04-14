import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { Link as RouterLink, useParams } from 'react-router-dom';

import { useGetObjectAudit, useGetStationShipmentDetail } from 'api/station';
import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import LifecycleStepList from 'components/sinoport/LifecycleStepList';
import MainCard from 'components/MainCard';
import ObjectAuditTrail from 'components/sinoport/ObjectAuditTrail';
import ObjectSummaryCard from 'components/sinoport/ObjectSummaryCard';
import PageHeader from 'components/sinoport/PageHeader';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { buildStationCopilotUrl } from 'utils/copilot';

function getRelationshipActions(target, shipmentId) {
  if (target === 'Task') return [{ label: '任务中心', to: '/station/tasks' }];
  if (target === 'Document') return [{ label: '单证中心', to: '/station/documents' }];
  if (target === 'Exception') return [{ label: '异常中心', to: '/station/exceptions' }];
  if (target.startsWith('Flight / ')) return [{ label: '航班详情', to: `/station/inbound/flights/${encodeURIComponent(target.replace('Flight / ', ''))}` }];
  if (target.startsWith('AWB / ')) return [{ label: '提单详情', to: `/station/inbound/waybills/${encodeURIComponent(target.replace('AWB / ', ''))}` }];
  return [{ label: '当前对象', to: `/station/shipments/${shipmentId}` }];
}

export default function ShipmentDetailPage() {
  const { shipmentId } = useParams();
  const { stationShipmentDetail } = useGetStationShipmentDetail(shipmentId);
  const { objectAuditEvents, objectAuditTransitions } = useGetObjectAudit('Shipment', shipmentId);

  if (!stationShipmentDetail) {
    return (
      <Grid container rowSpacing={3} columnSpacing={3}>
        <Grid size={12}>
          <PageHeader
            eyebrow="Shipment / Fulfillment Chain"
            title="未找到履约对象"
            description={`未找到履约对象 ${shipmentId || ''}，请返回 Shipment 列表重新选择。`}
            action={
              <Button component={RouterLink} to="/station/shipments" variant="contained">
                返回对象目录
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
          eyebrow={detail.eyebrow}
          title={detail.title}
          description="Shipment 详情页直接回连真实 AWB、Document、Task、Exception 和对象审计。"
          chips={[detail.summary.direction, detail.summary.route, `优先级 ${detail.summary.priority}`, detail.summary.station]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                单证
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                任务
              </Button>
              <Button component={RouterLink} to="/station/exceptions" variant="outlined">
                异常
              </Button>
              <Button component={RouterLink} to={buildStationCopilotUrl('Shipment', detail.id)} variant="outlined">
                Copilot
              </Button>
              <Button component={RouterLink} to="/station/shipments" variant="outlined">
                返回目录
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <ObjectSummaryCard
          title="对象摘要"
          subtitle="当前对象的状态和路由全部来自真实后端。"
          status={detail.summary.fulfillmentStatus}
          rows={[
            { label: '方向', value: detail.summary.direction },
            { label: '链路', value: detail.summary.route },
            { label: 'Runtime', value: detail.summary.runtimeStatus },
            { label: 'Fulfillment', value: detail.summary.fulfillmentStatus },
            { label: '优先级', value: detail.summary.priority },
            { label: '站点', value: detail.summary.station }
          ]}
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 8 }}>
        <MainCard title="履约时间线">
          <LifecycleStepList
            steps={detail.timeline.map((item, index) => ({
              label: item.label,
              note: item.note,
              progress: Math.max(18, 100 - index * 22),
              metric: item.status
            }))}
          />
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 5 }}>
        <TaskQueueCard
          title="关联任务"
          emptyText="当前对象没有关联任务。"
          items={detail.tasks.map((item) => ({
            id: item.id,
            title: item.title,
            description: `${item.owner} · 截止 ${item.due}`,
            meta: `${(item.gateIds || []).join(', ') || '无 Gate'} · ${item.evidence}`,
            status: item.status,
            actions: [{ label: '任务中心', to: item.jumpTo || '/station/tasks', variant: 'outlined' }]
          }))}
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 7 }}>
        <MainCard title="关联文件">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>类型</TableCell>
                <TableCell>文件名</TableCell>
                <TableCell>Gate</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>关联任务</TableCell>
                <TableCell>说明</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {detail.documents.map((item) => (
                <TableRow key={`${item.type}-${item.name}`} hover>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{(item.gateIds || []).join(', ') || '-'}</TableCell>
                  <TableCell>{item.status}</TableCell>
                  <TableCell>{item.linkedTask}</TableCell>
                  <TableCell>{item.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <DocumentStatusCard title="当前对象命中的门槛" items={gateItems} />
      </Grid>

      <Grid size={12}>
        <MainCard title="对象关系">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Source</TableCell>
                <TableCell>Relation</TableCell>
                <TableCell>Target</TableCell>
                <TableCell>说明</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {detail.relationshipRows.map((item) => (
                <TableRow key={`${item.source}-${item.target}`} hover>
                  <TableCell>{item.source}</TableCell>
                  <TableCell>{item.relation}</TableCell>
                  <TableCell>{item.target}</TableCell>
                  <TableCell>{item.note}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                      {getRelationshipActions(item.target, detail.id).map((action) => (
                        <Button key={`${item.target}-${action.label}`} component={RouterLink} to={action.to} size="small" variant="outlined">
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
          title="关联异常"
          emptyText="当前对象暂无异常。"
          items={detail.exceptions.map((item) => ({
            id: item.id,
            title: `${item.id} · ${item.type} · ${item.gateId || '无 Gate'}`,
            description: item.note,
            status: item.status,
            actions: [{ label: '异常中心', to: item.jumpTo || '/station/exceptions', variant: 'outlined' }]
          }))}
        />
      </Grid>

      <Grid size={12}>
        <ObjectAuditTrail events={objectAuditEvents} transitions={objectAuditTransitions} title="Shipment 对象审计" />
      </Grid>
    </Grid>
  );
}
