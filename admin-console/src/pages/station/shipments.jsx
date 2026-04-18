import { useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
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
import { useIntl } from 'react-intl';
import { Link as RouterLink } from 'react-router-dom';

import { useGetStationShipmentOptions, useGetStationShipments } from 'api/station';
import MainCard from 'components/MainCard';
import MetricCard from 'components/sinoport/MetricCard';
import PageHeader from 'components/sinoport/PageHeader';
import StatusChip from 'components/sinoport/StatusChip';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';

const PAGE_SIZE = 20;

function getWaybillLink(item) {
  return item.direction === '出港'
    ? `/station/outbound/waybills/${encodeURIComponent(item.awb)}`
    : `/station/inbound/waybills/${encodeURIComponent(item.awb)}`;
}

export default function StationShipmentsPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [flightIdFilter, setFlightIdFilter] = useState('');
  const [currentNodeFilter, setCurrentNodeFilter] = useState('');
  const [fulfillmentStatusFilter, setFulfillmentStatusFilter] = useState('');
  const [blockerStateFilter, setBlockerStateFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  const { stationShipments, stationShipmentPage, stationShipmentsLoading, stationShipmentsError } = useGetStationShipments({
    page: page + 1,
    page_size: PAGE_SIZE,
    keyword,
    direction: directionFilter,
    flight_id: flightIdFilter,
    current_node: currentNodeFilter,
    fulfillment_status: fulfillmentStatusFilter,
    blocker_state: blockerStateFilter,
    include_archived: includeArchived
  });
  const {
    directionOptions,
    flightOptions,
    currentNodeOptions,
    fulfillmentStatusOptions,
    blockerStateOptions,
    stationShipmentOptionsLoading
  } = useGetStationShipmentOptions();

  const metrics = [
    {
      title: m('履约对象总数'),
      value: `${stationShipmentPage.total}`,
      helper: m('统一按履约对象 / 提单聚合观察进港与出港链路'),
      chip: m('对象'),
      color: 'primary'
    },
    {
      title: m('当前页进港对象'),
      value: `${stationShipments.filter((item) => item.direction === '进港').length}`,
      helper: m('重点跟踪进港处理与 NOA / POD'),
      chip: m('进港'),
      color: 'secondary'
    },
    {
      title: m('当前页出港对象'),
      value: `${stationShipments.filter((item) => item.direction === '出港').length}`,
      helper: m('重点跟踪已装载 / 已飞走 / Manifest'),
      chip: m('出港'),
      color: 'success'
    },
    {
      title: m('当前页存在阻断'),
      value: `${stationShipments.filter((item) => item.blocker !== '无').length}`,
      helper: m('需要文件、异常或复核解除后才能继续'),
      chip: m('阻断'),
      color: 'warning'
    }
  ];

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow={m('履约链路')}
          title={m('提单与履约链路')}
          description={m('履约对象已冻结为 AWB 投影 / 履约聚合对象。列表与详情都直接读取数据库聚合 DTO，不再依赖前端本地适配真相。')}
          chips={[m('履约对象投影'), m('数据库聚合 DTO'), m('每页 20 条'), m('只读优先资源')]}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/station/inbound/waybills" variant="outlined">
                {m('进港提单')}
              </Button>
              <Button component={RouterLink} to="/station/outbound/waybills" variant="outlined">
                {m('出港提单')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      {metrics.map((item) => (
        <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
          <MetricCard
            {...item}
            title={item.title}
            helper={item.helper}
            chip={item.chip}
          />
        </Grid>
      ))}

      <Grid size={12}>
        <MainCard title={m('履约对象目录')}>
          <Stack sx={{ gap: 2 }}>
            {stationShipmentsError ? (
              <Alert severity="error">{stationShipmentsError?.response?.data?.error?.message || m('履约对象列表读取失败。')}</Alert>
            ) : null}

            <Stack direction={{ xs: 'column', md: 'row' }} sx={{ gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                label={m('关键词')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 220 }}
                placeholder={m('AWB / 航班 / 收货方')}
              />
              <TextField
                select
                label={m('方向')}
                value={directionFilter}
                onChange={(event) => {
                  setDirectionFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 160 }}
                disabled={stationShipmentOptionsLoading}
              >
                <MenuItem value="">{m('全部方向')}</MenuItem>
                {directionOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('所属航班')}
                value={flightIdFilter}
                onChange={(event) => {
                  setFlightIdFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 220 }}
                disabled={stationShipmentOptionsLoading}
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
                disabled={stationShipmentOptionsLoading}
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
                label={m('履约状态')}
                value={fulfillmentStatusFilter}
                onChange={(event) => {
                  setFulfillmentStatusFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
                disabled={stationShipmentOptionsLoading}
              >
                <MenuItem value="">{m('全部状态')}</MenuItem>
                {fulfillmentStatusOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('阻断状态')}
                value={blockerStateFilter}
                onChange={(event) => {
                  setBlockerStateFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 160 }}
                disabled={stationShipmentOptionsLoading}
              >
                <MenuItem value="">{m('全部')}</MenuItem>
                {blockerStateOptions.map((option) => (
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
              label={m('显示已归档 AWB 投影')}
            />

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('对象')}</TableCell>
                  <TableCell>{m('方向')}</TableCell>
                  <TableCell>{m('所属航班')}</TableCell>
                  <TableCell>{m('当前节点')}</TableCell>
                  <TableCell>{m('履约状态')}</TableCell>
                  <TableCell>{m('文件')}</TableCell>
                  <TableCell>{m('任务')}</TableCell>
                  <TableCell>{m('阻断原因')}</TableCell>
                  <TableCell align="right">{m('操作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stationShipments.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.awb}</TableCell>
                    <TableCell>{localizeUiText(locale, item.direction)}</TableCell>
                    <TableCell>{item.flightNo}</TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, item.currentNode)} />
                    </TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, item.fulfillmentStatus)} />
                    </TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, item.documentStatus)} />
                    </TableCell>
                    <TableCell>
                      <StatusChip label={localizeUiText(locale, item.taskStatus)} />
                    </TableCell>
                    <TableCell>{localizeUiText(locale, item.blocker)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" sx={{ justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          component={RouterLink}
                          to={`/station/shipments/${encodeURIComponent(item.id)}`}
                          size="small"
                          variant="contained"
                        >
                          {m('查看链路')}
                        </Button>
                        <Button component={RouterLink} to={getWaybillLink(item)} size="small" variant="outlined">
                          AWB
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <TablePagination
              component="div"
              count={stationShipmentPage.total}
              page={page}
              onPageChange={(_event, nextPage) => setPage(nextPage)}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
            />

            {stationShipmentsLoading ? <Alert severity="info">{m('履约对象正在从数据库聚合读取，请稍候。')}</Alert> : null}
          </Stack>
        </MainCard>
      </Grid>
    </Grid>
  );
}
