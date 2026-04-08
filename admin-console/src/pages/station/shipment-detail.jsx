import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { Link as RouterLink, useParams } from 'react-router-dom';

import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import LifecycleStepList from 'components/sinoport/LifecycleStepList';
import MainCard from 'components/MainCard';
import ObjectSummaryCard from 'components/sinoport/ObjectSummaryCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import {
  getShipmentDetail,
  getShipmentGateEvaluations,
  getShipmentRelationshipRows,
  inboundDocumentGates,
  outboundDocumentGates
} from 'data/sinoport-adapters';

export default function ShipmentDetailPage() {
  const { shipmentId } = useParams();
  const detail = getShipmentDetail(shipmentId);
  const gateItems = getShipmentGateEvaluations(detail.id).map((item) => ({
    gateId: item.gateId,
    node: item.node,
    required: item.required,
    impact: item.impact,
    status: item.status,
    blocker: item.blockingReason,
    recovery: item.recoveryAction,
    releaseRole: item.releaseRole
  }));
  const fallbackGateItems = detail.summary.direction === '进港' ? inboundDocumentGates : outboundDocumentGates;
  const relationshipRows = getShipmentRelationshipRows(detail);

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={detail.eyebrow}
          title={detail.title}
          description="对象详情统一回连航班、文件、任务和异常，作为后续服务端对象详情页的前端 demo 基线。"
          chips={[detail.summary.direction, detail.summary.route, `优先级 ${detail.summary.priority}`, detail.summary.station]}
          action={
            <Grid container spacing={1} sx={{ width: 'auto' }}>
              <Grid>
                <Button component={RouterLink} to="/station/documents" variant="outlined">
                  单证
                </Button>
              </Grid>
              <Grid>
                <Button component={RouterLink} to="/station/tasks" variant="outlined">
                  任务
                </Button>
              </Grid>
              <Grid>
                <Button component={RouterLink} to="/station/exceptions" variant="outlined">
                  异常
                </Button>
              </Grid>
              <Grid>
                <Button component={RouterLink} to="/station/shipments" variant="outlined">
                  返回目录
                </Button>
              </Grid>
            </Grid>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, lg: 4 }}>
        <ObjectSummaryCard
          title="对象摘要"
          subtitle="当前对象在前端 demo 中使用统一对象模型表达。"
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
          items={detail.tasks.map((item) => ({
            title: item.title,
            description: `${item.owner} · 截止 ${item.due}`,
            meta: `${item.gateIds?.join(', ') || '无 Gate'} · ${item.jumpTo ? `跳转 ${item.jumpTo} · ` : ''}证据要求：${item.evidence}`,
            status: item.status
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
                  <TableCell>{item.gateIds?.join(', ') || '-'}</TableCell>
                  <TableCell>
                    <StatusChip label={item.status} />
                  </TableCell>
                  <TableCell>{item.linkedTask}</TableCell>
                  <TableCell>{item.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <DocumentStatusCard title="当前对象命中的门槛" items={gateItems.length ? gateItems : fallbackGateItems} />
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
              </TableRow>
            </TableHead>
            <TableBody>
              {relationshipRows.map((item) => (
                <TableRow key={`${item.source}-${item.target}`} hover>
                  <TableCell>{item.source}</TableCell>
                  <TableCell>{item.relation}</TableCell>
                  <TableCell>{item.target}</TableCell>
                  <TableCell>{item.note}</TableCell>
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
            description: `${item.note}${item.jumpTo ? ` · 跳转 ${item.jumpTo}` : ''}`,
            status: item.status
          }))}
        />
      </Grid>
    </Grid>
  );
}
