import { useEffect, useState } from 'react';

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
import { processInboundPod, useGetPodNotifications } from 'api/station';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

export default function StationDocumentsPodPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const { podNotifications, podGateEvaluationsByGateId, podHardGatePoliciesByGateId } = useGetPodNotifications();
  const [selectedId, setSelectedId] = useState('');
  const [activeAction, setActiveAction] = useState('');
  const [rowState, setRowState] = useState({});
  const [actionLog, setActionLog] = useState([
    {
      id: 'POD-ACT-001',
      title: m('POD 双签前不得 Closed'),
      description: m('交付签收完成后，仍需完成双签与归档校验才能进入 Closed。'),
      status: m('阻塞')
    }
  ]);

  useEffect(() => {
    if (!podNotifications.length) {
      return;
    }

    if (!selectedId || !podNotifications.some((item) => item.id === selectedId)) {
      setSelectedId(podNotifications[0].id);
    }
  }, [podNotifications, selectedId]);

  const selectedRow = podNotifications.find((item) => item.id === selectedId) || podNotifications[0] || null;
  const selectedGateId = selectedRow?.gateId || '';
  const gatePolicy = selectedGateId ? podHardGatePoliciesByGateId[selectedGateId] || null : null;
  const gateItems = selectedGateId ? podGateEvaluationsByGateId[selectedGateId] || [] : [];

  function pushLog(title, description, status) {
    setActionLog((prev) =>
      [
        {
          id: `POD-ACT-${Date.now()}`,
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

  async function handleCheckClose() {
    if (!selectedRow?.awbId) return;

    try {
      setActiveAction('validate_close');
      const response = await processInboundPod(selectedRow.awbId, {
        action: 'validate_close',
        document_name: `${selectedRow.object}-pod.pdf`,
        signer: selectedRow.signer,
        note: 'Validate close from POD page'
      });

      const passed = response?.data?.validation_passed;
      updateRow(passed ? m('已校验') : m('待补签'), response?.data?.message || selectedRow.note);
      pushLog(
        passed ? m('Closed 校验通过') : m('Closed 校验未通过'),
        `${selectedRow.object} · ${response?.data?.message || m('校验完成')}`,
        passed ? m('运行中') : m('阻塞')
      );
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || m('关闭前校验失败'),
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setActiveAction('');
    }
  }

  async function handleConfirmSign() {
    if (!selectedRow?.awbId) {
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
      updateRow(m('已归档'), response?.data?.message || m('已完成补签'));
      pushLog(m('POD 双签完成'), `${selectedRow.object} ${m('已补齐双签，阻断解除。')}`, m('运行中'));
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || m('POD 补签失败'),
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setActiveAction('');
    }
  }

  async function handleArchive() {
    if (!selectedRow?.awbId) {
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
      updateRow(m('已归档'), response?.data?.message || m('已完成归档'));
      pushLog(m('POD 已归档'), `${selectedRow.object} ${m('已完成归档动作。')}`, m('运行中'));
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.error?.message || m('POD 归档失败'),
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
          eyebrow={m('POD 动作')}
          title={m('POD 通知与补签')}
          description={m('展示双签阻断、补签后状态变化和归档前校验。当前页统一从后端 overview 读取 POD 列表与 HG-06 阻断逻辑。')}
          chips={[m('双签'), m('门槛检查'), m('归档')]}
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
        <MainCard title={m('POD 通知列表')}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{m('编号')}</TableCell>
                <TableCell>{m('对象')}</TableCell>
                <TableCell>{m('签收方')}</TableCell>
                <TableCell>{m('门槛')}</TableCell>
                <TableCell>{m('状态')}</TableCell>
                <TableCell>{m('重试策略')}</TableCell>
                <TableCell align="right">{m('跳转')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {podNotifications.map((item) => (
                <TableRow
                  key={item.id}
                  hover
                  selected={item.id === selectedId}
                  onClick={() => setSelectedId(item.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{item.id}</TableCell>
                  <TableCell>{localizeUiText(locale, item.object)}</TableCell>
                  <TableCell>{localizeUiText(locale, item.signer)}</TableCell>
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
                <StatusChip label={localizeUiText(locale, selectedGateId || '--')} color="secondary" />
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
              <Button variant="contained" onClick={handleCheckClose} disabled={activeAction === 'validate_close' || !selectedRow?.awbId}>
                {m('关闭前校验')}
              </Button>
              <Button variant="outlined" onClick={handleConfirmSign} disabled={activeAction === 'confirm_sign' || !selectedRow?.awbId}>
                {m('补签确认')}
              </Button>
              <Button variant="outlined" onClick={handleArchive} disabled={activeAction === 'archive' || !selectedRow?.awbId}>
                {m('执行归档')}
              </Button>
            </Stack>

            <Stack sx={{ gap: 0.5 }}>
              <Typography variant="subtitle2">{localizeUiText(locale, gatePolicy?.rule || '--')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {m('触发节点：')}
                {localizeUiText(locale, gatePolicy?.triggerNode || '--')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {m('阻断结果：')}
                {localizeUiText(locale, gatePolicy?.blocker || '--')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {m('恢复动作：')}
                {localizeUiText(locale, gatePolicy?.recovery || '--')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {m('放行角色：')}
                {localizeUiText(locale, gatePolicy?.releaseRole || '--')}
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
        <TaskQueueCard title={m('POD 动作记录')} items={actionLog} />
      </Grid>
    </Grid>
  );
}
