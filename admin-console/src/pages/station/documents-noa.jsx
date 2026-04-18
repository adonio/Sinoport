import { useEffect, useMemo, useState } from 'react';

import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useIntl } from 'react-intl';
import { Link as RouterLink } from 'react-router-dom';

import DocumentStatusCard from 'components/sinoport/DocumentStatusCard';
import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import TaskQueueCard from 'components/sinoport/TaskQueueCard';
import { openSnackbar } from 'api/snackbar';
import { processInboundNoa, useGetNoaNotifications } from 'api/station';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

export default function StationDocumentsNoaPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const { noaNotifications, noaGateEvaluationsByGateId, noaHardGatePoliciesByGateId } = useGetNoaNotifications();
  const [selectedId, setSelectedId] = useState('');
  const [activeAction, setActiveAction] = useState('');
  const [rowState, setRowState] = useState({});
  const [actionLog, setActionLog] = useState([
    {
      id: 'NOA-ACT-001',
      title: m('NOA 发送前先校验 HG-03'),
      description: m('理货复核未完成时，只允许停留在待发送或人工放行评审。'),
      status: m('待处理')
    }
  ]);

  useEffect(() => {
    if (!noaNotifications.length) {
      return;
    }

    const selectedExists = noaNotifications.some((item) => item.id === selectedId);
    if (!selectedId || !selectedExists) {
      setSelectedId(noaNotifications[0].id);
    }
  }, [noaNotifications, selectedId]);

  const selectedRow = noaNotifications.find((item) => item.id === selectedId) || noaNotifications[0] || null;
  const gatePolicy = selectedRow ? noaHardGatePoliciesByGateId[selectedRow.gateId] || null : null;
  const gateItems = useMemo(
    () =>
      selectedRow
        ? (noaGateEvaluationsByGateId[selectedRow.gateId] || []).map((item) => ({
            gateId: item.gateId,
            node: item.node,
            required: item.required,
            impact: item.impact,
            status: item.status,
            blocker: item.blocker,
            recovery: item.recovery,
            releaseRole: item.releaseRole
          }))
        : [],
    [noaGateEvaluationsByGateId, selectedRow]
  );

  function pushLog(title, description, status) {
    setActionLog((prev) =>
      [
        {
          id: `NOA-ACT-${Date.now()}`,
          title,
          description,
          status
        },
        ...prev
      ].slice(0, 6)
    );
  }

  function updateRow(nextStatus, nextNote) {
    if (!selectedRow) return;

    setRowState((prev) => ({
      ...prev,
      [selectedRow.id]: {
        status: nextStatus,
        note: nextNote
      }
    }));
  }

  async function handleValidate() {
    if (!selectedRow?.awbId) return;

    try {
      setActiveAction('validate');
      const response = await processInboundNoa(selectedRow.awbId, {
        action: 'validate',
        channel: selectedRow.channel,
        note: 'Validate from NOA page'
      });

      const passed = response?.data?.validation_passed;
      updateRow(passed ? '已校验' : '待处理', response?.data?.message || selectedRow.note);
      pushLog(
        passed ? m('NOA 校验通过') : m('NOA 校验未通过'),
        `${selectedRow.awb} · ${response?.data?.message || m('校验完成')}`,
        passed ? m('运行中') : m('待处理')
      );
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || m('NOA 校验失败'),
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setActiveAction('');
    }
  }

  async function handleRetry() {
    if (!selectedRow?.awbId) {
      return;
    }

    try {
      setActiveAction('retry');
      const response = await processInboundNoa(selectedRow.awbId, {
        action: 'retry',
        channel: selectedRow.channel,
        note: 'Retry from NOA page'
      });
      updateRow(m('已发送'), response?.data?.message || m('重试成功'));
      pushLog(m('NOA 重试成功'), `${selectedRow.awb} ${m('已从失败态恢复为已发送。')}`, m('运行中'));
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || m('NOA 重试失败'),
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setActiveAction('');
    }
  }

  async function handleManualSend() {
    if (!selectedRow?.awbId) {
      return;
    }

    try {
      setActiveAction('manual_send');
      const response = await processInboundNoa(selectedRow.awbId, {
        action: 'manual_send',
        channel: selectedRow.channel,
        note: 'Manual send from NOA page'
      });
      updateRow(m('已发送'), response?.data?.message || m('已登记人工补发记录'));
      pushLog(m('人工补发完成'), `${selectedRow.awb} ${m('已登记人工补发记录。')}`, m('运行中'));
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || m('人工补发失败'),
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
          eyebrow={m('NOA 动作')}
          title={m('NOA 通知动作')}
          description={m('展示发送前门槛检查、失败重试和人工补发。当前页统一从 HG 门槛定义读取阻断原因与恢复动作。')}
          chips={[m('门槛检查'), m('重试'), m('人工补发')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                {m('单证中心')}
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                {m('作业指令中心')}
              </Button>
              <Button component={RouterLink} to="/station/shipments" variant="outlined">
                {m('履约链路')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={{ xs: 12, xl: 7 }}>
        <MainCard title={m('NOA 通知列表')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('编号')}</TableCell>
                <TableCell>AWB</TableCell>
                <TableCell>{m('渠道')}</TableCell>
                <TableCell>{m('目标对象')}</TableCell>
                <TableCell>{m('门槛')}</TableCell>
                <TableCell>{m('状态')}</TableCell>
                <TableCell>{m('重试策略')}</TableCell>
                <TableCell align="right">{m('跳转')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {noaNotifications.map((item) => (
                <TableRow
                  key={item.id}
                  hover
                  selected={item.id === selectedId}
                  onClick={() => setSelectedId(item.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{item.awb}</TableCell>
                  <TableCell>{localizeUiText(locale, item.channel)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.target)}</TableCell>
                  <TableCell>{item.gateId}</TableCell>
                  <TableCell>
                    <StatusChip label={localizeUiText(locale, rowState[item.id]?.status || item.status)} />
                  </TableCell>
                  <TableCell>{localizeUiText(locale, item.retry)}</TableCell>
                  <TableCell align="right">
                    <Button component={RouterLink} to={item.objectTo} size="small" variant="outlined">
                      {m('履约对象')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 5 }}>
        <MainCard title={m('当前动作')}>
          <Stack sx={{ gap: 1.5 }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1.5, alignItems: 'center' }}>
              <Stack sx={{ gap: 0.35 }}>
                <StatusChip label={localizeUiText(locale, selectedRow?.gateId || '--')} color="secondary" />
                <StatusChip label={localizeUiText(locale, (selectedRow && rowState[selectedRow.id]?.status) || selectedRow?.status || '--')} />
              </Stack>
              <Button component={RouterLink} to={selectedRow?.objectTo || '/station/shipments'} variant="outlined">
                {m('查看履约对象')}
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                {m('查看任务')}
              </Button>
            </Stack>

            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button variant="contained" onClick={handleValidate} disabled={activeAction === 'validate' || !selectedRow?.awbId}>
                {m('发送前校验')}
              </Button>
              <Button variant="outlined" onClick={handleRetry} disabled={activeAction === 'retry' || !selectedRow?.awbId}>
                {m('重试发送')}
              </Button>
              <Button variant="outlined" onClick={handleManualSend} disabled={activeAction === 'manual_send' || !selectedRow?.awbId}>
                {m('人工补发')}
              </Button>
            </Stack>

            <Stack sx={{ gap: 0.5 }}>
              <Typography variant="subtitle2">{localizeUiText(locale, gatePolicy?.rule)}</Typography>
              <Typography variant="body2" color="text.secondary">
                {m('触发节点：')}
                {localizeUiText(locale, gatePolicy?.triggerNode)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {m('阻断结果：')}
                {localizeUiText(locale, gatePolicy?.blocker)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {m('恢复动作：')}
                {localizeUiText(locale, gatePolicy?.recovery)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {m('放行角色：')}
                {localizeUiText(locale, gatePolicy?.releaseRole)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {m('当前说明：')}
                {localizeUiText(locale, (selectedRow && rowState[selectedRow.id]?.note) || selectedRow?.note || '--')}
              </Typography>
            </Stack>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <DocumentStatusCard title={m('当前门槛判定')} items={gateItems} />
      </Grid>

      <Grid size={{ xs: 12, xl: 6 }}>
        <TaskQueueCard title={m('NOA 动作记录')} items={actionLog} />
      </Grid>
    </Grid>
  );
}
