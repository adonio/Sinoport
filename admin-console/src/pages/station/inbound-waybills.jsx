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
import { archiveStationInboundWaybill, updateStationInboundWaybill, useGetInboundWaybills, useGetStationWaybillOptions } from 'api/station';

const PAGE_SIZE = 20;

const EMPTY_FORM = {
  awbId: '',
  awbNo: '',
  awbType: 'IMPORT',
  flightId: '',
  consigneeName: '',
  pieces: '',
  grossWeight: '',
  currentNode: '',
  noaStatus: '',
  podStatus: '',
  transferStatus: '',
  archived: false
};

export default function StationInboundWaybillsPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [flightIdFilter, setFlightIdFilter] = useState('');
  const [currentNodeFilter, setCurrentNodeFilter] = useState('');
  const [noaStatusFilter, setNoaStatusFilter] = useState('');
  const [podStatusFilter, setPodStatusFilter] = useState('');
  const [transferStatusFilter, setTransferStatusFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [selectedRow, setSelectedRow] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const { inboundWaybills, inboundWaybillPage, inboundWaybillsLoading, inboundWaybillsError } = useGetInboundWaybills({
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword,
    flight_id: flightIdFilter,
    current_node: currentNodeFilter,
    noa_status: noaStatusFilter,
    pod_status: podStatusFilter,
    transfer_status: transferStatusFilter,
    include_archived: includeArchived
  });
  const {
    flightOptions,
    awbTypeOptions,
    currentNodeOptions,
    noaStatusOptions,
    podStatusOptions,
    transferStatusOptions,
    stationWaybillOptionsLoading
  } = useGetStationWaybillOptions('inbound');

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
      awbType: row.awbType || 'IMPORT',
      flightId: row.flightId || '',
      consigneeName: row.consignee || '',
      pieces: String(row.piecesValue ?? row.pieces ?? ''),
      grossWeight: String(row.grossWeight ?? ''),
      currentNode: row.currentNode || '',
      noaStatus: row.noaStatus || '',
      podStatus: row.podStatus || '',
      transferStatus: row.transferStatus || '',
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
      await updateStationInboundWaybill(formState.awbId, {
        awb_no: formState.awbNo,
        awb_type: formState.awbType,
        flight_id: formState.flightId || null,
        consignee_name: formState.consigneeName,
        pieces: Number(formState.pieces),
        gross_weight: Number(formState.grossWeight),
        current_node: formState.currentNode,
        noa_status: formState.noaStatus,
        pod_status: formState.podStatus,
        transfer_status: formState.transferStatus,
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
        await updateStationInboundWaybill(row.awbId, { archived: false });
        setFeedback({ severity: 'success', message: m(`提单 ${row.awb} 已恢复。`) });
      } else {
        await archiveStationInboundWaybill(row.awbId);
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
          eyebrow={m('进港 / 提单')}
          title={m('进港管理 / 提单管理')}
          description={m('进港提单已收口为正式数据库资源。新增继续走导入链，列表、筛选、人工修正与归档都直接走数据库接口。')}
          chips={[m('提单资源'), m('数据库选项'), m('每页 20 条'), m('进港流程')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/inbound/flights" variant="outlined">
                {m('航班管理')}
              </Button>
              <Button component={RouterLink} to="/station/documents/noa" variant="outlined">
                NOA
              </Button>
              <Button component={RouterLink} to="/station/documents/pod" variant="outlined">
                POD
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title={m('进港提单台账')}>
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
                placeholder={m('AWB / 收货方')}
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
                label={m('NOA')}
                value={noaStatusFilter}
                onChange={(event) => {
                  setNoaStatusFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 140 }}
                disabled={stationWaybillOptionsLoading}
              >
                <MenuItem value="">{m('全部')}</MenuItem>
                {noaStatusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('POD')}
                value={podStatusFilter}
                onChange={(event) => {
                  setPodStatusFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 140 }}
                disabled={stationWaybillOptionsLoading}
              >
                <MenuItem value="">{m('全部')}</MenuItem>
                {podStatusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('转运')}
                value={transferStatusFilter}
                onChange={(event) => {
                  setTransferStatusFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 160 }}
                disabled={stationWaybillOptionsLoading}
              >
                <MenuItem value="">{m('全部')}</MenuItem>
                {transferStatusOptions.map((option) => (
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
            {inboundWaybillsError ? <Alert severity="error">{m('进港提单台账加载失败，请检查后端连接。')}</Alert> : null}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('提单')}</TableCell>
                  <TableCell>{m('所属航班')}</TableCell>
                  <TableCell>{m('收货方')}</TableCell>
                  <TableCell>{m('件数 / 重量')}</TableCell>
                  <TableCell>{m('当前节点')}</TableCell>
                  <TableCell>NOA</TableCell>
                  <TableCell>POD</TableCell>
                  <TableCell>{m('转运')}</TableCell>
                  <TableCell align="right">{m('操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inboundWaybills.map((item) => (
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
                    <TableCell>{item.consignee || '--'}</TableCell>
                    <TableCell>
                      {item.pieces} pcs / {item.weight}
                    </TableCell>
                    <TableCell>{localizeUiText(locale, item.currentNode)}</TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, item.noaStatus)} />
                    </TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, item.podStatus)} />
                    </TableCell>
                    <TableCell>{localizeUiText(locale, item.transferStatus)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          component={RouterLink}
                          to={`/station/inbound/waybills/${encodeURIComponent(item.awb)}`}
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
                {!inboundWaybills.length && !inboundWaybillsLoading ? (
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
              count={inboundWaybillPage?.total || inboundWaybills.length}
              page={Math.max(0, (inboundWaybillPage?.page || 1) - 1)}
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
            subheader={m('新增继续走导入链；Drawer 仅负责人工修正、航班绑定和归档恢复。')}
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
              <TextField label={m('收货方')} value={formState.consigneeName} onChange={handleChange('consigneeName')} />
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
                label={m('NOA')}
                value={formState.noaStatus}
                onChange={handleChange('noaStatus')}
                disabled={stationWaybillOptionsLoading}
              >
                {noaStatusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('POD')}
                value={formState.podStatus}
                onChange={handleChange('podStatus')}
                disabled={stationWaybillOptionsLoading}
              >
                {podStatusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('转运状态')}
                value={formState.transferStatus}
                onChange={handleChange('transferStatus')}
                disabled={stationWaybillOptionsLoading}
              >
                {transferStatusOptions.map((option) => (
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
