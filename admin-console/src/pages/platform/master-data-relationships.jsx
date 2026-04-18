import { useState } from 'react';
import { useIntl } from 'react-intl';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Link as RouterLink } from 'react-router-dom';

import MainCard from 'components/MainCard';
import PageHeader from 'components/sinoport/PageHeader';
import { formatLocalizedMessage, localizeUiText } from 'utils/app-i18n';
import {
  useGetPlatformMasterDataRelationshipDetail,
  useGetPlatformMasterDataRelationshipOptions,
  useGetPlatformMasterDataRelationships
} from 'api/platform';

const PAGE_SIZE = 20;

function formatDateTime(value) {
  return value ? String(value).replace('T', ' ').slice(0, 16) : '--';
}

export default function PlatformMasterDataRelationshipsPage() {
  const intl = useIntl();
  const m = (value) => formatLocalizedMessage(intl, value);
  const locale = intl.locale;
  const [page, setPage] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [sourceTypeFilter, setSourceTypeFilter] = useState('');
  const [relationFilter, setRelationFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [evidenceFilter, setEvidenceFilter] = useState('');
  const [activeRelationshipId, setActiveRelationshipId] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);

  const { nodeTypes, relationTypes, evidenceSources, masterDataRelationshipOptionsLoading } =
    useGetPlatformMasterDataRelationshipOptions();
  const { relationshipRows, relationshipPage, masterDataRelationshipsLoading, masterDataRelationshipsError } =
    useGetPlatformMasterDataRelationships({
      page: page + 1,
      page_size: PAGE_SIZE,
      keyword,
      source_object_type: sourceTypeFilter,
      relation_type: relationFilter,
      target_object_type: targetTypeFilter,
      evidence_source: evidenceFilter
    });
  const { relationship, chainRows, masterDataRelationshipDetailLoading, masterDataRelationshipDetailError } =
    useGetPlatformMasterDataRelationshipDetail(detailOpen && activeRelationshipId ? activeRelationshipId : null);

  const tableRows = relationshipPage?.items || relationshipRows;
  const total = relationshipPage?.total || tableRows.length;
  const currentPage = Math.max(0, (relationshipPage?.page || 1) - 1);
  const selectedRelationship = relationship || tableRows.find((item) => item.relationship_id === activeRelationshipId) || null;

  const openDetail = (record) => {
    setActiveRelationshipId(record.relationship_id);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setActiveRelationshipId('');
  };

  return (
    <Grid container rowSpacing={3} columnSpacing={3}>
      <Grid size={12}>
        <PageHeader
          eyebrow="Object Relationships"
          title={m('对象关系总览')}
          description={m('对象关系读源已切到正式只读聚合表；列表默认后端分页 20 条，关系链详情通过正式 detail 接口展开。')}
          chips={['DB Read Model', 'DB Options', '20/page', 'Read Only']}
          action={
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
              <Button component={RouterLink} to="/platform/master-data" variant="outlined">
                {m('主数据治理')}
              </Button>
              <Button component={RouterLink} to="/platform/rules" variant="outlined">
                {m('规则引擎')}
              </Button>
              <Button component={RouterLink} to="/platform/audit/trust" variant="outlined">
                {m('可信留痕')}
              </Button>
            </Stack>
          }
        />
      </Grid>

      <Grid size={12}>
        <MainCard title={m('对象关系链')} subheader={m('正式聚合读源 `platform_master_data_relationships`，默认后端分页 20 条。')}>
          <Stack sx={{ gap: 2 }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} sx={{ gap: 2, alignItems: { lg: 'center' } }}>
              <TextField
                label={m('关键字')}
                placeholder={m('关系编码 / Source / Target / 链路摘要')}
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value);
                  setPage(0);
                }}
                fullWidth
              />
              <TextField
                select
                label={m('Source 类型')}
                value={sourceTypeFilter}
                onChange={(event) => {
                  setSourceTypeFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">{m('全部 Source')}</MenuItem>
                {nodeTypes.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('关系')}
                value={relationFilter}
                onChange={(event) => {
                  setRelationFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="">{m('全部关系')}</MenuItem>
                {relationTypes.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('Target 类型')}
                value={targetTypeFilter}
                onChange={(event) => {
                  setTargetTypeFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">{m('全部 Target')}</MenuItem>
                {nodeTypes.map((option) => (
                  <MenuItem key={`target-${option.value}`} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                label={m('证据源')}
                value={evidenceFilter}
                onChange={(event) => {
                  setEvidenceFilter(event.target.value);
                  setPage(0);
                }}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="">{m('全部证据')}</MenuItem>
                {evidenceSources.map((option) => (
                  <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
                    {localizeUiText(locale, option.label)}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            {masterDataRelationshipsError ? <Alert severity="error">{m('对象关系加载失败，请检查后端连接。')}</Alert> : null}
            {masterDataRelationshipOptionsLoading ? <Alert severity="info">{m('正在从数据库加载关系筛选项…')}</Alert> : null}

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{m('关系编码')}</TableCell>
                  <TableCell>{localizeUiText(locale, 'Source')}</TableCell>
                  <TableCell>{m('关系')}</TableCell>
                  <TableCell>{localizeUiText(locale, 'Target')}</TableCell>
                  <TableCell>{m('关系链摘要')}</TableCell>
                  <TableCell>{m('证据源')}</TableCell>
                  <TableCell>{m('更新时间')}</TableCell>
                  <TableCell align="right">{m('动作')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map((record) => (
                  <TableRow
                    key={record.relationship_id}
                    hover
                    selected={selectedRelationship?.relationship_id === record.relationship_id}
                  >
                    <TableCell>{record.relationship_id}</TableCell>
                    <TableCell sx={{ minWidth: 220 }}>
                      <Stack sx={{ gap: 0.5 }}>
                        <Typography variant="subtitle2">{localizeUiText(locale, record.source)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, record.source_type)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{localizeUiText(locale, record.relation)}</TableCell>
                    <TableCell sx={{ minWidth: 220 }}>
                      <Stack sx={{ gap: 0.5 }}>
                        <Typography variant="subtitle2">{localizeUiText(locale, record.target)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {localizeUiText(locale, record.target_type)}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ minWidth: 300 }}>{localizeUiText(locale, record.path_summary)}</TableCell>
                    <TableCell>{localizeUiText(locale, record.evidence)}</TableCell>
                    <TableCell>{formatDateTime(record.updated_at)}</TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="text" onClick={() => openDetail(record)}>
                        {m('查看链路')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!masterDataRelationshipsLoading && !tableRows.length ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Typography variant="body2" color="text.secondary">
                        {m('当前筛选条件下没有关系记录。')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>

            <TablePagination
              component="div"
              count={total}
              page={currentPage}
              onPageChange={(_, nextPage) => setPage(nextPage)}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
            />
          </Stack>
        </MainCard>
      </Grid>

      <Drawer anchor="right" open={detailOpen} onClose={closeDetail} PaperProps={{ sx: { width: { xs: '100%', sm: 500 } } }}>
        <Stack sx={{ p: 3, gap: 2 }}>
          <Stack sx={{ gap: 0.5 }}>
            <Typography variant="h5">{activeRelationshipId || m('关系链详情')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {m('只读聚合对象，不开放手工编辑。')}
            </Typography>
          </Stack>

          {masterDataRelationshipDetailLoading ? <Alert severity="info">{m('正在加载关系链详情…')}</Alert> : null}
          {masterDataRelationshipDetailError ? <Alert severity="error">{m('关系链详情加载失败，请稍后重试。')}</Alert> : null}

          {selectedRelationship ? (
            <Stack sx={{ gap: 1.5 }}>
              <TextField label={localizeUiText(locale, 'Source')} value={`${localizeUiText(locale, selectedRelationship.source_type)} / ${localizeUiText(locale, selectedRelationship.source)}`} InputProps={{ readOnly: true }} />
              <TextField label={localizeUiText(locale, 'Relation')} value={localizeUiText(locale, selectedRelationship.relation || '--')} InputProps={{ readOnly: true }} />
              <TextField label={localizeUiText(locale, 'Target')} value={`${localizeUiText(locale, selectedRelationship.target_type)} / ${localizeUiText(locale, selectedRelationship.target)}`} InputProps={{ readOnly: true }} />
              <TextField label={m('证据源')} value={localizeUiText(locale, selectedRelationship.evidence || '--')} InputProps={{ readOnly: true }} />
              <TextField label={m('链路深度')} value={String(selectedRelationship.path_depth || 0)} InputProps={{ readOnly: true }} />
              <TextField label={m('摘要')} value={localizeUiText(locale, selectedRelationship.path_summary || '')} InputProps={{ readOnly: true }} multiline minRows={3} />
              <TextField label={m('备注')} value={localizeUiText(locale, selectedRelationship.note || m('暂无补充说明'))} InputProps={{ readOnly: true }} multiline minRows={2} />

              <MainCard title={m('关联链路')} content={false}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{localizeUiText(locale, 'Source')}</TableCell>
                      <TableCell>{m('关系')}</TableCell>
                      <TableCell>{localizeUiText(locale, 'Target')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {chainRows.map((row) => (
                      <TableRow key={row.relationship_id} selected={row.relationship_id === selectedRelationship.relationship_id}>
                        <TableCell>{localizeUiText(locale, row.source)}</TableCell>
                        <TableCell>{localizeUiText(locale, row.relation)}</TableCell>
                        <TableCell>{localizeUiText(locale, row.target)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </MainCard>
            </Stack>
          ) : null}

          <Stack direction="row" justifyContent="flex-end">
            <Button variant="text" onClick={closeDetail}>
              {m('关闭')}
            </Button>
          </Stack>
        </Stack>
      </Drawer>
    </Grid>
  );
}
