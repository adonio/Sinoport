import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { Link as RouterLink, useParams } from 'react-router-dom';

import { useGetInboundWaybillDetail, useGetObjectAudit } from 'api/station';
import MainCard from 'components/MainCard';
import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import MetricCard from 'components/sinoport/MetricCard';
import ObjectAuditTrail from 'components/sinoport/ObjectAuditTrail';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { buildStationCopilotUrl } from 'utils/copilot';

function buildGateItems(detail) {
  return detail.documents.map((item) => {
    const blocking = item.required_for_release && !['Released', 'Approved', 'Validated'].includes(item.document_status);
    return {
      gateId: item.required_for_release ? `DOC-${item.document_type}` : undefined,
      node: item.document_type,
      required: item.required_for_release ? '必须达到可放行状态' : '仅要求文件存在并留痕',
      impact: blocking ? '仍阻断 NOA / POD / 放行链路' : '当前不阻断主链',
      status: item.document_status,
      blocker: blocking ? `${item.document_type} 仍未完成校验` : '',
      recovery: blocking ? '补传或批准后重试对应动作' : '',
      releaseRole: item.required_for_release ? 'document_desk / station_supervisor' : ''
    };
  });
}

export default function StationInboundWaybillDetailPage() {
  const { awb } = useParams();
  const { inboundWaybillDetail } = useGetInboundWaybillDetail(awb);
  const { objectAuditEvents, objectAuditTransitions } = useGetObjectAudit('AWB', awb);

  if (!inboundWaybillDetail) {
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

  const { awb: awbDetail, shipment, documents, tasks, exceptions } = inboundWaybillDetail;
  const gateItems = buildGateItems(inboundWaybillDetail);

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="进港 / 提单 / 详情"
          title={`提单详情 / ${awbDetail.awb_no}`}
          description="提单详情页直接读取真实 AWB、Shipment、Document、Task、Exception 链，不再保留本地办公室状态。"
          chips={[awbDetail.flight_no, awbDetail.consignee_name, awbDetail.current_node]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to={`/station/shipments/${encodeURIComponent(`in-${awbDetail.awb_no}`)}`} variant="outlined">
                履约链路
              </Button>
              <Button component={RouterLink} to={buildStationCopilotUrl('AWB', awbDetail.awb_no)} variant="outlined">
                Copilot
              </Button>
              <Button component={RouterLink} to="/station/documents/noa" variant="outlined">
                NOA 动作
              </Button>
              <Button component={RouterLink} to="/station/documents/pod" variant="outlined">
                POD 动作
              </Button>
              <Button component={RouterLink} to="/station/inbound/waybills" variant="outlined">
                返回提单列表
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="当前节点" value={awbDetail.current_node} helper={awbDetail.flight_no} chip="AWB" color="primary" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="NOA" value={awbDetail.noa_status} helper="通知状态" chip="NOA" color="warning" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="POD" value={awbDetail.pod_status} helper="签收状态" chip="POD" color="error" />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
        <MetricCard title="转运状态" value={awbDetail.transfer_status} helper={`SLA ${shipment.service_level}`} chip="Transfer" color="secondary" />
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <MainCard title="AWB 与 Shipment 信息">
          <Stack sx={{ gap: 1.25 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">AWB ID</Typography>
              <Typography fontWeight={600}>{awbDetail.awb_id}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">Shipment ID</Typography>
              <Typography fontWeight={600}>{shipment.shipment_id}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">收货方</Typography>
              <Typography fontWeight={600}>{awbDetail.consignee_name}</Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">件重体</Typography>
              <Typography fontWeight={600}>
                {awbDetail.pieces} pcs / {awbDetail.gross_weight} kg
              </Typography>
            </Stack>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
              <Typography color="text.secondary">Shipment 状态</Typography>
              <StatusChip label={shipment.fulfillment_status} />
            </Stack>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <TaskQueueCard
          title="任务摘要"
          emptyText="当前提单没有关联任务。"
          items={tasks.map((item) => ({
            id: item.task_id,
            title: item.task_type,
            description: item.task_id,
            meta: item.blocker_code ? `Blocker ${item.blocker_code}` : '无阻断码',
            status: item.task_status,
            actions: [{ label: '打开任务中心', to: '/station/tasks', variant: 'outlined' }]
          }))}
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 4 }}>
        <TaskQueueCard
          title="异常摘要"
          emptyText="当前提单没有开放异常。"
          items={exceptions.map((item) => ({
            id: item.exception_id,
            title: item.exception_type,
            description: `${item.exception_id} · ${item.severity}`,
            meta: item.blocker_flag ? '当前阻断主链' : '仅需跟进',
            status: item.exception_status,
            actions: [{ label: '打开异常中心', to: `/station/exceptions/${item.exception_id}`, variant: 'outlined' }]
          }))}
        />
      </Grid>

      <Grid size={12}>
        <DocumentStatusCard title="文件门槛摘要" items={gateItems} />
      </Grid>

      <Grid size={12}>
        <MainCard title="关联文件">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>文件类型</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>放行要求</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((item) => (
                <TableRow key={item.document_id} hover>
                  <TableCell>{item.document_type}</TableCell>
                  <TableCell>
                    <StatusChip label={item.document_status} />
                  </TableCell>
                  <TableCell>{item.required_for_release ? '必须' : '可选'}</TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to="/station/documents" size="small" variant="outlined">
                      打开单证中心
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={12}>
        <ObjectAuditTrail events={objectAuditEvents} transitions={objectAuditTransitions} title="提单对象审计" />
      </Grid>
    </Grid>
  );
}
