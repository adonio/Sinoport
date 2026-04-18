import { useMemo, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useIntl } from 'react-intl';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import {
  archiveStationOutboundWaybill,
  updateStationOutboundWaybill,
  useGetOutboundWaybills,
  useGetStationWaybillOptions
} from 'api/station';

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  awbId: '',
  awbNo: '',
  awbType: 'EXPORT',
  flightId: '',
  notifyName: '',
  pieces: '',
  grossWeight: '',
  currentNode: '',
  manifestStatus: '',
  archived: false
};

export default function StationOutboundWaybillsPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [flightIdFilter, setFlightIdFilter] = useState('');
  const [currentNodeFilter, setCurrentNodeFilter] = useState('');
  const [manifestStatusFilter, setManifestStatusFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { outboundWaybills, outboundWaybillPage, outboundWaybillsLoading, outboundWaybillsError } = useGetOutboundWaybills({
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword,
    flight_id: flightIdFilter,
    current_node: currentNodeFilter,
    manifest_status: manifestStatusFilter,
    include_archived: includeArchived
  });
  const { flightOptions, awbTypeOptions, currentNodeOptions, manifestStatusOptions, stationWaybillOptionsLoading } =
    useGetStationWaybillOptions('outbound');

  const flightLabelMap = useMemo(() => new Map(flightOptions.map((option) => [option.value, option.label])), [flightOptions]);

  const resetDrawer = () => {
    setDrawerOpen(false);
    setSelectedRow(null);
    setFormState(EMPTY_FORM);
  };

  const openEditPanel = (row) => {
    setSelectedRow(row);
    setFormState({
      awbId: row.awbId,
      awbNo: row.awb,
      awbType: row.awbType || 'EXPORT',
      flightId: row.flightId || '',
      notifyName: row.destination || '',
      pieces: String(row.piecesValue ?? ''),
      grossWeight: String(row.grossWeight ?? ''),
      currentNode: row.currentNode || '',
      manifestStatus: row.manifest || '',
      archived: Boolean(row.archived)
    });
    setFeedback(null);
    setDrawerOpen(true);
  };

  const handleChange = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!formState.awbId) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      await updateStationOutboundWaybill(formState.awbId, {
        awb_no: formState.awbNo,
        awb_type: formState.awbType,
        flight_id: formState.flightId || null,
        notify_name: formState.notifyName,
        pieces: Number(formState.pieces),
        gross_weight: Number(formState.grossWeight),
        current_node: formState.currentNode,
        manifest_status: formState.manifestStatus,
        archived: formState.archived
      });
      setFeedback({ severity: 'success', message: m(`提单 ${formState.awbNo} 已保存。`) });
      resetDrawer();
    } catch (error) {
      setFeedback({ severity: 'error', message: error?.response?.data?.error?.message || m('提单保存失败。') });
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchiveToggle = async (row) => {
    setSubmitting(true);
    setFeedback(null);

    try {
      if (row.archived) {
        await updateStationOutboundWaybill(row.awbId, { archived: false });
        setFeedback({ severity: 'success', message: m(`提单 ${row.awb} 已恢复。`) });
      } else {
        await archiveStationOutboundWaybill(row.awbId);
        setFeedback({ severity: 'success', message: m(`提单 ${row.awb} 已归档。`) });
      }
    } catch (error) {
      setFeedback({ severity: 'error', message: error?.response?.data?.error?.message || m('提单归档失败。') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('出港 / 提单')}
          title={m('出港管理 / 提单管理')}
          description={m('出港提单已收口为正式数据库资源。新增继续走导入链，人工只负责修正、航班绑定和归档恢复。')}
          chips={[m('提单资源'), m('数据库选项'), m('每页 20 条'), m('出港流程')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/outbound/flights" variant="outlined">
                {m('航班管理')}
              </Button>
              <Button component={RouterLink} to="/station/documents" variant="outlined">
                {m('单证中心')}
              </Button>
              <Button component={RouterLink} to="/station/tasks" variant="outlined">
                {m('作业任务')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title={m('出港提单台账')}>
          <Stack sx={{ gap: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                label={m('关键词')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 220 }}
                placeholder={m('AWB / 航班')}
              />
              <TextField
                select
                label={m('所属航班')}
                value={flightIdFilter}
                onChange={(event) => {
                  setFlightIdFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 220 }}
                disabled={stationWaybillOptionsLoading}
              >
                <MenuItem value="">{m('全部航班')}</MenuItem>
                {flightOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('当前节点')}
                value={currentNodeFilter}
                onChange={(event) => {
                  setCurrentNodeFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
                disabled={stationWaybillOptionsLoading}
              >
                <MenuItem value="">{m('全部节点')}</MenuItem>
                {currentNodeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('Manifest')}
                value={manifestStatusFilter}
                onChange={(event) => {
                  setManifestStatusFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
                disabled={stationWaybillOptionsLoading}
              >
                <MenuItem value="">{m('全部状态')}</MenuItem>
                {manifestStatusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <FormControlLabel
              control={
                <Switch
                  checked={includeArchived}
                  onChange={(event) => {
                    setIncludeArchived(event.target.checked);
                    setPage(0);
                  }}
                />
              }
              label={m('显示已归档')}
            />

            {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
            {outboundWaybillsError ? <Alert severity="error">{m('出港提单台账加载失败，请检查后端连接。')}</Alert> : null}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('提单')}</TableCell>
                  <TableCell>{m('所属航班')}</TableCell>
                  <TableCell>{m('目的站')}</TableCell>
                  <TableCell>{m('预报')}</TableCell>
                  <TableCell>{m('收货')}</TableCell>
                  <TableCell>{m('主单')}</TableCell>
                  <TableCell>{m('装载')}</TableCell>
                  <TableCell>{m('Manifest')}</TableCell>
                  <TableCell align="right">{m('操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {outboundWaybills.map((item) => (
                  <TableRow key={item.awbId} hover selected={selectedRow?.awbId === item.awbId}>
                    <TableCell>
                      <Stack>
                        <Typography variant="subtitle2">{item.awb}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, item.awbType)}
                          {item.archived ? ` / ${m('已归档')}` : ''}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{item.flightNo || '--'}</TableCell>
                    <TableCell>{localizeUiText(locale, item.destination)}</TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, item.forecast)} />
                    </TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, item.receipt)} />
                    </TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, item.master)} />
                    </TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, item.loading)} />
                    </TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, item.manifest)} />
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          component={RouterLink}
                          to={`/station/outbound/waybills/${encodeURIComponent(item.awb)}`}
                          size="small"
                          variant="outlined"
                        >
                          {m('查看')}
                        </Button>
                        <Button
                          size="small"
                          variant={selectedRow?.awbId === item.awbId ? 'contained' : 'outlined'}
                          onClick={() => openEditPanel(item)}
                        >
                          {m('编辑')}
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color={item.archived ? 'success' : 'error'}
                          disabled={submitting}
                          onClick={() => handleArchiveToggle(item)}
                        >
                          {item.archived ? m('恢复') : m('归档')}
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {!outboundWaybills.length && !outboundWaybillsLoading ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Typography variant="body2" color="text.secondary">
                        {m('当前条件下没有提单数据。')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>

            <TablePagination
              component="div"
              count={outboundWaybillPage?.total || outboundWaybills.length}
              page={Math.max(0, (outboundWaybillPage?.page || 1) - 1)}
              onPageChange={(_, nextPage) => setPage(nextPage)}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
            />
          </Stack>
        </MainCard>
      </Grid>

      <Drawer anchor="right" open={drawerOpen} onClose={resetDrawer}>
        <Box sx={{ width: { xs: '100vw', sm: 460 }, p: 3 }}>
          <MainCard
            title={selectedRow ? `${m('编辑提单')} / ${selectedRow.awb}` : m('编辑提单')}
            subheader={m('出港提单新增继续走导入链；Drawer 仅负责人工修正、航班绑定和归档恢复。')}
          >
            <Stack sx={{ gap: 2 }}>
              {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
              <TextField label={m('提单')} value={formState.awbNo} onChange={handleChange('awbNo')} />
              <TextField
                select
                label={m('提单类型')}
                value={formState.awbType}
                onChange={handleChange('awbType')}
                disabled={stationWaybillOptionsLoading}
              >
                {awbTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('所属航班')}
                value={formState.flightId}
                onChange={handleChange('flightId')}
                disabled={stationWaybillOptionsLoading}
                helperText={formState.flightId ? localizeUiText(locale, flightLabelMap.get(formState.flightId)) : m('选择绑定航班')}
              >
                <MenuItem value="">{m('未绑定')}</MenuItem>
                {flightOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label={m('通知方 / 目的站备注')} value={formState.notifyName} onChange={handleChange('notifyName')} />
              <TextField label={m('件数')} type="number" value={formState.pieces} onChange={handleChange('pieces')} />
              <TextField label={m('重量 (kg)')} type="number" value={formState.grossWeight} onChange={handleChange('grossWeight')} />
              <TextField
                select
                label={m('当前节点')}
                value={formState.currentNode}
                onChange={handleChange('currentNode')}
                disabled={stationWaybillOptionsLoading}
              >
                {currentNodeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('Manifest')}
                value={formState.manifestStatus}
                onChange={handleChange('manifestStatus')}
                disabled={stationWaybillOptionsLoading}
              >
                {manifestStatusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <FormControlLabel
                control={<Switch checked={formState.archived} onChange={handleChange('archived')} />}
                label={m('归档状态')}
              />
              <Stack direction="row" justifyContent="flex-end" sx={{ gap: 1 }}>
                <Button variant="outlined" onClick={resetDrawer}>
                  {m('取消')}
                </Button>
                <Button variant="contained" disabled={submitting} onClick={handleSubmit}>
                  {submitting ? m('保存中...') : m('保存提单')}
                </Button>
              </Stack>
            </Stack>
          </MainCard>
        </Box>
      </Drawer>
    </Grid>
  );
}
