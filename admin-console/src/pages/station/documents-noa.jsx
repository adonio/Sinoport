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
import { getGateEvaluationsByGateId, getHardGatePolicy, noaNotificationRows } from 'data/sinoport-adapters';

function buildInitialState() {
  return Object.fromEntries(noaNotificationRows.map((item) => [item.id, { status: item.status, note: item.note }]));
}

export default function StationDocumentsNoaPage() {
  const [selectedId, setSelectedId] = useState(noaNotificationRows[0]?.id || '');
  const [rowState, setRowState] = useState(buildInitialState);
  const [actionLog, setActionLog] = useState([
    {
      id: 'NOA-ACT-001',
      title: 'NOA 发送前先校验 HG-03',
      description: '理货复核未完成时，只允许停留在待发送或人工放行评审。',
      status: '待处理'
    }
  ]);

  const selectedRow = noaNotificationRows.find((item) => item.id === selectedId) || noaNotificationRows[0];
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
        id: `NOA-ACT-${Date.now()}`,
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

  function handleValidate() {
    if (selectedRow.id === 'NOA-001') {
      updateRow('待处理', `仍命中 ${selectedRow.gateId}，需先完成理货复核。`);
      pushLog('NOA 校验未通过', `${selectedRow.awb} 仍命中 ${selectedRow.gateId}，发送动作保持待处理。`, '待处理');
      return;
    }

    pushLog('NOA 校验通过', `${selectedRow.awb} 已满足发送前门槛，可继续通知动作。`, '运行中');
  }

  function handleRetry() {
    if (selectedRow.id !== 'NOA-003') {
      pushLog('无需重试', `${selectedRow.id} 当前不是失败态，无需执行重试。`, '运行中');
      return;
    }

    updateRow('已发送', '重试成功，已记录补发时间与渠道。');
    pushLog('NOA 重试成功', `${selectedRow.awb} 已从失败态恢复为已发送。`, '运行中');
  }

  function handleManualSend() {
    if (selectedRow.id === 'NOA-001') {
      pushLog('人工补发被拦截', `${selectedRow.awb} 仍命中 ${selectedRow.gateId}，需先解除门槛。`, '警戒');
      return;
    }

    updateRow('已发送', '已登记人工补发记录和责任人。');
    pushLog('人工补发完成', `${selectedRow.awb} 已登记人工补发记录。`, '运行中');
  }

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="NOA Actions"
          title="NOA 通知动作"
          description="展示发送前门槛检查、失败重试和人工补发。当前页统一从 HG 门槛定义读取阻断原因与恢复动作。"
          chips={['Gate Check', 'Retry', 'Manual Send']}
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
        <MainCard title="NOA 通知列表">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>编号</TableCell>
                <TableCell>AWB</TableCell>
                <TableCell>渠道</TableCell>
                <TableCell>目标对象</TableCell>
                <TableCell>Gate</TableCell>
                <TableCell>状态</TableCell>
                <TableCell>重试策略</TableCell>
                <TableCell align="right">跳转</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {noaNotificationRows.map((item) => (
                <TableRow key={item.id} hover selected={item.id === selectedId} onClick={() => setSelectedId(item.id)} sx={{ cursor: 'pointer' }}>
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{item.channel}</TableCell>
                  <TableCell>{item.target}</TableCell>
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
              <Button variant="contained" onClick={handleValidate}>
                发送前校验
              </Button>
              <Button variant="outlined" onClick={handleRetry}>
                重试发送
              </Button>
              <Button variant="outlined" onClick={handleManualSend}>
                人工补发
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
        <TaskQueueCard title="NOA 动作记录" items={actionLog} />
      </Grid>
    </Grid>
  );
}
