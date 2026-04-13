import { useMemo, useState } from 'react';

import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { openSnackbar } from 'api/snackbar';
import { processInboundPod, useGetPodNotifications } from 'api/station';
import { getGateEvaluationsByGateId, getHardGatePolicy, podNotificationRows } from 'data/sinoport-adapters';

function buildInitialState() {
  return Object.fromEntries(podNotificationRows.map((item) => [item.id, { status: item.status, note: item.note }]));
}

export default function StationDocumentsPodPage() {
  const { podNotifications } = useGetPodNotifications();
  const [selectedId, setSelectedId] = useState(podNotificationRows[0]?.id || '');
  const [activeAction, setActiveAction] = useState('');
  const [rowState, setRowState] = useState(buildInitialState);
  const [actionLog, setActionLog] = useState([
    {
      id: 'POD-ACT-001',
      title: 'POD 双签前不得 Closed',
      description: '交付签收完成后，仍需完成双签与归档校验才能进入 Closed。',
      status: '阻塞'
    }
  ]);

  const selectedRow = podNotifications.find((item) => item.id === selectedId) || podNotifications[0] || podNotificationRows[0];
  const gatePolicy = getHardGatePolicy(selectedRow.gateId);
  const gateItems = useMemo(
    () =>
      getGateEvaluationsByGateId(selectedRow.gateId).map((item) => ({
        gateId: item.gateId,
        node: item.node,
        required: item.required,
        impact: item.impact,
        status: item.status,
        blocker: item.blockingReason,
        recovery: item.recoveryAction,
        releaseRole: item.releaseRole
      })),
    [selectedRow.gateId]
  );

  function pushLog(title, description, status) {
    setActionLog((prev) => [
      {
        id: `POD-ACT-${Date.now()}`,
        title,
        description,
        status
      },
      ...prev
    ].slice(0, 6));
  }

  function updateRow(nextStatus, nextNote) {
    setRowState((prev) => ({
      ...prev,
      [selectedRow.id]: {
        status: nextStatus,
        note: nextNote
      }
    }));
  }

  async function handleCheckClose() {
    if (!selectedRow.awbId) return;

    try {
      setActiveAction('validate_close');
      const response = await processInboundPod(selectedRow.awbId, {
        action: 'validate_close',
        document_name: `${selectedRow.object}-pod.pdf`,
        signer: selectedRow.signer,
        note: 'Validate close from POD page'
      });

      const passed = response?.data?.validation_passed;
      updateRow(passed ? '已校验' : '待补签', response?.data?.message || selectedRow.note);
      pushLog(passed ? 'Closed 校验通过' : 'Closed 校验未通过', `${selectedRow.object} · ${response?.data?.message || '校验完成'}`, passed ? '运行中' : '阻塞');
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || '关闭前校验失败',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setActiveAction('');
    }
  }

  async function handleConfirmSign() {
    if (!selectedRow.awbId) {
      return;
    }

    try {
      setActiveAction('confirm_sign');
      const response = await processInboundPod(selectedRow.awbId, {
        action: 'confirm_sign',
        document_name: `${selectedRow.object}-pod.pdf`,
        signer: selectedRow.signer,
        note: 'Confirm sign from POD page'
      });
      updateRow('已归档', response?.data?.message || '已完成补签');
      pushLog('POD 双签完成', `${selectedRow.object} 已补齐双签，阻断解除。`, '运行中');
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || 'POD 补签失败',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setActiveAction('');
    }
  }

  async function handleArchive() {
    if (!selectedRow.awbId) {
      return;
    }

    try {
      setActiveAction('archive');
      const response = await processInboundPod(selectedRow.awbId, {
        action: 'archive',
        document_name: `${selectedRow.object}-pod.pdf`,
        signer: selectedRow.signer,
        note: 'Archive from POD page'
      });
      updateRow('已归档', response?.data?.message || '已完成归档');
      pushLog('POD 已归档', `${selectedRow.object} 已完成归档动作。`, '运行中');
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || 'POD 归档失败',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setActiveAction('');
    }
  }

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="POD Actions"
          title="POD 通知与补签"
          description="展示双签阻断、补签后状态变化和归档前校验。当前页统一从 HG-06 读取阻断逻辑。"
          chips={['Double Sign', 'Gate Check', 'Archive']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                单证中心
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                作业指令中心
              </Button>
              <Button component={RouterLink} to="/station/shipments" variant="outlined">
                履约链路
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 7 }}>
        <MainCard title="POD 通知列表">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>编号</TableCell>
                <TableCell>对象</TableCell>
                <TableCell>签收方</TableCell>
                <TableCell>Gate</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>重试策略</TableCell>
                <TableCell align="right">跳转</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {podNotifications.map((item) => (
                <TableRow key={item.id} hover selected={item.id === selectedId} onClick={() => setSelectedId(item.id)} sx={{ cursor: 'pointer' }}>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.object}</TableCell>
                  <TableCell>{item.signer}</TableCell>
                  <TableCell>{item.gateId}</TableCell>
                  <TableCell>
                    <StatusChip label={rowState[item.id]?.status || item.status} />
                  </TableCell>
                  <TableCell>{item.retry}</TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to={item.objectTo} size="small" variant="outlined">
                      履约对象
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 5 }}>
        <MainCard title="当前动作">
          <Stack sx={{ gap: 1.5 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'center' }}>
              <Stack sx={{ gap: 0.35 }}>
                <StatusChip label={selectedRow.gateId} color="secondary" />
                <StatusChip label={rowState[selectedRow.id]?.status || selectedRow.status} />
              </Stack>
              <Button component={RouterLink} to={selectedRow.objectTo} variant="outlined">
                查看履约对象
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                查看任务
              </Button>
            </Stack>

            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" onClick={handleCheckClose} disabled={activeAction === 'validate_close' || !selectedRow.awbId}>
                关闭前校验
              </Button>
              <Button variant="outlined" onClick={handleConfirmSign} disabled={activeAction === 'confirm_sign' || !selectedRow.awbId}>
                补签确认
              </Button>
              <Button variant="outlined" onClick={handleArchive} disabled={activeAction === 'archive' || !selectedRow.awbId}>
                执行归档
              </Button>
            </Stack>

            <Stack sx={{ gap: 0.5 }}>
              <Typography variant="subtitle2">{gatePolicy?.rule}</Typography>
              <Typography variant="body2" color="text.secondary">
                触发节点：{gatePolicy?.triggerNode}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                阻断结果：{gatePolicy?.blocker}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                恢复动作：{gatePolicy?.recovery}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                放行角色：{gatePolicy?.releaseRole}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                当前说明：{rowState[selectedRow.id]?.note || selectedRow.note}
              </Typography>
            </Stack>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <DocumentStatusCard title="当前 Gate 判定" items={gateItems} />
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <TaskQueueCard title="POD 动作记录" items={actionLog} />
      </Grid>
    </Grid>
  );
}
