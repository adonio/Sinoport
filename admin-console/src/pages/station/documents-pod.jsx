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
import { getGateEvaluationsByGateId, getHardGatePolicy, podNotificationRows } from 'data/sinoport-adapters';

function buildInitialState() {
  return Object.fromEntries(podNotificationRows.map((item) => [item.id, { status: item.status, note: item.note }]));
}

export default function StationDocumentsPodPage() {
  const [selectedId, setSelectedId] = useState(podNotificationRows[0]?.id || '');
  const [rowState, setRowState] = useState(buildInitialState);
  const [actionLog, setActionLog] = useState([
    {
      id: 'POD-ACT-001',
      title: 'POD 双签前不得 Closed',
      description: '交付签收完成后，仍需完成双签与归档校验才能进入 Closed。',
      status: '阻塞'
    }
  ]);

  const selectedRow = podNotificationRows.find((item) => item.id === selectedId) || podNotificationRows[0];
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

  function handleCheckClose() {
    if (selectedRow.id === 'POD-001') {
      updateRow('待补签', '仍缺双签，Closed 校验未通过。');
      pushLog('Closed 校验未通过', `${selectedRow.object} 仍命中 ${selectedRow.gateId}，无法关闭。`, '阻塞');
      return;
    }

    if (selectedRow.id === 'POD-003') {
      updateRow('警戒', '扫描件仍需替换，归档前继续保持警戒。');
      pushLog('Closed 校验待补件', `${selectedRow.object} 仍需替换模糊扫描件。`, '警戒');
      return;
    }

    pushLog('Closed 校验通过', `${selectedRow.object} 已满足归档与关闭条件。`, '运行中');
  }

  function handleConfirmSign() {
    if (selectedRow.id === 'POD-001') {
      updateRow('已归档', '已记录司机与客户双签，可进入归档。');
      pushLog('POD 双签完成', `${selectedRow.object} 已补齐双签，阻断解除。`, '运行中');
      return;
    }

    pushLog('无需补签', `${selectedRow.id} 当前不需要补签动作。`, '运行中');
  }

  function handleArchive() {
    if (selectedRow.id === 'POD-003') {
      updateRow('待补签', '归档前需先替换扫描件并复核清晰度。');
      pushLog('归档前被拦截', `${selectedRow.object} 因扫描件模糊被拦截。`, '警戒');
      return;
    }

    updateRow('已归档', '已登记归档结果与责任人。');
    pushLog('POD 已归档', `${selectedRow.object} 已完成归档动作。`, '运行中');
  }

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="POD Actions"
          title="POD 通知与补签"
          description="展示双签阻断、补签后状态变化和归档前校验。当前页统一从 HG-06 读取阻断逻辑。"
          chips={['Double Sign', 'Gate Check', 'Archive']}
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
              {podNotificationRows.map((item) => (
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
            </Stack>

            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" onClick={handleCheckClose}>
                关闭前校验
              </Button>
              <Button variant="outlined" onClick={handleConfirmSign}>
                补签确认
              </Button>
              <Button variant="outlined" onClick={handleArchive}>
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
